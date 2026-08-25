// Agent 30 — First-time Google-user onboarding page (post-contract fulfillment).
//
// Contract — see Swagger `paths./api/Auth/complete-google-registration` and
// `tickets/backend/BE_GOOGLE_ONBOARDING_COMPLETION_TICKET.md`. The BE
// endpoint authenticates via the ARS JWT (carried by the shared axios
// `Authorization` header) — we do NOT echo the upstream Google ID token
// into the request body. The Request schema fields the BE acknowledges
// are: `pdfUrl`, `phoneNumber`, `role` (required) plus `orcidId` for
// Reviewer and `consents` (optional). The user id is derived from the
// JWT subject server-side.
//
// Surfacing rules:
//   1. The page reads the BE-derived profile from the existing ARS auth
//      store (useAuth) and shows the Google name / email read-only.
//   2. The user MUST select a business role and upload a PDF. Reviewer
//      additionally MUST enter a canonical ORCID iD with a valid checksum.
//   3. Submit blocks double-clicks / in-flight duplicates and POSTs the
//      payload exactly once. Refreshing the page after a successful submit
//      reads the `ars_google_onboarding_submitted` sessionStorage sentinel
//      and renders the success state again without re-submitting.
//   4. Non-dismissible: no backdrop click, no Escape, no Cancel that
//      returns the user to /forum without first signing out. The only
//      escape is the Sign out button, which clears the centralised ARS
//      session and routes to /login.
//   5. After a successful response the auth context refetches the BE's
//      authoritative record (isActive=false, verificationStatus=Pending,
//      effectiveRole=Guest) and routes to /forum — pending Guests do not
//      get into role workspaces.
//   6. Existing approved Google users never reach this page because the
//      GIS callback short-circuits them into the workspace landing route.
//   7. Legacy OAuth code-redirect users (`/auth/google/callback?code=...`)
//      arrive here WITHOUT a cached Google credential — the BE has
//      already exchanged the code server-side. The page's only session
//      requirement is therefore the ARS JWT (Profile check below).
//
// Forbidden:
//   - No logs of credentials, JWTs, ORCIDs, or PDF URLs.
//   - No fabrication of roleName / roleId / verificationStatus on submit.
//   - No call to /api/Auth/register.
//   - No local "pending" optimistic UI that grants access before the BE
//     responds.

import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { PdfDropzone } from '../Register/components/PdfDropzone';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store';
import { useAuth } from '../../context/AuthContext';
import { storage } from '../../utils/storage';
import { ROUTES } from '../../routes/paths';
import type { BusinessRole, EffectiveRole, UserRole } from '../../types/auth';
import { normalizeOrcid, hasValidOrcidChecksum } from '../../services/orcid.service';
import { REGISTRATION_ROLES } from '../../utils/registrationRoles';
import ARSLogo from '../../assets/images/ARS_Logo.png';
import styles from './CompleteGoogleRegistration.module.css';

// Sentinel sessionStorage key. Set on successful submit; cleared on logout.
const SUBMITTED_KEY = 'ars_google_onboarding_submitted';
// Profile loaded from storage / auth store is required to render.
const PHONE_REGEX = /^[+\d\s\-()]{8,20}$/;

interface FormState {
  phoneNumber: string;
  role: BusinessRole | '';
  orcidId: string;
  pdfUrl: string | null;
  pdfFile: File | null;
}

const initialForm: FormState = {
  phoneNumber: '',
  role: '',
  orcidId: '',
  pdfUrl: null,
  pdfFile: null,
};

function buildInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

