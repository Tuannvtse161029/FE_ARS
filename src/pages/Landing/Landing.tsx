import { Link } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  GraduationCap,
  UserCheck,
  Users,
  Send,
  ClipboardCheck,
  MessageSquare,
  Scale,
  Globe,
  Search,
  BookOpen,
  Calendar,
  Network,
} from 'lucide-react';
import { ROUTES } from '../../routes/paths';
import { useT } from '../../i18n/I18nContext';
import { LanguageToggle } from '../../components/i18n/LanguageToggle';
import { smoothScrollTo } from '../../utils/smoothScroll';
import arsLogo from '../../assets/images/ARS_Logo.png';
import styles from './Landing.module.css';

// ── Hero social proof metrics ────────────────────────────────
const HERO_METRICS = [
  { value: '1,200+', key: 'landing.heroStat1Label', fallback: 'Papers published' },
  { value: '340+',  key: 'landing.heroStat2Label', fallback: 'Active researchers' },
  { value: '85+',   key: 'landing.heroStat3Label', fallback: 'Seminars held' },
];

// ── Feature cards (mirrors Vietnamese i18n) ─────────────────
const FEATURES = [
  {
    icon: Search,
    role: 'researcher',
    titleKey: 'landing.feature1Title',
    bodyKey: 'landing.feature1Body',
    titleFallback: 'Structured Discovery',
    bodyFallback: 'Browse papers by field, author group, and trends. Save to your watchlist to never miss an update.',
  },
  {
    icon: BookOpen,
    role: 'reviewer',
    titleKey: 'landing.feature2Title',
    bodyKey: 'landing.feature2Body',
    titleFallback: 'Trusted Peer Review',
    bodyFallback: 'Structured evaluation workflows enable clear feedback, transparent version history, and auditable publication decisions.',
  },
  {
    icon: Calendar,
    role: 'lecturer',
    titleKey: 'landing.feature3Title',
    bodyKey: 'landing.feature3Body',
    titleFallback: 'Academic Seminars',
    bodyFallback: 'Create and manage seminars, send Google Meet invitations, and track attendee responses — all in one place.',
  },
  {
    icon: Network,
    role: 'student',
    titleKey: 'landing.feature4Title',
    bodyKey: 'landing.feature4Body',
    titleFallback: 'Role-based Collaboration',
    bodyFallback: 'Dedicated workspaces for Lecturers, Researchers, Reviewers, and Admins with clear permissions.',
  },
];

// ── Publication flow constellation nodes ─────────────────────
const PUBLICATION_NODES = [
  {
    icon: Send,
    role: 'researcher',
    roleKey: 'landing.flowResearcher',
    actionKey: 'landing.flowResearcherAction',
    noteKey: 'landing.flowResearcherNote',
    roleFallback: 'Researcher',
    actionFallback: 'Uploads a paper to ARS for consideration.',
    noteFallback: 'cannot choose the reviewer',
  },
  {
    icon: ClipboardCheck,
    role: 'admin',
    roleKey: 'landing.flowAdmin',
    actionKey: 'landing.flowAdminScreenAction',
    noteKey: null,
    roleFallback: 'Admin',
    actionFallback: 'Screens the submission and assigns a suitable reviewer.',
    noteFallback: null,
  },
  {
    icon: MessageSquare,
    role: 'reviewer',
    roleKey: 'landing.flowReviewer',
    actionKey: 'landing.flowReviewerAction',
    noteKey: 'landing.flowReviewerNote',
    roleFallback: 'Reviewer',
    actionFallback: 'Evaluates the paper and returns a recommendation.',
    noteFallback: 'recommends, does not publish',
  },
  {
    icon: Scale,
    role: 'admin',
    roleKey: 'landing.flowAdmin',
    actionKey: 'landing.flowAdminDecideAction',
    noteKey: null,
    roleFallback: 'Admin',
    actionFallback: 'Makes the final publication decision.',
    noteFallback: null,
  },
  {
    icon: Globe,
    role: 'catalog',
    roleKey: 'landing.flowCatalog',
    actionKey: 'landing.flowCatalogAction',
    noteKey: null,
    roleFallback: 'Catalog',
    actionFallback: 'Only approved papers are published to the ARS public catalog.',
    noteFallback: null,
  },
];

