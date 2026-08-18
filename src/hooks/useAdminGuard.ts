import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/paths';
import { isAdminUser } from '../utils/roleNormalizer';
import { readStoredUser } from '../utils/storedUser';

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
    const stored = readStoredUser();
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
