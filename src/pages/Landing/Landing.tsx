import { Link } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  GraduationCap,
  ShieldCheck,
  UserCheck,
  Users,
  Send,
  ClipboardCheck,
  MessageSquare,
  Scale,
  Globe,
} from 'lucide-react';
import { ROUTES } from '../../routes/paths';
import { useT } from '../../i18n/I18nContext';
import { LanguageToggle } from '../../components/i18n/LanguageToggle';
import { smoothScrollTo } from '../../utils/smoothScroll';
import arsLogo from '../../assets/images/ARS_Logo.png';
import styles from './Landing.module.css';

export const Landing = () => {
  const t = useT();
  const workflowListRef = useRef<HTMLOListElement>(null);
  const flowSectionRef = useRef<HTMLElement>(null);
  const [workflowListVisible, setWorkflowListVisible] = useState(false);
  const [flowPathsDrawn, setFlowPathsDrawn] = useState<string[]>([]);

  // ── Scroll-driven observers ─────────────────────────────────
  // Both observers fire once and disconnect — these are one-shot
  // entrance animations, not continuous scroll handlers.
  useEffect(() => {
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    // Trigger workflow step cascade when the list enters the viewport.
    const workflowObs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setWorkflowListVisible(true);
          workflowObs.disconnect();
        }
      },
      { threshold: 0.05 },
    );
    if (workflowListRef.current) workflowObs.observe(workflowListRef.current);

    // Trigger SVG connector drawing when the publication flow section
    // enters the viewport. Each connector animates in sequence.
    const flowObs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !prefersReduced) {
          flowObs.disconnect();
          // Draw connectors one at a time — index 0..3 for 4 connectors.
          [0, 1, 2, 3].forEach((i) => {
            setTimeout(() => {
              setFlowPathsDrawn((prev) =>
                prev.includes(`p${i}`) ? prev : [...prev, `p${i}`],
              );
            }, 80 + i * 200);
          });
        } else if (entry.isIntersecting) {
          // Instant reveal when reduced-motion is preferred.
          flowObs.disconnect();
          setFlowPathsDrawn(['p0', 'p1', 'p2', 'p3']);
        }
      },
      { threshold: 0.2 },
    );
    if (flowSectionRef.current) flowObs.observe(flowSectionRef.current);

    return () => {
      workflowObs.disconnect();
      flowObs.disconnect();
    };
  }, []);

  // Scroll the in-page anchor target into view with an eased animation,
  // matching the sticky header height. Sync the URL hash without triggering
  // a second browser-side jump.
  const handleAnchorClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
      const target = document.getElementById(targetId);
      if (!target) return;
      event.preventDefault();
      smoothScrollTo(target);
      window.history.replaceState(null, '', `#${targetId}`);
    },
    [],
  );

  // Vietnamese is the default locale; every string below passes an English
  // fallback so the page still reads correctly when the user switches to
  // English. The English fallback doubles as a documentation hint.
  const workflow = [
    {
      title: t('landing.workflowStep1Title', 'Submit'),
      description: t(
        'landing.workflowStep1Body',
        'Researchers provide a manuscript and the academic metadata needed for editorial assessment.',
      ),
    },
    {
      title: t('landing.workflowStep2Title', 'Screen'),
      description: t(
        'landing.workflowStep2Body',
        'Administrators assess submission readiness and manage the editorial process.',
      ),
    },
    {
      title: t('landing.workflowStep3Title', 'Review'),
      description: t(
        'landing.workflowStep3Body',
        'Eligible reviewers return recommendations within their authorized workspace.',
      ),
    },
    {
      title: t('landing.workflowStep4Title', 'Decide'),
      description: t(
        'landing.workflowStep4Body',
        'Administrators make the final publication decision. Reviewer recommendations are not publication decisions.',
      ),
    },
    {
      title: t('landing.workflowStep5Title', 'Discover'),
      description: t(
        'landing.workflowStep5Body',
        'Only approved public research becomes available through the research catalog.',
      ),
    },
  ];

  const workspaces = [
    {
      icon: FileText,
      title: t('landing.workspaceResearcherTitle', 'Researcher workspace'),
      description: t(
        'landing.workspaceResearcherBody',
        'Prepare submissions, follow editorial status, revise work, and discover published research.',
      ),
    },
    {
      icon: UserCheck,
      title: t('landing.workspaceReviewerTitle', 'Reviewer workspace'),
      description: t(
        'landing.workspaceReviewerBody',
        'Manage eligible assignments and provide evaluations within the review process.',
      ),
    },
    {
      icon: GraduationCap,
      title: t('landing.workspaceLecturerTitle', 'Lecturer workspace'),
      description: t(
        'landing.workspaceLecturerBody',
        'Coordinate research groups, seminars, learning materials, and academic milestones.',
      ),
    },
    {
      icon: Users,
      title: t('landing.workspaceStudentTitle', 'Graduate student workspace'),
      description: t(
        'landing.workspaceStudentBody',
        'Participate in research groups, reports, learning activity, and academic collaboration.',
      ),
    },
  ];

  const boundaries = [
    t(
      'landing.boundary1',
      'Only approved public research is discoverable in the catalog.',
    ),
    t(
      'landing.boundary2',
      'Reviewer recommendations inform, but do not replace, the final editorial decision.',
    ),
    t(
      'landing.boundary3',
      'Private review comments, scores, and administrative notes remain in authorized workspaces.',
    ),
  ];

  const faqs = [
    {
      question: t('landing.faq1Q', 'What is ARS?'),
      answer: t(
        'landing.faq1A',
        'Academic Research System is a role-based academic platform for research discovery, paper submission and review, seminars, collaboration, and academic workspaces.',
      ),
    },
    {
      question: t('landing.faq2Q', 'Who decides whether research is published?'),
      answer: t(
        'landing.faq2A',
        'Administrators make the final editorial publication decision. Reviewers provide recommendations as part of that process.',
      ),
    },
    {
      question: t('landing.faq3Q', 'What becomes public?'),
      answer: t(
        'landing.faq3A',
        'Only research that is both approved and public belongs in the research catalog. Internal review content is not public.',
      ),
    },
  ];

  const publicationFlowSteps = [
    {
      icon: Send,
      role: t('landing.flowResearcher', 'Researcher'),
      action: t(
        'landing.flowResearcherAction',
        'Uploads a paper to ARS for consideration.',
      ),
      note: t('landing.flowResearcherNote', 'cannot choose the reviewer'),
    },
    {
      icon: ClipboardCheck,
      role: t('landing.flowAdmin', 'Admin'),
      action: t(
        'landing.flowAdminScreenAction',
        'Screens the submission and assigns a suitable reviewer.',
      ),
      note: null,
    },
    {
      icon: MessageSquare,
      role: t('landing.flowReviewer', 'Reviewer'),
      action: t(
        'landing.flowReviewerAction',
        'Evaluates the paper and returns a recommendation.',
      ),
      note: t('landing.flowReviewerNote', 'recommends, does not publish'),
    },
    {
      icon: Scale,
      role: t('landing.flowAdmin', 'Admin'),
      action: t(
        'landing.flowAdminDecideAction',
        'Makes the final publication decision.',
      ),
      note: null,
    },
    {
      icon: Globe,
      role: t('landing.flowCatalog', 'Catalog'),
      action: t(
        'landing.flowCatalogAction',
        'Only Admin-approved papers are published to the ARS public catalog.',
      ),
      note: null,
    },
  ];

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main-content">
        {t('landing.skipToContent', 'Skip to main content')}
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link
            className={styles.brand}
            to={ROUTES.LANDING}
            aria-label={t(
              'landing.brandAria',
              'Academic Research System home',
            )}
          >
            <img className={styles.brandLogo} src={arsLogo} alt="ARS" />
            <span>{t('landing.brandName', 'Academic Research System')}</span>
          </Link>
          <nav
            className={styles.navigation}
            aria-label={t('landing.navAria', 'Landing page navigation')}
          >
            <a
              href="#workflow"
              onClick={(e) => handleAnchorClick(e, 'workflow')}
            >
              {t('landing.navWorkflow', 'Editorial workflow')}
            </a>
            <a
              href="#workspaces"
              onClick={(e) => handleAnchorClick(e, 'workspaces')}
            >
              {t('landing.navWorkspaces', 'Workspaces')}
            </a>
            <a
              href="#boundaries"
              onClick={(e) => handleAnchorClick(e, 'boundaries')}
            >
              {t('landing.navBoundaries', 'Public access')}
            </a>
          </nav>
          <div className={styles.headerActions}>
            <LanguageToggle />
            <Link className={styles.loginButton} to={ROUTES.LOGIN}>
              {t('auth.signInButton', 'Log in')}{' '}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroInner}>
            <div
              className={styles.heroCopy}
              style={{ '--hero-stagger': '0ms' } as React.CSSProperties}
            >
              <p className={styles.issueLine}>
                {t('landing.heroBadge', 'Public entry / Academic research')}
              </p>
              <h1 id="landing-title">
                {t(
                  'landing.heroTitle',
                  'A responsible path for research to be read, reviewed, and shared.',
                )}
              </h1>
              <p className={styles.heroLead}>
                {t(
                  'landing.heroSubtitle',
                  'ARS is a role-based academic platform for research discovery, editorial workflows, seminars, and collaboration. It keeps each responsibility clear from submission to public discovery.',
                )}
              </p>
              <div className={styles.heroActions}>
                <Link className={styles.primaryButton} to={ROUTES.LOGIN}>
                  {t('landing.ctaPrimary', 'Log in to ARS')}{' '}
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <a
                  className={styles.textLink}
                  href="#workflow"
                  onClick={(e) => handleAnchorClick(e, 'workflow')}
                >
                  {t('landing.ctaSecondary', 'Read the workflow')}{' '}
                  <ArrowRight size={16} aria-hidden="true" />
                </a>
              </div>
            </div>

            <aside
              className={styles.dossier}
              aria-labelledby="dossier-title"
              style={{ '--hero-stagger': '80ms' } as React.CSSProperties}
            >
              <div className={styles.dossierHeader}>
                <span>{t('landing.dossierTitle', 'ARS editorial dossier')}</span>
                <ShieldCheck size={20} aria-hidden="true" />
              </div>
              <h2 id="dossier-title">
                {t(
                  'landing.dossierHeading',
                  'Publication is a governed process.',
                )}
              </h2>
              <p>
                {t(
                  'landing.dossierBody',
                  'ARS separates editorial responsibility from scholarly recommendation, so the path to public discovery remains accountable.',
                )}
              </p>
              <dl className={styles.dossierList}>
                <div>
                  <dt>{t('landing.dossierResearcher', 'Researcher')}</dt>
                  <dd>
                    {t(
                      'landing.dossierResearcherBody',
                      'Submits and follows the work.',
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t('landing.dossierReviewer', 'Reviewer')}</dt>
                  <dd>
                    {t(
                      'landing.dossierReviewerBody',
                      'Evaluates and recommends.',
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t('landing.dossierAdmin', 'Administrator')}</dt>
                  <dd>
                    {t(
                      'landing.dossierAdminBody',
                      'Controls the final decision.',
                    )}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        <section className={styles.statement} aria-label={t('landing.statementAria', 'ARS purpose')}>
          <div>
            <p className={styles.issueLine}>{t('landing.statementKicker', 'The platform')}</p>
            <h2>
              {t(
                'landing.statementTitle',
                'Research deserves more than an upload destination.',
              )}
            </h2>
          </div>
          <p>
            {t(
              'landing.statementBody',
              'ARS brings research discovery, paper submission and review, seminars, collaboration, and role-specific workspaces into one academic environment. Its public catalog is reserved for research that has completed the editorial process.',
            )}
          </p>
        </section>

        <section
          className={styles.workflowSection}
          id="workflow"
          aria-labelledby="workflow-title"
        >
          <div className={styles.sectionHeading}>
            <p className={styles.issueLine}>
              {t('landing.workflowKicker', 'The editorial record')}
            </p>
            <h2 id="workflow-title">
              {t(
                'landing.workflowHeading',
                'Five stages. Clear responsibility at each one.',
              )}
            </h2>
          </div>
          <ol
            ref={workflowListRef}
            className={`${styles.workflowList}${workflowListVisible ? ` ${styles.revealed}` : ''}`}
          >
            {workflow.map((step, index) => (
              <li key={step.title} className={styles.workflowStep}>
                <span className={styles.workflowNumber} aria-hidden="true">
                  0{index + 1}
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <aside
            ref={flowSectionRef}
            className={styles.publicationFlow}
            aria-label={t('landing.flowAria', 'Publication decision flow diagram')}
          >
            <p className={styles.publicationFlowHeading} aria-hidden="true">
              {t('landing.flowKicker', 'Decision authority')}
            </p>
            <ol className={styles.flowList}>
              {publicationFlowSteps.map((step, index) => (
                <li key={`${step.role}-${index}`} className={styles.flowStep}>
                  <div className={styles.flowNode}>
                    <step.icon
                      size={18}
                      aria-hidden="true"
                      className={styles.flowIcon}
                    />
                    <span className={styles.flowRole}>{step.role}</span>
                  </div>
                  <p className={styles.flowAction}>{step.action}</p>
                  {step.note && (
                    <p className={styles.flowNote} aria-label={`Note: ${step.note}`}>
                      {step.note}
                    </p>
                  )}
                  {index < publicationFlowSteps.length - 1 && (
                    <div
                      className={`${styles.flowConnector}${flowPathsDrawn.includes(`p${index}`) ? ` ${styles.drawn}` : ''}`}
                      aria-hidden="true"
                      data-step={index}
                    >
                      <ArrowRight size={14} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </aside>
        </section>

        <section
          className={styles.boundariesSection}
          id="boundaries"
          aria-labelledby="boundaries-title"
        >
          <div className={styles.boundariesInner}>
            <div>
              <p className={styles.issueLine}>
                {t('landing.boundariesKicker', 'Public access, carefully defined')}
              </p>
              <h2 id="boundaries-title">
                {t(
                  'landing.boundariesHeading',
                  'The catalog shows approved public work, not the private work behind it.',
                )}
              </h2>
            </div>
            <ul>
              {boundaries.map((boundary) => (
                <li key={boundary}>
                  <CheckCircle2 size={20} aria-hidden="true" />
                  <span>{boundary}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          className={styles.workspacesSection}
          id="workspaces"
          aria-labelledby="workspaces-title"
        >
          <div className={styles.sectionHeading}>
            <p className={styles.issueLine}>
              {t('landing.workspacesKicker', 'Role-specific work')}
            </p>
            <h2 id="workspaces-title">
              {t(
                'landing.workspacesHeading',
                'A shared platform with focused responsibilities.',
              )}
            </h2>
          </div>
          <div className={styles.workspaceGrid}>
            {workspaces.map(({ icon: Icon, title, description }, index) => (
              <article
                className={styles.workspace}
                key={title}
                style={{ '--workspace-stagger': `${index * 60}ms` } as React.CSSProperties}
              >
                <Icon size={24} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.faqSection} aria-labelledby="faq-title">
          <div className={styles.faqIntro}>
            <p className={styles.issueLine}>
              {t('landing.faqKicker', 'Read before you enter')}
            </p>
            <h2 id="faq-title">
              {t('landing.faqHeading', 'Essential context for the ARS platform.')}
            </h2>
          </div>
          <div className={styles.faqList}>
            {faqs.map((faq, index) => (
              <details key={faq.question} open={index === 0}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Link
            className={styles.footerBrand}
            to={ROUTES.LANDING}
            aria-label={t('landing.brandAria', 'Academic Research System home')}
          >
            <img src={arsLogo} alt="ARS" />
            <span>{t('landing.brandName', 'Academic Research System')}</span>
          </Link>
          <nav aria-label={t('landing.footerNavAria', 'Footer navigation')}>
            <Link to={ROUTES.PRIVACY_POLICY}>{t('legal.privacy', 'Privacy')}</Link>
            <Link to={ROUTES.TERMS_OF_SERVICE}>{t('legal.terms', 'Terms')}</Link>
            <Link to={ROUTES.LOGIN}>{t('auth.signInButton', 'Log in')}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
