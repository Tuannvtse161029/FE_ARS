// Agent 52 — Role directory service.
//
// Wraps `GET /api/Role` (per Swagger: 200 OK, no schema) and exposes a list
// of business roles for the onboarding page's role selector.
//
// Hard rules:
//   1. We NEVER fabricate role data — the only source is the BE.
//   2. We NEVER include `Guest` in the returned list, even if the BE returns
//      it. Guest is an effective-time variant only (see `EffectiveRole` in
//      src/types/auth.ts) — it has no `RoleId`, it never appears in
//      `GET /api/Role`, and surfacing it in the selector would let users
//      self-assign a role that should only ever be BE-derived.
//   3. Admin is also excluded from the onboarding selector — Admin accounts
//      are DB-provisioned only (matches the existing Register page's
//      RequestableRole = Exclude<BusinessRole, 'Admin'>).
//   4. When the BE is unreachable, the service throws — never falls back to
//      a hardcoded list. The page renders an honest empty/error state.
//
// We support several common wire shapes because the live Swagger doesn't
// publish a schema — the BE may echo `name`, `roleName`, or `{ name, id }`.

import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { BusinessRole } from '../types/auth';

export interface RoleItem {
  /** Stable identifier from the BE (preferred for selection). */
  roleId?: number;
  /** Display name from the BE — mapped onto BusinessRole where possible. */
  name: string;
}

export const ALLOWED_ONBOARDING_ROLES: ReadonlyArray<BusinessRole> = [
  'Researcher',
  'Reviewer',
  'Lecturer',
  'Graduate Student',
];

const KNOWN_BUSINESS_ROLES: ReadonlySet<BusinessRole> = new Set<BusinessRole>([
  'Researcher',
  'Admin',
  'Reviewer',
  'Lecturer',
  'Graduate Student',
]);

function coerceToBusinessRole(value: unknown): BusinessRole | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (KNOWN_BUSINESS_ROLES.has(trimmed as BusinessRole)) {
    return trimmed as BusinessRole;
  }
  return null;
}

function normaliseEntry(entry: unknown): BusinessRole | null {
  if (typeof entry === 'string') return coerceToBusinessRole(entry);
  if (entry && typeof entry === 'object') {
    const obj = entry as {
      name?: unknown;
      roleName?: unknown;
      role?: unknown;
      roleId?: unknown;
    };
    // Prefer the explicit name fields first; fall back to nested role.name.
    const fromName = coerceToBusinessRole(obj.name);
    if (fromName) return fromName;
    const fromRoleName = coerceToBusinessRole(obj.roleName);
    if (fromRoleName) return fromRoleName;
    const fromRole =
      obj.role && typeof obj.role === 'object'
        ? coerceToBusinessRole(
            (obj.role as { name?: unknown; roleName?: unknown }).name ??
              (obj.role as { name?: unknown; roleName?: unknown }).roleName,
          )
        : null;
    if (fromRole) return fromRole;
  }
  return null;
}

/**
 * Fetch business roles from the BE and return only those safe to surface
 * on the onboarding page's selector.
 *
 * - Drops `Guest` if the BE returns it (we never want to display it).
 * - Drops `Admin` (DB-provisioned only, mirrors Register's RequestableRole).
 * - Dedupes, preserves the order the BE returned.
 */
export async function fetchBusinessRolesForOnboarding(): Promise<BusinessRole[]> {
  const response = await api.get(API_ENDPOINTS.ROLE.GET_ALL);
  const data = response.data;

  let rawList: unknown[] = [];
  if (Array.isArray(data)) {
    rawList = data;
  } else if (data && typeof data === 'object') {
    // Tolerate wrappers like `{ items: [...] }` or `{ roles: [...] }`.
    const obj = data as { items?: unknown; roles?: unknown; data?: unknown };
    const candidate = obj.items ?? obj.roles ?? obj.data;
    if (Array.isArray(candidate)) rawList = candidate;
  }

  const seen = new Set<BusinessRole>();
  const result: BusinessRole[] = [];
  for (const entry of rawList) {
    const role = normaliseEntry(entry);
    if (!role) continue;
    if (role === 'Admin') continue; // DB-provisioned; never user-selectable
    if (!ALLOWED_ONBOARDING_ROLES.includes(role)) continue; // drops Guest implicitly
    if (seen.has(role)) continue;
    seen.add(role);
    result.push(role);
  }
  return result;
}

export const roleService = {
  fetchBusinessRolesForOnboarding,
  /**
   * Exposed for unit tests / page guards. Returns true if the role would be
   * allowed on the onboarding page selector.
   */
  isOnboardingSelectable(role: string | null | undefined): boolean {
    return typeof role === 'string' && ALLOWED_ONBOARDING_ROLES.includes(role as BusinessRole);
  },
};

export default roleService;
