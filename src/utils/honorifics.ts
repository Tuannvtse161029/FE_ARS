// Agent 30 — single source of truth for the honorific prefix that the FE
// allows a user to prepend to their display name on registration.
//
// Why a FE constant?
//   - The BE `UserResponse.fullName` (Swagger `components.schemas.UserResponse`)
//     is just a free-form string. There is no separate Title / Honorific column
//     in the BE schema, and we do not introduce one — the title is purely a
//     presentation-time prefix that the FE concatenates onto `fullName` at
//     submit time. Keeping the canonical option list here makes it
//     round-trippable across i18n dictionaries without bloating the BE.
//
// The order is the displayed order in the dropdown — most-frequently-used
// titles first. New titles can be added without touching the BE.

/**
 * Canonical set of honorifics that may prefix a user's display name on the
 * ARS Register page. Each `code` is the persisted string the FE prefixes to
 * `fullName` at submit time (e.g. `Dr Nguyen Van A`); the `labelKey` is the
 * i18n dictionary key used to render the visible dropdown label so the same
 * code can localize independently for English / Vietnamese.
 */
export interface TitleOption {
  /** Stable identifier — what we send through to the API as part of fullName. */
  readonly code: string;
  /** i18n dictionary key, looked up via `register.title.options.<key>`. */
  readonly labelKey: string;
}

export const TITLE_OPTIONS: ReadonlyArray<TitleOption> = [
  { code: 'Mr', labelKey: 'mr' },
  { code: 'Ms', labelKey: 'ms' },
  { code: 'Mrs', labelKey: 'mrs' },
  { code: 'Dr', labelKey: 'dr' },
  { code: 'Prof', labelKey: 'prof' },
  { code: 'Assoc. Prof', labelKey: 'assocProf' },
  { code: 'Asst. Prof', labelKey: 'asstProf' },
  { code: 'PhD', labelKey: 'phd' },
] as const;

export type TitleCode = (typeof TITLE_OPTIONS)[number]['code'];

/** True iff `value` is one of the canonical honorific codes. */
export function isTitleCode(value: unknown): value is TitleCode {
  if (typeof value !== 'string') return false;
  return TITLE_OPTIONS.some((option) => option.code === value);
}

/**
 * Build the prefixed fullName for the API. Empty / undefined title yields the
 * raw name unchanged so the contract degrades cleanly for users who skip the
 * dropdown. Whitespace is collapsed; if a user types a leading/trailing space
 * in the name field, that is preserved (the BE validator decides).
 */
export function prefixTitle(title: string | null | undefined, fullName: string): string {
  const cleanTitle = (title ?? '').trim();
  const cleanName = (fullName ?? '').trim();
  if (!cleanTitle) return cleanName;
  return `${cleanTitle} ${cleanName}`;
}

export default TITLE_OPTIONS;
