// Lecturer — Research Topics (top-level page)
//
// This page is the canonical Lecturer surface for managing Research Topics.
// Previously, the topic CRUD lived inside the Research Groups page (as a
// nested "Research Topics Library" section). That co-location produced
// several UX problems:
//   - The sidebar listed "Research Group" but never "Research Topics", so
//     the topic entry point was effectively hidden from the top-level nav.
//   - Researchers seeing a group couldn't navigate to the underlying topic
//     without scrolling a long table on the same screen.
//   - The Lecturer detail page for a group could mutate the topic, blurring
//     ownership of state changes between two surfaces.
//
// Per the Coordinator brief this page is the ONLY Lecturer surface that
// allows create / edit / status-transition / material-management of a
// Research Topic. Groups merely show a summary + deep-link to the topic
// row on this page.
//
// All data comes from the live API (`researchTopicService`, etc.). No mock
// records. No hardcoded "Topic 1" data.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Check,
  X,
  BookOpen,
  Pencil,
  Loader,
  AlertTriangle,
  RefreshCw,
  ToggleRight,
  ToggleLeft,
  CheckCircle2,
  Library,
  Lightbulb,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { useResearchTopics } from '../../hooks/useResearchTopics';
import { useTableSort } from '../../hooks/useTableSort';
import { researchTopicService } from '../../services/researchTopic.service';
import type { ResearchTopic } from '../../types/research';
import { canTransitionResearchTopic } from '../../utils/researchStatus';
import type { ResearchTopicStatus } from '../../types/research';
import { researchGroupService, type ResearchGroup } from '../../services/researchGroup.service';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import { LearningMaterialModal } from '../../components/lecturer/LearningMaterialModal';
import { AssignTopicModal } from '../../components/lecturer/AssignTopicModal';
import { FieldError } from '../../components/FieldError';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { SortableHeader } from '../../components/table/SortableHeader';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { usePagination } from '../../hooks/usePagination';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import { ROUTES } from '../../routes/paths';
import { validateHttpsUrl } from '../../utils/validationRules';
import { buildConfigureMilestonesUrl } from '../../utils/topicRouting';
import { useListShortcuts } from '../../hooks/useListShortcuts';
import { useAuth } from '../../hooks/useAuth';
import styles from './ResearchTopics.module.css';

const STATUS_OPTIONS: ReadonlyArray<ResearchTopicStatus> = [
  'OPEN',
  'ASSIGNED',
  'COMPLETED',
  'CLOSED',
];

/** Sortable column ids for the Research Topics table. */
type SortColumn = 'title' | 'description' | 'status' | 'groups' | 'createdAt';

interface BannerState {
  visible: boolean;
  text: string;
  variant: 'success' | 'error';
}

const formatTopicId = (id: number): string =>
  `RT-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`;

