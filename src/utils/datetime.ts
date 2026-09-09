/**
 * Centralized Datetime Utility for ARS Platform.
 *
 * Solves timezone offsets and database skew:
 * 1. `<input type="datetime-local">` requires local format `YYYY-MM-DDTHH:mm`.
 * 2. `<input type="date">` requires local format `YYYY-MM-DD`.
 * 3. Never use `d.toISOString().slice(0, 16)` for input values because `toISOString()`
 *    is in UTC (GMT+0), which causes a 7-hour shift in Vietnam (UTC+7) every time
 *    a form is opened and saved.
 * 4. API endpoints expect ISO 8601 strings, but date-only deadlines must not be shifted
 *    into the previous day.
 */

const LOCALE_STORAGE_KEY = 'ars_lang';

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Read the active UI locale from localStorage. Mirrors the behaviour of
 * `utils/formatDate.ts:resolveActiveLocale` so the two formatter helpers
 * never disagree on which language is currently displayed.
 *
 * Defaults to `'en'` to match I18nProvider's `DEFAULT_LOCALE`. SSR /
 * privacy-mode callers fall back to the same value.
 */
const resolveActiveLocale = (): 'vi' | 'en' => {
  if (typeof window === 'undefined') return 'en';
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw === 'vi' || raw === 'en') return raw;
  } catch {
    /* ignore — privacy mode / SSR */
  }
  return 'en';
};

/** Map the short app locale code (`vi` / `en`) to a BCP-47 tag. */
const toIntlLocaleTag = (locale: 'vi' | 'en'): string =>
  locale === 'en' ? 'en-US' : 'vi-VN';

/**
 * Safely parse any API or user date/time value into a valid Date object.
 *
 * ⚠️  Date-only / domain-form input contract
 * --------------------------------------------
 * This helper keeps the long-standing "bare ISO datetime is LOCAL" rule
 * that the rest of the app (e.g. `normaliseEndAt` in
 * `researchTopicPhase.service.ts`) depends on. Many of our forms pick a
 * date in `<input type="datetime-local">`, the value is sent to the BE
 * without a timezone marker, and on round-trip we want the original local
 * wall-clock digits to come back unchanged.
 *
 * If you have a string from the BE that **must be UTC** (seminar
 * `startTime` / `endTime`, etc., where the BE sometimes strips the `Z`),
 * use `parseApiDateTimeAsUtc()` instead — see its docstring for the
 * exact rule and why it differs.
 *
 * Handles:
 * - ISO strings with `Z` or `±HH:MM` (e.g. `'2026-09-15T07:00:00.000Z'`)
 * - ISO strings without timezone (e.g. `'2026-09-15T14:00:00'`) → LOCAL
 * - Date-only strings (e.g. `'2026-09-15'`) → LOCAL midnight
 * - Existing Date objects or numeric timestamps
 */
export function parseApiDate(val: string | number | Date | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val;
  }

  if (typeof val === 'number') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Date-only string YYYY-MM-DD (e.g. '2026-09-15')
    // Keep local interpretation to avoid the classic UTC-midnight day
    // drop for fields like date of birth.
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Converts any date or datetime into a local string formatted for:
 * `<input type="datetime-local">` -> `YYYY-MM-DDTHH:mm`
 */
export function toLocalDatetimeInput(val: string | number | Date | null | undefined): string {
  const d = parseApiDate(val);
  if (!d) return '';
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * Converts any date or datetime into a local string formatted for:
 * `<input type="date">` -> `YYYY-MM-DD`
 */
export function toLocalDateInput(val: string | number | Date | null | undefined): string {
  const d = parseApiDate(val);
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Converts a datetime input (e.g. '2026-09-15T14:00' or Date) into standard ISO 8601 UTC string
 * for sending in API payloads.
 *
 * IMPORTANT: <input type="datetime-local"> produces a local datetime string (e.g.
 * "2026-09-15T14:00") with NO timezone indicator. The JavaScript Date constructor
 * interprets bare datetime-local strings as local time in some browsers, then
 * toISOString() converts to UTC — causing a 7-hour shift for UTC+7 users.
 *
 * The intent of this helper is to **store the user's LOCAL clock time as the
 * intended UTC time**, so that a user in Vietnam picking "2026-09-20 14:00"
 * gets `2026-09-20T14:00:00.000Z` sent to the BE. This matches the existing
 * convention used by other ARS forms (assignment deadlines, manuscript
 * submission dates) so seminar times are not silently shifted by the local
 * timezone.
 *
 * - Date-only string (e.g. '2026-09-15') -> set to end of that day in local time (23:59:59)
 * - Datetime-local string (e.g. '2026-09-15T14:00') -> preserve local clock time as the
 *   UTC value (we do NOT round-trip through `new Date()` + `toISOString()` because
 *   that would subtract the local timezone offset and shift the stored time).
 * - Full ISO or Date object -> fall through to standard parsing
 */
export function toApiIsoString(val: string | number | Date | null | undefined): string | null {
  if (!val) return null;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Date-only string (e.g. '2026-09-15') -> set to end of that day in local time (23:59:59)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      return new Date(year, month - 1, day, 23, 59, 59).toISOString();
    }

    // Datetime-local string (e.g. '2026-09-15T14:00') — no timezone suffix.
    // new Date('2026-09-15T14:00') is ambiguous: some browsers parse as local,
    // others as UTC. We manually extract the components and build the ISO string
    // directly from those LOCAL components so the user's chosen clock time is
    // stored as the UTC time (no implicit timezone shift).
    const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
    const m = DATETIME_LOCAL_RE.exec(trimmed);
    if (m) {
      const [, yearS, monthS, dayS, hourS, minS] = m;
      return (
        `${yearS}-${monthS}-${dayS}T${hourS}:${minS}:00.000Z`
      );
    }
  }

  const d = parseApiDate(val);
  return d ? d.toISOString() : null;
}

