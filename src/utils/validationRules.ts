// Shared client-side validation rules + error-mapping helpers used by the
// high-priority FE forms. The BE remains the source of truth for every check;
// this module ONLY mirrors a permissive subset so the user gets immediate
// feedback before the round-trip. Do NOT add server-only rules here.
//
// Why a separate file:
//   - `src/utils/validation.ts` is owned by the auth-flow schemas and is
//     READ-ONLY for this audit. New helpers that are reused by non-auth forms
//     (Profile, publication submissions, Guidance Project, Research Group / Topic / Learning
//     Material / Member, Earnings Wallet withdrawal, etc.) live here so we
//     don't touch the auth schemas.
//   - Keeping the rules pure-function (no React) means we can reuse them in
//     vitest without rendering the tree.

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^[+\d\s\-()]{8,20}$/;
// Password policy mirrors `registerSchema` and `resetPasswordSchema`:
// 8+ chars, ≥1 uppercase, ≥1 digit. We intentionally do NOT require a
// symbol here — the auth schemas are the contract.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_HAS_UPPER = /[A-Z]/;
export const PASSWORD_HAS_NUMBER = /[0-9]/;
// Vietnamese / Latin display names: Unicode letters, spaces, apostrophes,
// hyphens, periods (e.g. "Nguyễn Văn A", "Dr. O'Connor-Smith"). Numbers and
// other punctuation are rejected.
export const VIETNAMESE_NAME_REGEX = /^[\p{L}][\p{L}\s'’\-.]*$/u;
export const VIETNAMESE_NAME_MIN = 2;
export const VIETNAMESE_NAME_MAX = 100;
// OTP is exactly 6 ASCII digits. The verify screen already strips non-digits
// from each cell, but the rule is documented here so the server-error mapper
// can normalise "Code must be exactly 6 digits".
export const OTP_REGEX = /^\d{6}$/;
export const OTP_LENGTH = 6;
// Paper / learning-material URL must be a parseable absolute URL with a known
// scheme. The actual upload is gated by the PDF dropzone, but the inline form
// lets the user paste a Firebase Storage URL.
export const SAFE_URL_REGEX = /^https?:\/\/\S+$/i;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const ACCEPT_FILE_MIME = 'application/pdf';

export interface PasswordPolicyResult {
  ok: boolean;
  errors: string[];
}

/**
 * Apply the project's password policy (8+ chars, ≥1 uppercase, ≥1 digit). The
 * function is shared by the inline register form, reset-password form, and any
 * other place that needs the same shape.
 */
export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  const errors: string[] = [];
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!PASSWORD_HAS_UPPER.test(password ?? '')) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!PASSWORD_HAS_NUMBER.test(password ?? '')) {
    errors.push('Password must contain at least one number');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Validate a Vietnamese / Latin display name. Returns null when valid, or a
 * short user-facing message describing the first violation.
 */
export function validateVietnameseName(raw: string | undefined | null): string | null {
  const value = (raw ?? '').trim();
  if (value.length === 0) return 'Full name is required';
  if (value.length < VIETNAMESE_NAME_MIN) {
    return `Full name must be at least ${VIETNAMESE_NAME_MIN} characters`;
  }
  if (value.length > VIETNAMESE_NAME_MAX) {
    return `Full name must be at most ${VIETNAMESE_NAME_MAX} characters`;
  }
  if (!VIETNAMESE_NAME_REGEX.test(value)) {
    return 'Use letters, spaces, apostrophes, hyphens, or periods only';
  }
  return null;
}

export function validateEmail(raw: string | undefined | null): string | null {
  const value = (raw ?? '').trim();
  if (value.length === 0) return 'Email is required';
  if (!value.includes('@')) return 'Email must contain @';
  if (!EMAIL_REGEX.test(value)) return 'Invalid email format (e.g. user@example.com)';
  return null;
}

export function validatePhoneNumber(raw: string | undefined | null): string | null {
  const value = (raw ?? '').trim();
  if (value.length === 0) return 'Phone number is required';
  const cleanDigits = value.replace(/[\s\-()]/g, '');
  if (!cleanDigits.startsWith('0')) {
    return 'Phone number must start with 0';
  }
  if (!/^0\d{8,10}$/.test(cleanDigits)) {
    return 'Phone number must start with 0 and contain 9–11 digits';
  }
  return null;
}

export function validatePassword(password: string | undefined | null): string | null {
  const value = password ?? '';
  if (value.length === 0) return 'Password is required';
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (!PASSWORD_HAS_UPPER.test(value)) {
    return 'Password must contain at least 1 uppercase letter';
  }
  if (!PASSWORD_HAS_NUMBER.test(value)) {
    return 'Password must contain at least 1 number';
  }
  return null;
}

export function validateOtp(raw: string | undefined | null): string | null {
  const value = (raw ?? '').replace(/\D/g, '');
  if (value.length === 0) return 'Verification code is required';
  if (value.length !== OTP_LENGTH) return `Code must be exactly ${OTP_LENGTH} digits`;
  return null;
}

export interface FileValidationResult {
  ok: boolean;
  message: string | null;
}

/**
 * Validate a user-uploaded PDF. Mirrors the contract enforced by the existing
 * dropzones but is pure so other surfaces (paper upload, learning material)
 * can reuse the rule without re-deriving it.
 */
export function validatePdfFile(file: File | null | undefined): FileValidationResult {
  if (!file) return { ok: false, message: 'Please attach a PDF before continuing.' };
  if (file.type !== ACCEPT_FILE_MIME) {
    return { ok: false, message: 'Only PDF files are accepted.' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, message: 'File exceeds the 10 MB limit.' };
  }
  return { ok: true, message: null };
}

/**
 * Validate a pasted URL (Firebase Storage or other HTTPS link).
 */
export function validateHttpsUrl(raw: string | undefined | null): string | null {
  const value = (raw ?? '').trim();
  if (value.length === 0) return 'URL is required';
  if (!SAFE_URL_REGEX.test(value)) {
    return 'URL must start with http:// or https://';
  }
  return null;
}

/**
 * Validate a non-negative integer (subFieldId, milestoneId, etc.).
 */
export function validatePositiveInteger(
  raw: string | number | undefined | null,
): string | null {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return 'Enter a non-negative whole number';
  }
  return null;
}

