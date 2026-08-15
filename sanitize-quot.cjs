/**
 * Sanitize script: Remove all &quot; entities from the test case xlsx.
 *
 * The Excel file uses a shared strings table (xl/sharedStrings.xml). Some
 * cells contain the XML entity "&quot;" which represents a literal double
 * quote. When the file is opened in tools that don't fully render XML
 * entities (or when the raw content is read), the corruption "&quot" appears.
 *
 * This script:
 *   1. Reads the xlsx ZIP archive
 *   2. Locates &quot; in xl/sharedStrings.xml and ALL sheet XML files
 *   3. Replaces &quot; with the literal " character (which is valid in XML
 *      text content)
 *   4. Writes a new sanitized xlsx, preserving all other content
 *      (formatting, headers, sheet structure, rels, etc.)
 */

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const SRC = 'docs/test_cases.xlsx';
const DEST = 'docs/test_cases.xlsx';

const buf = fs.readFileSync(SRC);

let off = 0;
const files = [];
while (off < buf.length) {
  if (buf.readUInt32LE(off) !== 0x04034b50) break;
  const nameLen = buf.readUInt16LE(off + 26);
  const csize = buf.readUInt32LE(off + 18);
  const usize = buf.readUInt32LE(off + 22);
  const name = buf.toString('utf8', off + 30, off + 30 + nameLen);
  const dataStart = off + 30 + nameLen;
  let data = buf.slice(dataStart, dataStart + csize);
  const method = buf.readUInt16LE(off + 8);
  let decompressed;
  if (method === 8) {
    try { decompressed = zlib.inflateRawSync(data); } catch (e) { decompressed = data; }
  } else {
    decompressed = data;
  }
  files.push({ name, method, uncompressed: decompressed });
  off = dataStart + csize;
}

console.log(`Read ${files.length} files from archive`);

let totalReplacements = 0;
for (const file of files) {
  if (file.name.endsWith('.xml') || file.name.endsWith('.rels')) {
    const before = file.uncompressed.toString('utf8');
    const after = before.replace(/&quot;/g, '"');
    const replaced = (before.match(/&quot;/g) || []).length;
    if (replaced > 0) {
      file.uncompressed = Buffer.from(after, 'utf8');
      totalReplacements += replaced;
      console.log(`  ${file.name}: ${replaced} replacements`);
    }
  }
}

console.log(`\nTotal &quot; -> " replacements: ${totalReplacements}`);

// ----------------------------------------------------------------------------
// Rebuild the ZIP archive with sanitized content
// ----------------------------------------------------------------------------

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildZip(files) {
  const localParts = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const data = file.uncompressed;
    const compressed = zlib.deflateRawSync(data);
    const useCompression = true;
    const storedData = useCompression ? compressed : data;
    const method = useCompression ? 8 : 0;
    const crc = crc32(data);
    const size = data.length;
    const csize = storedData.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(csize, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(Buffer.concat([localHeader, nameBuf, storedData]));

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(csize, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    central.push(Buffer.concat([centralHeader, nameBuf]));

    offset += Buffer.concat([localHeader, nameBuf, storedData]).length;
  }

  const localBuf = Buffer.concat(localParts);
  const centralBuf = Buffer.concat(central);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localBuf.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localBuf, centralBuf, eocd]);
}

const zip = buildZip(files);
fs.writeFileSync(DEST, zip);
console.log(`\nWrote sanitized archive: ${path.resolve(DEST)}`);
console.log(`  Size: ${(zip.length / 1024).toFixed(1)} KB`);

// ----------------------------------------------------------------------------
// Verify: re-read the sanitized file and confirm no &quot; remains
// ----------------------------------------------------------------------------

const newBuf = fs.readFileSync(DEST);
let off2 = 0;
let remaining = 0;
while (off2 < newBuf.length) {
  if (newBuf.readUInt32LE(off2) !== 0x04034b50) break;
  const nameLen = newBuf.readUInt16LE(off2 + 26);
  const csize = newBuf.readUInt32LE(off2 + 18);
  const name = newBuf.toString('utf8', off2 + 30, off2 + 30 + nameLen);
  const dataStart = off2 + 30 + nameLen;
  let data = newBuf.slice(dataStart, dataStart + csize);
  if (newBuf.readUInt16LE(off2 + 8) === 8) {
    try { data = zlib.inflateRawSync(data); } catch (e) {}
  }
  if (name.endsWith('.xml')) {
    const text = data.toString('utf8');
    const matches = text.match(/&quot/g);
    if (matches) {
      remaining += matches.length;
      console.log(`  WARNING: ${name} still has ${matches.length} &quot occurrences`);
    }
  }
  off2 = dataStart + csize;
}

if (remaining === 0) {
  console.log('\nVerification: PASS - no &quot; remaining in any XML part');
} else {
  console.log(`\nVerification: FAIL - ${remaining} &quot; still present`);
  process.exit(1);
}