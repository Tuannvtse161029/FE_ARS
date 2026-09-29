// Centralised helpers for hiding database identifiers from non-Admin users.
//
// Per the QA report's recommendation, internal database IDs (`User #14`,
// `Group #38`, `Topic #7`, etc.) are operational artefacts that exist so the
// backend can resolve rows. End users in Reviewer / Researcher / Lecturer /
// Graduate Student roles do not need them and should not see them.
//
// Admin users still see the IDs because they operate the platform.
//
// Pattern used by callers:
//   - `formatEntityIdLabel('User', user.id, { canViewIds: isAdmin })` returns
//     either `'User #14'` (Admin) or `'User'` (everyone else).
//   - For `null`/`undefined` IDs, returns the same anonymous fallback for
//     every role so the UI never silently leaks a placeholder like
//     `'User #undefined'` to a non-Admin.
//
// This file deliberately depends only on `usePermissions`-friendly inputs
// (a boolean flag, not the whole auth store) so it stays usable from
// services, hooks, and non-React call sites (where `useAuth()` is not
// available). Components that already have `usePermissions()` should pass
// `canViewAdminPanel`. Callers without a hook can call `shouldExposeIds()`
// with the auth snapshot.

import type { EffectiveRole } from '../types/auth';

export interface RoleSnapshotLike {
  effectiveRole?: EffectiveRole | string | null;
  role?: string | null;
  roleName?: string | null;
  roleId?: number | null;
  isActive?: boolean | null;
}

const ANONYMOUS_FALLBACK: Readonly<Record<string, string>> = {
  User: 'User',
  Reviewer: 'Reviewer',
  Lecturer: 'Lecturer',
  Student: 'Student',
  Group: 'Group',
  Topic: 'Topic',
  Material: 'Material',
  Report: 'Report',
  Phase: 'Phase',
  Comment: 'Comment',
  Plan: 'Plan',
  Medal: 'Medal',
};

/**
 * True iff the snapshot identifies an Admin user. Mirrors the dual-signal
 * check used by `usePermissions().canViewAdminPanel` so the FE never
 * disagrees about who can see IDs.
 */
export function shouldExposeIds(snapshot: RoleSnapshotLike | null | undefined): boolean {
  if (!snapshot) return false;
  const roleName = (snapshot.effectiveRole ?? snapshot.role ?? snapshot.roleName ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  if (roleName === 'admin') return true;
  if (snapshot.roleId === 2) return true;
  return false;
}

/**
 * Build a UI label for an entity that may or may not expose its database
 * ID. Returns either `"<Kind> #<id>"` (when `canViewIds` is true and `id`
 * is a positive number) or an anonymous fallback string.
 *
 * Examples:
 *   formatEntityIdLabel('User', 14, true)  -> 'User #14'
 *   formatEntityIdLabel('User', 14, false) -> 'User'
 *   formatEntityIdLabel('User', null, false) -> 'User'
 */
export function formatEntityIdLabel(
  kind: keyof typeof ANONYMOUS_FALLBACK | string,
  id: number | string | null | undefined,
  canViewIds: boolean,
): string {
  const fallback = ANONYMOUS_FALLBACK[kind] ?? kind;
  if (!canViewIds) return fallback;
  if (id === null || id === undefined) return fallback;
  const numeric = typeof id === 'number' ? id : Number(id);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return `${fallback} #${numeric}`;
}

/**
 * Trim a `#<id>` suffix off an arbitrary label so we never accidentally
 * surface an internal ID to a non-Admin. Useful for normalising server-
 * provided titles that include an ID fallback (e.g. `'Topic #7'`).
 */
export function stripIdSuffix(label: string | null | undefined): string {
  if (!label) return '';
  return label.replace(/\s*#\d+\s*$/u, '').trim();
}
