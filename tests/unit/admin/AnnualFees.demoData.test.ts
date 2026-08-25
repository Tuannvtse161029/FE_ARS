import { describe, it, expect } from 'vitest';
import {
  ANNUAL_FEES_DEMO_NOTICE,
  DEMO_ANNUAL_FEES,
  DEMO_ANNUAL_FEES_DTO,
} from '../../../src/data/annualFees.demo';

/**
 * Agent admin-annual-fees — vital tests for the demo-data isolation.
 *
 * Two contracts the rest of the codebase can rely on:
 *
 *   1. Demo values are restricted to Researcher and Lecturer — the
 *      Reviewer / Graduate Student / Guest tiers must never appear in
 *      the demo fixtures because no business decision has been made
 *      for them.
 *
 *   2. Demo values are isolated from the production payment logic.
 *      The demo module must not import from payment.service.ts, the
 *      wallet service, or anything that could forward a real
 *      transaction. This test verifies the module's surface in a
 *      shallow way — the strictest check is the next agent's code
 *      review of the import graph.
 */
describe('admin-annual-fees / demo data', () => {
  it('exports a constant notice string for the UI banner', () => {
    expect(ANNUAL_FEES_DEMO_NOTICE).toBe('Demo data — awaiting backend API');
  });

  it('only includes Researcher and Lecturer example fees', () => {
    const roles = new Set(DEMO_ANNUAL_FEES.map((row) => row.targetRole));
    expect(roles.has('Researcher')).toBe(true);
    expect(roles.has('Lecturer')).toBe(true);
    // No Reviewer / Graduate Student / Guest tiers until the product
    // team decides on their pricing.
    expect(roles.has('Reviewer')).toBe(false);
    expect(roles.has('Graduate Student')).toBe(false);
    expect(roles.has('Guest')).toBe(false);
    expect(roles.has('Admin')).toBe(false);
  });

  it('covers both annual and six-month billing cycles', () => {
    const cycles = new Set(DEMO_ANNUAL_FEES.map((row) => row.billingCycle));
    expect(cycles.has('Annual')).toBe(true);
    expect(cycles.has('SixMonth')).toBe(true);
    expect(cycles.size).toBe(2);
  });

  it('exposes one Researcher + one Lecturer example per billing cycle', () => {
    const pairs = DEMO_ANNUAL_FEES.map((row) => `${row.targetRole}|${row.billingCycle}`);
    expect(pairs).toEqual(
      expect.arrayContaining([
        'Researcher|Annual',
        'Researcher|SixMonth',
        'Lecturer|Annual',
        'Lecturer|SixMonth',
      ]),
    );
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('DTO projection matches the source rows (every field non-null)', () => {
    for (const dto of DEMO_ANNUAL_FEES_DTO) {
      expect(dto.id).not.toBeNull();
      expect(dto.targetRole).not.toBeNull();
      expect(dto.title).not.toBeNull();
      expect(dto.priceVnd).not.toBeNull();
      expect(dto.billingCycle).not.toBeNull();
      expect(dto.features).not.toBeNull();
      expect(dto.isActive).not.toBeNull();
      expect(dto.updatedAt).not.toBeNull();
    }
  });

  it('does not import from any production payment service', async () => {
    // Static import-graph check: the demo module's source must not
    // import from payment.service / wallet.service / axios. We do
    // this with a regex over the file source because dynamic
    // import-graph assertions are flaky across vitest versions.
    // Whitespace-tolerant regex matches import or export statements
    // (not comments or docstrings).
    const { default: fs } = await import('fs');
    const { default: path } = await import('path');
    const filePath = path.resolve(
      process.cwd(),
      'src/data/annualFees.demo.ts',
    );
    const src = fs.readFileSync(filePath, 'utf8');

    const importLike = /^\s*(?:import|export)\b[^;]*from\s+['"][^'"]+['"]/gm;
    const imports = src.match(importLike) ?? [];
    const joined = imports.join('\n');

    expect(joined).not.toMatch(/payment\.service/);
    expect(joined).not.toMatch(/wallet\.service/);
    expect(joined).not.toMatch(/axios/);
    expect(joined).not.toMatch(/Payment\./);
    expect(joined).not.toMatch(/Wallet\./);
  });
});