/**
 * Walk a server error object and extract a `{ fieldName: message }` map. The
 * function is intentionally permissive — if the BE payload does not match the
 * expected shape we return an empty map so the caller can fall back to the
 * generic `formError` banner. This avoids blocking forms on BE contract
 * drift.
 */
export function extractServerFieldErrors(
  err: unknown,
  knownFields: ReadonlyArray<string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!err || typeof err !== 'object') return out;
  const maybeAxios = err as {
    response?: { data?: unknown };
    data?: unknown;
  };
  const payload = maybeAxios.response?.data ?? maybeAxios.data;
  if (!payload || typeof payload !== 'object') return out;

  const p = payload as Record<string, unknown>;
  // Convention 1: `{ errors: { fieldName: "msg" } }`
  if (p.errors && typeof p.errors === 'object') {
    const inner = p.errors as Record<string, unknown>;
    for (const field of knownFields) {
      const value = inner[field];
      if (typeof value === 'string' && value.trim().length > 0) {
        out[field] = value;
      } else if (Array.isArray(value)) {
        const first = value.find((v) => typeof v === 'string');
        if (typeof first === 'string') out[field] = first;
      }
    }
  }
  // Convention 2: `{ fieldErrors: [{ field, message }] }`
  if (Array.isArray(p.fieldErrors)) {
    for (const item of p.fieldErrors) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      const field = typeof entry.field === 'string' ? entry.field : null;
      const message = typeof entry.message === 'string' ? entry.message : null;
      if (field && message && knownFields.includes(field)) {
        out[field] = message;
      }
    }
  }
  // Convention 3: `{ ValidationErrors: { fieldName: ["msg1", ...] } }` (ASP.NET style).
  if (p.ValidationErrors && typeof p.ValidationErrors === 'object') {
    const inner = p.ValidationErrors as Record<string, unknown>;
    for (const field of knownFields) {
      const value = inner[field];
      if (Array.isArray(value)) {
        const first = value.find((v) => typeof v === 'string');
        if (typeof first === 'string') out[field] = first;
      } else if (typeof value === 'string') {
        out[field] = value;
      }
    }
  }
  return out;
}

/**
 * Extract a human-friendly error string for top-of-form display. Falls back
 * to a generic message when the BE shape is unknown.
 */
export function extractServerMessage(
  err: unknown,
  fallback = 'The server rejected the request. Please try again.',
): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object') {
    const maybeAxios = err as {
      response?: { data?: { message?: unknown; title?: unknown } };
      message?: unknown;
    };
    const data = maybeAxios.response?.data;
    if (data && typeof data === 'object') {
      const m = (data as Record<string, unknown>).message;
      if (typeof m === 'string' && m.trim().length > 0) return m;
      const t = (data as Record<string, unknown>).title;
      if (typeof t === 'string' && t.trim().length > 0) return t;
    }
    if (typeof maybeAxios.message === 'string') return maybeAxios.message;
  }
  return fallback;
}
