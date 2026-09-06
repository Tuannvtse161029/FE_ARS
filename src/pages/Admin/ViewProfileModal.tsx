/**
 * ViewProfileModal — admin "View Profile" modal for the Accounts page.
 *
 * Surfaces every Admin-facing signal the system already knows about a user
 * so the Admin can make informed decisions about suspending, role
 * rejection, or role request decisions. Combines three BE surfaces:
 *   - `/api/User/{id}`            → account state (plan, status, joined,
 *                                  suspendedUntil, trialExpiryAt, roles, etc.)
 *   - `/api/Profile/{id}`         → professional / academic surface (h-index,
 *                                  citations, publications, fields, bio,
 *                                  keywords, contact, ORCID)
 *   - `/api/ProfessionalProfile/{id}` → fallback profile endpoint.
 *
 * Closes via X button, ESC, or backdrop click. Focus is trapped inside the
 * dialog while open and restored to the trigger element on close. Skeleton
 * + error states are handled inline so the modal never silently renders a
 * blank body.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Mail,
  Phone,
  MapPin,
  Building2,
  FileText,
  ShieldCheck,
  ShieldAlert,
  CircleAlert,
  Calendar,
  BadgeCheck,
  Briefcase,
  GraduationCap,
  Activity,
  Hash,
  Quote,
  Tags,
  CheckCircle2,
  XCircle,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  Wallet,
  CalendarClock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { profileService } from '../../services/profile.service';
import { adminUserService } from '../../services/adminUser.service';
import type { Profile } from '../../types/profile';
import type { User } from '../../types/auth';
import { useI18n } from '../../i18n/I18nContext';
import { displayAccountTier } from '../../services/user.service';
import type { AccountItem } from '../../types/admin';
import styles from './ViewProfileModal.module.css';

export interface ViewProfileModalProps {
  account: AccountItem;
  onClose: () => void;
}

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .map((s) => s[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

const humanRole = (
  raw: string | null | undefined,
  locale: 'en' | 'vi',
): string => {
  if (!raw) return locale === 'vi' ? 'Không rõ' : 'Unknown';
  // The BE sometimes returns canonical role names; otherwise translate
  // some well-known enums to the locale's label.
  const enMap: Record<string, { en: string; vi: string }> = {
    RESEARCHER: { en: 'Researcher', vi: 'Nhà nghiên cứu' },
    LECTURER: { en: 'Lecturer', vi: 'Giảng viên' },
    REVIEWER: { en: 'Reviewer', vi: 'Người phản biện' },
    GRADUATE_STUDENT: { en: 'Graduate Student', vi: 'Học viên' },
    ADMIN: { en: 'Admin', vi: 'Quản trị viên' },
    Researcher: { en: 'Researcher', vi: 'Nhà nghiên cứu' },
    Lecturer: { en: 'Lecturer', vi: 'Giảng viên' },
    Reviewer: { en: 'Reviewer', vi: 'Người phản biện' },
    'Graduate Student': { en: 'Graduate Student', vi: 'Học viên' },
    Admin: { en: 'Admin', vi: 'Quản trị viên' },
  };
  const entry = enMap[raw];
  if (entry) return entry[locale];
  return raw;
};

const ACCOUNT_ROLE_LABEL: Record<string, { en: string; vi: string }> = {
  RESEARCHER: { en: 'Researcher', vi: 'Nhà nghiên cứu' },
  LECTURER: { en: 'Lecturer', vi: 'Giảng viên' },
  REVIEWER: { en: 'Reviewer', vi: 'Người phản biện' },
  GRADUATE_STUDENT: { en: 'Graduate Student', vi: 'Học viên' },
};

const formatDate = (iso: string | null | undefined, localeTag: 'en' | 'vi') => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleDateString(localeTag === 'vi' ? 'vi-VN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
};

const ACCOUNT_STATUS_LABEL: Record<string, { en: string; vi: string }> = {
  ACTIVE: { en: 'Active', vi: 'Đang hoạt động' },
  SUSPENDED: { en: 'Suspended', vi: 'Đã đình chỉ' },
  EXPIRED: { en: 'Expired', vi: 'Hết hạn' },
  TRIAL: { en: 'Trial', vi: 'Dùng thử' },
};

const ACCOUNT_STATUS_PILL_CLASS: Record<string, string> = {
  ACTIVE: styles.statusActive,
  SUSPENDED: styles.statusSuspended,
  EXPIRED: styles.statusExpired,
  TRIAL: styles.statusTrial,
};

const VERIFICATION_STATUS_LABEL: Record<string, { en: string; vi: string }> = {
  Pending: { en: 'Pending review', vi: 'Đang chờ xét duyệt' },
  Accepted: { en: 'Accepted', vi: 'Đã chấp nhận' },
  Rejected: { en: 'Rejected', vi: 'Đã từ chối' },
};

const VERIFICATION_PILL_CLASS: Record<string, string> = {
  Pending: styles.statusPending,
  Accepted: styles.statusApproved,
  Rejected: styles.statusRejected,
};

export const ViewProfileModal: React.FC<ViewProfileModalProps> = ({
  account,
  onClose,
}) => {
  const { t, locale } = useI18n();
  const localeTag: 'en' | 'vi' = locale === 'vi' ? 'vi' : 'en';

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Save the element that had focus before opening so we can restore it.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    previousFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    return () => {
      // Restore focus on unmount.
      previousFocusRef.current?.focus?.();
    };
  }, []);

  // Fetch the profile AND the user row in parallel so the Admin sees every
  // signal the BE holds about this account. Profile covers academic /
  // personal surface, User covers account / status surface.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfile(null);
    setUser(null);
    Promise.all([
      profileService.getByUserId(account.id).catch((err: unknown) => {
        if (cancelled) return null;
        throw err instanceof Error ? err : new Error('profile');
      }),
      adminUserService.getById(account.id).catch((err: unknown) => {
        if (cancelled) return null;
        throw err instanceof Error ? err : new Error('user');
      }),
    ])
      .then(([profileResult, userResult]) => {
        if (cancelled) return;
        setProfile(profileResult ?? null);
        setUser(userResult ?? null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error && err.message
            ? err.message
            : t('admin.accounts.modal.viewProfile.error'),
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account.id, t]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      // Focus trap: cycle within the dialog.
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  // Initial focus on the dialog container.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const titleId = 'viewProfileModalTitle';
  const closeLabel = t(
    'admin.accounts.modal.viewProfile.close',
    localeTag === 'vi' ? 'Đóng' : 'Close',
  );

  const fullName = profile?.fullName || account.name || user?.fullName || '';
  const email = profile?.email || account.email || user?.email;
  const institution = profile?.institution;
  const bio = profile?.bio;
  const orcidId = profile?.orcidId ?? user?.orcidId ?? null;
  const orcidVerified = profile?.isOrcidVerified === true;
  const role =
    profile?.roleName ||
    (account.roles.length > 0 ? account.roles[0] : null) ||
    user?.roleName;

  // Derive role labels from all known sources — the Admin User row may carry
  // multiple roles; the AccountItem normalizes the canonical set.
  const assignedRoles = (() => {
    const fromUser = Array.isArray(user?.roles) ? user.roles : [];
    const fromAccount = account.roles;
    const merged = new Set<string>([...fromUser, ...fromAccount]);
    if (role && typeof role === 'string') merged.add(role);
    return Array.from(merged);
  })();

  // Verification badge derivation — prefer the live User state, then
  // Profile, then the historical AccountStatus pill.
  const verificationStatus = user?.verificationStatus ?? null;
  const isEmailVerified = user?.isEmailVerified ?? false;
  const proofDocumentUrl = user?.proofDocumentUrl ?? null;
  const phoneNumber = profile?.phoneNumber ?? null;
  const address = profile?.address ?? null;
  const gender = profile?.gender ?? null;
  const dateOfBirth = profile?.dateOfBirth ?? null;
  const keywords = Array.isArray(profile?.keywords) ? profile.keywords : null;
  const majorFieldName = profile?.majorFieldName ?? null;
  const subFieldName = profile?.subFieldName ?? null;
  const hindex = profile?.hindex ?? null;
  const totalCitations = profile?.totalCitations ?? null;
  const publicationCount = profile?.publicationCount ?? null;
  const isAvailable = profile?.isAvailable;
  const isReviewer = assignedRoles.some((entry) =>
    typeof entry === 'string' && entry.toUpperCase() === 'REVIEWER',
  );

  const accountTier =
    user?.accountTier ??
    (account.plan === 'PREMIUM' ? 'Premium' : 'Free');
  const joinedDate = user?.createdAt ?? account.joinedDate;
  const updatedAt = user?.updatedAt ?? null;
  const suspendedUntil = user?.suspendedUntil ?? account.suspendedUntil ?? null;
  const trialExpiryAt = user?.trialExpiryAt ?? account.trialExpiryAt ?? null;
  const accountStatus: AccountItem['status'] = account.status;
  const isSuspended = !user?.isActive || accountStatus === 'SUSPENDED';

  // Additional fields for admin decision-making
  const username = user?.username ?? null;
  const roleId = user?.roleId ?? null;
  const effectiveRole = user?.effectiveRole ?? null;
  const avatarUrl = profile?.avatarUrl ?? user?.avatarUrl ?? null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h2 id={titleId} className={styles.title}>
              {t('admin.accounts.modal.viewProfile.title', 'User profile')}
            </h2>
            <span className={styles.subjectName}>{account.name}</span>
          </div>
          <div className={styles.headerActions}>
            {accountStatus ? (
              <span
                className={`${styles.statusPill} ${ACCOUNT_STATUS_PILL_CLASS[accountStatus] ?? styles.statusSuspended}`}
                aria-label={`Account status: ${accountStatus}`}
              >
                {accountStatus === 'SUSPENDED' ? (
                  <PauseCircle size={12} aria-hidden="true" />
                ) : accountStatus === 'TRIAL' ? (
                  <Sparkles size={12} aria-hidden="true" />
                ) : accountStatus === 'EXPIRED' ? (
                  <AlertTriangle size={12} aria-hidden="true" />
                ) : (
                  <PlayCircle size={12} aria-hidden="true" />
                )}
                {t(
                  `admin.accounts.filter.status.${accountStatus.toLowerCase()}`,
                  (ACCOUNT_STATUS_LABEL[accountStatus] ?? { en: accountStatus, vi: accountStatus })[localeTag],
                )}
              </span>
            ) : null}
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label={closeLabel}
              title={closeLabel}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className={styles.body}>
          {loading ? (
            <div
              className={styles.skeleton}
              role="status"
              aria-live="polite"
              aria-label={t(
                'admin.accounts.modal.viewProfile.loading',
                localeTag === 'vi' ? 'Đang tải hồ sơ...' : 'Loading profile…',
              )}
            >
              <div className={styles.skeletonAvatar} />
              <div className={styles.skeletonLines}>
                <div className={styles.skeletonLineLg} />
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonBlock} />
              </div>
            </div>
          ) : error ? (
            <div className={styles.errorState} role="alert">
              <CircleAlert size={20} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : (
            <div className={styles.profile}>
              {/* ── Identity header ───────────────────────── */}
              <section className={styles.identityCard} aria-labelledby="vp-identity-title">
                <h3 id="vp-identity-title" className={styles.sectionTitle}>
                  <BadgeCheck size={14} aria-hidden="true" />
                  {t('admin.accounts.modal.viewProfile.identitySection', 'Identity')}
                </h3>
                <div className={styles.avatarRow}>
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`${fullName} avatar`}
                      className={styles.avatarImg}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className={styles.avatarInitials} aria-hidden="true">
                      {initialsOf(fullName || account.name)}
                    </span>
                  )}
                  <div className={styles.identity}>
                    <span className={styles.fullName}>{fullName || account.name}</span>
                    {profile?.academicTitle && (
                      <span className={styles.titleLine}>{profile.academicTitle}</span>
                    )}
                    {username && (
                      <span className={styles.usernameLine}>@{username}</span>
                    )}
                    <div className={styles.identityMeta}>
                      {role && (
                        <span className={styles.roleBadge}>
                          {humanRole(role, localeTag)}
                        </span>
                      )}
                      {effectiveRole && effectiveRole !== role ? (
                        <span className={styles.roleBadge} title="Effective role (current session state)">
                          {humanRole(effectiveRole, localeTag)} (effective)
                        </span>
                      ) : null}
                      {verificationStatus ? (
                        <span
                          className={`${styles.statusPill} ${VERIFICATION_PILL_CLASS[verificationStatus] ?? styles.statusPending}`}
                          aria-label={`Verification status: ${verificationStatus}`}
                        >
                          {verificationStatus === 'Accepted' ? (
                            <CheckCircle2 size={11} aria-hidden="true" />
                          ) : verificationStatus === 'Rejected' ? (
                            <XCircle size={11} aria-hidden="true" />
                          ) : (
                            <AlertTriangle size={11} aria-hidden="true" />
                          )}
                          {(VERIFICATION_STATUS_LABEL[verificationStatus] ?? {
                            en: verificationStatus,
                            vi: verificationStatus,
                          })[localeTag]}
                        </span>
                      ) : null}
                      <span
                        className={`${styles.statusPill} ${
                          isEmailVerified ? styles.statusApproved : styles.statusPending
                        }`}
                        title={
                          isEmailVerified
                            ? t('admin.accounts.modal.viewProfile.emailVerified', 'Email verified')
                            : t('admin.accounts.modal.viewProfile.emailUnverified', 'Email not verified')
                        }
                      >
                        {isEmailVerified ? (
                          <CheckCircle2 size={11} aria-hidden="true" />
                        ) : (
                          <AlertTriangle size={11} aria-hidden="true" />
                        )}
                        {isEmailVerified
                          ? t('admin.accounts.modal.viewProfile.emailVerifiedShort', 'Email OK')
                          : t('admin.accounts.modal.viewProfile.emailUnverifiedShort', 'Email unverified')}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Account & status (admin decision surface) ─── */}
              <section className={styles.section} aria-labelledby="vp-account-title">
                <h3 id="vp-account-title" className={styles.sectionTitle}>
                  <Briefcase size={14} aria-hidden="true" />
                  {t('admin.accounts.modal.viewProfile.accountSection', 'Account & status')}
                </h3>
                <dl className={styles.fieldGrid}>
                  <div className={styles.field}>
                    <dt>
                      <Hash size={13} aria-hidden="true" />
                      <span>
                        {t('admin.accounts.modal.viewProfile.userId', 'User ID')}
                      </span>
                    </dt>
                    <dd>
                      <code className={styles.codeChip}>#{account.id}</code>
                    </dd>
                  </div>
                  {username ? (
                    <div className={styles.field}>
                      <dt>
                        <span>
                          {t('admin.accounts.modal.viewProfile.username', 'Username')}
                        </span>
                      </dt>
                      <dd>
                        <code className={styles.codeChip}>@{username}</code>
                      </dd>
                    </div>
                  ) : null}
                  {roleId ? (
                    <div className={styles.field}>
                      <dt>
                        <span>
                          {t('admin.accounts.modal.viewProfile.roleId', 'Role ID')}
                        </span>
                      </dt>
                      <dd>
                        <code className={styles.codeChip}>{roleId}</code>
                      </dd>
                    </div>
                  ) : null}
                  <div className={styles.field}>
                    <dt>
                      <Wallet size={13} aria-hidden="true" />
                      <span>
                        {t(
                          'admin.accounts.modal.viewProfile.plan',
                          localeTag === 'vi' ? 'Gói dịch vụ' : 'Plan',
                        )}
                      </span>
                    </dt>
                    <dd>
                      <span
                        className={`${styles.statusPill} ${
                          accountTier === 'Premium'
                            ? styles.statusApproved
                            : styles.statusPending
                        }`}
                      >
                        {displayAccountTier(accountTier)}
                      </span>
                      {account.plan === 'PREMIUM' && accountTier !== 'Premium' ? (
                        <small className={styles.fieldHint}>
                          ({t('admin.accounts.modal.viewProfile.planLive', 'Live plan')})
                        </small>
                      ) : null}
                    </dd>
                  </div>
                  <div className={styles.field}>
                    <dt>
                      <Calendar size={13} aria-hidden="true" />
                      <span>
                        {t('admin.accounts.modal.viewProfile.joined', 'Joined')}
                      </span>
                    </dt>
                    <dd>{formatDate(joinedDate, localeTag)}</dd>
                  </div>
                  {updatedAt ? (
                    <div className={styles.field}>
                      <dt>
                        <Activity size={13} aria-hidden="true" />
                        <span>
                          {t(
                            'admin.accounts.modal.viewProfile.lastUpdated',
                            'Last updated',
                          )}
                        </span>
                      </dt>
                      <dd>{formatDate(updatedAt, localeTag)}</dd>
                    </div>
                  ) : null}
                  {isSuspended || suspendedUntil ? (
                    <div className={styles.field}>
                      <dt>
                        <PauseCircle size={13} aria-hidden="true" />
                        <span>
                          {t(
                            'admin.accounts.modal.viewProfile.suspendedUntil',
                            'Suspended until',
                          )}
                        </span>
                      </dt>
                      <dd>{formatDate(suspendedUntil ?? null, localeTag)}</dd>
                    </div>
                  ) : null}
                  {accountStatus === 'TRIAL' && trialExpiryAt ? (
                    <div className={styles.field}>
                      <dt>
                        <CalendarClock size={13} aria-hidden="true" />
                        <span>
                          {t(
                            'admin.accounts.modal.viewProfile.trialUntil',
                            'Trial until',
                          )}
                        </span>
                      </dt>
                      <dd>{formatDate(trialExpiryAt, localeTag)}</dd>
                    </div>
                  ) : null}
                  <div className={styles.field}>
                    <dt>
                      <ShieldCheck size={13} aria-hidden="true" />
                      <span>
                        {t(
                          'admin.accounts.modal.viewProfile.accountState',
                          'Account state',
                        )}
                      </span>
                    </dt>
                    <dd>
                      <span
                        className={`${styles.statusPill} ${
                          isSuspended ? styles.statusSuspended : styles.statusActive
                        }`}
                      >
                        {isSuspended
                          ? t('admin.accounts.modal.viewProfile.disabled', 'Disabled')
                          : t('admin.accounts.modal.viewProfile.enabled', 'Active')}
                      </span>
                    </dd>
                  </div>
                </dl>
              </section>

              {/* ── Contact ───────────────────────────────── */}
              <section className={styles.section} aria-labelledby="vp-contact-title">
                <h3 id="vp-contact-title" className={styles.sectionTitle}>
                  <Mail size={14} aria-hidden="true" />
                  {t('admin.accounts.modal.viewProfile.contactSection', 'Contact')}
                </h3>
                <dl className={styles.fieldGrid}>
                  <div className={styles.field}>
                    <dt>
                      <Mail size={13} aria-hidden="true" />
                      <span>
                        {t(
                          'admin.accounts.modal.viewProfile.email',
                          localeTag === 'vi' ? 'Email' : 'Email',
                        )}
                      </span>
                    </dt>
                    <dd className={styles.copyable}>
                      <span>{email || '—'}</span>
                      {email ? (
                        <a
                          className={styles.textLink}
                          href={`mailto:${email}`}
                          aria-label={`Email ${email}`}
                        >
                          <ExternalLink size={11} aria-hidden="true" />
                        </a>
                      ) : null}
                    </dd>
                  </div>
                  {phoneNumber ? (
                    <div className={styles.field}>
                      <dt>
                        <Phone size={13} aria-hidden="true" />
                        <span>
                          {t('admin.accounts.modal.viewProfile.phone', 'Phone')}
                        </span>
                      </dt>
                      <dd className={styles.copyable}>
                        <span>{phoneNumber}</span>
                        <a
                          className={styles.textLink}
                          href={`tel:${phoneNumber}`}
                          aria-label={`Call ${phoneNumber}`}
                        >
                          <ExternalLink size={11} aria-hidden="true" />
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {address ? (
                    <div className={styles.field}>
                      <dt>
                        <MapPin size={13} aria-hidden="true" />
                        <span>
                          {t('admin.accounts.modal.viewProfile.address', 'Address')}
                        </span>
                      </dt>
                      <dd>{address}</dd>
                    </div>
                  ) : null}
                  {gender || dateOfBirth ? (
                    <div className={styles.field}>
                      <dt>
                        <Calendar size={13} aria-hidden="true" />
                        <span>
                          {t(
                            'admin.accounts.modal.viewProfile.personal',
                            localeTag === 'vi' ? 'Cá nhân' : 'Personal',
                          )}
                        </span>
                      </dt>
                      <dd>
                        {gender ? (
                          <span className={styles.metaTag}>{gender}</span>
                        ) : null}
                        {dateOfBirth ? (
                          <span className={styles.metaTag}>
                            {t(
                              'admin.accounts.modal.viewProfile.dob',
                              localeTag === 'vi' ? 'Ngày sinh' : 'DOB',
                            )}
                            : {formatDate(dateOfBirth, localeTag)}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              {/* ── Academic / professional profile ────── */}
              <section className={styles.section} aria-labelledby="vp-academic-title">
                <h3 id="vp-academic-title" className={styles.sectionTitle}>
                  <GraduationCap size={14} aria-hidden="true" />
                  {t('admin.accounts.modal.viewProfile.academicSection', 'Academic profile')}
                </h3>
                {!profile && !(user && user.proofDocumentUrl) ? (
                  <p className={styles.empty}>
                    {t(
                      'admin.accounts.modal.viewProfile.empty',
                      localeTag === 'vi'
                        ? 'Người dùng chưa cập nhật hồ sơ.'
                        : 'This user has not set up their profile yet.',
                    )}
                  </p>
                ) : (
                  <dl className={styles.fieldGrid}>
                    {profile?.academicTitle ? (
                      <div className={styles.field}>
                        <dt>
                          <GraduationCap size={13} aria-hidden="true" />
                          <span>
                            {t(
                              'admin.accounts.modal.viewProfile.academicTitle',
                              localeTag === 'vi' ? 'Học hàm / Học vị' : 'Academic title',
                            )}
                          </span>
                        </dt>
                        <dd>{profile.academicTitle}</dd>
                      </div>
                    ) : null}
                    {institution ? (
                      <div className={styles.field}>
                        <dt>
                          <Building2 size={13} aria-hidden="true" />
                          <span>
                            {t(
                              'admin.accounts.modal.viewProfile.institution',
                              localeTag === 'vi' ? 'Cơ quan / Trường' : 'Institution',
                            )}
                          </span>
                        </dt>
                        <dd>{institution}</dd>
                      </div>
                    ) : null}
                    {majorFieldName ? (
                      <div className={styles.field}>
                        <dt>
                          <Hash size={13} aria-hidden="true" />
                          <span>
                            {t(
                              'admin.accounts.modal.viewProfile.majorField',
                              localeTag === 'vi' ? 'Lĩnh vực chính' : 'Major field',
                            )}
                          </span>
                        </dt>
                        <dd>{majorFieldName}</dd>
                      </div>
                    ) : null}
                    {subFieldName ? (
                      <div className={styles.field}>
                        <dt>
                          <Hash size={13} aria-hidden="true" />
                          <span>
                            {t(
                              'admin.accounts.modal.viewProfile.subField',
                              localeTag === 'vi' ? 'Chuyên ngành' : 'Subfield',
                            )}
                          </span>
                        </dt>
                        <dd>
                          <span className={styles.matchedSubField}>
                            {subFieldName}
                          </span>
                        </dd>
                      </div>
                    ) : null}
                    {isReviewer ? (
                      <div className={styles.field}>
                        <dt>
                          <Activity size={13} aria-hidden="true" />
                          <span>
                            {t(
                              'admin.accounts.modal.viewProfile.availability',
                              localeTag === 'vi' ? 'Trạng thái nhận phản biện' : 'Reviewer availability',
                            )}
                          </span>
                        </dt>
                        <dd>
                          <span
                            className={`${styles.statusPill} ${
                              isAvailable === true
                                ? styles.statusApproved
                                : isAvailable === false
                                  ? styles.statusSuspended
                                  : styles.statusPending
                            }`}
                          >
                            {isAvailable === true
                              ? t(
                                  'admin.accounts.modal.viewProfile.available',
                                  localeTag === 'vi' ? 'Đang nhận phản biện' : 'Available',
                                )
                              : isAvailable === false
                                ? t(
                                    'admin.accounts.modal.viewProfile.unavailable',
                                    localeTag === 'vi' ? 'Tạm ngưng' : 'Paused',
                                  )
                                : t(
                                    'admin.accounts.modal.viewProfile.availabilityUnknown',
                                    localeTag === 'vi' ? 'Chưa đặt' : 'Not set',
                                  )}
                          </span>
                        </dd>
                      </div>
                    ) : null}
                    {hindex != null || totalCitations != null || publicationCount != null ? (
                      <div className={styles.field}>
                        <dt>
                          <Hash size={13} aria-hidden="true" />
                          <span>
                            {t(
                              'admin.accounts.modal.viewProfile.metrics',
                              localeTag === 'vi' ? 'Chỉ số học thuật' : 'Academic metrics',
                            )}
                          </span>
                        </dt>
                        <dd>
                          <div className={styles.metricRow}>
                            {hindex != null ? (
                              <span className={styles.metricChip}>
                                <span className={styles.metricValue}>{hindex}</span>
                                <span className={styles.metricLabel}>
                                  H-Index
                                </span>
                              </span>
                            ) : null}
                            {totalCitations != null ? (
                              <span className={styles.metricChip}>
                                <span className={styles.metricValue}>
                                  {totalCitations.toLocaleString()}
                                </span>
                                <span className={styles.metricLabel}>
                                  {t(
                                    'admin.accounts.modal.viewProfile.citations',
                                    localeTag === 'vi' ? 'Trích dẫn' : 'Citations',
                                  )}
                                </span>
                              </span>
                            ) : null}
                            {publicationCount != null ? (
                              <span className={styles.metricChip}>
                                <span className={styles.metricValue}>
                                  {publicationCount.toLocaleString()}
                                </span>
                                <span className={styles.metricLabel}>
                                  {t(
                                    'admin.accounts.modal.viewProfile.publications',
                                    localeTag === 'vi' ? 'Công trình' : 'Publications',
                                  )}
                                </span>
                              </span>
                            ) : null}
                          </div>
                        </dd>
                      </div>
                    ) : null}
                    {orcidId ? (
                      <div className={styles.field}>
                        <dt>
                          <ShieldCheck size={13} aria-hidden="true" />
                          <span>
                            {t('admin.accounts.modal.viewProfile.orcid', 'ORCID iD')}
                          </span>
                        </dt>
                        <dd>
                          <span className={styles.orcidRow}>
                            <code className={styles.orcidValue}>{orcidId}</code>
                            <span
                              className={
                                orcidVerified
                                  ? styles.verifiedBadge
                                  : styles.unverifiedBadge
                              }
                            >
                              {orcidVerified
                                ? t(
                                    'admin.accounts.modal.viewProfile.orcidVerified',
                                    localeTag === 'vi' ? 'Đã xác minh' : 'Verified',
                                  )
                                : t(
                                    'admin.accounts.modal.viewProfile.notVerified',
                                    localeTag === 'vi' ? 'Chưa xác minh' : 'Not verified',
                                  )}
                            </span>
                            <a
                              href={`https://orcid.org/${orcidId}`}
                              target="_blank"
                              rel="noreferrer noopener"
                              className={styles.textLink}
                              title={t('admin.accounts.modal.viewProfile.viewOnOrcid', 'View on ORCID')}
                            >
                              <ExternalLink size={11} aria-hidden="true" />
                            </a>
                          </span>
                        </dd>
                      </div>
                    ) : null}
                    {bio ? (
                      <div className={styles.fullWidthField}>
                        <dt>
                          <Quote size={13} aria-hidden="true" />
                          <span>
                            {t(
                              'admin.accounts.modal.viewProfile.bio',
                              localeTag === 'vi'
                                ? 'Giới thiệu / Định hướng nghiên cứu'
                                : 'Bio / Research focus',
                            )}
                          </span>
                        </dt>
                        <dd className={styles.bioText}>{bio}</dd>
                      </div>
                    ) : null}
                    {keywords && keywords.length > 0 ? (
                      <div className={styles.fullWidthField}>
                        <dt>
                          <Tags size={13} aria-hidden="true" />
                          <span>
                            {t(
                              'admin.accounts.modal.viewProfile.keywords',
                              localeTag === 'vi' ? 'Từ khóa nghiên cứu' : 'Research keywords',
                            )}
                          </span>
                        </dt>
                        <dd>
                          <ul className={styles.keywordList}>
                            {keywords.map((keyword) => (
                              <li key={keyword} className={styles.keywordChip}>
                                {keyword}
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                )}
              </section>

              {/* ── Roles (assigned business roles) ──────── */}
              {assignedRoles.length > 0 ? (
                <section className={styles.section} aria-labelledby="vp-roles-title">
                  <h3 id="vp-roles-title" className={styles.sectionTitle}>
                    <Briefcase size={14} aria-hidden="true" />
                    {t('admin.accounts.modal.viewProfile.rolesSection', 'Assigned roles')}
                  </h3>
                  <ul className={styles.roleList}>
                    {assignedRoles.map((entry) => {
                      const key = String(entry).toUpperCase().replace(/\s+/g, '_');
                      const label = ACCOUNT_ROLE_LABEL[key] ?? {
                        en: String(entry),
                        vi: String(entry),
                      };
                      return (
                        <li key={String(entry)} className={styles.roleChip}>
                          {label[localeTag]}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {/* ── Proof of identity (verification dossier) ─── */}
              {proofDocumentUrl ? (
                <section className={styles.section} aria-labelledby="vp-proof-title">
                  <h3 id="vp-proof-title" className={styles.sectionTitle}>
                    <FileText size={14} aria-hidden="true" />
                    {t(
                      'admin.accounts.modal.viewProfile.proofSection',
                      'Proof of identity',
                    )}
                  </h3>
                  <a
                    href={proofDocumentUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={styles.proofLink}
                  >
                    <FileText size={14} aria-hidden="true" />
                    <span>
                      {t(
                        'admin.accounts.modal.viewProfile.openProof',
                        localeTag === 'vi' ? 'Mở tài liệu xác minh trong tab mới' : 'Open proof document in new tab',
                      )}
                    </span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </section>
              ) : null}

              {/* ── Last-notice footer ─────────────────────────── */}
              {role === 'Researcher' || role === 'Reviewer' || role === 'Lecturer' ? (
                <p className={styles.disclosure}>
                  <ShieldAlert size={12} aria-hidden="true" />
                  {t(
                    'admin.accounts.modal.viewProfile.adminDisclosure',
                    'Suspending, rejecting role requests, or removing this account affects their ability to publish and respond to peer review across the platform.',
                  )}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.closeFooterBtn}
            onClick={onClose}
          >
            {closeLabel}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ViewProfileModal;
