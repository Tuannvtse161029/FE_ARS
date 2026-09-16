/**
 * Regression test for the September 2026 bug:
 *
 *   The English dictionary (`src/i18n/dictionaries/en.ts`) accidentally
 *   contained three Vietnamese strings used by the Lecturer GroupDetail
 *   page:
 *
 *     • `lecturer.groupDetail.leaderRole`           — 'Trưởng nhóm (Leader)'
 *     • `lecturer.groupDetail.setLeaderSuccess`     — 'Đã gán vai trò Trưởng nhóm…'
 *     • `lecturer.groupDetail.removeLeaderSuccess`  — 'Đã hủy vai trò Trưởng nhóm…'
 *
 *   When the user had the English locale selected (the language toggle
 *   showed "English"), the page rendered those Vietnamese strings
 *   inline, breaking the locale contract. The fix was to swap them for
 *   proper English values; this test pins that invariant so a future
 *   copy-paste from the Vietnamese dictionary cannot silently re-introduce
 *   the leak.
 *
 * The matcher scans every value in `en.ts` for any Vietnamese-diacritic
 * letter. We deliberately allow common Latin punctuation / symbols but
 * fail on the unique Vietnamese vowel extensions (ă, â, ư, ơ, plus the
 * full set of vowel + diacritic combinations like ể, ữ, ằ, ộ, ẹ, etc.).
 *
 * If you intentionally need a Vietnamese string in en.ts (e.g. a
 * brand-name like "Đại học FPT" that must stay Vietnamese across all
 * locales), update the ALLOWLIST with the key + a comment explaining why
 * it must be Vietnamese.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface DictionaryRow {
  key: string;
  value: string;
}

const VIETNAMESE_DIACRITICS = /[ăâđêôơưĂÂĐÊÔƠƯằắẳẵặầấẩẫậèéẹẻẽềếểễệìíịỉĩòóọỏõồốổỗộờớởỡợùúụủũừứửữỳýỵỷỹẳẵằẵ]/;

const ALLOWLIST = new Set<string>([
  // Add keys here only when the value MUST be Vietnamese in en.ts for
  // specific UX reasons. None today.
]);

const EN_DICTIONARY_PATH = resolve(
  process.cwd(),
  'src/i18n/dictionaries/en.ts',
);

const parseDictionary = (raw: string): DictionaryRow[] => {
  // Matches `  'key': 'value',` lines and trailing-comma variants. We
  // intentionally do not handle multi-line string values — the en.ts
  // file uses only single-line literals.
  const lineRe = /^\s*'([^']+)':\s*'((?:\\'|[^'])*)'(?:,)?\s*$/;
  const rows: DictionaryRow[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = lineRe.exec(line);
    if (!m) continue;
    // Unescape the value the same way JS does so a `\'` does not look
    // like a stray quote.
    const value = m[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    rows.push({ key: m[1], value });
  }
  return rows;
};

describe('en.ts dictionary — no Vietnamese-leaked values', () => {
  it('every value contains no Vietnamese-diacritic characters', () => {
    const raw = readFileSync(EN_DICTIONARY_PATH, 'utf8');
    const rows = parseDictionary(raw);

    const leaks: Array<{ key: string; value: string; match: string }> = [];
    for (const { key, value } of rows) {
      if (ALLOWLIST.has(key)) continue;
      const match = VIETNAMESE_DIACRITICS.exec(value);
      if (match) {
        leaks.push({ key, value, match: match[0] });
      }
    }

    if (leaks.length > 0) {
      // Render a useful diagnostic so the failure points at the bad key,
      // not just "found N leaks".
      const summary = leaks
        .map((l) => `  • ${l.key} = ${JSON.stringify(l.value)}  (found: ${JSON.stringify(l.match)})`)
        .join('\n');
      throw new Error(
        `Found ${leaks.length} Vietnamese-diacritic value(s) in en.ts. ` +
          `English strings must use ASCII (or non-Vietnamese diacritics). ` +
          `Either translate the value to English, or add the key to the ALLOWLIST ` +
          `in this test with a comment explaining why it must stay Vietnamese.\n${summary}`,
      );
    }

    expect(leaks).toHaveLength(0);
  });

  it('every key referenced by the GroupDetail leader / toasts has a defined English value', () => {
    // Pin the specific keys the September 2026 bug touched, so a
    // regression to Vietnamese (or to a different key name) cannot slip
    // through unnoticed.
    const raw = readFileSync(EN_DICTIONARY_PATH, 'utf8');
    const rows = parseDictionary(raw);
    const byKey = new Map(rows.map((r) => [r.key, r.value]));

    const pinnedKeys = [
      'lecturer.groupDetail.leaderRole',
      'lecturer.groupDetail.setLeaderSuccess',
      'lecturer.groupDetail.removeLeaderSuccess',
    ];

    for (const key of pinnedKeys) {
      const value = byKey.get(key);
      expect(value, `en.ts is missing the "${key}" entry`).toBeDefined();
      expect(
        VIETNAMESE_DIACRITICS.test(value ?? ''),
        `en.ts "${key}" must be English, but got: ${JSON.stringify(value)}`,
      ).toBe(false);
    }

    // Sanity check: the English text should contain the word "Leader"
    // (case-insensitive) so users in English mode see a meaningful
    // badge label.
    expect(byKey.get('lecturer.groupDetail.leaderRole')?.toLowerCase()).toContain(
      'leader',
    );
  });

  it('the new materialPhaseLabel key exists in both en.ts and vi.ts', () => {
    const enRaw = readFileSync(EN_DICTIONARY_PATH, 'utf8');
    const enRows = parseDictionary(enRaw);
    expect(
      enRows.find((r) => r.key === 'lecturer.groupDetail.materialPhaseLabel'),
    ).toBeDefined();

    const viRaw = readFileSync(
      resolve(process.cwd(), 'src/i18n/dictionaries/vi.ts'),
      'utf8',
    );
    const viRows = parseDictionary(viRaw);
    expect(
      viRows.find((r) => r.key === 'lecturer.groupDetail.materialPhaseLabel'),
    ).toBeDefined();
  });
});
