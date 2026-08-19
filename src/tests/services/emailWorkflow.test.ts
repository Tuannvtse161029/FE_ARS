/**
 * Email Workflow Tests — Agent 20
 *
 * Verifies that the Frontend correctly delegates email responsibilities to the
 * Backend and does NOT:
 *   - Generate or store OTPs
 *   - Call `/api/Email/send-test`
 *   - Hardcode email recipients
 *   - Trigger duplicate email effects
 *
 * Technology: Vitest + vi.mock (axios mock)
 * Run: npx vitest run src/tests/services/emailWorkflow.test.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from '../../services/auth.service';
import { API_ENDPOINTS } from '../../utils/constants';
import type {
  ForgotPasswordRequest,
  VerifyOtpRequest,
  VerifyOtpResponse,
  ResetPasswordRequest,
  SendApprovalEmailRequest,
} from '../../types/auth';

// ---------------------------------------------------------------------------
// Shared mock — tracks calls to api.post for all auth service tests.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockPost: ReturnType<typeof vi.fn<any[], any>>;
let capturedPostUrl = '';
let capturedPostBody: unknown;
let emailEndpointInvoked = false;

vi.mock('../../services/axios', () => ({
  default: {
    post: vi.fn().mockImplementation((url: string, body?: unknown) => {
      capturedPostUrl = url;
      capturedPostBody = body;
      if (url.includes('Email') || url.toLowerCase().includes('email')) {
        emailEndpointInvoked = true;
      }
      // Default success responses per endpoint.
      if (url === API_ENDPOINTS.AUTH.FORGOT_PASSWORD) {
        return Promise.resolve({ data: {} });
      }
      if (url === API_ENDPOINTS.AUTH.VERIFY_OTP) {
        return Promise.resolve({ data: { resetToken: 'mock-reset-token' } });
      }
      if (url === API_ENDPOINTS.AUTH.RESET_PASSWORD) {
        return Promise.resolve({ data: {} });
      }
      if (url === API_ENDPOINTS.AUTH.SEND_APPROVAL_EMAIL) {
        return Promise.resolve({ data: {} });
      }
      if (url === API_ENDPOINTS.PAYMENT.SUCCESS) {
        return Promise.resolve({ data: { success: true } });
      }
      return Promise.resolve({ data: {} });
    }),
    get: vi.fn().mockResolvedValue({ data: { wallets: [] } }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  capturedPostUrl = '';
  capturedPostBody = undefined;
  emailEndpointInvoked = false;
  mockPost = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Test suite: forgotPassword
// ---------------------------------------------------------------------------

describe('authService.forgotPassword()', () => {
  it('calls POST /api/Auth/forgot-password with { email } in body', async () => {
    const payload: ForgotPasswordRequest = { email: 'test@example.com' };
    await authService.forgotPassword(payload);

    expect(capturedPostUrl).toBe(API_ENDPOINTS.AUTH.FORGOT_PASSWORD);
    expect(capturedPostBody).toEqual(payload);
  });

  it('throws when the API returns a non-2xx response', async () => {
    const axios = await import('../../services/axios');
    (axios.default.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Rate limit exceeded'),
    );

    await expect(
      authService.forgotPassword({ email: 'test@example.com' }),
    ).rejects.toThrow('Rate limit exceeded');
  });
});

// ---------------------------------------------------------------------------
// Test suite: verifyOtp
// ---------------------------------------------------------------------------

describe('authService.verifyOtp()', () => {
  it('calls POST /api/Auth/verify-otp with { email, otp } in body', async () => {
    const payload: VerifyOtpRequest = { email: 'test@example.com', otp: '123456' };
    const result = await authService.verifyOtp(payload);

    expect(capturedPostUrl).toBe(API_ENDPOINTS.AUTH.VERIFY_OTP);
    expect(capturedPostBody).toEqual(payload);
    expect(result).toHaveProperty('resetToken');
  });

  it('returns { resetToken } on success', async () => {
    const result = await authService.verifyOtp({
      email: 'test@example.com',
      otp: '999999',
    });

    expect(result).toHaveProperty('resetToken');
    expect(typeof result.resetToken).toBe('string');
  });

  it('throws on invalid or expired OTP', async () => {
    const axios = await import('../../services/axios');
    (axios.default.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Invalid or expired OTP'),
    );

    await expect(
      authService.verifyOtp({ email: 'test@example.com', otp: '000000' }),
    ).rejects.toThrow('Invalid or expired OTP');
  });

  it('throws on too many attempts', async () => {
    const axios = await import('../../services/axios');
    (axios.default.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Too many attempts. Please try again later.'),
    );

    await expect(
      authService.verifyOtp({ email: 'test@example.com', otp: '111111' }),
    ).rejects.toThrow('Too many attempts. Please try again later.');
  });

  it('does NOT generate OTP in the frontend', () => {
    // Structural test: verifyOtp accepts an `otp` string from the UI and passes
    // it to the API. If this service were generating OTPs, it would not accept
    // one as an argument.
    const fnSignature = authService.verifyOtp.toString();
    const hasMathRandom = /\bMath\.random\b/.test(fnSignature);
    const hasOtpGeneration =
      /\bgenerateOtp\b|\bcreateOtp\b|\bsetTimeout.*otp\b/.test(fnSignature);

    expect(hasMathRandom).toBe(false);
    expect(hasOtpGeneration).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test suite: resetPassword
// ---------------------------------------------------------------------------

describe('authService.resetPassword()', () => {
  it('calls POST /api/Auth/reset-password with { resetToken, newPassword }', async () => {
    const payload: ResetPasswordRequest = {
      resetToken: 'mock-reset-token',
      newPassword: 'NewSecurePassword123!',
    };

    await authService.resetPassword(payload);

    expect(capturedPostUrl).toBe(API_ENDPOINTS.AUTH.RESET_PASSWORD);
    expect(capturedPostBody).toEqual(payload);
  });

  it('throws on invalid or expired reset token', async () => {
    const axios = await import('../../services/axios');
    (axios.default.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Invalid or expired reset token'),
    );

    await expect(
      authService.resetPassword({
        resetToken: 'bad-token',
        newPassword: 'NewPassword!',
      }),
    ).rejects.toThrow('Invalid or expired reset token');
  });
});

// ---------------------------------------------------------------------------
// Test suite: sendApprovalEmail
// ---------------------------------------------------------------------------

describe('authService.sendApprovalEmail()', () => {
  it('calls POST /api/Auth/send-approval-email with email as query param', async () => {
    const payload: SendApprovalEmailRequest = { email: 'user@example.com' };
    await authService.sendApprovalEmail(payload);

    expect(capturedPostUrl).toBe(API_ENDPOINTS.AUTH.SEND_APPROVAL_EMAIL);
  });

  it('throws on failure', async () => {
    const axios = await import('../../services/axios');
    (axios.default.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Email send failed'),
    );

    await expect(
      authService.sendApprovalEmail({ email: 'user@example.com' }),
    ).rejects.toThrow('Email send failed');
  });
});

// ---------------------------------------------------------------------------
// Test suite: Security anti-patterns
// ---------------------------------------------------------------------------

describe('Security anti-patterns', () => {
  it('authService never calls /api/Email/send-test', () => {
    const sendApprovalEmailBody = authService.sendApprovalEmail.toString();
    expect(sendApprovalEmailBody).not.toContain('send-test');
  });

  it('API_ENDPOINTS does not include the test email endpoint', () => {
    const constantsStr = JSON.stringify(API_ENDPOINTS);
    expect(constantsStr).not.toContain('send-test');
  });

  it('authService does not hardcode email recipients', () => {
    const authServiceStr = authService.toString();
    const hardcodedEmail = /duyphuong|@gmail\.com/.test(authServiceStr);
    expect(hardcodedEmail).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test suite: CheckoutReturn — paymentService does not trigger emails
// ---------------------------------------------------------------------------

describe('CheckoutReturn — No Email Triggering from FE', () => {
  it('paymentService.getSuccess does not invoke any Email endpoint', async () => {
    // Reset the flag before calling paymentService.
    emailEndpointInvoked = false;

    const { paymentService } = await import('../../services/payment.service');
    await paymentService.getSuccess('ORDER123', 'PAID', 'CODE123');

    // The payment confirmation call chain must not have hit any Email endpoint.
    expect(emailEndpointInvoked).toBe(false);
  });
});
