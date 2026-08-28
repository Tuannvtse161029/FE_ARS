import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/paths';
import { readStoredUser } from '../utils/storedUser';
import { isAdminUser } from '../utils/roleNormalizer';
import type { VerificationStatus } from '../types/auth';

// Sends unverified users to /forum. Used by every private route except /forum
// so a freshly-registered user landing on /dashboard, /papers, etc. gets bounced
// to the only page they have read-only access to.
const isFullyApproved = (
  isActive: boolean | undefined,
  verificationStatus: VerificationStatus | null | undefined
): boolean => {
  return Boolean(isActive) && verificationStatus === 'Accepted';
};

export const useVerifiedGuard = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN, { replace: true });
      return;
    }

    const stored = readStoredUser();

    // Admins bypass the role-request lifecycle. They are DB-provisioned only.
    if (isAdminUser({
      roleName: user?.role ?? stored?.roleName ?? null,
      roleId: stored?.roleId ?? null,
    })) {
      return;
    }

    const isActive = user?.isActive ?? stored?.isActive ?? false;
    const rawStatus = user?.verificationStatus ?? stored?.verificationStatus ?? null;
    const verificationStatus =
      rawStatus === 'Accepted' || rawStatus === 'Rejected' || rawStatus === 'Pending'
        ? rawStatus
        : null;

    if (isFullyApproved(isActive, verificationStatus)) return;

    // If already on /forum, do NOT navigate or log errors — Guest has legitimate read-only access to /forum!
    if (location.pathname === ROUTES.FORUM) return;

    const currentRole = user?.role ?? stored?.roleName;
    const hasStaleRole =
      currentRole &&
      currentRole !== 'Guest' &&
      !isFullyApproved(isActive, verificationStatus);

    if (hasStaleRole) {
      console.warn(
        '[useVerifiedGuard] Non-approved user attempted to access protected route.',
        { isActive, verificationStatus, role: currentRole }
      );
    }

    // Land them on /forum (replace so back button doesn't trap them).
    navigate(ROUTES.FORUM, { replace: true });
  }, [user, isAuthenticated, location.pathname, navigate]);
};

export default useVerifiedGuard;
