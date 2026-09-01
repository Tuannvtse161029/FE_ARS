/**
 * Sanity test for docs/PRODUCTION_REENABLEMENT_REGISTER.md.
 *
 * Verifies that the production variance register still contains the PROD-002
 * entry for the Reviewer ORCID bypass. This guards against accidental deletion
 * or silent regressions during future refactors.
 */
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const registerPath = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'docs',
  'PRODUCTION_REENABLEMENT_REGISTER.md',
);

describe('PRODUCTION_REENABLEMENT_REGISTER.md', () => {
  const content = readFileSync(registerPath, 'utf8');

  test('file exists and is non-empty', () => {
    expect(content.length).toBeGreaterThan(0);
  });

  test('contains the PROD-001 entry (subscription gate)', () => {
    expect(content).toMatch(/PROD-001/);
    expect(content).toMatch(/subscription/i);
  });

  test('contains the PROD-002 entry (Reviewer ORCID bypass)', () => {
    expect(content).toMatch(/PROD-002/);
    expect(content).toMatch(/ORCID/i);
    expect(content).toMatch(/VITE_REQUIRE_REVIEWER_ORCID/);
    expect(content).toMatch(/DEVELOPMENT_BYPASS/);
  });

  test('documents the production re-enable trigger', () => {
    expect(content).toMatch(/Re-enable trigger/i);
    expect(content).toMatch(/Production launch approved/i);
  });

  test('lists the required fields for future entries', () => {
    expect(content).toMatch(/Unique ID/);
    expect(content).toMatch(/Exact behaviour changed/);
    expect(content).toMatch(/Why development needs the bypass/);
    expect(content).toMatch(/Exact files\/functions affected/);
    expect(content).toMatch(/Feature flag or control used/);
    expect(content).toMatch(/Production behaviour to restore/);
    expect(content).toMatch(/Owner/);
    expect(content).toMatch(/Status/);
  });
});
