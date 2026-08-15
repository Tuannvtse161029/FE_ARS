/**
 * Random PDF selector for local development / test automation.
 *
 * Scans src/assets/pdf_sample/ for .pdf files and returns one at random each call.
 *
 * Usage:
 *   import { getRandomPdfPath } from '../utils/getRandomPdf';
 *   const { filePath, fileName } = getRandomPdfPath();
 *
 * Edge cases:
 *   - Directory doesn't exist  → throws Error with clear message
 *   - No .pdf files found     → throws Error with clear message
 *   - Exactly 1 .pdf found    → returns that file (deterministic for that state)
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Resolve relative to this file: src/utils/getRandomPdf.ts
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_SAMPLE_DIR = path.resolve(__dirname, '../assets/pdf_sample');

export interface PdfSelectionResult {
  /** Absolute path to the selected PDF */
  filePath: string;
  /** Filename only (basename) */
  fileName: string;
  /** Total PDFs scanned */
  totalFound: number;
  /** Index selected (0-based) */
  selectedIndex: number;
}

export function getRandomPdfPath(): PdfSelectionResult {
  if (!fs.existsSync(PDF_SAMPLE_DIR)) {
    throw new Error(
      `[getRandomPdf] PDF sample directory not found at:\n` +
      `  ${PDF_SAMPLE_DIR}\n` +
      `  Please ensure src/assets/pdf_sample/ exists and contains at least one .pdf file.`
    );
  }

  const files = fs.readdirSync(PDF_SAMPLE_DIR).filter((f) => f.toLowerCase().endsWith('.pdf'));

  if (files.length === 0) {
    throw new Error(
      `[getRandomPdf] No .pdf files found in:\n` +
      `  ${PDF_SAMPLE_DIR}\n` +
      `  Please add at least one PDF file to that directory.`
    );
  }

  const selectedIndex = Math.floor(Math.random() * files.length);
  const fileName = files[selectedIndex]!;
  const filePath = path.join(PDF_SAMPLE_DIR, fileName);

  return { filePath, fileName, totalFound: files.length, selectedIndex };
}

/** Read a random PDF as a Buffer — useful for Playwright route interception or Firebase upload. */
export function getRandomPdfBuffer(): { buffer: Buffer; fileName: string } {
  const { filePath, fileName } = getRandomPdfPath();
  return { buffer: fs.readFileSync(filePath), fileName };
}

/** Read a random PDF as a browser-compatible File — useful for direct upload simulation. */
export function getRandomPdfFile(): File {
  const { buffer, fileName } = getRandomPdfBuffer();
  return new File([buffer], fileName, { type: 'application/pdf' });
}
