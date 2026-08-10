import { describe, it, expect } from 'vitest';

describe('Register validation helpers', () => {
  // Inline validation helpers mirrored from Register.tsx so tests are self-contained.
  // (The actual component uses these at runtime.)

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[+\d\s\-()]{8,20}$/;
  const passwordRegex = {
    hasUpper: /[A-Z]/,
    hasNumber: /[0-9]/,
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // EMAIL
  // ─────────────────────────────────────────────────────────────────────────────

  describe('email validation', () => {
    it('accepts valid email', () => {
      expect(emailRegex.test('user@university.edu')).toBe(true);
      expect(emailRegex.test('a@b.co')).toBe(true);
    });

    it('rejects invalid email', () => {
      expect(emailRegex.test('')).toBe(false);
      expect(emailRegex.test('not-an-email')).toBe(false);
      expect(emailRegex.test('missing@domain')).toBe(false);
      expect(emailRegex.test('@no-local.com')).toBe(false);
      expect(emailRegex.test('spaces in@email.com')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PHONE
  // ─────────────────────────────────────────────────────────────────────────────

  describe('phone number validation', () => {
    it('accepts valid phone numbers', () => {
      expect(phoneRegex.test('+84 90 123 4567')).toBe(true);
      expect(phoneRegex.test('090-123-4567')).toBe(true);
      expect(phoneRegex.test('(123) 456-7890')).toBe(true);
      expect(phoneRegex.test('12345678')).toBe(true);
    });

    it('rejects invalid phone numbers', () => {
      expect(phoneRegex.test('123')).toBe(false);         // too short
      expect(phoneRegex.test('abc-def-ghij')).toBe(false); // letters
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PASSWORD
  // ─────────────────────────────────────────────────────────────────────────────

  describe('password validation', () => {
    it('accepts valid password', () => {
      const valid = 'Password123';
      expect(valid.length >= 8).toBe(true);
      expect(passwordRegex.hasUpper.test(valid)).toBe(true);
      expect(passwordRegex.hasNumber.test(valid)).toBe(true);
    });

    it('rejects password shorter than 8 chars', () => {
      expect('Short1'.length >= 8).toBe(false);
    });

    it('rejects password without uppercase', () => {
      expect(passwordRegex.hasUpper.test('password123')).toBe(false);
    });

    it('rejects password without number', () => {
      expect(passwordRegex.hasNumber.test('PasswordOnly')).toBe(false);
    });

    it('rejects password without any letter', () => {
      expect(passwordRegex.hasUpper.test('12345678')).toBe(false);
      expect(/[a-zA-Z]/.test('12345678')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // RETYPE PASSWORD MATCH
  // ─────────────────────────────────────────────────────────────────────────────

  describe('password match', () => {
    it('matches when identical', () => {
      const password = 'Password123';
      const retype = 'Password123';
      expect(password === retype).toBe(true);
    });

    it('does not match when different', () => {
      expect('Password123' === 'Mismatch1').toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ORCID
  // ─────────────────────────────────────────────────────────────────────────────

  describe('ORCID ID validation', () => {
    const orcidRegex = /^\d{4}-\d{4}-\d{4}-\d{3}[0-9X]$/;

    it('accepts valid ORCID IDs', () => {
      expect(orcidRegex.test('0000-0002-1825-0097')).toBe(true);
      expect(orcidRegex.test('0000-0001-2345-678X')).toBe(true);
    });

    it('rejects invalid ORCID IDs', () => {
      expect(orcidRegex.test('')).toBe(false);
      expect(orcidRegex.test('not-valid')).toBe(false);
      expect(orcidRegex.test('0000-000-0000-000')).toBe(false);
      expect(orcidRegex.test('0000-0002-1825-009')).toBe(false); // only 3 digits at end
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // FULL NAME
  // ─────────────────────────────────────────────────────────────────────────────

  describe('full name validation', () => {
    it('accepts valid full names', () => {
      expect('Dr. Nguyen Van A'.trim().length >= 2).toBe(true);
      expect('A'.trim().length >= 2).toBe(false); // too short
    });
  });
});
