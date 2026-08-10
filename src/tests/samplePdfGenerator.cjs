// Minimal valid PDF fixture for testing uploads
// Usage: just import or reference this path in tests
const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 78 >> stream BT /F1 24 Tf 100 750 Td (Sample PDF for Testing Upload) Tj ET endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000385 00000 n
trailer << /Size 6 /Root 1 0 R >>
startxref
462
%%EOF`;

const { writeFileSync, mkdirSync, existsSync } = require('fs');
const path = require('path');

const fixturesDir = path.join(__dirname, 'fixtures');
if (!existsSync(fixturesDir)) {
  mkdirSync(fixturesDir, { recursive: true });
}

writeFileSync(path.join(fixturesDir, 'sample.pdf'), minimalPdf);
console.log('Created: src/tests/fixtures/sample.pdf');

// Multi-page PDF fixture
const multiPagePdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R 8 0 R] /Count 2 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 6 0 R >> >> /Annots [7 0 R] >> endobj
4 0 obj << /Length 130 >> stream BT /F1 16 Tf 72 750 Td (Academic Research Platform - Verification Document) Tj 0 -30 Td /F1 12 Tf (Role: Researcher) Tj 0 -20 Td (This is a test fixture file) Tj 0 -20 Td (Upload functionality testing) Tj ET endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj
7 0 obj << /Type /Annot /Subtype /Text /Rect [50 700 545 750] /Contents (Sample verification document - TEST FILE ONLY) >> endobj
8 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 9 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
9 0 obj << /Length 60 >> stream BT /F1 12 Tf 72 750 Td (Page 2 of 2 - Appendix) Tj ET endstream endobj
xref
0 10
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000288 00000 n
0000000459 00000 n
0000000516 00000 n
0000000560 00000 n
0000000729 00000 n
0000000836 00000 n
trailer << /Size 10 /Root 1 0 R >>
startxref
917
%%EOF`;

writeFileSync(path.join(fixturesDir, 'sample-multi-page.pdf'), multiPagePdf);
console.log('Created: src/tests/fixtures/sample-multi-page.pdf');

console.log('\nAll fixtures created successfully!');
console.log('Use these files to test the PDF upload in the Register page.');
