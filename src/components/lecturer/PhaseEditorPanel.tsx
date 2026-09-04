/**
 * PhaseEditorPanel — reusable phase composer for a (topicId, groupId) pair.
 *
 * Encapsulates everything ConfigureMilestones does on its full-page view
 * when a group is selected:
 *
 *   - Loads `ResearchTopicPhase` rows via `researchTopicPhaseService.getByTopic`
 *     and filters to the active group.
 *   - Manages the local `PhaseDraft[]` array (add / remove / reorder).
 *   - Persists via `researchTopicPhaseService.save(topicId, drafts, groupId)`.
 *   - Persists the per-phase `phasedMaterialsUrl` by PUT-ing the
 *     PhasedReport rows that the BE returns from the milestone POST.
 *   - Surfaces validation errors and success messages via the supplied
 *     `onMessage` / `onError` callbacks so the host can render them
 *     outside the panel.
 *
 * The host can render this component in two contexts:
 *   1. Inline (ConfigureMilestones full-page route, ?topicId=X&groupId=Y)
 *   2. Modal (ConfigureMilestones modal-launched from the topic card list)
 *
 * Both contexts share the exact same draft state machine so behaviour is
 * identical. The component is *not* aware of its container — it doesn't
 * open, close, or render any chrome.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Layers,
  Loader,
  Plus,
  Save,
  Trash2,
  X as ClearIcon,
} from 'lucide-react';
import {
  researchTopicPhaseService,
  validatePhaseDrafts,
  toInputDate,
  MAX_PHASES_PER_TOPIC,
  type PhaseDraft,
  type ResearchTopicPhase,
} from '../../services/researchTopicPhase.service';
import { phasedReportService } from '../../services/phasedReport.service';
import {
  MaterialSourcePicker,
  type MaterialSourceValue,
} from './MaterialSourcePicker';
import { formatDisplayDate } from '../../utils/datetime';
import styles from './PhaseEditorPanel.module.css';

/** Build a fresh empty phase draft. */
const makePhase = (nextNumber?: number): PhaseDraft => ({
  phaseNumber:
    typeof nextNumber === 'number' && Number.isFinite(nextNumber) && nextNumber > 0
      ? Math.floor(nextNumber)
      : 1,
  title: '',
  requirements: '',
  assessmentCriteria: '',
  startAt: '',
  endAt: '',
  learningMaterialId: null,
});

// Local selection chip — rendered below the picker so the lecturer
// always sees what they've chosen. Stays in sync with the picker's
// `value` so the chip is just a friendly view of the same state.
const MaterialChip = ({
  selection,
  onClear,
}: {
  selection: MaterialSourceValue | null;
  onClear: () => void;
}) => {
  if (!selection) {
    return (
      <span
        className={styles.materialChipEmpty}
        data-testid="material-chip"
      >
        No material assigned
      </span>
    );
  }
  let label = '';
  if (selection.kind === 'url') label = selection.url;
  else if (selection.kind === 'file') label = selection.fileName;
  else label = `Material #${selection.learningMaterialId}`;
  return (
    <span
      className={styles.materialChip}
      data-testid="material-chip"
      title={
        selection.kind === 'url'
          ? selection.url
          : selection.kind === 'file'
            ? selection.fileUrl
            : `Library #${selection.learningMaterialId}`
      }
    >
      <Check size={12} aria-hidden /> {label}
      <button
        type="button"
        className={styles.materialChipClear}
        onClick={onClear}
        aria-label="Clear material selection"
        data-testid="material-chip-clear"
      >
        <ClearIcon size={12} aria-hidden />
      </button>
    </span>
  );
};

export interface PhaseEditorPanelProps {
  topicId: number;
  groupId: number;
  /**
   * Called when the panel successfully persists the draft set. The host
   * typically uses this to close the modal or refresh parent counters
   * (e.g. the "N phases" chips on the topic card list).
   */
  onSaved?: (phases: ResearchTopicPhase[]) => void;
  /** Optional compact variant — hides the heading + add-phase button when true. */
  compact?: boolean;
  /**
   * Phase number to visually highlight when the panel mounts. Used by
   * the Materials "Used by" deep link — when the user clicks a phase
   * row in the usage modal, they land here with `?phase=N&highlight=true`
   * and the matching draft gets a pulse + tinted background. `null`
   * disables highlighting.
   */
  highlightPhaseNumber?: number | null;
}

