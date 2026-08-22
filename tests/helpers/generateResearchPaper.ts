/**
 * Generates a realistic 5-page research-paper-style PDF with embedded figures,
 * tables, multi-column text, and image placeholders.
 *
 * Run: npx tsx src/tests/generateResearchPaper.ts
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('Generating research paper PDF with embedded figures...');

  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN = 55;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const LINE = 14;

  const DARK_BLUE = rgb(0.05, 0.1, 0.3);
  const BLACK = rgb(0, 0, 0);
  const GRAY = rgb(0.4, 0.4, 0.4);
  const LIGHT_GRAY = rgb(0.7, 0.7, 0.7);
  const GREEN = rgb(0.1, 0.4, 0.1);

  // ── Helper: add page, return page-specific helpers ──────────────────────
  const addPage = () => {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    const { width, height } = page.getSize();
    let y = height - MARGIN;

    const drawText = (
      text: string,
      opts: {
        x?: number; y?: number; size?: number;
        font?: typeof helvetica; color?: ReturnType<typeof rgb>; maxWidth?: number;
      } = {}
    ) => {
      const x = opts.x ?? MARGIN;
      const size = opts.size ?? 10;
      const font = opts.font ?? helvetica;
      const color = opts.color ?? BLACK;
      page.drawText(text, { x, y, size, font, color, maxWidth: opts.maxWidth });
    };

    const drawWrapped = (
      text: string,
      opts: { size?: number; font?: typeof helvetica; color?: ReturnType<typeof rgb>; maxWidth?: number } = {}
    ) => {
      const size = opts.size ?? 10;
      const font = opts.font ?? helvetica;
      const color = opts.color ?? BLACK;
      const maxWidth = opts.maxWidth ?? CONTENT_W;
      const words = text.split(' ');
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
          page.drawText(line, { x: MARGIN, y, size, font, color });
          y -= LINE + 2;
          line = word;
        } else {
          line = test;
        }
      }
      if (line) {
        page.drawText(line, { x: MARGIN, y, size, font, color });
        y -= LINE + 2;
      }
    };

    const drawRect = (opts: {
      x: number; y: number; width: number; height: number;
      color?: ReturnType<typeof rgb>; borderColor?: ReturnType<typeof rgb>;
      borderWidth?: number; opacity?: number;
    }) => {
      page.drawRectangle(opts);
    };

    const getY = () => y;
    const setY = (v: number) => { y = v; };

    return { page, drawText, drawWrapped, drawRect, getY, setY };
  };

  // ── PAGE 1: Title / Abstract ──────────────────────────────────────────
  const p1 = addPage();
  let y = p1.getY();

  p1.drawText('Deep Learning Approaches for Vietnamese Sign Language Recognition', {
    y, size: 18, font: helveticaBold, color: DARK_BLUE, maxWidth: CONTENT_W,
  });
  y -= 22;
  p1.drawText('A Comparative Study', {
    y, size: 14, font: helveticaBold, color: DARK_BLUE,
  });
  y -= 28;

  p1.drawText('Nguyen Van A, Le Thi B, Tran Van C', { y, size: 10, color: rgb(0.2, 0.2, 0.2) });
  y -= LINE + 2;
  p1.drawText('Vietnam National University, Ho Chi Minh City', { y, size: 10, color: rgb(0.3, 0.3, 0.3) });
  y -= LINE + 2;
  p1.drawText('ORCID: 0000-0002-1825-0097', { y, size: 8, color: GRAY });
  y -= 20;

  // Divider
  p1.drawRect({ x: MARGIN, y: y - 2, width: CONTENT_W, height: 1, borderColor: LIGHT_GRAY, borderWidth: 0.5 });
  y -= 15;

  p1.drawText('ABSTRACT', { y, size: 10, font: helveticaBold, color: DARK_BLUE });
  y -= LINE + 4;
  p1.drawWrapped(
    'This paper presents a comprehensive comparison of deep learning architectures for automatic recognition of Vietnamese Sign Language (VSL) from video sequences. We evaluate CNN, LSTM, and Transformer-based models on VSL-5K, a new benchmark dataset of 5,000 videos spanning 200 VSL gestures. Our proposed Hybrid Vision-Transformer (HVT) achieves 94.7% accuracy, outperforming existing methods by 3.2pp.',
    { maxWidth: CONTENT_W }
  );
  y -= 10;
  p1.drawWrapped(
    'We release our dataset, models, and evaluation code as open-source at https://github.com/vnsl/hvt.',
    { maxWidth: CONTENT_W }
  );
  y -= 12;
  p1.drawText('Keywords: ', { y, size: 8, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
  p1.drawText('Vietnamese Sign Language, Deep Learning, Computer Vision, Transformer, Gesture Recognition', {
    y, size: 8, color: GRAY,
  });
  y -= 18;
  p1.drawRect({ x: MARGIN, y: y - 2, width: CONTENT_W, height: 1, borderColor: LIGHT_GRAY, borderWidth: 0.5 });

  // ── PAGE 2: Introduction + Related Work ──────────────────────────────
  const p2 = addPage();
  y = p2.getY();

  p2.drawText('1. INTRODUCTION', { y, size: 11, font: helveticaBold, color: DARK_BLUE });
  y -= LINE + 6;
  p2.drawWrapped(
    'Sign language recognition (SLR) is a critical task in assistive AI. Vietnamese Sign Language (VSL) presents unique challenges: high intra-signer variability, regional dialect influence, and simultaneous multi-channel expression (hands + facial cues). Prior work has primarily focused on ASL and BSL, leaving VSL understudied.',
    { maxWidth: CONTENT_W }
  );
  y -= 10;
  p2.drawWrapped(
    'This paper contributes: (1) VSL-5K — a 5,000-video benchmark across 200 gestures from 50 native signers. (2) HVT — a Hybrid Vision-Transformer architecture. (3) An ablation study quantifying the contribution of each model component.',
    { maxWidth: CONTENT_W }
  );
  y -= 18;

  p2.drawText('2. RELATED WORK', { y, size: 11, font: helveticaBold, color: DARK_BLUE });
  y -= LINE + 6;
  p2.drawWrapped(
    'Early SLR relied on glove sensors (Kong & Ranganath, 2018). CNNs became dominant for isolated sign recognition (Koller et al., 2019). LSTMs modeled temporal sequences (Cavazza et al., 2020), while Transformers captured long-range dependencies (Ali et al., 2021). Despite these advances, no prior work addresses the multimodal nature of VSL at scale.',
    { maxWidth: CONTENT_W }
  );
  y -= 18;

  p2.drawText('3. METHODOLOGY', { y, size: 11, font: helveticaBold, color: DARK_BLUE });
  y -= LINE + 6;
  p2.drawWrapped(
    'HVT has three stages: (1) CNN spatial encoder (ResNet-50) extracts per-frame visual features. (2) Vision Transformer applies multi-head self-attention across spatial tokens. (3) Temporal Transformer aggregates frame-level representations across T time steps. We use a weighted cross-entropy loss and AdamW optimizer with cosine annealing LR.',
    { maxWidth: CONTENT_W }
  );

  // ── PAGE 3: Architecture Figure ───────────────────────────────────────
  const p3 = addPage();
  y = p3.getY();

  p3.drawText('3.1 Architecture Overview', { y, size: 11, font: helveticaBold, color: DARK_BLUE });
  y -= LINE + 8;

  // Figure 1 box
  const figW = CONTENT_W;
  const figH = 110;
  const figX = MARGIN;
  const figY = y - figH;

  // Figure background (light blue tint simulated with border)
  p3.drawRect({ x: figX, y: figY, width: figW, height: figH,
    borderColor: rgb(0.3, 0.3, 0.6), borderWidth: 1 });

  // Three section dividers
  p3.drawRect({ x: figX + figW / 3, y: figY + 5, width: 1, height: figH - 10, borderColor: LIGHT_GRAY, borderWidth: 0.5 });
  p3.drawRect({ x: figX + (2 * figW) / 3, y: figY + 5, width: 1, height: figH - 10, borderColor: LIGHT_GRAY, borderWidth: 0.5 });

  // Section labels
  const sectionY = figY + figH - 30;
  p3.drawText('CNN Encoder', { x: figX + 20, y: sectionY, size: 11, font: helveticaBold, color: rgb(0.1, 0.1, 0.5) });
  p3.drawText('(ResNet-50)', { x: figX + 20, y: sectionY - 12, size: 8, color: GRAY });
  p3.drawText('Vision Transformer', { x: figX + figW / 3 + 15, y: sectionY, size: 11, font: helveticaBold, color: rgb(0.1, 0.1, 0.5) });
  p3.drawText('(Spatial Attn.)', { x: figX + figW / 3 + 15, y: sectionY - 12, size: 8, color: GRAY });
  p3.drawText('Temporal Transformer', { x: figX + (2 * figW) / 3 + 10, y: sectionY, size: 11, font: helveticaBold, color: rgb(0.1, 0.1, 0.5) });
  p3.drawText('(Temporal Attn.)', { x: figX + (2 * figW) / 3 + 10, y: sectionY - 12, size: 8, color: GRAY });

  // Arrow separators between sections
  p3.drawText('->', { x: figX + figW / 3 - 15, y: sectionY - 5, size: 12, color: rgb(0.3, 0.3, 0.3) });
  p3.drawText('->', { x: figX + (2 * figW) / 3 - 15, y: sectionY - 5, size: 12, color: rgb(0.3, 0.3, 0.3) });

  // Output label
  p3.drawText('->  Classification Head', { x: figX + figW - 155, y: sectionY - 5, size: 9, color: rgb(0.1, 0.4, 0.1) });

  // Figure caption
  y = figY - 8;
  p3.drawText('Figure 1: Hybrid Vision-Transformer (HVT) architecture. '
    + 'The CNN encoder produces spatial feature maps; the Vision Transformer models spatial attention; '
    + 'the Temporal Transformer aggregates across T frames.', {
    y, size: 8, font: helveticaBold, color: rgb(0.2, 0.2, 0.2), maxWidth: CONTENT_W,
  });
  y -= 18;

  p3.drawWrapped('We evaluate on three metrics: top-1 accuracy, top-5 accuracy, and per-frame latency (ms). Table 1 summarizes results on the VSL-5K test set.', { maxWidth: CONTENT_W });
  y -= 15;

  // ── PAGE 4: Results Table ─────────────────────────────────────────────
  const p4 = addPage();
  y = p4.getY();

  p4.drawText('Table 1: Comparison of SLR Methods on VSL-5K', {
    y, size: 10, font: helveticaBold, color: DARK_BLUE,
  });
  y -= LINE + 8;

  // Table border
  const tableX = MARGIN;
  const tableY = y;
  const tableRowH = 18;
  const cols = [210, 110, 110, 110];
  const totalTableW = cols.reduce((a, b) => a + b, 0);

  const tableRows = [
    ['Method', 'Top-1 Acc.', 'Top-5 Acc.', 'Latency'],
    ['CNN-LSTM (Koller 2019)', '87.3%', '96.1%', '42ms'],
    ['ViT-B (Ali 2021)', '90.8%', '97.4%', '58ms'],
    ['HVT (Ours)', '94.7%', '98.9%', '67ms'],
  ];

  tableRows.forEach((row, ri) => {
    const rowY = y - tableRowH * ri;
    const isHeader = ri === 0;
    const isBest = ri === 3;
    const rowH = tableRowH;

    // Row background
    if (isBest) {
      p4.drawRect({ x: tableX, y: rowY - rowH + 2, width: totalTableW, height: rowH,
        color: rgb(0.1, 0.5, 0.1), opacity: 0.12 });
    } else if (isHeader) {
      p4.drawRect({ x: tableX, y: rowY - rowH + 2, width: totalTableW, height: rowH,
        color: rgb(0.1, 0.2, 0.5), opacity: 0.1 });
    }

    // Row border
    p4.drawRect({ x: tableX, y: rowY - rowH + 2, width: totalTableW, height: rowH,
      borderColor: LIGHT_GRAY, borderWidth: 0.5 });

    // Cell text
    let cx = tableX + 4;
    row.forEach((cell, ci) => {
      p4.drawText(cell, {
        x: cx, y: rowY - rowH + 5,
        size: isHeader ? 9 : 8,
        font: isHeader ? helveticaBold : helvetica,
        color: isBest ? rgb(0.05, 0.3, 0.05) : BLACK,
      });
      cx += cols[ci];
    });
  });

  y -= tableRowH * tableRows.length + 15;

  p4.drawWrapped('HVT achieves state-of-the-art on all three metrics. The temporal Transformer is critical for capturing rapid gesture dynamics, while the Vision Transformer distinguishes visually similar hand configurations.', { maxWidth: CONTENT_W });
  y -= 10;
  p4.drawWrapped('Figure 2 (next page) shows the per-class accuracy breakdown. Errors concentrate among visually similar gestures differing primarily in index finger direction.', { maxWidth: CONTENT_W });

  // ── PAGE 5: Conclusion ────────────────────────────────────────────────
  const p5 = addPage();
  y = p5.getY();

  p5.drawText('4. CONCLUSION', { y, size: 11, font: helveticaBold, color: DARK_BLUE });
  y -= LINE + 6;
  p5.drawWrapped(
    'We presented HVT, a hybrid vision-transformer for Vietnamese Sign Language recognition, achieving 94.7% accuracy on VSL-5K. Key findings: (1) the temporal Transformer captures motion dynamics; (2) spatial attention distinguishes similar hand shapes; (3) class-weighted loss handles the long-tail gesture distribution.',
    { maxWidth: CONTENT_W }
  );
  y -= 10;
  p5.drawWrapped(
    'Future work includes extending to continuous sign language recognition (CSLR) with CTC loss, incorporating facial landmark features for expression modeling, and mobile deployment for real-time inference.',
    { maxWidth: CONTENT_W }
  );
  y -= 18;

  p5.drawText('REFERENCES', { y, size: 11, font: helveticaBold, color: DARK_BLUE });
  y -= LINE + 6;
  const refs = [
    '[1] Koller, O. et al. (2019). Weakly Supervised Learning of Hand Shape. CVPR.',
    '[2] Ali, S. et al. (2021). Transformers in Sign Language Recognition. ICCV.',
    '[3] Cavazza, J. et al. (2020). Sign Language Recognition with LSTMs. TPAMI.',
    '[4] Kong, W. & Ranganath, S. (2018). Towards Automatic Sign Language Analysis. ACM TIST.',
  ];
  for (const ref of refs) {
    p5.drawWrapped(ref, { size: 8, color: GRAY, maxWidth: CONTENT_W });
  }

  // ── Save ─────────────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  const fixturesDir = join(__dirname, 'fixtures');
  if (!existsSync(fixturesDir)) mkdirSync(fixturesDir, { recursive: true });

  const outPath = join(fixturesDir, 'research-paper-with-figures.pdf');
  writeFileSync(outPath, pdfBytes);

  console.log(`✅  Created: ${outPath}`);
  console.log(`   Size:  ${(pdfBytes.byteLength / 1024).toFixed(1)} KB`);
  console.log(`   Pages: 5 (Title+Abstract, Intro+Related+Method, Architecture Figure, Results Table, Conclusion+Refs)`);
  console.log(`   Features: title, abstract, keywords, wrapped text, architecture diagram, results table, references`);
}

main().catch(console.error);
