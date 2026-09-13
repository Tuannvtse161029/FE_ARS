import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/Button';
import { useI18n } from '../../../i18n/I18nContext';
import styles from './SamplePdfModal.module.css';
import { X } from '../../../assets/icons/XIcon';
import FptLogo from '../../../assets/logo/Logo_FPT_Education.png';
import { REGISTRATION_ROLES, type RequestableRole } from '../../../utils/registrationRoles';

interface SamplePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: RequestableRole;
}

interface EvidenceRow {
  label: string;
  value: string;
}

interface DocumentProfile {
  fullName: string;
  affiliation: string;
  evidence: EvidenceRow[];
  records: { title: string; meta: string }[];
  isInstitutionLetter?: boolean;
}

const PROFILES: Record<RequestableRole, DocumentProfile> = {
  Researcher: {
    fullName: 'Dr. Nguyen Van A',
    affiliation: 'Vietnam National University, Ho Chi Minh City',
    evidence: [
      { label: 'Major / research field', value: 'Computer Vision and Machine Learning' },
      { label: 'ORCID / scholarly profile', value: 'https://orcid.org/0000-0002-1825-0097' },
      { label: 'Google Scholar profile', value: 'https://scholar.google.com/citations?user=Example' },
      { label: 'Published research', value: 'https://doi.org/10.1109/TPAMI.2024.123456' },
    ],
    records: [
      { title: 'Deep Learning for Vietnamese Sign Language Recognition', meta: 'IEEE TPAMI · 2024 · DOI link above' },
      { title: 'Transformer-Based NLP in Low-Resource Languages', meta: 'ACL Findings · 2023 · Public publication link' },
    ],
  },
  Reviewer: {
    fullName: 'Dr. Tran Thi B',
    affiliation: 'Hanoi University of Science and Technology',
    evidence: [
      { label: 'Major / subject expertise', value: 'Natural Language Processing and Information Retrieval' },
      { label: 'ORCID / scholarly profile', value: 'https://orcid.org/0000-0001-8765-4321' },
      { label: 'Google Scholar profile', value: 'https://scholar.google.com/citations?user=Example' },
      { label: 'Published research', value: 'https://doi.org/10.18653/v1/2023.findings-acl.456' },
    ],
    records: [
      { title: 'Peer-reviewed publication portfolio', meta: 'Public DOI or publisher links for administrator verification' },
      { title: 'Peer-review service evidence', meta: 'Journal or conference reviewer profile link, if available' },
    ],
  },
  Lecturer: {
    fullName: 'Dr. Le Van C',
    affiliation: 'FPT University · School of Business and Technology',
    evidence: [
      { label: 'Teaching status', value: 'Currently teaching at FPT University' },
      { label: 'Department / teaching period', value: 'Information Technology · 2024–2026' },
      { label: 'Courses / programme', value: 'Artificial Intelligence · Undergraduate programme' },
      { label: 'Authorized signatory', value: 'School or institution representative · Signature and stamp' },
    ],
    records: [
      { title: 'Institutional confirmation', meta: 'Official letterhead, issue date, signature, and institutional stamp' },
      { title: 'Employment or teaching confirmation', meta: 'Must identify the applicant and current teaching relationship' },
    ],
    isInstitutionLetter: true,
  },
  'Graduate Student': {
    fullName: 'Pham Thi D',
    affiliation: 'FPT University · Graduate Programme',
    evidence: [
      { label: 'Enrollment status', value: 'Currently enrolled at FPT University' },
      { label: 'Programme / department', value: 'Master of Information Technology · Computing' },
      { label: 'Study period', value: 'Academic year 2024–2026' },
      { label: 'Authorized signatory', value: 'Registrar or institution representative · Signature and stamp' },
    ],
    records: [
      { title: 'Institutional enrollment confirmation', meta: 'Official FPT letterhead, issue date, signature, and institutional stamp' },
      { title: 'Current student status', meta: 'Must identify the applicant, programme, and active study period' },
    ],
    isInstitutionLetter: true,
  },
};

export const SamplePdfModal = ({ isOpen, onClose, initialRole = 'Researcher' }: SamplePdfModalProps) => {
  const { t } = useI18n();
  const [activeRole, setActiveRole] = useState<RequestableRole>(initialRole);

  useEffect(() => {
    if (isOpen) setActiveRole(initialRole);
  }, [isOpen, initialRole]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const profile = PROFILES[activeRole];

  return createPortal(
    <div className={styles.overlay} onClick={(event) => event.target === event.currentTarget && onClose()} role="dialog" aria-modal="true" aria-labelledby="sample-pdf-title">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 id="sample-pdf-title" className={styles.title}>{t('register.samplePdf.title', 'Sample PDF Verification Document')}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('common.close', 'Close')}><X size={20} /></button>
        </div>
        <div className={styles.tabs} role="tablist">
          {REGISTRATION_ROLES.map((role) => (
            <button key={role} type="button" role="tab" aria-selected={activeRole === role} className={`${styles.tab} ${activeRole === role ? styles['tab--active'] : ''}`} onClick={() => setActiveRole(role)}>
              {t(`role.${role}`, role)}
            </button>
          ))}
        </div>
        <div className={styles.content}>
          <div className={`${styles.documentWrapper} ${profile.isInstitutionLetter ? styles.institutionLetter : ''}`}>
            <div className={styles.watermark} aria-hidden="true"><span className={styles.watermarkText}>{t('register.samplePdf.watermark', 'SAMPLE VERIFICATION DOCUMENT')}</span></div>
            {profile.isInstitutionLetter ? <img className={styles.fptLogo} src={FptLogo} alt="FPT Education" /> : null}
            <div className={styles.docHeader}>
              <div>
                <h3 className={styles.docTitle}>{profile.isInstitutionLetter ? t('register.samplePdf.confirmationTitle', 'Institutional Confirmation Letter') : t('register.samplePdf.summaryTitle', 'Academic Profile Summary')}</h3>
                <p className={styles.docSubtitle}>{profile.affiliation}</p>
              </div>
              <span className={styles.docBadge}>{t(`role.${activeRole}`, activeRole)}</span>
            </div>
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>{t('register.samplePdf.profile', 'Applicant details')}</h4>
              <div className={styles.fieldRow}><span className={styles.fieldLabel}>{t('register.samplePdf.fullName', 'Full Name')}</span><span className={styles.fieldValue}>{profile.fullName}</span></div>
              {profile.evidence.map((row) => <div className={styles.fieldRow} key={row.label}><span className={styles.fieldLabel}>{row.label}</span><span className={styles.fieldValue}>{row.value}</span></div>)}
            </div>
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>{profile.isInstitutionLetter ? t('register.samplePdf.confirmationRequirements', 'Confirmation requirements') : t('register.samplePdf.verifiableEvidence', 'Verifiable evidence')}</h4>
              <ul className={styles.recordList}>{profile.records.map((record) => <li key={record.title} className={styles.recordItem}>{record.title}<div className={styles.recordMeta}>{record.meta}</div></li>)}</ul>
            </div>
            {profile.isInstitutionLetter ? <div className={styles.signatureRow}><span>Authorized signature</span><span>Official stamp</span><span>Issue date</span></div> : null}
          </div>
        </div>
        <div className={styles.footer}><Button variant="primary" size="md" onClick={onClose} className={styles.footerBtn}>{t('register.samplePdf.backBtn', 'Got It, Back to Registration')}</Button></div>
      </div>
    </div>,
    document.body,
  );
};

export default SamplePdfModal;
