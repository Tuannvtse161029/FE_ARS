/**
 * Unit tests for src/i18n/translations.ts
 *
 * Pins both pluralization conventions:
 *   1. The simple `{s}` shorthand — `{count} group{s}` becomes `1 group`
 *      when count is exactly 1, otherwise `2 groups`.
 *   2. ICU MessageFormat plurals — `{count, plural, =1 {…} other {…}}`
 *      resolves to the matching case (with `#` substituted by the count).
 *
 * The ICU test cases mirror real dictionary entries that were silently
 * rendering raw `((COUNT, PLURAL, …))` placeholder text in the
 * lecturer workspace (Oct 2026 bug: "View Feedback" button showed the
 * i18n template instead of the localized label).
 */
import { describe, it, expect } from 'vitest';
import { translate } from '../../../src/i18n/translations';

const DICT: Record<string, Record<string, string>> = {
  en: {
    'test.viewN': 'View ({count, plural, =1 {1 answer} other {# answers}})',
    'test.inviteN': '{count, plural, =1 {Invite 1 participant} other {Invite # participants}}',
    'test.inviteSuccess':
      '{count, plural, =1 {Invitation sent to 1 participant.} other {Invitations sent to # participants.}}',
    'test.selectedCount':
      '{count, plural, =0 {None selected} =1 {1 selected} other {# selected}}',
    'test.withPlaceholder': '{name} — {count, plural, =1 {1 answer} other {# answers}}',
    'test.simple': '{count} group{s}',
    'test.plain': 'No pluralization here, just {name}',
  },
  vi: {
    'test.viewN': 'Xem ({count, plural, =1 {1 câu trả lời} other {# câu trả lời}})',
    'test.inviteN': '{count, plural, =1 {Mời 1 người tham dự} other {Mời # người tham dự}}',
    'test.inviteSuccess':
      '{count, plural, =1 {Đã gửi lời mời đến 1 người tham dự.} other {Đã gửi lời mời đến # người tham dự.}}',
    'test.selectedCount':
      '{count, plural, =0 {Chưa chọn ai} =1 {1 đã chọn} other {# đã chọn}}',
  },
};