/**
 * Formats a date for user-facing UI in local time (e.g. "Aug 18, 2026"
 * in English, "18 thg 8, 2026" in Vietnamese). The locale argument
 * accepts the short app codes (`en` / `vi`) and is translated to the
 * proper BCP-47 tag before reaching `Intl`. When omitted the helper
 * reads the active UI locale from storage so the output matches the
 * rest of the page even if the caller forgets to pass a locale.
 */
export function formatDisplayDate(
  val: string | number | Date | null | undefined,
  locale: 'vi' | 'en' = resolveActiveLocale(),
): string {
  const d = parseApiDate(val);
  if (!d) return '—';
  return d.toLocaleDateString(toIntlLocaleTag(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a date and time for user-facing UI in local time (e.g.
 * "Aug 18, 2026, 14:00"). Same locale-resolution contract as
 * `formatDisplayDate`.
 */
export function formatDisplayDateTime(
  val: string | number | Date | null | undefined,
  locale: 'vi' | 'en' = resolveActiveLocale(),
): string {
  const d = parseApiDate(val);
  if (!d) return '—';
  return d.toLocaleDateString(toIntlLocaleTag(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a time for user-facing UI in local time (e.g. "14:00").
 * Same locale-resolution contract as `formatDisplayDate`.
 */
export function formatDisplayTime(
  val: string | number | Date | null | undefined,
  locale: 'vi' | 'en' = resolveActiveLocale(),
): string {
  const d = parseApiDate(val);
  if (!d) return '—';
  return d.toLocaleTimeString(toIntlLocaleTag(locale), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Parse an ISO 8601 datetime string from the BE as a UTC instant.
 *
 * The ARS backend is documented to return `format: "date-time"` (RFC 3339)
 * timestamps, but the BE's serializer sometimes drops the timezone marker
 * when the underlying `DateTime.Kind` is `Unspecified` — e.g. it returns
 * `"2026-09-09T17:50:00"` instead of `"2026-09-09T17:50:00Z"`. Without the
 * `Z` suffix, JavaScript's `new Date()` interprets the string as the
 * BROWSER's local time, which causes two visible FE bugs:
 *
 *   • Status check:  `endTime < Date.now()` returns true for an upcoming
 *     seminar (because the "local 17:50" is parsed as 17:50 ICT = 10:50
 *     UTC, while `Date.now()` is already 12:50 UTC), so it is tagged
 *     `COMPLETED` immediately after creation.
 *   • Display:       The seminar card prints the wrong wall-clock time —
 *     e.g. `17:45 on Sep 9` instead of `00:45 on Sep 10` for a UTC+7
 *     viewer who picked the latter.
 *
 * This helper re-attaches the `Z` when it's missing so the value is
 * parsed as the UTC instant the BE actually stored. It is the ONLY
 * function in this module with that semantic — `parseApiDate()` keeps
 * its long-standing "bare datetime is local" behavior because several
 * non-seminar domains (research-topic phase deadlines, etc.) rely on
 * that round-tripping the original local wall-clock digits.
 *
 * Used by:
 *   • `deriveEffectiveStatus()` and `getMyInvitations()` in
 *     `services/seminar.service.ts` (status comparison).
 *   • `SeminarWorkspace` and `SeminarFeedbackModalShell` (display +
 *     `<input type="datetime-local">` round-trip).
 */
export function parseApiDateTimeAsUtc(
  val: string | number | Date | null | undefined,
): Date | null {
  if (val == null) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const trimmed = val.trim();
  if (!trimmed) return null;

  // Date-only string YYYY-MM-DD — for seminar fields this never occurs
  // (`SeminarResponse.startTime` / `endTime` are full datetimes), but
  // we handle it gracefully: a date-only value from the BE is the one
  // situation where local midnight is the most useful interpretation.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const hasTimezone =
    trimmed.endsWith('Z') ||
    /[+-]\d{2}:\d{2}$/.test(trimmed) ||
    /[+-]\d{4}$/.test(trimmed);
  const normalized = hasTimezone ? trimmed : `${trimmed}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}
