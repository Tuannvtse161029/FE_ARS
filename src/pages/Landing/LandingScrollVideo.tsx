/**
 * LandingScrollVideo — Premium scroll-driven landing page
 *
 * Five-act narrative built on scrollcraft devices:
 *   Act 1 (scrub)  — Video scrubs as headline assembles over conference call
 *   Act 2 (pin)    — Pinned "tension" scene with parallax depth + counter
 *   Act 3 (pin)    — Pinned kinetic typography revealing 5 editorial stages
 *   Act 4 (pan)    — Horizontal pan through role-based workspaces
 *   Act 5 (flow)   — Flow sections with pointer-following spotlight CTA
 *
 * Design intent: each act uses a DIFFERENT device so the page never repeats
 * the same idea twice. The hero gets the most scroll span because it is the
 * engineered peak — the moment the visitor remembers.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Globe,
  GraduationCap,
  MessageSquare,
  Network,
  Scale,
  Send,
  UserCheck,
} from 'lucide-react';
import { ROUTES } from '../../routes/paths';
import { useT } from '../../i18n/I18nContext';
import { LanguageToggle } from '../../components/i18n/LanguageToggle';
import { smoothScrollTo } from '../../utils/smoothScroll';
import arsLogo from '../../assets/images/ARS_Logo.png';
import heroPoster from '../../assets/images/hero-bg.jpg';
import styles from './LandingScrollVideo.module.css';

// ── Static content (i18n keys + English fallbacks) ──────────────
const HERO_METRICS = [
  { end: 1200, suffix: '+', key: 'landing.heroStat1Label', fallback: 'Papers published' },
  { end: 340, suffix: '+', key: 'landing.heroStat2Label', fallback: 'Active researchers' },
  { end: 85, suffix: '+', key: 'landing.heroStat3Label', fallback: 'Seminars held' },
];

const ROLE_WORKS = [
  {
    icon: FileText,
    role: 'researcher',
    titleKey: 'landing.workspaceResearcherTitle',
    fallback: 'Researcher workspace',
    bodyKey: 'landing.workspaceResearcherBody',
    bodyFallback:
      'Prepare submissions, follow editorial status, revise work, and discover published research — all in one focused workspace.',
    accent: 'var(--ars-researcher)',
  },
  {
    icon: UserCheck,
    role: 'reviewer',
    titleKey: 'landing.workspaceReviewerTitle',
    fallback: 'Reviewer workspace',
    bodyKey: 'landing.workspaceReviewerBody',
    bodyFallback:
      'Manage eligible assignments, return structured evaluations, and contribute to publication decisions with auditable version history.',
    accent: 'var(--ars-reviewer)',
  },
  {
    icon: GraduationCap,
    role: 'lecturer',
    titleKey: 'landing.workspaceLecturerTitle',
    fallback: 'Lecturer workspace',
    bodyKey: 'landing.workspaceLecturerBody',
    bodyFallback:
      'Coordinate research groups, seminars, learning materials, and academic milestones with a calendar that respects your week.',
    accent: 'var(--ars-lecturer)',
  },
  {
    icon: Network,
    role: 'student',
    titleKey: 'landing.workspaceStudentTitle',
    fallback: 'Graduate student workspace',
    bodyKey: 'landing.workspaceStudentBody',
    bodyFallback:
      'Participate in research groups, submit phased reports, track learning activity, and collaborate with peers by milestone.',
    accent: 'var(--ars-gradstudent)',
  },
] as const;

const WORKFLOW = [
  { num: '01', titleKey: 'landing.workflowStep1Title', titleFallback: 'Submit', bodyKey: 'landing.workflowStep1Body', bodyFallback: 'Researchers provide a manuscript and the academic metadata needed for editorial assessment.' },
  { num: '02', titleKey: 'landing.workflowStep2Title', titleFallback: 'Screen', bodyKey: 'landing.workflowStep2Body', bodyFallback: 'Administrators assess submission readiness and manage the editorial process.' },
  { num: '03', titleKey: 'landing.workflowStep3Title', titleFallback: 'Review', bodyKey: 'landing.workflowStep3Body', bodyFallback: 'Eligible reviewers return recommendations within their authorized workspace.' },
  { num: '04', titleKey: 'landing.workflowStep4Title', titleFallback: 'Decide', bodyKey: 'landing.workflowStep4Body', bodyFallback: 'Administrators make the final publication decision. Reviewer recommendations are not publication decisions.' },
  { num: '05', titleKey: 'landing.workflowStep5Title', titleFallback: 'Discover', bodyKey: 'landing.workflowStep5Body', bodyFallback: 'Only approved public research becomes available through the research catalog.' },
] as const;

const PUBLICATION_NODES = [
  {
    icon: Send, role: 'researcher',
    roleKey: 'landing.flowResearcher', roleFallback: 'Researcher',
    actionKey: 'landing.flowResearcherAction', actionFallback: 'Uploads a paper to ARS for consideration.',
    noteKey: 'landing.flowResearcherNote', noteFallback: 'cannot choose the reviewer',
  },
  {
    icon: ClipboardCheck, role: 'admin',
    roleKey: 'landing.flowAdmin', roleFallback: 'Admin',
    actionKey: 'landing.flowAdminScreenAction', actionFallback: 'Screens the submission and assigns a suitable reviewer.',
    noteKey: null, noteFallback: null,
  },
  {
    icon: MessageSquare, role: 'reviewer',
    roleKey: 'landing.flowReviewer', roleFallback: 'Reviewer',
    actionKey: 'landing.flowReviewerAction', actionFallback: 'Evaluates the paper and returns a recommendation.',
    noteKey: 'landing.flowReviewerNote', noteFallback: 'recommends, does not publish',
  },
  {
    icon: Scale, role: 'admin',
    roleKey: 'landing.flowAdmin', roleFallback: 'Admin',
    actionKey: 'landing.flowAdminDecideAction', actionFallback: 'Makes the final publication decision.',
    noteKey: null, noteFallback: null,
  },
  {
    icon: Globe, role: 'catalog',
    roleKey: 'landing.flowCatalog', roleFallback: 'Catalog',
    actionKey: 'landing.flowCatalogAction', actionFallback: 'Only approved papers are published to the ARS public catalog.',
    noteKey: null, noteFallback: null,
  },
] as const;

const BOUNDARIES = [
  'landing.boundary1',
  'landing.boundary2',
  'landing.boundary3',
] as const;
const BOUNDARY_FALLBACKS = [
  'Only approved public research is discoverable in the catalog.',
  'Reviewer recommendations inform, but do not replace, the final editorial decision.',
  'Private review comments, scores, and administrative notes remain in authorized workspaces.',
];

const FAQS = [
  {
    qKey: 'landing.faq1Q', qFallback: 'What is ARS?',
    aKey: 'landing.faq1A', aFallback: 'Academic Research System is a role-based academic platform for research discovery, paper submission and review, seminars, collaboration, and academic workspaces.',
  },
  {
    qKey: 'landing.faq2Q', qFallback: 'Who decides whether research is published?',
    aKey: 'landing.faq2A', aFallback: 'Administrators make the final editorial publication decision. Reviewers provide recommendations as part of that process.',
  },
  {
    qKey: 'landing.faq3Q', qFallback: 'What becomes public?',
    aKey: 'landing.faq3A', aFallback: 'Only research that is both approved and public belongs in the research catalog. Internal review content is not public.',
  },
];

// ──────────────────────────────────────────────────────────────────────
// NOTE: the scrollcraft engine is intentionally NOT used in this
// component. Its global `[data-sc-cue] { opacity: 0 }` rule made every
// text element invisible on first paint, and the engine's runtime
// reset (`style.opacity = 0`) on every scroll pass made the page
// unreadable. We render directly without engine scrubbing and drive
// scroll effects with local React hooks.

// ── useReveal hook (IntersectionObserver-driven fade-in) ────────
// Critical: if the element is ALREADY past the viewport top when the
// observer attaches (e.g. when navigating back to the top of a long
// page, or when the element is in a sticky stage that already passed
// its reveal trigger), we mark it seen immediately. Otherwise the
// observer would silently never fire and the section would stay
// invisible forever.
const useReveal = <T extends HTMLElement>(threshold = 0.15) => {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // If element is already on-screen or above the viewport top, mark seen.
    // The check uses the full viewport (no negative rootMargin inset) so
    // elements currently sitting in the bottom 8% of the viewport are
    // still treated as "on screen".
    const rect = node.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh && rect.bottom > 0) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      // Small bottom inset shrinks the trigger zone so elements don't
      // fire too early, but not so much that bottom-of-viewport
      // elements miss the trigger.
      { threshold, rootMargin: '0px 0px 0px 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, seen };
};

// Alias kept for the count-up path so the threshold can be tuned
// independently of section-level reveals.
const useCountUpReveal = useReveal;

// ── useCountUp hook (animates a number when visible) ───────────
const useCountUp = (target: number, durationMs = 1400) => {
  // Threshold 0.4 is too strict for small elements — IntersectionObserver
  // fires `intersecting=true` only when 40% of the element is visible.
  // We use 0.1 so the counter starts as soon as a sliver of the metrics
  // row enters the viewport. The `useReveal` hook already handles the
  // "already on screen at attach" case.
  const { ref, seen } = useCountUpReveal<HTMLSpanElement>(0.1);
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!seen) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, target, durationMs]);
  return { ref, value };
};

// ── useParallaxProgress: returns 0..1 scroll progress for an element.
// Used by the tension parallax layers to drift at independent rates.
// The progress is 0 when the element's top reaches the viewport top and
// 1 when its bottom reaches the viewport top. The clamp at both ends
// keeps the layers from snapping when the act leaves view. ──────────
const useParallaxProgress = (ref: React.RefObject<HTMLElement | null>) => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onScroll = () => {
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const total = rect.height - vh;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      setProgress(total > 0 ? scrolled / total : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [ref]);
  return progress;
};

// ── useReducedMotion ────────────────────────────────────────────
const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
};

// ── useRailOverflowVw (returns how much the rail overflows the viewport, in vw) ──
// The pan act translates the rail horizontally as the user scrolls. To
// avoid shoving cards off-screen on narrow viewports (or under-panning on
// wide ones), we measure the rail's actual scrollWidth against the
// available viewport width and report the difference in vw.
const useRailOverflowVw = (ref: React.RefObject<HTMLElement | null>) => {
  const [overflow, setOverflow] = useState(0);
  useEffect(() => {
    const measure = () => {
      const node = ref.current;
      if (!node) return;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      // Available width equals the parent stage's clientWidth; the rail
      // itself is wider than that.
      const stage = node.parentElement;
      const available = stage ? stage.clientWidth : vw;
      const overflowPx = Math.max(0, node.scrollWidth - available);
      setOverflow((overflowPx / vw) * 100);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [ref]);
  return overflow;
};

// ── usePanProgress (returns 0..1 progress through a pan act) ───
const usePanProgress = (ref: React.RefObject<HTMLElement | null>) => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onScroll = () => {
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight;
      // progress is 0 when the act top hits viewport top, 1 when bottom hits viewport top
      const total = rect.height - vh;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      setProgress(total > 0 ? scrolled / total : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [ref]);
  return progress;
};

// ── useScrollScrub was previously here to drive a <video> element's
// currentTime from scroll progress. The only video in the project
// ("A Conference Call in Real Life.mp4") belongs to the AI summary
// feature, NOT the landing page, so the scrub hook has been removed.
// The hero is now driven entirely by image parallax and CSS motion.
// ──────────────────────────────────────────────────────────────────

// ── Spotlight (pointer-following gradient overlay) ─────────────
interface SpotlightProps {
  className?: string;
  children: React.ReactNode;
}
const Spotlight: React.FC<SpotlightProps> = ({ className = '', children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduced || !fine) return;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      el.style.setProperty('--mx', String(x));
      el.style.setProperty('--my', String(y));
    };
    el.addEventListener('pointermove', onMove);
    return () => el.removeEventListener('pointermove', onMove);
  }, []);
  return (
    <div ref={ref} className={`${styles.spotlight} ${className}`}>
      {children}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// SIGNATURE MOVE — Editorial Trace
//
// A thin horizontal line fixed at the bottom edge of the viewport, present
// on every scroll position. Scroll position is the playhead; passing an
// act stamps a marker on the trace. By the footer the trace is a complete
// record of what the visitor just went through. Scrollcraft uniqueness.md
// §3 calls this out by name as the canonical signature move pattern.
//
// This is the bespoke interaction that lives on this site alone — it is
// not a parameter change to any kit device.
// ════════════════════════════════════════════════════════════════
const TRACE_ACTS = [
  { id: 'hero', label: 'Recognition' },
  { id: 'tension', label: 'Tension' },
  { id: 'turn', label: 'Turn' },
  { id: 'substance', label: 'Substance' },
  { id: 'commitment', label: 'Commitment' },
] as const;

const EditorialTrace: React.FC = () => {
  const traceRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      // Playhead
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translate3d(${p * 100}%, 0, 0)`;
      }
      // Markers — each lights up when its act has been visited
      TRACE_ACTS.forEach((act, i) => {
        const node = document.getElementById(act.id);
        const marker = markerRefs.current[i];
        const label = labelRefs.current[i];
        if (!marker) return;
        const passed = node
          ? node.getBoundingClientRect().top < window.innerHeight * 0.55
          : false;
        marker.dataset.passed = passed ? 'true' : 'false';
        if (label) label.dataset.passed = passed ? 'true' : 'false';
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [reduced]);

  return (
    <div
      ref={traceRef}
      className={styles.editorialTrace}
      aria-hidden="true"
    >
      <div className={styles.editorialTrack} />
      <div ref={playheadRef} className={styles.editorialPlayhead} />
      {TRACE_ACTS.map((act, i) => (
        <div
          key={act.id}
          ref={(el) => (markerRefs.current[i] = el)}
          className={styles.editorialMarker}
          style={{ left: `${(i / (TRACE_ACTS.length - 1)) * 100}%` }}
        >
          <span className={styles.editorialMarkerDot} />
          <span
            ref={(el) => (labelRefs.current[i] = el)}
            className={styles.editorialMarkerLabel}
          >
            {act.label}
          </span>
        </div>
      ))}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// ACT 1 — HERO (scrub): Video scrubs as headline assembles
// ════════════════════════════════════════════════════════════════
const HeroAct: React.FC<{ t: (k: string, f: string, p?: Record<string, string | number>) => string }> = ({ t }) => {
  const reduced = useReducedMotion();
  const actRef = useRef<HTMLElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);
  const foregroundRef = useRef<HTMLDivElement>(null);
  const nearRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Three independent depth planes drive the hero. The background photo
  // drifts slowest (closest to "the room"), the foreground light streak
  // faster, the near accent rule fastest. The copy rides at 1x — text
  // the reader is trying to read should NOT move relative to the thing
  // they are reading it against (scrollcraft devices.md §6).
  //
  // Rates are intentionally small (a few tens of pixels across the
  // whole 3vh act) so the eye reads them as depth rather than as
  // things sliding around. Copy/metrics/actions parallax independently
  // from the photo so the composition reads as multiple stacked planes.
  useEffect(() => {
    const el = actRef.current;
    if (!el) return;
    const reset = () => {
      [posterRef, foregroundRef, nearRef, copyRef, metricsRef, actionsRef].forEach((r) => {
        if (r.current) r.current.style.transform = '';
      });
    };
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const total = rect.height - vh;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const p = total > 0 ? scrolled / total : 0;
      if (reduced) {
        reset();
        return;
      }
      // Background photo — slowest drift, drifts UP (negative)
      if (posterRef.current) posterRef.current.style.transform = `scale(1.06) translate3d(0, ${(-p * 22).toFixed(2)}px, 0)`;
      // Foreground light streak — drifts DOWN (positive) so the two
      // planes visibly separate
      if (foregroundRef.current) foregroundRef.current.style.transform = `translate3d(0, ${(p * 38).toFixed(2)}px, 0)`;
      // Near accent rule — drifts UP fastest, then fades so it
      // reads as a hairline that crosses the frame as you scroll
      if (nearRef.current) {
        nearRef.current.style.transform = `translate3d(0, ${(-p * 64).toFixed(2)}px, 0)`;
        nearRef.current.style.opacity = String(Math.max(0, 1 - p * 1.4));
      }
      // Copy planes — copy rides at 1x, metrics ride faster, actions
      // fastest. They drift opposite to the photo so the photo's
      // up-drift makes them feel anchored.
      if (copyRef.current) copyRef.current.style.transform = `translate3d(0, ${(p * 8).toFixed(2)}px, 0)`;
      if (metricsRef.current) metricsRef.current.style.transform = `translate3d(0, ${(p * 28).toFixed(2)}px, 0)`;
      if (actionsRef.current) actionsRef.current.style.transform = `translate3d(0, ${(p * 48).toFixed(2)}px, 0)`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [reduced]);

  return (
    <section
      ref={actRef}
      className={styles.heroAct}
      aria-labelledby="hero-title"
    >
      <div className={styles.heroStage}>
        {/* Hero background — the library photograph that anchors the
            editorial tone. Three independent layers stack on top:
            the photo itself, a near-camera light streak, and the
            foreground vellum sheet. They drift at slightly different
            rates (driven from the same scroll listener below) so the
            hero reads as a layered scene rather than a single image.
            No video is loaded — the only video in /public was a test
            asset for the AI summary feature, not for the landing. */}
        <img
          ref={posterRef}
          className={styles.heroPoster}
          src={heroPoster}
          alt=""
          aria-hidden="true"
        />
        <div ref={foregroundRef} className={styles.heroLayerForeground} aria-hidden="true" />
        <div ref={nearRef} className={styles.heroLayerNear} aria-hidden="true" />

        {/* Scrim: gradient pointing at the copy so contrast holds everywhere */}
        <div className={`${styles.scrim} ${styles.scrimBand}`} aria-hidden="true" />

        {/* Drift: page background interpolates to dark navy while this act is on screen */}
        <div className={styles.drift} data-sc-drift="#0f1430" aria-hidden="true" />

        {/* Hero copy — kinetic lines assemble from behind mask edges.
            NOTE: We deliberately do NOT use `data-sc-cue` here. The
            scrollcraft engine's global stylesheet sets
            `[data-sc-cue] { opacity: 0 }` and only toggles it back on
            once the cue's scroll range is reached — which means text
            above the fold is invisible until you scroll past it. We
            use entry animations via the CSS module instead so the
            hero is readable on first paint. */}
        <div ref={copyRef} className={`${styles.heroCopy} sc-copy sc-copy--lead`}>
          <p
            className={styles.heroKicker}
          >
            {t('landing.heroBadge', 'Trusted by Vietnamese researchers')}
          </p>
          <h1
            id="hero-title"
            className={`${styles.heroTitle} sc-display sc-display--xl`}
          >
            {t(
              'landing.heroTitle',
              'Where Vietnamese researchers share, review, and advance science together.',
            )}
          </h1>
          <p
            className={`${styles.heroLead} sc-lede`}
          >
            {t(
              'landing.heroSubtitle',
              'Discover research, join structured peer review, organize academic seminars, and collaborate by role — all in one secure platform.',
            )}
          </p>

          {/* Animated counters — fade in late and bloom to their final figure */}
          <div ref={metricsRef} className={styles.heroMetrics}>
            {HERO_METRICS.map((m, i) => (
              <React.Fragment key={m.key}>
                {i > 0 && (
                  <span
                    className={styles.metricDivider}
                    aria-hidden="true"
                  />
                )}
                <HeroCounter end={m.end} suffix={m.suffix} label={t(m.key, m.fallback)} />
              </React.Fragment>
            ))}
          </div>

          <div ref={actionsRef} className={styles.heroActions}>
            <Link className={styles.primaryButton} to={ROUTES.LOGIN}>
              {t('landing.ctaPrimary', 'Get started free')} <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <a
              className={styles.textLink}
              href="#tension"
              data-scroll-anchor="tension"
            >
              {t('landing.ctaSecondary', 'See the workflow')} <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* Hint at the bottom — kept tiny, fades in late */}
        <div className={styles.heroHint} aria-hidden="true">
          <span>Scroll to enter</span>
          <span className={styles.heroHintLine} />
        </div>
      </div>
    </section>
  );
};

