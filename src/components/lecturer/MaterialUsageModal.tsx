// MaterialUsageModal — opens when a Lecturer clicks the "Used by …" chip on
// a learning material card. Lists every Research Topic and every Phased
// Report that links back to the material's fileUrl, and lets the Lecturer
// click any row to deep-link into Research Topics or Configure Milestones
// with a `highlight=true` flag (so the destination page highlights that
// specific row when it mounts).
//
// Data flow:
//   - The parent (Materials.tsx) has already loaded the cross-reference
//     data (topics + phased reports) for the usage chip — we reuse that
//     already-loaded list. The parent filters by fileUrl and passes the
//     matched rows in as `usedByTopics` / `usedByPhases`.
//   - The parent owns navigation. We just call `onNavigate(target)` with a
//     discriminated payload and the parent picks the right route + builds
//     the URL through `topicRouting.ts`.

import { useEffect, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  ChevronRight,
  ExternalLink,
  FileText,
  Layers,
  X,
} from 'lucide-react';
import type { ResearchTopic, ResearchTopicStatus } from '../../types/research';
import type { PhasedReport } from '../../services/phasedReport.service';
import type { LearningMaterial } from '../../services/learningMaterial.service';
import { StatusBadge } from '../lecturer/StatusBadge';
import styles from './MaterialUsageModal.module.css';

/** Navigation target — the parent decides how to route these. */
export type UsageNavigationTarget =
  | {
      kind: 'topic';
      topicId: number;
    }
  | {
      kind: 'phase';
      topicId: number;
      groupId: number | null;
      phaseNumber: number | null;
    };

export interface MaterialUsageModalProps {
  isOpen: boolean;
  /** The material the user is inspecting. */
  material: LearningMaterial | null;
  /** Topics that already-link this material's fileUrl. */
  usedByTopics: ResearchTopic[];
  /** Phased reports that already-link this material's fileUrl. */
  usedByPhases: PhasedReport[];
  /**
   * True while the parent is still loading the cross-reference data.
   * Renders a skeleton list so the modal doesn't flash empty content.
   */
  loading?: boolean;
  /** Fired when the user clicks a topic or phase row. */
  onNavigate: (target: UsageNavigationTarget) => void;
  onClose: () => void;
}

const formatPhaseTitle = (phase: PhasedReport, fallbackNumber: number): string => {
  const title = phase.milestoneTitle?.trim();
  if (title && title.length > 0) return title;
  if (typeof phase.phaseNumber === 'number') return `Phase ${phase.phaseNumber}`;
  return `Phase ${fallbackNumber}`;
};

const formatDeadline = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const safeTopicId = (t: ResearchTopic): number | null =>
  typeof t.id === 'number' ? t.id : null;

const safeGroupId = (p: PhasedReport): number | null =>
  typeof p.researchGroupId === 'number' ? p.researchGroupId : null;

const safePhaseNumber = (p: PhasedReport): number | null =>
  typeof p.phaseNumber === 'number' ? p.phaseNumber : null;

const safeTopicIdFromPhase = (p: PhasedReport): number | null =>
  typeof p.topicId === 'number' ? p.topicId : null;

const formatTopicTitle = (t: ResearchTopic): string => {
  const title = t.title?.trim();
  if (title && title.length > 0) return title;
  const id = safeTopicId(t);
  return id !== null ? `Topic #${id}` : 'Untitled topic';
};

const formatGroupName = (p: PhasedReport): string => {
  const name = p.groupName?.trim();
  if (name && name.length > 0) return name;
  const gid = safeGroupId(p);
  return gid !== null ? `Group #${gid}` : 'Unassigned group';
};

const formatMaterialLabel = (m: LearningMaterial | null): string => {
  if (!m) return 'Material';
  const title = m.title?.trim();
  if (title && title.length > 0) return title;
  if (typeof m.id === 'number') return `Material #${m.id}`;
  return 'Untitled material';
};

