// ── Profile types — sourced from /api/Profile in swagger.json (refreshed
//    2026-08-22 from https://arsplatform.onrender.com/swagger/v1/swagger.json).
//
//    The Profile controller is the "academic profile" surface (separate from
//    `/api/User/{id}` which owns login identity fields). It exposes:
//
//      GET    /api/Profile              → current user's profile
//      GET    /api/Profile/{id}         → profile for user id (admin/lookup)
//      PUT    /api/Profile/{id}         → full update
//      PATCH  /api/Profile/{id}         → partial update
//      DELETE /api/Profile/{id}         → delete profile
//
//    The response schema for the GET endpoints is not declared in the live
//    Swagger document — the spec marks the success response as 200 OK with no
//    schema. We model it here as `Profile` (the fields the BE is documented
//    to expose via ProfileUpdateRequest) with `id`, `createdAt`, and
//    `updatedAt` as optional so a partially-implemented BE doesn't crash the
//    FE. All display values tolerate missing/null fields without throwing.
//
//    FE code MUST treat the BE as the authoritative source of authorization.
//    `id` is a property of the response payload (the BE-assigned identifier);
//    it MUST NOT be used to decide which profile the FE edits — the FE
//    always targets the authenticated user's own profile, sourced from
//    `useAuth().user.userId` (NEVER from a route param, query string, or
//    other client-controlled input).

export interface Profile {
  /** BE-assigned profile row identifier. Mirror only — do NOT use as the edit target. */
  id?: number;
  /**
   * Owner of this profile. The FE always sends `userId = authenticatedUserId`
   * when writing. Read back from the BE response when present.
   */
  userId: number;
  /** Full display name. Nullable per the BE contract. */
  fullName?: string | null;
  /** Contact email. Nullable per the BE contract. */
  email?: string | null;
  /** Avatar public image URL. Nullable. */
  avatarUrl?: string | null;
  /** Primary role name (e.g. Researcher, Lecturer, Reviewer). */
  roleName?: string | null;
  /** Academic / professional title. Nullable per the BE contract. */
  academicTitle?: string | null;
  /** Phone number (international format expected). Nullable per the BE contract. */
  phoneNumber?: string | null;
  /** Affiliated institution / university. Nullable per the BE contract. */
  institution?: string | null;
  /** Free-form biography text. Nullable per the BE contract. */
  bio?: string | null;
  /** Research interest keywords. Nullable per the BE contract. */
  keywords?: string[] | null;
  /** Short display string used for the avatar badge (e.g. "ND"). Nullable. */
  avatarInitials?: string | null;
  /** Professional H-Index metric */
  hindex?: number | null;
  /** Total citations across publications */
  totalCitations?: number | null;
  /** Total published papers count */
  publicationCount?: number | null;
  /** Research major field */
  majorFieldName?: string | null;
  /** Research subfield */
  subFieldName?: string | null;
  /** Reviewer availability flag */
  isAvailable?: boolean | null;
  /** ORCID identifier and verification */
  orcidId?: string | null;
  isOrcidVerified?: boolean | null;
  /** ISO 8601 date string (`YYYY-MM-DD`). Nullable. */
  dateOfBirth?: string | null;
  /** Free-form gender string (BE doesn't publish an enum). Nullable. */
  gender?: string | null;
  /** Postal / street address. Nullable. */
  address?: string | null;
  /** ISO 8601 timestamps; present on responses that include them. */
  createdAt?: string | null;
  updatedAt?: string | null;
  /**
   * Reddit-style featured flair. ID of the medal the user wants rendered
   * next to their name. The FE stores this in localStorage as
   * `ars_flair_<userId>` until the BE exposes it on /api/Profile/{id}.
   */
  flairMedalId?: string | null;
  /** Ordered list of unlocked medal IDs the user wants shown by default. */
  flairOrder?: string[] | null;
}