export const ResearchTopicsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  
  const STATUS_FILTER_LABELS: Record<ResearchTopicStatus, string> = {
    OPEN: t('lecturer.topics.statusOpen'),
    ASSIGNED: t('lecturer.topics.statusAssigned'),
    COMPLETED: t('lecturer.topics.statusCompleted'),
    CLOSED: t('lecturer.topics.statusClosed'),
  };

  const currentLecturerId =
    typeof user?.userId === 'number' ? user.userId : null;
  const {
    topics,
    isLoading,
    error: topicsError,
    refetch: refetchTopics,
  } = useResearchTopics();

  // Groups are used both to compute "Assigned to N groups" badge per
  // topic and to populate the Assign Topic modal.
  const [groupCounts, setGroupCounts] = useState<Record<number, number>>({});
  const [allGroups, setAllGroups] = useState<ResearchGroup[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const groups = await researchGroupService.getAll();
        if (cancelled) return;
        const acc: Record<number, number> = {};
        for (const g of groups ?? []) {
          const tid = typeof g.topicId === 'number' ? g.topicId : null;
          if (tid === null) continue;
          acc[tid] = (acc[tid] ?? 0) + 1;
        }
        setGroupCounts(acc);
        setAllGroups(groups ?? []);
      } catch {
        // Defensive — a failure here must not block the page.
        if (!cancelled) setGroupCounts({});
        if (!cancelled) setAllGroups([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topics]);

  // ── Assign Topic modal state ─────────────────────────────────────────
  const [assignModalTopic, setAssignModalTopic] = useState<ResearchTopic | null>(null);

  // ── Create Topic modal state ─────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [topicName, setTopicName] = useState('');
  const [topicDesc, setTopicDesc] = useState('');
  const [topicMaterialsUrl, setTopicMaterialsUrl] = useState('');
  const [topicNameError, setTopicNameError] = useState<string | null>(null);
  const [topicMaterialsUrlError, setTopicMaterialsUrlError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Edit Topic modal state ──────────────────────────────────────────
  const [topicForEdit, setTopicForEdit] = useState<ResearchTopic | null>(null);
  const [editTopicTitle, setEditTopicTitle] = useState('');
  const [editTopicDesc, setEditTopicDesc] = useState('');
  const [editTopicMaterialsUrl, setEditTopicMaterialsUrl] = useState('');
  const [editTopicTitleError, setEditTopicTitleError] = useState<string | null>(null);
  const [editTopicMaterialsUrlError, setEditTopicMaterialsUrlError] = useState<string | null>(null);
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [editTopicError, setEditTopicError] = useState<string | null>(null);

  // ── Manage Materials modal state ───────────────────────────────────
  const [topicForMaterials, setTopicForMaterials] = useState<ResearchTopic | null>(null);

  // ── Status-transition inflight ──────────────────────────────────────
  const [topicTransition, setTopicTransition] = useState<{
    id: number;
    to: ResearchTopicStatus;
  } | null>(null);

  // ── Banner state ────────────────────────────────────────────────────
  const [banner, setBanner] = useState<BannerState>({
    visible: false,
    text: '',
    variant: 'success',
  });

  // ── Toolbar state ───────────────────────────────────────────────────
  const [topicSearch, setTopicSearch] = useState('');
  const [topicStatusFilter, setTopicStatusFilter] = useState<ResearchTopicStatus | 'ALL'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Default sort by createdAt (newest first) so newly created topics
  // surface at the top. The user can override per column header click.
  const sort = useTableSort<ResearchTopic, SortColumn>('createdAt', 'desc');

  const filteredTopics = useMemo(() => {
    const query = topicSearch.trim().toLowerCase();
    const base = topics.filter((t) => {
      if (topicStatusFilter !== 'ALL' && t.status !== topicStatusFilter) {
        return false;
      }
      if (!query) return true;
      return [t.title ?? '', t.description ?? '', t.status ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
    // Sort is applied separately via sort.sortedItemsBy below.
    return base;
  }, [topics, topicSearch, topicStatusFilter]);

  // Apply sort on top of filtered list.
  const sortedTopics = useMemo(
    () =>
      sort.sortedItemsBy(filteredTopics, (t) => {
        switch (sort.sortState.column) {
          case 'title':
            return t.title ?? '';
          case 'description':
            return t.description ?? '';
          case 'status':
            return t.status ?? '';
          case 'groups':
            return groupCounts[t.id ?? -1] ?? 0;
          case 'createdAt':
          default:
            return t.createdAt ?? null;
        }
      }),
    [filteredTopics, groupCounts, sort],
  );

  const {
    page,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    pageItems,
    setPage,
    next,
    prev,
    resetPage,
  } = usePagination<ResearchTopic>(sortedTopics, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetPage();
  }, [topicSearch, topicStatusFilter, sort.sortState, resetPage]);

  // Part 3 — keyboard shortcuts for the research-topics table.
  // j/k navigate rows, Enter opens the topic's milestones page,
  // n opens the create-topic modal, f focuses the search input.
  const { selectedIndex } = useListShortcuts({
    itemCount: pageItems.length,
    onOpen: (index) => {
      const topic = pageItems[index];
      if (!topic || typeof topic.id !== 'number') return;
      // "Open" maps to the topic's milestone-config page, matching the
      // "Manage Phases" affordance in the row's action stack. The
      // topic id travels in the URL so refresh / direct links land on
      // the exact same topic, never on a default or unrelated one.
      navigate(buildConfigureMilestonesUrl(topic.id));
    },
    onNew: () => setShowCreateModal(true),
  });

  const showBanner = (text: string, variant: 'success' | 'error' = 'success') => {
    setBanner({ visible: true, text, variant });
    window.setTimeout(() => setBanner({ visible: false, text: '', variant: 'success' }), 4000);
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refetchTopics();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = topicName.trim();
    const nameErr = trimmedName ? null : t('lecturer.topics.errNameReq');
    const url = topicMaterialsUrl.trim();
    const urlErr = url ? validateHttpsUrl(url) : null;
    setTopicNameError(nameErr);
    setTopicMaterialsUrlError(urlErr);
    if (nameErr || urlErr) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await researchTopicService.create({
        title: trimmedName,
        description: topicDesc.trim() || null,
        materialsUrl: url || null,
        status: 'OPEN',
      });
      setShowCreateModal(false);
      setTopicName('');
      setTopicDesc('');
      setTopicMaterialsUrl('');
      setTopicNameError(null);
      setTopicMaterialsUrlError(null);
      const idLabel = typeof created.id === 'number' ? formatTopicId(created.id) : '';
      showBanner(t('lecturer.topics.createSuccess').replace('{id}', idLabel).replace('{name}', created.title ?? topicName));
      await refetchTopics();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : t('lecturer.topics.errCreateFail'),
      );
    } finally {
      setIsCreating(false);
    }
  };

  const openEditModal = (topic: ResearchTopic) => {
    setTopicForEdit(topic);
    setEditTopicTitle(typeof topic.title === 'string' ? topic.title : '');
    setEditTopicDesc(typeof topic.description === 'string' ? topic.description : '');
    setEditTopicMaterialsUrl(
      typeof topic.materialsUrl === 'string' ? topic.materialsUrl : '',
    );
    setEditTopicError(null);
    setEditTopicTitleError(null);
    setEditTopicMaterialsUrlError(null);
  };

  const closeEditModal = () => {
    if (isEditingTopic) return;
    setTopicForEdit(null);
  };

  const handleEditTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicForEdit || typeof topicForEdit.id !== 'number') {
      setEditTopicError(t('lecturer.topics.errEditId'));
      return;
    }
    const title = editTopicTitle.trim();
    const titleErr = title ? null : t('lecturer.topics.errEditTitleReq');
    const url = editTopicMaterialsUrl.trim();
    const urlErr = url ? validateHttpsUrl(url) : null;
    setEditTopicTitleError(titleErr);
    setEditTopicMaterialsUrlError(urlErr);
    if (titleErr || urlErr) return;
    setIsEditingTopic(true);
    setEditTopicError(null);
    try {
      await researchTopicService.update(topicForEdit.id, {
        title,
        description: editTopicDesc.trim() || null,
        materialsUrl: url || null,
        status:
          typeof topicForEdit.status === 'string' ? topicForEdit.status : null,
      });
      setTopicForEdit(null);
      showBanner(t('lecturer.topics.editSuccess').replace('{id}', formatTopicId(topicForEdit.id).slice(3)).replace('{title}', title));
      await refetchTopics();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t('lecturer.topics.errEditFail');
      setEditTopicError(message);
    } finally {
      setIsEditingTopic(false);
    }
  };

  const handleTopicTransition = async (
    topic: ResearchTopic,
    to: ResearchTopicStatus,
  ) => {
    if (typeof topic.id !== 'number') return;
    const fromStatus = (topic.status ?? 'OPEN') as ResearchTopicStatus;
    if (!canTransitionResearchTopic(fromStatus, to)) {
      showBanner(
        t('lecturer.topics.errTransNotAllowed').replace('{from}', fromStatus).replace('{to}', to),
        'error',
      );
      return;
    }
    setTopicTransition({ id: topic.id, to });
    try {
      await researchTopicService.update(topic.id, {
        title: topic.title ?? null,
        description: topic.description ?? null,
        materialsUrl: topic.materialsUrl ?? null,
        status: to,
      });
      showBanner(t('lecturer.topics.transSuccess').replace('{title}', topic.title ?? `RT-${topic.id}`).replace('{to}', to));
      await refetchTopics();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed';
      showBanner(t('lecturer.topics.errTransFail').replace('{msg}', message), 'error');
    } finally {
      setTopicTransition(null);
    }
  };

  const handleOpenMaterials = (topic: ResearchTopic) => {
    setTopicForMaterials(topic);
  };

  const handleCloseMaterials = () => {
    setTopicForMaterials(null);
  };

  return (
    <div className={styles.researchGroupPage} data-testid="lecturer-research-topics">
      <PageHeader
        eyebrow={t('lecturer.topics.pageEyebrow')}
        title={t('lecturer.topics.pageTitle')}
        description={t('lecturer.topics.pageDesc')}
        actions={
          <>
            <Button
              variant="outline"
              size="md"
              leftIcon={
                isLoading ? (
                  <Loader size={14} className={styles.spinningIcon} aria-hidden />
                ) : (
                  <RefreshCw size={14} aria-hidden />
                )
              }
              onClick={() => void handleRefresh()}
              disabled={isLoading}
              aria-label={t('lecturer.topics.refresh')}
            >
              {t('lecturer.topics.refresh')}
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus size={16} aria-hidden />}
              onClick={() => setShowCreateModal(true)}
            >
              {t('lecturer.topics.createTopic')}
            </Button>
          </>
        }
        accent="var(--ars-lecturer)"
      />

      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; <Link to={ROUTES.FORUM}>{t('lecturer.topics.breadcrumbParent')}</Link> &gt;{' '}
        <span className={styles.activeBreadcrumb}>{t('lecturer.topics.breadcrumbCurrent')}</span>
      </div>

      {/* BANNER */}
      {banner.visible && (
        <div
          className={`${styles.successToastBanner} ${
            banner.variant === 'error' ? styles.errorToastBanner : ''
          }`}
          data-testid="research-topics-banner"
        >
          <div className={styles.toastLeft}>
            <span className={styles.toastCheckIcon}>
              {banner.variant === 'success' ? (
                <Check size={14} strokeWidth={3} aria-hidden />
              ) : (
                <AlertTriangle size={14} aria-hidden />
              )}
            </span>
            <div>
              <span className={styles.toastTitle}>
                {banner.variant === 'success' ? t('lecturer.topics.actionSuccess') : t('lecturer.topics.actionFailed')}
              </span>
              <p className={styles.toastSub}>{banner.text}</p>
            </div>
          </div>
          <div className={styles.toastRight}>
            <button
              type="button"
              className={styles.toastCloseBtn}
              onClick={() =>
                setBanner({ visible: false, text: '', variant: 'success' })
              }
              aria-label="Dismiss"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* GLOBAL ERROR BANNER */}
      {topicsError && (
        <div className={styles.errorBanner} role="alert">
          <span className={styles.errorBannerIcon}>
            <AlertTriangle size={14} aria-hidden />
            <span>{topicsError.message ?? t('lecturer.topics.errLoadTopics')}</span>
          </span>
          <button
            type="button"
            className={styles.errorRetryBtn}
            onClick={() => void handleRefresh()}
          >
            {t('lecturer.topics.retry')}
          </button>
        </div>
      )}

      {/* TABLE */}
      <div className={styles.sectionHeaderRow}>
        <div className={styles.sectionTitleBlock}>
          <BookOpen size={18} className={styles.sectionIcon} aria-hidden />
          <h3 className={styles.sectionTitle}>{t('lecturer.topics.libraryTitle')}</h3>
          <span className={styles.countBadge}>
            {topicSearch.trim()
              ? t('lecturer.topics.topicCountTotal').replace('{count}', String(totalItems)).replace('{total}', String(topics.length))
              : t('lecturer.topics.topicCount').replace('{count}', String(topics.length))}
          </span>
        </div>
      </div>

      <TableToolbar
        search={topicSearch}
        onSearchChange={setTopicSearch}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        searchPlaceholder={t('lecturer.topics.searchPlaceholder')}
        refreshLabel={t('lecturer.topics.refresh')}
      />
      <div className={styles.tableCard}>
        {isLoading ? (
          <div className={styles.tableEmpty} role="status" data-testid="topics-loading">
            <Loader size={16} className={styles.spinningIcon} aria-hidden />
            {t('lecturer.topics.loading')}
          </div>
        ) : topics.length === 0 ? (
          <div className={styles.tableEmpty} data-testid="topics-empty">
            {t('lecturer.topics.empty')}
          </div>
        ) : totalItems === 0 ? (
          <div className={styles.tableEmpty} data-testid="topics-empty-search">
            {t('lecturer.topics.emptySearch').replace('{query}', topicSearch.trim())}
          </div>
        ) : (
          <>
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>
                      <SortableHeader
                        column="title"
                        label={t('lecturer.topics.colTitle')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="description"
                        label={t('lecturer.topics.colDesc')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="status"
                        label={t('lecturer.topics.colStatus')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                        filterOptions={[
                          { value: 'ALL', label: t('lecturer.topics.filterAll') },
                          ...STATUS_OPTIONS.map((status) => ({
                            value: status,
                            label: STATUS_FILTER_LABELS[status],
                          })),
                        ]}
                        activeFilter={topicStatusFilter}
                        onFilterChange={(next) =>
                          setTopicStatusFilter(
                            next as ResearchTopicStatus | 'ALL',
                          )
                        }
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="groups"
                        label={t('lecturer.topics.colGroups')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                        align="right"
                      />
                    </th>
                    <th>{t('lecturer.topics.colAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((topic, index) => {
                    const tid = typeof topic.id === 'number' ? topic.id : -1;
                    const idLabel = tid >= 0 ? formatTopicId(tid) : '—';
                    const topicStatus =
                      (topic.status ?? 'OPEN') as ResearchTopicStatus;
                    const canOpen = canTransitionResearchTopic(
                      topicStatus,
                      'OPEN',
                    );
                    const canClose = canTransitionResearchTopic(
                      topicStatus,
                      'CLOSED',
                    );
                    const canComplete = canTransitionResearchTopic(
                      topicStatus,
                      'COMPLETED',
                    );
                    const inflight =
                      topicTransition && topicTransition.id === tid
                        ? topicTransition.to
                        : null;
                    const groupCount = tid >= 0 ? groupCounts[tid] ?? 0 : 0;
                    return (
                      <tr
                        key={tid}
                        className={selectedIndex === index ? styles.selectedRow : ''}
                      >
                        <td data-label="Topic">
                          <div className={styles.topicTitleCell}>
                            <span className={styles.topicIdBadge}>{idLabel}</span>
                            <span className={styles.topicNameText}>
                              {topic.title ?? t('lecturer.topics.untitled')}
                            </span>
                          </div>
                        </td>
                        <td className={styles.topicDescText} data-label="Description">
                          {topic.description?.trim() || '—'}
                        </td>
                        <td data-label="Status">
                          <StatusBadge status={topicStatus} />
                        </td>
                        <td data-label="Groups">
                          <span
                            className={styles.groupCountChip}
                            data-testid="topic-group-count"
                          >
                            {groupCount}
                          </span>
                          <button
                            type="button"
                            className={styles.assignGroupBtn}
                            onClick={() => setAssignModalTopic(topic)}
                            title={t('lecturer.topics.assignHint')}
                          >
                            {t('lecturer.topics.assign')}
                          </button>
                        </td>
                        <td data-label="Actions">
                          <div className={styles.topicActionStack}>
                            {/* Manage Phases is the lecturer's primary
                                workflow for this topic — promote it to the
                                first row, full width, so it never gets
                                buried under a stack of secondary buttons. */}
                            {groupCount === 0 ? (
                              <button
                                type="button"
                                className={styles.managePhasesDisabledBtn}
                                disabled
                                title={t('lecturer.topics.managePhasesHintDisabled')}
                                data-testid="topic-manage-phases-disabled"
                                data-topic-id={topic.id ?? ''}
                                aria-disabled
                              >
                                <BookOpen size={14} aria-hidden />
                                {t('lecturer.topics.managePhases')}
                                <span className={styles.managePhasesHint}>
                                  {t('lecturer.topics.assignGroupFirst')}
                               </span>
                              </button>
                            ) : (
                              <Link
                                to={
                                  typeof topic.id === 'number'
                                    ? buildConfigureMilestonesUrl(topic.id)
                                    : ROUTES.CONFIGURE_MILESTONES
                                }
                                className={styles.managePhasesBtn}
                                title={t('lecturer.topics.managePhasesHint')}
                                data-testid="topic-manage-phases"
                                data-topic-id={topic.id ?? ''}
                              >
                                <BookOpen size={14} aria-hidden />
                                {t('lecturer.topics.managePhases')}
                                <span className={styles.managePhasesCount}>
                                  {t('lecturer.topics.groupCount').replace('{count}', String(groupCount))}
                                </span>
                              </Link>
                            )}
                            <div className={styles.topicSecondaryCluster}>
                              <button
                                type="button"
                                className={styles.topicActionSecondary}
                                onClick={() => openEditModal(topic)}
                                disabled={!topic.id}
                                title={t('lecturer.topics.editHint')}
                              >
                                <Pencil size={14} aria-hidden />
                                {t('lecturer.topics.edit')}
                              </button>
                            {topicStatus === 'OPEN' ? (
                              <button
                                type="button"
                                className={styles.closeTopicBtn}
                                onClick={() =>
                                  void handleTopicTransition(topic, 'CLOSED')
                                }
                                disabled={
                                  !topic.id || !canClose || inflight !== null
                                }
                                title={
                                  canClose
                                    ? t('lecturer.topics.closeHint')
                                    : t('lecturer.topics.closeDisHint')
                                }
                              >
                                {inflight === 'CLOSED' ? (
                                  <Loader
                                    size={14}
                                    className={styles.spinningIcon}
                                    aria-hidden
                                  />
                                ) : (
                                  <ToggleRight size={14} aria-hidden />
                                )}
                                {t('lecturer.topics.close')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={styles.openTopicBtn}
                                onClick={() =>
                                  void handleTopicTransition(topic, 'OPEN')
                                }
                                disabled={
                                  !topic.id || !canOpen || inflight !== null
                                }
                                title={
                                  canOpen
                                    ? t('lecturer.topics.reopenHint')
                                    : t('lecturer.topics.reopenDisHint')
                                }
                              >
                                {inflight === 'OPEN' ? (
                                  <Loader
                                    size={14}
                                    className={styles.spinningIcon}
                                    aria-hidden
                                  />
                                ) : (
                                  <ToggleLeft size={14} aria-hidden />
                                )}
                                {t('lecturer.topics.reopen')}
                              </button>
                            )}
                            <button
                              type="button"
                              className={styles.completeTopicBtn}
                              onClick={() =>
                                void handleTopicTransition(topic, 'COMPLETED')
                              }
                              disabled={
                                !topic.id || !canComplete || inflight !== null
                              }
                              title={
                                canComplete
                                  ? t('lecturer.topics.completeHint')
                                  : t('lecturer.topics.completeDisHint')
                              }
                            >
                              {inflight === 'COMPLETED' ? (
                                <Loader
                                  size={14}
                                  className={styles.spinningIcon}
                                  aria-hidden
                                />
                              ) : (
                                <CheckCircle2 size={14} aria-hidden />
                              )}
                              {t('lecturer.topics.markCompleted')}
                            </button>
                            <button
                              type="button"
                              className={styles.materialsTopicBtn}
                              onClick={() => handleOpenMaterials(topic)}
                              disabled={!topic.id}
                              title={t('lecturer.topics.materialsHint')}
                            >
                              <Library size={14} aria-hidden />
                              {t('lecturer.topics.manageMaterials')}
                            </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              startIndex={startIndex}
              endIndex={endIndex}
              onPrev={prev}
              onNext={next}
              onPage={setPage}
              itemLabel="topics"
            />
          </>
        )}
      </div>

      {/* CREATE TOPIC MODAL */}
      {showCreateModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span
                  className={styles.modalIconCircle}
                >
                  <Lightbulb size={18} aria-hidden />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>{t('lecturer.topics.createTitle')}</h3>
                  <span className={styles.modalSubtitle}>
                    {t('lecturer.topics.createSubtitle')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setShowCreateModal(false)}
                aria-label={t('lecturer.topics.cancel')}
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <form onSubmit={handleCreateTopicSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="topicName">
                  * {t('lecturer.topics.topicNameLabel')}
                </label>
                <input
                  id="topicName"
                  type="text"
                  className={`${styles.formInput} ${topicNameError ? styles.formInputError : ''}`}
                  value={topicName}
                  onChange={(e) => {
                    setTopicName(e.target.value);
                    if (topicNameError) setTopicNameError(null);
                  }}
                  placeholder={t('lecturer.topics.topicNamePlace')}
                  aria-invalid={Boolean(topicNameError)}
                  aria-describedby={topicNameError ? 'topic-name-error' : undefined}
                  required
                />
                <FieldError id="topic-name-error" message={topicNameError} testId="topic-name-error" />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="topicDesc">
                  {t('lecturer.topics.descLabel')}
                </label>
                <textarea
                  id="topicDesc"
                  className={styles.formTextarea}
                  value={topicDesc}
                  onChange={(e) => setTopicDesc(e.target.value)}
                  placeholder={t('lecturer.topics.descPlace')}
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="topicMaterialsUrl">
                  {t('lecturer.topics.urlLabel')}
                </label>
                <div className={styles.materialsBox}>
<input
                  id="topicMaterialsUrl"
                  type="url"
                  className={`${styles.materialsInput} ${topicMaterialsUrlError ? styles.formInputError : ''}`}
                  value={topicMaterialsUrl}
                  onChange={(e) => {
                    setTopicMaterialsUrl(e.target.value);
                    if (topicMaterialsUrlError) setTopicMaterialsUrlError(null);
                  }}
                  placeholder={t('lecturer.topics.urlPlace')}
                  aria-invalid={Boolean(topicMaterialsUrlError)}
                  aria-describedby={topicMaterialsUrlError ? 'topic-materials-url-error' : 'topic-materials-url-hint'}
                />
                <FieldError id="topic-materials-url-error" message={topicMaterialsUrlError} testId="topic-materials-url-error" />
                <div className={styles.materialsHint} id="topic-materials-url-hint">
                  {t('lecturer.topics.urlHint')}
                </div>
                </div>
              </div>

              {createError && (
                <div className={styles.errorBanner} role="alert">
                  <AlertTriangle size={14} aria-hidden />
                  <span>{createError}</span>
                </div>
              )}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreating}
                >
                  {t('lecturer.topics.cancel')}
                </button>
                <button
                  type="submit"
                  className={styles.submitNavyBtn}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <Loader size={14} className={styles.spinningIcon} aria-hidden />
                  ) : (
                    <Check size={14} aria-hidden />
                  )}
                  {isCreating ? t('lecturer.topics.creating') : t('lecturer.topics.createTopic')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TOPIC MODAL */}
      {topicForEdit && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalIconCircle}>
                  <Lightbulb size={18} aria-hidden />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>{t('lecturer.topics.editTitle')}</h3>
                  <span className={styles.modalSubtitle}>
                    {t('lecturer.topics.editSubtitle').replace('{id}', String(topicForEdit.id ?? '—'))}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={closeEditModal}
                aria-label={t('lecturer.topics.cancel')}
                disabled={isEditingTopic}
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <form onSubmit={handleEditTopicSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="editTopicTitle">
                  * {t('lecturer.topics.topicNameLabel')}
                </label>
                <input
                  id="editTopicTitle"
                  type="text"
                  className={`${styles.formInput} ${editTopicTitleError ? styles.formInputError : ''}`}
                  value={editTopicTitle}
                  onChange={(e) => {
                    setEditTopicTitle(e.target.value);
                    if (editTopicTitleError) setEditTopicTitleError(null);
                  }}
                  placeholder={t('lecturer.topics.editNamePlace')}
                  aria-invalid={Boolean(editTopicTitleError)}
                  aria-describedby={editTopicTitleError ? 'edit-topic-title-error' : undefined}
                  required
                />
                <FieldError id="edit-topic-title-error" message={editTopicTitleError} testId="edit-topic-title-error" />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="editTopicDesc">
                  {t('lecturer.topics.descLabel')}
                </label>
                <textarea
                  id="editTopicDesc"
                  className={styles.formTextarea}
                  value={editTopicDesc}
                  onChange={(e) => setEditTopicDesc(e.target.value)}
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="editTopicMaterialsUrl">
                  {t('lecturer.topics.urlLabel')}
                </label>
                <div className={styles.materialsBox}>
<input
                  id="editTopicMaterialsUrl"
                  type="url"
                  className={`${styles.materialsInput} ${editTopicMaterialsUrlError ? styles.formInputError : ''}`}
                  value={editTopicMaterialsUrl}
                  onChange={(e) => {
                    setEditTopicMaterialsUrl(e.target.value);
                    if (editTopicMaterialsUrlError) setEditTopicMaterialsUrlError(null);
                  }}
                  placeholder={t('lecturer.topics.urlPlace')}
                  aria-invalid={Boolean(editTopicMaterialsUrlError)}
                  aria-describedby={editTopicMaterialsUrlError ? 'edit-topic-materials-url-error' : undefined}
                />
                <FieldError id="edit-topic-materials-url-error" message={editTopicMaterialsUrlError} testId="edit-topic-materials-url-error" />
                </div>
              </div>

              {editTopicError && (
                <div className={styles.errorBanner} role="alert">
                  <AlertTriangle size={14} aria-hidden />
                  <span>{editTopicError}</span>
                </div>
              )}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={closeEditModal}
                  disabled={isEditingTopic}
                >
                  {t('lecturer.topics.cancel')}
                </button>
                <button
                  type="submit"
                  className={styles.submitNavyBtn}
                  disabled={isEditingTopic}
                >
                  {isEditingTopic ? (
                    <Loader
                      size={14}
                      className={styles.spinningIcon}
                      aria-hidden
                    />
                  ) : (
                    <Check size={14} aria-hidden />
                  )}
                  {isEditingTopic ? t('lecturer.topics.saving') : t('lecturer.topics.saveTopic')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE TOPIC MATERIALS MODAL */}
      <LearningMaterialModal
        isOpen={topicForMaterials !== null}
        topic={topicForMaterials}
        onClose={handleCloseMaterials}
        onSuccess={() => void refetchTopics()}
      />

      {/* ASSIGN TOPIC TO GROUPS MODAL */}
      <AssignTopicModal
        isOpen={assignModalTopic !== null}
        topic={assignModalTopic}
        groups={allGroups}
        currentLecturerId={currentLecturerId}
        onClose={() => setAssignModalTopic(null)}
        onSuccess={(outcomes) => {
          const succeeded = outcomes.filter((o) => o.ok).length;
          showBanner(
            succeeded > 0
              ? t('lecturer.topics.assignSuccess').replace('{count}', String(succeeded))
              : t('lecturer.topics.assignNone'),
          );
          void refetchTopics();
        }}
      />
    </div>
  );
};

export default ResearchTopicsPage;
