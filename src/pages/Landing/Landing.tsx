import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Check,
  FileCheck2,
  GraduationCap,
  LibraryBig,
  MessageSquareQuote,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { ROUTES } from '../../routes/paths';
import arsLogo from '../../assets/images/ARS_Logo.png';
import libraryImage from '../../assets/images/hero-bg.jpg';
import styles from './Landing.module.css';

const capabilities = [
  {
    icon: Search,
    title: 'Discover trusted research',
    description:
      'Explore a curated catalog of published academic work by topic, field, author, and institution.',
  },
  {
    icon: FileCheck2,
    title: 'Submit with clarity',
    description:
      'Move from draft to decision through a structured workflow with visible status and feedback.',
  },
  {
    icon: ShieldCheck,
    title: 'Protect research quality',
    description:
      'Admin screening and eligible reviewer assignment keep publication decisions accountable.',
  },
  {
    icon: UsersRound,
    title: 'Collaborate across roles',
    description:
      'Researchers, reviewers, lecturers, and students work in spaces designed for their responsibilities.',
  },
  {
    icon: CalendarDays,
    title: 'Learn beyond papers',
    description:
      'Organize seminars, invite participants, share materials, and follow academic milestones.',
  },
  {
    icon: Network,
    title: 'Connect scholarly identity',
    description:
      'Bring profiles, disciplines, ORCID, DOI, and OpenAlex context into one academic environment.',
  },
];

const workflow = [
  {
    number: '01',
    title: 'Researcher submits',
    description: 'Upload the manuscript and confirm complete academic metadata.',
  },
  {
    number: '02',
    title: 'Admin screens',
    description: 'Verify readiness, authenticity signals, and reviewer eligibility.',
  },
  {
    number: '03',
    title: 'Reviewer evaluates',
    description: 'Accept the assignment and return a private recommendation.',
  },
  {
    number: '04',
    title: 'Admin decides',
    description: 'Make the final editorial decision and publish approved work.',
  },
  {
    number: '05',
    title: 'Community discovers',
    description: 'Published research becomes available in the curated catalog.',
  },
];

const roles = [
  {
    icon: BookOpenCheck,
    title: 'Researchers',
    description: 'Submit work, follow editorial progress, discover papers, and join seminars.',
  },
  {
    icon: UserRoundCheck,
    title: 'Reviewers',
    description: 'Manage assignments, provide rigorous evaluations, and track review activity.',
  },
  {
    icon: GraduationCap,
    title: 'Lecturers',
    description: 'Lead seminars, research groups, topics, learning materials, and milestones.',
  },
  {
    icon: Sparkles,
    title: 'Graduate students',
    description: 'Participate in research groups, submit reports, and learn through collaboration.',
  },
];

const testimonials = [
  {
    quote:
      'ARS gives every submission a visible path. I can focus on the research instead of wondering what happens next.',
    name: 'Mai N.',
    role: 'Illustrative researcher review',
  },
  {
    quote:
      'The reviewer workspace keeps the manuscript, deadline, and evaluation context together without blurring editorial responsibility.',
    name: 'Quang L.',
    role: 'Illustrative reviewer review',
  },
  {
    quote:
      'Research groups, seminars, and progress reports feel connected rather than scattered across unrelated tools.',
    name: 'Anh P.',
    role: 'Illustrative lecturer review',
  },
];

