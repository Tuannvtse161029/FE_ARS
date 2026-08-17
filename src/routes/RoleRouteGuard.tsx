// RoleRouteGuard — enforces per-route role-based access control.
//
// Source of truth: docs/local-only/research-workflow-contract.md §4 + §9.
//
// Existing `PrivateRoute` only checks `isAuthenticated`. RBAC is enforced
// HERE so a Graduate Student typing `/research-group` into the address bar
// is redirected to their landing page rather than seeing the Lecturer-only
// page render with empty data.
//
// Usage:
//
//   <Route element={<RoleRouteGuard allow={['Lecturer']} />}>
//     <Route path={ROUTES.RESEARCH_GROUP} element={<ResearchGroup />} />
//   </Route>
//
// Multi-role users (the BE may return more than one role on a single
// account) pass the guard as long as AT LEAST ONE of their roles is in
// `allow`. Unauthenticated users fall through `PrivateRoute` (the parent
// route in App.tsx) which redirects to `/login`.

import { Navigate, Outlet } from 'react-router-dom';
import type { ReactElement } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from './paths';
import { landingRouteForRoleName } from '../utils/roleNormalizer';
import type { UserRole } from '../types/auth';

export interface RoleRouteGuardProps {
  allow: ReadonlyArray<UserRole>;
  // Where to send unauthorized users. Defaults to the user's role-based
  // landing route (per roleNormalizer).
  fallback?: string;
}

const isAllowed = (
  userRole: UserRole | undefined,
  allow: ReadonlyArray<UserRole>,
): boolean => {
  if (!userRole) return false;
  return allow.includes(userRole);
};

export const RoleRouteGuard = ({
  allow,
  fallback,
}: RoleRouteGuardProps): ReactElement => {
  const { user, isAuthenticated } = useAuth();

  // Auth gate is delegated to PrivateRoute; this guard focuses on RBAC.
  // Defensive: if the parent route somehow forgot to wrap with PrivateRoute,
  // bounce to login instead of leaking data.
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  const userRole = user?.role as UserRole | undefined;

  if (!isAllowed(userRole, allow)) {
    const redirect = fallback ?? landingRouteForRoleName(userRole ?? null);
    return <Navigate to={redirect} replace />;
  }

  return <Outlet />;
};

export default RoleRouteGuard;
