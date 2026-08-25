/**
 * Vital tests for src/utils/validationRules.ts — shared client-side helpers.
 *
 * These cover only the high-priority forms audited by agent-form-validation-audit:
 *   - Vietnamese / Latin display-name validation (Register, Profile)
 *   - Password policy (Register, Reset Password)
 *   - 6-digit OTP validation (Verify OTP)
 *   - Paper/PDF file validation (Papers upload)
 *   - Server field-error mapping (any form that calls BE)
 *
 * The BE remains the source of truth for all checks; these tests only verify
 * the FE helper surface.
 */
import { describe, test, expect } from 'vitest';
import {
  checkPasswordPolicy,
  extractServerFieldErrors,
  extractServerMessage,
  OTP_LENGTH,
  OTP_REGEX,
  validateEmail,
  validateHttpsUrl,
  validateOtp,
  validatePdfFile,
  validatePositiveInteger,
  validateVietnameseName,
  VIETNAMESE_NAME_REGEX,
} from '../../../src/utils/validationRules';

describe('validateVietnameseName', () => {
  test('accepts a plain Vietnamese display name', () => {
    expect(validateVietnameseName('Nguyễn Văn A')).toBeNull();
  });

  test('accepts compound names with apostrophes, hyphens, and periods', () => {
    expect(validateVietnameseName("Dr. O'Connor-Smith")).toBeNull();
    expect(validateVietnameseName('Trần Thị B')).toBeNull();
  });

  test('rejects empty / whitespace-only names', () => {
    expect(validateVietnameseName('')).toMatch(/required/i);
    expect(validateVietnameseName('   ')).toMatch(/required/i);
  });

  test('rejects names that include digits', () => {
    expect(validateVietnameseName('Nguyen123')).toMatch(/letters/i);
  });

  test('rejects names that include unsupported punctuation', () => {
    expect(validateVietnameseName('Nguyen@Van')).toMatch(/letters/i);
  });

  test('rejects names shorter than the minimum length', () => {
    expect(validateVietnameseName('A')).toMatch(/at least/i);
  });

  test('handles null / undefined safely', () => {
    expect(validateVietnameseName(null)).toMatch(/required/i);
    expect(validateVietnameseName(undefined)).toMatch(/required/i);
  });

  test('regex anchors at start and end (no partial matches)', () => {
    expect(VIETNAMESE_NAME_REGEX.test('A1')).toBe(false);
    expect(VIETNAMESE_NAME_REGEX.test('1A')).toBe(false);
  });
});

describe('checkPasswordPolicy', () => {
  test('accepts a password that satisfies 8+ chars, upper, and digit', () => {
    expect(checkPasswordPolicy('Password123')).toEqual({ ok: true, errors: [] });
  });

  test('rejects passwords shorter than 8 characters', () => {
    const result = checkPasswordPolicy('Abc123');
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /8 characters/i.test(e))).toBe(true);
  });

  test('rejects passwords without an uppercase letter', () => {
    const result = checkPasswordPolicy('password123');
    expect(result.errors.some((e) => /uppercase/i.test(e))).toBe(true);
  });

  test('rejects passwords without a digit', () => {
    const result = checkPasswordPolicy('PasswordAbc');
    expect(result.errors.some((e) => /number/i.test(e))).toBe(true);
  });

  test('reports all failures together', () => {
    const result = checkPasswordPolicy('short');
    expect(result.errors.length).toBe(3);
  });
});

describe('validateOtp', () => {
  test('accepts exactly 6 digits', () => {
    expect(validateOtp('123456')).toBeNull();
    expect(OTP_REGEX.test('123456')).toBe(true);
  });

  test('rejects fewer than 6 digits', () => {
    expect(validateOtp('12345')).toMatch(/exactly 6/i);
  });

  test('rejects more than 6 digits', () => {
    expect(validateOtp('1234567')).toMatch(/exactly 6/i);
  });

  test('rejects non-numeric input', () => {
    expect(validateOtp('12345a')).toMatch(/exactly 6/i);
  });

  test('rejects empty input', () => {
    expect(validateOtp('')).toMatch(/required/i);
  });

  test('exposes the canonical OTP length', () => {
    expect(OTP_LENGTH).toBe(6);
  });
});

describe('validateEmail', () => {
  test('accepts a well-formed email', () => {
    expect(validateEmail('user@example.com')).toBeNull();
  });

  test('rejects emails without an @ sign', () => {
    expect(validateEmail('user.example.com')).toMatch(/invalid email/i);
  });

  test('rejects empty input', () => {
    expect(validateEmail('')).toMatch(/required/i);
  });
});

