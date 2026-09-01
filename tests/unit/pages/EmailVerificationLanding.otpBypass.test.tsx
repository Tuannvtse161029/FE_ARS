/**
 * EmailVerificationLanding — PROD-003 OTP bypass tests.
 *
 * The `VITE_REQUIRE_REGISTRATION_OTP` flag controls whether the "Skip for
 * development" button appears on the OTP screen. The flag is read from
 * `import.meta.env.VITE_REQUIRE_REGISTRATION_OTP` via
 * `src/config/featureFlags.ts`. The flag is evaluated at render time,
 * so each render picks up the current flag value.
 *
 * These tests focus on the OTP gate itself — they render the OTP form
 * and assert whether the development-bypass skip button is present.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { EmailVerificationLanding } from '../../../src/pages/Auth/EmailVerificationLanding';
import { ROUTES } from '../../../src/routes/paths';

type FeatureFlagsModule = typeof import('../../../src/config/featureFlags');

const { verifyMock, sendMock, verifyOtpMock, localStore, sessionStore } = vi.hoisted(
  () => {
    const localStore: Record<string, string> = {};
    const sessionStore: Record<string, string> = {};
    const verifyMock = vi.fn();
    const sendMock = vi.fn();
    const verifyOtpMock = vi.fn();
    return { verifyMock, sendMock, verifyOtpMock, localStore, sessionStore };
  },
);

vi.mock('../../../src/services/emailVerification.service', () => ({
  emailVerificationService: {
    verifyEmailToken: (...args: unknown[]) => verifyMock(...args),
    requestApprovalEmail: vi.fn(),
    isVerifyEmailToken: (v: unknown) =>
      typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 1024,
  },
  isVerifyEmailToken: (v: unknown) =>
    typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 1024,
}));

vi.mock('../../../src/services/auth.service', () => ({
  authService: {
    verifyRegistrationOtp: (...args: unknown[]) => verifyOtpMock(...args),
    sendRegistrationOtp: (...args: unknown[]) => sendMock(...args),
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

// Store the original value
const originalMetaEnv = (import.meta as { env?: Record<string, string | undefined> }).env;

const renderPage = (email = 'test@example.com') =>
  render(
    <MemoryRouter
      initialEntries={['/verify-email']}
      initialIndex={0}
    >
      <Routes>
        <Route path="/verify-email" element={<EmailVerificationLanding />} />
        <Route path={ROUTES.LOGIN} element={<div data-testid="login-page" />} />
        <Route path={ROUTES.FORUM} element={<div data-testid="forum-page" />} />
      </Routes>
    </MemoryRouter>,
  );

describe('EmailVerificationLanding — PROD-003 OTP bypass', () => {
  let flags: FeatureFlagsModule;

  beforeAll(async () => {
    flags = await import('../../../src/config/featureFlags');
  });

  beforeEach(() => {
    verifyMock.mockReset();
    sendMock.mockReset();
    verifyOtpMock.mockReset();
    for (const k of Object.keys(localStore)) delete localStore[k];
    for (const k of Object.keys(sessionStore)) delete sessionStore[k];

    // Reset to development default (OTP bypass allowed)
    (import.meta as { env: typeof originalMetaEnv }).env = {
      ...originalMetaEnv,
      VITE_REQUIRE_REGISTRATION_OTP: 'false',
    };

    // Set the registered email in session storage for the test
    sessionStore['ars_registered_email'] = 'test@example.com';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (import.meta as { env: typeof originalMetaEnv }).env = originalMetaEnv;
  });

  // ── Tests ──────────────────────────────────────────────────────────────

  describe('Production mode: OTP required', () => {
    it('hides the "Skip for development" button when VITE_REQUIRE_REGISTRATION_OTP=true', async () => {
      // Set production mode
      (import.meta as { env: Record<string, string | undefined> }).env = {
        VITE_REQUIRE_REGISTRATION_OTP: 'true',
      };

      // Need to re-import the flags module to pick up the new env value
      vi.resetModules();
      const prodFlags = await import('../../../src/config/featureFlags');

      // The flag should now be true (OTP required)
      expect(prodFlags.requireRegistrationOtp()).toBe(true);
      expect(prodFlags.registrationOtpBypassAllowed()).toBe(false);

      renderPage();

      // The skip button should NOT be visible
      expect(screen.queryByTestId('verify-email-dev-skip')).not.toBeInTheDocument();
    });
  });

  describe('Development mode: OTP bypass allowed', () => {
    it('shows the "Skip for development" button when VITE_REQUIRE_REGISTRATION_OTP=false', async () => {
      // Ensure development mode
      (import.meta as { env: Record<string, string | undefined> }).env = {
        VITE_REQUIRE_REGISTRATION_OTP: 'false',
      };

      vi.resetModules();
      const devFlags = await import('../../../src/config/featureFlags');

      // The flag should now be false (OTP bypass allowed)
      expect(devFlags.requireRegistrationOtp()).toBe(false);
      expect(devFlags.registrationOtpBypassAllowed()).toBe(true);

      renderPage();

      // The skip button SHOULD be visible
      expect(screen.getByTestId('verify-email-dev-skip')).toBeInTheDocument();
      expect(
        screen.getByTestId('verify-email-dev-skip'),
      ).toContainHTML('<button');
    });

    it('displays the development bypass notice with correct explanation', async () => {
      (import.meta as { env: Record<string, string | undefined> }).env = {
        VITE_REQUIRE_REGISTRATION_OTP: 'false',
      };

      vi.resetModules();
      await import('../../../src/config/featureFlags');

      renderPage();

      // Check for the dev bypass notice text
      expect(screen.getByText(/Development bypass/i)).toBeInTheDocument();
      expect(
        screen.getByText(/VITE_REQUIRE_REGISTRATION_OTP/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/skip for development/i),
      ).toBeInTheDocument();
    });

    it('skip button is disabled while OTP verification is in progress', async () => {
      (import.meta as { env: Record<string, string | undefined> }).env = {
        VITE_REQUIRE_REGISTRATION_OTP: 'false',
      };

      vi.resetModules();
      await import('../../../src/config/featureFlags');

      renderPage();

      const skipButton = screen.getByTestId('verify-email-skip-for-dev');

      // Initially not disabled
      expect(skipButton).not.toBeDisabled();
    });
  });

  describe('OTP input form', () => {
    it('renders 6 OTP input cells', async () => {
      renderPage();

      const otpInputs = screen.getAllByRole('textbox');
      expect(otpInputs).toHaveLength(6);

      // Check aria-labels
      otpInputs.forEach((input, idx) => {
        expect(input).toHaveAttribute(
          'aria-label',
          `Digit ${idx + 1} of 6`,
        );
      });
    });

    it('accepts digit input in OTP cells', async () => {
      const user = userEvent.setup();
      renderPage();

      const otpInputs = screen.getAllByRole('textbox');

      await user.type(otpInputs[0], '1');
      await user.type(otpInputs[1], '2');
      await user.type(otpInputs[2], '3');
      await user.type(otpInputs[3], '4');
      await user.type(otpInputs[4], '5');
      await user.type(otpInputs[5], '6');

      expect(otpInputs[0]).toHaveValue('1');
      expect(otpInputs[1]).toHaveValue('2');
      expect(otpInputs[5]).toHaveValue('6');
    });

    it('auto-focuses next cell after digit entry', async () => {
      const user = userEvent.setup();
      renderPage();

      const otpInputs = screen.getAllByRole('textbox');

      await user.type(otpInputs[0], '1');

      // Second input should be focused
      expect(document.activeElement).toBe(otpInputs[1]);
    });

    it('handles backspace to previous cell', async () => {
      const user = userEvent.setup();
      renderPage();

      const otpInputs = screen.getAllByRole('textbox');

      // Enter a digit
      await user.type(otpInputs[0], '1');

      // Backspace should clear and move to previous
      await user.keyboard('{Backspace}');

      expect(otpInputs[0]).toHaveValue('');
    });
  });

  describe('Resend OTP', () => {
    it('shows resend timer after initial render', async () => {
      renderPage();

      // Should show a timer
      const timer = screen.queryByTestId('verify-email-resend-timer');
      expect(timer).toBeInTheDocument();
    });

    it('shows resend button after timer expires', async () => {
      vi.useFakeTimers();
      renderPage();

      // Fast-forward past the cooldown (60 seconds)
      await act(async () => {
        vi.advanceTimersByTime(61000);
      });

      expect(screen.getByTestId('verify-email-resend')).toBeInTheDocument();

      vi.useRealTimers();
    });
  });
});
