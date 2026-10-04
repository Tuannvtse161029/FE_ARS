import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/paths';
import { readStoredUser, readStoredUserAsync } from '../utils/storedUser';
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
  const { user, isAuthenticated, isLoading, effectiveRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Agent 55 — also read the encrypted envelope asynchronously so a
  // freshly-opened sibling tab resolves the verified-guard with the
  // correct user on the very next render, instead of misclassifying
  // an already-authenticated user as unverified and bouncing them to
  // /forum when they were trying to open /dashboard, /papers, etc.
  const [encryptedSnapshot, setEncryptedSnapshot] = useState<{
    isActive: boolean;
    roleName: string | null;
    roleId: number | null;
    verificationStatus: VerificationStatus | null;
    requiresOnboarding: boolean | null;
    isNewUser: boolean | null;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await readStoredUserAsync();
      if (cancelled) return;
      if (result) {
        setEncryptedSnapshot({
          isActive: result.isActive,
          roleName: result.roleName,
          roleId: result.roleId,
          verificationStatus:
            result.verificationStatus === 'Accepted' ||
            result.verificationStatus === 'Rejected' ||
            result.verificationStatus === 'Pending'
              ? result.verificationStatus
              : null,
          requiresOnboarding: result.requiresOnboarding ?? null,
          isNewUser: result.isNewUser ?? null,
        });
      } else {
        setEncryptedSnapshot(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN, { replace: true });
      return;
    }

    const stored = readStoredUser();

    // Admins bypass the role-request lifecycle. They are DB-provisioned only.
    const effectiveRoleName =
      user?.role ??
      encryptedSnapshot?.roleName ??
      stored?.roleName ??
      null;
    const effectiveRoleId =
      (user as { roleId?: number | null } | null)?.roleId ??
      encryptedSnapshot?.roleId ??
      stored?.roleId ??
      null;
    if (isAdminUser({
      roleName: effectiveRoleName,
      roleId: effectiveRoleId,
    })) {
      return;
    }

    const isActive =
      user?.isActive ??
      encryptedSnapshot?.isActive ??
      stored?.isActive ??
      false;
    const rawStatus =
      user?.verificationStatus ??
      encryptedSnapshot?.verificationStatus ??
      stored?.verificationStatus ??
      null;
    const verificationStatus =
      rawStatus === 'Accepted' || rawStatus === 'Rejected' || rawStatus === 'Pending'
        ? rawStatus
        : null;

    if (isFullyApproved(isActive, verificationStatus)) return;

    // If already on /forum, do NOT navigate or log errors — Guest has legitimate read-only access to /forum!
    if (location.pathname === ROUTES.FORUM) return;

    const currentRole = effectiveRoleName;
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
  }, [user, isAuthenticated, isLoading, location.pathname, navigate, encryptedSnapshot, effectiveRole]);
};

export default useVerifiedGuard;
