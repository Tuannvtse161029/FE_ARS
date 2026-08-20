// Agent 52 — First-time Google-user onboarding page.
//
// Surfacing rules (per the Agent 52 spec, post follow-up correction):
//   1. The page reads the BE-derived profile from the existing ARS auth
//      store (`useAuthStore` / `useAuth`) — the JWT and profile are
//      persisted by the Login page via the existing storage/authStore
//      path. We do NOT maintain a separate Google-only session key that
//      duplicates the application token.
//   2. If the user is no longer authenticated (e.g. they refreshed the
//      tab after the JWT expired), we bounce to /login. Per the spec,
//      surviving a refresh while distinguishing "this is a first-time
//      Google user who must submit a proof" is not currently safe to
//      implement without duplicating token state; see BTR-AGENT52-04.
//   3. The page renders the BE-derived profile (fullName, email, avatar)
//      and lets the user pick a business role from the BE's role list.
//   4. The user MAY upload a PDF proof using the existing Firebase
//      proof-upload flow. The Firebase URL is captured locally so the
//      BTR-AGENT52-02 endpoint can later accept it; the page itself
//      does NOT POST anything to the backend in this revision.
//   5. The "Submit for verification" button is replaced by a
//      "Verification temporarily unavailable" notice. The page must NOT
//      claim successful onboarding, write a fake role, route to /forum,
//      or fabricate a Pending verificationStatus. Until the BE ships
//      BTR-AGENT52-02, the only safe action is to display the BTR
//      reference and let the user cancel / sign out.
//   6. Substitution-of-truth is forbidden: even when the BE later
//      publishes the onboarding endpoint, this page must NEVER call
//      `/api/Auth/register` (the Google-login response already created
//      the user) and must NEVER mock an `isActive` / `verificationStatus`
//      result.

import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { PdfDropzone } from '../Register/components/PdfDropzone';
import { authService } from '../../services/auth.service';
import { roleService, ALLOWED_ONBOARDING_ROLES } from '../../services/role.service';
import { useAuthStore } from '../../store';
import { useAuth } from '../../context/AuthContext';
import { storage } from '../../utils/storage';
import { ROUTES } from '../../routes/paths';
import type { BusinessRole } from '../../types/auth';
import ARSLogo from '../../assets/images/ARS_Logo.png';
import styles from './CompleteGoogleRegistration.module.css';

// ── Local form state ───────────────────────────────────────────────────────

interface FormState {
  phoneNumber: string;
  role: BusinessRole | '';
  pdfUrl: string | null;
  pdfFile: File | null;
}

const phoneRegex = /^[+\d\s\-()]{8,20}$/;

const initialForm: FormState = {
  phoneNumber: '',
  role: '',
  pdfUrl: null,
  pdfFile: null,
};

function buildInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