describe('validatePdfFile', () => {
  function file(name: string, type: string, size: number): File {
    return new File([new Uint8Array(size)], name, { type });
  }

  test('rejects when file is missing', () => {
    expect(validatePdfFile(null).ok).toBe(false);
    expect(validatePdfFile(undefined).ok).toBe(false);
  });

  test('rejects non-PDF mime types', () => {
    const f = file('doc.txt', 'text/plain', 1024);
    expect(validatePdfFile(f).ok).toBe(false);
  });

  test('rejects PDFs over 10 MB', () => {
    const f = file('big.pdf', 'application/pdf', 11 * 1024 * 1024);
    expect(validatePdfFile(f).ok).toBe(false);
  });

  test('accepts a valid PDF within the size limit', () => {
    const f = file('paper.pdf', 'application/pdf', 1024);
    expect(validatePdfFile(f).ok).toBe(true);
  });
});

describe('validateHttpsUrl', () => {
  test('accepts an https URL', () => {
    expect(validateHttpsUrl('https://example.com/path')).toBeNull();
  });

  test('accepts an http URL', () => {
    expect(validateHttpsUrl('http://example.com')).toBeNull();
  });

  test('rejects URLs without a scheme', () => {
    expect(validateHttpsUrl('example.com/path')).toMatch(/http/i);
  });

  test('rejects empty input', () => {
    expect(validateHttpsUrl('')).toMatch(/required/i);
  });
});

describe('validatePositiveInteger', () => {
  test('allows empty / null (optional field)', () => {
    expect(validatePositiveInteger('')).toBeNull();
    expect(validatePositiveInteger(null)).toBeNull();
    expect(validatePositiveInteger(undefined)).toBeNull();
  });

  test('accepts a positive integer string', () => {
    expect(validatePositiveInteger('42')).toBeNull();
  });

  test('accepts zero', () => {
    expect(validatePositiveInteger('0')).toBeNull();
  });

  test('rejects negative numbers', () => {
    expect(validatePositiveInteger('-1')).toMatch(/non-negative/i);
  });

  test('rejects decimals', () => {
    expect(validatePositiveInteger('1.5')).toMatch(/non-negative/i);
  });

  test('rejects non-numeric strings', () => {
    expect(validatePositiveInteger('abc')).toMatch(/non-negative/i);
  });
});

describe('extractServerFieldErrors', () => {
  const knownFields = ['email', 'fullName', 'password'] as const;

  test('parses the { errors: { field: msg } } convention', () => {
    const err = { response: { data: { errors: { email: 'Email is taken' } } } };
    expect(extractServerFieldErrors(err, knownFields)).toEqual({ email: 'Email is taken' });
  });

  test('parses the { fieldErrors: [{ field, message }] } convention', () => {
    const err = { response: { data: { fieldErrors: [{ field: 'fullName', message: 'Too short' }] } } };
    expect(extractServerFieldErrors(err, knownFields)).toEqual({ fullName: 'Too short' });
  });

  test('parses ASP.NET { ValidationErrors: { field: [...] } }', () => {
    const err = { response: { data: { ValidationErrors: { password: ['Missing digit'] } } } };
    expect(extractServerFieldErrors(err, knownFields)).toEqual({ password: 'Missing digit' });
  });

  test('ignores fields that are not in the known list', () => {
    const err = { response: { data: { errors: { hackerField: 'x' } } } };
    expect(extractServerFieldErrors(err, knownFields)).toEqual({});
  });

  test('returns empty map for unknown payloads', () => {
    expect(extractServerFieldErrors(null, knownFields)).toEqual({});
    expect(extractServerFieldErrors({}, knownFields)).toEqual({});
    expect(extractServerFieldErrors('boom', knownFields)).toEqual({});
  });
});

describe('extractServerMessage', () => {
  test('falls back when payload is empty', () => {
    expect(extractServerMessage(null)).toMatch(/rejected/i);
  });

  test('reads message from response.data.message', () => {
    expect(
      extractServerMessage({ response: { data: { message: 'Bad input' } } }),
    ).toBe('Bad input');
  });

  test('reads title as a fallback', () => {
    expect(
      extractServerMessage({ response: { data: { title: 'One or more errors occurred' } } }),
    ).toBe('One or more errors occurred');
  });

  test('reads native Error.message', () => {
    expect(extractServerMessage(new Error('Boom'))).toBe('Boom');
  });
});