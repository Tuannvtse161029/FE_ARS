import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import ARSLogo from '../../assets/images/ARS_Logo.png';
import { ROUTES } from '../../routes/paths';
import styles from './LegalPolicy.module.css';

export const LegalPolicy: React.FC = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>('privacy');

  useEffect(() => {
    if (location.pathname.includes('terms')) {
      setActiveTab('terms');
    } else {
      setActiveTab('privacy');
    }
  }, [location.pathname]);

  return (
    <div className={styles.page}>
      <header className={styles.navbar}>
        <Link to={ROUTES.HOME} className={styles.brand}>
          <img src={ARSLogo} alt="ARS Logo" className={styles.logo} />
          <span className={styles.brandName}>Academic Research System</span>
        </Link>
        <Link to={ROUTES.REGISTER} className={styles.backLink}>
          Back to Registration
        </Link>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>
              {activeTab === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
            </h1>
            <p className={styles.updated}>Last updated: August 2026</p>
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
                  <h2 className={styles.sectionTitle}>1. Information We Collect</h2>
                  <p className={styles.paragraph}>
                    When you register and use the Academic Research System (ARS), we collect the following types of personal and academic information:
                  </p>
                  <ul className={styles.list}>
                    <li><strong>Account Identity:</strong> Full Name, Email Address, Phone Number, and hashed credentials.</li>
                    <li><strong>Academic Credentials:</strong> Selected Role (Researcher, Reviewer, Lecturer, Graduate Student), Affiliated University/Institution, and ORCID iD.</li>
                    <li><strong>Verification Documents:</strong> Academic portfolio PDFs, student enrollment certificates, or proof of faculty appointment uploaded for role verification.</li>
                  </ul>
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>2. How We Use Your Data</h2>
                  <p className={styles.paragraph}>
                    Your personal information is used exclusively for platform operations:
                  </p>
                  <ul className={styles.list}>
                    <li>Verifying academic authenticity and approving requested business roles.</li>
                    <li>Facilitating blind peer review assignments based on verified scholarly expertise.</li>
                    <li>Sending critical notifications regarding paper reviews, milestone evaluations, and account updates.</li>
                    <li>Securing academic research assets and preventing fraudulent submissions.</li>
                  </ul>
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>3. Storage & Document Security</h2>
                  <p className={styles.paragraph}>
                    All uploaded verification PDFs and sensitive manuscripts are stored in encrypted cloud storage (Firebase Cloud Storage & Azure Secure Blobs). Only verified Platform Administrators have restricted access to inspect verification proofs during account review.
                  </p>
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>4. User Rights & Data Protection</h2>
                  <p className={styles.paragraph}>
                    You have the right to review, update, or request the deletion of your personal account data at any time through Account Settings or by contacting ARS Platform Administration.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>1. Academic Integrity & Ethics</h2>
                  <p className={styles.paragraph}>
                    By creating an account on ARS, you agree to adhere to standard international scientific ethics:
                  </p>
                  <ul className={styles.list}>
                    <li>All submitted research, evaluation reports, and seminar materials must be original and free of plagiarism.</li>
                    <li>Falsification of academic affiliations, credentials, or ORCID identity is grounds for immediate account termination.</li>
                  </ul>
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>2. Platform Roles & Responsibilities</h2>
                  <ul className={styles.list}>
                    <li><strong>Researcher:</strong> Responsible for accurate metadata, citation integrity, and ethical preprint distribution.</li>
                    <li><strong>Reviewer:</strong> Bound by strict confidentiality. Manuscript contents must not be shared, duplicated, or utilized prior to formal publication.</li>
                    <li><strong>Lecturer & Graduate Student:</strong> Obligated to maintain authentic milestone reports, supervision logs, and seminar materials.</li>
                  </ul>
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>3. Account Verification & Status</h2>
                  <p className={styles.paragraph}>
                    Newly created accounts start in a <em>Pending</em> verification state. You will have guest access to community forums until an Administrator verifies your credentials and approves your designated role.
                  </p>
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>4. Termination & Policy Updates</h2>
                  <p className={styles.paragraph}>
                    ARS reserves the right to suspend or terminate accounts that breach peer review confidentiality, post abusive content, or violate academic research standards.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LegalPolicy;