/**
 * Strict ProfileUpdateRequest payload. Mirrors `ProfileUpdateRequest` in
 * swagger.json:17900-17955 (the PUT/PATCH /api/Profile/{id} body shape).
 *
 *   - `userId` is REQUIRED by the BE. The FE always sends the authenticated
 *     user's id here; never a client-controlled value.
 *   - Every other field is nullable and OPTIONAL. Callers MUST NOT include
 *     fields the BE does not publish (additionalProperties:false on the
 *     schema). The form only sends the keys the user actually changed —
 *     partial PATCH semantics — so the BE doesn't overwrite unrelated
 *     fields with null.
 *
 * Why we pick only the fields we set: the live contract is a PUT but the
 * controller is also exposed as PATCH (partial update). Sending a sparse
 * object lets us PATCH without clearing unchanged fields, and the same
 * sparse object is the canonical PUT body because the form only knows the
 * fields it actually edited.
 *
 * NOTE on flair fields (added 2026-09-05)
 *   The Profile page renders a Reddit-style featured-flair picker that
 *   lets the owner pick one unlocked medal and reorder the rest. The
 *   picker persists the selection in `ars_flair_<userId>` (localStorage)
 *   and `UserFlairBadge` rehydrates from the same key on read. We
 *   intentionally do NOT include those fields in ProfileUpdateRequest —
 *   the live Swagger schema (swagger.json:17900-17955) does not declare
 *   them, and shipping undocumented keys in a PUT/PATCH body would fail
 *   the BE's `additionalProperties: false` check with a 400. When the BE
 *   formally ships flair columns, add `flairMedalId` and `flairOrder`
 *   here AND to PROFILE_UPDATE_KEYS together.
 */
export interface ProfileUpdateRequest {
  userId: number;
  fullName?: string | null;
  academicTitle?: string | null;
  phoneNumber?: string | null;
  institution?: string | null;
  bio?: string | null;
  keywords?: string[] | null;
  avatarInitials?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
}

/**
 * Allowed keys in `ProfileUpdateRequest`. Used to defensively strip any
 * frontend-only / unmapped fields before sending the PUT/PATCH payload.
 * Centralized so the page form and the hook can both call
 * `pickProfileUpdateFields(...)` without diverging.
 *
 * MUST match exactly the keys declared on `ProfileUpdateRequest` above,
 * which in turn mirrors swagger.json:17900-17955. If you add a new
 * field, add it to BOTH places and update the smoke test in
 * `tests/unit/services/profile.service.test.ts`.
 */
export const PROFILE_UPDATE_KEYS = [
  'userId',
  'fullName',
  'academicTitle',
  'phoneNumber',
  'institution',
  'bio',
  'keywords',
  'avatarInitials',
  'dateOfBirth',
  'gender',
  'address',
] as const;

export type ProfileUpdateKey = (typeof PROFILE_UPDATE_KEYS)[number];

/**
 * Strip unknown keys from a candidate update object. Returns a fresh object
 * containing ONLY the documented `ProfileUpdateRequest` fields, with
 * `userId` always set (REQUIRED by the BE).
 *
 * The function is the single chokepoint for payload shape — call it from
 * every write path so the wire shape can never accidentally drift beyond
 * the Swagger contract.
 */
export function pickProfileUpdateFields(
  candidate: Partial<ProfileUpdateRequest>,
  authenticatedUserId: number,
): ProfileUpdateRequest {
  const allowed: Record<string, unknown> = { userId: authenticatedUserId };
  for (const key of PROFILE_UPDATE_KEYS) {
    if (key === 'userId') continue;
    const value = (candidate as Record<string, unknown>)[key];
    if (value !== undefined) {
      allowed[key] = value;
    }
  }
  return allowed as unknown as ProfileUpdateRequest;
}

/**
 * Per-role display preferences for the Profile page. The role does NOT
 * gate which fields can be EDITED — every authenticated user owns the same
 * set of profile fields per the BE contract. The role only changes the
 *   1. the eyebrow / page heading tone,
 *   2. the focus-hint copy,
 *   3. which fields are highlighted as "primary".
 *
 * This object is the single source of truth shared between the page and
 * the hook; tests rely on this table for role-specific expectations.
 */