describe('translate', () => {
  describe('ICU MessageFormat plurals (Oct 2026 fix)', () => {
    it('resolves the "View (1 answer)" branch when count=1', () => {
      expect(translate('en', 'test.viewN', undefined, { count: 1 }, DICT)).toBe(
        'View (1 answer)',
      );
    });

    it('resolves the "View (N answers)" branch when count > 1', () => {
      expect(translate('en', 'test.viewN', undefined, { count: 2 }, { en: DICT.en, vi: {} })).toBe(
        'View (2 answers)',
      );
      expect(translate('en', 'test.viewN', undefined, { count: 12 }, { en: DICT.en, vi: {} })).toBe(
        'View (12 answers)',
      );
    });

    it('resolves the "View (0 answers)" branch when count=0', () => {
      expect(translate('en', 'test.viewN', undefined, { count: 0 }, { en: DICT.en, vi: {} })).toBe(
        'View (0 answers)',
      );
    });

    it('resolves the Vietnamese ICU variant the same way', () => {
      expect(translate('vi', 'test.viewN', undefined, { count: 1 }, DICT)).toBe(
        'Xem (1 câu trả lời)',
      );
      expect(translate('vi', 'test.viewN', undefined, { count: 3 }, DICT)).toBe(
        'Xem (3 câu trả lời)',
      );
    });

    it('resolves `=1` even when it appears after `other` (first match wins)', () => {
      // Edge case: someone writes `{count, plural, other {# fallback} =1 {one}`.
      // The explicit `=1` should still win for count=1 because exact
      // matches take priority over `other`.
      const edge: Record<string, string> = {
        'test.order': '{count, plural, other {# fallback} =1 {exactly one}}',
      };
      expect(translate('en', 'test.order', undefined, { count: 1 }, { en: edge, vi: {} })).toBe(
        'exactly one',
      );
      expect(translate('en', 'test.order', undefined, { count: 5 }, { en: edge, vi: {} })).toBe(
        '5 fallback',
      );
    });

    it('falls back to `other` when the numeric value is undefined', () => {
      // If someone calls t() without the count param (uncommon but
      // possible from a buggy caller), we don't want to leave the raw
      // ICU fragment in the UI.
      expect(
        translate('en', 'test.viewN', undefined, { name: 'AI Research' }, { en: DICT.en, vi: {} }),
      ).toBe('View ( answers)');
    });

    it('substitutes other `{var}` placeholders inside the chosen case body', () => {
      expect(
        translate('en', 'test.withPlaceholder', undefined, { count: 1, name: 'Alice' }, { en: DICT.en, vi: {} }),
      ).toBe('Alice — 1 answer');
      expect(
        translate('en', 'test.withPlaceholder', undefined, { count: 4, name: 'Alice' }, { en: DICT.en, vi: {} }),
      ).toBe('Alice — 4 answers');
    });

    it('handles `=0` and `=1` selectors in the same template', () => {
      const dict = { en: DICT.en, vi: {} };
      expect(translate('en', 'test.selectedCount', undefined, { count: 0 }, dict)).toBe(
        'None selected',
      );
      expect(translate('en', 'test.selectedCount', undefined, { count: 1 }, dict)).toBe(
        '1 selected',
      );
      expect(translate('en', 'test.selectedCount', undefined, { count: 7 }, dict)).toBe(
        '7 selected',
      );
    });

    it('handles two ICU expressions in the same string (reminderSent pattern)', () => {
      // Real entry from en.ts: 'Reminder sent to {count, plural,
      // =1 {1 participant.} other {# participants.}} {skipped, plural,
      // =0 {} other {{skipped} skipped.}}'
      // This pins the scanner's behaviour when an outer expression
      // resolves to text that contains a *second* `{var, plural, ...}`
      // expression — the inner one must be handled by the same
      // recursive pass, not emitted as raw text.
      const dict = {
        en: {
          'test.reminder':
            'Reminder sent to {count, plural, =1 {1 participant.} other {# participants.}} {skipped, plural, =0 {} other {{skipped} skipped.}}',
        },
        vi: {},
      };
      expect(translate('en', 'test.reminder', undefined, { count: 1, skipped: 0 }, dict))
        .toBe('Reminder sent to 1 participant. ');
      expect(translate('en', 'test.reminder', undefined, { count: 4, skipped: 2 }, dict))
        .toBe('Reminder sent to 4 participants. 2 skipped.');
      // skipped=0 → `=0 {}` is the empty case, no `skipped skipped.` suffix
      expect(translate('en', 'test.reminder', undefined, { count: 3, skipped: 0 }, dict))
        .toBe('Reminder sent to 3 participants. ');
    });
  });

  describe('simple `{s}` pluralization (existing behavior)', () => {
    it('strips `{s}` when count=1', () => {
      expect(
        translate('en', 'test.simple', undefined, { count: 1 }, { en: DICT.en, vi: {} }),
      ).toBe('1 group');
    });

    it('keeps `{s}` when count is anything else', () => {
      expect(
        translate('en', 'test.simple', undefined, { count: 0 }, { en: DICT.en, vi: {} }),
      ).toBe('0 groups');
      expect(
        translate('en', 'test.simple', undefined, { count: 2 }, { en: DICT.en, vi: {} }),
      ).toBe('2 groups');
      expect(
        translate('en', 'test.simple', undefined, { count: 42 }, { en: DICT.en, vi: {} }),
      ).toBe('42 groups');
    });
  });

  describe('plain `{var}` substitution', () => {
    it('substitutes a single placeholder', () => {
      expect(
        translate('en', 'test.plain', undefined, { name: 'Alice' }, { en: DICT.en, vi: {} }),
      ).toBe('No pluralization here, just Alice');
    });

    it('leaves missing placeholders untouched (never throws)', () => {
      expect(
        translate('en', 'test.plain', undefined, undefined, { en: DICT.en, vi: {} }),
      ).toBe('No pluralization here, just {name}');
    });
  });

  describe('fallback behavior', () => {
    it('falls back to English when the vi dictionary is missing a key', () => {
      const dict = {
        vi: {},
        en: DICT.en,
      };
      expect(translate('vi', 'test.viewN', undefined, { count: 1 }, dict)).toBe(
        'View (1 answer)',
      );
    });

    it('returns the key itself when no dictionary or fallback has the key', () => {
      expect(translate('en', 'no.such.key', undefined, undefined, {})).toBe(
        'no.such.key',
      );
    });

    it('returns the explicit fallback when provided', () => {
      expect(
        translate('en', 'no.such.key', 'My fallback', undefined, {}),
      ).toBe('My fallback');
    });
  });
});