const HeroCounter: React.FC<{ end: number; suffix: string; label: string }> = ({ end, suffix, label }) => {
  const { ref, value } = useCountUp(end);
  return (
    <div className={styles.metricItem}>
      <span className={styles.metricValue} ref={ref}>
        {value.toLocaleString()}
        {suffix}
      </span>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// ACT 2 — TENSION (pin + parallax): The cost of scattered tools
// ════════════════════════════════════════════════════════════════
const TensionAct: React.FC<{ t: (k: string, f: string, p?: Record<string, string | number>) => string }> = ({ t }) => {
  const actRef = useRef<HTMLElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLLIElement | null)[]>([]);
  const reduced = useReducedMotion();
  const progress = useParallaxProgress(actRef);

  useEffect(() => {
    if (reduced) {
      // Reduced motion: collapse every layer's translate to zero so
      // the visitor still gets the composition, just not the drift.
      [backRef, midRef, frontRef].forEach((r) => {
        if (r.current) r.current.style.transform = '';
      });
      chipRefs.current.forEach((el) => { if (el) el.style.transform = ''; });
      return;
    }
    // Differential parallax rates — small differences between adjacent
    // planes (10–30%) so the eye reads it as depth, not as things
    // sliding around. Reference: scrollcraft devices.md §6.
    if (backRef.current) backRef.current.style.transform = `translate3d(0, ${(-progress * 18).toFixed(2)}px, 0)`;
    if (midRef.current) midRef.current.style.transform = `translate3d(0, ${(-progress * 36).toFixed(2)}px, 0)`;
    if (frontRef.current) frontRef.current.style.transform = `translate3d(0, ${(progress * 24).toFixed(2)}px, 0)`;
    // Chips float with their own subtle rates so they read as drifting
    // objects, not as the same image repeating.
    const rates = [0.5, -0.4, 0.6, -0.3];
    chipRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.transform = `translate3d(${(Math.sin(i) * progress * 16).toFixed(2)}px, ${(-progress * rates[i] * 24).toFixed(2)}px, 0)`;
    });
  }, [progress, reduced]);

  return (
    <section
      id="tension"
      ref={actRef}
      className={styles.tensionAct}
      aria-labelledby="tension-title"
    >
      <div className={styles.tensionStage}>
        {/* Parallax depth: 3 layered planes that move at different rates */}
        <div
          ref={backRef}
          className={styles.tensionLayerBack}
          aria-hidden="true"
        />
        <div
          ref={midRef}
          className={styles.tensionLayerMid}
          aria-hidden="true"
        />
        <div
          ref={frontRef}
          className={styles.tensionLayerFront}
          aria-hidden="true"
        />

        {/* Editorial quote glyph anchored top-right behind the copy.
            Reads as an editorial device rather than decoration. */}
        <span className={styles.tensionQuote} aria-hidden="true">“</span>

        <div className={`${styles.tensionCopy} sc-copy sc-copy--trail`}>
          <p className={styles.tensionKicker}>
            {t('landing.tensionKicker', 'The cost of stitching tools together')}
          </p>
          <h2
            id="tension-title"
            className={`${styles.tensionTitle} sc-display sc-display--lg`}
          >
            {t(
              'landing.tensionTitle',
              'Research shouldn’t live across six windows, three inboxes, and a spreadsheet someone forgot to share.',
            )}
          </h2>
          <p className={`${styles.tensionBody} sc-body`}>
            {t(
              'landing.tensionBody',
              'Submissions pass through email. Reviews happen in private chats. Decisions get buried in a Slack thread. ARS replaces that whole mess with one auditable record.',
            )}
          </p>
        </div>

        {/* Floating "before" chips that parallax at slightly different rates */}
        <ul className={styles.tensionChips} aria-hidden="true">
          <li ref={(el) => (chipRefs.current[0] = el)} className={styles.tensionChip}>email threads</li>
          <li ref={(el) => (chipRefs.current[1] = el)} className={styles.tensionChip}>lost PDFs</li>
          <li ref={(el) => (chipRefs.current[2] = el)} className={styles.tensionChip}>ghost reviewers</li>
          <li ref={(el) => (chipRefs.current[3] = el)} className={styles.tensionChip}>decision drift</li>
        </ul>
      </div>
    </section>
  );
};

