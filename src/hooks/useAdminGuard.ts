import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/paths';
import { isAdminUser } from '../utils/roleNormalizer';

// Sends non-admins to the forum. Used by every Admin/* page so a regular
// user landing on /admin/* gets bounced out before seeing any chrome.
//
// Reads BOTH `roleName` and `roleId` from the auth store. The BE
// AuthController currently has an off-by-one bug that returns `roleId: 0` for
// admin accounts (see docs/local-only/admin-suite-be-gap-report.md), so the
// guard has to keep accepting both signals until BE fixes the mapping.
export const useAdminGuard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // The AuthContext exposes `user.role` as `authStore.user.roleName`.
    // The full User entity (which also carries `roleId`) is on the store but
    // not exposed through `useAuth()` today — pull it directly to keep the
    // guard working even when BE ships only the roleId fix and not the
    // roleName fix (or vice versa).
    const stored = (() => {
      try {
        const raw =
          localStorage.getItem('ars_user') || sessionStorage.getItem('ars_user');
        return raw ? (JSON.parse(raw) as { roleId?: number; roleName?: string }) : null;
      } catch {
        return null;
      }
    })();

    const admin = isAdminUser({
      roleName: user?.role ?? stored?.roleName ?? null,
      roleId: stored?.roleId ?? null,
    });
    if (!admin) {
      navigate(ROUTES.FORUM, { replace: true });
    }
  }, [user, navigate]);
};

export default useAdminGuard;