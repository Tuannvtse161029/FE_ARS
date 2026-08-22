/**
 * Unit test for the new user-facing Premium Packages route constant.
 *
 * Keeps the contract between `src/routes/paths.ts` and the consuming pages /
 * sidebar / tests honest. If a future refactor accidentally points the
 * Premium Packages route at a hash or a different path, this fails fast.
 */
import { describe, it, expect } from 'vitest';
import { ROUTES } from '../../routes/paths';

describe('ROUTES.PREMIUM_PACKAGES', () => {
  it('is the real /premium-packages path', () => {
    expect(ROUTES.PREMIUM_PACKAGES).toBe('/premium-packages');
  });

  it('is not a hash fragment', () => {
    expect(ROUTES.PREMIUM_PACKAGES).not.toMatch(/^#/);
  });

  it('coexists with the admin packages route at a different path', () => {
    expect(ROUTES.ADMIN_PACKAGES).toBe('/admin/packages');
    expect(ROUTES.ADMIN_PACKAGES).not.toBe(ROUTES.PREMIUM_PACKAGES);
  });

  it('preserves the RoutePath type contract', () => {
    // Compile-time check that the key exists and matches the literal type.
    const value: (typeof ROUTES)[keyof typeof ROUTES] = ROUTES.PREMIUM_PACKAGES;
    expect(value).toBe('/premium-packages');
  });
});