export const PhaseEditorPanel = ({
  topicId,
  groupId,
  onSaved,
  compact = false,
  highlightPhaseNumber = null,
}: PhaseEditorPanelProps) => {
  const [phases, setPhases] = useState<ResearchTopicPhase[]>([]);
  const [drafts, setDrafts] = useState<PhaseDraft[]>([makePhase()]);
  const [saving, setSaving] = useState(false);
  const [loadingPhases, setLoadingPhases] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Load phases for (topicId, groupId) ────────────────────────
  const loadPhases = useCallback(async () => {
    setLoadingPhases(true);
    setError(null);
    setMessage(null);
    try {
      const apiPhases = await researchTopicPhaseService.getByTopic(topicId);
      const filtered = apiPhases.filter(
        (p) =>
          p.report?.researchGroupId === groupId ||
          (typeof p.report?.researchGroupId !== 'number' &&
            p.topicId === topicId),
      );

      // Reverse-map material URL → LearningMaterialId. We only get the
      // URL on the BE side; the LearningMaterial table is the source of
      // truth for picking, but the BE persists only the URL.
      const { learningMaterialService } = await import(
        '../../services/learningMaterial.service'
      );
      const allMaterials = await learningMaterialService.getAll();
      const urlToId = new Map<string | null, number>();
      for (const m of allMaterials) {
        const id = typeof m.id === 'number' ? m.id : -1;
        if (id > 0) urlToId.set(m.fileUrl ?? null, id);
      }
      const assignmentMap = new Map<number, number | null>();
      for (const phase of filtered) {
        const url = phase.report?.phasedMaterialsUrl ?? null;
        assignmentMap.set(phase.phaseNumber, urlToId.get(url) ?? null);
      }

      setPhases(filtered);
      setDrafts(
        filtered.length > 0
          ? filtered.map((p) => ({
              phaseNumber:
                typeof p.phaseNumber === 'number' && p.phaseNumber > 0
                  ? p.phaseNumber
                  : 1,
              title: p.title,
              requirements: p.requirements,
              assessmentCriteria: p.assessmentCriteria,
              startAt: p.startAt ? toInputDate(p.startAt) : '',
              endAt: p.endAt ? toInputDate(p.endAt) : '',
              learningMaterialId:
                assignmentMap.get(p.phaseNumber) ?? null,
            }))
          : [makePhase()],
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load existing phases for this group.',
      );
    } finally {
      setLoadingPhases(false);
    }
  }, [topicId, groupId]);

  useEffect(() => {
    void loadPhases();
  }, [loadPhases]);

  // ── Scroll into view when arriving from the Materials "Used by"
  //    modal with `?phase=N&highlight=true`. We wait until the loading
  //    state clears so the row has actually rendered before scrolling. ─
  useEffect(() => {
    if (highlightPhaseNumber === null) return;
    if (loadingPhases) return;
    const target = document.querySelector<HTMLElement>(
      `[data-phase-number="${highlightPhaseNumber}"][data-highlighted="true"]`,
    );
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightPhaseNumber, loadingPhases, drafts]);

  // ── Draft editor helpers ──────────────────────────────────────
  const updateDraft = useCallback(
    (
      index: number,
      key: keyof PhaseDraft,
      rawValue: string | number | null,
    ) => {
      setDrafts((prev) => {
        const value =
          key === 'learningMaterialId'
            ? rawValue === 'null' || rawValue === '' || rawValue == null
              ? null
              : typeof rawValue === 'number'
                ? rawValue
                : Number(rawValue)
            : rawValue;
        return prev.map((d, i) =>
          i === index ? { ...d, [key]: value as never } : d,
        );
      });
      setError(null);
      setMessage(null);
    },
    [],
  );

  const addPhase = useCallback(() => {
    setDrafts((prev) => {
      if (prev.length >= MAX_PHASES_PER_TOPIC) return prev;
      const lastNumber =
        prev.length > 0 ? prev[prev.length - 1]?.phaseNumber ?? 0 : 0;
      return [...prev, makePhase(lastNumber + 1)];
    });
    setError(null);
    setMessage(null);
  }, []);

  const removePhase = useCallback((index: number) => {
    setDrafts((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      // Renumber so the remaining drafts keep contiguous, 1-based phase
      // numbers — preserves the BE contract and keeps the highlight
      // target stable when the lecturer deletes a phase.
      return next.map((d, i) => ({ ...d, phaseNumber: i + 1 }));
    });
    setError(null);
    setMessage(null);
  }, []);

  const movePhase = useCallback((index: number, direction: -1 | 1) => {
    setDrafts((prev) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [
        updated[newIndex],
        updated[index],
      ];
      // Keep phase numbers contiguous after a swap so the BE contract
      // stays valid on save.
      return updated.map((d, i) => ({ ...d, phaseNumber: i + 1 }));
    });
    setError(null);
    setMessage(null);
  }, []);

  // ── Material picker wiring ────────────────────────────────────
  // The picker emits a `MaterialSourceValue`. We translate it back into
  // the draft's `learningMaterialId` so the existing PUT-based
  // persistence path stays unchanged.
  const handleMaterialChange = useCallback(
    (index: number, selection: MaterialSourceValue | null) => {
      setDrafts((prev) =>
        prev.map((d, i) => {
          if (i !== index) return d;
          if (!selection) {
            return { ...d, learningMaterialId: null };
          }
          // For 'library' picks we have the canonical id. For 'link' /
          // 'upload' the BE will eventually persist the URL, but the
          // draft column is `learningMaterialId` (a FK). We send `null`
          // here and rely on the second-step PUT to attach the URL.
          return {
            ...d,
            learningMaterialId:
              selection.kind === 'library'
                ? selection.learningMaterialId
                : null,
          };
        }),
      );
      setError(null);
      setMessage(null);
    },
    [],
  );

  // ── Save ──────────────────────────────────────────────────────
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePhaseDrafts(drafts);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      // Step 1 — milestone POST.
      const result = await researchTopicPhaseService.save(
        topicId,
        drafts,
        groupId,
      );
      const apiPhases = result.phases.filter(
        (p) =>
          p.report?.researchGroupId === groupId ||
          (typeof p.report?.researchGroupId !== 'number' &&
            p.topicId === topicId),
      );

      // Step 2 — per-phase material PUT. The picker keeps the URL
      // (link/upload) or the library id (library) on the draft. The
      // existing PUT path persists the matching URL via the
      // PhasedReport.phasedMaterialsUrl column. See
      // `researchTopicPhaseService.save` for the round-trip contract.
      const materialErrors: string[] = [];
      await Promise.all(
        drafts.map((draft, index) => {
          const reportRow = apiPhases.find(
            (p) => p.phaseNumber === index + 1,
          );
          const reportId = reportRow?.report?.phasedReportId;
          if (!reportId || draft.learningMaterialId == null) {
            return Promise.resolve();
          }
          const materialUrl =
            reportRow.report?.phasedMaterialsUrl ?? null;
          return phasedReportService
            .update(reportId, {
              researchGroupId: reportRow.report?.researchGroupId ?? null,
              groupMemberId: reportRow.report?.groupMemberId ?? null,
              reportFileUrl: reportRow.report?.reportFileUrl ?? null,
              capacityEvaluation:
                reportRow.report?.capacityEvaluation ?? null,
              finalOutcomeEvaluation:
                reportRow.report?.finalOutcomeEvaluation ?? null,
              lectureFeedback: reportRow.report?.lectureFeedback ?? null,
              phaseNumber: reportRow.report?.phaseNumber ?? null,
              milestoneTitle: reportRow.report?.milestoneTitle ?? null,
              status: reportRow.report?.status ?? null,
              submittedAt: reportRow.report?.submittedAt ?? null,
              phasedMaterialsUrl: materialUrl,
              topicId: reportRow.report?.topicId ?? null,
              requirements: reportRow.report?.requirements ?? null,
              assessmentCriteria:
                reportRow.report?.assessmentCriteria ?? null,
              startDate: reportRow.report?.startDate ?? null,
            })
            .catch((err) => {
              materialErrors.push(
                `Phase ${index + 1} material: ${
                  err instanceof Error ? err.message : 'failed'
                }`,
              );
            });
        }),
      );

      setPhases(apiPhases);
      if (materialErrors.length === 0) {
        setMessage('Milestones saved successfully.');
      } else {
        setMessage('Milestones saved. Some material assignments could not be saved (see below).');
        setError(materialErrors.join('\n'));
      }
      onSaved?.(apiPhases);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save phases.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadingPhases) {
    return (
      <div className={styles.loadingRow}>
        <Loader size={16} className={styles.spinningIcon} aria-hidden />{' '}
        Loading existing phases…
      </div>
    );
  }

  return (
    <div className={styles.panel} data-testid="phase-editor-panel">
      {highlightPhaseNumber !== null && (
        <div
          className={styles.highlightNotice}
          role="status"
          data-testid="phase-highlight-notice"
        >
          Showing Phase {highlightPhaseNumber}, linked from your Materials
          library. Edit it freely — your changes auto-save on Submit.
        </div>
      )}
      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={16} aria-hidden /> {error}
        </div>
      )}
      {message && (
        <div className={styles.successHint} role="status">
          <Check size={14} aria-hidden /> {message}
        </div>
      )}

      {!compact && (
        <div className={styles.phaseLimitBanner} role="status">
          <span>
            <Layers size={13} aria-hidden />{' '}
            {drafts.length} phase{drafts.length !== 1 ? 's' : ''} defined
          </span>
        </div>
      )}

      <form onSubmit={save} className={styles.phasesForm}>
        {drafts.map((draft, index) => {
          const materialSelection: MaterialSourceValue | null =
            draft.learningMaterialId != null
              ? {
                  kind: 'library',
                  learningMaterialId: draft.learningMaterialId,
                }
              : null;
          // The phase number is preserved on the draft itself so a deep
          // link highlight survives add / remove / reorder without
          // drifting to a different row.
          const isHighlighted =
            highlightPhaseNumber !== null &&
            draft.phaseNumber === highlightPhaseNumber;
          return (
            <article
              key={`${topicId}-${groupId}-${index}`}
              data-phase-number={draft.phaseNumber}
              data-highlighted={isHighlighted ? 'true' : undefined}
              className={`${styles.phaseEditor} ${isHighlighted ? styles.phaseEditorHighlighted : ''}`}
            >
              <header className={styles.phaseEditorHead}>
                <h3 className={styles.phaseEditorTitle}>
                  <span className={styles.phaseIndexChip}>{index + 1}</span>
                  {draft.title || `Phase ${index + 1}`}
                </h3>
                <div className={styles.phaseHeadActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => movePhase(index, -1)}
                    disabled={index === 0}
                    title="Move phase up"
                    aria-label={`Move phase ${index + 1} up`}
                  >
                    <ChevronRight
                      size={14}
                      style={{ transform: 'rotate(180deg)' }}
                      aria-hidden
                    />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => movePhase(index, 1)}
                    disabled={index === drafts.length - 1}
                    title="Move phase down"
                    aria-label={`Move phase ${index + 1} down`}
                  >
                    <ChevronRight size={14} aria-hidden />
                  </button>
                  {drafts.length > 1 && (
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => removePhase(index)}
                      title={`Remove phase ${index + 1}`}
                      aria-label={`Remove phase ${index + 1}`}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  )}
                </div>
              </header>

              <div className={styles.formGroup}>
                <label
                  className={styles.formLabel}
                  htmlFor={`phase-title-${index}`}
                >
                  Phase Title *
                </label>
                <input
                  id={`phase-title-${index}`}
                  type="text"
                  className={styles.formInput}
                  value={draft.title}
                  onChange={(e) =>
                    updateDraft(index, 'title', e.target.value)
                  }
                  placeholder={`e.g. Phase ${index + 1}: Literature Review`}
                  required
                  data-testid={`phase-title-${index}`}
                />
              </div>

              <div className={styles.formGroup}>
                <label
                  className={styles.formLabel}
                  htmlFor={`phase-req-${index}`}
                >
                  Requirements
                  <span className={styles.optionalBadge}>Optional</span>
                </label>
                <textarea
                  id={`phase-req-${index}`}
                  className={styles.formTextarea}
                  value={draft.requirements}
                  onChange={(e) =>
                    updateDraft(index, 'requirements', e.target.value)
                  }
                  rows={2}
                  placeholder="Describe what the group must deliver for this phase."
                  data-testid={`phase-req-${index}`}
                />
              </div>

              <div className={styles.formGroup}>
                <label
                  className={styles.formLabel}
                  htmlFor={`phase-crit-${index}`}
                >
                  Assessment Criteria
                  <span className={styles.optionalBadge}>Optional</span>
                </label>
                <textarea
                  id={`phase-crit-${index}`}
                  className={styles.formTextarea}
                  value={draft.assessmentCriteria}
                  onChange={(e) =>
                    updateDraft(index, 'assessmentCriteria', e.target.value)
                  }
                  rows={2}
                  placeholder="Describe how this phase will be evaluated."
                  data-testid={`phase-crit-${index}`}
                />
              </div>

              <div className={styles.phaseEditorRow}>
                <div className={styles.formGroup}>
                  <label
                    className={styles.formLabel}
                    htmlFor={`phase-start-${index}`}
                  >
                    Start Date
                    <span className={styles.optionalBadge}>Optional</span>
                  </label>
                  <input
                    id={`phase-start-${index}`}
                    type="datetime-local"
                    className={styles.formInput}
                    value={draft.startAt}
                    onChange={(e) =>
                      updateDraft(index, 'startAt', e.target.value)
                    }
                    data-testid={`phase-start-${index}`}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label
                    className={styles.formLabel}
                    htmlFor={`phase-end-${index}`}
                  >
                    Deadline *
                  </label>
                  <input
                    id={`phase-end-${index}`}
                    type="datetime-local"
                    className={styles.formInput}
                    value={draft.endAt}
                    onChange={(e) =>
                      updateDraft(index, 'endAt', e.target.value)
                    }
                    required
                    data-testid={`phase-end-${index}`}
                  />
                </div>
              </div>

              {/* Material assignment — three-source picker + chip. */}
              <div className={styles.formGroup}>
                <label
                  className={styles.formLabel}
                  htmlFor={`phase-material-${index}`}
                >
                  Assigned Material
                  <span className={styles.optionalBadge}>Optional</span>
                </label>
                <MaterialSourcePicker
                  value={materialSelection}
                  onChange={(next) => handleMaterialChange(index, next)}
                />
                <div className={styles.materialChipRow}>
                  <MaterialChip
                    selection={materialSelection}
                    onClear={() => handleMaterialChange(index, null)}
                  />
                </div>
              </div>

              {phases[index]?.locked && (
                <p className={styles.phaseLockedNote}>
                  <AlertTriangle size={12} aria-hidden /> This phase is
                  locked because a report has been submitted.
                </p>
              )}
            </article>
          );
        })}

        <div className={styles.saveSummary} aria-live="polite">
          <strong>{drafts.length}</strong>
          <span>phase{drafts.length !== 1 ? 's' : ''} ·</span>
          <strong>Group #{groupId}</strong>
          <span>· Last deadline</span>
          <strong>
            {(() => {
              const lastEnd = drafts
                .map((d) => d.endAt)
                .filter((d) => d && !Number.isNaN(new Date(d).getTime()))
                .sort()
                .pop();
              if (!lastEnd) return 'not set';
              return formatDisplayDate(lastEnd, 'vi');
            })()}
          </strong>
        </div>

        <div className={styles.formActions}>
          {!compact && (
            <button
              type="button"
              className={styles.addPhaseBtn}
              onClick={addPhase}
              disabled={drafts.length >= MAX_PHASES_PER_TOPIC}
              data-testid="add-phase-btn"
            >
              <Plus size={16} aria-hidden /> Add phase
            </button>
          )}
          <button
            type="submit"
            className={styles.saveBtn}
            disabled={saving || drafts.length === 0}
            data-testid="save-phases-btn"
          >
            {saving ? (
              <Loader
                size={16}
                className={styles.spinningIcon}
                aria-hidden
              />
            ) : (
              <Save size={16} aria-hidden />
            )}
            {saving ? 'Saving…' : 'Save phase plan'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PhaseEditorPanel;