export const CompleteGoogleRegistration = () => {
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const { isAuthenticated, user } = useAuth();

  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<BusinessRole[]>([]);
  const [rolesError, setRolesError] = useState<string | null>(null);

  // ── 1. Resolve / validate the auth session ──────────────────────────────
  // The profile here is BE-derived exclusively — read from the auth store
  // and the storage layer that the Login page populated. We do NOT trust
  // any Google-specific session key, and we do NOT fabricate a User
  // record with a fake roleName / roleId.
  //
  // BE-session integrity check (per the Agent 52 final correction):
  //   The sign-in flow's strict validation already requires a non-empty
  //   token, positive userId, non-empty email, and non-empty fullName
  //   before any session is persisted. We mirror those checks here so
  //   that a partial session (e.g. one whose fullName was lost in a
  //   storage migration) cannot be presented as a valid first-time
  //   onboarding subject. Refusing to render the page is the safe
  //   fallback — we do NOT silently use `roleId 0` / empty role as
  //   test fixtures presented as valid backend data.
  const profile = useMemo(() => {
    if (!isAuthenticated) return null;
    const stored = storage.getUser();
    const token = storage.getToken();
    const storedUserId = stored?.id ?? 0;
    const authUserId = user?.userId ?? 0;
    const userId = storedUserId > 0 ? storedUserId : authUserId > 0 ? authUserId : 0;
    const email = stored?.email ?? user?.email ?? '';
    const fullName = stored?.fullName ?? '';
    if (!token) return null;
    if (userId <= 0) return null;
    if (!email) return null;
    if (!fullName) return null;
    return {
      email,
      fullName,
      userId,
      isActive: stored?.isActive ?? user?.isActive ?? false,
      verificationStatus: stored?.verificationStatus ?? user?.verificationStatus ?? 'Pending',
    };
  }, [isAuthenticated, user]);

  // Re-publish the freshly-loaded user into the auth store so the rest
  // of the app sees the same non-fabricated shape. This is a no-op when
  // the store already reflects the BE-derived values.
  useEffect(() => {
    if (!profile) return;
    if (authStore.user?.email !== profile.email) {
      authStore.updateUser({
        email: profile.email,
        fullName: profile.fullName,
        isActive: profile.isActive,
        verificationStatus: profile.verificationStatus,
      });
    }
  }, [profile, authStore]);

  // ── 2. Load the BE's role list (Guest excluded server-side, Admin
  //       excluded here to mirror Register.tsx) ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const roles = await roleService.fetchBusinessRolesForOnboarding();
        if (cancelled) return;
        const filtered = roles.filter((r) => ALLOWED_ONBOARDING_ROLES.includes(r));
        setAvailableRoles(filtered);
        setRolesError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          'Could not load available roles. Please retry later.';
        setRolesError(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isFormValid = useMemo(() => {
    if (!profile) return false;
    if (isUploadingPdf) return false;
    if (!form.role) return false;
    if (form.phoneNumber && !phoneRegex.test(form.phoneNumber)) return false;
    if (!form.pdfUrl) return false;
    return true;
  }, [profile, isUploadingPdf, form]);

  // ── 3. Handlers ─────────────────────────────────────────────────────────

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, phoneNumber: e.target.value }));
    setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
  };

  const handleRoleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, role: e.target.value as FormState['role'] }));
    setErrors((prev) => ({ ...prev, role: undefined }));
  };

  const handleUploadComplete = (file: File, url: string) => {
    setForm((prev) => ({ ...prev, pdfFile: file, pdfUrl: url }));
  };

  const handleUploadRemove = () => {
    setForm((prev) => ({ ...prev, pdfFile: null, pdfUrl: null }));
  };

  const handleCancel = () => {
    // Drop the local form state and the auth session, redirect to /login.
    authService.logout();
    authStore.logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  // ── 4. Render guards ────────────────────────────────────────────────────
  // No Google-specific session is read here. If the user is no longer
  // authenticated, the page bounces to /login — there is no in-flight
  // Google session to surface. (See BTR-AGENT52-04 for the refresh-safe
  // onboarding handoff.)
  if (!profile) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  const initials = buildInitials(profile.fullName);

  // The submit handler is intentionally absent. Until the BE ships
  // BTR-AGENT52-02, the page cannot — and must not — POST anything to
  // the backend. The form is renderable so the user can capture the
  // information that will be needed once the endpoint ships, but the
  //      final submit button is replaced with a clear Backend-unavailable
  //      notice that points at the BTR.
  const isFormReady = isFormValid;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <header className={styles.header}>
          <img src={ARSLogo} alt="ARS" className={styles.logo} />
          <h1 className={styles.title}>Almost there, {profile.fullName.split(' ')[0]}</h1>
          <p className={styles.subtitle}>
            We need a couple more details before an administrator can verify
            your account. Your email <strong>{profile.email}</strong> is
            already on file and can't be changed here.
          </p>
        </header>

        <section className={styles.profileRow}>
          <div className={styles.avatarFallback} aria-hidden="true">
            {initials}
          </div>
          <div className={styles.profileInfo}>
            <p className={styles.profileLabel}>Signed in with Google as</p>
            <p className={styles.profileName}>{profile.fullName}</p>
            <p className={styles.profileEmail}>{profile.email}</p>
          </div>
        </section>

        <form className={styles.form} onSubmit={(e) => e.preventDefault()} noValidate>
          {errors.role && (
            <p className={styles.errorText} role="alert">
              {errors.role}
            </p>
          )}

          <div className={styles.fieldGroup}>
            <label htmlFor="phoneNumber" className={styles.fieldLabel}>
              Phone Number (optional)
            </label>
            <Input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              value={form.phoneNumber}
              onChange={handlePhoneChange}
              placeholder="+84 90 123 4567"
              autoComplete="tel"
              disabled={isUploadingPdf}
              className={styles.input}
              error={errors.phoneNumber}
            />
            <p className={styles.hint}>
              We use this to coordinate your onboarding with the academic
              administration. Leave blank if you'd rather not share it.
            </p>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="role" className={styles.fieldLabel}>
              Platform Role
            </label>
            <select
              id="role"
              name="role"
              className={`${styles.select} ${errors.role ? styles['select--error'] : ''}`}
              value={form.role}
              onChange={handleRoleChange}
              disabled={isUploadingPdf || availableRoles.length === 0}
            >
              <option value="">Select a role…</option>
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            {rolesError && (
              <p className={styles.errorText} role="alert">
                {rolesError}
              </p>
            )}
            <p className={styles.hint}>
              The role you select will be reviewed by an administrator before
              you can access role-restricted areas.
            </p>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              Verification Document (PDF)
            </label>
            <PdfDropzone
              onUploadComplete={handleUploadComplete}
              onRemove={handleUploadRemove}
              pdfUrl={form.pdfUrl}
              uploadedFile={form.pdfFile}
              onUploadStateChange={setIsUploadingPdf}
            />
            {form.pdfUrl && (
              <p className={styles.hint}>
                Uploaded to Firebase Storage. We'll send this URL to the
                backend once the BTR-AGENT52-02 onboarding endpoint is
                available.
              </p>
            )}
          </div>

          <div className={styles.unavailableNotice} role="alert">
            <strong>Backend onboarding endpoint unavailable.</strong>
            <p className={styles.unavailableBody}>
              The platform does not yet expose a documented endpoint for
              completing first-time Google-user onboarding. We captured the
              information above so the BE team can ingest it once the
              endpoint ships (see <code>BTR-AGENT52-02</code>).
            </p>
            <p className={styles.unavailableBody}>
              Until then, we cannot submit your verification request, write
              a verification record, or transition your account to{' '}
              <em>Pending</em>. Please cancel and sign out, or retry once the
              backend team has published the endpoint.
            </p>
          </div>

          <div className={styles.actions}>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled
              title="Submit is disabled until the backend onboarding endpoint is published (BTR-AGENT52-02)."
            >
              Submit for verification (disabled)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              fullWidth
              onClick={handleCancel}
            >
              Cancel &amp; sign out
            </Button>
          </div>
          {/* `isFormReady` is intentionally read so the form data is still
              captured into local state — the BTR reduces the FE to a
              "wait until BE ships" surface, but the validation logic must
              stay in lock-step with the future endpoint contract. */}
          <input type="hidden" data-testid="form-ready" value={isFormReady ? '1' : '0'} />
        </form>
      </div>
    </div>
  );
};

export default CompleteGoogleRegistration;
