/**
 * VerifyOtp page — Agent email-verification.
 *
 * Vital coverage for the in-flight dedupe hardening:
 *   - A rapid double-submit does NOT fire `authService.verifyOtp` twice.
 *   - A rapid double-resend does NOT fire `authService.forgotPassword`
 *     twice.
 *   - A 401/403 from the BE is surfaced with the production-not-ready
 *     message instead of leaking the raw axios string.
 *   - The OTP value is NEVER stored in localStorage / sessionStorage.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AxiosError } from 'axios';
import VerifyOtp from '../../../src/pages/ResetPassword/VerifyOtp';

const { verifyOtpMock, forgotPasswordMock, localStore, sessionStore } = vi.hoisted(
  () => {
    const localStore: Record<string, string> = {};
    const sessionStore: Record<string, string> = {};
    const verifyOtpMock = vi.fn();
    const forgotPasswordMock = vi.fn();
    return {
      verifyOtpMock,
      forgotPasswordMock,
      localStore,
      sessionStore,
    };
  },
);

vi.mock('../../../src/services/auth.service', () => ({
  default: {
    verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
    forgotPassword: (...args: unknown[]) => forgotPasswordMock(...args),
    resetPassword: vi.fn(),
  },
  authService: {
    verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
    forgotPassword: (...args: unknown[]) => forgotPasswordMock(...args),
    resetPassword: vi.fn(),
  },
  clearAuthSession: vi.fn(),
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

const renderVerifyOtp = () =>
  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/forgot-password/verify',
          state: { email: 'user@example.com' },
        },
      ]}
    >
      <Routes>
        <Route path="/forgot-password/verify" element={<VerifyOtp />} />
        <Route path="/reset-password" element={<div data-testid="reset-stub" />} />
      </Routes>
    </MemoryRouter>,
  );

const fillOtp = async (code: string) => {
  const user = userEvent.setup();
  for (let i = 0; i < code.length; i++) {
    const input = screen.getByLabelText(`Digit ${i + 1}`);
    await user.type(input, code[i]);
  }
};

beforeEach(() => {
  verifyOtpMock.mockReset();
  forgotPasswordMock.mockReset();
  for (const k of Object.keys(localStore)) delete localStore[k];
  for (const k of Object.keys(sessionStore)) delete sessionStore[k];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VerifyOtp — submit dedupe', () => {
  it('does not fire verifyOtp twice for a rapid double-submit', async () => {
    let resolve!: (v: { resetToken: string }) => void;
    verifyOtpMock.mockImplementationOnce(
      () =>
        new Promise<{ resetToken: string }>((res) => {
          resolve = res;
        }),
    );

    renderVerifyOtp();
    await fillOtp('123456');

    const submit = screen.getByRole('button', { name: /verify/i });
    const user = userEvent.setup();
    // Click twice in a row — the second click MUST be a no-op while the
    // first request is still in flight.
    await user.click(submit);
    await user.click(submit);

    resolve({ resetToken: 'mock-token' });

    await waitFor(() => {
      expect(verifyOtpMock).toHaveBeenCalledTimes(1);
    });
  });

  it('navigates to /reset-password on a successful verify', async () => {
    verifyOtpMock.mockResolvedValueOnce({ resetToken: 'mock-token' });

    renderVerifyOtp();
    await fillOtp('123456');

    const submit = screen.getByRole('button', { name: /verify/i });
    await userEvent.setup().click(submit);

    await waitFor(() => {
      expect(screen.getByTestId('reset-stub')).toBeInTheDocument();
    });
  });

  it('surfaces the production-not-ready message on a 401 from the BE', async () => {
    verifyOtpMock.mockRejectedValueOnce(
      new AxiosError('unauthorized', '401', undefined, undefined, {
        status: 401,
        data: { message: 'Unauthorized' },
      } as never),
    );

    renderVerifyOtp();
    await fillOtp('123456');

    await userEvent.setup().click(screen.getByRole('button', { name: /verify/i }));

    expect(
      await screen.findByText(/password reset is not yet available/i),
    ).toBeInTheDocument();
  });
});

describe('VerifyOtp — resend dedupe', () => {
  it('does not fire forgotPassword twice for a rapid double-resend click', async () => {
    let resolve!: () => void;
    forgotPasswordMock.mockImplementationOnce(
      () => new Promise<void>((res) => {
        resolve = res;
      }),
    );

    renderVerifyOtp();
    const resendBtn = screen.getByRole('button', { name: /resend code/i });
    const user = userEvent.setup();

    await user.click(resendBtn);
    await user.click(resendBtn);

    resolve();

    await waitFor(() => {
      expect(forgotPasswordMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe('VerifyOtp — anti-patterns', () => {
  it('does NOT store the OTP value in localStorage / sessionStorage', async () => {
    verifyOtpMock.mockResolvedValueOnce({ resetToken: 'mock-token' });

    renderVerifyOtp();
    await fillOtp('123456');
    await userEvent.setup().click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => {
      expect(screen.getByTestId('reset-stub')).toBeInTheDocument();
    });

    for (const store of [localStore, sessionStore]) {
      // No OTP / no email is persisted to either bucket.
      const joined = Object.values(store).join('|');
      expect(joined).not.toContain('123456');
      expect(joined).not.toContain('user@example.com');
    }
  });
});
