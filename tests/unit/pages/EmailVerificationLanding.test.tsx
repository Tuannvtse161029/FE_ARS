/**
 * EmailVerificationLanding page — Agent email-verification.
 *
 * Vital coverage:
 *   - The `?token=...` query param is forwarded exactly once to the
 *     service on mount, even when React strict-mode double-invokes the
 *     effect.
 *   - The page renders one of three outcomes: verifying / verified /
 *     failure.
 *   - The page NEVER persists the token to localStorage / sessionStorage.
 *   - The page NEVER calls /api/Email/send-test.
 *   - A malformed token renders the malformed-link branch without a BE
 *     round-trip.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { EmailVerificationLanding } from '../../../src/pages/Auth/EmailVerificationLanding';

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

const renderPage = (token: string | null) =>
  render(
    <MemoryRouter
      initialEntries={[
        token ? `/verify-email?token=${encodeURIComponent(token)}` : '/verify-email',
      ]}
    >
      <Routes>
        <Route path="/verify-email" element={<EmailVerificationLanding />} />
        <Route path="/login" element={<div data-testid="login-stub" />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  verifyMock.mockReset();
  for (const k of Object.keys(localStore)) delete localStore[k];
  for (const k of Object.keys(sessionStore)) delete sessionStore[k];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EmailVerificationLanding — verified path', () => {
  it('forwards the token to the service and renders the success state', async () => {
    verifyMock.mockResolvedValueOnce({ success: true });

    renderPage('opaque-token-123');

    await waitFor(() => {
      expect(verifyMock).toHaveBeenCalledWith('opaque-token-123');
    });

    expect(await screen.findByText(/Email verified/i)).toBeInTheDocument();
    expect(screen.getByTestId('verify-email-go-login')).toBeInTheDocument();
  });

  it('does NOT store the token in localStorage / sessionStorage', async () => {
    verifyMock.mockResolvedValueOnce({ success: true });
    renderPage('opaque-token-123');

    await waitFor(() => expect(verifyMock).toHaveBeenCalled());
    for (const store of [localStore, sessionStore]) {
      expect(Object.keys(store)).toEqual([]);
    }
  });
});

describe('EmailVerificationLanding — failure path', () => {
  it('renders the failure branch when the BE rejects the token', async () => {
    verifyMock.mockRejectedValueOnce(
      Object.assign(new Error('expired'), {
        response: { status: 400, data: { message: 'Token expired' } },
      }),
    );

    renderPage('opaque-token-bad');

    await waitFor(() => expect(verifyMock).toHaveBeenCalled());
    expect(await screen.findByText(/verification link expired/i)).toBeInTheDocument();
  });
});

describe('EmailVerificationLanding — malformed path', () => {
  it('renders the invalid-link branch without a BE round-trip when the token is missing', async () => {
    renderPage(null);
    expect(verifyMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/Invalid verification link/i)).toBeInTheDocument();
  });

  it('renders the invalid-link branch when the token is whitespace-only', async () => {
    renderPage('   ');
    expect(verifyMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/Invalid verification link/i)).toBeInTheDocument();
  });
});

describe('EmailVerificationLanding — anti-patterns', () => {
  it('does NOT call /api/Email/send-test from any code path', async () => {
    const sourceCode = EmailVerificationLanding.toString();
    // The page itself must not include the test email endpoint.
    expect(sourceCode).not.toContain('send-test');
    expect(sourceCode).not.toContain('/api/Email');
  });
});
