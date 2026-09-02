/**
 * ConfigureMilestones — Lecturer topic-scoped phase-plan workspace.
 *
 * This page is the canonical surface for a Lecturer to define the reporting
 * phases for ONE research topic.
 *
 * URL contract:
 *   /configure-milestones?topicId=<number>[&groupId=<number>]
 *
 * The topicId is the only URL source of truth. The page re-fetches the
 * topic on every mount and never falls back to a default or unrelated topic.
 * Invalid or missing ids produce a recoverable error state.
 *
 * After a topic is loaded, the lecturer selects one of the groups assigned
 * to that topic before configuring phases. Group selection is URL-bound
 * (refresh-safe). There is no auto-selection of the first group.
 *
 * Phase definitions are saved via POST /api/PhasedReport/topic-milestones.
 * The BE Swagger contract does not document a fixed phase limit. The lecturer
 * defines the phase count freely (1..N). `requirements`, `assessmentCriteria`,
 * and `startAt` are not yet persisted by the backend — they render as
 * read-only inputs with a BackendGapBanner until the BE ships them.
 *
 * All data is live from the API. No mock rows. No hardcoded "Phase 1..5"
 * templates unless returned by the BE.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  Check,
  Info,
  Layers,
  Loader,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users,
} from 'lucide-react';
import { researchTopicService, type ResearchTopic } from '../../services/researchTopic.service';
import { researchGroupService, type ResearchGroup } from '../../services/researchGroup.service';
import {
  researchTopicPhaseService,
  validatePhaseDrafts,
  type PhaseDraft,
  type ResearchTopicPhase,
  toInputDate,
  MAX_PHASES_PER_TOPIC,
} from '../../services/researchTopicPhase.service';
import { learningMaterialService, type LearningMaterial } from '../../services/learningMaterial.service';
import { phasedReportService } from '../../services/phasedReport.service';
import { InlineNotice } from '../../components/InlineNotice/InlineNotice';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { ROUTES } from '../../routes/paths';
import { parseTopicIdFromSearch } from '../../utils/topicRouting';
import styles from './ConfigureMilestones.module.css';

/** Build a fresh empty phase draft. */
const makePhase = (_number: number): PhaseDraft => ({
  title: '',
  requirements: '',
  assessmentCriteria: '',
  startAt: '',
  endAt: '',
  learningMaterialId: null,
});

// ─── State shapes ────────────────────────────────────────────────────────────

type PageState =
  | { kind: 'loading' }
  | { kind: 'missing-id' }
  | { kind: 'invalid-id' }
  | { kind: 'topic-not-found'; topicId: number }
  | {
      kind: 'ready';
      topic: ResearchTopic;
      groups: ResearchGroup[];
      selectedGroupId: number | null;
      phases: ResearchTopicPhase[];
      drafts: PhaseDraft[];
      saving: boolean;
      loadingPhases: boolean;
      materials: LearningMaterial[];
      loadingMaterials: boolean;
      message: string | null;
      error: string | null;
    };

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
};

// ─── Component ─────────────────────────────────────────────────────────────