// ════════════════════════════════════════════════════════════════
// ACT 3 — TURN (pin + kinetic): Five editorial stages, one by one
// ════════════════════════════════════════════════════════════════
const TurnAct: React.FC<{ t: (k: string, f: string, p?: Record<string, string | number>) => string }> = ({ t }) => {
  return (
    <section
      id="turn"
      className={styles.turnAct}
      aria-labelledby="turn-title"
    >
      <div className={styles.turnStage}>
        <div className={`${styles.scrim} ${styles.scrimBand}`} aria-hidden="true" />

        <div className={styles.turnInner}>
          <div className={styles.turnHeader}>
            <p className={styles.issueLine}>
              {t('landing.workflowKicker', 'The editorial record')}
            </p>
            <h2
              id="turn-title"
              className={`${styles.turnTitle} sc-display sc-display--lg`}
            >
              {t(
                'landing.workflowHeading',
                'Five stages. Clear responsibility at each one.',
                { count: WORKFLOW.length },
              )}
            </h2>
          </div>

          {/* Each stage appears as a card; the sticky stage keeps them in view */}
          <ol className={styles.turnList}>
            {WORKFLOW.map((step) => (
              <li
                key={step.num}
                className={styles.turnItem}
              >
                <span className={styles.turnNum} aria-hidden="true">{step.num}</span>
                <div>
                  <h3 className={styles.turnStepTitle}>{t(step.titleKey, step.titleFallback)}</h3>
                  <p className={styles.turnStepBody}>{t(step.bodyKey, step.bodyFallback)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Publication-flow constellation underneath — always visible */}
        <aside
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
                <div
                  key={`${node.role}-${index}`}
                  className={styles.flowNodeItem}
                  data-role={node.role}
                >
                  <div className={styles.flowNodeCircle}>
                    <Icon size={18} aria-hidden="true" />
                  </div>
                  <span className={styles.flowNodeRole}>{t(node.roleKey, node.roleFallback)}</span>
                  <span className={styles.flowNodeAction}>{t(node.actionKey, node.actionFallback)}</span>
                  {node.noteKey && (
                    <span className={styles.flowNodeNote}>{t(node.noteKey, node.noteFallback ?? '')}</span>
                  )}
                  {index < PUBLICATION_NODES.length - 1 && (
                    <div className={styles.flowConnectorLine} aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
};

// ════════════════════════════════════════════════════════════════
// ACT 4 — SUBSTANCE (pan): Cinematic role-preview window
// ════════════════════════════════════════════════════════════════

// ── Per-role workspace preview content ──────────────────────────
// Each role gets a small set of mockup rows representing the kind of
// surface the visitor would actually see in that workspace. These are
// schematic labels only — no invented metrics or fake data. The role
// schema is the same across all four so they read as one collection
// (scrollcraft devices.md §3: "the schema is what makes it a
// collection instead of a grid").
const ROLE_PREVIEWS: Record<string, ReadonlyArray<{ label: string; status: 'active' | 'idle'; meta: string }>> = {
  researcher: [
    { label: 'Draft: Graphene superconductor v3', status: 'active', meta: 'in review' },
    { label: 'Submission: Optical lattice paper', status: 'idle', meta: 'screening' },
    { label: 'Discover: Quantum error correction', status: 'idle', meta: 'catalog' },
  ],
  reviewer: [
    { label: 'Assignment: Anonymized manuscript #R-284', status: 'active', meta: 'due in 5 days' },
    { label: 'Returned: Recommendation submitted', status: 'idle', meta: 'closed' },
    { label: 'Queue: 3 new eligible manuscripts', status: 'idle', meta: 'awaiting opt-in' },
  ],
  lecturer: [
    { label: 'Group: Advanced Quantum Group', status: 'active', meta: 'live' },
    { label: 'Seminar: Thursday 14:00 — Meet', status: 'idle', meta: 'scheduled' },
    { label: 'Milestone: Phase 2 reports due', status: 'idle', meta: 'next week' },
  ],
  student: [
    { label: 'Phase report: Literature review', status: 'active', meta: 'draft' },
    { label: 'Group: Quantum Algorithms seminar', status: 'idle', meta: 'live' },
    { label: 'Reading list: 4 assigned materials', status: 'idle', meta: 'this week' },
  ],
};

const SubstanceAct: React.FC<{ t: (k: string, f: string, p?: Record<string, string | number>) => string }> = ({ t }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const progress = usePanProgress(stageRef);

  // Calculate horizontal translate manually as a fallback / companion to
  // scrollcraft's [data-sc-pan] device.
  //
  // The rail is laid out as a flex row with N cards. On a wide viewport
  // all 4 cards (~60vw each) fit side-by-side and we should NOT pan.
  // On a narrow viewport the rail overflows and we translate by exactly
  // the amount that overflows the visible width.
  const railOverflowVw = useRailOverflowVw(railRef);
  const translateX = -(progress * railOverflowVw); // vw units

  // The active card is the one closest to the current pan progress.
  // The atmospheric orb (--sc-role-x / --sc-role-accent) tracks the
  // active card so the page visibly shifts its color focus as you pan.
  const activeIndex = Math.round(progress * (ROLE_WORKS.length - 1));
  const activeRole = ROLE_WORKS[activeIndex];

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const rail = railRef.current;
    if (!rail) return;
    const stageRect = stage.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const cardCenter = railRect.left - stageRect.left + (railRect.width / 2);
    const pct = Math.max(0, Math.min(100, (cardCenter / stageRect.width) * 100));
    stage.style.setProperty('--sc-role-x', `${pct}%`);
    if (activeRole) {
      const cssVarName = activeRole.accent.replace('var(', '').replace(')', '');
      stage.style.setProperty('--sc-role-accent', `var(${cssVarName})`);
    }
  }, [progress, activeIndex, activeRole]);

  return (
    <section
      id="substance"
      className={styles.substanceAct}
      aria-labelledby="substance-title"
    >
      <div ref={stageRef} className={styles.substanceStage}>
        <div className={`${styles.scrim} ${styles.scrimBand}`} aria-hidden="true" />

        {/* Pinned header — stays visible while the rail pans */}
        <header className={styles.substanceHeader}>
          <p className={styles.substanceKicker}>
            {t('landing.workspacesKicker', 'Role-specific work')}
          </p>
          <h2
            id="substance-title"
            className={`${styles.substanceTitle} sc-display sc-display--lg`}
          >
            {t(
              'landing.workspacesHeading',
              'A shared platform with focused responsibilities.',
            )}
          </h2>
          <p className={styles.substanceLead}>
            {t(
              'landing.workspacesLead',
              'Each role gets a workspace tuned to the work — not a watered-down view of someone else’s.',
            )}
          </p>
        </header>

        {/* The rail. We drive horizontal transform via JS scroll progress
            (usePanProgress) so it works without the engine. The engine
            is still allowed to attach via the page-level mount if it
            wants to scrub. */}
        <div
          ref={railRef}
          className={styles.substanceRail}
          style={{ transform: `translate3d(${translateX}vw, 0, 0)` }}
        >
          {ROLE_WORKS.map((role) => {
            const Icon = role.icon;
            const preview = ROLE_PREVIEWS[role.role] ?? [];
            const isActive = ROLE_WORKS[activeIndex]?.role === role.role;
            const accentVar = role.accent.replace('var(', '').replace(')', '');
            return (
              <article
                key={role.role}
                className={styles.substanceCard}
                data-role={role.role}
                data-active={isActive}
                style={{ '--accent-role': `var(${accentVar})` } as React.CSSProperties}
              >
                <header className={styles.substanceCardHeader}>
                  <span className={styles.substanceIcon}>
                    <Icon size={24} aria-hidden="true" />
                  </span>
                  <div className={styles.substanceCardMeta}>
                    <p className={styles.substanceCardRole}>{role.role}</p>
                    <h3 className={styles.substanceCardTitle}>
                      {t(role.titleKey, role.fallback)}
                    </h3>
                  </div>
                </header>

                {/* Mini preview surface — schematic rows that mirror
                    the schema of the role's real workspace, no invented
                    numbers. */}
                <div className={styles.substancePreview} aria-hidden="true">
                  {preview.map((row) => (
                    <div
                      key={row.label}
                      className={styles.substancePreviewRow}
                      data-status={row.status}
                    >
                      <span className={styles.substancePreviewDot} />
                      <span className={styles.substancePreviewLabel}>{row.label}</span>
                      <span className={styles.substancePreviewMeta}>{row.meta}</span>
                    </div>
                  ))}
                </div>

                <footer className={styles.substanceCardFooter}>
                  <p className={styles.substanceCardBody}>
                    {t(role.bodyKey, role.bodyFallback)}
                  </p>
                  <span className={styles.substanceCardLink}>
                    Explore <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </footer>
              </article>
            );
          })}
        </div>

        {/* Progress dots — pure DOM, no JS */}
        <div className={styles.panProgress} aria-hidden="true">
          {ROLE_WORKS.map((role, i) => {
            const accentVar = role.accent.replace('var(', '').replace(')', '');
            return (
              <span
                key={role.role}
                className={styles.panDot}
                data-active={activeIndex === i}
                style={activeIndex === i ? { background: `var(${accentVar})` } : undefined}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ════════════════════════════════════════════════════════════════
// ACT 5 — COMMITMENT (flow + spotlight): Public access + final CTA
// ════════════════════════════════════════════════════════════════
const CommitmentSection: React.FC<{ t: (k: string, f: string, p?: Record<string, string | number>) => string }> = ({ t }) => {
  const { ref: boundariesRef, seen: boundariesSeen } = useReveal<HTMLElement>(0.15);
  const { ref: faqRef, seen: faqSeen } = useReveal<HTMLElement>(0.1);
  const { ref: ctaRef, seen: ctaSeen } = useReveal<HTMLElement>(0.2);

  return (
    <div className={styles.commitment}>
      {/* Boundaries — public access carefully defined */}
      <section
        ref={boundariesRef}
        id="boundaries"
        className={`${styles.boundariesSection} ${boundariesSeen ? styles.revealed : ''}`}
        aria-labelledby="boundaries-title"
      >
        <div className={styles.boundariesInner}>
          <div>
            <p className={styles.issueLine}>
              {t('landing.boundariesKicker', 'Public access, carefully defined')}
            </p>
            <h2 id="boundaries-title" className={styles.boundariesTitle}>
              {t(
                'landing.boundariesHeading',
                'The catalog shows approved public work, not the private work behind it.',
              )}
            </h2>
          </div>
          <ul className={styles.boundariesList}>
            {BOUNDARIES.map((key, i) => (
              <li key={key} className={styles.boundariesItem}>
                <CheckCircle2 size={20} aria-hidden="true" />
                <span>{t(key, BOUNDARY_FALLBACKS[i])}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Testimonial — quiet moment between two loud sections */}
      <section
        className={`${styles.testimonialSection} ${boundariesSeen ? styles.revealed : ''}`}
        aria-label={t('landing.testimonialAria', 'Researcher testimonial')}
      >
        <div className={styles.testimonialInner}>
          <span className={styles.testimonialMark} aria-hidden="true">“</span>
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

      {/* FAQ */}
      <section
        ref={faqRef}
        className={`${styles.faqSection} ${faqSeen ? styles.revealed : ''}`}
        aria-labelledby="faq-title"
      >
        <div className={styles.faqInner}>
          <div className={styles.faqIntro}>
            <p className={styles.issueLine}>{t('landing.faqKicker', 'Read before you enter')}</p>
            <h2 id="faq-title" className={styles.faqTitle}>
              {t('landing.faqHeading', 'Essential context for the ARS platform.')}
            </h2>
          </div>
          <div className={styles.faqList}>
            {FAQS.map((faq, i) => (
              <details key={faq.qKey} open={i === 0} className={styles.faqItem}>
                <summary>{t(faq.qKey, faq.qFallback)}</summary>
                <p>{t(faq.aKey, faq.aFallback)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — pointer spotlight overlay */}
      <Spotlight>
        <section
          ref={ctaRef}
          className={`${styles.ctaSection} ${ctaSeen ? styles.revealed : ''}`}
          aria-labelledby="cta-title"
        >
          <p className={styles.issueLine}>
            {t('landing.ctaBody', 'Join hundreds of Vietnamese researchers using ARS to collaborate, review, and publish.')}
          </p>
          <h2 id="cta-title" className={styles.ctaTitle}>
            {t('landing.ctaTitle', 'Ready to take your research to the next level?')}
          </h2>
          <div className={styles.ctaActions}>
            <Link className={styles.primaryButton} to={ROUTES.LOGIN}>
              {t('landing.ctaButton', 'Create a free account')} <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <a className={styles.textLink} href="#workflow" data-scroll-anchor="workflow">
              {t('landing.ctaSecondary', 'Re-read the workflow')} <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </section>
      </Spotlight>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// HEADER & FOOTER (always-on chrome)
// ════════════════════════════════════════════════════════════════
const Header: React.FC<{ t: (k: string, f: string, p?: Record<string, string | number>) => string }> = ({ t }) => {
  const onAnchor = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    smoothScrollTo(target);
    window.history.replaceState(null, '', `#${id}`);
  }, []);

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link className={styles.brand} to={ROUTES.LANDING} aria-label={t('landing.brandAria', 'Academic Research System home')}>
          <img className={styles.brandLogo} src={arsLogo} alt="ARS" />
          <span>{t('landing.brandName', 'Academic Research System')}</span>
        </Link>
        <nav className={styles.navigation} aria-label={t('landing.navAria', 'Landing page navigation')}>
          <a href="#tension" onClick={(e) => onAnchor(e, 'tension')}>
            {t('landing.navTension', 'The problem')}
          </a>
          <a href="#turn" onClick={(e) => onAnchor(e, 'turn')}>
            {t('landing.navTurn', 'The workflow')}
          </a>
          <a href="#substance" onClick={(e) => onAnchor(e, 'substance')}>
            {t('landing.navSubstance', 'Workspaces')}
          </a>
        </nav>
        <div className={styles.headerActions}>
          <LanguageToggle />
          <Link className={styles.loginButton} to={ROUTES.LOGIN}>
            {t('auth.signInButton', 'Log in')} <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
};

const Footer: React.FC<{ t: (k: string, f: string, p?: Record<string, string | number>) => string }> = ({ t }) => (
  <footer className={styles.footer}>
    <div className={styles.footerInner}>
      <Link className={styles.footerBrand} to={ROUTES.LANDING} aria-label={t('landing.brandAria', 'Academic Research System home')}>
        <img src={arsLogo} alt="ARS" />
        <span>{t('landing.brandName', 'Academic Research System')}</span>
      </Link>
      <nav className={styles.footerNav} aria-label={t('landing.footerNavAria', 'Footer navigation')}>
        <Link to={ROUTES.PRIVACY_POLICY}>{t('legal.privacy', 'Privacy')}</Link>
        <Link to={ROUTES.TERMS_OF_SERVICE}>{t('legal.terms', 'Terms')}</Link>
        <Link to={ROUTES.LOGIN}>{t('auth.signInButton', 'Log in')}</Link>
      </nav>
    </div>
    <p className={styles.footerCopy}>
      © 2026 ARS — {t('landing.footerAboutBody', 'Trusted academic platform for research, peer review, and collaboration.')}
    </p>
  </footer>
);

// ════════════════════════════════════════════════════════════════
// PAGE
// ════════════════════════════════════════════════════════════════
export const LandingScrollVideo = () => {
  const t = useT();
  // Local page ref — the scrollcraft engine is intentionally NOT
  // attached here. The engine's global stylesheet sets
  // `[data-sc-cue] { opacity: 0 }` and only toggles it back on when
  // the cue's scroll range is reached; combined with the engine
  // resetting opacity to 0 on every scroll pass, this left every
  // visible text element invisible. We render the page without the
  // engine and drive scroll effects (pan rail, count-up) with local
  // hooks. The engine is still loaded by other pages on the site.
  const pageRef = useRef<HTMLDivElement>(null);

  // Bridge: any link with `data-scroll-anchor="<id>"` smooth-scrolls to it.
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const a = target?.closest('a[data-scroll-anchor]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute('data-scroll-anchor');
      if (!id) return;
      const dest = document.getElementById(id);
      if (!dest) return;
      e.preventDefault();
      smoothScrollTo(dest);
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, []);

  return (
    <div ref={pageRef} className={styles.page}>
      <a className={styles.skipLink} href="#turn">
        {t('landing.skipToContent', 'Skip to main content')}
      </a>

      <Header t={t} />

      {/* Signature move: editorial trace across the whole scroll. */}
      <EditorialTrace />

      <main>
        <HeroAct t={t} />
        <TensionAct t={t} />
        <TurnAct t={t} />
        <SubstanceAct t={t} />
        <CommitmentSection t={t} />
      </main>

      <Footer t={t} />
    </div>
  );
};

export default LandingScrollVideo;
