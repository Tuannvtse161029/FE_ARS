// Lecturer — Guidance Projects console (Phase C, contract §3.1 / L1).
//
// Lists all `GuidanceProject` rows where the current lecturer is the
// supervisor. Provides status filter pills, free-text search across title and
// student name, a "Create Proposal" modal, and per-row actions gated by
// `canTransitionGuidanceProject`.
//
// No "invite student" UI (gap ticket §D.2). The Create Proposal modal only
// persists title + description + lecturerId; the `studentId` is left unset
// on the FE because the BE has no `POST /api/GuidanceProject/{id}/invite`
// endpoint yet. This is documented inline below.

import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  X,
  Loader,
  AlertTriangle,
  Check,
  ChevronRight,
  ClipboardCheck,
  Ban,
  FileText,
  Lightbulb,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGuidanceProjects } from '../../hooks/useGuidanceProjects';
import api from '../../services/axios';
import { API_ENDPOINTS } from '../../utils/constants';
import { canTransitionGuidanceProject } from '../../utils/researchStatus';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { usePagination } from '../../hooks/usePagination';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import type {
  GuidanceProject,
  GuidanceProjectStatus,
} from '../../types/research';
import { ROUTES } from '../../routes/paths';
import styles from './GuidanceProjects.module.css';

// Status filter pills — guarded by `canTransitionGuidanceProject`. The "All"
// entry is implicit (no filter).
type StatusFilter = 'ALL' | GuidanceProjectStatus;
const STATUS_FILTERS: ReadonlyArray<{ key: StatusFilter; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'PROPOSED', label: 'Proposed' },
  { key: 'ONGOING', label: 'Ongoing' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

interface BannerState {
  visible: boolean;
  text: string;
  variant: 'success' | 'error';
}

interface CreateProposalForm {
  title: string;
  description: string;
}

// Shape returned by POST /api/GuidanceProject. We accept the loose
// service-style row that may carry either `id` or `guidanceProjectId`; the
// list hook will re-normalise next time it refetches.
const createdToGuidanceProject = (
  raw: unknown,
  fallbackLecturerId: number,
): GuidanceProject | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const idCandidate =
    (typeof r.id === 'number' && r.id) ||
    (typeof r.guidanceProjectId === 'number' && r.guidanceProjectId) ||
    0;
  const studentIdCandidate =
    (typeof r.studentId === 'number' && r.studentId) || 0;
  if (idCandidate === 0) return null;
  return {
    id: idCandidate,
    lecturerId: fallbackLecturerId,
    studentId: studentIdCandidate,
    title:
      typeof r.title === 'string' && r.title.trim().length > 0
        ? r.title
        : `Project #${idCandidate}`,
    description:
      typeof r.description === 'string' ? r.description : undefined,
    status: 'PROPOSED',
    createdAt:
      typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
    updatedAt:
      typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString(),
  };
};