export const ConfigureMilestones = () => {
  const [searchParams] = useSearchParams();
  const { topicId, error: topicIdError } = parseTopicIdFromSearch(searchParams);

  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' });

  // ── Load topic on mount / topicId change ──────────────────────────────
  const loadTopic = useCallback(async (tid: number) => {
    setPageState({ kind: 'loading' });
    try {
      const topic = await researchTopicService.getById(tid);
      // Also load all groups so we can filter the ones assigned to this topic.
      const allGroups = await researchGroupService.getAll();
      const assignedGroups = allGroups.filter(
        (g) => typeof g.topicId === 'number' && g.topicId === tid,
      );
      setPageState({
        kind: 'ready',
        topic,
        groups: assignedGroups,
        selectedGroupId: null,
        phases: [],
        drafts: [],
        saving: false,
        loadingPhases: false,
        materials: [],
        loadingMaterials: false,
        message: null,
        error: null,
      });
    } catch {
      setPageState({ kind: 'topic-not-found', topicId: tid });
    }
  }, []);

  useEffect(() => {
    if (topicIdError === 'missing') {
      setPageState({ kind: 'missing-id' });
      return;
    }
    if (topicIdError === 'invalid') {
      setPageState({ kind: 'invalid-id' });
      return;
    }
    if (topicId !== null) {
      void loadTopic(topicId);
    }
  }, [topicId, topicIdError, loadTopic]);

  // ── Load phases for selected group ──────────────────────────────────────
  const loadPhases = useCallback(
    async (tid: number, groupId: number) => {
      setPageState((prev) => {
        if (prev.kind !== 'ready') return prev;
        return {
          ...prev,
          loadingPhases: true,
          loadingMaterials: true,
          error: null,
          message: null,
        };
      });

      // Fire phases + materials in parallel. Assignments are derived from the
      // PhasedReport rows returned by getByTopic (via phasedMaterialsUrl) —
      // no separate PhaseMaterial API call is needed.
      const [phasesResult, materialsResult] = await Promise.allSettled([
        researchTopicPhaseService.getByTopic(tid),
        learningMaterialService.getAll(),
      ]);

      // Extract phases for the selected group.
      const phases =
        phasesResult.status === 'fulfilled'
          ? (phasesResult.value as ResearchTopicPhase[]).filter(
              (p) =>
                p.report?.researchGroupId === groupId ||
                (typeof p.report?.researchGroupId !== 'number' &&
                  p.topicId === tid),
            )
          : [];

      // Sort materials newest-first by createdAt for the dropdown.
      const materials =
        materialsResult.status === 'fulfilled'
          ? [...(materialsResult.value as LearningMaterial[])].sort((a, b) => {
              const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return bTime - aTime; // newest first
            })
          : [];

      // Build a reverse map: materialUrl → materialId so we can resolve
      // phasedMaterialsUrl (a URL) back to an id for the dropdown.
      const materialUrlToId = new Map<string | null, number>();
      for (const m of materials) {
        const id = typeof m.id === 'number' ? m.id : -1;
        if (id > 0) materialUrlToId.set(m.fileUrl ?? null, id);
      }

      // Derive existing material assignments from PhasedReport.phasedMaterialsUrl.
      const assignmentMap = new Map<number, number | null>();
      for (const phase of phases) {
        const url = phase.report?.phasedMaterialsUrl ?? null;
        assignmentMap.set(phase.phaseNumber, materialUrlToId.get(url) ?? null);
      }

      const drafts =
        phases.length > 0
          ? phases.map((p) => ({
              title: p.title,
              requirements: p.requirements,
              assessmentCriteria: p.assessmentCriteria,
              startAt: p.startAt ? toInputDate(p.startAt) : '',
              endAt: p.endAt ? toInputDate(p.endAt) : '',
              learningMaterialId:
                assignmentMap.get(p.phaseNumber) ?? null,
            }))
          : [makePhase(1)];

      const phaseError =
        phasesResult.status === 'rejected'
          ? phasesResult.reason instanceof Error
            ? phasesResult.reason.message
            : 'Unable to load phases.'
          : null;

      setPageState((prev) => {
        if (prev.kind !== 'ready') return prev;
        return {
          ...prev,
          phases,
          drafts,
          materials,
          loadingPhases: false,
          loadingMaterials: false,
          error: phaseError,
        };
      });
    },
    [],
  );

  // ── Select a group ─────────────────────────────────────────────────────
  const selectGroup = useCallback(
    (groupId: number) => {
      setPageState((prev) => {
        if (prev.kind !== 'ready') return prev;
        return { ...prev, selectedGroupId: groupId, message: null, error: null };
      });
      if (topicId !== null) {
        void loadPhases(topicId, groupId);
      }
    },
    [topicId, loadPhases],
  );

  // ── Phase composer helpers ──────────────────────────────────────────────
  const updateDraft = (
    index: number,
    key: keyof PhaseDraft,
    rawValue: string | number | null,
  ) => {
    setPageState((prev) => {
      if (prev.kind !== 'ready') return prev;
      const value =
        key === 'learningMaterialId'
          ? rawValue === 'null' || rawValue === '' || rawValue == null
            ? null
            : typeof rawValue === 'number'
              ? rawValue
              : Number(rawValue)
          : rawValue;
      return {
        ...prev,
        drafts: prev.drafts.map((d, i) => (i === index ? { ...d, [key]: value } : d)),
        error: null,
        message: null,
      };
    });
  };

  const addPhase = () => {
    setPageState((prev) => {
      if (prev.kind !== 'ready') return prev;
      if (prev.drafts.length >= MAX_PHASES_PER_TOPIC) return prev;
      return {
        ...prev,
        drafts: [...prev.drafts, makePhase(prev.drafts.length + 1)],
        error: null,
        message: null,
      };
    });
  };

  const removePhase = (index: number) => {
    setPageState((prev) => {
      if (prev.kind !== 'ready') return prev;
      if (prev.drafts.length <= 1) return prev;
      return {
        ...prev,
        drafts: prev.drafts.filter((_, i) => i !== index),
        error: null,
        message: null,
      };
    });
  };

  const movePhase = (index: number, direction: -1 | 1) => {
    setPageState((prev) => {
      if (prev.kind !== 'ready') return prev;
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.drafts.length) return prev;
      const updated = [...prev.drafts];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return { ...prev, drafts: updated, error: null, message: null };
    });
  };

  // ── Save ────────────────────────────────────────────────────────────────
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (topicId === null) return;
    const state = pageState;
    if (state.kind !== 'ready') return;
    const { selectedGroupId, drafts } = state;

    const validation = validatePhaseDrafts(drafts);
    if (validation) {
      setPageState((prev) => {
        if (prev.kind !== 'ready') return prev;
        return { ...prev, error: validation };
      });
      return;
    }

    setPageState((prev) => {
      if (prev.kind !== 'ready') return prev;
      return { ...prev, saving: true, error: null, message: null };
    });

    try {
      // Step 1 — save milestone definitions (title, deadline, phase order).
      const result = await researchTopicPhaseService.save(
        topicId,
        drafts,
        selectedGroupId,
      );
      const apiPhases = result.phases.filter(
        (p) =>
          p.report?.researchGroupId === selectedGroupId ||
          typeof p.report?.researchGroupId !== 'number',
      );

      // Step 2 — persist each phase's material by updating the PhasedReport row
      // with its phasedMaterialsUrl. The BE supports phasedMaterialsUrl on
      // PhasedReportCreateRequest/UpdateRequest. result.phases already contains
      // the raw PhasedReport (with phasedReportId) from the topic-milestones
      // POST response, so no extra fetch is needed.
      const materialErrors: string[] = [];
      await Promise.all(
        drafts.map((draft, index) => {
          const reportRow = apiPhases.find(
            (p) => p.phaseNumber === index + 1,
          );
          const reportId = reportRow?.report?.phasedReportId;
          if (!reportId) {
            // No report row for this phase — nothing to update.
            return Promise.resolve();
          }
          // Resolve the selected material ID to a URL (null = unassign).
          const materialUrl =
            draft.learningMaterialId != null
              ? materials.find((m) => (m.id as number) === draft.learningMaterialId)?.fileUrl ?? null
              : null;
          return phasedReportService
            .update(reportId, {
              researchGroupId: reportRow.report?.researchGroupId ?? null,
              groupMemberId: reportRow.report?.groupMemberId ?? null,
              reportFileUrl: reportRow.report?.reportFileUrl ?? null,
              capacityEvaluation: reportRow.report?.capacityEvaluation ?? null,
              finalOutcomeEvaluation: reportRow.report?.finalOutcomeEvaluation ?? null,
              lectureFeedback: reportRow.report?.lectureFeedback ?? null,
              phaseNumber: reportRow.report?.phaseNumber ?? null,
              milestoneTitle: reportRow.report?.milestoneTitle ?? null,
              status: reportRow.report?.status ?? null,
              submittedAt: reportRow.report?.submittedAt ?? null,
              phasedMaterialsUrl: materialUrl,
            })
            .catch((err) => {
              materialErrors.push(
                `Phase ${index + 1} material: ${err instanceof Error ? err.message : 'failed'}`,
              );
            });
        }),
      );

      setPageState((prev) => {
        if (prev.kind !== 'ready') return prev;
        return {
          ...prev,
          saving: false,
          phases: apiPhases,
          message:
            materialErrors.length > 0
              ? `Milestones saved. Some material assignments could not be saved (see below).`
              : 'Milestones saved successfully.',
          error:
            materialErrors.length > 0 ? materialErrors.join('\n') : null,
        };
      });
    } catch (err) {
      setPageState((prev) => {
        if (prev.kind !== 'ready') return prev;
        return {
          ...prev,
          saving: false,
          error: err instanceof Error ? err.message : 'Unable to save phases.',
        };
      });
    }
  };

  // ── Render error states ────────────────────────────────────────────────
  if (topicIdError === 'missing' || topicIdError === 'invalid') {
    return (
      <div className={styles.configureMilestones}>
        <PageHeader
          eyebrow="LECTURER WORKSPACE"
          title="Configure reporting phases"
          description="Select a research topic from the Research Topics page, then click Manage Phases to configure its reporting milestones."
          actions={
            <Button
              variant="outline"
              size="md"
              leftIcon={<ArrowLeft size={14} />}
              onClick={() => window.history.back()}
            >
              Back
            </Button>
          }
          accent="var(--ars-lecturer)"
        />
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={16} aria-hidden />
          <span>
            {topicIdError === 'missing'
              ? 'No topic was selected. Please open the Research Topics page and click Manage Phases on a topic.'
              : 'The topic ID in the URL is invalid. Please open the Research Topics page and try again.'}
          </span>
        </div>
      </div>
    );
  }

  if (pageState.kind === 'topic-not-found') {
    return (
      <div className={styles.configureMilestones}>
        <PageHeader
          eyebrow="LECTURER WORKSPACE"
          title="Topic not found"
          description={`The topic with ID ${pageState.topicId} could not be loaded.`}
          actions={
            <Button
              variant="outline"
              size="md"
              leftIcon={<ArrowLeft size={14} />}
              onClick={() => window.history.back()}
            >
              Back
            </Button>
          }
          accent="var(--ars-lecturer)"
        />
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={16} aria-hidden />
          <span>
            This topic may have been deleted or you may not have permission to
            view it.
          </span>
        </div>
      </div>
    );
  }

  if (pageState.kind === 'loading') {
    return (
      <div className={styles.configureMilestones}>
        <div className={styles.breadcrumbs}>
          Home &gt; <span className={styles.activeBreadcrumb}>Topic phases</span>
        </div>
        <div className={styles.phasesEmpty}>
          <Loader size={16} className={styles.spinningIcon} aria-hidden />{' '}
          Loading topic…
        </div>
      </div>
    );
  }

  // ── Ready state ───────────────────────────────────────────────────────
  if (pageState.kind !== 'ready') {
    // All other states are handled above via early returns.
    // This guard narrows the type for the destructuring below.
    return null;
  }

  const readyState = pageState as {
    kind: 'ready';
    topic: ReturnType<typeof researchTopicService.getById> extends Promise<infer T> ? T : never;
    groups: ResearchGroup[];
    selectedGroupId: number | null;
    phases: ResearchTopicPhase[];
    drafts: PhaseDraft[];
    saving: boolean;
    loadingPhases: boolean;
    materials: LearningMaterial[];
    loadingMaterials: boolean;
    message: string | null;
    error: string | null;
  };
  const {
    topic,
    groups,
    selectedGroupId,
    phases,
    drafts,
    saving,
    loadingPhases,
    materials,
    loadingMaterials,
    message,
    error,
  } = readyState;

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;
  const canSave = !saving && !loadingPhases && drafts.length > 0;

  return (
    <div className={styles.configureMilestones}>
      {/* ── Breadcrumbs ─────────────────────────────────────────────── */}
      <div className={styles.breadcrumbs}>
        Home &gt;{' '}
        <Link to={ROUTES.LECTURER_RESEARCH_TOPICS} className={styles.backLink}>
          Research Topics
        </Link>{' '}
        &gt; <span className={styles.activeBreadcrumb}>Topic phases</span>
      </div>

      {/* ── Topic context card ──────────────────────────────────────── */}
      <section className={styles.configCard}>
        <div className={styles.cardHeader}>
          <div className={styles.headerTitleRow}>
            <span className={styles.headerLabel}>SELECTED RESEARCH TOPIC</span>
            <h1 className={styles.pageTitle}>{topic.title ?? `Topic #${topic.id}`}</h1>
          </div>
          <div className={styles.topicMetaRow}>
            <StatusBadge status={topic.status ?? 'OPEN'} />
            <span className={styles.topicMetaChip}>
              <Users size={12} aria-hidden />
              {groups.length} group{groups.length !== 1 ? 's' : ''} assigned
            </span>
          </div>
        </div>

        {/* Topic description — shown only when present */}
        {topic.description && (
          <div className={styles.topicDescRow}>
            <Info size={13} aria-hidden />
            <p className={styles.topicDescText}>{topic.description}</p>
          </div>
        )}

        {/* Topic deadlines / dates */}
        {(topic.createdAt || topic.updatedAt) && (
          <div className={styles.topicDatesRow}>
            {topic.createdAt && (
              <span>
                <Calendar size={12} aria-hidden /> Created{' '}
                {formatDate(topic.createdAt)}
              </span>
            )}
            {topic.updatedAt && (
              <span>
                <RefreshCw size={12} aria-hidden /> Updated{' '}
                {formatDate(topic.updatedAt)}
              </span>
            )}
          </div>
        )}
      </section>

      {/* ── Group selection ─────────────────────────────────────────── */}
      <section className={styles.configCard}>
        <div className={styles.cardHeader}>
          <div className={styles.headerTitleRow}>
            <span className={styles.headerLabel}>ASSIGNED RESEARCH GROUPS</span>
            <h2 className={styles.pageTitle} style={{ fontSize: '1.1rem' }}>
              Select a group to configure its phase plan
            </h2>
          </div>
          <span className={styles.headerLabel}>
            <Users size={14} aria-hidden /> {groups.length} GROUP
            {groups.length !== 1 ? 'S' : ''}
          </span>
        </div>

        {groups.length === 0 ? (
          <div className={styles.phasesEmpty}>
            No research groups are assigned to this topic yet. Assign a group
            first, then return here to configure its phase plan.
          </div>
        ) : (
          <div className={styles.groupList}>
            {groups.map((group) => {
              const isSelected = group.id === selectedGroupId;
              const memberCount =
                typeof group.memberCount === 'number' ? group.memberCount : 0;
              return (
                <button
                  key={group.id}
                  type="button"
                  className={`${styles.groupCard} ${isSelected ? styles.groupCardSelected : ''}`}
                  onClick={() =>
                    typeof group.id === 'number' ? selectGroup(group.id) : null
                  }
                  disabled={typeof group.id !== 'number'}
                  aria-pressed={isSelected}
                  data-testid={`group-card-${group.id}`}
                >
                  <div className={styles.groupCardLeft}>
                    <span className={styles.groupName}>
                      {group.name ?? `Group #${group.id}`}
                    </span>
                    <span className={styles.groupMeta}>
                      <Users size={12} aria-hidden />{' '}
                      {memberCount} member{memberCount !== 1 ? 's' : ''}
                      {group.description && (
                        <> · {group.description}</>
                      )}
                    </span>
                  </div>
                  <div className={styles.groupCardRight}>
                    {isSelected ? (
                      <ChevronDown size={16} aria-hidden />
                    ) : (
                      <ChevronRight size={16} aria-hidden />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── No group selected — show prompt ─────────────────────────── */}
      {groups.length > 0 && selectedGroupId === null && (
        <div className={styles.phasesEmpty}>
          <Layers size={18} aria-hidden /> Select a group above to configure
          its reporting phases.
        </div>
      )}

      {/* ── Phase plan workspace (visible only after group selection) ── */}
      {selectedGroupId !== null && (
        <>
          {/* Compact inline notice — replaced the prior full-width BackendGapBanner.
              The fields it warns about remain honest about their persistence
              state without overpowering the workflow. */}
          <InlineNotice
            tone="info"
            title="Additional phase details awaiting backend support"
            description="Requirements, assessment criteria, and start date are not yet persisted by the BE — only the phase title and deadline will save."
            className={styles.phaseLimitBanner}
          />

          {/* Phase count indicator (no hard limit — BE supports 1..N phases) */}
          <div className={styles.phaseLimitBanner} role="status">
            <span>
              <Layers size={13} aria-hidden />{' '}
              {drafts.length} phase{drafts.length !== 1 ? 's' : ''} defined
            </span>
          </div>

          {/* Phase plan card */}
          <section className={styles.configCard}>
            <div className={styles.cardHeader}>
              <div className={styles.headerTitleRow}>
                <span className={styles.headerLabel}>PHASE PLAN</span>
                <h2 className={styles.pageTitle} style={{ fontSize: '1.1rem' }}>
                  {selectedGroup
                    ? `Phases for: ${selectedGroup.name ?? `Group #${selectedGroup.id}`}`
                    : 'Phase plan'}
                </h2>
              </div>
            </div>

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

            {loadingPhases ? (
              <div className={styles.phasesEmpty}>
                <Loader
                  size={16}
                  className={styles.spinningIcon}
                  aria-hidden
                />{' '}
                Loading existing phases…
              </div>
            ) : (
              <form onSubmit={save} className={styles.phasesForm}>
                {drafts.map((draft, index) => (
                  <article key={index} className={styles.phaseEditor}>
                    <header className={styles.phaseEditorHead}>
                      <h3 className={styles.phaseEditorTitle}>
                        <span className={styles.phaseIndexChip}>{index + 1}</span>
                        {draft.title || `Phase ${index + 1}`}
                      </h3>
                      <div className={styles.phaseHeadActions}>
                        {/* Reorder buttons */}
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
                        {/* Remove button */}
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

                    {/* Requirements — visible for product discovery but disabled because
              the BE does not persist this field. We accept no user input
              and do not pretend the value will save. */}
                    <div className={styles.formGroup}>
                      <label
                        className={styles.formLabel}
                        htmlFor={`phase-req-${index}`}
                      >
                        Requirements
                        <span className={styles.readOnlyBadge}>Unavailable</span>
                      </label>
                      <textarea
                        id={`phase-req-${index}`}
                        className={`${styles.formTextarea} ${styles.formControlDisabled}`}
                        value={draft.requirements}
                        onChange={() => undefined}
                        rows={2}
                        placeholder="Requirements are awaiting backend support."
                        disabled
                        aria-disabled
                        data-testid={`phase-req-${index}`}
                      />
                    </div>

                    {/* Assessment criteria — visible for product discovery but disabled. */}
                    <div className={styles.formGroup}>
                      <label
                        className={styles.formLabel}
                        htmlFor={`phase-crit-${index}`}
                      >
                        Assessment Criteria
                        <span className={styles.readOnlyBadge}>Unavailable</span>
                      </label>
                      <textarea
                        id={`phase-crit-${index}`}
                        className={`${styles.formTextarea} ${styles.formControlDisabled}`}
                        value={draft.assessmentCriteria}
                        onChange={() => undefined}
                        rows={2}
                        placeholder="Assessment criteria are awaiting backend support."
                        disabled
                        aria-disabled
                        data-testid={`phase-crit-${index}`}
                      />
                    </div>

                    <div className={styles.phaseEditorRow}>
                      {/* Start date — visible for product discovery but disabled. */}
                      <div className={styles.formGroup}>
                        <label
                          className={styles.formLabel}
                          htmlFor={`phase-start-${index}`}
                        >
                          Start Date
                          <span className={styles.readOnlyBadge}>Unavailable</span>
                        </label>
                        <input
                          id={`phase-start-${index}`}
                          type="datetime-local"
                          className={`${styles.formInput} ${styles.formControlDisabled}`}
                          value={draft.startAt}
                          onChange={() => undefined}
                          disabled
                          aria-disabled
                          data-testid={`phase-start-${index}`}
                        />
                      </div>

                      {/* End / deadline — persisted */}
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

                    {/* Material assignment — optional dropdown, sorted newest-first */}
                    <div className={styles.formGroup}>
                      <label
                        className={styles.formLabel}
                        htmlFor={`phase-material-${index}`}
                      >
                        Assigned Material
                        <span className={styles.optionalBadge}>Optional</span>
                      </label>
                      {loadingMaterials ? (
                        <select
                          id={`phase-material-${index}`}
                          className={styles.formSelect}
                          disabled
                          aria-busy="true"
                        >
                          <option value="">Loading materials…</option>
                        </select>
                      ) : (
                        <select
                          id={`phase-material-${index}`}
                          className={styles.formSelect}
                          value={
                            draft.learningMaterialId != null
                              ? String(draft.learningMaterialId)
                              : ''
                          }
                          onChange={(e) =>
                            updateDraft(
                              index,
                              'learningMaterialId',
                              e.target.value ? Number(e.target.value) : 'null',
                            )
                          }
                          data-testid={`phase-material-${index}`}
                        >
                          <option value="">— None —</option>
                          {materials.map((m: LearningMaterial) => {
                            const id = typeof m.id === 'number' ? m.id : -1;
                            if (id < 0) return null;
                            return (
                              <option key={id} value={id}>
                                {m.title ?? `Material #${id}`}
                              </option>
                            );
                          })}
                        </select>
                      )}
                      <span className={styles.formHint}>
                        Select a material from your library to assign to this
                        phase.
                      </span>
                    </div>

                    {/* Locked note */}
                    {phases[index]?.locked && (
                      <p className={styles.phaseLockedNote}>
                        <AlertTriangle size={12} aria-hidden /> This phase is
                        locked because a report has been submitted.
                      </p>
                    )}
                  </article>
                ))}

                {/* Save summary — one-line preview so the lecturer knows
                    exactly what they're about to persist. Format follows
                    the brief: "N phases · <group name> · Last deadline <date>". */}
                <div className={styles.saveSummary} aria-live="polite">
                  <strong>{drafts.length}</strong>
                  <span>phase{drafts.length !== 1 ? 's' : ''} ·</span>
                  <strong>
                    {selectedGroup?.name ?? `Group #${selectedGroupId}`}
                  </strong>
                  <span>· Last deadline</span>
                  <strong>
                    {(() => {
                      const lastEnd = drafts
                        .map((d) => d.endAt)
                        .filter((d) => d && !Number.isNaN(new Date(d).getTime()))
                        .sort()
                        .pop();
                      if (!lastEnd) return 'not set';
                      return new Date(lastEnd).toLocaleDateString();
                    })()}
                  </strong>
                </div>

                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={styles.addPhaseBtn}
                    onClick={addPhase}
                    disabled={drafts.length >= MAX_PHASES_PER_TOPIC}
                    data-testid="add-phase-btn"
                  >
                    <Plus size={16} aria-hidden /> Add phase
                  </button>
                  <button
                    type="submit"
                    className={styles.saveBtn}
                    disabled={!canSave}
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
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default ConfigureMilestones;
