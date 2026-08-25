/**
 * useEmailVerification hook — Agent email-verification.
 *
 * Vital coverage:
 *   - First verify(token) call hits the BE exactly once.
 *   - A second verify() call with the same token while the first is in-
 *     flight is deduped (no second network request).
 *   - Errors map to stable status codes ('expired', 'invalid_token',
 *     'network_error', 'server_error').
 *   - The hook never stores the token in localStorage / sessionStorage.
 *   - The hook's `reset` clears state so the page can re-attempt.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { AxiosError } from 'axios';
import { useEmailVerification } from '../../../src/hooks/useEmailVerification';

const { verifyMock, localStore, sessionStore } = vi.hoisted(() => {
  const localStore: Record<string, string> = {};
  const sessionStore: Record<string, string> = {};
  const verifyMock = vi.fn();
  return { verifyMock, localStore, sessionStore };
});

vi.mock('../../../src/services/emailVerification.service', () => ({
  emailVerificationService: {
    verifyEmailToken: (...args: unknown[]) => verifyMock(...args),
    requestApprovalEmail: vi.fn(),
    isVerifyEmailToken: (v: unknown) =>
      typeof v === 'string' &&
      v.trim().length > 0 &&
      v.trim().length <= 1024 &&
      !/[\u0000-\u001f\s]/.test(v.trim()),
  },
  isVerifyEmailToken: (v: unknown) =>
    typeof v === 'string' &&
    v.trim().length > 0 &&
    v.trim().length <= 1024 &&
    !/[\u0000-\u001f\s]/.test(v.trim()),
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
  verifyMock.mockReset();
  for (const k of Object.keys(localStore)) delete localStore[k];
  for (const k of Object.keys(sessionStore)) delete sessionStore[k];
});

afterEach(() => {
  vi.restoreAllMocks();
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('useEmailVerification — happy path', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useEmailVerification());
    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.isVerifying).toBe(false);
    expect(result.current.state.hasAttempted).toBe(false);
  });

  it('calls verifyEmailToken exactly once on a successful verify()', async () => {
    verifyMock.mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useEmailVerification());

    await act(async () => {
      await result.current.verify('opaque-token');
      await flushPromises();
    });

    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledWith('opaque-token');
    expect(result.current.state.status).toBe('verified');
    expect(result.current.state.isVerifying).toBe(false);
    expect(result.current.state.hasAttempted).toBe(true);
    expect(result.current.state.errorMessage).toBeNull();
  });

  it('does NOT store the token in localStorage / sessionStorage', async () => {
    verifyMock.mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useEmailVerification());

    await act(async () => {
      await result.current.verify('opaque-token');
      await flushPromises();
    });

    for (const store of [localStore, sessionStore]) {
      expect(Object.keys(store)).toEqual([]);
    }
  });
});

describe('useEmailVerification — in-flight dedupe', () => {
  it('drops a second concurrent verify() with the same token', async () => {
    let resolve!: (value: { success: true }) => void;
    verifyMock.mockImplementationOnce(
      () =>
        new Promise<{ success: true }>((res) => {
          resolve = res;
        }),
    );

    const { result } = renderHook(() => useEmailVerification());

    let firstPromise: Promise<unknown> | undefined;
    act(() => {
      firstPromise = result.current.verify('opaque-token');
    });
    act(() => {
      void result.current.verify('opaque-token');
    });

    await act(async () => {
      resolve({ success: true });
      await firstPromise;
      await flushPromises();
    });

    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe('verified');
  });
});

describe('useEmailVerification — error classification', () => {
  it('maps 400 to expired', async () => {
    verifyMock.mockRejectedValueOnce(
      new AxiosError('expired', '400', undefined, undefined, {
        status: 400,
        data: { message: 'Token expired' },
      } as never),
    );
    const { result } = renderHook(() => useEmailVerification());

    await act(async () => {
      await result.current.verify('opaque-token');
      await flushPromises();
    });

    expect(result.current.state.status).toBe('expired');
    expect(result.current.state.errorMessage).toContain('Token expired');
  });

  it('maps 401/403 to invalid_token', async () => {
    verifyMock.mockRejectedValueOnce(
      new AxiosError('unauthorized', '401', undefined, undefined, {
        status: 401,
        data: { message: 'Unauthorized' },
      } as never),
    );
    const { result } = renderHook(() => useEmailVerification());

    await act(async () => {
      await result.current.verify('opaque-token');
      await flushPromises();
    });

    expect(result.current.state.status).toBe('invalid_token');
  });

  it('maps 5xx to server_error', async () => {
    verifyMock.mockRejectedValueOnce(
      new AxiosError('server', '500', undefined, undefined, {
        status: 500,
        data: { message: 'Oops' },
      } as never),
    );
    const { result } = renderHook(() => useEmailVerification());

    await act(async () => {
      await result.current.verify('opaque-token');
      await flushPromises();
    });

    expect(result.current.state.status).toBe('server_error');
  });

  it('maps a no-response error (network) to network_error', async () => {
    verifyMock.mockRejectedValueOnce(
      new AxiosError('no response', 'ERR_NETWORK'),
    );
    const { result } = renderHook(() => useEmailVerification());

    await act(async () => {
      await result.current.verify('opaque-token');
      await flushPromises();
    });

    expect(result.current.state.status).toBe('network_error');
  });

  it('rejects malformed tokens client-side (never hits the BE)', async () => {
    const { result } = renderHook(() => useEmailVerification());

    await act(async () => {
      await result.current.verify('   ');
      await flushPromises();
    });

    expect(verifyMock).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe('invalid_token');
  });
});

describe('useEmailVerification — reset', () => {
  it('clears state when reset() is called', async () => {
    verifyMock.mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useEmailVerification());

    await act(async () => {
      await result.current.verify('opaque-token');
      await flushPromises();
    });
    expect(result.current.state.status).toBe('verified');

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.hasAttempted).toBe(false);
    expect(result.current.state.errorMessage).toBeNull();
  });
});
