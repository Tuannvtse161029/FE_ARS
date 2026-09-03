import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/Button';
import { X } from '../../../assets/icons/XIcon';
import { useI18n } from '../../../i18n/I18nContext';
import styles from './PolicyModal.module.css';

export type PolicyTab = 'privacy' | 'terms';

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: PolicyTab;
  onAccept?: () => void;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'privacy',
  onAccept,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<PolicyTab>(initialTab);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  
  const closeDialog = (): void => {
    onClose();
    openerRef.current?.focus();
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        openerRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeDialog();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-dialog-title"
    >
      <div ref={dialogRef} className={styles.modal}>
        <div className={styles.header}>
          <h2 id="policy-dialog-title" className={styles.title}>
            {activeTab === 'privacy' ? t('legal.privacy', 'Privacy Policy') : t('legal.terms', 'Terms of Service')}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeBtn}
            onClick={closeDialog}
            aria-label={t('common.close', 'Close')}
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'privacy'}
            className={`${styles.tab} ${activeTab === 'privacy' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            {t('legal.privacy', 'Privacy Policy')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'terms'}
            className={`${styles.tab} ${activeTab === 'terms' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('terms')}
          >
            {t('legal.terms', 'Terms of Service')}
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'privacy' ? (
            <div>
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('register.policy.privacy1.title', '1. Information We Collect')}</h3>
                <p className={styles.paragraph}>
                  {t('register.policy.privacy1.desc', 'When you register and use the Academic Research Sharing (ARS), we collect the following types of information:')}
                </p>
                <ul className={styles.list}>
                  <li><strong>{t('register.policy.privacy1.l1.strong', 'Account Identity:')}</strong> {t('register.policy.privacy1.l1.text', 'Full Name, Email Address, Contact Phone Number, and Password.')}</li>
                  <li><strong>{t('register.policy.privacy1.l2.strong', 'Academic Credentials:')}</strong> {t('register.policy.privacy1.l2.text', 'Selected Platform Role (Researcher, Reviewer, Lecturer, Graduate Student), Affiliated University/Institution, and ORCID identifier.')}</li>
                  <li><strong>{t('register.policy.privacy1.l3.strong', 'Verification Documents:')}</strong> {t('register.policy.privacy1.l3.text', 'Academic portfolio PDFs, student enrollment certificates, or proof of faculty appointment uploaded for identity verification.')}</li>
                </ul>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('register.policy.privacy2.title', '2. How We Use Your Data')}</h3>
                <p className={styles.paragraph}>
                  {t('register.policy.privacy2.desc', 'Your data is strictly used for the following platform purposes:')}
                </p>
                <ul className={styles.list}>
                  <li>{t('register.policy.privacy2.l1', 'Verifying academic authenticity and approving requested business roles.')}</li>
                  <li>{t('register.policy.privacy2.l2', 'Facilitating blind peer review assignments based on verified scholarly expertise.')}</li>
                  <li>{t('register.policy.privacy2.l3', 'Sending critical notifications regarding paper reviews, milestone evaluations, and account updates.')}</li>
                  <li>{t('register.policy.privacy2.l4', 'Securing academic research assets and preventing fraudulent submissions.')}</li>
                </ul>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('register.policy.privacy3.title', '3. Storage & Document Security')}</h3>
                <p className={styles.paragraph}>
                  {t('register.policy.privacy3.desc', 'All uploaded verification PDFs and sensitive manuscripts are stored in encrypted cloud storage (Firebase Cloud Storage & Azure Secure Blobs). Only verified Platform Administrators have restricted access to inspect verification proofs during account review.')}
                </p>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('register.policy.privacy4.title', '4. User Rights & Data Protection')}</h3>
                <p className={styles.paragraph}>
                  {t('register.policy.privacy4.desc', 'You have the right to review, update, or request the deletion of your personal account data at any time through Account Settings or by contacting ARS Platform Administration.')}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('register.policy.terms1.title', '1. Academic Integrity & Ethics')}</h3>
                <p className={styles.paragraph}>
                  {t('register.policy.terms1.desc', 'By creating an account on ARS, you agree to adhere to standard international scientific ethics:')}
                </p>
                <ul className={styles.list}>
                  <li>{t('register.policy.terms1.l1', 'All submitted research, evaluation reports, and seminar materials must be original and free of plagiarism.')}</li>
                  <li>{t('register.policy.terms1.l2', 'Falsification of academic affiliations, credentials, or ORCID identity is grounds for immediate account termination.')}</li>
                </ul>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('register.policy.terms2.title', '2. Platform Roles & Responsibilities')}</h3>
                <ul className={styles.list}>
                  <li><strong>{t('register.policy.terms2.l1.strong', 'Researcher:')}</strong> {t('register.policy.terms2.l1.text', 'Responsible for accurate metadata, citation integrity, and ethical preprint distribution.')}</li>
                  <li><strong>{t('register.policy.terms2.l2.strong', 'Reviewer:')}</strong> {t('register.policy.terms2.l2.text', 'Bound by strict confidentiality. Manuscript contents must not be shared, duplicated, or utilized prior to formal publication.')}</li>
                  <li><strong>{t('register.policy.terms2.l3.strong', 'Lecturer & Graduate Student:')}</strong> {t('register.policy.terms2.l3.text', 'Obligated to maintain authentic milestone reports, supervision logs, and seminar materials.')}</li>
                </ul>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('register.policy.terms3.title', '3. Account Verification & Status')}</h3>
                <p className={styles.paragraph}>
                  {t('register.policy.terms3.desc', 'Newly created accounts start in a Pending verification state. You will have guest access to community forums until an Administrator verifies your credentials and approves your designated role.')}
                </p>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('register.policy.terms4.title', '4. Termination & Policy Updates')}</h3>
                <p className={styles.paragraph}>
                  {t('register.policy.terms4.desc', 'ARS reserves the right to suspend or terminate accounts that breach peer review confidentiality, post abusive content, or violate academic research standards.')}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <Button variant="outline" size="md" onClick={onClose}>
            {t('common.close', 'Close')}
          </Button>
          {onAccept && (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                onAccept();
                onClose();
              }}
            >
              {t('register.policy.agree', 'I Understand & Agree')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PolicyModal;
