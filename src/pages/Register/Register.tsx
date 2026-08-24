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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[+\d\s\-()]{8,20}$/;
const passwordRegex = {
  hasUpper: /[A-Z]/,
  hasNumber: /[0-9]/,
};

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

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'role' && value !== 'Reviewer' ? { orcidId: '' } : {}),
    }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};

    if (!form.fullName.trim() || form.fullName.trim().length < 2) {
      next.fullName = 'Full name must be at least 2 characters';
    }

    if (!form.email.trim()) {
      next.email = 'Email is required';
    } else if (!emailRegex.test(form.email)) {
      next.email = 'Invalid email format';
    }

    if (!form.phoneNumber.trim()) {
      next.phoneNumber = 'Phone number is required';
    } else if (!phoneRegex.test(form.phoneNumber)) {
      next.phoneNumber = 'Invalid phone number format';
    }

    if (!form.password) {
      next.password = 'Password is required';
    } else if (form.password.length < 8) {
      next.password = 'Password must be at least 8 characters';
    } else if (!passwordRegex.hasUpper.test(form.password)) {
      next.password = 'Password must contain at least one uppercase letter';
    } else if (!passwordRegex.hasNumber.test(form.password)) {
      next.password = 'Password must contain at least one number';
    }

    if (!form.retypePassword) {
      next.retypePassword = 'Please retype your password';
    } else if (form.retypePassword !== form.password) {
      next.retypePassword = 'Passwords must match';
    }

    if (!form.role) {
      next.role = 'Role is required';
    }

    if (form.role === 'Reviewer') {
      const normalizedOrcid = normalizeOrcid(form.orcidId);
      if (!normalizedOrcid || !hasValidOrcidChecksum(normalizedOrcid)) {
        next.orcidId = 'Enter a valid ORCID iD with a valid checksum.';
      }
    }

    if (!form.consentAccepted) {
      next.consentAccepted = 'You must accept the Privacy Policy and Terms before registering.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const isFormValid = (() => {
    if (!form.fullName.trim() || form.fullName.trim().length < 2) return false;
    if (!emailRegex.test(form.email)) return false;
    if (!phoneRegex.test(form.phoneNumber)) return false;
    if (form.password.length < 8) return false;
    if (!passwordRegex.hasUpper.test(form.password)) return false;
    if (!passwordRegex.hasNumber.test(form.password)) return false;
    if (form.password !== form.retypePassword) return false;
    if (!pdfUrl) return false;
    if (isUploadingPdf) return false;
    if (form.role === 'Reviewer' && !normalizeOrcid(form.orcidId)) return false;
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
        username: form.email.trim(),
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        role: form.role,
        pdfUrl,
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
      const message =
        err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setSubmitError(message);
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
            disabled={isSubmitting || isUploadingPdf}
            autoComplete="name"
          />
          {errors.fullName && <p className={styles.errorText}>{errors.fullName}</p>}
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
            disabled={isSubmitting || isUploadingPdf}
            autoComplete="email"
          />
          {errors.email && <p className={styles.errorText}>{errors.email}</p>}
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
            placeholder="+84 90 123 4567"
            value={form.phoneNumber}
            onChange={handleChange}
            disabled={isSubmitting || isUploadingPdf}
            autoComplete="tel"
          />
          {errors.phoneNumber && (
            <p className={styles.errorText}>{errors.phoneNumber}</p>
          )}
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
            disabled={isSubmitting || isUploadingPdf}
            autoComplete="new-password"
          />
          {errors.password && (
            <p className={styles.errorText}>{errors.password}</p>
          )}
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
            disabled={isSubmitting || isUploadingPdf}
            autoComplete="new-password"
            />
            {errors.retypePassword && (
              <p className={styles.errorText}>{errors.retypePassword}</p>
            )}
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
            className={styles.nativeSelect}
            value={form.role}
            onChange={handleChange}
            disabled={isSubmitting || isUploadingPdf}
          >
            {REGISTRATION_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          {errors.role && <p className={styles.errorText}>{errors.role}</p>}
        </div>

        {form.role === 'Reviewer' && (
          <div className={styles.fieldGroup}>
            <label
              htmlFor="orcidId"
              className={`${styles.fieldLabel} ${styles['fieldLabel--required']}`}
            >
              ORCID iD
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
              disabled={isSubmitting || isUploadingPdf}
              aria-describedby="orcid-help"
              aria-invalid={Boolean(errors.orcidId)}
              className={`${styles.nativeInput} ${errors.orcidId ? styles['nativeInput--error'] : ''}`}
            />
            <p className={styles.passwordHelper} id="orcid-help">
              Enter your canonical ORCID iD or full ORCID URL. ARS validates the checksum and
              uses the normalized value only for future reviewer verification support.
            </p>
            {errors.orcidId && <p className={styles.errorText}>{errors.orcidId}</p>}
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
