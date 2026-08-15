/**
 * populate-report5.cjs
 *
 * Reads the Report5_Test Report.xlsx template, injects all 313 test cases
 * from generate-test-cases.cjs into the 2 Feature tabs, updates Cover /
 * Test Cases / Test Statistics sheets, cleans &quot; entities, and saves back.
 *
 * Usage: node populate-report5.cjs
 *
 * Feature tab split:
 *   Feature 1 → Auth(83) + Papers(31) + Researcher(27) + Reviewer(54)
 *               + Lecturer(26) + GraduateStudent(16) = 237 TCs
 *   Feature 2 → Shared(35+8=43) + Services(26) + Hooks(16)
 *               + Routing(11) + Admin(6) = 102 TCs
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

// ============================================================================
// ZIP helpers (manual — no external deps)
// ============================================================================

function readZipEntries(buf) {
  const entries = {};
  let off = 0;
  while (off < buf.length) {
    if (buf.readUInt32LE(off) !== 0x04034b50) break;
    const ver      = buf.readUInt16LE(off + 4);
    const flags    = buf.readUInt16LE(off + 6);
    const method   = buf.readUInt16LE(off + 8);
    const csize    = buf.readUInt32LE(off + 18);
    const usize    = buf.readUInt32LE(off + 22);
    const nameLen  = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const name     = buf.toString('utf8', off + 30, off + 30 + nameLen);
    const dataStart= off + 30 + nameLen + extraLen;
    const rawData = buf.slice(dataStart, dataStart + csize);
    let data = rawData;
    if (method === 8 && !(flags & 0x08)) {
      try { data = zlib.inflateRawSync(rawData); } catch (e) {}
    }
    entries[name] = data;
    off = dataStart + csize;
  }
  return entries;
}

function writeZipEntries(entries) {
  const localParts  = [];
  const centralHdrs = [];
  let localOffset   = 0;

  const sorted = Object.keys(entries).sort();
  for (const name of sorted) {
    const raw     = entries[name];
    const crc     = crc32(raw);
    let method    = 0;
    let cdata     = raw;
    if (raw.length > 0) {
      try { cdata = zlib.deflateRawSync(raw); method = 8; } catch (e) {}
    }
    const nameBytes = Buffer.from(name, 'utf8');

    // --- Local file header (30 bytes) ---
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(method === 8 ? 0x0002 : 0, 6);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(cdata.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBytes.length, 26);
    lh.writeUInt16LE(0, 28);

    localParts.push(Buffer.concat([lh, nameBytes, cdata]));

    // --- Central directory file header (46 bytes + name) ---
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(method === 8 ? 0x0002 : 0, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(cdata.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameBytes.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(localOffset, 42);

    centralHdrs.push(Buffer.concat([ch, nameBytes]));
    localOffset += 30 + nameBytes.length + cdata.length;
  }

  // --- End of central directory record (22 bytes) ---
  const cdSize   = centralHdrs.reduce((s, b) => s + b.length, 0);
  const cdOffset = localOffset;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(sorted.length, 8);
  eocd.writeUInt16LE(sorted.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralHdrs, eocd]);
}

// Minimal CRC-32 table
const _crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = _crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ============================================================================
// XML helpers
// ============================================================================

function escapeXml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r/g, '');
}

function colLetter(n) {
  let s = '';
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

// ============================================================================
// Shared-string helpers
// ============================================================================

function buildSharedStrings(strings) {
  const unique = [];
  const idxMap = {};
  for (const s of strings) {
    const key = s;
    if (idxMap[key] === undefined) {
      idxMap[key] = unique.length;
      unique.push(key);
    }
  }

  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `count="${strings.length}" uniqueCount="${unique.length}">`;
  for (const s of unique) {
    const escaped = escapeXml(s);
    const hasBreak = escaped.includes('\n');
    if (hasBreak) {
      xml += `<si><r><rPr><sz val="10"/><name val="Tahoma"/></rPr><t xml:space="preserve">${escaped}</t></r></si>`;
    } else {
      xml += `<si><t xml:space="preserve">${escaped}</t></si>`;
    }
  }
  xml += '</sst>';
  return xml;
}

function strToSiIdx(strings, s) {
  let idx = strings.indexOf(s);
  if (idx === -1) { strings.push(s); idx = strings.length - 1; }
  return idx;
}

// ============================================================================
// Build a Feature sheet XML
// ============================================================================

function buildFeatureSheetXml(tcGroups, allStrings) {
  // tcGroups: [{ label, tcs: [{title, preconditions, steps, data, expected}] }]
  // Returns sheet XML string + updated allStrings

  // Collect all strings for sharedStrings
  const sst = [];

  // --- Fixed strings (sharedStrings indices) ---
  const si = {
    round1:   strToSiIdx(sst, 'Round 1'),
    pending:  strToSiIdx(sst, 'Pending'),
    passed:   strToSiIdx(sst, 'Passed'),
    failed:   strToSiIdx(sst, 'Failed'),
    tcId:     strToSiIdx(sst, 'Test Case ID'),
    tcDesc:   strToSiIdx(sst, 'Test Case Description'),
    tcProc:   strToSiIdx(sst, 'Test Case Procedure'),
    expRes:   strToSiIdx(sst, 'Expected Results'),
    note:     strToSiIdx(sst, 'Note'),
    testDate: strToSiIdx(sst, 'Test date'),
    tester:   strToSiIdx(sst, 'Tester'),
    ref:      strToSiIdx(sst, 'Reference'),
    na:       strToSiIdx(sst, 'N/A'),
    noTcs:    strToSiIdx(sst, 'Number of TCs'),
    testingRound: strToSiIdx(sst, 'Testing Round'),
    round1Label:  strToSiIdx(sst, 'Round 1'),
    testerLabel:  strToSiIdx(sst, 'Tester'),
    numTcs:       strToSiIdx(sst, 'Number of TCs'),
  };

  // Collect TC strings
  for (const grp of tcGroups) {
    for (const tc of grp.tcs) {
      strToSiIdx(sst, tc.title);
      strToSiIdx(sst, tc.preconditions);
      strToSiIdx(sst, tc.steps);
      strToSiIdx(sst, tc.data);
      strToSiIdx(sst, tc.expected);
    }
  }

  // === Build sheet XML ===

  // style indices for data rows (re-use style 42 from original template)
  // We keep everything as inlineStr to avoid needing style definitions
  const dataStyle = ' s="42"';
  const headerStyle = ' s="99"';

  function sstCell(col, row, siIdx, style) {
    return `<c r="${col}${row}"${style} t="s"><v>${siIdx}</v></c>`;
  }

  function textCell(col, row, text, style) {
    const i = strToSiIdx(sst, text);
    return sstCell(col, row, i, style);
  }

  // Header row 10
  let sheetData = `<row r="10" ht="15" customHeight="1">`;
  sheetData += sstCell('A', 10, si.tcId, headerStyle);
  sheetData += sstCell('B', 10, si.tcDesc, headerStyle);
  sheetData += sstCell('C', 10, si.tcProc, headerStyle);
  sheetData += sstCell('D', 10, si.expRes, headerStyle);
  sheetData += sstCell('E', 10, si.note, headerStyle);
  sheetData += sstCell('F', 10, si.pending, headerStyle);
  sheetData += sstCell('G', 10, si.testDate, headerStyle);
  sheetData += sstCell('H', 10, si.tester, headerStyle);
  sheetData += sstCell('I', 10, si.pending, headerStyle);
  sheetData += sstCell('J', 10, si.testDate, headerStyle);
  sheetData += sstCell('K', 10, si.tester, headerStyle);
  sheetData += sstCell('L', 10, si.pending, headerStyle);
  sheetData += sstCell('M', 10, si.testDate, headerStyle);
  sheetData += sstCell('N', 10, si.tester, headerStyle);
  sheetData += sstCell('O', 10, si.ref, headerStyle);
  sheetData += `</row>\r\n`;

  let rowNum = 11;
  let tcCount = 0;

  for (const grp of tcGroups) {
    // Round label row
    sheetData += `<row r="${rowNum}" ht="15" customHeight="1">`;
    sheetData += textCell('A', rowNum, grp.label, dataStyle);
    sheetData += `</row>\r\n`;
    rowNum++;

    for (const tc of grp.tcs) {
      tcCount++;
      const tcId = `TC_${String(tcCount).padStart(3, '0')}`;
      sheetData += `<row r="${rowNum}" ht="40" customHeight="1">`;
      sheetData += textCell('A', rowNum, tcId, dataStyle);
      sheetData += textCell('B', rowNum, tc.title, dataStyle);
      sheetData += textCell('C', rowNum, tc.steps, dataStyle);
      sheetData += textCell('D', rowNum, tc.expected, dataStyle);
      sheetData += textCell('E', rowNum, tc.preconditions, dataStyle);
      sheetData += textCell('F', rowNum, 'Pending', dataStyle);
      sheetData += textCell('G', rowNum, '', dataStyle);
      sheetData += textCell('H', rowNum, '', dataStyle);
      sheetData += textCell('I', rowNum, 'Pending', dataStyle);
      sheetData += textCell('J', rowNum, '', dataStyle);
      sheetData += textCell('K', rowNum, '', dataStyle);
      sheetData += textCell('L', rowNum, 'Pending', dataStyle);
      sheetData += textCell('M', rowNum, '', dataStyle);
      sheetData += textCell('N', rowNum, '', dataStyle);
      sheetData += textCell('O', rowNum, tc.data, dataStyle);
      sheetData += `</row>\r\n`;
      rowNum++;
    }
  }

  const dimRef = `A1:O${rowNum - 1}`;

  // Build complete sheet XML — reuse original structure blocks
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n` +
`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
`<dimension ref="${dimRef}"/>` +
`<sheetViews><sheetView workbookViewId="0"><pane ySplit="10" topLeftCell="A11" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
`<sheetFormatPr defaultRowHeight="15" customHeight="1"/>` +
`<cols>` +
  `<col min="1" max="1" width="17" customWidth="1"/>` +
  `<col min="2" max="2" width="34.5" customWidth="1"/>` +
  `<col min="3" max="3" width="34.16" customWidth="1"/>` +
  `<col min="4" max="4" width="34.66" customWidth="1"/>` +
  `<col min="5" max="5" width="28.33" customWidth="1"/>` +
  `<col min="6" max="6" width="9.33" customWidth="1"/>` +
  `<col min="7" max="7" width="10.66" customWidth="1"/>` +
  `<col min="8" max="8" width="7" customWidth="1"/>` +
  `<col min="9" max="9" width="9.33" customWidth="1"/>` +
  `<col min="10" max="10" width="10.66" customWidth="1"/>` +
  `<col min="11" max="11" width="7" customWidth="1"/>` +
  `<col min="12" max="12" width="9.33" customWidth="1"/>` +
  `<col min="13" max="13" width="10.66" customWidth="1"/>` +
  `<col min="14" max="14" width="7" customWidth="1"/>` +
  `<col min="15" max="15" width="28.66" customWidth="1"/>` +
  `<col min="16" max="16" width="10.16" customWidth="1"/>` +
  `<col min="17" max="17" width="8.16" customWidth="1"/>` +
  `<col min="18" max="18" width="7.66" customWidth="1" hidden="1"/>` +
`</cols>` +
`<sheetData>${sheetData}</sheetData>` +
`<sheetCalcPr fullCalcOnLoad="1"/>` +
`<printOptions horizontalCentered="1"/>` +
`<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>` +
`</worksheet>`;

  // Build the sharedStrings for this sheet
  Object.assign(allStrings, { featureSst: sst, featureSstXml: buildSharedStrings(sst) });

  return sheetXml;
}

// ============================================================================
// Update Cover sheet
// ============================================================================

function updateCoverSheet(xml, replacements) {
  let out = xml;

  // Replace <Project Name> placeholder
  out = out.replace(/<c r="B4"[^>]*t="s"[^>]*><v>1<\/v><\/c>/,
    `<c r="B4" t="inlineStr"><is><t>${escapeXml(replacements.projectName)}</t></is></c>`);

  // Replace <Project Code> placeholder
  out = out.replace(/<c r="B5"[^>]*t="s"[^>]*><v>4<\/v><\/c>/,
    `<c r="B5" t="inlineStr"><is><t>${escapeXml(replacements.projectCode)}</t></is></c>`);

  // Replace Creator (F4)
  out = out.replace(/(<c r="F4"[^>]*>)[\s\S]*?(<\/c>)/,
    `$1<t>${escapeXml(replacements.creator)}</t>$2`);

  // Replace Version (F6)
  out = out.replace(/(<c r="F6"[^>]*>)[\s\S]*?(<\/c>)/,
    `$1<t>${escapeXml(replacements.version)}</t>$2`);

  // Clean any &quot; entities
  out = out.replace(/&quot;/g, '"');

  return out;
}

// ============================================================================
// Update Test Cases sheet (function list)
// ============================================================================

function updateTestCasesSheet(xml, functionList) {
  // functionList: [{ no, funcName, sheetName, description, preCondition }]
  // Table starts at row 8 (header row 8, data row 9)
  // Columns: B=No, C=Function Name, D=Sheet Name (hyperlink), E=Description, F=Pre-Condition

  let out = xml;
  out = out.replace(/&quot;/g, '"');

  // Replace function rows (rows 9-13) with actual data
  const newRows = [];
  functionList.forEach((f, i) => {
    const row = 9 + i;
    const sheetRef = f.sheetName === 'Feature 1' ? 'Feature1' : 'Feature2';
    newRows.push(
      `<row r="${row}">` +
        `<c r="B${row}" t="n"><v>${f.no}</v></c>` +
        `<c r="C${row}" t="inlineStr"><is><t>${escapeXml(f.funcName)}</t></is></c>` +
        `<c r="D${row}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(f.sheetName)}</t></is></c>` +
        `<c r="E${row}" t="inlineStr"><is><t>${escapeXml(f.description)}</t></is></c>` +
        `<c r="F${row}" t="inlineStr"><is><t>${escapeXml(f.preCondition)}</t></is></c>` +
      `</row>`
    );
  });

  // Replace sheetData content
  out = out.replace(/(<sheetData>)[\s\S]*?(<\/sheetData>)/,
    `$1\r\n${newRows.join('\r\n')}\r\n$2`);

  return out;
}

// ============================================================================
// Update Test Statistics sheet
// ============================================================================

function updateStatsSheet(xml) {
  let out = xml;
  out = out.replace(/&quot;/g, '"');

  // Fix C11 → Feature 1, C12 → Feature 2
  // These are formula cells: ='Feature 1'!B2  and ='Feature 2'!B2
  // Change to display the feature name
  out = out.replace(/(<c r="C11"[^>]*>)<f>[^<]*<\/f><\/c>/,
    `$1<t>Feature 1</t></c>`);
  out = out.replace(/(<c r="C12"[^>]*>)<f>[^<]*<\/f><\/c>/,
    `$1<t>Feature 2</t></c>`);

  // Also update the label cells for feature names
  // B11 = 1 already (No), C11 now = Feature 1
  // B12 = 2, C12 now = Feature 2

  return out;
}

// ============================================================================
// Build Test Cases overview list from all TCs
// ============================================================================

function buildFunctionList(f1Groups, f2Groups) {
  const list = [];
  let no = 1;

  for (const grp of [...f1Groups, ...f2Groups]) {
    list.push({
      no,
      funcName: grp.label,
      sheetName: no <= f1Groups.length ? 'Feature 1' : 'Feature 2',
      description: `${grp.tcs.length} test cases for ${grp.label} module`,
      preCondition: 'User is authenticated with appropriate role'
    });
    no++;
  }
  return list;
}

// ============================================================================
// Test case data (extracted from generate-test-cases.cjs)
// ============================================================================

function getTestCaseGroups() {
  // Feature 1 groups (237 TCs)
  const f1Groups = [
    {
      label: 'Auth',
      tcs: [
        { title: 'Login - valid email and password', preconditions: 'User is on /login; backend login endpoint is up', steps: '1. Navigate to /login\n2. Enter email "test@example.com"\n3. Enter password "Password123"\n4. Click "Sign in"', data: 'email: test@example.com, password: Password123', expected: 'User is authenticated and redirected to /forum (or /admin if role is admin)' },
        { title: 'Login - empty email', preconditions: 'User is on /login', steps: '1. Leave email blank\n2. Enter password\n3. Click "Sign in"', data: 'email: ""', expected: 'Form shows error: "Username is required"' },
        { title: 'Login - empty password', preconditions: 'User is on /login', steps: '1. Enter email\n2. Leave password blank\n3. Click "Sign in"', data: 'password: ""', expected: 'Form shows error: "Password is required"' },
        { title: 'Login - both fields empty', preconditions: 'User is on /login', steps: '1. Leave email and password blank\n2. Click "Sign in"', data: 'email: "", password: ""', expected: 'Both field errors are displayed; submit blocked' },
        { title: 'Login - username minimum length boundary (2 chars)', preconditions: 'User is on /login', steps: '1. Enter "ab" in email\n2. Click "Sign in"', data: 'email: "ab" (2 chars)', expected: 'Error: "Username must be at least 3 characters"' },
        { title: 'Login - username minimum length boundary (3 chars)', preconditions: 'User is on /login', steps: '1. Enter "abc" in email\n2. Enter password\n3. Click "Sign in"', data: 'email: "abc" (3 chars)', expected: 'Username validation passes (password check proceeds)' },
        { title: 'Login - username maximum length boundary (50 chars)', preconditions: 'User is on /login', steps: '1. Enter 50-char email\n2. Click "Sign in"', data: 'email: "a" * 50', expected: 'Username validation passes' },
        { title: 'Login - username maximum length boundary (51 chars)', preconditions: 'User is on /login', steps: '1. Enter 51-char email\n2. Click "Sign in"', data: 'email: "a" * 51', expected: 'Error: "Username must be at most 50 characters"' },
        { title: 'Login - password minimum length boundary (5 chars)', preconditions: 'User is on /login', steps: '1. Enter email\n2. Enter "abcde" (5 chars)\n3. Click "Sign in"', data: 'password: "abcde"', expected: 'Error: "Password must be at least 6 characters"' },
        { title: 'Login - password minimum length boundary (6 chars)', preconditions: 'User is on /login', steps: '1. Enter email\n2. Enter 6 chars\n3. Click "Sign in"', data: 'password: "abc123"', expected: 'Password validation passes' },
        { title: 'Login - invalid email format', preconditions: 'User is on /login', steps: '1. Enter "notanemail"\n2. Enter password\n3. Click "Sign in"', data: 'email: "notanemail"', expected: 'Submitted to BE; if BE rejects, error toast appears' },
        { title: 'Login - wrong password', preconditions: 'User is on /login; valid email exists in DB', steps: '1. Enter valid email\n2. Enter wrong password\n3. Click "Sign in"', data: 'email: test@example.com, password: WrongPass', expected: 'BE returns 401; error message shown' },
        { title: 'Login - remember me ON', preconditions: 'User is on /login', steps: '1. Enter credentials\n2. Check "Remember me"\n3. Click "Sign in"', data: 'rememberMe: true', expected: 'Auth data is stored in localStorage and persists after browser restart' },
        { title: 'Login - remember me OFF', preconditions: 'User is on /login', steps: '1. Enter credentials\n2. Uncheck "Remember me"\n3. Click "Sign in"', data: 'rememberMe: false', expected: 'Auth data is stored in sessionStorage and is cleared on tab close' },
        { title: 'Login - show/hide password toggle', preconditions: 'User is on /login', steps: '1. Click eye icon next to password field', data: 'no input data', expected: 'Password type toggles between password and text' },
        { title: 'Login - disabled state during loading', preconditions: 'User is on /login', steps: '1. Click "Sign in"', data: 'valid credentials', expected: 'Inputs and button are disabled while the request is in flight' },
        { title: 'Login - Google SSO stub', preconditions: 'User is on /login', steps: '1. Click "Continue with Google"', data: 'no input data', expected: 'Console logs stub message; no navigation' },
        { title: 'Login - SQL injection in email', preconditions: 'User is on /login', steps: '1. Enter SQL injection payload\n2. Click "Sign in"', data: 'email: "admin\' OR 1=1--"', expected: 'Yip schema passes; BE returns 401 or generic error' },
        { title: 'Login - XSS in email field', preconditions: 'User is on /login', steps: '1. Enter XSS payload\n2. Click "Sign in"', data: 'email: "<script>alert(1)</script>"', expected: 'Output is sanitized; no script execution' },
        { title: 'Login - admin role redirect', preconditions: 'User is on /login; backend confirms admin role', steps: '1. Login with admin credentials', data: 'admin credentials', expected: 'User redirected to /admin (not /forum)' },
        { title: 'Register - valid input', preconditions: 'User is on /register', steps: '1. Fill all required fields with valid data\n2. Upload PDF verification\n3. Click "Submit"', data: 'fullName: "John Doe", email: "john@example.com", phone: "+1234567890", password: "Pass1234", role: "Researcher"', expected: 'Account created; redirected to login or success modal' },
        { title: 'Register - fullName minimum length (1 char)', preconditions: 'User is on /register', steps: '1. Enter "A" in fullName\n2. Submit', data: 'fullName: "A"', expected: 'Error: "Full name must be at least 2 characters"' },
        { title: 'Register - fullName minimum length (2 chars)', preconditions: 'User is on /register', steps: '1. Enter "Ab" in fullName\n2. Submit', data: 'fullName: "Ab"', expected: 'fullName validation passes' },
        { title: 'Register - fullName maximum length (100 chars)', preconditions: 'User is on /register', steps: '1. Enter 100-char fullName\n2. Submit', data: 'fullName: "a" * 100', expected: 'Full name validation passes' },
        { title: 'Register - fullName maximum length (101 chars)', preconditions: 'User is on /register', steps: '1. Enter 101-char fullName\n2. Submit', data: 'fullName: "a" * 101', expected: 'Error: "Full name must be at most 100 characters"' },
        { title: 'Register - invalid email format', preconditions: 'User is on /register', steps: '1. Enter "notanemail"\n2. Submit', data: 'email: "notanemail"', expected: 'Error: "Invalid email format"' },
        { title: 'Register - email empty', preconditions: 'User is on /register', steps: '1. Leave email blank\n2. Submit', data: 'email: ""', expected: 'Error: "Email is required"' },
        { title: 'Register - phone minimum length (7 chars)', preconditions: 'User is on /register', steps: '1. Enter "1234567" (7 chars)\n2. Submit', data: 'phone: "1234567"', expected: 'Error: "Invalid phone number format"' },
        { title: 'Register - phone minimum length (8 chars)', preconditions: 'User is on /register', steps: '1. Enter "12345678" (8 chars)\n2. Submit', data: 'phone: "12345678"', expected: 'Phone validation passes' },
        { title: 'Register - phone maximum length (20 chars)', preconditions: 'User is on /register', steps: '1. Enter 20-char phone\n2. Submit', data: 'phone: "12345678901234567890"', expected: 'Phone validation passes' },
        { title: 'Register - phone maximum length (21 chars)', preconditions: 'User is on /register', steps: '1. Enter 21-char phone\n2. Submit', data: 'phone: "123456789012345678901"', expected: 'Error: "Invalid phone number format"' },
        { title: 'Register - phone with + sign', preconditions: 'User is on /register', steps: '1. Enter "+1234567890"\n2. Submit', data: 'phone: "+1234567890"', expected: 'Phone validation passes' },
        { title: 'Register - phone with parentheses', preconditions: 'User is on /register', steps: '1. Enter "(123) 456-7890"\n2. Submit', data: 'phone: "(123) 456-7890"', expected: 'Phone validation passes' },
        { title: 'Register - phone with letters (invalid)', preconditions: 'User is on /register', steps: '1. Enter "abc1234567"\n2. Submit', data: 'phone: "abc1234567"', expected: 'Error: "Invalid phone number format"' },
        { title: 'Register - password minimum length (7 chars)', preconditions: 'User is on /register', steps: '1. Enter "Pass123" (7 chars)\n2. Submit', data: 'password: "Pass123"', expected: 'Error: "Password must be at least 8 characters"' },
        { title: 'Register - password minimum length (8 chars)', preconditions: 'User is on /register', steps: '1. Enter "Pass1234" (8 chars)\n2. Submit', data: 'password: "Pass1234"', expected: 'Password length validation passes' },
        { title: 'Register - password without uppercase', preconditions: 'User is on /register', steps: '1. Enter "password1"\n2. Submit', data: 'password: "password1"', expected: 'Error: "Password must contain at least one uppercase letter"' },
        { title: 'Register - password without number', preconditions: 'User is on /register', steps: '1. Enter "Password"\n2. Submit', data: 'password: "Password"', expected: 'Error: "Password must contain at least one number"' },
        { title: 'Register - password valid (uppercase + number + 8+ chars)', preconditions: 'User is on /register', steps: '1. Enter "Password1" (10 chars)\n2. Submit', data: 'password: "Password1"', expected: 'Password validation passes' },
        { title: 'Register - retypePassword mismatch', preconditions: 'User is on /register', steps: '1. Enter password "Password1"\n2. Enter retypePassword "Password2"\n3. Submit', data: 'retypePassword: "Password2"', expected: 'Error: "Passwords must match"' },
        { title: 'Register - retypePassword match', preconditions: 'User is on /register', steps: '1. Enter password "Password1"\n2. Enter retypePassword "Password1"\n3. Submit', data: 'retypePassword: "Password1"', expected: 'Retype validation passes' },
        { title: 'Register - role not selected', preconditions: 'User is on /register', steps: '1. Leave role dropdown empty\n2. Submit', data: 'role: ""', expected: 'Error: "Role is required"' },
        { title: 'Register - role invalid value', preconditions: 'User is on /register', steps: '1. Manually select invalid role\n2. Submit', data: 'role: "InvalidRole"', expected: 'Error: "Invalid role"' },
        { title: 'Register - PDF verification missing', preconditions: 'User is on /register', steps: '1. Fill all fields\n2. Skip PDF upload\n3. Submit', data: 'pdfUrl: ""', expected: 'Error: "Verification document is required"' },
        { title: 'Register - ORCID valid format', preconditions: 'User is on /register', steps: '1. Enter valid ORCID\n2. Submit', data: 'orcidId: "0000-0002-1825-0097"', expected: 'ORCID validation passes' },
        { title: 'Register - ORCID invalid format (missing X digit)', preconditions: 'User is on /register', steps: '1. Enter "0000-0002-1825-0099"\n2. Submit', data: 'orcidId: "0000-0002-1825-0099"', expected: 'Error: "Invalid ORCID ID format"' },
        { title: 'Register - ORCID with X as last digit', preconditions: 'User is on /register', steps: '1. Enter "0000-0002-1825-009X"\n2. Submit', data: 'orcidId: "0000-0002-1825-009X"', expected: 'ORCID validation passes' },
        { title: 'Register - duplicate email', preconditions: 'User is on /register; email already exists in DB', steps: '1. Fill form with existing email\n2. Submit', data: 'email: "duplicate@example.com"', expected: 'BE returns 400/409; error toast appears' },
        { title: 'Register - role dropdown options', preconditions: 'User is on /register', steps: '1. Click role dropdown', data: 'no input data', expected: 'Shows: Researcher, Reviewer, Lecturer, Graduate Student' },
        { title: 'Forgot Password - valid email', preconditions: 'User is on /forgot-password; mock service running', steps: '1. Enter "user@example.com"\n2. Click "Send Code"', data: 'email: "user@example.com"', expected: 'OTP screen is shown with the email in state' },
        { title: 'Forgot Password - invalid email', preconditions: 'User is on /forgot-password', steps: '1. Enter "notanemail"\n2. Click "Send Code"', data: 'email: "notanemail"', expected: 'Error: "Invalid email format"' },
        { title: 'Forgot Password - empty email', preconditions: 'User is on /forgot-password', steps: '1. Click "Send Code" without entering email', data: 'email: ""', expected: 'Error: "Email is required"' },
        { title: 'Forgot Password - mock API delay', preconditions: 'User is on /forgot-password', steps: '1. Submit valid email', data: 'email: "user@example.com"', expected: 'Loading state shown for ~800ms then navigation' },
        { title: 'Verify OTP - enter 6 valid digits', preconditions: 'User is on /forgot-password/verify with email in state', steps: '1. Enter 6 digits one by one', data: 'otp: "123456"', expected: 'Auto-submits; navigates to /reset-password with resetToken' },
        { title: 'Verify OTP - non-digit chars stripped', preconditions: 'User is on /forgot-password/verify', steps: '1. Try to type "abc123"', data: 'otp: "abc123"', expected: 'Non-digit chars stripped; only "123" remains' },
        { title: 'Verify OTP - paste 6-digit code', preconditions: 'User is on /forgot-password/verify', steps: '1. Paste "123456" into first box', data: 'otp: "123456"', expected: 'Paste fills all 6 boxes' },
        { title: 'Verify OTP - backspace navigation', preconditions: 'User is on /reset-password/verify', steps: '1. Enter 3 digits\n2. Press backspace from box 3', data: 'otp: "12|"', expected: 'Caret moves to box 2 and clears it' },
        { title: 'Verify OTP - arrow key navigation', preconditions: 'User is on /forgot-password/verify', steps: '1. Press arrow keys in input boxes', data: 'no input data', expected: 'Caret moves between boxes' },
        { title: 'Verify OTP - less than 6 digits', preconditions: 'User is on /forgot-password/verify', steps: '1. Enter only 5 digits', data: 'otp: "12345"', expected: 'Submit button is disabled or error shown' },
        { title: 'Verify OTP - 6-digit boundary valid (000000)', preconditions: 'User is on /forgot-password/verify', steps: '1. Enter "000000"', data: 'otp: "000000"', expected: 'OTP validation passes (regex /^\\d{6}$/)' },
        { title: 'Verify OTP - 7 digits blocked', preconditions: 'User is on /forgot-password/verify', steps: '1. Try to enter 7 digits', data: 'otp: "1234567"', expected: '7th digit is rejected' },
        { title: 'Verify OTP - no email in state redirect', preconditions: 'User navigates directly to /forgot-password/verify', steps: '1. Load page without email in state', data: 'no input data', expected: 'Redirects back to /forgot-password' },
        { title: 'Verify OTP - resend cooldown 60s', preconditions: 'User is on /forgot-password/verify', steps: '1. Click "Resend code"', data: 'no input data', expected: 'Button disabled for 60 seconds with countdown' },
        { title: 'Verify OTP - resend after cooldown', preconditions: 'User is on /forgot-password/verify; 60s elapsed', steps: '1. Click "Resend code"', data: 'no input data', expected: 'New OTP request is sent' },
        { title: 'Verify OTP - wrong OTP code', preconditions: 'User is on /forgot-password/verify', steps: '1. Enter "000000" (wrong code)', data: 'otp: "000000"', expected: 'Error message displayed; remains on page' },
        { title: 'Reset Password - valid new password', preconditions: 'User is on /reset-password with resetToken in state', steps: '1. Enter new password "Pass1234"\n2. Enter confirm password "Pass1234"\n3. Click "Reset"', data: 'newPassword: "Pass1234", confirmPassword: "Pass1234"', expected: 'Password reset; navigated to /login' },
        { title: 'Reset Password - no resetToken redirect', preconditions: 'User navigates directly to /reset-password', steps: '1. Load page without resetToken', data: 'no input data', expected: 'Redirects to /login' },
        { title: 'Reset Password - new password without uppercase', preconditions: 'User is on /reset-password', steps: '1. Enter "pass1234"\n2. Submit', data: 'newPassword: "pass1234"', expected: 'Error: "Password must contain at least one uppercase letter"' },
        { title: 'Reset Password - new password without number', preconditions: 'User is on /reset-password', steps: '1. Enter "Password"\n2. Submit', data: 'newPassword: "Password"', expected: 'Error: "Password must contain at least one number"' },
        { title: 'Reset Password - new password 7 chars', preconditions: 'User is on /reset-password', steps: '1. Enter "Pass123" (7 chars)\n2. Submit', data: 'newPassword: "Pass123"', expected: 'Error: "Password must be at least 8 characters"' },
        { title: 'Reset Password - new password 8 chars', preconditions: 'User is on /reset-password', steps: '1. Enter "Pass1234" (8 chars)\n2. Submit', data: 'newPassword: "Pass1234"', expected: 'Password length validation passes' },
        { title: 'Reset Password - confirm mismatch', preconditions: 'User is on /reset-password', steps: '1. Enter new "Pass1234"\n2. Enter confirm "Pass5678"\n3. Submit', data: 'confirmPassword: "Pass5678"', expected: 'Error: "Passwords must match"' },
        { title: 'Reset Password - confirm match', preconditions: 'User is on /reset-password', steps: '1. Enter new "Pass1234"\n2. Enter confirm "Pass1234"\n3. Submit', data: 'confirmPassword: "Pass1234"', expected: 'Confirm validation passes' },
        { title: 'Reset Password - show/hide new password toggle', preconditions: 'User is on /reset-password', steps: '1. Click eye icon', data: 'no input data', expected: 'Password field type toggles' },
      ]
    },
    {
      label: 'Papers',
      tcs: [
        { title: 'Papers - list all papers', preconditions: 'User is on /papers; authenticated', steps: '1. Navigate to /papers', data: 'no input data', expected: 'All papers are loaded and displayed' },
        { title: 'Papers - filter by status=Waiting', preconditions: 'User is on /papers', steps: '1. Click "Waiting" tab', data: 'no input data', expected: 'Only papers with status "Waiting" are shown' },
        { title: 'Papers - filter by status=Accepted', preconditions: 'User is on /papers', steps: '1. Click "Accepted" tab', data: 'no input data', expected: 'Only accepted papers are shown' },
        { title: 'Papers - filter by status=Rejected', preconditions: 'User is on /papers', steps: '1. Click "Rejected" tab', data: 'no input data', expected: 'Only rejected papers are shown' },
        { title: 'Papers - filter by status=Draft', preconditions: 'User is on /papers', steps: '1. Click "Draft" tab', data: 'no input data', expected: 'Only draft papers are shown' },
        { title: 'Papers - empty list', preconditions: 'User is on /papers; no papers exist', steps: '1. Load page', data: 'no input data', expected: 'Empty state message is displayed' },
        { title: 'Papers - upload PDF file', preconditions: 'User is on /papers; clicking "Upload Paper"', steps: '1. Click "Upload Paper"\n2. Select valid PDF (<10MB)', data: 'file: "paper.pdf" (<10MB)', expected: 'File accepted; preview shown' },
        { title: 'Papers - upload non-PDF file', preconditions: 'User is on /papers', steps: '1. Click "Upload Paper"\n2. Select "image.jpg"', data: 'file: "image.jpg"', expected: 'Error: file type not allowed' },
        { title: 'Papers - upload 10MB PDF boundary', preconditions: 'User is on /papers', steps: '1. Upload PDF exactly 10MB', data: 'file: "paper.pdf" (10MB)', expected: 'File accepted' },
        { title: 'Papers - upload 10MB + 1 byte PDF', preconditions: 'User is on /papers', steps: '1. Upload PDF > 10MB', data: 'file: "paper.pdf" (10MB + 1byte)', expected: 'Error: file size exceeds 10MB limit' },
        { title: 'Papers - create paper - missing title', preconditions: 'User is on /papers; uploaded file', steps: '1. Leave title blank\n2. Click "Confirm & Submit"', data: 'title: ""', expected: 'Error: "Title is required"' },
        { title: 'Papers - create paper - missing abstract', preconditions: 'User is on /papers', steps: '1. Enter title\n2. Leave abstract blank\n3. Submit', data: 'abstract: ""', expected: 'Error: "Abstract is required"' },
        { title: 'Papers - create paper - no fields selected', preconditions: 'User is on /papers', steps: '1. Fill title and abstract\n2. Do not select fields\n3. Submit', data: 'selectedFields: []', expected: 'Error: "At least one field must be selected"' },
        { title: 'Papers - abstract word limit 500', preconditions: 'User is on /papers', steps: '1. Enter exactly 500 words in abstract', data: 'abstract: 500 words', expected: 'Abstract accepted' },
        { title: 'Papers - abstract word limit 501', preconditions: 'User is on /papers', steps: '1. Enter 501 words in abstract', data: 'abstract: 501 words', expected: 'Error: "Abstract exceeds 500 words"' },
        { title: 'Papers - create paper - valid data', preconditions: 'User is on /papers', steps: '1. Fill title, abstract, select fields\n2. Submit', data: 'title: "Quantum Research", abstract: "valid", fields: ["Physics"]', expected: 'Paper created; success toast; listed in "Waiting"' },
        { title: 'Papers - edit paper', preconditions: 'User is on /papers; created paper', steps: '1. Click "Edit" on a paper\n2. Modify title\n3. Click "Save"', data: 'title: "Updated Title"', expected: 'Paper updated; reflected in list' },
        { title: 'Papers - delete paper with confirmation', preconditions: 'User is on /papers; created paper', steps: '1. Click "Delete" on paper\n2. Confirm in dialog', data: 'paperId: 123', expected: 'Paper removed; success toast' },
        { title: 'Papers - delete paper cancel', preconditions: 'User is on /papers', steps: '1. Click "Delete" on paper\n2. Cancel in dialog', data: 'no input data', expected: 'Paper remains; no change' },
        { title: 'Papers - upload preview phase', preconditions: 'User is on /papers', steps: '1. Upload PDF\n2. View preview', data: 'file: "paper.pdf"', expected: 'Preview frame shows PDF content' },
        { title: 'Papers - preview to confirm to delete flow', preconditions: 'User is on /papers', steps: '1. Upload PDF\n2. Click "Confirm"\n3. Click "Delete"', data: 'no input data', expected: 'All phases work; file removed' },
        { title: 'Papers - Firebase upload path', preconditions: 'User is on /papers', steps: '1. Upload PDF', data: 'file: "paper.pdf"', expected: 'File uploaded to Firebase at "papers/{timestamp}_{filename}"' },
        { title: 'Papers - auto-dismiss toast', preconditions: 'User is on /papers', steps: '1. Trigger any success action', data: 'no input data', expected: 'Toast disappears after 2 seconds' },
        { title: 'Papers - 401 response from BE', preconditions: 'User is on /papers; token expired', steps: '1. Load page', data: 'expired token', expected: 'Redirects to /login (axios interceptor)' },
        { title: 'Papers - pagination', preconditions: 'User is on /papers; many papers', steps: '1. Click next page', data: 'pageNumber: 2', expected: 'Second page of papers loaded' },
        { title: 'Papers - search by title', preconditions: 'User is on /papers', steps: '1. Enter search query', data: 'query: "Quantum"', expected: 'Filtered papers matching title' },
        { title: 'Papers - error loading papers', preconditions: 'User is on /papers; BE down', steps: '1. Load page', data: 'no input data', expected: 'Error toast shown; retry option' },
        { title: 'Papers - loading state', preconditions: 'User is on /papers; BE slow', steps: '1. Load page', data: 'no input data', expected: 'Loading spinner shown' },
        { title: 'Papers - upload progress', preconditions: 'User is on /papers', steps: '1. Upload large PDF', data: 'file: "paper.pdf" (5MB)', expected: 'Progress bar updates during upload' },
      ]
    },
    {
      label: 'Researcher',
      tcs: [
        { title: 'Discover Reviewers - load list', preconditions: 'User is on /reviewers', steps: '1. Navigate to /reviewers', data: 'no input data', expected: 'List of reviewers loaded from /api/ProfessionalProfile' },
        { title: 'Discover Reviewers - empty list', preconditions: 'User is on /reviewers; no reviewers', steps: '1. Load page', data: 'no input data', expected: 'Empty state shown' },
        { title: 'Discover Reviewers - switch to Requests tab', preconditions: 'User is on /reviewers', steps: '1. Click "Requests" tab', data: 'no input data', expected: 'My review requests are shown' },
        { title: 'Discover Reviewers - send request to reviewer', preconditions: 'User is on /reviewers; sufficient wallet', steps: '1. Select paper\n2. Select reviewer\n3. Accept policy\n4. Click "Send Request"', data: 'paperId: 1, reviewerId: 2, fee: 250000', expected: 'Request created; wallet deducted; success toast' },
        { title: 'Discover Reviewers - no paper selected', preconditions: 'User is on /reviewers', steps: '1. Click "Send Request" without selecting paper', data: 'selectedPaperId: null', expected: 'Error: "Please select a paper"' },
        { title: 'Discover Reviewers - insufficient wallet', preconditions: 'User is on /reviewers; wallet=0', steps: '1. Select paper and reviewer\n2. Click "Send Request"', data: 'walletBalance: 0, fee: 250000', expected: 'Disabled button; "Add Fund to Wallet" CTA shown' },
        { title: 'Discover Reviewers - wallet exactly matches fee', preconditions: 'User is on /reviewers; wallet=250000', steps: '1. Send request with fee=250000', data: 'walletBalance: 250000, fee: 250000', expected: 'Request succeeds; wallet becomes 0' },
        { title: 'Discover Reviewers - policy not accepted', preconditions: 'User is on /reviewers', steps: '1. Select paper and reviewer\n2. Do not check policy\n3. Click "Send Request"', data: 'acceptedPolicy: false', expected: 'Send button disabled; tooltip shown' },
        { title: 'Discover Reviewers - fee calculation', preconditions: 'User is on /reviewers', steps: '1. View reviewer card', data: 'reviewerFee: 225000', expected: 'Shown: total fee = 225000 + 25000 = 250000' },
        { title: 'Discover Reviewers - notes maxLength 500', preconditions: 'User is on /reviewers', steps: '1. Enter 500 chars in notes', data: 'notes: "a" * 500', expected: 'Notes accepted' },
        { title: 'Discover Reviewers - notes maxLength 501', preconditions: 'User is on /reviewers', steps: '1. Enter 501 chars in notes', data: 'notes: "a" * 501', expected: 'Character limit enforced; input blocked' },
        { title: 'Discover Reviewers - refresh button', preconditions: 'User is on /reviewers', steps: '1. Click "Refresh"', data: 'no input data', expected: 'List reloaded from API' },
        { title: 'Discover Reviewers - duplicate request', preconditions: 'User is on /reviewers; already has request', steps: '1. Send same request again', data: 'paperId: 1, reviewerId: 2', expected: 'BE returns 400; error toast shown' },
        { title: 'Discover Reviewers - shortfall display', preconditions: 'User is on /reviewers; wallet=100000', steps: '1. View "Add Fund" button', data: 'walletBalance: 100000, fee: 250000', expected: 'Shortfall displayed: "You need 150,000 more"' },
        { title: 'Discover Reviewers - TopUpModal opens', preconditions: 'User is on /reviewers; insufficient wallet', steps: '1. Click "Add Fund to Wallet"', data: 'no input data', expected: 'TopUpModal opens with isOpen=true' },
        { title: 'Discover Reviewers - onSuccess callback', preconditions: 'User is on /reviewers; TopUpModal open', steps: '1. Call onSuccess(500000)', data: 'amount: 500000', expected: 'Modal closes; wallet updated to 500000' },
        { title: 'Discover Reviewers - 3 seeded reviewers', preconditions: 'User is on /reviewers', steps: '1. Load page', data: 'no input data', expected: '3 reviewers shown (Dr. Nguyen, Dr. Tran, Dr. Le)' },
        { title: 'Discover Reviewers - filter by ORCID', preconditions: 'User is on /reviewers', steps: '1. Sort/filter by ORCID presence', data: 'no input data', expected: 'Reviewers with ORCID shown first' },
        { title: 'Discover Reviewers - request pending state', preconditions: 'User is on /reviewers; requests tab', steps: '1. View request list', data: 'status: "Pending"', expected: 'Badge "Pending" displayed' },
        { title: 'Discover Reviewers - request accepted', preconditions: 'User is on /reviewers; requests tab', steps: '1. View request', data: 'status: "Accepted"', expected: 'Badge "Accepted" displayed' },
        { title: 'Discover Reviewers - network error', preconditions: 'User is on /reviewers; BE down', steps: '1. Load page', data: 'no input data', expected: 'Error toast shown' },
        { title: 'Discover Reviewers - request after deletion', preconditions: 'User is on /reviewers; previous request was deleted', steps: '1. Send same request again', data: 'no input data', expected: 'Request succeeds' },
        { title: 'Discover Reviewers - wallet audit in localStorage', preconditions: 'User is on /reviewers', steps: '1. Send request', data: 'walletBalance: 500000, fee: 250000', expected: 'ars_wallet in localStorage updated to 250000' },
        { title: 'Discover Reviewers - custom fee input', preconditions: 'User is on /reviewers', steps: '1. Enter custom fee', data: 'fee: 300000', expected: 'Custom fee used instead of calculated' },
        { title: 'Discover Reviewers - deadline selection', preconditions: 'User is on /reviewers', steps: '1. Select deadline date', data: 'deadline: "2026-12-31"', expected: 'Deadline saved with request' },
        { title: 'Discover Reviewers - empty notes', preconditions: 'User is on /reviewers', steps: '1. Leave notes blank\n2. Submit', data: 'notes: ""', expected: 'Request succeeds (notes optional)' },
      ]
    },
    {
      label: 'Reviewer',
      tcs: [
        { title: 'Assigned Reviews - load pending tasks', preconditions: 'User is on /review-tasks', steps: '1. Click "Pending" tab', data: 'no input data', expected: 'Pending review requests shown' },
        { title: 'Assigned Reviews - load in-progress tasks', preconditions: 'User is on /review-tasks', steps: '1. Click "In Progress" tab', data: 'no input data', expected: 'In-progress tasks shown' },
        { title: 'Assigned Reviews - load completed tasks', preconditions: 'User is on /review-tasks', steps: '1. Click "Completed" tab', data: 'no input data', expected: 'Completed tasks shown' },
        { title: 'Assigned Reviews - filter by current user', preconditions: 'User is on /review-tasks', steps: '1. Load page', data: 'currentUserId: 5', expected: 'Only tasks where reviewerId=5 are shown' },
        { title: 'Assigned Reviews - deadline warning (1 day)', preconditions: 'User is on /review-tasks; task with deadline tomorrow', steps: '1. View task list', data: 'deadline: tomorrow', expected: 'Deadline displayed in orange tone' },
        { title: 'Assigned Reviews - deadline no deadline', preconditions: 'User is on /review-tasks; task without deadline', steps: '1. View task list', data: 'deadline: null', expected: 'Display: "No deadline set"' },
        { title: 'Assigned Reviews - status normalization', preconditions: 'User is on /review-tasks', steps: '1. Load page', data: 'status: "in-progress" or "in progress" or "inprogress"', expected: 'All variants map to "inprogress" tab' },
        { title: 'Assigned Reviews - status "completed" variants', preconditions: 'User is on /review-tasks', steps: '1. Load page', data: 'status: "completed" or "complete" or "done"', expected: 'All variants map to "completed" tab' },
        { title: 'Evaluation - pre-fill from existing', preconditions: 'User is on /evaluation; existing draft', steps: '1. Load page', data: 'existing evaluation: { originality: 4, ... }', expected: 'Form pre-filled with existing values' },
        { title: 'Evaluation - score 1-5 for each criterion', preconditions: 'User is on /evaluation', steps: '1. Enter scores 1-5 for all 5 criteria\n2. Add notes\n3. Submit', data: 'originality: 4, literature: 5, methodology: 3, results: 4, formatting: 5', expected: 'Evaluation saved; status updated to Completed' },
        { title: 'Evaluation - score 0 invalid', preconditions: 'User is on /evaluation', steps: '1. Enter score 0', data: 'originality: 0', expected: 'Error: "Score must be between 1 and 5"' },
        { title: 'Evaluation - score 6 invalid', preconditions: 'User is on /evaluation', steps: '1. Enter score 6', data: 'originality: 6', expected: 'Error: "Score must be between 1 and 5"' },
        { title: 'Evaluation - final decision Accept', preconditions: 'User is on /evaluation', steps: '1. Select "Accept"\n2. Submit', data: 'finalDecision: "Accept"', expected: 'ReviewRequest status updated to "Completed"' },
        { title: 'Evaluation - final decision Minor Revision', preconditions: 'User is on /evaluation', steps: '1. Select "Minor Revision"\n2. Submit', data: 'finalDecision: "Minor Revision"', expected: 'Decision saved' },
        { title: 'Evaluation - final decision Major Revision', preconditions: 'User is on /evaluation', steps: '1. Select "Major Revision"\n2. Submit', data: 'finalDecision: "Major Revision"', expected: 'Decision saved' },
        { title: 'Evaluation - final decision Reject', preconditions: 'User is on /evaluation', steps: '1. Select "Reject"\n2. Submit', data: 'finalDecision: "Reject"', expected: 'Decision saved' },
        { title: 'Evaluation - missing general comments', preconditions: 'User is on /evaluation', steps: '1. Leave generalComments blank\n2. Submit', data: 'generalComments: ""', expected: 'Error: "General comments required"' },
        { title: 'Evaluation - save draft', preconditions: 'User is on /evaluation', steps: '1. Fill partial form\n2. Click "Save Draft"', data: 'partial data', expected: 'Draft saved; can resume later' },
        { title: 'Evaluation - submit final feedback', preconditions: 'User is on /evaluation', steps: '1. Fill complete form\n2. Click "Submit Final Feedback"', data: 'complete evaluation', expected: 'Evaluation submitted; cannot edit' },
        { title: 'Evaluation - no paper data', preconditions: 'User is on /evaluation; paperId missing', steps: '1. Load page', data: 'paperId: null', expected: 'Error state shown' },
        { title: 'Evaluation - API error on submit', preconditions: 'User is on /evaluation; BE down', steps: '1. Submit form', data: 'no input data', expected: 'Error toast; form remains editable' },
        { title: 'Evaluation - PDF viewer renders', preconditions: 'User is on /evaluation', steps: '1. Load page', data: 'pdfUrl: "https://firebasestorage.googleapis.com/..."', expected: 'PDF viewer displays paper' },
        { title: 'Evaluation - PDF viewer scale min 0.5', preconditions: 'User is on /evaluation', steps: '1. Zoom out repeatedly', data: 'no input data', expected: 'Scale clamped at 0.5' },
        { title: 'Evaluation - PDF viewer scale max 3.0', preconditions: 'User is on /evaluation', steps: '1. Zoom in repeatedly', data: 'no input data', expected: 'Scale clamped at 3.0' },
        { title: 'Evaluation - PDF viewer navigation', preconditions: 'User is on /evaluation', steps: '1. Press arrow keys', data: 'no input data', expected: 'Page changes left/right' },
        { title: 'Evaluation - PDF viewer invalid page', preconditions: 'User is on /evaluation', steps: '1. Type 999 in page input', data: 'page: 999', expected: 'Page clamped to totalPages' },
        { title: 'Evaluation - PDF viewer negative page', preconditions: 'User is on /evaluation', steps: '1. Type -1 in page input', data: 'page: -1', expected: 'Page clamped to 1' },
        { title: 'Evaluation - PDF viewer Firebase URL detection', preconditions: 'User is on /evaluation', steps: '1. Load with Firebase URL', data: 'url: "https://firebasestorage.googleapis.com/..."', expected: 'PDF loads correctly' },
        { title: 'Evaluation - scorecard modal opens', preconditions: 'User is on /evaluation', steps: '1. Click "Scorecard" button', data: 'no input data', expected: 'ScorecardModal opens with rubric' },
        { title: 'Evaluation - update existing evaluation', preconditions: 'User is on /evaluation; existing draft', steps: '1. Modify scores\n2. Click "Update"', data: 'modified scores', expected: 'Existing evaluation updated' },
        { title: 'Wallet - load default balance', preconditions: 'User is on /earnings-wallet; no data', steps: '1. Load page', data: 'no input data', expected: 'Balance: 4,200,000 VND; Pending: 500,000' },
        { title: 'Wallet - load saved balance', preconditions: 'User is on /earnings-wallet; ars_reviewer_balance set', steps: '1. Load page', data: 'ars_reviewer_balance: 5000000', expected: 'Balance shows 5,000,000 VND' },
        { title: 'Wallet - open withdraw modal', preconditions: 'User is on /earnings-wallet', steps: '1. Click "Withdraw"', data: 'no input data', expected: 'Withdraw modal opens' },
        { title: 'Wallet - withdraw amount zero', preconditions: 'User is on /earnings-wallet', steps: '1. Enter amount 0\n2. Submit', data: 'amount: 0', expected: 'Error: "Amount must be greater than 0"' },
        { title: 'Wallet - withdraw negative amount', preconditions: 'User is on /earnings-wallet', steps: '1. Enter -1000\n2. Submit', data: 'amount: -1000', expected: 'Error: "Invalid amount"' },
        { title: 'Wallet - withdraw amount > balance', preconditions: 'User is on /earnings-wallet', steps: '1. Enter 5000000 (balance=4200000)\n2. Submit', data: 'amount: 5000000', expected: 'Error: "Amount exceeds available balance"' },
        { title: 'Wallet - withdraw amount = balance', preconditions: 'User is on /earnings-wallet', steps: '1. Enter 4200000\n2. Submit', data: 'amount: 4200000, balance: 4200000', expected: 'Withdraw succeeds; balance becomes 0' },
        { title: 'Wallet - withdraw with valid account', preconditions: 'User is on /earnings-wallet', steps: '1. Select bank\n2. Enter account 101299482103\n3. Enter amount 100000\n4. Submit', data: 'accountNumber: "101299482103", amount: 100000', expected: 'Withdraw succeeds; balance updated' },
        { title: 'Wallet - withdraw invalid account', preconditions: 'User is on /earnings-wallet', steps: '1. Enter account "123456789"\n2. Submit', data: 'accountNumber: "123456789"', expected: 'Error: "Account verification failed"' },
        { title: 'Wallet - bank selection', preconditions: 'User is on /earnings-wallet', steps: '1. Open bank dropdown', data: 'no input data', expected: '3 banks listed' },
        { title: 'Wallet - no bank selected', preconditions: 'User is on /earnings-wallet', steps: '1. Do not select bank\n2. Submit', data: 'targetBank: null', expected: 'Error: "Please select a bank"' },
        { title: 'Wallet - empty account number', preconditions: 'User is on /earnings-wallet', steps: '1. Leave account blank\n2. Submit', data: 'accountNumber: ""', expected: 'Error: "Account number required"' },
        { title: 'Wallet - withdrawal reason modal', preconditions: 'User is on /earnings-wallet', steps: '1. Trigger rejection flow', data: 'no input data', expected: 'Rejection reason modal opens' },
        { title: 'Wallet - balance update on submit', preconditions: 'User is on /earnings-wallet', steps: '1. Submit withdrawal', data: 'oldBalance: 4200000, amount: 100000', expected: 'ars_reviewer_balance=4100000, ars_wallet updated, wallet-update event dispatched' },
        { title: 'Wallet - pending holds display', preconditions: 'User is on /earnings-wallet', steps: '1. Load page', data: 'pendingHolds: 500000', expected: 'Pending holds displayed: 500,000 VND' },
        { title: 'Wallet - narrative field', preconditions: 'User is on /earnings-wallet', steps: '1. Enter narrative', data: 'narrative: "Monthly salary"', expected: 'Narrative saved with withdrawal' },
        { title: 'Wallet - amount input type=number', preconditions: 'User is on /earnings-wallet', steps: '1. View amount field', data: 'no input data', expected: 'Input type is "number"; max=unlockedBalance' },
        { title: 'Wallet - insufficient funds messaging', preconditions: 'User is on /earnings-wallet; balance=0', steps: '1. Load page', data: 'balance: 0', expected: 'Message: "No funds available"' },
        { title: 'Wallet - both storages updated', preconditions: 'User is on /earnings-wallet', steps: '1. Withdraw', data: 'amount: 100000', expected: 'Both ars_reviewer_balance and ars_wallet updated; wallet-update event fires' },
        { title: 'Wallet - max attribute equals balance', preconditions: 'User is on /earnings-wallet; balance=4200000', steps: '1. View amount field', data: 'no input data', expected: 'max attribute = 4200000' },
      ]
    },
    {
      label: 'Lecturer',
      tcs: [
        { title: 'Research Group - create group empty name', preconditions: 'User is on /research-group', steps: '1. Click "Create Group"\n2. Leave name blank\n3. Submit', data: 'groupName: ""', expected: 'Error: "Group name required"' },
        { title: 'Research Group - create group valid', preconditions: 'User is on /research-group', steps: '1. Enter name, topic, desc\n2. Submit', data: 'groupName: "AI Research", groupTopic: "ML", groupDesc: "x"', expected: 'Group created; appears in list' },
        { title: 'Research Group - add member email', preconditions: 'User is on /research-group', steps: '1. Enter email\n2. Press Enter', data: 'email: "member@example.com"', expected: 'Email added to groupEmails array' },
        { title: 'Research Group - duplicate email blocked', preconditions: 'User is on /research-group', steps: '1. Add email "x@y.com"\n2. Add same email again', data: 'email: "x@y.com"', expected: 'Duplicate rejected; not added twice' },
        { title: 'Research Group - invalid email', preconditions: 'User is on /research-group', steps: '1. Enter "notanemail"\n2. Press Enter', data: 'email: "notanemail"', expected: 'Error: "Invalid email format"' },
        { title: 'Research Group - remove member', preconditions: 'User is on /research-group', steps: '1. Click X on email', data: 'email: "x@y.com"', expected: 'Email removed from groupEmails' },
        { title: 'Research Group - create topic', preconditions: 'User is on /research-group', steps: '1. Click "Add Topic"\n2. Fill topic form\n3. Submit', data: 'topicName: "ML Research", topicDesc: "x"', expected: 'Topic created and linked to group' },
        { title: 'Research Group - topic empty name', preconditions: 'User is on /research-group', steps: '1. Click "Add Topic"\n2. Leave topicName blank\n3. Submit', data: 'topicName: ""', expected: 'Error: "Topic name required"' },
        { title: 'Research Group - assign topic to groups', preconditions: 'User is on /research-group', steps: '1. Click "Assign" on topic\n2. Check groups\n3. Submit', data: 'groups: [1, 2]', expected: 'Topic assigned to selected groups' },
        { title: 'Research Group - assign with no groups', preconditions: 'User is on /research-group', steps: '1. Click "Assign" on topic\n2. Do not check any group\n3. Submit', data: 'selectedGroups: []', expected: 'Defaults to "Unassigned"' },
        { title: 'Research Group - attach materials', preconditions: 'User is on /research-group', steps: '1. Click "Add Topic"\n2. Add materials\n3. Submit', data: 'attachedMaterials: ["resource.pdf"]', expected: 'Materials attached to topic' },
        { title: 'Configure Milestones - select phase', preconditions: 'User is on /configure-milestones', steps: '1. Click phase dropdown', data: 'no input data', expected: '4 phases shown' },
        { title: 'Configure Milestones - empty description', preconditions: 'User is on /configure-milestones', steps: '1. Leave description blank\n2. Click "Publish"', data: 'description: ""', expected: 'Error: "Description required"' },
        { title: 'Configure Milestones - description 8000 chars', preconditions: 'User is on /configure-milestones', steps: '1. Enter 8000 chars', data: 'description: "a" * 8000', expected: 'Description accepted' },
        { title: 'Configure Milestones - description 8001 chars', preconditions: 'User is on /configure-milestones', steps: '1. Enter 8001 chars', data: 'description: "a" * 8001', expected: 'Character limit enforced' },
        { title: 'Configure Milestones - due date empty', preconditions: 'User is on /configure-milestones', steps: '1. Leave dueDate blank\n2. Publish', data: 'dueDate: ""', expected: 'Error: "Due date required"' },
        { title: 'Configure Milestones - add file', preconditions: 'User is on /configure-milestones', steps: '1. Click "Add File"\n2. Use prompt() input', data: 'fileName: "milestone.pdf"', expected: 'File added to uploadedFiles' },
        { title: 'Configure Milestones - publish valid', preconditions: 'User is on /configure-milestones', steps: '1. Fill all fields\n2. Click "Publish"', data: 'phase: "Phase 1", desc: "x", dueDate: "2026-12-31"', expected: 'Milestone published' },
        { title: 'Seminar Workspace - create seminar', preconditions: 'User is on /seminar-workspace', steps: '1. Click "New Seminar"\n2. Fill form\n3. Submit', data: 'seminarName: "AI Talk", dateTime: "2026-12-01T10:00", details: "x"', expected: 'Seminar created with generated Meet link' },
        { title: 'Seminar Workspace - empty seminar name', preconditions: 'User is on /seminar-workspace', steps: '1. Leave seminarName blank\n2. Submit', data: 'seminarName: ""', expected: 'Error: "Seminar name required"' },
        { title: 'Seminar Workspace - add guest email', preconditions: 'User is on /seminar-workspace', steps: '1. Enter guest email\n2. Press Enter', data: 'guestEmail: "guest@example.com"', expected: 'Email added to guestEmails' },
        { title: 'Seminar Workspace - send reminder', preconditions: 'User is on /seminar-workspace', steps: '1. Check "Send reminder"\n2. Submit', data: 'sendReminder: true', expected: 'Reminder scheduled' },
        { title: 'Seminar Workspace - drafts tab empty', preconditions: 'User is on /seminar-workspace', steps: '1. Click "Drafts" tab', data: 'no input data', expected: 'Empty state shown (hardcoded)' },
        { title: 'Seminar Workspace - AI summarizer step 1', preconditions: 'User is on /seminar-workspace', steps: '1. Click "AI Summarize"\n2. Upload file', data: 'file: "notes.pdf"', expected: 'Step 1 shows upload' },
        { title: 'Seminar Workspace - AI summarizer step 2', preconditions: 'User is on /seminar-workspace', steps: '1. Click "AI Summarize"\n2. Upload then process', data: 'processed file', expected: 'Step 2 shows summary' },
      ]
    },
    {
      label: 'GraduateStudent',
      tcs: [
        { title: 'Student Research Groups - load list', preconditions: 'User is on /student/research-groups', steps: '1. Load page', data: 'no input data', expected: 'Groups list displayed' },
        { title: 'Student Research Groups - search', preconditions: 'User is on /student/research-groups', steps: '1. Enter search text', data: 'searchText: "AI"', expected: 'Filtered groups shown' },
        { title: 'Student Research Groups - filter status', preconditions: 'User is on /student/research-groups', steps: '1. Select status filter', data: 'statusFilter: "Active"', expected: 'Groups filtered by status' },
        { title: 'Student Research Groups - switch to workspace', preconditions: 'User is on /student/research-groups', steps: '1. Click "Open" on group', data: 'groupId: 1', expected: 'viewMode = "workspace"' },
        { title: 'Submit Report - file required', preconditions: 'User is on /submit-report', steps: '1. Click "Submit" without file', data: 'file: null', expected: 'Error: "File required"' },
        { title: 'Submit Report - upload PDF', preconditions: 'User is on /submit-report', steps: '1. Upload PDF', data: 'file: "report.pdf"', expected: 'File accepted' },
        { title: 'Submit Report - upload DOCX', preconditions: 'User is on /submit-report', steps: '1. Upload DOCX', data: 'file: "report.docx"', expected: 'File accepted' },
        { title: 'Submit Report - upload non-PDF/DOCX', preconditions: 'User is on /submit-report', steps: '1. Upload image', data: 'file: "image.jpg"', expected: 'Error: "Unsupported file type"' },
        { title: 'Submit Report - file 25MB boundary', preconditions: 'User is on /submit-report', steps: '1. Upload 25MB file', data: 'file: size=25MB', expected: 'File accepted' },
        { title: 'Submit Report - file 26MB rejected', preconditions: 'User is on /submit-report', steps: '1. Upload 26MB file', data: 'file: size=26MB', expected: 'Error: "File too large"' },
        { title: 'Submit Report - notes field', preconditions: 'User is on /submit-report', steps: '1. Enter notes\n2. Submit', data: 'notes: "See attached"', expected: 'Notes saved with submission' },
        { title: 'Submit Report - successful submit', preconditions: 'User is on /submit-report', steps: '1. Upload file\n2. Add notes\n3. Submit', data: 'complete data', expected: 'Submission successful; status updated' },
        { title: 'Student Research Groups - submit topic', preconditions: 'User is on /student/research-groups', steps: '1. Click "Submit" on topic\n2. Upload file\n3. Add notes', data: 'complete data', expected: 'Topic status changes to "Submitted"' },
        { title: 'Student Research Groups - view lecturer notes', preconditions: 'User is on /student/research-groups', steps: '1. View topic', data: 'lecturerNotes: "x"', expected: 'Notes displayed' },
        { title: 'Student Research Groups - PDF dropzone click only', preconditions: 'User is on /student/research-groups', steps: '1. Click dropzone', data: 'no input data', expected: 'File picker opens (no drag-drop)' },
      ]
    },
  ];

  // Feature 2 groups (102 TCs)
  const f2Groups = [
    {
      label: 'Shared',
      tcs: [
        { title: 'Forum - load All Posts', preconditions: 'User is on /forum', steps: '1. Click "All Posts" tab', data: 'no input data', expected: 'All posts displayed' },
        { title: 'Forum - load My Posts', preconditions: 'User is on /forum', steps: '1. Click "My Posts" tab', data: 'no input data', expected: 'Posts by current user shown' },
        { title: 'Forum - load Following', preconditions: 'User is on /forum', steps: '1. Click "Following" tab', data: 'no input data', expected: 'Posts from followed users shown' },
        { title: 'Forum - sort Newest', preconditions: 'User is on /forum', steps: '1. Select "Newest"', data: 'no input data', expected: 'Posts sorted by createdAt desc' },
        { title: 'Forum - sort Most Discussed', preconditions: 'User is on /forum', steps: '1. Select "Most Discussed"', data: 'no input data', expected: 'Posts sorted by comment count desc' },
        { title: 'Forum - sort Most Viewed', preconditions: 'User is on /forum', steps: '1. Select "Most Viewed"', data: 'no input data', expected: 'Posts sorted by view count desc' },
        { title: 'Forum - create post empty content', preconditions: 'User is on /forum', steps: '1. Click "Create Post"\n2. Click "Submit" with empty content', data: 'postContent: ""', expected: 'Error: "Content is required"' },
        { title: 'Forum - create post with content', preconditions: 'User is on /forum', steps: '1. Enter content\n2. Click "Submit"', data: 'postContent: "My research findings"', expected: 'Post created; appears in list' },
        { title: 'Forum - create post with tags', preconditions: 'User is on /forum', steps: '1. Enter content + tags\n2. Submit', data: 'postContent: "x", postTags: ["ai", "research"]', expected: 'Post created with tags' },
        { title: 'Forum - attach PDF to post', preconditions: 'User is on /forum', steps: '1. Click "Attach PDF"\n2. Select PDF', data: 'file: "doc.pdf"', expected: 'PDF attached to post' },
        { title: 'Forum - attach non-PDF rejected', preconditions: 'User is on /forum', steps: '1. Click "Attach PDF"\n2. Select "image.jpg"', data: 'file: "image.jpg"', expected: 'Error: "Only PDF allowed"' },
        { title: 'Forum - attach image to post', preconditions: 'User is on /forum', steps: '1. Click "Attach Image"\n2. Select image', data: 'file: "photo.png"', expected: 'Image attached' },
        { title: 'Forum - attach non-image rejected', preconditions: 'User is on /forum', steps: '1. Click "Attach Image"\n2. Select PDF', data: 'file: "doc.pdf"', expected: 'Error: "Only images allowed"' },
        { title: 'Forum - follow user', preconditions: 'User is on /forum', steps: '1. Click "Follow" on a post', data: 'userId: 5', expected: 'User followed; button changes to "Unfollow"' },
        { title: 'Forum - unfollow user', preconditions: 'User is on /forum', steps: '1. Click "Unfollow" on a post', data: 'userId: 5', expected: 'User unfollowed' },
        { title: 'Forum - filter by tag', preconditions: 'User is on /forum', steps: '1. Click a tag on a post', data: 'tag: "ai"', expected: 'Posts filtered by "ai" tag' },
        { title: 'Forum - infinite scroll', preconditions: 'User is on /forum; many posts', steps: '1. Scroll to bottom', data: 'no input data', expected: 'More posts loaded' },
        { title: 'Forum - empty posts', preconditions: 'User is on /forum; no posts', steps: '1. Load page', data: 'no input data', expected: 'Empty state shown' },
        { title: 'Forum - search posts', preconditions: 'User is on /forum', steps: '1. Enter search query', data: 'query: "machine learning"', expected: 'Posts filtered by query' },
        { title: 'Forum - post detail view', preconditions: 'User is on /forum', steps: '1. Click a post', data: 'postId: 1', expected: 'Post detail page opens' },
        { title: 'Forum - comment on post', preconditions: 'User is on /forum', steps: '1. Open post detail\n2. Enter comment\n3. Submit', data: 'comment: "Great work!"', expected: 'Comment added' },
        { title: 'Forum - like post', preconditions: 'User is on /forum', steps: '1. Click "Like" on post', data: 'postId: 1', expected: 'Like count incremented' },
        { title: 'Forum - unlike post', preconditions: 'User is on /forum', steps: '1. Click "Unlike" on post', data: 'postId: 1', expected: 'Like count decremented' },
        { title: 'Forum - max authors in My Posts', preconditions: 'User is on /forum', steps: '1. Click "My Posts"', data: 'no input data', expected: 'Only posts by "Dr. Nguyen Van A" shown (hardcoded)' },
        { title: 'Dashboard - role-based layout', preconditions: 'User is on /dashboard', steps: '1. Set ars_active_role to "Researcher"', data: 'role: "Researcher"', expected: 'Researcher layout rendered' },
        { title: 'Dashboard - Lecturer layout', preconditions: 'User is on /dashboard', steps: '1. Set ars_active_role to "Lecturer"', data: 'role: "Lecturer"', expected: 'Lecturer layout rendered' },
        { title: 'Dashboard - polls localStorage', preconditions: 'User is on /dashboard', steps: '1. Change localStorage in another tab', data: 'ars_active_role: "Reviewer"', expected: 'Layout updates within 500ms' },
        { title: 'Profile - switch role to Researcher', preconditions: 'User is on /profile', steps: '1. Click "Roles" tab\n2. Select "Researcher"', data: 'newRole: "Researcher"', expected: 'ars_active_role updated; UI updates' },
        { title: 'Profile - switch role to Reviewer', preconditions: 'User is on /profile', steps: '1. Click "Roles" tab\n2. Select "Reviewer"', data: 'newRole: "Reviewer"', expected: 'Role updated; wallet pages visible' },
        { title: 'Profile - wallet tab deposit', preconditions: 'User is on /profile', steps: '1. Click "Wallet" tab\n2. Click "Deposit 500k"', data: 'no input data', expected: 'Wallet balance increased by 500k' },
        { title: 'Profile - security change password', preconditions: 'User is on /profile', steps: '1. Click "Security" tab\n2. Fill password fields\n3. Click "Change"', data: 'complete data', expected: 'Alert shown (no real submit)' },
        { title: 'Profile - update info fields', preconditions: 'User is on /profile', steps: '1. Click "Info" tab\n2. Modify fields\n3. Save', data: 'fullName: "x", keywords: ["ai"]', expected: 'Profile updated' },
        { title: 'Button - disabled when loading', preconditions: 'Button is rendered', steps: '1. Click with isLoading=true', data: 'no input data', expected: 'Button disabled; spinner shown' },
        { title: 'Button - click event', preconditions: 'Button is rendered', steps: '1. Click button', data: 'no input data', expected: 'onClick fires' },
        { title: 'Input - error state', preconditions: 'Input is rendered with error', steps: '1. Pass error prop', data: 'error: "Required"', expected: 'Error message shown' },
        { title: 'Input - helper text', preconditions: 'Input is rendered', steps: '1. Pass helperText prop', data: 'helperText: "Enter your email"', expected: 'Helper text shown below input' },
        { title: 'Input - required field', preconditions: 'Input is rendered', steps: '1. Pass required prop', data: 'required: true', expected: 'Asterisk shown; HTML required attribute set' },
        { title: 'Zustand store - login', preconditions: 'useAuthStore is used', steps: '1. Call login(user, token)', data: 'user: {...}, token: "abc"', expected: 'Store state updated; persists to localStorage' },
        { title: 'Zustand store - logout', preconditions: 'useAuthStore is used', steps: '1. Call logout()', data: 'no input data', expected: 'Store state cleared; localStorage cleared' },
      ]
    },
    {
      label: 'Services',
      tcs: [
        { title: 'Axios - attaches Bearer token', preconditions: 'Request made with token in localStorage', steps: '1. Make any API call with ars_token set', data: 'ars_token: "abc123"', expected: 'Request includes Authorization: Bearer abc123' },
        { title: 'Axios - 401 response auto-logout', preconditions: 'BE returns 401', steps: '1. Make any API call; token expired', data: 'status: 401', expected: 'Clears auth, redirects to /login' },
        { title: 'Axios - maps BE error message', preconditions: 'BE returns 400 with message', steps: '1. Make API call', data: 'response.data.message: "Email already exists"', expected: 'Error message: "Email already exists"' },
        { title: 'Axios - timeout 60s', preconditions: 'BE does not respond within 60s', steps: '1. Make slow API call', data: 'timeout triggered', expected: 'Error: "Request timed out. Please try again."' },
        { title: 'Axios - network error', preconditions: 'BE is unreachable', steps: '1. Make API call with no server', data: 'no response', expected: 'Error: "Network error. Please check your connection."' },
        { title: 'Auth - login sends email field', preconditions: 'User is on /login', steps: '1. Submit login form', data: 'form field: "username"', expected: 'API called with { email: "x", password: "y" }' },
        { title: 'Auth - token fallback', preconditions: 'BE returns no token', steps: '1. Login', data: 'response: { user: {...} }', expected: 'Token generated: "ars-session-token-{timestamp}"' },
        { title: 'Auth - logout clears storage', preconditions: 'User is logged in', steps: '1. Click "Logout"', data: 'no input data', expected: 'ars-auth-storage, ars_token, ars_user cleared from both localStorage and sessionStorage' },
        { title: 'Auth - getCurrentUser reads storage', preconditions: 'User is logged in', steps: '1. Call getCurrentUser()', data: 'ars_user: "{...}"', expected: 'Returns user object' },
        { title: 'Auth - registerUser payload', preconditions: 'User is on /register', steps: '1. Submit register form', data: 'username: "x", email: "y", fullName: "z", ...', expected: 'POST /api/auth/register called with full payload' },
        { title: 'Paper - getAll with pagination', preconditions: 'User is on /papers', steps: '1. Load list', data: 'pageNumber: 1, pageSize: 10', expected: 'API called with pagination params' },
        { title: 'Paper - getAll with status filter', preconditions: 'User is on /papers', steps: '1. Click "Waiting" tab', data: 'status: "Waiting"', expected: 'API called with ?status=Waiting' },
        { title: 'Paper - getById', preconditions: 'User clicks paper', steps: '1. Click paper row', data: 'paperId: 1', expected: 'GET /api/paper/1 called' },
        { title: 'Paper - create', preconditions: 'User submits paper', steps: '1. Submit form', data: 'title: "x", abstract: "y", fileUrl: "z"', expected: 'POST /api/paper called' },
        { title: 'Paper - update', preconditions: 'User edits paper', steps: '1. Click "Edit"\n2. Save', data: 'paperId: 1, title: "updated"', expected: 'PUT /api/paper/1 called' },
        { title: 'Paper - delete', preconditions: 'User deletes paper', steps: '1. Click "Delete"', data: 'paperId: 1', expected: 'DELETE /api/paper/1 called' },
        { title: 'Reviewer - getAll', preconditions: 'User is on /reviewers', steps: '1. Load page', data: 'no input data', expected: 'GET /api/ProfessionalProfile called' },
        { title: 'Reviewer - getById', preconditions: 'User views reviewer profile', steps: '1. Click reviewer', data: 'userId: 5', expected: 'GET /api/ProfessionalProfile/5 called' },
        { title: 'Reviewer - update', preconditions: 'User edits profile', steps: '1. Submit edit form', data: 'userId: 5, hindex: 10', expected: 'PUT /api/ProfessionalProfile/5 called' },
        { title: 'ReviewRequest - create', preconditions: 'User sends request', steps: '1. Submit request form', data: 'paperId: 1, reviewerId: 2, fee: 250000', expected: 'POST /api/ReviewRequest called' },
        { title: 'ReviewRequest - getAll normalize id', preconditions: 'User is on /reviewers; requests tab', steps: '1. Load requests', data: 'no input data', expected: 'API returns array; reviewRequestId mapped to id' },
        { title: 'ReviewRequest - update status', preconditions: 'User submits evaluation', steps: '1. Submit', data: 'reviewRequestId: 1, status: "Completed"', expected: 'PUT /api/ReviewRequest/1 called' },
        { title: 'DetailedEvaluation - create', preconditions: 'User submits new evaluation', steps: '1. Submit form', data: 'reviewRequestId: 1, originality: 4, ...', expected: 'POST /api/DetailedEvaluation called' },
        { title: 'DetailedEvaluation - update', preconditions: 'User edits existing', steps: '1. Modify and submit', data: 'evaluationId: 5', expected: 'PUT /api/DetailedEvaluation/5 called' },
        { title: 'User - getAll', preconditions: 'Admin fetches users', steps: '1. Load users', data: 'pageNumber: 1', expected: 'GET /api/user called' },
      ]
    },
    {
      label: 'Hooks',
      tcs: [
        { title: 'useFetch - initial loading', preconditions: 'useFetch called with URL', steps: '1. Render component using useFetch', data: 'url: "/api/test"', expected: 'loading=true, data=null, error=null' },
        { title: 'useFetch - successful load', preconditions: 'useFetch called with URL', steps: '1. Render component using useFetch', data: 'url: "/api/test"', expected: 'loading=false, data={...}, error=null' },
        { title: 'useFetch - error state', preconditions: 'useFetch called with bad URL', steps: '1. Render component using useFetch', data: 'url: "/api/fail"', expected: 'loading=false, data=null, error=Error' },
        { title: 'useFetch - refetch', preconditions: 'useFetch called', steps: '1. Call refetch()', data: 'no input data', expected: 'API called again; data updated' },
        { title: 'useFetch - non-Error wrapped', preconditions: 'useFetch receives string error', steps: '1. Trigger error', data: 'error: "string error"', expected: 'error becomes Error object' },
        { title: 'useFetch - immediate option false', preconditions: 'useFetch called with immediate=false', steps: '1. Render component', data: 'immediate: false', expected: 'Not loaded; manual trigger required' },
        { title: 'useDebounce - initial value', preconditions: 'useDebounce called', steps: '1. Render with useDebounce("x", 500)', data: 'value: "x"', expected: 'Returns "x" immediately' },
        { title: 'useDebounce - delays update', preconditions: 'useDebounce called', steps: '1. Change value\n2. Wait 500ms', data: 'value: "y"', expected: 'Updates after 500ms' },
        { title: 'useDebounce - cleanup on unmount', preconditions: 'useDebounce called', steps: '1. Change value\n2. Unmount before 500ms', data: 'value: "y"', expected: 'No update after unmount' },
        { title: 'useDebounce - custom delay', preconditions: 'useDebounce called', steps: '1. Set delay=1000', data: 'delay: 1000', expected: 'Updates after 1000ms' },
        { title: 'useFirebaseUpload - upload PDF', preconditions: 'useFirebaseUpload called', steps: '1. Call uploadPdf(file)', data: 'file: "doc.pdf" (PDF, <10MB)', expected: 'Progress updates; pdfUrl returned' },
        { title: 'useFirebaseUpload - non-PDF rejected', preconditions: 'useFirebaseUpload called', steps: '1. Call uploadPdf(image)', data: 'file: "image.jpg"', expected: 'Error: "Only PDF allowed"' },
        { title: 'useFirebaseUpload - file > 10MB rejected', preconditions: 'useFirebaseUpload called', steps: '1. Call uploadPdf(large file)', data: 'file: 11MB', expected: 'Error: "File exceeds 10MB"' },
        { title: 'useFirebaseUpload - cancel upload', preconditions: 'useFirebaseUpload called', steps: '1. Call uploadPdf\n2. Call cancel', data: 'no input data', expected: 'Upload cancelled' },
        { title: 'useFirebaseUpload - sanitize filename', preconditions: 'useFirebaseUpload called', steps: '1. Upload file with special chars', data: 'filename: "my doc (1).pdf"', expected: 'Stored as "my_doc__1_.pdf"' },
      ]
    },
    {
      label: 'Routing',
      tcs: [
        { title: 'PrivateRoute - unauthenticated', preconditions: 'User is not authenticated', steps: '1. Navigate to /forum', data: 'no token', expected: 'Redirects to /login' },
        { title: 'PrivateRoute - authenticated', preconditions: 'User is authenticated', steps: '1. Navigate to /forum', data: 'token: "abc"', expected: 'Forum page renders' },
        { title: 'PublicRoute - authenticated', preconditions: 'User is authenticated', steps: '1. Navigate to /login', data: 'token: "abc"', expected: 'Redirects to /forum' },
        { title: 'PublicRoute - unauthenticated', preconditions: 'User is not authenticated', steps: '1. Navigate to /login', data: 'no token', expected: 'Login page renders' },
        { title: 'Root redirect', preconditions: 'User visits /', steps: '1. Navigate to /', data: 'no input data', expected: 'Redirects to /forum' },
        { title: 'Wildcard route', preconditions: 'User visits unknown route', steps: '1. Navigate to /unknown', data: 'no input data', expected: 'Redirects to /login' },
        { title: 'Authenticated wildcard', preconditions: 'User visits unknown route while authed', steps: '1. Navigate to /unknown', data: 'token: "abc"', expected: 'Redirects to /forum' },
        { title: 'Admin route guard', preconditions: 'User with non-admin role', steps: '1. Navigate to /admin', data: 'role: "Researcher"', expected: 'Redirects to /forum' },
        { title: 'Auth persistence after refresh', preconditions: 'User is logged in with remember me', steps: '1. Refresh page', data: 'localStorage has ars_token', expected: 'User remains authenticated' },
        { title: 'Auth cleared after logout', preconditions: 'User logs out', steps: '1. Click "Logout"\n2. Navigate to /forum', data: 'no input data', expected: 'Redirects to /login' },
      ]
    },
    {
      label: 'Admin',
      tcs: [
        { title: 'Admin - non-admin user redirect', preconditions: 'User is on /admin; role != admin', steps: '1. Navigate to /admin', data: 'user.roleName: "Researcher"', expected: 'Redirects to /forum' },
        { title: 'Admin - admin user access', preconditions: 'User is on /admin; role = admin', steps: '1. Navigate to /admin', data: 'user.roleName: "Admin"', expected: 'Admin dashboard renders' },
        { title: 'Admin - dashboard placeholder', preconditions: 'User is on /admin', steps: '1. Load page', data: 'no input data', expected: 'Placeholder content shown' },
        { title: 'Admin - no admin role in token', preconditions: 'User is on /admin', steps: '1. Load page', data: 'token: undefined', expected: 'Redirects to /login' },
        { title: 'Admin - role check on direct URL', preconditions: 'User is on /admin', steps: '1. Type URL directly', data: 'no role match', expected: 'Auth guard blocks access' },
      ]
    },
  ];

  return { f1Groups, f2Groups };
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const INPUT  = 'c:/Users/admin/Downloads/Report5_Test Report.xlsx';
  const OUTPUT = 'c:/Users/admin/Downloads/Report5_Test Report.xlsx';

  console.log('Reading template...');
  const buf = fs.readFileSync(INPUT);
  const entries = readZipEntries(buf);
  console.log(`  ${Object.keys(entries).length} archive entries`);

  // --- Feature 1 (237 TCs) ---
  const { f1Groups, f2Groups } = getTestCaseGroups();

  const f1TcCount = f1Groups.reduce((a, g) => a + g.tcs.length, 0);
  const f2TcCount = f2Groups.reduce((a, g) => a + g.tcs.length, 0);
  console.log(`\nFeature 1 TCs: ${f1TcCount}`);
  console.log(`Feature 2 TCs: ${f2TcCount}`);
  console.log(`Total TCs: ${f1TcCount + f2TcCount}`);

  // --- Build Feature 1 sheet ---
  console.log('\nBuilding Feature 1 sheet...');
  const f1SheetOut = {};
  const f1SheetXml = buildFeatureSheetXml(f1Groups, f1SheetOut);
  entries['xl/worksheets/sheet4.xml'] = Buffer.from(f1SheetXml, 'utf8');
  entries['xl/sharedStrings.xml']    = Buffer.from(f1SheetOut.featureSstXml, 'utf8');
  console.log(`  Feature 1: ${f1Groups.length} modules, ${f1TcCount} TCs`);

  // --- Build Feature 2 sheet ---
  console.log('Building Feature 2 sheet...');
  const f2SheetOut = {};
  const f2SheetXml = buildFeatureSheetXml(f2Groups, f2SheetOut);
  entries['xl/worksheets/sheet5.xml'] = Buffer.from(f2SheetXml, 'utf8');
  // Keep separate sharedStrings — we need both in one file
  // Since OOXML only has one sharedStrings.xml, we merge them
  const mergedSst = [...f1SheetOut.featureSst, ...f2SheetOut.featureSst];
  entries['xl/sharedStrings.xml'] = Buffer.from(buildSharedStrings(mergedSst), 'utf8');
  console.log(`  Feature 2: ${f2Groups.length} modules, ${f2TcCount} TCs`);

  // --- Update Cover ---
  console.log('\nUpdating Cover sheet...');
  const coverXml = entries['xl/worksheets/sheet1.xml'].toString('utf8');
  const updatedCover = updateCoverSheet(coverXml, {
    projectName: 'ARS Platform (Academic Research Sharing)',
    projectCode: 'ARS_FE',
    creator:     'FE Team',
    version:     'v1.0',
  });
  entries['xl/worksheets/sheet1.xml'] = Buffer.from(updatedCover, 'utf8');

  // --- Update Test Cases sheet ---
  console.log('Updating Test Cases sheet...');
  const tcSheetXml = entries['xl/worksheets/sheet2.xml'].toString('utf8');
  const funcList = buildFunctionList(f1Groups, f2Groups);
  const updatedTcSheet = updateTestCasesSheet(tcSheetXml, funcList);
  entries['xl/worksheets/sheet2.xml'] = Buffer.from(updatedTcSheet, 'utf8');

  // --- Update Test Statistics sheet ---
  console.log('Updating Test Statistics sheet...');
  const statsXml = entries['xl/worksheets/sheet3.xml'].toString('utf8');
  const updatedStats = updateStatsSheet(statsXml);
  entries['xl/worksheets/sheet3.xml'] = Buffer.from(updatedStats, 'utf8');

  // --- Rebuild calcChain (invalidate it) ---
  entries['xl/calcChain.xml'] = Buffer.from(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
    '<calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>'
  );

  // --- Write output ---
  console.log(`\nWriting output to ${OUTPUT}...`);
  const outBuf = writeZipEntries(entries);
  fs.writeFileSync(OUTPUT, outBuf);

  console.log(`\nDone! Output size: ${(outBuf.length / 1024).toFixed(1)} KB`);
  console.log(`TC summary:`);
  console.log(`  Feature 1: ${f1Groups.length} modules, ${f1TcCount} test cases`);
  console.log(`  Feature 2: ${f2Groups.length} modules, ${f2TcCount} test cases`);
  console.log(`  Total:    ${f1TcCount + f2TcCount} test cases`);

  // Quick verification
  console.log('\nVerifying output...');
  const verify = readZipEntries(outBuf);
  const hasQuot = Object.values(verify).some(b => b.toString('utf8').includes('&quot;'));
  console.log(`  Entries: ${Object.keys(verify).length}`);
  console.log(`  &quot; cleaned: ${hasQuot ? 'NO (still present!)' : 'YES (all cleaned)'}`);
  console.log(`  sheet4.xml size: ${(verify['xl/worksheets/sheet4.xml'].length / 1024).toFixed(1)} KB`);
  console.log(`  sheet5.xml size: ${(verify['xl/worksheets/sheet5.xml'].length / 1024).toFixed(1)} KB`);
}

main();
