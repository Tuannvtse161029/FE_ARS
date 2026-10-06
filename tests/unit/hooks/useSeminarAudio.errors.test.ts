/**
 * Unit tests for useSeminarAudio.translateBeError (Oct 2026).
 *
 * Pins the bug-fix contract for the BE → FE error string mapping:
 *   1. Vietnamese BE messages (e.g. "Không có nội dung feedback") are
 *      translated to English before reaching the UI.
 *   2. The user-facing string NEVER carries a `[CODE]` suffix. The
 *      "Parameter" the user reported was the BE code being appended
 *      to the displayed message — now the code lives on a separate
 *      field and the display string is the clean English message.
 *   3. Known BE codes (`SUMMARY_ALREADY_EXISTS`,
 *      `SEMINAR_NO_FEEDBACK`, `NO_FEEDBACK_CONTENT`) map to a stable
 *      English message so the UI is consistent regardless of which
 *      language the BE happens to send.
 *   4. Future BE updates that already return English pass through
 *      unchanged — we never over-translate.
 */
import { describe, it, expect } from 'vitest';
import { translateBeError } from '../../../src/hooks/useSeminarAudio';

describe('translateBeError — BE → FE message scrubber', () => {
  describe('the "Không có nội dung feedback" case (user-reported bug)', () => {
    it('translates the Vietnamese message to English', () => {
      const out = translateBeError(null, 'Không có nội dung feedback');
      // Specifically: the displayed message must not contain the
      // Vietnamese diacritics that betray a missing translation.
      expect(out).not.toMatch(/[ăâđêôơưáàảãạằẳẵặắấầẩẫậ]/i);
      // The replacement should be a meaningful English sentence,
      // not the raw Vietnamese phrase. We don't assert the exact
      // wording because the English copy is part of the FE's UX
      // surface and may be tuned over time — only that it's not
      // the Vietnamese source.
      expect(out.length).toBeGreaterThan('Không có nội dung feedback'.length - 5);
      expect(out.trim().length).toBeGreaterThan(0);
    });

    it('does not append the BE code in brackets (the "Parameter" the user reported)', () => {
      // The user said: "remove the Parameter from it". The bracket
      // code suffix was the parameter — even when the BE sends a
      // code, we must not glue it onto the user-facing string.
      const out = translateBeError('SEMINAR_NO_FEEDBACK', 'Không có nội dung feedback');
      expect(out).not.toMatch(/\[.*\]/);
    });

    it('returns the same English string whether the BE sent a code or just a message', () => {
      // Whether the BE includes a `code` field or just the Vietnamese
      // message, the user should see the same English text. The
      // code-mapped path wins when present.
      const fromCode = translateBeError('SEMINAR_NO_FEEDBACK', 'Không có nội dung feedback');
      const fromMessage = translateBeError(null, 'Không có nội dung feedback');
      expect(fromCode).toBe(fromMessage);
    });
  });

  describe('BE code → English mapping', () => {
    it('SUMMARY_ALREADY_EXISTS maps to a stable English message', () => {
      const out = translateBeError('SUMMARY_ALREADY_EXISTS', 'Tóm tắt đã tồn tại.');
      expect(out.toLowerCase()).toMatch(/summary|already/);
      expect(out).not.toMatch(/tóm tắt/i);
      expect(out).not.toMatch(/\[/);
    });

    it('NO_FEEDBACK_CONTENT maps to a stable English message', () => {
      const out = translateBeError('NO_FEEDBACK_CONTENT', 'Không có nội dung feedback');
      expect(out.toLowerCase()).toContain('feedback');
      expect(out).not.toMatch(/\[/);
    });

    it('unknown BE codes still produce a non-empty English string', () => {
      // A future BE might add a new code we don't know about — we
      // should still produce *something* the user can read, not
      // leak a raw [CODE] suffix or a Vietnamese phrase.
      const out = translateBeError('FUTURE_TOTALLY_NEW_CODE', 'Some Vietnamese text');
      expect(out.length).toBeGreaterThan(0);
      expect(out).not.toMatch(/\[/);
      // The message "Some Vietnamese text" has no Vietnamese diacritics
      // so the `looksLikeEnglish` heuristic will pass it through.
      // That's correct: the BE is the source of truth, and we never
      // mangle a message we don't have a translation for.
      expect(out).toBe('Some Vietnamese text');
    });
  });

  describe('pass-through behavior', () => {
    it('passes an already-English message through unchanged', () => {
      // If the BE eventually ships English messages, we must not
      // mangle them by trying to translate them.
      const out = translateBeError(null, 'A seminar summary is already saved for this meeting.');
      expect(out).toBe('A seminar summary is already saved for this meeting.');
    });

    it('passes an English BE message through even when a code is present', () => {
      const out = translateBeError(
        'WEIRD_FUTURE_CODE',
        'A seminar summary is already saved for this meeting.',
      );
      // We don't know this code, but the message is English and
      // meaningful — pass it through.
      expect(out).toBe('A seminar summary is already saved for this meeting.');
    });
  });

  describe('fallback behavior', () => {
    it('returns the fallback when the BE sends no message and no code', () => {
      const out = translateBeError(null, undefined);
      expect(out.length).toBeGreaterThan(0);
      expect(out).not.toMatch(/\[/);
    });

    it('returns the fallback when the BE sends empty strings', () => {
      const out = translateBeError(null, '');
      expect(out.length).toBeGreaterThan(0);
    });

    it('returns a string for null BE code + non-string message', () => {
      const out = translateBeError(null, null);
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(0);
    });
  });

  describe('invariant: no [CODE] suffix in any output', () => {
    // Sweep every common input shape to make sure the cleanup
    // contract holds regardless of BE behaviour.
    it('never contains a bracket code suffix', () => {
      const inputs: Array<{ code: string | null; message: string | undefined }> = [
        { code: null, message: 'Không có nội dung feedback' },
        { code: 'SEMINAR_NO_FEEDBACK', message: 'Không có nội dung feedback' },
        { code: 'SUMMARY_ALREADY_EXISTS', message: 'Tóm tắt đã tồn tại' },
        { code: 'NO_FEEDBACK_CONTENT', message: 'No content' },
        { code: 'A_B_C', message: 'Anything else' },
        { code: null, message: 'Already English' },
        { code: null, message: undefined },
        { code: null, message: '' },
      ];
      for (const { code, message } of inputs) {
        const out = translateBeError(code, message);
        expect(out, `input { code: ${code}, message: ${message} }`).not.toMatch(/\[/);
        expect(out, `input { code: ${code}, message: ${message} }`).not.toMatch(/\]/);
      }
    });
  });
});