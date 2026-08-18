import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Check,
  Clock,
  DollarSign,
  Lock,
} from 'lucide-react';
import { ROUTES } from '../../routes/paths';
import { useAuthStore } from '../../store/authSlice';
import { reviewRequestService, type ReviewRequest } from '../../services/reviewRequest.service';
import { paperService, type Paper } from '../../services/paper.service';
import {
  getReviewRequestTab,
  normalizeReviewRequestStatus,
} from '../../utils/reviewRequestPolicy';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { usePagination } from '../../hooks/usePagination';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import styles from './AssignedReviews.module.css';

type StatusTab = 'pending' | 'inprogress' | 'completed';

const formatDeadline = (req: ReviewRequest): { text: string; tone: 'orange' | 'gray' } => {
  if (!req.deadline) return { text: 'No deadline set', tone: 'gray' };
  const d = new Date(req.deadline);
  if (Number.isNaN(d.getTime())) return { text: 'No deadline set', tone: 'gray' };
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  if (days <= 3) return { text: `Deadline: ${dateStr} • ${days} Days Remaining`, tone: 'orange' };
  return { text: `Deadline: ${dateStr} • ${days} Days Remaining`, tone: 'gray' };
};

const formatFee = (req: ReviewRequest): string => {
  const fee = req.fee ?? 0;
  return `${fee.toLocaleString('vi-VN')} VND`;
};

/**
 * Defect 2A item 5 — type-tolerant reviewer filter. `currentUserId` is
 * `number` (per `types/auth.ts`) but the BE may emit `reviewerId` as a
 * numeric string. We coerce both sides to a string before comparing so a
 * mixed-type row still matches.
 */
const matchesCurrentReviewer = (
  req: Pick<ReviewRequest, 'reviewerId'>,
  currentUserId: number | undefined,
): boolean => {
  if (currentUserId == null) return false;
  if (req.reviewerId == null) return false;
  return String(req.reviewerId) === String(currentUserId);
};

