import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
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
import styles from './AssignedReviews.module.css';

type StatusTab = 'pending' | 'inprogress' | 'completed';

const statusOf = (req: ReviewRequest): StatusTab => {
  const s = (req.status ?? 'Pending').toLowerCase();
  if (s === 'inprogress' || s === 'in progress' || s === 'in-progress') return 'inprogress';
  if (s === 'completed' || s === 'complete' || s === 'done') return 'completed';
  return 'pending';
};

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

export const AssignedReviews = () => {
  const navigate = useNavigate();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [activeTab, setActiveTab] = useState<StatusTab>('pending');
  const [items, setItems] = useState<ReviewRequest[]>([]);
  const [paperById, setPaperById] = useState<Record<string, Paper>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const list = await reviewRequestService.getAll();
      const assigned = list.filter((r) => r.reviewerId === currentUserId);
      setItems(assigned);

      // Hydrate papers for titles — only the ones we don't already have
      const missingIds = Array.from(
        new Set(
          assigned
            .map((r) => r.paperId)
            .filter((id): id is number => typeof id === 'number')
            .map((id) => String(id))
            .filter((id) => !paperById[id])
        )
      );
      if (missingIds.length > 0) {
        const results = await Promise.allSettled(
          missingIds.map((id) => paperService.getById(id))
        );
        const next: Record<string, Paper> = { ...paperById };
        results.forEach((res, i) => {
          if (res.status === 'fulfilled') {
            next[missingIds[i]] = res.value;
          }
        });
        setPaperById(next);
      }
    } catch (err) {
      const message =
        (err as { message?: string })?.message ||
        'Failed to load assigned review tasks.';
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // ── Event: re-fetch when a review is submitted from EvaluationDesk ────────────
  useEffect(() => {
    const handler = () => void load();
    window.addEventListener('review-update', handler);
    return () => window.removeEventListener('review-update', handler);
  }, []); // intentionally empty — `load` is stable; event drives refreshes

  // ── Initial load when the user id becomes available
  useEffect(() => {
    if (currentUserId == null) return;
    setIsLoading(true);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await load();
  };

  const visible = useMemo(
    () => items.filter((r) => statusOf(r) === activeTab),
    [items, activeTab]
  );

  const counts = useMemo(() => {
    return {
      pending: items.filter((r) => statusOf(r) === 'pending').length,
      inprogress: items.filter((r) => statusOf(r) === 'inprogress').length,
      completed: items.filter((r) => statusOf(r) === 'completed').length,
    };
  }, [items]);

  const paperTitle = (req: ReviewRequest): string => {
    if (req.paperId == null) return 'Untitled Paper';
    const paper = paperById[String(req.paperId)];
    return paper?.title || `Paper #${req.paperId}`;
  };

  const isCompleted = (req: ReviewRequest) => statusOf(req) === 'completed';

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
        <button
          className={styles.refreshBtn}
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          title="Refresh assigned papers"
          aria-label="Refresh assigned papers"
        >
          <RefreshCw
            size={14}
            style={{
              marginRight: '6px',
              verticalAlign: 'middle',
              animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
            }}
          />
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </button>
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

      {/* Tab content */}
      <div className={styles.tabContent}>
        {isLoading ? (
          <div className={styles.emptyState}>Loading assigned papers…</div>
        ) : error ? (
          <div className={styles.emptyState}>{error}</div>
        ) : visible.length === 0 ? (
          <div className={styles.emptyState}>
            {activeTab === 'pending' && 'No pending review tasks right now.'}
            {activeTab === 'inprogress' && 'No review tasks in progress.'}
            {activeTab === 'completed' && 'No completed reviews yet.'}
          </div>
        ) : (
          <div className={styles.cardsList}>
            {visible.map((req) => {
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
                      <button
                        className={styles.viewScorecardBtn}
                        onClick={() =>
                          navigate(ROUTES.EVALUATION, { state: { reviewRequest: req } })
                        }
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
        )}
      </div>
    </div>
  );
};

export default AssignedReviews;
