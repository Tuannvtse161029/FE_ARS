import { useEffect, useRef } from 'react';
import { X, FileText, UserCheck, GraduationCap, Users, LogIn, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes/paths';
import { useT } from '../../i18n/I18nContext';
import type { BusinessRole } from '../../types/auth';
import styles from './RoleExploreModal.module.css';

export type ExploreRole = 'Researcher' | 'Reviewer' | 'Lecturer' | 'Graduate Student';

interface RoleExploreModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: ExploreRole | null;
  canAccess: boolean;
}

interface RoleInfo {
  icon: typeof FileText;
  titleKey: string;
  purposeKey: string;
  capabilities: string[];
  capabilitiesKeys: string[];
}

const ROLE_INFO: Record<ExploreRole, RoleInfo> = {
  Researcher: {
    icon: FileText,
    titleKey: 'landing.workspace.role.researcher.title',
    purposeKey: 'landing.workspace.role.researcher.purpose',
    capabilitiesKeys: [
      'landing.workspace.role.researcher.cap1',
      'landing.workspace.role.researcher.cap2',
      'landing.workspace.role.researcher.cap3',
      'landing.workspace.role.researcher.cap4',
    ],
    capabilities: [
      'Submit manuscripts with academic metadata for editorial review',
      'Track submission status through screening, review, and decision stages',
      'Receive structured feedback and revision requests from reviewers',
      'Discover and read approved public research in the ARS catalog',
    ],
  },
  Reviewer: {
    icon: UserCheck,
    titleKey: 'landing.workspace.role.reviewer.title',
    purposeKey: 'landing.workspace.role.reviewer.purpose',
    capabilitiesKeys: [
      'landing.workspace.role.reviewer.cap1',
      'landing.workspace.role.reviewer.cap2',
      'landing.workspace.role.reviewer.cap3',
    ],
    capabilities: [
      'Accept or decline assigned manuscript review invitations',
      'Provide structured evaluation with scores and written feedback',
      'Recommend publication decisions while editorial authority remains with Admin',
    ],
  },
  Lecturer: {
    icon: GraduationCap,
    titleKey: 'landing.workspace.role.lecturer.title',
    purposeKey: 'landing.workspace.role.lecturer.purpose',
    capabilitiesKeys: [
      'landing.workspace.role.lecturer.cap1',
      'landing.workspace.role.lecturer.cap2',
      'landing.workspace.role.lecturer.cap3',
      'landing.workspace.role.lecturer.cap4',
    ],
    capabilities: [
      'Create and manage research groups with assigned student members',
      'Define research topics and track group milestone progress',
      'Share learning materials and resources with assigned groups',
      'Organize academic seminars with Google Meet integration',
    ],
  },
  'Graduate Student': {
    icon: Users,
    titleKey: 'landing.workspace.role.student.title',
    purposeKey: 'landing.workspace.role.student.purpose',
    capabilitiesKeys: [
      'landing.workspace.role.student.cap1',
      'landing.workspace.role.student.cap2',
      'landing.workspace.role.student.cap3',
    ],
    capabilities: [
      'Join research groups supervised by an assigned lecturer',
      'Submit phase-based progress reports for supervisor review',
      'Access learning materials and track academic milestones',
    ],
  },
};

export const RoleExploreModal = ({
  isOpen,
  onClose,
  role,
  canAccess,
}: RoleExploreModalProps) => {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Normalize role to the canonical BusinessRole form
  const normalizedRole: BusinessRole | null = role;

  useEffect(() => {
    if (!isOpen || !role) return;

    // Store reference to the element that opened the dialog
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Focus management
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    // Keyboard handling
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        return;
      }

      // Trap focus within dialog
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])',
          ),
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (!first || !last) return;

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      // Return focus to opener
      openerRef.current?.focus();
    };
  }, [isOpen, role]);

  const handleClose = () => {
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen || !normalizedRole || !ROLE_INFO[normalizedRole]) {
    return null;
  }

  const info = ROLE_INFO[normalizedRole];
  const Icon = info.icon;
  const roleLabelKey = `role.${normalizedRole}` as const;
  const roleLabel = t(roleLabelKey, normalizedRole);

  return (
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-explore-title"
    >
      <div ref={dialogRef} className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerIconWrapper} data-role={normalizedRole === 'Graduate Student' ? 'student' : normalizedRole.toLowerCase()}>
            <Icon size={24} aria-hidden="true" />
          </div>
          <div className={styles.headerText}>
            <span className={styles.headerRole}>{roleLabel}</span>
            <h2 id="role-explore-title" className={styles.headerTitle}>
              {t(info.titleKey, getDefaultTitle(normalizedRole))}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className={styles.closeBtn}
            aria-label={t('common.close', 'Close')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Purpose */}
          <div className={styles.purposeSection}>
            <p className={styles.purposeText}>
              {t(info.purposeKey, info.purposeKey)}
            </p>
          </div>

          {/* Capabilities */}
          <div className={styles.capabilitiesSection}>
            <h3 className={styles.capabilitiesTitle}>
              {t('landing.workspace.capabilities', 'Key capabilities')}
            </h3>
            <ul className={styles.capabilitiesList}>
              {info.capabilitiesKeys.map((capKey, index) => (
                <li key={capKey} className={styles.capabilityItem}>
                  <CheckCircle2 size={16} className={styles.capabilityIcon} aria-hidden="true" />
                  <span>{t(capKey, info.capabilities[index] ?? capKey)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA Section */}
          <div className={styles.ctaSection}>
            {canAccess ? (
              <>
                <p className={styles.ctaMessage}>
                  {t('landing.workspace.youHaveAccess', 'You have access to this workspace.')}
                </p>
                <Link
                  to={ROUTES.HOME}
                  className={styles.openWorkspaceBtn}
                  onClick={handleClose}
                >
                  {t('landing.workspace.openWorkspace', 'Open workspace')}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </>
            ) : (
              <>
                <p className={styles.ctaMessage}>
                  {t('landing.workspace.signInToAccess', 'Sign in to access this workspace')}
                </p>
                <Link
                  to={ROUTES.LOGIN}
                  className={styles.signInBtn}
                  onClick={handleClose}
                >
                  <LogIn size={16} aria-hidden="true" />
                  {t('auth.signInButton', 'Sign in')}
                </Link>
                <p className={styles.registerPrompt}>
                  {t('landing.workspace.noAccount', "Don't have an account?")}
                  {' '}
                  <Link
                    to={ROUTES.REGISTER}
                    className={styles.registerLink}
                    onClick={handleClose}
                  >
                    {t('register.signUpCta', 'Create one')}
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className={styles.footer}>
          <span className={styles.footerHint}>
            {t('landing.workspace.footerHint', 'Press Escape to close')}
          </span>
        </div>
      </div>
    </div>
  );
};

function getDefaultTitle(role: BusinessRole): string {
  switch (role) {
    case 'Researcher':
      return 'What you can do as a Researcher';
    case 'Reviewer':
      return 'What you can do as a Reviewer';
    case 'Lecturer':
      return 'What you can do as a Lecturer';
    case 'Graduate Student':
      return 'What you can do as a Graduate Student';
    default:
      return 'Workspace overview';
  }
}

export default RoleExploreModal;
