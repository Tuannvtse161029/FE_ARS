import { useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { authService } from '../../services/auth.service';
import { useAuth } from '../../context/AuthContext';
import { GoogleLoginError } from '../../services/googleAuth.service';
import type { GoogleCredentialResponse } from '../../types/googleAuth';
import { useAuthStore } from '../../store';
import { ROUTES } from '../../utils/constants';
import type { AuthResponse, UserRole, RegisterPayload } from '../../types/auth';
import { PdfDropzone } from './components/PdfDropzone';
import { SamplePdfModal } from './components/SamplePdfModal';
import { RegisterSuccessModal } from './components/RegisterSuccessModal';
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton';
import ARSLogo from '../../assets/images/ARS_Logo.png';
import styles from './Register.module.css';
import { Info } from 'lucide-react';
import { normalizeOrcid, hasValidOrcidChecksum } from '../../services/orcid.service';
import {
  REGISTRATION_ROLES,
  type RequestableRole,
} from '../../utils/registrationRoles';
import { FieldError } from '../../components/FieldError';
import {
  extractServerFieldErrors,
  extractServerMessage,
  validateVietnameseName,
  validateEmail,
  validatePhoneNumber,
  validatePassword,
} from '../../utils/validationRules';

interface FormState {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  retypePassword: string;
  role: RequestableRole;
  orcidId: string;
  consentAccepted: boolean;
}

const initialForm: FormState = {
  fullName: '',
  email: '',
  phoneNumber: '',
  password: '',
  retypePassword: '',
  role: 'Researcher',
  orcidId: '',
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
  const navigate = useNavigate();
  const authStore = useAuthStore();
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
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  // GIS-credential Google sign-up UI state. Same double-submit guard as the
  // Login page so rapid clicks cannot fire the GIS callback twice.
  const googleInFlightRef = useRef(false);
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const isOrcidRole = (role: RequestableRole) =>
    role === 'Researcher' || role === 'Reviewer';

  const validateField = (
    field: keyof FormState,
    value: any,
    currentForm: FormState = form
  ): string | undefined => {
    switch (field) {
      case 'fullName':
        return validateVietnameseName(value) || undefined;
      case 'email':
        return validateEmail(value) || undefined;
      case 'phoneNumber':
        return validatePhoneNumber(value) || undefined;
      case 'password':
        return validatePassword(value) || undefined;
      case 'retypePassword': {
        if (!value) return 'Please retype your password';
        if (value !== currentForm.password) return 'Passwords must match';
        return undefined;
      }
      case 'orcidId': {
        if (currentForm.role === 'Reviewer') {
          if (!value || !value.trim()) {
            return 'ORCID iD is required for Reviewers';
          }
          const normalizedOrcid = normalizeOrcid(value);
          if (!normalizedOrcid || !hasValidOrcidChecksum(normalizedOrcid)) {
            return 'Enter a valid ORCID iD with a valid checksum (e.g. 0000-0002-1825-0097).';
          }
        } else if (currentForm.role === 'Researcher' && value.trim()) {
          const normalizedOrcid = normalizeOrcid(value);
          if (!normalizedOrcid || !hasValidOrcidChecksum(normalizedOrcid)) {
            return 'Enter a valid ORCID iD with a valid checksum (e.g. 0000-0002-1825-0097).';
          }
        }
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
    const nextRole = (name === 'role' ? value : form.role) as RequestableRole;

    setForm((prev) => ({
      ...prev,
      [name]: nextValue,
      ...(name === 'role' && !isOrcidRole(nextRole) ? { orcidId: '' } : {}),
    }));

    if (errors[name as keyof FormState]) {
      const fieldError = validateField(name as keyof FormState, nextValue, {
        ...form,
        [name]: nextValue,
        ...(name === 'role' && !isOrcidRole(nextRole) ? { orcidId: '' } : {}),
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

    if (!form.role) {
      next.role = 'Role is required';
    }

    if (form.role === 'Reviewer') {
      if (!form.orcidId.trim()) {
        next.orcidId = 'ORCID iD is required for Reviewers';
      } else {
        const normalizedOrcid = normalizeOrcid(form.orcidId);
        if (!normalizedOrcid || !hasValidOrcidChecksum(normalizedOrcid)) {
          next.orcidId =
            'Enter a valid ORCID iD with a valid checksum (e.g. 0000-0002-1825-0097).';
        }
      }
    } else if (form.role === 'Researcher' && form.orcidId.trim()) {
      const normalizedOrcid = normalizeOrcid(form.orcidId);
      if (!normalizedOrcid || !hasValidOrcidChecksum(normalizedOrcid)) {
        next.orcidId =
          'Enter a valid ORCID iD with a valid checksum (e.g. 0000-0002-1825-0097).';
      }
    }

    if (!form.consentAccepted) {
      next.consentAccepted =
        'You must accept the Privacy Policy and Terms before registering.';
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
    if (form.role === 'Reviewer') {
      if (!form.orcidId.trim()) return false;
      const normalized = normalizeOrcid(form.orcidId);
      if (!normalized || !hasValidOrcidChecksum(normalized)) return false;
    } else if (form.role === 'Researcher' && form.orcidId.trim()) {
      const normalized = normalizeOrcid(form.orcidId);
      if (!normalized || !hasValidOrcidChecksum(normalized)) return false;
    }
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
      const normalizedOrcid = form.orcidId.trim()
        ? normalizeOrcid(form.orcidId) || form.orcidId.trim()
        : undefined;

      const payload: RegisterPayload = {
        username: form.email.trim(),
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim().replace(/[\s\-()]/g, ''),
        role: form.role,
        pdfUrl,
        ...(isOrcidRole(form.role) && normalizedOrcid ? { orcidId: normalizedOrcid } : {}),
        // Mirror the auth-service payload contract: new accounts start
        // pending (isActive: false) until an Admin approves the role
        // request. The BE echoes this on the response.
        isActive: false,
      };

      const response: AuthResponse = await authService.registerUser(payload);

      // Persist the auth state so the user is recognised as authenticated
      // when they land on /forum. The Zustand store + storage both need
      // updating so route guards (which read from storage during rehydrate)
      // and the React tree (which reads from the store) see the same data.
      // `isActive` defaults to false here because the spec says new
      // registrations stay pending until an Admin approves the role request.
      authService.setAuthData(response);
      authStore.login(
        {
          id: 0,
          username: response.username,
          email: response.email,
          fullName: response.username,
          roleId: response.roleId ?? 0,
          roleName: response.role,
          isActive: response.isActive ?? false,
        },
        response.token
      );

      setIsSuccessOpen(true);
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
      <div className={styles.logoHeader}>
        <div className={styles.logoWrapper}>
          <img src={ARSLogo} alt="ARS Logo" className={styles.logoImage} />
        </div>
        <span className={styles.brandText}>Academic Research System</span>
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>Create your Account</h1>
        <p className={styles.subtitle}>
          Join the ARS community to publish, review, and collaborate on academic
          research.
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
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
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            className={`${styles.nativeInput} ${errors.fullName ? styles['nativeInput--error'] : ''}`}
            placeholder="e.g., Dr. Nguyen Van A"
            value={form.fullName}
            onChange={handleChange}
            onBlur={() => handleBlur('fullName')}
            disabled={isSubmitting || isUploadingPdf}
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
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className={`${styles.nativeInput} ${errors.email ? styles['nativeInput--error'] : ''}`}
            placeholder="email@example.com"
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
            Phone Number
          </label>
          <input
            id="phoneNumber"
            name="phoneNumber"
            type="tel"
            className={`${styles.nativeInput} ${errors.phoneNumber ? styles['nativeInput--error'] : ''}`}
            placeholder="0901234567"
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
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className={`${styles.nativeInput} ${errors.password ? styles['nativeInput--error'] : ''}`}
              placeholder="Create a password"
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
              Retype Password
            </label>
            <input
              id="retypePassword"
              name="retypePassword"
              type="password"
              className={`${styles.nativeInput} ${errors.retypePassword ? styles['nativeInput--error'] : ''}`}
              placeholder="Retype your password"
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
          Must be at least 8 characters with 1 uppercase letter and 1 number.
        </p>

        <div className={styles.fieldGroup}>
          <label
            htmlFor="role"
            className={`${styles.fieldLabel} ${styles['fieldLabel--required']}`}
          >
            Select Your Platform Role
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
            {REGISTRATION_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <FieldError id="role-error" message={errors.role} />
        </div>

        {(form.role === 'Researcher' || form.role === 'Reviewer') && (
          <div className={styles.fieldGroup}>
            <label
              htmlFor="orcidId"
              className={`${styles.fieldLabel} ${form.role === 'Reviewer' ? styles['fieldLabel--required'] : ''}`}
            >
              ORCID iD {form.role === 'Researcher' && <span className={styles.optionalText}>(Optional)</span>}
            </label>
            <input
              id="orcidId"
              name="orcidId"
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder="0000-0000-0000-0000 or https://orcid.org/..."
              value={form.orcidId}
              onChange={handleChange}
              onBlur={() => handleBlur('orcidId')}
              disabled={isSubmitting || isUploadingPdf}
              aria-describedby="orcid-help"
              aria-invalid={Boolean(errors.orcidId)}
              className={`${styles.nativeInput} ${errors.orcidId ? styles['nativeInput--error'] : ''}`}
            />
            <p className={styles.passwordHelper} id="orcid-help">
              Enter your canonical ORCID iD or full ORCID URL (e.g. 0000-0002-1825-0097).
            </p>
            <FieldError id="orcidId-error" message={errors.orcidId} testId="register-error-orcidId" />
          </div>
        )}

        <div className={styles.roleBanner}>
          <span className={styles.roleBannerIcon}>
            <Info size={20} />
          </span>
          <div className={styles.roleBannerContent}>
            <p className={styles.roleBannerTitle}>
              {form.role} Verification Required
            </p>
            <p className={styles.roleBannerText}>{ROLE_REQUIREMENTS[form.role]}</p>
            <div className={styles.roleBannerAction}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSampleOpen(true)}
                className={styles.sampleBtn}
                disabled={isUploadingPdf}
              >
                View Sample PDF Format
              </Button>
            </div>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label
            className={`${styles.fieldLabel} ${styles['fieldLabel--required']}`}
          >
            Verification Document (PDF)
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
              I have read and agree to the{' '}
              <a
                href="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.consentLink}
                onClick={(e) => e.stopPropagation()}
              >
                Privacy Policy
              </a>{' '}
              and{' '}
              <a
                href="/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.consentLink}
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
              </a>
            </span>
          </label>
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
          Create Account
        </Button>

        <div className={styles.divider}>or</div>

        <div className={styles.googleButtonWrapper}>
          <GoogleSignInButton
            label="Sign up with Google"
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
            Already have an account?{' '}
            <Link to={ROUTES.LOGIN} className={styles.loginLink}>
              Sign in instead
            </Link>
          </p>
        </div>
      </form>

      <SamplePdfModal
        isOpen={isSampleOpen}
        onClose={() => setIsSampleOpen(false)}
        initialRole={form.role}
      />

      <RegisterSuccessModal
        isOpen={isSuccessOpen}
        email={form.email}
        role={form.role}
        onClose={() => {
          setIsSuccessOpen(false);
          setForm(initialForm);
          // The user is now authenticated but pending (isActive: false).
          // /forum is the only route they can access; the verified-guard
          // in MainLayout will bounce them back here if they try anything
          // else, and the Forum page shows the pending banner.
          navigate(ROUTES.FORUM, { replace: true });
        }}
      />
    </div>
  );
};

export default Register;
