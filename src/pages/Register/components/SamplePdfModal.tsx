import { useEffect, useState } from 'react';
import { Button } from '../../../components/Button';
import type { UserRole } from '../../../types/auth';
import styles from './SamplePdfModal.module.css';
import { X } from '../../../assets/icons/XIcon';

interface SamplePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: UserRole;
}

type RoleKey = UserRole;

const ROLES: RoleKey[] = [
  'Researcher',
  'Reviewer',
  'Lecturer',
  'Graduate Student',
  'Admin',
];

interface DocumentProfile {
  fullName: string;
  affiliation: string;
  orcidId: string;
  metrics: { value: string; label: string }[];
  records: { title: string; meta: string }[];
}

const PROFILES: Record<RoleKey, DocumentProfile> = {
  Researcher: {
    fullName: 'Dr. Nguyen Van A',
    affiliation: 'Vietnam National University, Ho Chi Minh City',
    orcidId: '0000-0002-1825-0097',
    metrics: [
      { value: '47', label: 'Publications' },
      { value: '1,283', label: 'Citations' },
      { value: '12', label: 'h-index' },
    ],
    records: [
      {
        title: 'Deep Learning for Vietnamese Sign Language Recognition',
        meta: 'IEEE Transactions on Pattern Analysis - 2024 - DOI: 10.1109/TPAMI.2024.123456',
      },
      {
        title: 'A Survey on Transformer-Based NLP in Low-Resource Languages',
        meta: 'ACL Findings - 2023 - DOI: 10.18653/v1/2023.findings-acl.456',
      },
      {
        title:
          'Federated Learning Framework for Healthcare Data Privacy Preservation',
        meta: 'Nature Scientific Reports - 2023 - DOI: 10.1038/s41598-023-12345',
      },
    ],
  },
  Reviewer: {
    fullName: 'Dr. Tran Thi B',
    affiliation: 'Hanoi University of Science and Technology',
    orcidId: '0000-0001-8765-4321',
    metrics: [
      { value: '128', label: 'Reviews' },
      { value: '24', label: 'Journals' },
      { value: '4.8', label: 'Rating' },
    ],
    records: [
      {
        title: 'Peer Reviewer - Journal of Machine Learning Research',
        meta: '2022 - Present - 18 papers reviewed',
      },
      {
        title: 'Reviewer Board - IEEE Access',
        meta: '2021 - Present - 32 papers reviewed',
      },
      {
        title: 'Program Committee - NeurIPS 2023',
        meta: '2023 - 12 papers reviewed',
      },
    ],
  },
  Lecturer: {
    fullName: 'Dr. Le Van C',
    affiliation: 'University of Technology, Ho Chi Minh City',
    orcidId: '0000-0003-2468-1357',
    metrics: [
      { value: '8', label: 'Years Teaching' },
      { value: '12', label: 'Courses' },
      { value: '350+', label: 'Students' },
    ],
    records: [
      {
        title: 'Course Instructor - CS401: Artificial Intelligence',
        meta: 'Undergraduate Program - Fall 2024 - 85 students enrolled',
      },
      {
        title: 'Course Instructor - CS502: Advanced Machine Learning',
        meta: 'Graduate Program - Spring 2024 - 42 students enrolled',
      },
      {
        title: 'Curriculum Developer - Bachelor of Data Science Program',
        meta: '2023 - NEW PROGRAM launched Fall 2023',
      },
    ],
  },
  'Graduate Student': {
    fullName: 'Pham Thi D',
    affiliation: 'VNU-HCM University of Science',
    orcidId: '0000-0004-3691-2580',
    metrics: [
      { value: '3', label: 'Publications' },
      { value: '21', label: 'Citations' },
      { value: 'M.Sc.', label: 'Program' },
    ],
    records: [
      {
        title:
          'Master Thesis: "Graph Neural Networks for Molecular Property Prediction"',
        meta: 'Defended June 2024 - Advisor: Prof. Hoang Van E',
      },
      {
        title:
          'Comparing Self-Supervised Learning Approaches for Medical Imaging',
        meta: 'Workshop at ICCV 2024 - DOI: 10.1109/ICCVW.2024.0012',
      },
      {
        title: 'Research Internship at VinAI Research',
        meta: 'Summer 2023 - Computer Vision Lab',
      },
    ],
  },
  Admin: {
    fullName: 'System Administrator',
    affiliation: 'ARS Platform Operations',
    orcidId: '—',
    metrics: [
      { value: 'N/A', label: 'Publications' },
      { value: 'N/A', label: 'Reviews' },
      { value: 'N/A', label: 'Program' },
    ],
    records: [
      { title: 'Admin accounts are provisioned by the database.', meta: 'No sample document applies.' },
    ],
  },
};

export const SamplePdfModal = ({
  isOpen,
  onClose,
  initialRole = 'Researcher',
}: SamplePdfModalProps) => {
  const [activeRole, setActiveRole] = useState<RoleKey>(initialRole);

  useEffect(() => {
    if (isOpen) {
      setActiveRole(initialRole);
    }
  }, [isOpen, initialRole]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sample-pdf-title"
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 id="sample-pdf-title" className={styles.title}>
            Sample PDF Verification Document
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.tabs} role="tablist">
          {ROLES.map((role) => (
            <button
              key={role}
              type="button"
              role="tab"
              aria-selected={activeRole === role}
              className={`${styles.tab} ${activeRole === role ? styles['tab--active'] : ''}`}
              onClick={() => setActiveRole(role)}
            >
              {role}
            </button>
          ))}
        </div>

        <div className={styles.content}>
          <div className={styles.documentWrapper}>
            <div className={styles.watermark} aria-hidden="true">
              <span className={styles.watermarkText}>
                SAMPLE VERIFICATION DOCUMENT
              </span>
            </div>

            <div className={styles.docHeader}>
              <h3 className={styles.docTitle}>Academic Profile Summary</h3>
              <span className={styles.docBadge}>{activeRole}</span>
            </div>

            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Profile</h4>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Full Name</span>
                <span className={styles.fieldValue}>{profile.fullName}</span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Affiliation</span>
                <span className={styles.fieldValue}>{profile.affiliation}</span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>ORCID iD</span>
                <span className={styles.fieldValue}>{profile.orcidId}</span>
              </div>
            </div>

            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Academic Metrics</h4>
              <div className={styles.metricsGrid}>
                {profile.metrics.map((m) => (
                  <div key={m.label} className={styles.metricCard}>
                    <p className={styles.metricValue}>{m.value}</p>
                    <p className={styles.metricLabel}>{m.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>
                {activeRole === 'Reviewer'
                  ? 'Review Service Record'
                  : activeRole === 'Lecturer'
                  ? 'Teaching & Curriculum Record'
                  : activeRole === 'Graduate Student'
                  ? 'Academic & Research Record'
                  : 'Publication Record'}
              </h4>
              <ul className={styles.recordList}>
                {profile.records.map((r, idx) => (
                  <li key={idx} className={styles.recordItem}>
                    {r.title}
                    <div className={styles.recordMeta}>{r.meta}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <Button
            variant="primary"
            size="md"
            onClick={onClose}
            className={styles.footerBtn}
          >
            Got It, Back to Registration
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SamplePdfModal;