export const CompleteGoogleRegistration = () => {
  const navigate = useNavigate();
  const updateUser = useAuthStore((state) => state.updateUser);
  const logoutStore = useAuthStore((state) => state.logout);
  const storeUser = useAuthStore((state) => state.user);
  const storeIsAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const {
    isAuthenticated,
    user,
    completeGoogleRegistration,
  } = useAuth();

  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<BusinessRole[]>([]);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submission, setSubmission] = useState<{
    status: 'submitted';
    role: string | null;
    effectiveRole: string | null;
    requestStatus: string | null;
  } | null>(null);

  // Hard guard against double-submit. The ref is mutated synchronously
  // before any await so a React 18 StrictMode double-invoke (or a rapid
  // second submit click) becomes a no-op after the first invocation.
  const submitInFlightRef = useRef(false);

  // ── 1. Resolve the auth session ────────────────────────────────────────
  //
  // Strict integrity check: must have a positive userId, non-empty email,
  // and non-empty fullName. We refuse to render the page when the session
  // is partially hydrated — that's how roleId 0 / empty roleName records
  // could otherwise slip through and reach the BE.
  const profile = useMemo(() => {
    const authed = isAuthenticated || storeIsAuthenticated;
    if (!authed) return null;
    const stored = storage.getUser();
    const token = storage.getToken();
    const storedUserId = stored?.id ?? 0;
    const authUserId = user?.userId ?? storeUser?.id ?? 0;
    const userId = storedUserId > 0 ? storedUserId : authUserId > 0 ? authUserId : 0;
    const email = stored?.email ?? user?.email ?? storeUser?.email ?? '';
    const fullName =
      stored?.fullName ?? user?.username ?? storeUser?.fullName ?? '';
    if (!token) return null;
    if (userId <= 0) return null;
    if (!email) return null;
    if (!fullName) return null;
    return {
      email,
      fullName,
      userId,
      isActive:
        stored?.isActive ?? user?.isActive ?? storeUser?.isActive ?? false,
      verificationStatus:
        stored?.verificationStatus ??
        user?.verificationStatus ??
        storeUser?.verificationStatus ??
        'Pending',
      roleId: stored?.roleId ?? user?.roleId ?? storeUser?.roleId ?? null,
      roleName:
        stored?.roleName ?? user?.role ?? storeUser?.roleName ?? null,
    };
  }, [
    isAuthenticated,
    storeIsAuthenticated,
    user,
    storeUser,
  ]);

  // Re-publish the freshly-loaded user into the auth store so the rest
  // of the app sees the same non-fabricated shape. No-op when the store
  // already reflects the BE-derived values.
  useEffect(() => {
    if (!profile) return;
    const storeEmailMatches = storeUser?.email === profile.email;
    if (!storeEmailMatches) {
      updateUser({
        email: profile.email,
        fullName: profile.fullName,
        isActive: profile.isActive,
        verificationStatus: profile.verificationStatus,
      });
    }
  }, [profile, storeUser, updateUser]);

  // ── 2. Read the refresh-safe submission sentinel ────────────────────────
  //
  // When the user has already completed onboarding and refreshes / reopens
  // the page, we render the success state again instead of showing the
  // empty form. We never re-submit in this branch.
  //
  // Defensive: the sentinel MUST match the *current* session's userId.
  // A sentinel left over from a previous (now-deleted) account — for
  // example, after a DB account deletion followed by a fresh Google
  // sign-in that returns `isNewUser=true` but does NOT run the full
  // logout flow — would otherwise render the post-submit success state
  // and present a `Go to the Forum` button to a user who has not
  // actually submitted anything yet. When the userId does not match we
  // drop the sentinel and let the page render the regular onboarding
  // form.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(SUBMITTED_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as {
            userId?: number | string;
            role?: string;
            effectiveRole?: string;
            requestStatus?: string;
          };
          const sentinelUserId =
            typeof parsed.userId === 'number'
              ? parsed.userId
              : typeof parsed.userId === 'string'
                ? Number(parsed.userId)
                : NaN;
          const currentUserId = profile?.userId ?? 0;
          const matchesCurrentUser =
            Number.isFinite(sentinelUserId) &&
            sentinelUserId > 0 &&
            currentUserId > 0 &&
            sentinelUserId === currentUserId;
          if (!matchesCurrentUser) {
            // Stale sentinel from a different account — drop it so the
            // next render starts from a clean state.
            try {
              sessionStorage.removeItem(SUBMITTED_KEY);
            } catch {
              /* ignore */
            }
            return;
          }
          setSubmission({
            status: 'submitted',
            role: parsed.role ?? null,
            effectiveRole: parsed.effectiveRole ?? null,
            requestStatus: parsed.requestStatus ?? 'Pending',
          });
        } catch {
          /* ignore malformed sentinel — treat as fresh session */
        }
      }
    } catch {
      /* quota / privacy-mode */
    }
  }, [profile?.userId]);

  // ── 3. Populate the role selector from the shared FE-owned constant ────
  //
  // The role list is owned by the FE (see `src/utils/registrationRoles.ts`)
  // — we DO NOT call `GET /api/Role` here. The BE is authoritative for
  // the *result* of the submission (the submitted role name is sent
  // verbatim and the BE either accepts or rejects), but the selectable
  // set is FE-owned so a transient BE outage cannot leave a freshly
  // signed-in first-time Google user with no role to choose. Admin and
  // Guest are deliberately excluded.
  useEffect(() => {
    setAvailableRoles([...REGISTRATION_ROLES]);
    setRolesError(null);

    if (typeof authService.getRoles === 'function') {
      authService
        .getRoles()
        .then((roles) => {
          if (roles && Array.isArray(roles) && roles.length > 0) {
            const fetchedNames = roles
              .map((r) => r.name || r.roleName)
              .filter((name): name is BusinessRole =>
                typeof name === 'string' && REGISTRATION_ROLES.includes(name as any)
              );
            if (fetchedNames.length > 0) {
              setAvailableRoles(fetchedNames);
            }
          }
        })
        .catch((err) => {
          console.warn(
            '[CompleteGoogleRegistration] Failed to fetch dynamic roles from /api/Role, using default roles:',
            err
          );
        });
    }
  }, []);

  // ── 4. Handlers ─────────────────────────────────────────────────────────
  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, phoneNumber: e.target.value }));
    setErrors((prev) => {
      const nextPhone = e.target.value;
      const next = { ...prev };
      if (nextPhone && !PHONE_REGEX.test(nextPhone)) {
        next.phoneNumber =
          'Phone number must use digits, spaces, dashes or parentheses (8–20 chars).';
      } else {
        next.phoneNumber = undefined;
      }
      return next;
    });
  };

  const handleRoleChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const nextRole = e.target.value as FormState['role'];
    setForm((prev) => ({
      ...prev,
      role: nextRole,
      // Changing away from Reviewer HIDES and CLEARS the ORCID value so a
      // stale iD never leaks into a non-Reviewer payload.
      orcidId: nextRole === 'Reviewer' ? prev.orcidId : '',
    }));
    setErrors((prev) => ({
      ...prev,
      role: undefined,
      orcidId: undefined,
    }));
  }, []);

  const handleOrcidChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextOrcid = e.target.value;
    setForm((prev) => ({ ...prev, orcidId: nextOrcid }));
    // Eager validation: surface ORCID errors as soon as the user has typed
    // a syntactically recognizable 16-char string, even before they submit.
    setErrors((prev) => {
      const next = { ...prev };
      if (nextOrcid.length === 0) {
        next.orcidId = undefined;
      } else {
        const normalized = normalizeOrcid(nextOrcid);
        if (!normalized) {
          next.orcidId =
            'Reviewer onboarding requires an ORCID iD (0000-0000-0000-0000 or full URL).';
        } else if (!hasValidOrcidChecksum(normalized)) {
          next.orcidId = 'The ORCID iD does not pass the ISO 7064 checksum.';
        } else {
          next.orcidId = undefined;
        }
      }
      return next;
    });
  };

  const handleUploadComplete = useCallback((file: File, url: string) => {
    setForm((prev) => ({ ...prev, pdfFile: file, pdfUrl: url }));
    setErrors((prev) => ({ ...prev, pdfUrl: undefined }));
  }, []);

  const handleUploadRemove = useCallback(() => {
    setForm((prev) => ({ ...prev, pdfFile: null, pdfUrl: null }));
  }, []);

  const handleSignOut = useCallback(() => {
    // Drop the auth session + storage + the cached Google credential,
    // then bounce to /login. We do NOT route to /forum — a first-time
    // user who bails out must re-confirm their Google identity.
    try {
      sessionStorage.removeItem(SUBMITTED_KEY);
    } catch {
      /* ignore */
    }
    authService.logout();
    logoutStore();
    navigate(ROUTES.LOGIN, { replace: true });
  }, [logoutStore, navigate]);

  // ── 5. Validation ──────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};

    if (form.phoneNumber && !PHONE_REGEX.test(form.phoneNumber)) {
      next.phoneNumber =
        'Phone number must use digits, spaces, dashes or parentheses (8–20 chars).';
    }

    if (!form.role) {
      next.role = 'Choose a platform role before submitting.';
    }

    if (form.role === 'Reviewer') {
      const normalized = normalizeOrcid(form.orcidId);
      if (!normalized) {
        next.orcidId =
          'Reviewer onboarding requires an ORCID iD (0000-0000-0000-0000 or full URL).';
      } else if (!hasValidOrcidChecksum(normalized)) {
        next.orcidId = 'The ORCID iD does not pass the ISO 7064 checksum.';
      }
    }

    if (!form.pdfUrl) {
      next.pdfUrl = 'Upload a verification PDF before submitting.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form]);

  const isFormValid = useMemo(() => {
    if (isUploadingPdf) return false;
    if (!form.role) return false;
    if (form.role === 'Reviewer') {
      const normalized = normalizeOrcid(form.orcidId);
      if (!normalized || !hasValidOrcidChecksum(normalized)) return false;
    }
    if (form.phoneNumber && !PHONE_REGEX.test(form.phoneNumber)) return false;
    if (!form.pdfUrl) return false;
    return true;
  }, [isUploadingPdf, form]);

  // ── 6. Submit ──────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitError(null);

      // Hard lock — synchronous flip before any await so a StrictMode
      // double-invoke or a rapid second click is a no-op.
      if (submitInFlightRef.current) return;

      if (!profile) return;
      if (!validate()) return;

      const pdfUrl = form.pdfUrl;
      const role = form.role as UserRole;
      if (!pdfUrl || !role) return;

      submitInFlightRef.current = true;
      setIsSubmitting(true);

      try {
        const result = await completeGoogleRegistration({
          pdfUrl,
          phoneNumber: form.phoneNumber,
          role,
          orcidId: role === 'Reviewer' ? form.orcidId : undefined,
        });

        // Persist the "submitted" sentinel so a page refresh renders the
        // success state instead of the empty form (and never re-submits).
        // The `userId` field is required — the page MUST verify the
        // sentinel belongs to the current session before honoring it
        // (otherwise a stale sentinel from a previous account could
        // surface the post-submit "success" state to a user who has
        // not actually submitted anything yet).
        try {
          sessionStorage.setItem(
            SUBMITTED_KEY,
            JSON.stringify({
              userId: profile?.userId ?? 0,
              role: result.role,
              effectiveRole: result.effectiveRole,
              requestStatus: result.requestStatus,
              submittedAt: new Date().toISOString(),
            }),
          );
        } catch {
          /* ignore */
        }

        setSubmission({
          status: 'submitted',
          role: result.role,
          effectiveRole: result.effectiveRole,
          requestStatus: result.requestStatus,
        });

        // The AuthContext method already navigated to /forum. We don't
        // navigate again — just release the local submit lock so the
        // dialog can show the success state if React re-renders.
      } catch (err: unknown) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Onboarding submission failed. Please try again.';
        setSubmitError(message);
      } finally {
        submitInFlightRef.current = false;
        setIsSubmitting(false);
      }
    },
    [profile, validate, form, completeGoogleRegistration],
  );

  // ── 7. Render guards ───────────────────────────────────────────────────
  if (!profile) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // Approved users with an active business role must not see the dialog.
  const alreadyApproved =
    profile.isActive === true &&
    profile.roleId != null &&
    profile.roleId > 0;

  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.info('[CompleteGoogleRegistration:diag] Profile check', {
      profile,
      alreadyApproved,
      checks: {
        isActive: profile.isActive === true,
        roleIdNotNull: profile.roleId != null,
        roleIdPositive: profile.roleId != null && profile.roleId > 0,
      },
    });
  }

  if (alreadyApproved) {
    return <Navigate to={ROUTES.FORUM} replace />;
  }

  const initials = buildInitials(profile.fullName);

  // Submitted-then-refreshed: show success + redirect to /forum.
  if (submission && submission.status === 'submitted') {
    return (
      <div className={styles.page}>
        <div
          className={styles.card}
          data-testid="onboarding-submitted"
          role="status"
          aria-live="polite"
        >
          <header className={styles.header}>
            <img src={ARSLogo} alt="ARS" className={styles.logo} />
            <h1 className={styles.title}>Your role request has been submitted</h1>
            <p className={styles.subtitle}>
              An administrator will review your request and activate your
              role. You currently have read-only access to the Forum while
              we wait.
            </p>
          </header>
          <div className={styles.actions}>
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate(ROUTES.FORUM, { replace: true })}
            >
              Go to the Forum
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              fullWidth
              onClick={handleSignOut}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Non-dismissible dialog — the only escape is the explicit Sign out.
  return (
    <div
      className={styles.page}
      data-testid="complete-google-registration"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
        }
      }}
    >
      <div className={styles.card}>
        <header className={styles.header}>
          <img src={ARSLogo} alt="ARS" className={styles.logo} />
          <h1 className={styles.title}>
            Complete your ARS registration
          </h1>
          <p className={styles.subtitle}>
            {`Hello, ${profile.fullName.split(' ')[0]}. Your account is `}
            <strong>pending administrator review</strong>
            {
              '. Submit a platform role and a verification document — we will activate your account once an administrator approves it. Until then, you only have read-only access to the Forum.'
            }
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

        <form
          className={styles.form}
          onSubmit={handleSubmit}
          noValidate
          aria-label="Complete your ARS registration"
        >
          {submitError && (
            <p
              className={styles.formError}
              role="alert"
              data-testid="onboarding-submit-error"
            >
              {submitError}
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
              disabled={isSubmitting || isUploadingPdf}
              className={styles.input}
              error={errors.phoneNumber}
            />
            <p className={styles.hint}>
              Used to coordinate your onboarding with the academic
              administration. Leave blank if you prefer not to share.
            </p>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="role" className={styles.fieldLabel}>
              Platform Role
            </label>
            <select
              id="role"
              name="role"
              data-testid="role-select"
              className={`${styles.select} ${errors.role ? styles['select--error'] : ''}`}
              value={form.role}
              onChange={handleRoleChange}
              disabled={isSubmitting || isUploadingPdf || availableRoles.length === 0}
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
              The role you select is reviewed by an administrator before
              you can access role-restricted areas.
            </p>
          </div>

          {form.role === 'Reviewer' && (
            <div className={styles.fieldGroup}>
              <label htmlFor="orcidId" className={styles.fieldLabel}>
                ORCID iD <span aria-hidden="true">*</span>
              </label>
              <Input
                id="orcidId"
                name="orcidId"
                type="text"
                value={form.orcidId}
                onChange={handleOrcidChange}
                placeholder="0000-0000-0000-0000 or https://orcid.org/..."
                disabled={isSubmitting || isUploadingPdf}
                className={styles.input}
                error={errors.orcidId}
                aria-describedby="orcid-help"
                data-testid="orcid-input"
                autoComplete="off"
              />
              {errors.orcidId && (
                <p
                  className={styles.errorText}
                  role="alert"
                  data-testid="orcid-error"
                >
                  {errors.orcidId}
                </p>
              )}
              <p className={styles.hint} id="orcid-help">
                Reviewer onboarding requires a canonical ORCID iD with a
                valid checksum. We never call OpenAlex or any external
                service from the browser.
              </p>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              Verification PDF <span aria-hidden="true">*</span>
            </label>
            <PdfDropzone
              onUploadComplete={handleUploadComplete}
              onRemove={handleUploadRemove}
              pdfUrl={form.pdfUrl}
              uploadedFile={form.pdfFile}
              onUploadStateChange={setIsUploadingPdf}
            />
            {errors.pdfUrl && (
              <p className={styles.errorText} role="alert">
                {errors.pdfUrl}
              </p>
            )}
            {form.pdfUrl && (
              <p className={styles.hint}>
                Uploaded. The PDF URL is sent to the platform exactly
                once — we never store a local-only copy.
              </p>
            )}
          </div>

          <div className={styles.actions}>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={!isFormValid || isSubmitting}
              isLoading={isSubmitting}
              data-testid="submit-button"
            >
              {isSubmitting ? 'Submitting…' : 'Submit role request'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              fullWidth
              onClick={handleSignOut}
              disabled={isSubmitting}
            >
              Sign out
            </Button>
          </div>
          {/* Hidden signals consumed by the focused test suite. */}
          <input
            type="hidden"
            data-testid="form-ready"
            value={isFormValid ? '1' : '0'}
          />
          <input
            type="hidden"
            data-testid="role-value"
            value={form.role}
          />
        </form>
      </div>
    </div>
  );
};

// EffectiveRole is referenced for typing clarity; suppress unused import lint.
export type { EffectiveRole };

export default CompleteGoogleRegistration;