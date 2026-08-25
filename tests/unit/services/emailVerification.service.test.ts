/**
 * emailVerification.service — Agent email-verification.
 *
 * Vital coverage:
 *   - verifyEmailToken forwards `token` as the `token` query string param
 *     to `POST /api/Auth/verify-email`, exactly per the live Swagger.
 *   - requestApprovalEmail forwards `email` as the `email` query string
 *     param to `POST /api/Auth/send-approval-email`.
 *   - The service NEVER calls /api/Email/send-test, NEVER hardcodes a
 *     recipient, and NEVER writes the token to localStorage /
 *     sessionStorage.
 *   - Malformed input is rejected client-side before the BE round-trip.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emailVerificationService,
  isVerifyEmailToken,
  requestApprovalEmail,
  verifyEmailToken,
} from '../../../src/services/emailVerification.service';
import { API_ENDPOINTS } from '../../../src/utils/constants';

const { postMock, localStore, sessionStore } = vi.hoisted(() => {
  const localStore: Record<string, string> = {};
  const sessionStore: Record<string, string> = {};
  const postMock = vi.fn().mockResolvedValue({ data: {}, status: 200 });
  return { postMock, localStore, sessionStore };
});

vi.mock('../../../src/services/axios', () => ({
  default: {
    post: (...args: unknown[]) => postMock(...args),
    defaults: { headers: { common: {} as Record<string, unknown> } },
  },
}));

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn((k: string) => localStore[k] ?? null),
    setItem: vi.fn((k: string, v: string) => {
      localStore[k] = v;
    }),
    removeItem: vi.fn((k: string) => {
      delete localStore[k];
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(localStore)) delete localStore[k];
    }),
  },
  writable: true,
  configurable: true,
});
Object.defineProperty(global, 'sessionStorage', {
  value: {
    getItem: vi.fn((k: string) => sessionStore[k] ?? null),
    setItem: vi.fn((k: string, v: string) => {
      sessionStore[k] = v;
    }),
    removeItem: vi.fn((k: string) => {
      delete sessionStore[k];
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(sessionStore)) delete sessionStore[k];
    }),
  },
  writable: true,
  configurable: true,
});

beforeEach(() => {
  postMock.mockReset();
  postMock.mockResolvedValue({ data: {}, status: 200 });
  for (const k of Object.keys(localStore)) delete localStore[k];
  for (const k of Object.keys(sessionStore)) delete sessionStore[k];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isVerifyEmailToken', () => {
  it('accepts a normal opaque token', () => {
    expect(isVerifyEmailToken('abc.def-ghi_123')).toBe(true);
  });

  it('rejects empty / whitespace-only input', () => {
    expect(isVerifyEmailToken('')).toBe(false);
    expect(isVerifyEmailToken('   ')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isVerifyEmailToken(undefined)).toBe(false);
    expect(isVerifyEmailToken(null)).toBe(false);
    expect(isVerifyEmailToken(42)).toBe(false);
  });

  it('rejects excessively long input', () => {
    expect(isVerifyEmailToken('a'.repeat(1025))).toBe(false);
  });

  it('rejects tokens containing control chars or whitespace', () => {
    expect(isVerifyEmailToken('abc\ndef')).toBe(false);
    expect(isVerifyEmailToken('abc def')).toBe(false);
    expect(isVerifyEmailToken('abc\tdef')).toBe(false);
  });
});

describe('verifyEmailToken', () => {
  it('POSTs /api/Auth/verify-email with token as a query param', async () => {
    await verifyEmailToken('opaque-token-123');

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, body, config] = postMock.mock.calls[0];
    expect(url).toBe(API_ENDPOINTS.AUTH.VERIFY_EMAIL);
    expect(body).toBeNull();
    expect(config).toEqual({ params: { token: 'opaque-token-123' } });
  });

  it('throws on malformed input BEFORE calling the BE', async () => {
    await expect(verifyEmailToken('')).rejects.toThrow(
      'Invalid verification token',
    );
    expect(postMock).not.toHaveBeenCalled();
  });

  it('does NOT store the token in localStorage / sessionStorage', async () => {
    await verifyEmailToken('opaque-token-xyz');
    for (const store of [localStore, sessionStore]) {
      expect(Object.keys(store)).toEqual([]);
    }
  });

  it('does NOT call /api/Email/send-test', async () => {
    await verifyEmailToken('opaque-token-xyz');
    const allUrls = postMock.mock.calls.map((c) => c[0]);
    expect(allUrls).not.toContain('/api/Email/send-test');
    expect(
      allUrls.some((u: unknown) => typeof u === 'string' && u.includes('send-test')),
    ).toBe(false);
  });

  it('returns { success: true } on a 200 response', async () => {
    postMock.mockResolvedValueOnce({ data: {}, status: 200 });
    const result = await verifyEmailToken('opaque-token-xyz');
    expect(result).toEqual({ success: true });
  });

  it('propagates BE errors so callers can render a fallback message', async () => {
    const err = new Error('Invalid or expired token');
    postMock.mockRejectedValueOnce(err);
    await expect(verifyEmailToken('opaque-token-xyz')).rejects.toBe(err);
  });
});

describe('requestApprovalEmail', () => {
  it('POSTs /api/Auth/send-approval-email with email as a query param', async () => {
    await requestApprovalEmail({ email: 'admin@ars.com' });

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, body, config] = postMock.mock.calls[0];
    expect(url).toBe(API_ENDPOINTS.AUTH.SEND_APPROVAL_EMAIL);
    expect(body).toBeNull();
    expect(config).toEqual({ params: { email: 'admin@ars.com' } });
  });

  it('trims surrounding whitespace before sending', async () => {
    await requestApprovalEmail({ email: '  admin@ars.com  ' });
    const [, , config] = postMock.mock.calls[0];
    expect(config).toEqual({ params: { email: 'admin@ars.com' } });
  });

  it('rejects empty email without calling the BE', async () => {
    await expect(requestApprovalEmail({ email: '' })).rejects.toThrow(
      'Email is required',
    );
    expect(postMock).not.toHaveBeenCalled();
  });

  it('does NOT hardcode a development recipient', async () => {
    const sourceCode = emailVerificationService.requestApprovalEmail.toString();
    // No hardcoded admin / personal addresses allowed.
    expect(/duyphuong|@gmail\.com|@yahoo\.com|@example\.dev/.test(sourceCode)).toBe(
      false,
    );
  });

  it('does NOT call /api/Email/send-test', async () => {
    await requestApprovalEmail({ email: 'admin@ars.com' });
    const allUrls = postMock.mock.calls.map((c) => c[0]);
    expect(
      allUrls.some((u: unknown) => typeof u === 'string' && u.includes('send-test')),
    ).toBe(false);
  });
});

describe('emailVerificationService namespace', () => {
  it('exposes the documented surface only', () => {
    expect(Object.keys(emailVerificationService).sort()).toEqual([
      'isVerifyEmailToken',
      'requestApprovalEmail',
      'verifyEmailToken',
    ]);
  });
});
