/**
 * Agent 30 (regression) — unit tests for the shared remount-safe
 * Google-login promise guard (`src/utils/googleLoginGuard.ts`).
 *
 * The guard MUST:
 *   1. Execute the underlying POST exactly ONCE for a given credential.
 *   2. Resolve all concurrent callers with the same outcome.
 *   3. Clear the in-flight slot on settlement (success or error) so a
 *      retry after a transient failure re-enters the BE.
 *   4. Refuse to track empty / non-string credentials.
 *   5. Never log the credential itself — the fingerprint helper is
 *      safe by construction (length + 8-char head + 4-char tail).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  acquireGoogleLoginSession,
  getGoogleLoginInflightCount,
  isGoogleLoginInFlight,
  _resetGoogleLoginGuardForTesting,
} from '../../../src/utils/googleLoginGuard';
import type { NormalisedGoogleSession } from '../../../src/types/googleAuth';

const fixtureSession: NormalisedGoogleSession = {
  token: 'jwt',
  email: 'u@e.com',
  fullName: 'U E',
  avatarUrl: null,
  userId: 1,
  role: null,
  roleId: null,
  roles: [],
  isActive: false,
  verificationStatus: null,
  effectiveRole: null,
  isNewUser: true,
  requiresOnboarding: true,
};

beforeEach(() => {
  _resetGoogleLoginGuardForTesting();
});

describe('acquireGoogleLoginSession', () => {
  it('executes the exchange factory exactly once for two concurrent callers on the same credential', async () => {
    const factory = vi.fn().mockResolvedValue(fixtureSession);

    const first = acquireGoogleLoginSession('CRED_A', factory);
    const second = acquireGoogleLoginSession('CRED_A', factory);

    const [r1, r2] = await Promise.all([first, second]);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(r1).toBe(fixtureSession);
    expect(r2).toBe(fixtureSession);
    expect(isGoogleLoginInFlight()).toBe(false);
  });

  it('clears the in-flight slot on success so a retry re-enters the BE', async () => {
    const factory = vi.fn().mockResolvedValueOnce(fixtureSession);
    await acquireGoogleLoginSession('CRED_B', factory);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(isGoogleLoginInFlight()).toBe(false);

    const factory2 = vi.fn().mockResolvedValueOnce({
      ...fixtureSession,
      token: 'jwt-2',
    });
    const retry = await acquireGoogleLoginSession('CRED_B', factory2);
    expect(factory2).toHaveBeenCalledTimes(1);
    expect(retry.token).toBe('jwt-2');
  });

  it('clears the in-flight slot on failure so a retry re-enters the BE', async () => {
    const factory = vi.fn().mockRejectedValueOnce(new Error('503'));
    await expect(
      acquireGoogleLoginSession('CRED_C', factory),
    ).rejects.toThrow('503');
    expect(isGoogleLoginInFlight()).toBe(false);

    const factory2 = vi.fn().mockResolvedValueOnce(fixtureSession);
    await acquireGoogleLoginSession('CRED_C', factory2);
    expect(factory2).toHaveBeenCalledTimes(1);
  });

  it('runs separate exchanges for different credentials concurrently', async () => {
    const factoryA = vi.fn().mockResolvedValueOnce({
      ...fixtureSession,
      token: 'jwt-A',
    });
    const factoryB = vi.fn().mockResolvedValueOnce({
      ...fixtureSession,
      token: 'jwt-B',
    });

    const [a, b] = await Promise.all([
      acquireGoogleLoginSession('CRED_A', factoryA),
      acquireGoogleLoginSession('CRED_B', factoryB),
    ]);

    expect(factoryA).toHaveBeenCalledTimes(1);
    expect(factoryB).toHaveBeenCalledTimes(1);
    expect(a.token).toBe('jwt-A');
    expect(b.token).toBe('jwt-B');
    expect(getGoogleLoginInflightCount()).toBe(0);
  });

  it('refuses to track an empty credential', async () => {
    const factory = vi.fn();
    await expect(acquireGoogleLoginSession('', factory)).rejects.toThrow();
    expect(factory).not.toHaveBeenCalled();
  });
});
