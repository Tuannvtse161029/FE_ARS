import { describe, it, expect } from 'vitest';

describe('probe', () => {
  it('loads via 2 levels', async () => {
    const mod = await import('../../src/services/withdrawal.service');
    expect(typeof mod.withdrawalService).toBe('object');
  });

  it('loads via 1 level', async () => {
    const mod = await import('../src/services/withdrawal.service');
    expect(typeof mod.withdrawalService).toBe('object');
  });

  it('loads via 3 levels', async () => {
    const mod = await import('../../../src/services/withdrawal.service');
    expect(typeof mod.withdrawalService).toBe('object');
  });
});
