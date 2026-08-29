import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { BusinessRole } from '../types/auth';
import { isRequestableRole, type RequestableRole } from '../utils/registrationRoles';

/** The role directory row returned by GET /api/Role. */
export interface RoleItem {
  roleId?: number;
  name: string;
  createdAt?: string;
}

// Policy allow-list only. This is not the source of role data; the selector
// uses fetchRoles()/fetchBusinessRolesForOnboarding() and filters the live
// directory against this set so Admin/Guest cannot be self-requested.
export const ALLOWED_ONBOARDING_ROLES: ReadonlyArray<RequestableRole> = [
  'Researcher',
  'Reviewer',
  'Lecturer',
  'Graduate Student',
];

function normalizeRoles(payload: unknown): RoleItem[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : payload && typeof payload === 'object' && Array.isArray((payload as { roles?: unknown }).roles)
        ? (payload as { roles: unknown[] }).roles
        : [];

  const seen = new Set<string>();
  return rows.reduce<RoleItem[]>((result, row) => {
    if (!row || typeof row !== 'object') return result;
    const value = row as { roleId?: unknown; id?: unknown; name?: unknown; roleName?: unknown; createdAt?: unknown };
    const name = typeof value.name === 'string'
      ? value.name.trim()
      : typeof value.roleName === 'string'
        ? value.roleName.trim()
        : '';
    if (!name || seen.has(name)) return result;
    seen.add(name);
    const roleId = Number(value.roleId ?? value.id);
    result.push({
      name,
      ...(Number.isFinite(roleId) && roleId > 0 ? { roleId } : {}),
      ...(typeof value.createdAt === 'string' ? { createdAt: value.createdAt } : {}),
    });
    return result;
  }, []);
}

/** Fetch the backend role directory. Errors are intentionally propagated. */
export async function fetchRoles(): Promise<RoleItem[]> {
  const response = await api.get(API_ENDPOINTS.ROLE.GET_ALL);
  return normalizeRoles(response.data);
}

/** Fetch only roles that users may request during onboarding. */
export async function fetchBusinessRolesForOnboarding(): Promise<RequestableRole[]> {
  const roles = await fetchRoles();
  const requestable = roles
    .map((role) => role.name)
    .filter((name): name is RequestableRole => isRequestableRole(name));
  if (requestable.length === 0) {
    throw new Error('The backend returned no requestable roles. Please try again later.');
  }
  return requestable;
}

export const roleService = {
  fetchRoles,
  fetchBusinessRolesForOnboarding,
  isOnboardingSelectable(role: string | null | undefined): role is BusinessRole {
    return isRequestableRole(role);
  },
};

export default roleService;
