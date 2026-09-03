import { useRef, useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { authService } from '../../services/auth.service';
import { roleService } from '../../services/role.service';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { GoogleLoginError } from '../../services/googleAuth.service';
import type { GoogleCredentialResponse } from '../../types/googleAuth';
import { ROUTES } from '../../routes/paths';
import type { UserRole, RegisterPayload } from '../../types/auth';
import { OrcidBrandLogo } from '../../components/orcid/OrcidBrandLogo';
import { PdfDropzone } from './components/PdfDropzone';
import { SamplePdfModal } from './components/SamplePdfModal';
import { PolicyModal, type PolicyTab } from './components/PolicyModal';
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton';
import ARSLogo from '../../assets/images/ARS_Logo.png';
import styles from './Register.module.css';
import { Info } from 'lucide-react';
import { startRegistrationOrcidLink } from '../../services/orcid.service';
import { isOrcidEligibleRole, type RequestableRole } from '../../utils/registrationRoles';
import { FieldError } from '../../components/FieldError';
import { reviewerOrcidBypassAllowed } from '../../config/featureFlags';
import {
  extractServerFieldErrors,
  extractServerMessage,
  validateVietnameseName,
  validateEmail,
  validatePhoneNumber,
  validatePassword,
} from '../../utils/validationRules';
import { useShortcuts } from '../../hooks/useShortcuts';

interface FormState {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  retypePassword: string;
  role: RequestableRole;
  consentAccepted: boolean;
}

const initialForm: FormState = {
  fullName: '',
  email: '',
  phoneNumber: '',
  password: '',
  retypePassword: '',
  role: 'Researcher',
  consentAccepted: false,
};

// Inline name regex is centralised in `src/utils/validationRules.ts` to keep
// the rule single-sourced and testable in isolation.

// Per-role verification copy shown in the right-hand banner. Admin is
// included so the compiler can prove the record covers every
// `UserRole` literal, but the form never lets the user pick Admin
// (see `REGISTRATION_ROLES`).
const ROLE_REQUIREMENTS: Record<UserRole, string> = {
  Researcher:
    'Upload a PDF containing your academic profile, ORCID iD, publication record, and citation metrics. This document will be reviewed by an administrator before your Researcher role is granted.',
  Reviewer:
    'Upload a PDF summarizing your academic background, areas of expertise, and prior peer review service record. Administrator review is required before Reviewer privileges are activated.',
  Lecturer:
    'Upload a PDF that includes your teaching record, affiliated institution, and courses instructed. This supports verification of your Lecturer role.',
  'Graduate Student':
    'Upload a PDF showing your current enrollment status, advisor, affiliated university, and academic record. Administrator approval is required to finalize your Graduate Student role.',
  Admin:
    'Administrator accounts are provisioned directly in the database and cannot be self-registered.',
};

export const Register = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {}
  );
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSampleOpen, setIsSampleOpen] = useState(false);
  const [policyTab, setPolicyTab] = useState<PolicyTab | null>(null);
  const [availableRoles, setAvailableRoles] = useState<RequestableRole[]>([]);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [isStartingOrcid, setIsStartingOrcid] = useState(false);
  const [orcidStartError, setOrcidStartError] = useState<string | null>(null);

  // FE_ORCID_CONNECT_CALLBACK_FIX_TICKET — the BE-owned ORCID callback
  // stashes an opaque `registrationTicket` in sessionStorage when a user
  // completes the ORCID verification during the registration flow. The
  // Register page reads it back here and forwards it as
  // `RegisterPayload.orcidTicket` on submit. Reviewer registrations
  // require it; other roles do not.
  //
  // The ticket is the only ORCID-related value we ever persist client-side.
  // No ORCID OAuth code, state, access token, or refresh token is stored.
  const [orcidTicket, setOrcidTicket] = useState<string | null>(null);

  // GIS-credential Google sign-up UI state. Same double-submit guard as the
  // Login page so rapid clicks cannot fire the GIS callback twice.
  const googleInFlightRef = useRef(false);
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Part 2 — keyboard shortcuts for the registration form:
  //   Ctrl+Enter  → submit the form
  //   Esc         → reset all fields to default values
  useShortcuts([
    {
      key: 'Enter',
      modifier: 'mod',
      label: 'Submit form',
      description: 'Create your account without clicking the button.',
      group: 'form',
      allowInInputs: true,
      handler: () => {
        // Trigger native form submission so the existing onSubmit handler
        // fires with a proper FormEvent — no logic duplication needed.
        const form = document.getElementById('register-form') as HTMLFormElement | null;
        form?.requestSubmit();
      },
    },
    {
      key: 'Escape',
      label: 'Clear form',
      description: 'Reset all fields.',
      group: 'form',
      allowInInputs: true,
      handler: () => {
        setForm(initialForm);
        setErrors({});
        setSubmitError(null);
        setPdfFile(null);
        setPdfUrl(null);
      },
    },
  ]);

  useEffect(() => {
    authService.logout();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void roleService.fetchBusinessRolesForOnboarding()
      .then((roles) => {
        if (cancelled) return;
        setAvailableRoles(roles);
        setForm((prev) => ({
          ...prev,
          role: roles.includes(prev.role) ? prev.role : (roles[0] ?? prev.role),
        }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAvailableRoles([]);
        setRolesError(err instanceof Error ? err.message : 'Unable to load available roles.');
      });
    return () => { cancelled = true; };
  }, []);

  // FE_ORCID_CONNECT_CALLBACK_FIX_TICKET — pull the opaque ORCID
  // registration ticket out of sessionStorage when the page mounts and
  // whenever the browser returns with `?orcid=verified` (i.e. the BE
  // callback page redirected here). The ticket is required for Reviewer
  // submissions and optional for every other role.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('orcidRegistrationTicket');
      setOrcidTicket(stored && stored.trim() ? stored : null);
    } catch {
      setOrcidTicket(null);
    }
  }, []);

  const handleStartOrcid = async () => {
    setOrcidStartError(null);
    setIsStartingOrcid(true);
    try {
      await startRegistrationOrcidLink();
    } catch (error: unknown) {
      setOrcidStartError(
        error instanceof Error ? error.message : 'Unable to start ORCID connection. Please try again.',
      );
    } finally {
      setIsStartingOrcid(false);
    }
  };

  const validateField = (
    field: keyof FormState,
    value: string | boolean,
    currentForm: FormState = form
  ): string | undefined => {
    const textValue = typeof value === 'string' ? value : '';
    switch (field) {
      case 'fullName':
        return validateVietnameseName(textValue) || undefined;
      case 'email':
        return validateEmail(textValue) || undefined;
      case 'phoneNumber':
        return validatePhoneNumber(textValue) || undefined;
      case 'password':
        return validatePassword(textValue) || undefined;
      case 'retypePassword': {
        if (!value) return 'Please retype your password';
        if (value !== currentForm.password) return 'Passwords must match';
        return undefined;
      }
      case 'consentAccepted':
        return !value
          ? 'You must accept the Privacy Policy and Terms before registering.'
          : undefined;
      default:
        return undefined;
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    const nextValue = type === 'checkbox' ? checked : value;

    setForm((prev) => ({
      ...prev,
      [name]: nextValue,
    }));

    if (errors[name as keyof FormState]) {
      const fieldError = validateField(name as keyof FormState, nextValue, {
        ...form,
        [name]: nextValue,
      });
      setErrors((prev) => ({ ...prev, [name]: fieldError }));
    }
  };

  const handleBlur = (field: keyof FormState) => {
    const fieldError = validateField(field, form[field]);
    setErrors((prev) => ({ ...prev, [field]: fieldError }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};

    const nameError = validateVietnameseName(form.fullName);
    if (nameError) next.fullName = nameError;

    const emailError = validateEmail(form.email);
    if (emailError) next.email = emailError;

    const phoneError = validatePhoneNumber(form.phoneNumber);
    if (phoneError) next.phoneNumber = phoneError;

    const passwordError = validatePassword(form.password);
    if (passwordError) next.password = passwordError;

    if (!form.retypePassword) {
      next.retypePassword = 'Please retype your password';
    } else if (form.retypePassword !== form.password) {
      next.retypePassword = 'Passwords must match';
    }

    if (!form.role || !availableRoles.includes(form.role)) {
      next.role = 'Role is required';
    }

    if (!form.consentAccepted) {
      next.consentAccepted =
        'You must accept the Privacy Policy and Terms before registering.';
    }

    // FE_ORCID_CONNECT_CALLBACK_FIX_TICKET — Reviewer registration is the
    // only role that requires a verified ORCID ticket at the FE layer.
    // The BE is still authoritative (see ticket acceptance criteria) and
    // will reject invalid/missing tickets even if this check is bypassed.
    //
    // PROD-002 — when the FE-only ORCID gate is bypassed for development
    // dummy Reviewer accounts (`VITE_REQUIRE_REVIEWER_ORCID=false`), we
    // still let the BE decide. We only relax the *frontend* rule; we never
    // claim an unconnected ORCID is verified, and we never send a fake
    // ticket. Production-safe default is `true` (gate ON).
    if (form.role === 'Reviewer' && !reviewerOrcidBypassAllowed() && !orcidTicket) {
      next.role =
        'Reviewer registration requires a verified ORCID connection. Click "Connect ORCID" above and complete the ORCID authorization first.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const isFormValid = (() => {
    if (validateVietnameseName(form.fullName)) return false;
    if (validateEmail(form.email)) return false;
    if (validatePhoneNumber(form.phoneNumber)) return false;
    if (validatePassword(form.password)) return false;
    if (form.password !== form.retypePassword) return false;
    if (!pdfUrl) return false;
    if (isUploadingPdf) return false;
    if (!form.consentAccepted) return false;
    return true;
  })();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    if (!pdfUrl) {
      setSubmitError('Please upload your verification PDF before submitting.');
      return;
    }

    if (form.password !== form.retypePassword) {
      setErrors((prev) => ({
        ...prev,
        retypePassword: 'Passwords must match',
      }));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: RegisterPayload = {
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim().replace(/[\s\-()]/g, ''),
        role: form.role,
        pdfUrl,
        // FE_ORCID_CONNECT_CALLBACK_FIX_TICKET — only attach the
        // opaque ticket when the user actually completed the ORCID
        // verification on the registration flow. Non-Reviewer
        // registrations will simply omit the field; the BE accepts an
        // absent `orcidTicket` for those roles.
        ...(orcidTicket ? { orcidTicket } : {}),
      };

      await authService.registerUser(payload);

      // Store registered email for OTP page reload safety
      try {
        sessionStorage.setItem('ars_registered_email', form.email.trim());
      } catch {
        /* ignore */
      }

      // Clear any session artifacts so the user is purely in unauthenticated verification state
      authService.logout();

      // FE_ORCID_CONNECT_CALLBACK_FIX_TICKET — the ticket has done its
      // job (it reached the BE inside `registerUser`). Drop it from
      // sessionStorage so a refresh after the OTP page cannot replay it.
      try {
        sessionStorage.removeItem('orcidRegistrationTicket');
      } catch {
        /* ignore */
      }
      setOrcidTicket(null);

      // Trigger sending registration verification email / OTP
      void authService.sendRegistrationOtp(form.email.trim());

      // Navigate to /verify-email with the registered email in state
      navigate(ROUTES.VERIFY_EMAIL, {
        replace: true,
        state: {
          email: form.email.trim(),
          fullName: form.fullName.trim(),
        },
      });
    } catch (err) {
      const fieldErrors = extractServerFieldErrors(err, [
        'fullName',
        'email',
        'phoneNumber',
        'password',
        'role',
        'pdfUrl',
      ]);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
        setSubmitError(null);
      } else {
        const message = extractServerMessage(
          err,
          'Registration failed. Please try again.',
        );
        setSubmitError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadComplete = (file: File, url: string) => {
    setPdfFile(file);
    setPdfUrl(url);
    setSubmitError(null);
  };

  const handleUploadRemove = () => {
    setPdfFile(null);
    setPdfUrl(null);
  };

  // GIS-credential Google sign-up handler. The agreed FE ↔ BE contract is
  // `POST /api/Auth/google-login` with `{ credential }` — the BE decides
  // whether the user is new or returning and returns `isNewUser` /
  // `requiresOnboarding` so AuthContext can route them to the right
  // landing page. New users land on `/complete-google-registration`.
  const handleGoogleCredential = async (
    response: GoogleCredentialResponse,
  ): Promise<void> => {
    if (googleInFlightRef.current) return;
    setGoogleError(null);
    googleInFlightRef.current = true;
    setGooglePending(true);

    try {
      authService.logout();
      await loginWithGoogle(response);
    } catch (err: unknown) {
      const fallback =
        'Google sign-up failed. Please try again or use the email & password option.';
      const message =
        err instanceof GoogleLoginError && err.message
          ? err.message
          : err instanceof Error && err.message
            ? err.message
            : fallback;
      setGoogleError(message);
    } finally {
      googleInFlightRef.current = false;
      setGooglePending(false);
    }
  };

  return (
    <div className={styles.registerPage}>
      <header className={styles.logoSection}>
        <img src={ARSLogo} alt="ARS Logo" className={styles.logoImage} />
        <span className={styles.brandText}>{t('app.brandName', 'Academic Research Sharing')}</span>
      </header>

      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('register.pageTitle', 'Create your Account')}</h1>
        <p className={styles.pageSubtitle}>
          {t('register.pageSubtitle', 'Join the ARS community to publish, review, and collaborate on academic research.')}
        </p>
      </header>

      <form id="register-form" className={styles.form} onSubmit={handleSubmit} noValidate>
        {submitError && (
          <div className={styles.formError} role="alert">
            {submitError}
          </div>
        )}

        <div className={styles.fieldGroup}>
          <label
            htmlFor="fullName"
            className={`${styles.fieldLabel} ${styles['fieldLabel--required']}`}
          >
            {t('register.fullName', 'Full Name')}
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            className={`${styles.nativeInput} ${errors.fullName ? styles['nativeInput--error'] : ''}`}
            placeholder={t('register.fullNamePlaceholder', 'e.g., Dr. Nguyen Van A')}
            value={form.fullName}
            onChange={handleChange}
            onBlur={() => handleBlur('fullName')}
            disabled={isSubmitting || isUploadingPdf || availableRoles.length === 0}
            autoComplete="name"
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? 'fullName-error' : undefined}
          />
          <FieldError
            id="fullName-error"
            message={errors.fullName}
            testId="register-error-fullName"
          />
        </div>

        <div className={styles.fieldGroup}>
          <label
            htmlFor="email"
            className={`${styles.fieldLabel} ${styles['fieldLabel--required']}`}
          >
            {t('auth.email', 'Email Address')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className={`${styles.nativeInput} ${errors.email ? styles['nativeInput--error'] : ''}`}
            placeholder={t('register.emailPlaceholder', 'email@example.com')}
            value={form.email}
            onChange={handleChange}
            onBlur={() => handleBlur('email')}
            disabled={isSubmitting || isUploadingPdf}
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          <FieldError
            id="email-error"
            message={errors.email}
            testId="register-error-email"
          />
        </div>

        <div className={styles.fieldGroup}>
          <label
            htmlFor="phoneNumber"
            className={`${styles.fieldLabel} ${styles['fieldLabel--required']}`}
          >
            {t('register.phoneNumber', 'Phone Number')}
          </label>
          <input
            id="phoneNumber"
            name="phoneNumber"
            type="tel"
            className={`${styles.nativeInput} ${errors.phoneNumber ? styles['nativeInput--error'] : ''}`}
            placeholder={t('register.phonePlaceholder', '0901234567')}
            value={form.phoneNumber}
            onChange={handleChange}
            onBlur={() => handleBlur('phoneNumber')}
            disabled={isSubmitting || isUploadingPdf}
            autoComplete="tel"
            aria-invalid={Boolean(errors.phoneNumber)}
            aria-describedby={errors.phoneNumber ? 'phoneNumber-error' : undefined}
          />
          <FieldError
            id="phoneNumber-error"
            message={errors.phoneNumber}
            testId="register-error-phoneNumber"
          />
        </div>

        <div className={styles.passwordRow}>
          <div className={styles.fieldGroup}>
            <label
              htmlFor="password"
              className={`${styles.fieldLabel} ${styles['fieldLabel--required']}`}
            >
              {t('auth.password', 'Password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className={`${styles.nativeInput} ${errors.password ? styles['nativeInput--error'] : ''}`}
              placeholder={t('register.passwordPlaceholder', 'Create a password')}
              value={form.password}
              onChange={handleChange}
              onBlur={() => handleBlur('password')}
              disabled={isSubmitting || isUploadingPdf}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : 'password-helper'}
            />
            <FieldError
              id="password-error"
              message={errors.password}
              testId="register-error-password"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label
              htmlFor="retypePassword"
              className={`${styles.fieldLabel} ${styles['fieldLabel--required']}`}
            >
              {t('register.retypePassword', 'Retype Password')}
            </label>
            <input
              id="retypePassword"
              name="retypePassword"
              type="password"
              className={`${styles.nativeInput} ${errors.retypePassword ? styles['nativeInput--error'] : ''}`}
              placeholder={t('register.retypePasswordPlaceholder', 'Retype your password')}
              value={form.retypePassword}
              onChange={handleChange}
              onBlur={() => handleBlur('retypePassword')}
              disabled={isSubmitting || isUploadingPdf}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.retypePassword)}
              aria-describedby={errors.retypePassword ? 'retypePassword-error' : undefined}
            />
            <FieldError
              id="retypePassword-error"
              message={errors.retypePassword}
              testId="register-error-retypePassword"
            />
          </div>
        </div>
        <p className={styles.passwordHelper}>
          {t('register.passwordHelper', 'Must be at least 8 characters with 1 uppercase letter and 1 number.')}
        </p>

        <div className={styles.fieldGroup}>
          <label
            htmlFor="role"
            className={`${styles.fieldLabel} ${styles['fieldLabel--required']}`}
          >
            {t('register.selectRole', 'Select Your Platform Role')}
          </label>
          <select
            id="role"
            name="role"
            className={`${styles.nativeSelect} ${errors.role ? styles['nativeSelect--error'] : ''}`}
            value={form.role}
            onChange={handleChange}
            disabled={isSubmitting || isUploadingPdf}
            aria-invalid={Boolean(errors.role)}
            aria-describedby={errors.role ? 'role-error' : undefined}
          >
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {t(`role.${role}`, role)}
              </option>
            ))}
          </select>
          <FieldError id="role-error" message={errors.role} />
          {rolesError && <FieldError id="role-load-error" message={rolesError} />}
        </div>

        {isOrcidEligibleRole(form.role) && (
          <section className={styles.orcidConnection} aria-labelledby="registration-orcid-title">
            <div className={styles.orcidHeader}>
              <OrcidBrandLogo
                variant="wordmark"
                size={22}
                ariaLabel={t('orcid.brandAria', 'ORCID iD')}
                className={styles.orcidHeaderLogo}
              />
            </div>

            <div className={styles.orcidBody}>
              <h2 id="registration-orcid-title" className={styles.orcidTitle}>
                {t('orcid.connectTitle', 'Connect your ORCID iD')}
              </h2>
              <p className={styles.orcidDescription}>
                {form.role === 'Reviewer'
                  ? reviewerOrcidBypassAllowed()
                    ? t('orcid.reviewerDevNotice', 'Reviewer requests normally require a verified ORCID iD, but the development-only bypass is active. You can submit without ORCID; production will require it.')
                    : t('orcid.reviewerNotice', 'Reviewer requests require a verified ORCID iD. You will authenticate on ORCID, never in ARS.')
                  : t('orcid.optionalNotice', 'Optional for Researcher and Lecturer. You can also connect ORCID later from your Profile.')}
              </p>
            </div>

            <div className={styles.orcidAction}>
              {orcidTicket ? (
                <span
                  className={styles.orcidVerifiedBadge}
                  data-testid="register-orcid-verified-badge"
                  role="status"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <circle cx="7" cy="7" r="7" fill="#A6CE39" />
                    <path d="M4 7.5L6 9.5L10 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t('orcid.verified', 'ORCID verified')}
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.orcidConnectBtn}
                  onClick={() => void handleStartOrcid()}
                  disabled={isSubmitting || isUploadingPdf || isStartingOrcid}
                  aria-busy={isStartingOrcid}
                  data-testid="register-connect-orcid-button"
                >
                  {isStartingOrcid ? (
                    <>
                      <span className={styles.orcidBtnSpinner} aria-hidden="true" />
                      {t('orcid.connecting', 'Connecting…')}
                    </>
                  ) : (
                    <OrcidBrandLogo
                      variant="wordmark"
                      size={22}
                      ariaLabel={t('orcid.connectAria', 'Connect with ORCID iD')}
                      className={styles.orcidBtnLogo}
                    />
                  )}
                </button>
              )}
            </div>

            {!orcidTicket && (
              <p className={styles.orcidNotice}>
                {t('orcid.privacyNotice', 'We will open the official ORCID authorization page. ARS never asks for your ORCID password — authentication happens entirely on orcid.org.')}
              </p>
            )}
            {reviewerOrcidBypassAllowed() && form.role === 'Reviewer' ? (
              <p
                className={styles.orcidDevNotice}
                data-testid="register-orcid-dev-bypass-notice"
                role="status"
              >
                {t('orcid.bypassWarning', 'Development-only ORCID bypass active — Reviewer role can be requested without connecting ORCID. Production deployment will require ORCID.')}
              </p>
            ) : null}
            {orcidStartError ? <FieldError id="orcid-start-error" message={orcidStartError} /> : null}
          </section>
        )}

        <div className={styles.roleBanner}>
          <span className={styles.roleBannerIcon}>
            <Info size={20} />
          </span>
          <div className={styles.roleBannerContent}>
            <p className={styles.roleBannerTitle}>
              {`${t(`role.${form.role}`, form.role)} ${t('register.roleVerificationRequired', 'Verification Required')}`}
            </p>
            <p className={styles.roleBannerText}>{t(`register.roleRequirement.${form.role}`, ROLE_REQUIREMENTS[form.role])}</p>
            <div className={styles.roleBannerAction}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSampleOpen(true)}
                className={styles.sampleBtn}
                disabled={isUploadingPdf}
              >
                {t('register.viewSampleFormat', 'View Sample PDF Format')}
              </Button>
            </div>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label
            className={`${styles.fieldLabel} ${styles['fieldLabel--required']}`}
          >
            {t('register.verificationDocument', 'Verification Document (PDF)')}
          </label>
          <PdfDropzone
            onUploadComplete={handleUploadComplete}
            onRemove={handleUploadRemove}
            pdfUrl={pdfUrl}
            uploadedFile={pdfFile}
            onUploadStateChange={setIsUploadingPdf}
          />
        </div>

        <div className={styles.consentGroup}>
          <label className={styles.consentLabel}>
            <input
              type="checkbox"
              name="consentAccepted"
              checked={form.consentAccepted}
              onChange={handleChange}
              disabled={isSubmitting || isUploadingPdf}
              className={styles.consentCheckbox}
              aria-describedby="consent-description"
            />
            <span className={styles.consentText} id="consent-description">
              {t('register.consent.readAndAgree', 'I have read and agree to the')}{' '}
              <button
                type="button"
                className={styles.consentLink}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPolicyTab('privacy');
                }}
              >
                {t('legal.privacy', 'Privacy Policy')}
              </button>{' '}
              {t('register.consent.and', 'and')}{' '}
              <button
                type="button"
                className={styles.consentLink}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPolicyTab('terms');
                }}
              >
                {t('legal.terms', 'Terms of Service')}
              </button>
            </span>
          </label>
          <FieldError
            id="consent-error"
            message={errors.consentAccepted}
            testId="register-error-consentAccepted"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
          disabled={!isFormValid || isSubmitting}
          className={styles.submitButton}
        >
          {t('register.submitBtn', 'Create Account')}
        </Button>

        <div className={styles.divider}>{t('common.or', 'or')}</div>

        <div className={styles.googleButtonWrapper}>
          <GoogleSignInButton
            label={t('auth.signUpWithGoogle', 'Sign up with Google')}
            onCredential={handleGoogleCredential}
            disabled={isSubmitting || isUploadingPdf || googlePending}
            pending={googlePending}
            errorMessage={googleError}
            intent="signup"
          />
        </div>

        {googleError && (
          <div className={styles.formError} role="alert">
            {googleError}
          </div>
        )}

        <div className={styles.footer}>
          <p className={styles.footerText}>
            {t('register.alreadyHaveAccount', 'Already have an account?')}{' '}
            <Link to={ROUTES.LOGIN} className={styles.loginLink}>
              {t('register.signInInstead', 'Sign in instead')}
            </Link>
          </p>
        </div>
      </form>

      <PolicyModal
        isOpen={policyTab !== null}
        initialTab={policyTab || 'privacy'}
        onClose={() => setPolicyTab(null)}
        onAccept={() => setForm((prev) => ({ ...prev, consentAccepted: true }))}
      />

      <SamplePdfModal
        isOpen={isSampleOpen}
        onClose={() => setIsSampleOpen(false)}
        initialRole={form.role}
      />
    </div>
  );
};

export default Register;