export const AssignedReviews = () => {
  const navigate = useNavigate();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [activeTab, setActiveTab] = useState<StatusTab>('pending');
  const [items, setItems] = useState<ReviewRequest[]>([]);
  const [paperById, setPaperById] = useState<Record<string, Paper>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await reviewRequestService.getAll();
      // Defect 2A items 1, 2, 5 — type-tolerant filter (`String(...)` on both
      // sides), centralized user-id comparator. Drops nothing on a mixed
      // string/number `reviewerId` payload.
      const assigned = list.filter((r) => matchesCurrentReviewer(r, currentUserId));
      setItems(assigned);

      // Hydrate papers for titles — only the ones we don't already have.
      // Defect 2A item 1 (paper-id type): keys are normalized strings so a
      // numeric `paperId` finds the same map entry as the stringified form.
      setPaperById((prevPaperById) => {
        const missingIds = Array.from(
          new Set(
            assigned
              .map((r) => r.paperId)
              .filter((id): id is number => typeof id === 'number' || typeof id === 'string')
              .map((id) => String(id))
              .filter((id) => !prevPaperById[id])
          )
        );
        if (missingIds.length === 0) return prevPaperById;
        // Fire-and-forget — caller doesn't await the paper cache. The UI
        // reads `paperById[String(req.paperId)]` which is undefined until the
        // fetch settles, and the surrounding code already falls back to
        // `Paper #${id}` in that case (defect 1B progressive hydration).
        void (async () => {
          const results = await Promise.allSettled(
            missingIds.map((id) => paperService.getById(id))
          );
          setPaperById((curr) => {
            const next: Record<string, Paper> = { ...curr };
            results.forEach((res, i) => {
              if (res.status === 'fulfilled') {
                next[missingIds[i]] = res.value;
              }
            });
            return next;
          });
        })();
        return prevPaperById;
      });
    } catch (err) {
      const message =
        (err as { message?: string })?.message ||
        'Failed to load assigned review tasks.';
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUserId]);

  // ── Event: re-fetch when a review is submitted from EvaluationDesk ────────────
  useEffect(() => {
    const handler = () => void load();
    window.addEventListener('review-update', handler);
    return () => window.removeEventListener('review-update', handler);
  }, [load]);

  // ── Initial load when the user id becomes available
  useEffect(() => {
    if (currentUserId == null) return;
    setIsLoading(true);
    void load();
  }, [currentUserId, load]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await load();
  };

  // Defect 2A item 6 — filter and counts go through the same centralized
  // `getReviewRequestTab` so they cannot drift apart. Replaces the prior
  // local lowercase `statusOf` switch which would miss whitespace / casing.
  const visible = useMemo(
    () => items.filter((r) => getReviewRequestTab(r.status) === activeTab),
    [items, activeTab]
  );

  // Search + pagination for the active tab.
  const [search, setSearch] = useState('');

  const paperTitle = (req: ReviewRequest): string => {
    if (req.paperId == null) return 'Untitled Paper';
    const paper = paperById[String(req.paperId)];
    return paper?.title || `Paper #${req.paperId}`;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((r) => {
      const title = paperTitle(r).toLowerCase();
      return (
        title.includes(q) ||
        (r.status ?? '').toLowerCase().includes(q) ||
        (r.type ?? '').toLowerCase().includes(q)
      );
    });
  }, [visible, search]);

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
  } = usePagination<ReviewRequest>(filtered, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetPage();
  }, [search, activeTab, resetPage]);

  const counts = useMemo(() => {
    let pending = 0;
    let inprogress = 0;
    let completed = 0;
    for (const r of items) {
      const tab = getReviewRequestTab(r.status);
      if (tab === 'pending') pending += 1;
      else if (tab === 'inprogress') inprogress += 1;
      else completed += 1;
    }
    return { pending, inprogress, completed };
  }, [items]);

  const isCompleted = (req: ReviewRequest) =>
    normalizeReviewRequestStatus(req.status) === 'COMPLETED';

  return (
    <div className={styles.tasksPage}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; <span className={styles.activeBreadcrumb}>Review Paper</span>
      </div>

      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Review Paper</h1>
          <p className={styles.pageSubtitle}>
            Manage your review assignments and track evaluation progress.
          </p>
        </div>
      </div>

      {/* Tabs list */}
      <div className={styles.tabsRow}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'pending' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending / Action Required ({counts.pending})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'inprogress' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('inprogress')}
        >
          In Progress ({counts.inprogress})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'completed' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed ({counts.completed})
        </button>
      </div>

      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        searchPlaceholder="Search by paper title, status, or type…"
        refreshLabel="Refresh"
      />

      {/* Tab content */}
      <div className={styles.tabContent}>
        {isLoading ? (
          <div className={styles.emptyState} data-testid="ar-loading" role="status">Loading assigned papers…</div>
        ) : error ? (
          <div className={styles.emptyState} data-testid="ar-error" role="alert">{error}</div>
        ) : visible.length === 0 ? (
          <div className={styles.emptyState} data-testid="ar-empty">
            {activeTab === 'pending' && 'No pending review tasks right now.'}
            {activeTab === 'inprogress' && 'No review tasks in progress.'}
            {activeTab === 'completed' && 'No completed reviews yet.'}
          </div>
        ) : totalItems === 0 ? (
          <div className={styles.emptyState} data-testid="ar-empty-search">
            No review tasks match "{search.trim()}".
          </div>
        ) : (
          <>
          <div className={styles.cardsList}>
            {pageItems.map((req) => {
              const deadline = formatDeadline(req);
              const feeText = formatFee(req);
              const completed = isCompleted(req);
              const rowKey = req.id ?? `${req.paperId}-${req.reviewerId}`;
              return (
                <div key={rowKey} className={styles.taskCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardHeaderLeft}>
                      <span className={styles.docIcon}>
                        {completed ? (
                          <Check size={18} color="#10b981" />
                        ) : (
                          <FileText size={18} color="#2563eb" />
                        )}
                      </span>
                      <div className={styles.docMeta}>
                        <h3 className={styles.docTitle}>{paperTitle(req)}</h3>
                        <span className={styles.authorName}>
                          {completed
                            ? 'Assignment completed'
                            : `Assigned to you • ${req.type ?? 'Peer Review'}`}
                        </span>
                      </div>
                    </div>
                    {completed ? (
                      // Defect 2B — View Scorecard is refresh-safe: pass the
                      // request id in the URL so a hard refresh (which loses
                      // `location.state`) still lands on the correct scorecard.
                      // `state` is also passed for the fast-path in-tab nav.
                      <button
                        className={styles.viewScorecardBtn}
                        onClick={() => {
                          const id = req.id != null ? `?reviewRequestId=${req.id}` : '';
                          navigate(
                            `${ROUTES.EVALUATION}${id}`,
                            { state: { reviewRequest: req } }
                          );
                        }}
                      >
                        View Scorecard
                      </button>
                    ) : (
                      <button
                        className={styles.evaluateBtn}
                        onClick={() =>
                          navigate(ROUTES.EVALUATION, { state: { reviewRequest: req } })
                        }
                      >
                        <Check size={13} style={{ verticalAlign: 'middle' }} /> Evaluate Paper
                      </button>
                    )}
                  </div>
                  <div className={styles.cardBadges}>
                    {req.deadline ? (
                      <span
                        className={
                          deadline.tone === 'orange' ? styles.deadlineOrange : styles.deadlineGray
                        }
                      >
                        <Clock size={12} style={{ verticalAlign: 'middle' }} /> {deadline.text}
                      </span>
                    ) : (
                      <span className={styles.deadlineGray}>
                        <Clock size={12} style={{ verticalAlign: 'middle' }} /> No deadline set
                      </span>
                    )}
                    {completed ? (
                      <span className={styles.feeReleased}>
                        <DollarSign size={12} style={{ verticalAlign: 'middle' }} /> {feeText} Released
                      </span>
                    ) : (
                      <span className={styles.feeLocked}>
                        <Lock size={12} style={{ verticalAlign: 'middle' }} /> {feeText} (Locked)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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
            itemLabel="review tasks"
          />
          </>
        )}
      </div>
    </div>
  );
};

export default AssignedReviews;