export const MaterialUsageModal = ({
  isOpen,
  material,
  usedByTopics,
  usedByPhases,
  loading = false,
  onNavigate,
  onClose,
}: MaterialUsageModalProps) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // ── Focus management: move focus into the dialog on open, restore it
  //    on close. Required for keyboard / screen-reader users. ───────
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  // ── Escape closes the modal ────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ── Phase rows keyed by their (topicId, groupId, phaseNumber) so the
  //    modal can dedupe and order them deterministically. ──────────
  const sortedPhases = useMemo(() => {
    return [...usedByPhases].sort((a, b) => {
      const topicA = safeTopicIdFromPhase(a) ?? 0;
      const topicB = safeTopicIdFromPhase(b) ?? 0;
      if (topicA !== topicB) return topicA - topicB;
      const groupA = safeGroupId(a) ?? 0;
      const groupB = safeGroupId(b) ?? 0;
      if (groupA !== groupB) return groupA - groupB;
      const phaseA = safePhaseNumber(a) ?? 0;
      const phaseB = safePhaseNumber(b) ?? 0;
      return phaseA - phaseB;
    });
  }, [usedByPhases]);

  if (!isOpen) return null;

  const titleId = 'material-usage-modal-title';
  const totalUses = usedByTopics.length + sortedPhases.length;
  const hasNothing = totalUses === 0 && !loading;

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className={styles.headerRow}>
          <div className={styles.titleBlock}>
            <span className={styles.iconCircle}>
              <Layers size={18} aria-hidden />
            </span>
            <div>
              <h3 id={titleId} className={styles.title}>
                Where this material is used
              </h3>
              <span className={styles.subtitle}>
                {formatMaterialLabel(material)}
              </span>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close usage details"
          >
            <X size={16} aria-hidden />
          </button>
        </header>

        <p className={styles.intro}>
          {loading
            ? 'Scanning your topics and phases for links to this material…'
            : hasNothing
              ? 'Nothing links to this material yet. It is only stored in your library.'
              : `This material is referenced by ${usedByTopics.length} topic(s) and ${sortedPhases.length} phase(s). Click any row to jump straight to it.`}
        </p>

        {loading ? (
          <div className={styles.skeletonList} aria-busy>
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={`sk-${idx}`} className={styles.skeletonRow} />
            ))}
          </div>
        ) : (
          <>
            {usedByTopics.length > 0 && (
              <section className={styles.section}>
                <header className={styles.sectionHeader}>
                  <BookOpen size={14} aria-hidden />
                  <span className={styles.sectionLabel}>
                    Research Topics ({usedByTopics.length})
                  </span>
                </header>
                <ul className={styles.rowList}>
                  {usedByTopics.map((topic) => {
                    const tid = safeTopicId(topic);
                    const status = (topic.status ?? 'OPEN') as ResearchTopicStatus;
                    return (
                      <li key={`topic-${tid ?? 'x'}`}>
                        <button
                          type="button"
                          className={styles.row}
                          onClick={() => {
                            if (tid === null) return;
                            onNavigate({ kind: 'topic', topicId: tid });
                          }}
                          disabled={tid === null}
                          aria-label={`Open topic ${formatTopicTitle(topic)}`}
                          data-testid="usage-topic-row"
                        >
                          <div className={styles.rowMain}>
                            <span className={styles.rowTitle}>
                              {formatTopicTitle(topic)}
                            </span>
                            {topic.description?.trim() && (
                              <span className={styles.rowDesc}>
                                {topic.description}
                              </span>
                            )}
                          </div>
                          <StatusBadge status={status} size="sm" />
                          <ChevronRight
                            size={14}
                            className={styles.rowArrow}
                            aria-hidden
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {sortedPhases.length > 0 && (
              <section className={styles.section}>
                <header className={styles.sectionHeader}>
                  <FileText size={14} aria-hidden />
                  <span className={styles.sectionLabel}>
                    Phases ({sortedPhases.length})
                  </span>
                </header>
                <ul className={styles.rowList}>
                  {sortedPhases.map((phase, idx) => {
                    const phaseNumber = safePhaseNumber(phase);
                    const topicId = safeTopicIdFromPhase(phase);
                    const groupId = safeGroupId(phase);
                    const canNavigate =
                      topicId !== null && phaseNumber !== null;
                    return (
                      <li key={`phase-${topicId ?? 'x'}-${groupId ?? 'x'}-${phaseNumber ?? idx}`}>
                        <button
                          type="button"
                          className={styles.row}
                          onClick={() => {
                            if (!canNavigate) return;
                            onNavigate({
                              kind: 'phase',
                              topicId: topicId as number,
                              groupId,
                              phaseNumber,
                            });
                          }}
                          disabled={!canNavigate}
                          aria-label={`Open phase ${formatPhaseTitle(phase, idx + 1)} for ${formatGroupName(phase)}`}
                          data-testid="usage-phase-row"
                        >
                          <div className={styles.rowMain}>
                            <span className={styles.rowTitle}>
                              {formatPhaseTitle(phase, idx + 1)}
                            </span>
                            <span className={styles.rowDesc}>
                              <span className={styles.rowDescItem}>
                                Topic:{' '}
                                {phase.topicTitle?.trim() ||
                                  (topicId !== null
                                    ? `Topic #${topicId}`
                                    : 'Unknown topic')}
                              </span>
                              <span className={styles.rowDescItem}>
                                Group: {formatGroupName(phase)}
                              </span>
                            </span>
                          </div>
                          <div className={styles.rowMeta}>
                            <Calendar size={11} aria-hidden />
                            <span>
                              Due {formatDeadline(phase.deadlineAt ?? null)}
                            </span>
                          </div>
                          <ChevronRight
                            size={14}
                            className={styles.rowArrow}
                            aria-hidden
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {hasNothing && (
              <div className={styles.emptyState}>
                <AlertTriangle size={18} aria-hidden />
                <span>
                  No research topic or phase currently references this
                  material. You can safely delete it from your library.
                </span>
              </div>
            )}
          </>
        )}

        <footer className={styles.footer}>
          <span className={styles.footerHint}>
            <ExternalLink size={11} aria-hidden /> Click any row to jump there
            with the row highlighted on the destination page.
          </span>
          <button
            type="button"
            className={styles.closeFooterBtn}
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

export default MaterialUsageModal;
