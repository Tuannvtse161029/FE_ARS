/* eslint-disable */
/**
 * One-shot fixture generator. Run via `node scripts/generate-pdf-fixtures.mjs`.
 * Produces public/test-fixtures/mock-proof-{an,bich,cuong,duc,hong}.pdf and
 * mock-receipt-linh.pdf — tiny, clearly-synthetic single-page PDFs labelled
 * "Synthetic test fixture — not a real document".
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'public', 'test-fixtures');
mkdirSync(outDir, { recursive: true });

const fixtures = [
  {
    file: 'mock-proof-an.pdf',
    title: 'Mock proof — Nguyen Van An',
    subtitle: 'Synthetic test fixture — not a real document',
  },
  {
    file: 'mock-proof-bich.pdf',
    title: 'Mock proof — Tran Thi Bich',
    subtitle: 'Synthetic test fixture — not a real document',
  },
  {
    file: 'mock-proof-cuong.pdf',
    title: 'Mock proof — Le Hoang Cuong',
    subtitle: 'Synthetic test fixture — not a real document',
  },
  {
    file: 'mock-proof-duc.pdf',
    title: 'Mock proof — Pham Minh Duc',
    subtitle: 'Synthetic test fixture — not a real document',
  },
  {
    file: 'mock-proof-hong.pdf',
    title: 'Mock proof — Vu Thi Hong',
    subtitle: 'Synthetic test fixture — not a real document',
  },
  {
    file: 'mock-receipt-linh.pdf',
    title: 'Mock withdrawal receipt — Bui Thi Linh',
    subtitle: 'Synthetic test fixture — not a real document',
  },
];

async function buildOne(title, subtitle) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const body = await pdf.embedFont(StandardFonts.Helvetica);

  page.drawText(title, {
    x: 48,
    y: 760,
    size: 18,
    font,
    color: rgb(0.18, 0.22, 0.38),
  });
  page.drawText(subtitle, {
    x: 48,
    y: 730,
    size: 11,
    font: body,
    color: rgb(0.4, 0.45, 0.55),
  });
  page.drawText('This page exists solely so the PDF viewer can render a', {
    x: 48,
    y: 680,
    size: 11,
    font: body,
    color: rgb(0.1, 0.12, 0.18),
  });
  page.drawText('real PDF when the Admin role-request mock fixtures are loaded.', {
    x: 48,
    y: 664,
    size: 11,
    font: body,
    color: rgb(0.1, 0.12, 0.18),
  });
  page.drawText('It is NOT a real user document and contains no PII.', {
    x: 48,
    y: 648,
    size: 11,
    font: body,
    color: rgb(0.6, 0.2, 0.2),
  });
  return await pdf.save();
}

(async () => {
  for (const fx of fixtures) {
    const bytes = await buildOne(fx.title, fx.subtitle);
    writeFileSync(resolve(outDir, fx.file), bytes);
    console.log(`wrote ${fx.file} (${bytes.byteLength} bytes)`);
  }
})();
