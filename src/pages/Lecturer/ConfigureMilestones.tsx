/**
 * ConfigureMilestones — Lecturer topic-scoped phase-plan workspace.
 *
 * This page is the canonical surface for a Lecturer to define the reporting
 * phases for ONE research topic.
 *
 * URL contract:
 *   /configure-milestones?topicId=<number>[&groupId=<number>]
 *
 * Three views, depending on the URL:
 *
 *   - Card list (no `topicId`): every research topic the lecturer owns,
 *     with chips per group showing the count of phases already defined.
 *     Clicking a group chip opens the phase-editor modal.
 *
 *   - Full-page (with `topicId` + optional `groupId`): loads the topic
 *     and groups, then renders the inline `PhaseEditorPanel`. If both
 *     `topicId` and `groupId` are supplied the panel mounts immediately;
 *     if only `topicId` is supplied the page shows the group-selection
 *     list under the topic header (refresh-safe via URL).
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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronRight,
  Loader,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import { researchTopicService, type ResearchTopic } from '../../services/researchTopic.service';
import { researchGroupService, type ResearchGroup } from '../../services/researchGroup.service';
import {
  researchTopicPhaseService,
  type ResearchTopicPhase,
} from '../../services/researchTopicPhase.service';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { PhaseEditorPanel } from '../../components/lecturer/PhaseEditorPanel';
import { ROUTES } from '../../routes/paths';
import {
  parseIdFromSearch,
  parseTopicIdFromSearch,
  parseHighlightFlag,
} from '../../utils/topicRouting';
import { formatDisplayDate } from '../../utils/datetime';
import styles from './ConfigureMilestones.module.css';

// ─── State shapes ────────────────────────────────────────────────────────────

type CardListState =
  | { kind: 'loading' }
  | { kind: 'ready'; topics: ResearchTopic[]; groupsByTopic: Map<number, ResearchGroup[]>; phaseCountsByGroup: Map<number, number>; error: string | null }
  | { kind: 'error'; message: string };

type TopicPageState =
  | { kind: 'loading' }
  | { kind: 'topic-not-found'; topicId: number }
  | {
      kind: 'ready';
      topic: ResearchTopic;
      groups: ResearchGroup[];
      selectedGroupId: number | null;
    };

type PageState =
  | { kind: 'card-list'; state: CardListState }
  | { kind: 'topic-page'; state: TopicPageState };

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatDate = (iso: string | null | undefined): string => {
  return formatDisplayDate(iso, 'vi');
};

// ─── Component ─────────────────────────────────────────────────────────────

export const ConfigureMilestones = () => {
  const [searchParams] = useSearchParams();
  const { topicId, error: topicIdError } = parseTopicIdFromSearch(searchParams);
  const groupIdFromUrl = useMemo(
    () => parseIdFromSearch(searchParams, 'groupId'),
    [searchParams],
  );

  const [pageState, setPageState] = useState<PageState>(() =>
    topicId !== null
      ? { kind: 'topic-page', state: { kind: 'loading' } }
      : { kind: 'card-list', state: { kind: 'loading' } },
  );

  // ── Highlight wiring ───────────────────────────────────────────────
  // When the lecturer navigates here from the Materials "Used by" modal
  // with `?topicId=X&groupId=Y&phase=Z&highlight=true`, both the topic
  // page (header) and the phase editor (the matching phase row) receive
  // a visual highlight. `highlightPhaseNumber` is only meaningful in
  // combination with `groupIdFromUrl` so it stays `null` otherwise.
  const highlightActive = parseHighlightFlag(searchParams);
  const highlightPhaseNumber = highlightActive
    ? parseIdFromSearch(searchParams, 'phase')
    : null;

  // ── Load the card-list view ───────────────────────────────────
  const loadCardList = useCallback(async () => {
    setPageState({ kind: 'card-list', state: { kind: 'loading' } });
    try {
      // Step 1 — fetch topics + groups in parallel.
      const [allTopics, allGroups] = await Promise.allSettled([
        researchTopicService.getAll(),
        researchGroupService.getAll(),
      ]);

      if (
        allTopics.status === 'rejected' ||
        allGroups.status === 'rejected'
      ) {
        const message =
          allTopics.status === 'rejected'
            ? allTopics.reason instanceof Error
              ? allTopics.reason.message
              : 'Failed to load topics.'
            : allGroups.status === 'rejected'
              ? allGroups.reason instanceof Error
                ? allGroups.reason.message
                : 'Failed to load research groups.'
              : 'Failed to load workspace.';
        setPageState({
          kind: 'card-list',
          state: { kind: 'error', message },
        });
        return;
      }

      const topics = allTopics.value;
      const groups = allGroups.value;

      // Step 2 — fetch every topic's phases in parallel. We use the
      // topics list we just fetched instead of calling `getAll` again.
      const ids = topics
        .map((t) => t.id ?? t.topicId)
        .filter((id): id is number => typeof id === 'number' && id > 0);
      const phaseResults = await Promise.allSettled(
        ids.map((id) => researchTopicPhaseService.getByTopic(id)),
      );
      const phasesByTopic = ids.map((id, idx) => ({
        topicId: id,
        phases:
          phaseResults[idx].status === 'fulfilled'
            ? phaseResults[idx].value
            : [],
      }));

      // Group research groups by topicId (defensive filter — fields are
      // nullable per Swagger).
      const groupsByTopic = new Map<number, ResearchGroup[]>();
      for (const g of groups) {
        const tid = g.topicId;
        if (typeof tid !== 'number') continue;
        const list = groupsByTopic.get(tid) ?? [];
        list.push(g);
        groupsByTopic.set(tid, list);
      }

      // Phase counts per (topicId, groupId).
      const phaseCountsByGroup = new Map<number, number>();
      for (const entry of phasesByTopic) {
        for (const phase of entry.phases) {
          const gid = phase.report?.researchGroupId;
          if (typeof gid !== 'number') continue;
          const key = entry.topicId * 1_000_000 + gid;
          phaseCountsByGroup.set(key, (phaseCountsByGroup.get(key) ?? 0) + 1);
        }
      }

      setPageState({
        kind: 'card-list',
        state: {
          kind: 'ready',
          topics,
          groupsByTopic,
          phaseCountsByGroup,
          error: null,
        },
      });
    } catch (err) {
      setPageState({
        kind: 'card-list',
        state: {
          kind: 'error',
          message:
            err instanceof Error ? err.message : 'Unable to load topics.',
        },
      });
    }
  }, []);

  // ── Load the single-topic page view ───────────────────────────
  const loadTopicPage = useCallback(async (tid: number) => {
    setPageState({ kind: 'topic-page', state: { kind: 'loading' } });
    try {
      const topic = await researchTopicService.getById(tid);
      const allGroups = await researchGroupService.getAll();
      const assignedGroups = allGroups.filter(
        (g) => typeof g.topicId === 'number' && g.topicId === tid,
      );
      setPageState({
        kind: 'topic-page',
        state: {
          kind: 'ready',
          topic,
          groups: assignedGroups,
          selectedGroupId: null,
        },
      });
    } catch {
      setPageState({
        kind: 'topic-page',
        state: { kind: 'topic-not-found', topicId: tid },
      });
    }
  }, []);

  // ── Drive the loader based on URL ─────────────────────────────
  useEffect(() => {
    if (topicIdError === 'invalid' || topicId === null) {
      // No usable topicId → show the card list.
      void loadCardList();
      return;
    }
    void loadTopicPage(topicId);
  }, [topicId, topicIdError, loadCardList, loadTopicPage]);

  // ── When the topic-page loads with a `groupId` in the URL, surface it
  //    immediately so the inline PhaseEditorPanel can mount. ──────
  useEffect(() => {
    if (
      pageState.kind === 'topic-page' &&
      pageState.state.kind === 'ready' &&
      groupIdFromUrl !== null &&
      pageState.state.selectedGroupId === null
    ) {
      setPageState({
        kind: 'topic-page',
        state: { ...pageState.state, selectedGroupId: groupIdFromUrl },
      });
    }
  }, [pageState, groupIdFromUrl]);

  // ── Group selection on the topic page ─────────────────────────
  const selectGroupOnTopicPage = useCallback((groupId: number) => {
    setPageState((prev) => {
      if (prev.kind !== 'topic-page' || prev.state.kind !== 'ready') return prev;
      return {
        kind: 'topic-page',
        state: { ...prev.state, selectedGroupId: groupId },
      };
    });
  }, []);

  // ── Refresh the card-list view after a modal save ─────────────
  const handleCardListRefresh = useCallback(() => {
    // Re-fetch the card list so the chips reflect the new phase counts.
    if (pageState.kind === 'card-list') {
      void loadCardList();
    }
  }, [pageState.kind, loadCardList]);

  // ── Render: card list view ────────────────────────────────────
  if (
    pageState.kind === 'card-list' ||
    topicIdError === 'invalid'
  ) {
    return (
      <CardListView
        state={pageState.kind === 'card-list' ? pageState.state : { kind: 'loading' }}
        onRetry={() => void loadCardList()}
        onAfterSave={handleCardListRefresh}
        highlightPhaseNumber={highlightPhaseNumber}
      />
    );
  }

  // ── Render: topic page view ───────────────────────────────────
  if (pageState.kind === 'topic-page') {
    return (
      <TopicPageView
        state={pageState.state}
        groupIdFromUrl={groupIdFromUrl}
        onSelectGroup={selectGroupOnTopicPage}
        onRetry={() => topicId !== null && void loadTopicPage(topicId)}
        highlightPhaseNumber={highlightPhaseNumber}
      />
    );
  }

  return null;
};

// ─── Sub-component: Card-list view ──────────────────────────────────────────

interface CardListViewProps {
  state: CardListState;
  onRetry: () => void;
  /** Fired after the user saves phases inside the modal — the host uses
   *  this to refetch the topic list so the phase-count chips stay fresh. */
  onAfterSave?: () => void;
  /** Phase number to visually highlight when the modal opens. */
  highlightPhaseNumber: number | null;
}