export const ROLE_PROFILE_META: Record<
  'Researcher' | 'Reviewer' | 'Lecturer' | 'Graduate Student' | 'Admin',
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    accentVar: string;
    /**
     * Which fields to highlight first in the form grid. Always a subset of
     * the supported ProfileUpdateRequest fields. Order is meaningful — the
     * page renders these fields first.
     */
    primaryFields: ReadonlyArray<ProfileUpdateKey>;
  }
> = {
  Researcher: {
    eyebrow: 'RESEARCHER WORKSPACE',
    title: 'Researcher Profile',
    subtitle:
      'Public profile shown to reviewers, researchers, and students who discover your work.',
    accentVar: 'var(--ars-researcher, #b45309)',
    primaryFields: ['fullName', 'academicTitle', 'institution', 'bio', 'keywords'],
  },
  Reviewer: {
    eyebrow: 'REVIEWER WORKSPACE',
    title: 'Reviewer Profile',
    subtitle:
      'Identity surface visible to researchers when you accept or decline review invitations.',
    accentVar: 'var(--ars-reviewer, #065f46)',
    primaryFields: ['fullName', 'academicTitle', 'institution', 'bio', 'keywords'],
  },
  Lecturer: {
    eyebrow: 'LECTURER WORKSPACE',
    title: 'Lecturer Profile',
    subtitle:
      'Profile visible to students in your research groups and to admin moderation surfaces.',
    accentVar: 'var(--ars-lecturer, #7c2d12)',
    primaryFields: ['fullName', 'academicTitle', 'institution', 'phoneNumber', 'bio'],
  },
  'Graduate Student': {
    eyebrow: 'GRADUATE STUDENT WORKSPACE',
    title: 'Graduate Student Profile',
    subtitle:
      'Profile visible to your supervising lecturer and to research group members.',
    accentVar: 'var(--ars-gradstudent, #1e3a8a)',
    primaryFields: ['fullName', 'academicTitle', 'institution', 'bio', 'keywords'],
  },
  Admin: {
    eyebrow: 'SYSTEM ADMIN',
    title: 'Admin Profile',
    subtitle:
      'Profile shown in admin audit logs and account-management surfaces.',
    accentVar: 'var(--ars-admin, #4c1d95)',
    primaryFields: ['fullName', 'academicTitle', 'institution', 'phoneNumber', 'address'],
  },
};

/**
 * Resolve the role-specific profile meta for a role string. Falls back to
 * Researcher when the role is missing/unknown — admin / guest sessions
 * always render something sensible.
 */
export function resolveRoleProfileMeta(role: string | null | undefined) {
  const fallback = ROLE_PROFILE_META.Researcher;
  if (!role) return fallback;
  if (role in ROLE_PROFILE_META) {
    return ROLE_PROFILE_META[role as keyof typeof ROLE_PROFILE_META];
  }
  return fallback;
}

/**
 * Client-side validation rules for the editable fields. The BE applies its
 * own server-side validation; these rules only fail-fast on obvious typos
 * so the user gets a useful message before the PUT/PATCH round-trip.
 *
 * Length bounds are conservative and match the practical limits a real
 * academic bio would need (no Swagger-published maxLength, so we err on
 * the side of generous limits rather than over-validating).
 */
export const PROFILE_VALIDATION = {
  fullName: { minLength: 1, maxLength: 200 },
  academicTitle: { maxLength: 200 },
  phoneNumber: { maxLength: 32, pattern: /^[+0-9 ()-]*$/ },
  institution: { maxLength: 200 },
  bio: { maxLength: 4000 },
  keywords: { maxItems: 50, maxItemLength: 64 },
  avatarInitials: { maxLength: 4, pattern: /^[A-Za-z0-9 ]*$/ },
  address: { maxLength: 400 },
} as const;
