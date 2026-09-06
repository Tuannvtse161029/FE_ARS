/**
 * ViewProfileModal — admin "View Profile" modal for the Accounts page.
 *
 * Fetches the public profile for the selected user via
 * `profileService.getByUserId(id)` (the same service the profile page
 * uses). Closes via X button, ESC, or backdrop click. Focus is trapped
 * inside the dialog while open and restored to the trigger element on
 * close. Skeleton + error states are handled inline so the modal never
 * silently renders a blank body.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Mail,
  Building2,
  FileText,
  ShieldCheck,
  CircleAlert,
} from 'lucide-react';
import { profileService } from '../../services/profile.service';
import type { Profile } from '../../types/profile';
import { useI18n } from '../../i18n/I18nContext';
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

export const ViewProfileModal: React.FC<ViewProfileModalProps> = ({
  account,
  onClose,
}) => {
  const { t, locale } = useI18n();
  const localeTag: 'en' | 'vi' = locale === 'vi' ? 'vi' : 'en';

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
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

  // Fetch the profile.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfile(null);
    profileService
      .getByUserId(account.id)
      .then((p: Profile) => {
        if (cancelled) return;
        setProfile(p);
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

  const fullName = profile?.fullName || account.name;
  const email = profile?.email || account.email;
  const institution = profile?.institution;
  const bio = profile?.bio;
  const orcidId = profile?.orcidId;
  const orcidVerified = profile?.isOrcidVerified === true;
  const role =
    profile?.roleName ||
    (account.roles.length > 0 ? account.roles[0] : null);

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
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
          >
            <X size={18} aria-hidden="true" />
          </button>
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
              <div className={styles.avatarRow}>
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
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
                  <span className={styles.fullName}>{fullName}</span>
                  {profile?.academicTitle && (
                    <span className={styles.titleLine}>
                      {profile.academicTitle}
                    </span>
                  )}
                  {role && (
                    <span className={styles.roleBadge}>
                      {humanRole(role, localeTag)}
                    </span>
                  )}
                </div>
              </div>

              {!profile ? (
                <p className={styles.empty}>
                  {t(
                    'admin.accounts.modal.viewProfile.empty',
                    localeTag === 'vi'
                      ? 'Người dùng chưa cập nhật hồ sơ.'
                      : 'This user has not set up their profile yet.',
                  )}
                </p>
              ) : (
                <dl className={styles.fields}>
                  <div className={styles.field}>
                    <dt>
                      <Mail size={14} aria-hidden="true" />
                      <span>
                        {t(
                          'admin.accounts.modal.viewProfile.email',
                          localeTag === 'vi' ? 'Email' : 'Email',
                        )}
                      </span>
                    </dt>
                    <dd>{email || '—'}</dd>
                  </div>

                  {institution && (
                    <div className={styles.field}>
                      <dt>
                        <Building2 size={14} aria-hidden="true" />
                        <span>
                          {t(
                            'admin.accounts.modal.viewProfile.institution',
                            localeTag === 'vi'
                              ? 'Cơ quan / Trường'
                              : 'Institution',
                          )}
                        </span>
                      </dt>
                      <dd>{institution}</dd>
                    </div>
                  )}

                  <div className={styles.field}>
                    <dt>
                      <ShieldCheck size={14} aria-hidden="true" />
                      <span>
                        {t(
                          'admin.accounts.modal.viewProfile.orcid',
                          localeTag === 'vi' ? 'ORCID iD' : 'ORCID iD',
                        )}
                      </span>
                    </dt>
                    <dd>
                      {orcidId ? (
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
                                  localeTag === 'vi'
                                    ? 'Đã xác minh'
                                    : 'Verified',
                                )
                              : t(
                                  'admin.accounts.modal.viewProfile.notVerified',
                                  localeTag === 'vi'
                                    ? 'Chưa xác minh'
                                    : 'Not verified',
                                )}
                          </span>
                        </span>
                      ) : (
                        <span className={styles.muted}>
                          {t(
                            'admin.accounts.modal.viewProfile.notConnected',
                            localeTag === 'vi'
                              ? 'Chưa liên kết'
                              : 'Not connected',
                          )}
                        </span>
                      )}
                    </dd>
                  </div>

                  {bio && (
                    <div className={styles.field}>
                      <dt>
                        <FileText size={14} aria-hidden="true" />
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
                  )}
                </dl>
              )}
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