export const Landing = () => {
  const t = useT();
  const workflowListRef = useRef<HTMLOListElement>(null);
  const flowSectionRef = useRef<HTMLElement>(null);
  const [workflowListVisible, setWorkflowListVisible] = useState(false);
  const [flowConnectorsDrawn, setFlowConnectorsDrawn] = useState(false);
  const [flowDotsAnimated, setFlowDotsAnimated] = useState(false);

  // ── Scroll-driven observers ───────────────────────────────
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

    // Trigger flow constellation animation when the section enters the viewport.
    const flowObs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          flowObs.disconnect();
          if (!prefersReduced) {
            // Draw connector lines sequentially, then animate dots
            [0, 1, 2, 3].forEach((i) => {
              setTimeout(() => {
                setFlowConnectorsDrawn(true);
              }, 300 + i * 200);
            });
            setTimeout(() => {
              setFlowDotsAnimated(true);
            }, 1200);
          } else {
            setFlowConnectorsDrawn(true);
            setFlowDotsAnimated(true);
          }
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

  // ── Static content data ───────────────────────────────────
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
      role: 'researcher',
      title: t('landing.workspaceResearcherTitle', 'Researcher workspace'),
      description: t(
        'landing.workspaceResearcherBody',
        'Prepare submissions, follow editorial status, revise work, and discover published research.',
      ),
    },
    {
      icon: UserCheck,
      role: 'reviewer',
      title: t('landing.workspaceReviewerTitle', 'Reviewer workspace'),
      description: t(
        'landing.workspaceReviewerBody',
        'Manage eligible assignments and provide evaluations within the review process.',
      ),
    },
    {
      icon: GraduationCap,
      role: 'lecturer',
      title: t('landing.workspaceLecturerTitle', 'Lecturer workspace'),
      description: t(
        'landing.workspaceLecturerBody',
        'Coordinate research groups, seminars, learning materials, and academic milestones.',
      ),
    },
    {
      icon: Users,
      role: 'student',
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

  // ── Hero constellation node positions (for SVG lines) ──────
  // Positions are % within a 340×180 container, matching .heroConstellation
  const constellationNodes = [
    { cx: 42,  cy: 22  }, // cn0 — top-left
    { cx: 188, cy: 9   }, // cn1 — top-center
    { cx: 156, cy: 66  }, // cn2 — center (largest node)
    { cx: 95,  cy: 126 }, // cn3 — bottom-left
    { cx: 232, cy: 108 }, // cn4 — bottom-right
    { cx: 168, cy: 156 }, // cn5 — bottom-center
  ];

  const constellationIcons = [Users, BookOpen, GraduationCap, Network, FileText, MessageSquare];

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main-content">
        {t('landing.skipToContent', 'Skip to main content')}
      </a>

      {/* ── Header ───────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link
            className={styles.brand}
            to={ROUTES.LANDING}
            aria-label={t('landing.brandAria', 'Academic Research System home')}
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

        {/* ── Hero ───────────────────────────────────────── */}
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroInner}>
            {/* Left: headline + metrics + CTAs */}
            <div className={styles.heroCopy}>
              <p className={styles.issueLine}>
                {t('landing.heroBadge', 'Trusted by Vietnamese researchers')}
              </p>
              <h1 id="landing-title">
                {t(
                  'landing.heroTitle',
                  'Where Vietnamese researchers share, review, and advance science together.',
                )}
              </h1>
              <p className={styles.heroLead}>
                {t(
                  'landing.heroSubtitle',
                  'Discover research, join structured peer review, organize academic seminars, and collaborate by role — all in one secure platform.',
                )}
              </p>

              {/* Social proof metrics */}
              <div className={styles.heroMetrics}>
                {HERO_METRICS.map((metric, i) => (
                  <>
                    {i > 0 && (
                      <span key={`div-${i}`} className={styles.metricDivider} aria-hidden="true" />
                    )}
                    <div key={metric.key} className={styles.metricItem}>
                      <span className={styles.metricValue}>{metric.value}</span>
                      <span className={styles.metricLabel}>
                        {t(metric.key, metric.fallback)}
                      </span>
                    </div>
                  </>
                ))}
              </div>

              <div className={styles.heroActions}>
                <Link className={styles.primaryButton} to={ROUTES.LOGIN}>
                  {t('landing.ctaPrimary', 'Get started free')}{' '}
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <a
                  className={styles.textLink}
                  href="#workflow"
                  onClick={(e) => handleAnchorClick(e, 'workflow')}
                >
                  {t('landing.ctaSecondary', 'View seminars')}{' '}
                  <ArrowRight size={16} aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Right: constellation composition */}
            <div className={styles.heroVisual} aria-hidden="true">
              <div className={styles.heroAcrLabel}>ARS</div>
              <div className={styles.heroConstellation}>
                {/* SVG connecting lines */}
                <svg
                  className={styles.constellationCanvas}
                  viewBox="0 0 340 180"
                  preserveAspectRatio="xMidYMid meet"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <line
                    x1={constellationNodes[0].cx} y1={constellationNodes[0].cy}
                    x2={constellationNodes[1].cx} y2={constellationNodes[1].cy}
                  />
                  <line
                    x1={constellationNodes[1].cx} y1={constellationNodes[1].cy}
                    x2={constellationNodes[2].cx} y2={constellationNodes[2].cy}
                  />
                  <line
                    x1={constellationNodes[2].cx} y1={constellationNodes[2].cy}
                    x2={constellationNodes[3].cx} y2={constellationNodes[3].cy}
                  />
                  <line
                    x1={constellationNodes[3].cx} y1={constellationNodes[3].cy}
                    x2={constellationNodes[4].cx} y2={constellationNodes[4].cy}
                  />
                  <line
                    x1={constellationNodes[4].cx} y1={constellationNodes[4].cy}
                    x2={constellationNodes[5].cx} y2={constellationNodes[5].cy}
                  />
                  <line
                    x1={constellationNodes[2].cx} y1={constellationNodes[2].cy}
                    x2={constellationNodes[4].cx} y2={constellationNodes[4].cy}
                  />
                </svg>

                {/* Constellation nodes */}
                {constellationNodes.map((_node, i) => {
                  const Icon = constellationIcons[i];
                  return (
                    <div
                      key={i}
                      className={`${styles.constellationNode} ${styles[`cn${i}`]}`}
                    >
                      <Icon size={i === 2 ? 26 : i === 0 ? 22 : i === 4 ? 18 : 16} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Statement ──────────────────────────────────── */}
        <section className={styles.statement} aria-label={t('landing.statementAria', 'ARS purpose')}>
          <div>
            <p className={styles.issueLine}>
              {t('landing.statementKicker', 'The platform')}
            </p>
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

        {/* ── Features ────────────────────────────────────── */}
        <section className={styles.featuresSection} aria-label={t('landing.featuresTitle', 'Platform features')}>
          <div className={styles.featuresInner}>
            <div className={styles.featuresHeader}>
              <p className={styles.issueLine}>
                {t('landing.featuresSubtitle', 'Structured tools for research discovery, review, and collaboration — no stitching together multiple apps.')}
              </p>
              <h2>
                {t(
                  'landing.featuresTitle',
                  'Everything your research team needs',
                )}
              </h2>
            </div>
            <div className={styles.featuresGrid}>
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.titleKey}
                    className={styles.featureItem}
                    data-role={feature.role}
                  >
                    <div className={styles.featureIcon}>
                      <Icon size={22} aria-hidden="true" />
                    </div>
                    <h3>{t(feature.titleKey, feature.titleFallback)}</h3>
                    <p>{t(feature.bodyKey, feature.bodyFallback)}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Workflow ─────────────────────────────────────── */}
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
              <li
                key={step.title}
                className={styles.workflowStep}
                data-num={`0${index + 1}`}
                aria-label={step.title}
              >
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>

          {/* Publication decision flow — constellation diagram */}
          <aside
            ref={flowSectionRef}
            className={styles.publicationFlow}
            aria-label={t('landing.flowAria', 'Publication decision flow diagram')}
          >
            <p className={styles.publicationFlowHeading} aria-hidden="true">
              {t('landing.flowKicker', 'Decision authority')}
            </p>
            <div className={styles.flowConstellation}>
              {PUBLICATION_NODES.map((node, index) => {
                const Icon = node.icon;
                return (
                  <div key={`${node.role}-${index}`} className={styles.flowNodeItem} data-role={node.role}>
                    <div className={styles.flowNodeCircle}>
                      <Icon size={18} aria-hidden="true" />
                    </div>
                    <span className={styles.flowNodeRole}>
                      {t(node.roleKey, node.roleFallback)}
                    </span>
                    <span className={styles.flowNodeAction}>
                      {t(node.actionKey, node.actionFallback)}
                    </span>
                    {node.noteKey && (
                      <span className={styles.flowNodeNote}>
                        {t(node.noteKey, node.noteFallback ?? '')}
                      </span>
                    )}
                    {index < PUBLICATION_NODES.length - 1 && (
                      <div
                        className={`${styles.flowConnectorLine}${flowConnectorsDrawn ? ` ${styles.drawn}` : ''}`}
                        aria-hidden="true"
                      >
                        <span
                          className={`${styles.flowDot}${flowDotsAnimated ? ` ${styles.animated}` : ''}`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        </section>

        {/* ── Boundaries ───────────────────────────────────── */}
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

        {/* ── Workspaces ──────────────────────────────────── */}
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
            {workspaces.map(({ icon: Icon, title, description, role }, index) => (
              <article
                className={styles.workspace}
                key={title}
                data-role={role}
                style={{ '--workspace-stagger': `${index * 60}ms` } as React.CSSProperties}
              >
                <Icon size={24} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{description}</p>
                <span className={styles.workspaceArrow}>
                  Explore <ArrowRight size={14} aria-hidden="true" />
                </span>
              </article>
            ))}
          </div>
        </section>

        {/* ── Testimonial ─────────────────────────────────── */}
        <section className={styles.testimonialSection} aria-label="Researcher testimonial">
          <div className={styles.testimonialInner}>
            <span className={styles.testimonialMark} aria-hidden="true">"</span>
            <blockquote className={styles.testimonialQuote}>
              {t(
                'landing.testimonialQuote',
                'ARS cut our team review time in half — clear feedback, no scattered emails.',
              )}
            </blockquote>
            <div className={styles.testimonialAttribution}>
              <span className={styles.testimonialName}>
                {t('landing.testimonialName', 'Dr. Nguyen Minh Anh')}
              </span>
              <span className={styles.testimonialRole}>
                {t('landing.testimonialRole', 'Research Lead, HCMUT')}
              </span>
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────── */}
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

        {/* ── CTA ─────────────────────────────────────────── */}
        <section className={styles.ctaSection} aria-labelledby="cta-title">
          <div className={styles.sectionHeading}>
            <p className={styles.issueLine}>
              {t('landing.ctaBody', 'Join hundreds of Vietnamese researchers using ARS to collaborate, review, and publish.')}
            </p>
            <h2 id="cta-title">
              {t(
                'landing.ctaTitle',
                'Ready to take your research to the next level?',
              )}
            </h2>
          </div>
          <Link className={styles.primaryButton} to={ROUTES.LOGIN}>
            {t('landing.ctaButton', 'Create a free account')}{' '}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <a
            className={styles.textLink}
            href="#workflow"
            onClick={(e) => handleAnchorClick(e, 'workflow')}
          >
            {t('landing.ctaSecondary', 'View seminars')}{' '}
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </section>

      </main>

      {/* ── Footer ────────────────────────────────────────── */}
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
          <div className={styles.footerNav}>
            <nav aria-label={t('landing.footerNavAria', 'Footer navigation')}>
              <Link to={ROUTES.PRIVACY_POLICY}>{t('legal.privacy', 'Privacy')}</Link>
              <Link to={ROUTES.TERMS_OF_SERVICE}>{t('legal.terms', 'Terms')}</Link>
              <Link to={ROUTES.LOGIN}>{t('auth.signInButton', 'Log in')}</Link>
            </nav>
          </div>
        </div>
        <p className={styles.footerCopy}>
          &copy; 2026 ARS — {t('landing.footerAboutBody', 'Trusted academic platform for research, peer review, and collaboration.')}
        </p>
      </footer>
    </div>
  );
};

export default Landing;
