// Agent 30 — single source of truth for the gender options surfaced in the
// Profile page (and any future entry point — registration flow, public
// profile filters, etc.).
//
// Why a FE constant?
//   - The BE `ProfileUpdateRequest` (Swagger
//     `components.schemas.ProfileUpdateRequest`) declares `gender` as a
//     free-form `string` — there is no published enum. The FE owns the
//     canonical option list so the same set cannot drift between surfaces.
//   - The BE's `ProfileResponse` schema (swagger.json:17177-17242) does
//     NOT echo `gender` back, so the FE persists the user's pick in
//     `localStorage` (`ars_gender_<userId>`) to survive page reloads.
//     See `src/pages/Profile/Profile.tsx` for the localStorage wiring.
//
// The order is the displayed order — Male / Female are the conventional
// academic ordering; "Prefer Not To Say" goes last to never default-suggest
// it for users who simply haven't picked yet.

export interface GenderOption {
  /** Stable identifier — what we send to the BE and persist locally. */
  readonly code: string;
  /** i18n dictionary key — `profile.edit.gender.options.<key>`. */
  readonly labelKey: string;
}

export const GENDER_OPTIONS: ReadonlyArray<GenderOption> = [
  { code: 'Male', labelKey: 'male' },
  { code: 'Female', labelKey: 'female' },
  { code: 'PreferNotToSay', labelKey: 'preferNotToSay' },
] as const;

export type GenderCode = (typeof GENDER_OPTIONS)[number]['code'];

/** True iff `value` is one of the canonical gender codes. */
export function isGenderCode(value: unknown): value is GenderCode {
  if (typeof value !== 'string') return false;
  return GENDER_OPTIONS.some((option) => option.code === value);
}

/**
 * The localized label shown in public profile viewports. Returns the raw
 * `code` as a fallback so a partially-translated dictionary still surfaces
 * sensible copy.
 */
export const GENDER_LABEL_FALLBACK: Record<string, string> = {
  Male: 'Male',
  Female: 'Female',
  PreferNotToSay: 'Prefer not to say',
};

export default GENDER_OPTIONS;