export const GuidanceProjects = () => {
  const { user } = useAuth();
  const lecturerId = user?.userId ?? null;

  const {
    projects,
    isLoading,
    error: listError,
    refetch,
  } = useGuidanceProjects();

  // Client-side filter — the BE doesn't expose `?lecturerId=` on
  // GuidanceProject (documented gap §2 / docs/local-only/research-workflow-contract.md).
  const myProjects = useMemo<GuidanceProject[]>(
    () =>
      lecturerId && Array.isArray(projects)
        ? projects.filter((p) => p.lecturerId === lecturerId)
        : [],
    [projects, lecturerId],
  );

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');

  const filtered = useMemo<GuidanceProject[]>(() => {
    const normalisedSearch = search.trim().toLowerCase();
    const base = myProjects.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (normalisedSearch.length === 0) return true;
      const titleMatch = (p.title ?? '').toLowerCase().includes(normalisedSearch);
      // The BE doesn't echo a student *name*; we have `studentId` only.
      // Fall back to the numeric id string so the search still finds
      // matches by id (e.g. typing "42" surfaces project with studentId=42).
      const studentLabel = p.studentId ? `#${p.studentId}` : '';
      const studentMatch =
        p.studentId && String(p.studentId).includes(normalisedSearch);
      return (
        titleMatch ||
        Boolean(studentMatch) ||
        studentLabel.toLowerCase().includes(normalisedSearch)
      );
    });
    // Newest first by createdAt.
    return [...base].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    );
  }, [myProjects, statusFilter, search]);

  // Counts by status — surfaces in the pill labels.
  const countsByStatus = useMemo(() => {
    const acc: Record<StatusFilter, number> = {
      ALL: myProjects.length,
      PROPOSED: 0,
      ONGOING: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const p of myProjects) {
      acc[p.status] += 1;
    }
    return acc;
  }, [myProjects]);

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
  } = usePagination<GuidanceProject>(filtered, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetPage();
  }, [search, statusFilter, resetPage]);

  const isRefreshing = isLoading && myProjects.length > 0;

  // ── Modal: Create Proposal ────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateProposalForm>({
    title: '',
    description: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Banner ────────────────────────────────────────────────────────────
  const [banner, setBanner] = useState<BannerState>({
    visible: false,
    text: '',
    variant: 'success',
  });

  // ── Per-row action state ──────────────────────────────────────────────
  const [pendingTransition, setPendingTransition] = useState<{
    id: number;
    to: GuidanceProjectStatus;
  } | null>(null);

  const showBanner = (text: string, variant: 'success' | 'error' = 'success') => {
    setBanner({ visible: true, text, variant });
    window.setTimeout(
      () => setBanner({ visible: false, text: '', variant: 'success' }),
      4000,
    );
  };

  const handleOpenCreate = () => {
    setCreateForm({ title: '', description: '' });
    setCreateError(null);
    setShowCreate(true);
  };

  const handleCloseCreate = () => {
    if (isCreating) return; // ignore during submit
    setShowCreate(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lecturerId) {
      setCreateError('No lecturer session — please sign in again.');
      return;
    }
    const title = createForm.title.trim();
    if (!title) {
      setCreateError('Title is required.');
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      // The BE guidance-project table has no column for an "invited student"
      // — only `LecturerId`, `StudentId`. Until `/api/GuidanceProject/invite`
      // ships (gap ticket §D.2) the FE persists the proposal with
      // `studentId` unset and the student picks it up via the dashboard
      // disabled-with-tooltip "Request supervision" affordance. Posted body
      // shape mirrors Swagger /api/GuidanceProject POST.
      const body = {
        lecturerId,
        title,
        description: createForm.description.trim() || null,
        // Status defaults to PROPOSED on the BE.
      };
      const response = await api.post<unknown>(
        API_ENDPOINTS.RESEARCH_WORKFLOW.GUIDANCE_PROJECT.CREATE,
        body,
      );
      const created = createdToGuidanceProject(response.data, lecturerId);
      setShowCreate(false);
      setCreateForm({ title: '', description: '' });
      showBanner(
        created
          ? `Guidance Project "${created.title}" created. Inviting a student is not yet supported (gap ticket §D.2).`
          : 'Guidance Project created. The student can be invited once the BE adds the /invite endpoint (gap ticket §D.2).',
      );
      await refetch();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create the project.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  // Update the status of one project — gated by canTransitionGuidanceProject.
  // Errors (including 409 invalid-state-transition from the BE) surface
  // verbatim in the existing error-banner pattern.
  const handleTransition = async (
    project: GuidanceProject,
    to: GuidanceProjectStatus,
  ) => {
    if (!canTransitionGuidanceProject(project.status, to)) {
      showBanner(
        `Cannot transition this project from ${project.status} to ${to} — not allowed by the workflow contract.`,
        'error',
      );
      return;
    }
    setPendingTransition({ id: project.id, to });
    try {
      await api.put<unknown>(
        API_ENDPOINTS.RESEARCH_WORKFLOW.GUIDANCE_PROJECT.UPDATE(project.id),
        { status: to },
      );
      showBanner(
        `Project marked as ${to}.`,
        'success',
      );
      await refetch();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'The transition was rejected by the server.';
      showBanner(`Transition failed: ${message}`, 'error');
    } finally {
      setPendingTransition(null);
    }
  };

  // We do NOT show "Invite Student" / "Accept" / "Decline" UI — the BE has no
  // GroupInvitation endpoint yet (api-gap-ticket-for-be.md §D.2). Render a
  // single line below the per-row actions so this is explicit.
  // Documented inline at §L1.f.

  return (
    <div className={styles.root}>
      <div className={styles.breadcrumbs}>
        Home &gt; <span className={styles.activeBreadcrumb}>Guidance Projects</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Guidance Projects</h1>
          <p className={styles.pageSubtitle}>
            Track every supervision relationship you have proposed, taken on, or
            completed.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleOpenCreate}
            disabled={lecturerId === null}
            title={
              lecturerId === null
                ? 'No lecturer session — please sign in again.'
                : 'Create a new guidance project proposal.'
            }
          >
            <Plus size={14} aria-hidden />
            Create Proposal
          </button>
        </div>
      </div>

      {banner.visible && (
        <div
          className={`${styles.banner} ${
            banner.variant === 'success' ? styles.bannerSuccess : styles.bannerError
          }`}
          role="status"
        >
          <span className={styles.bannerIcon}>
            {banner.variant === 'success' ? (
              <Check size={14} strokeWidth={3} aria-hidden />
            ) : (
              <AlertTriangle size={14} aria-hidden />
            )}
          </span>
          <span className={styles.bannerText}>{banner.text}</span>
          <button
            type="button"
            className={styles.bannerCloseBtn}
            onClick={() =>
              setBanner({ visible: false, text: '', variant: 'success' })
            }
            aria-label="Dismiss"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      {(listError || lecturerId === null) && (
        <div className={styles.errorBanner} role="alert">
          <span className={styles.errorBannerIcon}>
            <AlertTriangle size={14} aria-hidden />
            <span>
              {listError?.message ??
                (lecturerId === null
                  ? 'No lecturer session detected.'
                  : 'Failed to load guidance projects.')}
            </span>
          </span>
          <button
            type="button"
            className={styles.errorRetryBtn}
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      )}

      {/* D.2 gap banner — visible regardless of row count so the missing
          invite endpoint isn't hidden when there are 0 projects. */}
      <div className={styles.gapBanner} role="note">
        <Lightbulb size={14} aria-hidden />
        <span>
          <b>Invite a student</b> is currently disabled — the backend has no{' '}
          <code>POST /api/GuidanceProject/&#123;id&#125;/invite</code> endpoint
          yet (gap ticket §D.2). Use the Create Proposal form to set up a{' '}
          <code>PROPOSED</code> project; students will see it on their
          dashboard once BE ships the request-supervision flow.
        </span>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <div className={styles.statusPills} role="tablist" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => {
            const count = countsByStatus[f.key] ?? 0;
            const active = statusFilter === f.key;
            return (
              <button
                type="button"
                key={f.key}
                role="tab"
                aria-selected={active}
                className={`${styles.statusPill} ${active ? styles.statusPillActive : ''}`}
                onClick={() => setStatusFilter(f.key)}
              >
                {f.label}
                <span className={styles.statusPillCount}>{count}</span>
              </button>
            );
          })}
        </div>
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          onRefresh={() => void refetch()}
          isRefreshing={isRefreshing}
          searchPlaceholder="Search by title or student id…"
          refreshLabel="Refresh"
        />
      </div>

      {/* Table */}
      <div className={styles.tableCard}>
        {isLoading ? (
          <div className={styles.tableEmpty} role="status" data-testid="gp-loading">
            <Loader size={16} className={styles.spinningIcon} aria-hidden />
            Loading guidance projects…
          </div>
        ) : listError ? (
          <div className={styles.tableEmpty} role="alert" data-testid="gp-error">
            <AlertTriangle size={16} aria-hidden /> {listError.message}
          </div>
        ) : myProjects.length === 0 ? (
          <div className={styles.tableEmpty} data-testid="gp-empty">
            You haven&apos;t created any guidance projects yet. Click &quot;Create Proposal&quot; to start one.
          </div>
        ) : totalItems === 0 ? (
          <div className={styles.tableEmpty} data-testid="gp-empty-search">
            No guidance projects match the current filter.
          </div>
        ) : (
          <>
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>PROJECT</th>
                    <th>STUDENT</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((project) => {
                    const canCancel = canTransitionGuidanceProject(
                      project.status,
                      'CANCELLED',
                    );
                    const canComplete = canTransitionGuidanceProject(
                      project.status,
                      'COMPLETED',
                    );
                    const inFlight =
                      pendingTransition?.id === project.id
                        ? pendingTransition.to
                        : null;
                    return (
                      <tr key={project.id} data-testid="gp-row">
                        <td>
                          <div className={styles.titleCell}>
                            <span className={styles.titlePill}>GP-{project.id}</span>
                            <div className={styles.titleText}>{project.title}</div>
                            {project.description?.trim() && (
                              <div className={styles.titleDescription}>
                                {project.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          {project.studentId ? (
                            <span className={styles.studentPill}>
                              student #{project.studentId}
                            </span>
                          ) : (
                            <span className={styles.studentEmpty}>
                              Unassigned (gap §D.2)
                            </span>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={project.status} />
                        </td>
                        <td>
                          <div className={styles.actionRow}>
                            <RouterLink
                              to={ROUTES.LECTURER_EVALUATE_REPORTS}
                              className={styles.viewLink}
                              title="Open the review console (link to all supervision tasks)."
                            >
                              <FileText size={14} aria-hidden />
                              View
                              <ChevronRight size={14} aria-hidden />
                            </RouterLink>
                            <button
                              type="button"
                              className={styles.cancelBtn}
                              onClick={() =>
                                void handleTransition(project, 'CANCELLED')
                              }
                              disabled={!canCancel || inFlight !== null}
                              title={
                                canCancel
                                  ? 'Mark project as CANCELLED.'
                                  : `Cannot transition from ${project.status} to CANCELLED.`
                              }
                              aria-label="Cancel project"
                            >
                              {inFlight === 'CANCELLED' ? (
                                <Loader
                                  size={14}
                                  className={styles.spinningIcon}
                                  aria-hidden
                                />
                              ) : (
                                <Ban size={14} aria-hidden />
                              )}
                              Cancel
                            </button>
                            <button
                              type="button"
                              className={styles.completeBtn}
                              onClick={() =>
                                void handleTransition(project, 'COMPLETED')
                              }
                              disabled={!canComplete || inFlight !== null}
                              title={
                                canComplete
                                  ? 'Mark project as COMPLETED.'
                                  : `Cannot transition from ${project.status} to COMPLETED.`
                              }
                              aria-label="Mark complete"
                            >
                              {inFlight === 'COMPLETED' ? (
                                <Loader
                                  size={14}
                                  className={styles.spinningIcon}
                                  aria-hidden
                                />
                              ) : (
                                <ClipboardCheck size={14} aria-hidden />
                              )}
                              Complete
                            </button>
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
              itemLabel="guidance projects"
            />
          </>
        )}
      </div>

      {/* CREATE PROPOSAL MODAL */}
      {showCreate && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalIconCircle}>
                  <Plus size={18} aria-hidden />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>Create Guidance Proposal</h3>
                  <span className={styles.modalSubtitle}>
                    The proposal is saved with status <code>PROPOSED</code>.
                    Inviting a student is pending BE (gap ticket §D.2).
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={handleCloseCreate}
                aria-label="Close create proposal"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="proposal-title">
                  * Project Title
                </label>
                <input
                  id="proposal-title"
                  type="text"
                  className={styles.formInput}
                  value={createForm.title}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  placeholder="PhD Co-Supervision — Distributed Speech-to-Text"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="proposal-desc">
                  Description
                </label>
                <textarea
                  id="proposal-desc"
                  className={styles.formTextarea}
                  rows={4}
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="A short summary of the research scope, deliverables, and any prerequisites."
                />
              </div>

              {createError && (
                <div className={styles.formErrorBanner} role="alert">
                  <AlertTriangle size={14} aria-hidden />
                  <span>{createError}</span>
                </div>
              )}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={handleCloseCreate}
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <Loader
                      size={14}
                      className={styles.spinningIcon}
                      aria-hidden
                    />
                  ) : (
                    <Check size={14} aria-hidden />
                  )}
                  {isCreating ? 'Creating…' : 'Create Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hint card — view existing groups from this Proposal. The link is to
          a stable Lecturer page (Research Group) so power users can drill
          in. The card is intentionally minimal — no fake data. */}
      {totalItems > 0 && (
        <div className={styles.hintCard}>
          <Link
            to={ROUTES.RESEARCH_GROUP}
            className={styles.hintLink}
          >
            Open the Research Group console to inspect group rosters, members, and deadlines for ONGOING projects.
            <ChevronRight size={14} aria-hidden />
          </Link>
        </div>
      )}
    </div>
  );
};

export default GuidanceProjects;