const CardListView = ({
  state,
  onRetry,
  onAfterSave,
  highlightPhaseNumber,
}: CardListViewProps) => {
  // Modal state lives in the card-list view because only this view needs
  // it. Keeping it local avoids prop-drilling `setOpenModal` from the
  // outer component (which would also force the parent to know about
  // the modal's existence).
  const [openModal, setOpenModal] = useState<{
    topicId: number;
    groupId: number;
    title: string;
  } | null>(null);

  const handleSaved = useCallback(() => {
    setOpenModal(null);
    onAfterSave?.();
  }, [onAfterSave]);

  if (state.kind === 'loading') {
    return (
      <div className={styles.configureMilestones}>
        <PageHeader
          eyebrow="LECTURER WORKSPACE"
          title="Configure reporting phases"
          description="Loading your research topics…"
          accent="var(--ars-lecturer)"
        />
        <div className={styles.phasesEmpty}>
          <Loader size={16} className={styles.spinningIcon} aria-hidden />{' '}
          Loading topics…
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className={styles.configureMilestones}>
        <PageHeader
          eyebrow="LECTURER WORKSPACE"
          title="Configure reporting phases"
          description="Select a topic to manage its phase plan."
          accent="var(--ars-lecturer)"
        />
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={16} aria-hidden />
          <span>{state.message}</span>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw size={12} /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.configureMilestones}>
      <PageHeader
        eyebrow="LECTURER WORKSPACE"
        title="Configure reporting phases"
        description="Pick a research group below to manage the milestones for its topic. Each chip shows how many phases are already defined."
        accent="var(--ars-lecturer)"
      />

      {state.topics.length === 0 ? (
        <div className={styles.phasesEmpty}>
          You have no research topics yet. Open the Research Topics page to
          create one, then return here to define its milestones.
          <div className={styles.emptyCta}>
            <Link to={ROUTES.LECTURER_RESEARCH_TOPICS}>
              <Button variant="outline" size="md">
                Go to Research Topics
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.cardListGrid}>
          {state.topics.map((topic) => {
            const tid = topic.id ?? topic.topicId;
            if (typeof tid !== 'number') return null;
            const topicGroups = state.groupsByTopic.get(tid) ?? [];
            return (
              <article key={tid} className={styles.topicCard}>
                <header className={styles.topicCardHeader}>
                  <h2 className={styles.topicCardTitle}>
                    {topic.title ?? `Topic #${tid}`}
                  </h2>
                  <StatusBadge
                    status={topic.status ?? null}
                    size="sm"
                  />
                </header>
                {topic.description && (
                  <p className={styles.topicCardDesc}>{topic.description}</p>
                )}
                <div className={styles.topicCardMeta}>
                  <span>
                    <Users size={11} aria-hidden />{' '}
                    {topicGroups.length} group
                    {topicGroups.length !== 1 ? 's' : ''} assigned
                  </span>
                  {topic.createdAt && (
                    <span>
                      <Calendar size={11} aria-hidden /> Created{' '}
                      {formatDate(topic.createdAt)}
                    </span>
                  )}
                </div>
                {topicGroups.length === 0 ? (
                  <div className={styles.topicCardEmpty}>
                    No groups are assigned to this topic yet. Open the topic
                    and assign a group first.
                  </div>
                ) : (
                  <div className={styles.groupChipsRow}>
                    {topicGroups.map((group) => {
                      const gid = group.id;
                      if (typeof gid !== 'number') return null;
                      const count =
                        state.phaseCountsByGroup.get(tid * 1_000_000 + gid) ?? 0;
                      return (
                        <button
                          key={gid}
                          type="button"
                          className={styles.groupChipBtn}
                          onClick={() =>
                            setOpenModal({
                              topicId: tid,
                              groupId: gid,
                              title: group.name ?? `Group #${gid}`,
                            })
                          }
                          data-testid={`group-chip-${tid}-${gid}`}
                          aria-label={`Manage phases for ${group.name ?? `Group #${gid}`} (${count} phase${count !== 1 ? 's' : ''} defined)`}
                        >
                          <span className={styles.groupChipName}>
                            {group.name ?? `Group #${gid}`}
                          </span>
                          <span className={styles.groupChipBadge}>
                            {count} phase{count !== 1 ? 's' : ''}
                          </span>
                          <ChevronRight
                            size={12}
                            className={styles.groupChipArrow}
                            aria-hidden
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Modal — opened when a group chip is clicked. */}
      {openModal && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-phase-modal-title"
        >
          <div className={styles.modalCard}>
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalIconCircle}>
                  <Users size={18} aria-hidden />
                </span>
                <div>
                  <h3
                    id="group-phase-modal-title"
                    className={styles.modalTitle}
                  >
                    {openModal.title}
                  </h3>
                  <span className={styles.modalSubtitle}>
                    Topic #{openModal.topicId} · Manage reporting phases
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setOpenModal(null)}
                aria-label="Close phase editor"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <PhaseEditorPanel
              topicId={openModal.topicId}
              groupId={openModal.groupId}
              onSaved={handleSaved}
              highlightPhaseNumber={highlightPhaseNumber}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub-component: Topic page view (full-page route) ───────────────────────

interface TopicPageViewProps {
  state: TopicPageState;
  groupIdFromUrl: number | null;
  onSelectGroup: (groupId: number) => void;
  onRetry: () => void;
  highlightPhaseNumber: number | null;
}

const TopicPageView = ({
  state,
  onSelectGroup,
  onRetry,
  highlightPhaseNumber,
}: TopicPageViewProps) => {
  if (state.kind === 'loading') {
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

  if (state.kind === 'topic-not-found') {
    return (
      <div className={styles.configureMilestones}>
        <PageHeader
          eyebrow="LECTURER WORKSPACE"
          title="Topic not found"
          description={`The topic with ID ${state.topicId} could not be loaded.`}
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
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw size={12} /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const { topic, groups, selectedGroupId } = state;
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  return (
    <div className={styles.configureMilestones}>
      <div className={styles.breadcrumbs}>
        Home &gt;{' '}
        <Link to={ROUTES.LECTURER_RESEARCH_TOPICS} className={styles.backLink}>
          Research Topics
        </Link>{' '}
        &gt; <span className={styles.activeBreadcrumb}>Topic phases</span>
      </div>

      <section className={styles.configCard}>
        <div className={styles.cardHeader}>
          <div className={styles.headerTitleRow}>
            <span className={styles.headerLabel}>SELECTED RESEARCH TOPIC</span>
            <h1 className={styles.pageTitle}>
              {topic.title ?? `Topic #${topic.id}`}
            </h1>
          </div>
          <div className={styles.topicMetaRow}>
            <StatusBadge status={topic.status ?? 'OPEN'} />
            <span className={styles.topicMetaChip}>
              <Users size={12} aria-hidden />
              {groups.length} group{groups.length !== 1 ? 's' : ''} assigned
            </span>
          </div>
        </div>
        {topic.description && (
          <div className={styles.topicDescRow}>
            <p className={styles.topicDescText}>{topic.description}</p>
          </div>
        )}
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
                  className={`${styles.groupCard} ${
                    isSelected ? styles.groupCardSelected : ''
                  }`}
                  onClick={() =>
                    typeof group.id === 'number'
                      ? onSelectGroup(group.id)
                      : null
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
                      {group.description && <> · {group.description}</>}
                    </span>
                  </div>
                  <div className={styles.groupCardRight}>
                    <ChevronRight size={16} aria-hidden />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedGroupId !== null && selectedGroup && (
        <section className={styles.configCard}>
          <div className={styles.cardHeader}>
            <div className={styles.headerTitleRow}>
              <span className={styles.headerLabel}>PHASE PLAN</span>
              <h2 className={styles.pageTitle} style={{ fontSize: '1.1rem' }}>
                Phases for: {selectedGroup.name ?? `Group #${selectedGroup.id}`}
              </h2>
            </div>
          </div>
          <PhaseEditorPanel
            topicId={topic.id ?? topic.topicId ?? 0}
            groupId={selectedGroupId}
            highlightPhaseNumber={highlightPhaseNumber}
          />
        </section>
      )}
    </div>
  );
};

// Re-export the `ResearchTopicPhase` type so the modal `onSaved` callback
// signature stays typed correctly when consumed from the page.
export type { ResearchTopicPhase };

export default ConfigureMilestones;
