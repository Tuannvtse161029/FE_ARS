import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/Button';
import { X } from '../../../assets/icons/XIcon';
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
            {activeTab === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeBtn}
            onClick={closeDialog}
            aria-label="Close dialog"
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
            Privacy Policy
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'terms'}
            className={`${styles.tab} ${activeTab === 'terms' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('terms')}
          >
            Terms of Service
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'privacy' ? (
            <div>
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>1. Information We Collect</h3>
                <p className={styles.paragraph}>
                  When you register and use the Academic Research System (ARS), we collect the following types of information:
                </p>
                <ul className={styles.list}>
                  <li><strong>Account Identity:</strong> Full Name, Email Address, Contact Phone Number, and Password.</li>
                  <li><strong>Academic Credentials:</strong> Selected Platform Role (Researcher, Reviewer, Lecturer, Graduate Student), Affiliated University/Institution, and ORCID identifier.</li>
                  <li><strong>Verification Documents:</strong> Academic portfolio PDFs, student enrollment certificates, or proof of faculty appointment uploaded for identity verification.</li>
                </ul>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>2. How We Use Your Data</h3>
                <p className={styles.paragraph}>
                  Your data is strictly used for the following platform purposes:
                </p>
                <ul className={styles.list}>
                  <li>Verifying academic authenticity and approving requested business roles.</li>
                  <li>Facilitating blind peer review assignments based on verified scholarly expertise.</li>
                  <li>Sending critical notifications regarding paper reviews, milestone evaluations, and account updates.</li>
                  <li>Securing academic research assets and preventing fraudulent submissions.</li>
                </ul>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>3. Storage & Document Security</h3>
                <p className={styles.paragraph}>
                  All uploaded verification PDFs and sensitive manuscripts are stored in encrypted cloud storage (Firebase Cloud Storage & Azure Secure Blobs). Only verified Platform Administrators have restricted access to inspect verification proofs during account review.
                </p>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>4. User Rights & Data Protection</h3>
                <p className={styles.paragraph}>
                  You have the right to review, update, or request the deletion of your personal account data at any time through Account Settings or by contacting ARS Platform Administration.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>1. Academic Integrity & Ethics</h3>
                <p className={styles.paragraph}>
                  By creating an account on ARS, you agree to adhere to standard international scientific ethics:
                </p>
                <ul className={styles.list}>
                  <li>All submitted research, evaluation reports, and seminar materials must be original and free of plagiarism.</li>
                  <li>Falsification of academic affiliations, credentials, or ORCID identity is grounds for immediate account termination.</li>
                </ul>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>2. Platform Roles & Responsibilities</h3>
                <ul className={styles.list}>
                  <li><strong>Researcher:</strong> Responsible for accurate metadata, citation integrity, and ethical preprint distribution.</li>
                  <li><strong>Reviewer:</strong> Bound by strict confidentiality. Manuscript contents must not be shared, duplicated, or utilized prior to formal publication.</li>
                  <li><strong>Lecturer & Graduate Student:</strong> Obligated to maintain authentic milestone reports, supervision logs, and seminar materials.</li>
                </ul>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>3. Account Verification & Status</h3>
                <p className={styles.paragraph}>
                  Newly created accounts start in a <em>Pending</em> verification state. You will have guest access to community forums until an Administrator verifies your credentials and approves your designated role.
                </p>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>4. Termination & Policy Updates</h3>
                <p className={styles.paragraph}>
                  ARS reserves the right to suspend or terminate accounts that breach peer review confidentiality, post abusive content, or violate academic research standards.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <Button variant="outline" size="md" onClick={onClose}>
            Close
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
              I Understand & Agree
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PolicyModal;
