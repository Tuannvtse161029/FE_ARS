import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  GraduationCap,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { ROUTES } from '../../routes/paths';
import arsLogo from '../../assets/images/ARS_Logo.png';
import styles from './Landing.module.css';

const workflow = [
  {
    title: 'Submit',
    description: 'Researchers provide a manuscript and the academic metadata needed for editorial assessment.',
  },
  {
    title: 'Screen',
    description: 'Administrators assess submission readiness and manage the editorial process.',
  },
  {
    title: 'Review',
    description: 'Eligible reviewers return recommendations within their authorized workspace.',
  },
  {
    title: 'Decide',
    description: 'Administrators make the final publication decision. Reviewer recommendations are not publication decisions.',
  },
  {
    title: 'Discover',
    description: 'Only approved public research becomes available through the research catalog.',
  },
];

const workspaces = [
  {
    icon: FileText,
    title: 'Researcher workspace',
    description: 'Prepare submissions, follow editorial status, revise work, and discover published research.',
  },
  {
    icon: UserCheck,
    title: 'Reviewer workspace',
    description: 'Manage eligible assignments and provide evaluations within the review process.',
  },
  {
    icon: GraduationCap,
    title: 'Lecturer workspace',
    description: 'Coordinate research groups, seminars, learning materials, and academic milestones.',
  },
  {
    icon: Users,
    title: 'Graduate student workspace',
    description: 'Participate in research groups, reports, learning activity, and academic collaboration.',
  },
];

const boundaries = [
  'Only approved public research is discoverable in the catalog.',
  'Reviewer recommendations inform, but do not replace, the final editorial decision.',
  'Private review comments, scores, and administrative notes remain in authorized workspaces.',
];

const faqs = [
  {
    question: 'What is ARS?',
    answer:
      'Academic Research System is a role-based academic platform for research discovery, paper submission and review, seminars, collaboration, and academic workspaces.',
  },
  {
    question: 'Who decides whether research is published?',
    answer:
      'Administrators make the final editorial publication decision. Reviewers provide recommendations as part of that process.',
  },
  {
    question: 'What becomes public?',
    answer:
      'Only research that is both approved and public belongs in the research catalog. Internal review content is not public.',
  },
];

export const Landing = () => {
  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} to={ROUTES.LANDING} aria-label="Academic Research System home">
            <img className={styles.brandLogo} src={arsLogo} alt="ARS" />
            <span>Academic Research System</span>
          </Link>
          <nav className={styles.navigation} aria-label="Landing page navigation">
            <a href="#workflow">Editorial workflow</a>
            <a href="#workspaces">Workspaces</a>
            <a href="#boundaries">Public access</a>
          </nav>
          <Link className={styles.loginButton} to={ROUTES.LOGIN}>
            Log in <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.issueLine}>Public entry / Academic research</p>
              <h1 id="landing-title">A responsible path for research to be read, reviewed, and shared.</h1>
              <p className={styles.heroLead}>
                ARS is a role-based academic platform for research discovery, editorial workflows,
                seminars, and collaboration. It keeps each responsibility clear from submission to
                public discovery.
              </p>
              <div className={styles.heroActions}>
                <Link className={styles.primaryButton} to={ROUTES.LOGIN}>
                  Log in to ARS <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <a className={styles.textLink} href="#workflow">
                  Read the workflow <ArrowRight size={16} aria-hidden="true" />
                </a>
              </div>
            </div>

            <aside className={styles.dossier} aria-labelledby="dossier-title">
              <div className={styles.dossierHeader}>
                <span>ARS editorial dossier</span>
                <ShieldCheck size={20} aria-hidden="true" />
              </div>
              <h2 id="dossier-title">Publication is a governed process.</h2>
              <p>
                ARS separates editorial responsibility from scholarly recommendation, so the path
                to public discovery remains accountable.
              </p>
              <dl className={styles.dossierList}>
                <div>
                  <dt>Researcher</dt>
                  <dd>Submits and follows the work.</dd>
                </div>
                <div>
                  <dt>Reviewer</dt>
                  <dd>Evaluates and recommends.</dd>
                </div>
                <div>
                  <dt>Administrator</dt>
                  <dd>Controls the final decision.</dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        <section className={styles.statement} aria-label="ARS purpose">
          <div>
            <p className={styles.issueLine}>The platform</p>
            <h2>Research deserves more than an upload destination.</h2>
          </div>
          <p>
            ARS brings research discovery, paper submission and review, seminars, collaboration,
            and role-specific workspaces into one academic environment. Its public catalog is
            reserved for research that has completed the editorial process.
          </p>
        </section>

        <section className={styles.workflowSection} id="workflow" aria-labelledby="workflow-title">
          <div className={styles.sectionHeading}>
            <p className={styles.issueLine}>The editorial record</p>
            <h2 id="workflow-title">Five stages. Clear responsibility at each one.</h2>
          </div>
          <ol className={styles.workflowList}>
            {workflow.map((step, index) => (
              <li key={step.title}>
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
        </section>

        <section className={styles.boundariesSection} id="boundaries" aria-labelledby="boundaries-title">
          <div className={styles.boundariesInner}>
            <div>
              <p className={styles.issueLine}>Public access, carefully defined</p>
              <h2 id="boundaries-title">The catalog shows approved public work, not the private work behind it.</h2>
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

        <section className={styles.workspacesSection} id="workspaces" aria-labelledby="workspaces-title">
          <div className={styles.sectionHeading}>
            <p className={styles.issueLine}>Role-specific work</p>
            <h2 id="workspaces-title">A shared platform with focused responsibilities.</h2>
          </div>
          <div className={styles.workspaceGrid}>
            {workspaces.map(({ icon: Icon, title, description }) => (
              <article className={styles.workspace} key={title}>
                <Icon size={24} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.faqSection} aria-labelledby="faq-title">
          <div className={styles.faqIntro}>
            <p className={styles.issueLine}>Read before you enter</p>
            <h2 id="faq-title">Essential context for the ARS platform.</h2>
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
          <Link className={styles.footerBrand} to={ROUTES.LANDING} aria-label="Academic Research System home">
            <img src={arsLogo} alt="ARS" />
            <span>Academic Research System</span>
          </Link>
          <nav aria-label="Footer navigation">
            <Link to={ROUTES.PRIVACY_POLICY}>Privacy</Link>
            <Link to={ROUTES.TERMS_OF_SERVICE}>Terms</Link>
            <Link to={ROUTES.LOGIN}>Log in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
