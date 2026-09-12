import { useState, useEffect } from 'react';

import { useLocation, Link } from 'react-router-dom';

import ARSLogo from '../../assets/images/ARS_Logo.png';

import { ROUTES } from '../../routes/paths';

import { useT } from '../../i18n/I18nContext';

import styles from './LegalPolicy.module.css';

export const LegalPolicy = () => {
  const location = useLocation();
  const t = useT();
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
          <img src={ARSLogo} alt={t('legal.logoAlt', 'ARS Logo')} className={styles.logo} />
          <span className={styles.brandName}>{t('legal.brand', 'Academic Research Sharing')}</span>
        </Link>
        <Link to={ROUTES.REGISTER} className={styles.backLink}>
          {t('legal.backToRegister', 'Back to Registration')}
        </Link>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>
              {activeTab === 'privacy' ? t('legal.privacy.title', 'Privacy Policy') : t('legal.terms.title', 'Terms of Service')}
            </h1>
            <p className={styles.updated}>{t('legal.lastUpdated', 'Last updated: August 2026')}</p>
          </div>

          <div className={styles.tabs} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'privacy'}
              className={`${styles.tab} ${activeTab === 'privacy' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('privacy')}
            >
              {t('legal.tab.privacy', 'Privacy Policy')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'terms'}
              className={`${styles.tab} ${activeTab === 'terms' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('terms')}
            >
              {t('legal.tab.terms', 'Terms of Service')}
            </button>
          </div>

          <div
            key={activeTab}
            className={styles.content}
            role="tabpanel"
            aria-label={activeTab === 'privacy' ? t('legal.privacy.title', 'Privacy Policy') : t('legal.terms.title', 'Terms of Service')}
          >
            {activeTab === 'privacy' ? (
              <div>
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>{t('legal.privacy.section1Title', '1. Information We Collect')}</h2>
                  <p className={styles.paragraph}>
                    {t('legal.privacy.section1Body', 'When you register and use the Academic Research Sharing (ARS), we collect the following types of personal and academic information:')}
                  </p>
                  <ul className={styles.list}>
                    <li>{t('legal.privacy.section1Item1', 'Account Identity: Full Name, Email Address, Phone Number, and hashed credentials.')}</li>
                    <li>{t('legal.privacy.section1Item2', 'Academic Credentials: Selected Role (Researcher, Reviewer, Lecturer, Graduate Student), Affiliated University/Institution, and ORCID iD.')}</li>
                    <li>{t('legal.privacy.section1Item3', 'Verification Documents: Academic portfolio PDFs, student enrollment certificates, or proof of faculty appointment uploaded for role verification.')}</li>
                  </ul>
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>{t('legal.privacy.section2Title', '2. How We Use Your Data')}</h2>
                  <p className={styles.paragraph}>
                    {t('legal.privacy.section2Body', 'Your personal information is used exclusively for platform operations:')}
                  </p>
                  <ul className={styles.list}>
                    <li>{t('legal.privacy.section2Item1', 'Verifying academic authenticity and approving requested business roles.')}</li>
                    <li>{t('legal.privacy.section2Item2', 'Facilitating blind peer review assignments based on verified scholarly expertise.')}</li>
                    <li>{t('legal.privacy.section2Item3', 'Sending critical notifications regarding paper reviews, milestone evaluations, and account updates.')}</li>
                    <li>{t('legal.privacy.section2Item4', 'Securing academic research assets and preventing fraudulent submissions.')}</li>
                  </ul>
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>{t('legal.privacy.section3Title', '3. Storage & Document Security')}</h2>
                  <p className={styles.paragraph}>
                    {t('legal.privacy.section3Body', 'All uploaded verification PDFs and sensitive manuscripts are stored in encrypted cloud storage (Firebase Cloud Storage & Azure Secure Blobs). Only verified Platform Administrators have restricted access to inspect verification proofs during account review.')}
                  </p>
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>{t('legal.privacy.section4Title', '4. User Rights & Data Protection')}</h2>
                  <p className={styles.paragraph}>
                    {t('legal.privacy.section4Body', 'You have the right to review, update, or request the deletion of your personal account data at any time through Account Settings or by contacting ARS Platform Administration.')}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>{t('legal.terms.section1Title', '1. Academic Integrity & Ethics')}</h2>
                  <p className={styles.paragraph}>
                    {t('legal.terms.section1Body', 'By creating an account on ARS, you agree to adhere to standard international scientific ethics:')}
                  </p>
                  <ul className={styles.list}>
                    <li>{t('legal.terms.section1Item1', 'All submitted research, evaluation reports, and seminar materials must be original and free of plagiarism.')}</li>
                    <li>{t('legal.terms.section1Item2', 'Falsification of academic affiliations, credentials, or ORCID identity is grounds for immediate account termination.')}</li>
                  </ul>
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>{t('legal.terms.section2Title', '2. Platform Roles & Responsibilities')}</h2>
                  <ul className={styles.list}>
                    <li>{t('legal.terms.section2Item1', 'Researcher: Responsible for accurate metadata, citation integrity, and ethical preprint distribution.')}</li>
                    <li>{t('legal.terms.section2Item2', 'Reviewer: Bound by strict confidentiality. Manuscript contents must not be shared, duplicated, or utilized prior to formal publication.')}</li>
                    <li>{t('legal.terms.section2Item3', 'Lecturer & Graduate Student: Obligated to maintain authentic milestone reports, supervision logs, and seminar materials.')}</li>
                  </ul>
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>{t('legal.terms.section3Title', '3. Account Verification & Status')}</h2>
                  <p className={styles.paragraph}>
                    {t('legal.terms.section3Body', 'Newly created accounts start in a Pending verification state. You will have guest access to community forums until an Administrator verifies your credentials and approves your designated role.')}
                  </p>
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>{t('legal.terms.section4Title', '4. Termination & Policy Updates')}</h2>
                  <p className={styles.paragraph}>
                    {t('legal.terms.section4Body', 'ARS reserves the right to suspend or terminate accounts that breach peer review confidentiality, post abusive content, or violate academic research standards.')}
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
