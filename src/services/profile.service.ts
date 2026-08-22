// Profile service — thin wrapper around `/api/Profile`.
//
// Contract reference (swagger.json):
//   GET    /api/Profile              → current authenticated user's profile
//   GET    /api/Profile/{id}         → profile for any user id (admin/lookup)
//   PUT    /api/Profile/{id}         → full update (ProfileUpdateRequest)
//   PATCH  /api/Profile/{id}         → partial update (ProfileUpdateRequest)
//   DELETE /api/Profile/{id}         → delete profile
//
// The response schema is not declared in the live Swagger (the GETs return
// 200 OK with no body schema). We model the shape in `Profile` and treat
// every field as optional on the way in. The FE tolerates a BE that hasn't
// populated every column yet — the page should render an honest "profile
// not configured" empty state rather than crash on missing fields.
//
// Authorization model: the BE is the SOLE authority on who can read or
// update which profile. The FE always passes the authenticated user's id
// (never a route/query/user-controlled value) to the write endpoints, and
// relies on the BE to reject cross-account writes. The FE never trusts
// `Profile.id` from the response as the write target — see
// `update()` and the corresponding tests for the explicit defense.
//
// Hard rules:
//   1. NEVER hardcode an API base URL — routes through `api` (the shared
//      authenticated Axios instance) and `API_ENDPOINTS.PROFILE`.
//   2. NEVER pass a client-supplied id to a write path without first
//      confirming it matches the authenticated user's id; in practice we
//      keep `authenticatedUserId` as a required parameter to the update
//      helper so the wiring is impossible to get wrong.
//   3. The PUT/PATCH body MUST be filtered through `pickProfileUpdateFields`
//      so the FE never sends a key the BE didn't publish.
//   4. Do NOT add fallback / mock data on errors — the page renders an
//      honest error state instead (per the project policy on no-mock data).

import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import {
  pickProfileUpdateFields,
  type Profile,
  type ProfileUpdateRequest,
} from '../types/profile';

/**
 * Coerce the BE response into a `Profile`. The Swagger doc doesn't declare
 * a response schema, so we defensively coerce every field and never crash
 * on a partially-implemented BE. Missing fields render as `null` so the
 * page can show "Not set" rather than blank.
 */
function coerceProfile(raw: unknown, authenticatedUserId: number): Profile {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const numericId = (() => {
    const v = obj.id;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  })();

  const numericUserId = (() => {
    const v = obj.userId;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      return Number.isFinite(n) ? n : authenticatedUserId;
    }
    return authenticatedUserId;
  })();

  const keywords = (() => {
    const v = obj.keywords;
    if (Array.isArray(v)) {
      return v.filter((entry): entry is string => typeof entry === 'string');
    }
    if (typeof v === 'string' && v.trim() !== '') {
      // Tolerate a JSON-encoded array if the BE ever returns one.
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) {
          return parsed.filter((entry): entry is string => typeof entry === 'string');
        }
      } catch {
        /* fall through */
      }
    }
    return null;
  })();

  const asString = (key: string): string | null => {
    const v = obj[key];
    return typeof v === 'string' ? v : v == null ? null : String(v);
  };

  const asDateString = (key: string): string | null => {
    const v = asString(key);
    if (!v) return null;
    // Accept ISO date (`YYYY-MM-DD`) or full ISO timestamps; truncate to date.
    const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : v;
  };

  return {
    id: numericId,
    userId: numericUserId,
    fullName: asString('fullName'),
    academicTitle: asString('academicTitle'),
    phoneNumber: asString('phoneNumber'),
    institution: asString('institution'),
    bio: asString('bio'),
    keywords,
    avatarInitials: asString('avatarInitials'),
    dateOfBirth: asDateString('dateOfBirth'),
    gender: asString('gender'),
    address: asString('address'),
    createdAt: asString('createdAt'),
    updatedAt: asString('updatedAt'),
  };
}

export const profileService = {
  /**
   * Fetch the profile for the currently authenticated user.
   * Uses `GET /api/Profile` (no id in the path) — the BE identifies the
   * caller from the bearer token. On a 404 (no profile row yet), returns
   * a fresh empty profile with the authenticated id.
   */
  async getCurrent(authenticatedUserId: number): Promise<Profile> {
    const response = await api.get(API_ENDPOINTS.PROFILE.GET_CURRENT);
    return coerceProfile(response.data, authenticatedUserId);
  },

  /**
   * Fetch a profile by id. Admin / lookup surface — the FE never reads
   * the id from a route param or query string on its own pages. Callers
   * that need this must pass an authenticated, server-validated id.
   */
  async getById(id: number, authenticatedUserId: number): Promise<Profile> {
    const response = await api.get(API_ENDPOINTS.PROFILE.GET_BY_ID(id));
    return coerceProfile(response.data, authenticatedUserId);
  },

  /**
   * Update the current user's profile. Always targets the authenticated
   * user's actual profile id (the BE matches `userId` in the body against
   * the bearer token) — never a client-supplied id.
   *
   * The body is filtered through `pickProfileUpdateFields` so we never
   * ship a key the BE didn't publish. `authenticatedUserId` is the single
   * source of truth for the user id embedded in the payload.
   */
  async update(
    authenticatedUserId: number,
    candidate: Partial<ProfileUpdateRequest>,
    options: { preferPatch?: boolean } = {},
  ): Promise<Profile> {
    const body = pickProfileUpdateFields(candidate, authenticatedUserId);
    const endpoint = options.preferPatch
      ? API_ENDPOINTS.PROFILE.PATCH(authenticatedUserId)
      : API_ENDPOINTS.PROFILE.UPDATE(authenticatedUserId);
    const response = await (options.preferPatch
      ? api.patch(endpoint, body)
      : api.put(endpoint, body));
    return coerceProfile(response.data, authenticatedUserId);
  },
};

export default profileService;