const faqs = [
  {
    question: 'What makes ARS different from a file-sharing website?',
    answer:
      'ARS uses an Admin-controlled editorial workflow. A manuscript is screened, reviewed, decided, and published before it can appear in the research catalog.',
  },
  {
    question: 'Who can use ARS?',
    answer:
      'ARS supports Researchers, Reviewers, Lecturers, Graduate Students, and database-provisioned Admins. Access is shaped by verified and approved responsibilities.',
  },
  {
    question: 'Does a reviewer publish a paper?',
    answer:
      'No. Reviewers provide recommendations. The Admin retains the final publication decision and controls when approved work becomes public.',
  },
  {
    question: 'How does ARS support academic discovery?',
    answer:
      'Published papers can be organized around authors, institutions, fields, topics, keywords, DOI information, and permitted external scholarly links.',
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
          <Link className={styles.brand} to={ROUTES.LANDING} aria-label="ARS home">
            <img className={styles.brandLogo} src={arsLogo} alt="" />
            <span className={styles.brandCopy}>
              <strong>Academic Research System</strong>
              <small>Knowledge, reviewed with purpose</small>
            </span>
          </Link>

          <nav className={styles.navigation} aria-label="Landing page navigation">
            <a href="#purpose">Purpose</a>
            <a href="#capabilities">What you can do</a>
            <a href="#workflow">How it works</a>
            <a href="#community">Community</a>
          </nav>

          <Link className={styles.loginButton} to={ROUTES.LOGIN}>
            Log in
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <div className={styles.eyebrow}>
                <span className={styles.eyebrowDot} aria-hidden="true" />
                A trusted space for academic progress
              </div>
              <h1 id="landing-title">
                Research moves further when <em>knowledge moves together.</em>
              </h1>
              <p className={styles.heroLead}>
                ARS brings discovery, paper submission, peer review, seminars, and
                research collaboration into one role-aware academic platform.
              </p>
              <div className={styles.heroActions}>
                <Link className={styles.primaryButton} to={ROUTES.LOGIN}>
                  Enter ARS
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <a className={styles.secondaryButton} href="#purpose">
                  See how ARS helps
                </a>
              </div>
              <ul className={styles.heroAssurances} aria-label="ARS commitments">
                <li>
                  <Check size={16} aria-hidden="true" />
                  Curated discovery
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  Accountable peer review
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  Role-based access
                </li>
              </ul>
            </div>

            <div className={styles.researchPreview} aria-label="ARS workflow preview">
              <div className={styles.previewTopbar}>
                <span>Research workflow preview</span>
                <div className={styles.previewStatus}>
                  <span aria-hidden="true" />
                  Editorial review active
                </div>
              </div>
              <div className={styles.previewSearch}>
                <Search size={18} aria-hidden="true" />
                <span>Search papers, topics, authors, or institutions</span>
                <kbd>⌘ K</kbd>
              </div>
              <article className={styles.paperCard}>
                <div className={styles.paperMeta}>
                  <span>Environmental science</span>
                  <span>Manuscript v2</span>
                </div>
                <h2>Climate-resilient cities through community-led data</h2>
                <p>
                  A framework for combining local observations with reproducible
                  urban climate analysis.
                </p>
                <div className={styles.paperAuthors}>
                  <span className={styles.avatar}>MN</span>
                  <div>
                    <strong>Mai Nguyen and collaborators</strong>
                    <small>Faculty of Environmental Studies</small>
                  </div>
                </div>
              </article>
              <div className={styles.reviewTrack}>
                <div className={styles.reviewTrackHeader}>
                  <span>Editorial progress</span>
                  <strong>Under review</strong>
                </div>
                <ol>
                  <li className={styles.completeStep}>
                    <span aria-hidden="true">1</span>
                    Submitted
                  </li>
                  <li className={styles.completeStep}>
                    <span aria-hidden="true">2</span>
                    Screened
                  </li>
                  <li className={styles.currentStep}>
                    <span aria-hidden="true">3</span>
                    Review
                  </li>
                  <li>
                    <span aria-hidden="true">4</span>
                    Decision
                  </li>
                </ol>
              </div>
              <div className={styles.previewNote}>
                <ShieldCheck size={18} aria-hidden="true" />
                <span>
                  <strong>Privacy by workflow.</strong> Internal scores and notes stay
                  inside authorized review spaces.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.principles} aria-label="Platform principles">
          <div>
            <strong>One academic ecosystem</strong>
            <span>Discovery, review, learning, and collaboration</span>
          </div>
          <div>
            <strong>Clear responsibility</strong>
            <span>Every role sees the right work at the right stage</span>
          </div>
          <div>
            <strong>Publication with oversight</strong>
            <span>Reviewers recommend; Admins make final decisions</span>
          </div>
        </section>

        <section className={styles.purposeSection} id="purpose">
          <div className={styles.sectionInner}>
            <div className={styles.purposeVisual}>
              <img src={libraryImage} alt="Shelves inside a multi-level academic library" />
              <div className={styles.imageCaption}>
                <LibraryBig size={22} aria-hidden="true" />
                <span>
                  <strong>Knowledge deserves structure.</strong>
                  ARS connects scholarly work to the people and decisions behind it.
                </span>
              </div>
            </div>
            <div className={styles.purposeCopy}>
              <span className={styles.sectionMarker}>01 / OUR PURPOSE</span>
              <h2>A clearer path from academic work to shared impact.</h2>
              <p>
                Valuable research is often spread across files, conversations, and
                disconnected tools. ARS creates a coherent environment where academic
                work can be discovered, evaluated, developed, and shared responsibly.
              </p>
              <div className={styles.purposeList}>
                <div>
                  <span>01</span>
                  <p>
                    <strong>Make knowledge easier to find</strong>
                    Search a curated catalog instead of navigating unstructured uploads.
                  </p>
                </div>
                <div>
                  <span>02</span>
                  <p>
                    <strong>Make academic decisions transparent</strong>
                    Follow meaningful stages from submission to final publication.
                  </p>
                </div>
                <div>
                  <span>03</span>
                  <p>
                    <strong>Make collaboration continuous</strong>
                    Connect papers with seminars, groups, feedback, and scholarly profiles.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.capabilitiesSection} id="capabilities">
          <div className={styles.sectionInnerColumn}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.sectionMarker}>02 / ONE CONNECTED PLATFORM</span>
                <h2>Everything academic work needs to keep moving.</h2>
              </div>
              <p>
                ARS is designed around real academic responsibilities, not a generic
                collection of uploads and messages.
              </p>
            </div>
            <div className={styles.capabilityGrid}>
              {capabilities.map(({ icon: Icon, title, description }, index) => (
                <article className={styles.capabilityCard} key={title}>
                  <span className={styles.cardNumber}>0{index + 1}</span>
                  <div className={styles.iconBox}>
                    <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.workflowSection} id="workflow">
          <div className={styles.sectionInnerColumn}>
            <div className={styles.workflowHeading}>
              <div>
                <span className={styles.sectionMarker}>03 / EDITORIAL WORKFLOW</span>
                <h2>From manuscript to trusted publication.</h2>
              </div>
              <p>
                Quality is not a single button. ARS separates submission, review,
                recommendation, and publication into accountable stages.
              </p>
            </div>
            <ol className={styles.workflowGrid}>
              {workflow.map((step) => (
                <li key={step.number}>
                  <span className={styles.workflowNumber}>{step.number}</span>
                  <div className={styles.workflowLine} aria-hidden="true" />
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.communitySection} id="community">
          <div className={styles.sectionInnerColumn}>
            <div className={styles.centerHeading}>
              <span className={styles.sectionMarker}>04 / BUILT FOR ACADEMIA</span>
              <h2>One community. Purpose-built workspaces.</h2>
              <p>
                Every role contributes differently, so ARS gives each person a focused
                view without disconnecting them from the wider research community.
              </p>
            </div>
            <div className={styles.roleGrid}>
              {roles.map(({ icon: Icon, title, description }) => (
                <article className={styles.roleCard} key={title}>
                  <Icon size={24} strokeWidth={1.7} aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.testimonialSection} aria-labelledby="testimonial-title">
          <div className={styles.sectionInnerColumn}>
            <div className={styles.testimonialHeading}>
              <div>
                <span className={styles.sectionMarker}>05 / EXPERIENCE PREVIEW</span>
                <h2 id="testimonial-title">Designed to feel clear at every stage.</h2>
              </div>
              <p>
                These illustrative testimonials show the experience ARS is designed to
                create. They are examples, not verified customer reviews.
              </p>
            </div>
            <div className={styles.testimonialGrid}>
              {testimonials.map((testimonial) => (
                <figure className={styles.testimonialCard} key={testimonial.name}>
                  <div className={styles.quoteTopline}>
                    <MessageSquareQuote size={25} aria-hidden="true" />
                    <div className={styles.stars} aria-label="Five-star illustrative rating">
                      {[0, 1, 2, 3, 4].map((star) => (
                        <Star key={star} size={14} fill="currentColor" aria-hidden="true" />
                      ))}
                    </div>
                  </div>
                  <blockquote>“{testimonial.quote}”</blockquote>
                  <figcaption>
                    <span>{testimonial.name}</span>
                    <small>{testimonial.role}</small>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.faqSection}>
          <div className={styles.faqInner}>
            <div className={styles.faqIntro}>
              <span className={styles.sectionMarker}>06 / COMMON QUESTIONS</span>
              <h2>Understand ARS before you enter.</h2>
              <p>
                A few essentials about how the platform protects responsibility,
                privacy, and publication quality.
              </p>
            </div>
            <div className={styles.faqList}>
              {faqs.map((faq, index) => (
                <details key={faq.question} open={index === 0}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.ctaSection}>
          <div className={styles.ctaOverlay} aria-hidden="true" />
          <div className={styles.ctaContent}>
            <span className={styles.ctaLabel}>YOUR RESEARCH WORKSPACE AWAITS</span>
            <h2>Turn academic effort into visible progress.</h2>
            <p>
              Enter ARS to discover research, manage your responsibilities, and
              contribute to a more connected academic community.
            </p>
            <Link className={styles.ctaButton} to={ROUTES.LOGIN}>
              Log in to ARS
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <img src={arsLogo} alt="" />
            <div>
              <strong>Academic Research System</strong>
              <span>Structured knowledge. Responsible publication.</span>
            </div>
          </div>
          <nav aria-label="Footer navigation">
            <Link to={ROUTES.PRIVACY_POLICY}>Privacy</Link>
            <Link to={ROUTES.TERMS_OF_SERVICE}>Terms</Link>
            <Link to={ROUTES.LOGIN}>Log in</Link>
          </nav>
          <p>© 2026 ARS. Built for academic collaboration.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
