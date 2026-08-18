import { useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  FileText,
  AlertTriangle,
  X,
  Shield,
  Check,
} from 'lucide-react';
import { TopUpModal } from './components/TopUpModal';
import { ReviewRequestDetailsModal } from '../../components/reviewer/ReviewRequestDetailsModal';
import { ReviewRequestStatusBadge } from '../../components/reviewer/ReviewRequestStatusBadge';
import { paperService } from '../../services/paper.service';
import type { Paper } from '../../services/paper.service';
import type { ReviewerProfile } from '../../services/reviewer.service';
import { reviewRequestService, type ReviewRequest } from '../../services/reviewRequest.service';
import { useReviewerProfiles } from '../../hooks/useReviewerProfiles';
import { useFollowReviewer } from '../../hooks/useFollowers';
import { useWallet } from '../../hooks/useWallet';
import { usePaperReviewLocks } from '../../hooks/usePaperReviewLocks';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { usePagination } from '../../hooks/usePagination';
import { DEFAULT_PAGE_SIZE, REVIEWER_GRID_PAGE_SIZE } from '../../utils/tableConstants';
import {
  resolvePaperTitle,
} from '../../utils/reviewRequestDisplay';
import styles from './DiscoverReviewers.module.css';

// Domain shape used by the UI. All values are derived from the BE
// ReviewerProfile rows; previously they were hardcoded for seeded users.
interface Reviewer {
  id: string;
  name: string;
  title: string;
  initials: string;
  avatarBg: string;
  hIndex: number;
  publications: number;
  reviews: number;
  fee: number;
  tags: string[];
  orcid: string;
  specializations: string[];
}

const COLD_PALETTE = ['#1D2A4A', '#3b82f6', '#f59e0b'];

function initialsFromName(name: string): string {
  const parts = name
    .replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColorForUserId(userId: number): string {
  return COLD_PALETTE[userId % COLD_PALETTE.length];
}

interface EnrichedReviewer extends ReviewerProfile {
  fullName?: string | null;
  title?: string | null;
  avatarBg?: string | null;
  reviews?: number;
  tags?: string[];
  specializations?: string[];
}

function mapProfileToReviewer(p: EnrichedReviewer): Reviewer {
  const userId = p.userId;
  // Real name only — never invent one. Until the BE populates `fullName`,
  // show an honest, transparent placeholder so users see that the data
  // simply isn't there yet (was: `Reviewer #${userId}`).
  const name = p.fullName?.trim() || 'Reviewer (profile not yet completed)';
  return {
    id: `rev-${userId}`,
    name,
    title: p.title?.trim() || 'Reviewer',
    initials: initialsFromName(name),
    avatarBg: p.avatarBg || avatarColorForUserId(userId),
    hIndex: p.hindex ?? 0,
    publications: p.publicationCount ?? 0,
    reviews: p.reviews ?? 0,
    fee: p.reviewFee ?? 0,
    tags: Array.isArray(p.tags) ? p.tags : [],
    orcid: p.orcidId ?? '',
    specializations: Array.isArray(p.specializations) ? p.specializations : [],
  };
}

export const DiscoverReviewers = () => {
  // Navigation & Tabs state
  const [activeTab, setActiveTab] = useState<'discover' | 'requests'>('discover');
  const [screenState, setScreenState] = useState<'list' | 'create-request'>('list');

  // Wallet balance loaded from the BE (no hardcoded 1,500,000 fallback).
  const { balance: walletBalance } = useWallet();

  // Selected reviewer for creating request
  const [selectedReviewer, setSelectedReviewer] = useState<Reviewer | null>(null);

  // Modal states
  const [topUpReviewer, setTopUpReviewer] = useState<Reviewer | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSubmittedRequest, setLastSubmittedRequest] = useState<ReviewRequest | null>(null);

  // Form states
  const [selectedPaperId, setSelectedPaperId] = useState('');
  const [notes, setNotes] = useState('');
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);

  // Submit + hydration state
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // View-Details modal state (defect 1C). Single state object — null = closed.
  const [detailsRequest, setDetailsRequest] = useState<ReviewRequest | null>(null);

  // Review requests history state — hydrated from the shared paper-review-locks hook
  // so the policy decisions in this page and the lock decisions in /papers use the
  // same source of truth. The hook keeps its own loading/error/refetch lifecycle.
  const {
    requests,
    isLoading: isLoadingRequests,
    error: requestsErrorRaw,
    refetch: refetchReviewRequests,
    mergePendingRequest,
  } = usePaperReviewLocks();
  const requestsError = requestsErrorRaw?.message ?? null;
  const [papers, setPapers] = useState<Paper[]>([]);

  // Reviewer profiles loaded from /api/ProfessionalProfile via custom hook.
  const {
    profiles: reviewerProfiles,
    isLoading: isLoadingReviewers,
    refetch: refetchReviewers,
  } = useReviewerProfiles();

  // Follow mutation (wired to POST /api/Follower; UI button can use this).
  const { follow, isLoading: isFollowing } = useFollowReviewer();

  // ── Event: re-fetch My Review Requests when a review is submitted ───────────
  useEffect(() => {
    const handler = () => void refetchReviewRequests();
    window.addEventListener('review-update', handler);
    return () => window.removeEventListener('review-update', handler);
  }, [refetchReviewRequests]);

  // Fetch papers for reviewer recommendation dropdown
  useEffect(() => {
    paperService.getAll().then((result) => {
      setPapers(result.items);
    }).catch(() => {
      // silently fail — dropdown stays empty
    });
  }, []);

  // Render reviewers — shows every reviewer the BE returned, ignoring the
  // historical seed-user filter. Reviewers marked isAvailable !== false are kept;
  // missing/undefined defaults to available (matches the previous dev default).
  const reviewers: Reviewer[] = useMemo(() => {
    return reviewerProfiles
      .filter((p) => (p as { isAvailable?: boolean }).isAvailable !== false)
      .map(mapProfileToReviewer);
  }, [reviewerProfiles]);

  // Reviewer grid search + refresh state
  const [reviewerSearch, setReviewerSearch] = useState('');
  const [isRefreshingReviewers, setIsRefreshingReviewers] = useState(false);

  const filteredReviewers = useMemo(() => {
    const q = reviewerSearch.trim().toLowerCase();
    if (!q) return reviewers;
    return reviewers.filter((r) =>
      [r.name, r.title, r.orcid, ...(r.tags ?? []), ...(r.specializations ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [reviewers, reviewerSearch]);

  const {
    page: reviewerPage,
    totalPages: reviewerTotalPages,
    totalItems: reviewerTotalItems,
    startIndex: reviewerStartIndex,
    endIndex: reviewerEndIndex,
    pageItems: pagedReviewers,
    setPage: setReviewerPage,
    next: nextReviewerPage,
    prev: prevReviewerPage,
    resetPage: resetReviewerPage,
  } = usePagination<Reviewer>(filteredReviewers, REVIEWER_GRID_PAGE_SIZE);

  useEffect(() => {
    resetReviewerPage();
  }, [reviewerSearch, resetReviewerPage]);

  const handleRefreshReviewers = async () => {
    if (isRefreshingReviewers) return;
    setIsRefreshingReviewers(true);
    try {
      await refetchReviewers();
    } finally {
      setIsRefreshingReviewers(false);
    }
  };

  // My Review Requests table — search + pagination
  const [requestSearch, setRequestSearch] = useState('');

  // ── Hydrate My Review Requests from the BE when the tab is first opened.
  // The hook handles its own fetch lifecycle; we only guard against an
  // empty array that the hook has not yet resolved.
  useEffect(() => {
    if (activeTab === 'requests' && requests.length === 0 && !isLoadingRequests) {
      void refetchReviewRequests();
    }
  }, [activeTab, requests.length, isLoadingRequests, refetchReviewRequests]);

  // Lookups for joining BE ReviewRequest rows → UI display fields.

  // Papers keyed by normalized string id — `Paper.id` is `string` but
  // `ReviewRequest.paperId` is `number`, so a number-keyed Map misses. We
  // normalize via `String(...)` here AND when comparing on the lookup side
  // (defect 1B item 1).
  const papersById = useMemo(() => {
    const m = new Map<string, Paper>();
    for (const p of papers) {
      const id = p.id != null ? String(p.id) : '';
      if (id) m.set(id, p);
    }
    return m;
  }, [papers]);

  // Out-of-band paper cache: populated by `paperService.getById(...)` when a
  // row's paper is missing from the first page of `paperService.getAll()`.
  // See defect 1B — historical papers on later pages must still display.
  const [extraPapersById, setExtraPapersById] = useState<Map<string, Paper>>(
    () => new Map<string, Paper>(),
  );
  // Tracks which ids are currently being fetched so we don't fire duplicate
  // GETs for the same paper when many rows reference it.
  const [loadingPaperIds, setLoadingPaperIds] = useState<Set<string>>(
    () => new Set<string>(),
  );

  // ── Progressive paper hydration (defect 1B) ────────────────────────────────
  // For every request whose paper is NOT in the page list AND NOT in the
  // extra cache AND NOT currently being fetched, fire one `paperService.getById`
  // and cache the result. Skips a request when `paperId` is null/undefined.
  useEffect(() => {
    if (activeTab !== 'requests') return;
    if (requests.length === 0) return;
    const toFetch: string[] = [];
    for (const req of requests) {
      const pid = req.paperId;
      if (pid == null) continue;
      const normId = String(pid);
      if (papersById.has(normId)) continue;
      if (extraPapersById.has(normId)) continue;
      if (loadingPaperIds.has(normId)) continue;
      toFetch.push(normId);
    }
    if (toFetch.length === 0) return;
    setLoadingPaperIds((prev) => {
      const next = new Set(prev);
      for (const id of toFetch) next.add(id);
      return next;
    });
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(
        toFetch.map((id) => paperService.getById(id))
      );
      if (cancelled) return;
      setExtraPapersById((prev) => {
        const next = new Map(prev);
        for (let i = 0; i < results.length; i += 1) {
          const r = results[i];
          if (r.status === 'fulfilled') {
            const id = toFetch[i];
            next.set(String(id), r.value);
          }
        }
        return next;
      });
      setLoadingPaperIds((prev) => {
        const next = new Set(prev);
        for (const id of toFetch) next.delete(id);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // We intentionally exclude extraPapersById / papersById from deps — they
    // are mutated by this effect and would otherwise re-fire the fetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, requests]);

  // Reviewer lookup uses ALL profiles (not just currently-available ones).
  // Availability affects discovery / assignment, not historical display —
  // a Reviewer who completed a request and later flipped availability off
  // must still appear on the row (defect 1B item 2). `fullName` may be
  // missing on the BE payload — fall back to an honest placeholder so we
  // never invent a name.
  const reviewerNameByUserId = useMemo(() => {
    const m = new Map<string, { name: string; initials: string; avatarBg: string }>();
    for (const p of reviewerProfiles) {
      const name =
        ((p as { fullName?: string }).fullName ?? '').trim() ||
        'Reviewer (profile not yet completed)';
      const initials = initialsFromName(name);
      const avatarBg = (p as { avatarBg?: string }).avatarBg ?? avatarColorForUserId(p.userId);
      m.set(String(p.userId), { name, initials, avatarBg });
    }
    return m;
  }, [reviewerProfiles]);

  // Resolve a Reviewer's display info with type-tolerant `reviewerId`
  // matching (defect 1B item 5 — strict equality drops rows).
  const lookupReviewer = (req: Pick<ReviewRequest, 'reviewerId' | 'reviewerName'>) => {
    if (req.reviewerName && req.reviewerName.trim()) {
      const trimmed = req.reviewerName.trim();
      return {
        name: trimmed,
        initials: initialsFromName(trimmed),
        avatarBg: '#1D2A4A',
      };
    }
    if (req.reviewerId == null) return null;
    return (
      reviewerNameByUserId.get(String(req.reviewerId)) ??
      reviewerNameByUserId.get(String(Number(req.reviewerId))) ??
      null
    );
  };

  // My Review Requests table — search + pagination

  const filteredRequests = useMemo(() => {
    const q = requestSearch.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((req) => {
      const title = resolvePaperTitle({ req, papersById, extraPapersById });
      const titleText =
        title.kind === 'title'
          ? title.title
          : title.kind === 'id'
            ? `Paper #${title.paperId}`
            : '';
      const reviewerInfo = lookupReviewer(req);
      const reviewerName = reviewerInfo?.name ?? '';
      return (
        titleText.toLowerCase().includes(q) ||
        reviewerName.toLowerCase().includes(q) ||
        (req.status ?? '').toLowerCase().includes(q)
      );
    });
  }, [requests, requestSearch, papersById, extraPapersById]);

  const {
    page: reqPage,
    totalPages: reqTotalPages,
    totalItems: reqTotalItems,
    startIndex: reqStartIndex,
    endIndex: reqEndIndex,
    pageItems: pagedRequests,
    setPage: setReqPage,
    next: nextReqPage,
    prev: prevReqPage,
    resetPage: resetReqPage,
  } = usePagination<ReviewRequest>(filteredRequests, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetReqPage();
  }, [requestSearch, resetReqPage]);

  const handleRequestClick = (reviewer: Reviewer) => {
    setSelectedReviewer(reviewer);
    setScreenState('create-request');
  };

  const handleProceedToPayment = async () => {
    if (!selectedReviewer) return;
    if (!selectedPaperId) {
      setSubmitError('Please select a paper to submit for review.');
      return;
    }
    if (!acceptedPolicy) {
      setSubmitError('Please read and accept the Lock & Refund Policy before proceeding.');
      return;
    }

    setSubmitError(null);
    setIsSubmittingRequest(true);

    const totalDeductible = selectedReviewer.fee + 25000; // Fee + processing tax
    const reviewerUserId = parseInt(selectedReviewer.id.replace('rev-', ''), 10);
    const paperNumericId = parseInt(selectedPaperId, 10);

    try {
      // 1. Persist the request via the BE.
      const created = await reviewRequestService.create({
        paperId: Number.isFinite(paperNumericId) ? paperNumericId : null,
        reviewerId: Number.isFinite(reviewerUserId) ? reviewerUserId : null,
        fee: totalDeductible,
        status: 'Pending',
      });

      // 2. Best-effort follow the reviewer (does not block submission).
      if (Number.isFinite(reviewerUserId)) {
        await follow(reviewerUserId).catch(() => false);
      }

      // 3. Optimistically mark the new request in the hook state so the
      //    paper lock updates in /papers BEFORE the BE roundtrip resolves.
      //    The BE create response is documented only as `200: OK`; historically
      //    the persisted row came back under the BE field `reviewRequestId`,
      //    while the service getter normalizes it to `id`. Accept both.
      const createdAsAny = created as ReviewRequest & { reviewRequestId?: number | null };
      const normalizedCreated: ReviewRequest = {
        id: created.id ?? (typeof createdAsAny.reviewRequestId === 'number' ? createdAsAny.reviewRequestId : undefined),
        paperId: created.paperId ?? (Number.isFinite(paperNumericId) ? paperNumericId : null),
        reviewerId: created.reviewerId ?? (Number.isFinite(reviewerUserId) ? reviewerUserId : null),
        fee: created.fee ?? totalDeductible,
        status: created.status ?? 'Pending',
        deadline: created.deadline ?? null,
        airecommended: created.airecommended ?? null,
        type: created.type ?? null,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        paperTitle: created.paperTitle,
        reviewerName: created.reviewerName ?? selectedReviewer.name,
      };
      mergePendingRequest(normalizedCreated);

      // 4. Refetch the list so the new row is confirmed by the BE.
      try {
        await refetchReviewRequests();
      } catch {
        // Non-fatal — the table will just miss this row until next refresh.
      }

      // 5. Notify other live views (Papers page, other Researcher windows)
      //    that the request list has changed so they re-evaluate paper locks.
      window.dispatchEvent(new CustomEvent('review-update', {
        detail: { reviewRequestId: normalizedCreated.id, status: normalizedCreated.status },
      }));

      setLastSubmittedRequest(normalizedCreated);
      setShowSuccessModal(true);
      setIsSubmittingRequest(false);
    } catch (err) {
      // Per the "keep balance" rule: do NOT deduct on failure.
      const message =
        (err as { message?: string })?.message ||
        'Failed to submit the review request. Your wallet has not been charged.';
      setSubmitError(message);
      setIsSubmittingRequest(false);
    }
  };

  const handleGoToRequests = () => {
    setShowSuccessModal(false);
    setScreenState('list');
    setActiveTab('requests');
    setSelectedReviewer(null);
    setNotes('');
    setSelectedPaperId('');
    setAcceptedPolicy(false);
    setSubmitError(null);
  };

  const handleTopUpSuccess = (amount: number) => {
    console.log(`Successfully topped up ${amount} VND`);
  };

  // Hydration is owned by the usePaperReviewLocks hook; this page no longer
  // calls /api/ReviewRequest directly. The Refresh button in the request
  // table now simply calls the hook's refetch helper.

  // Refresh the My Review Requests table — re-fetches via the shared hook.
  const handleRefreshRequests = async () => {
    await refetchReviewRequests();
  };

  return (
    <div className={styles.reviewersPage}>
      {/* LIST SCREEN */}
      {screenState === 'list' && (
        <>
          <div className={styles.header}>
            <h1 className={styles.pageTitle}>Reviewers List</h1>
          </div>

          <div className={styles.tabsRow}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'discover' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('discover')}
            >
              Discover Reviewers
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'requests' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              My Review Requests
              {requests.length > 0 && (
                <span className={styles.requestsCountBadge}>{requests.length}</span>
              )}
            </button>
          </div>

          {activeTab === 'discover' && (
            <div className={styles.discoverContainer}>
              <div className={styles.manuscriptSelectorCard}>
                <span className={styles.selectorLabel}>Select Paper for Reviewer Recommendation</span>
                <select
                  className={styles.selectorDropdown}
                  value={selectedPaperId}
                  onChange={(e) => setSelectedPaperId(e.target.value)}
                >
                  <option value="">Select a paper...</option>
                  {papers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title || 'Untitled'}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedPaperId ? (
                <div className={styles.emptyReviewersHint}>
                  Please select a paper above to discover reviewers.
                </div>
              ) : isLoadingReviewers ? (
                <div className={styles.emptyReviewersHint} data-testid="reviewers-loading">
                  Loading reviewers…
                </div>
              ) : reviewers.length === 0 ? (
                <div className={styles.emptyReviewersHint} data-testid="reviewers-empty">
                  No reviewers available yet.
                </div>
              ) : (
                <>
                  <TableToolbar
                    search={reviewerSearch}
                    onSearchChange={setReviewerSearch}
                    onRefresh={handleRefreshReviewers}
                    isRefreshing={isRefreshingReviewers}
                    searchPlaceholder="Search reviewers by name, title, expertise, or ORCID…"
                    refreshLabel="Refresh"
                  />
                  {reviewerTotalItems === 0 ? (
                    <div className={styles.emptyReviewersHint} data-testid="reviewers-empty-search">
                      No reviewers match "{reviewerSearch.trim()}".
                    </div>
                  ) : (
                    <>
                      <div
                        className={styles.reviewersGrid}
                        data-testid="reviewers-grid"
                        data-page={reviewerPage}
                      >
                        {pagedReviewers.map((reviewer) => {
                          const balance = walletBalance ?? 0;
                          const hasSufficientFunds = balance >= reviewer.fee;
                          const shortfall = Math.max(0, reviewer.fee - balance);

                          return (
                          <div
                            key={reviewer.id}
                            className={styles.reviewerCard}
                            data-testid="reviewer-card"
                          >
                            <div className={styles.reviewerHeader}>
                              <div
                                className={styles.avatarCircle}
                                style={{ backgroundColor: reviewer.avatarBg }}
                              >
                                {reviewer.initials}
                              </div>
                              <div className={styles.authorMeta}>
                                <span className={styles.reviewerName}>{reviewer.name}</span>
                                <span className={styles.reviewerTitle}>{reviewer.title}</span>
                              </div>
                            </div>

                            <div className={styles.statsRow}>
                              <div className={styles.statCol}>
                                <span className={styles.statVal}>{reviewer.hIndex}</span>
                                <span className={styles.statLabel}>H-Index</span>
                              </div>
                              <div className={styles.statCol}>
                                <span className={styles.statVal}>{reviewer.publications}</span>
                                <span className={styles.statLabel}>Publications</span>
                              </div>
                              <div className={styles.statCol}>
                                <span className={styles.statVal}>{reviewer.reviews}</span>
                                <span className={styles.statLabel}>Reviews</span>
                              </div>
                            </div>

                            <div className={`${styles.feeBox} ${hasSufficientFunds ? styles.feeBoxBlue : styles.feeBoxRed}`}>
                              <span className={styles.feeLabel}>Base Review Fee</span>
                              <span className={styles.feeVal}>{reviewer.fee.toLocaleString('vi-VN')} VND</span>
                            </div>

                            <div className={styles.tagsRow}>
                              {reviewer.tags.map((tag, i) => (
                                <span key={i} className={styles.tagPill}>{tag}</span>
                              ))}
                            </div>

                            {hasSufficientFunds ? (
                              <button
                                className={styles.requestReviewBtn}
                                onClick={() => handleRequestClick(reviewer)}
                                disabled={isFollowing}
                              >
                                Request Review
                              </button>
                            ) : (
                              <div className={styles.insufficientContainer}>
                                <button
                                  className={styles.addFundBtn}
                                  onClick={() => setTopUpReviewer(reviewer)}
                                >
                                  <Wallet size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                  Add Fund to Wallet
                                </button>
                                <span className={styles.shortfallText}>
                                  Need {shortfall.toLocaleString('vi-VN')} VND more to request
                                </span>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                      <TablePagination
                        page={reviewerPage}
                        totalPages={reviewerTotalPages}
                        totalItems={reviewerTotalItems}
                        startIndex={reviewerStartIndex}
                        endIndex={reviewerEndIndex}
                        onPrev={prevReviewerPage}
                        onNext={nextReviewerPage}
                        onPage={setReviewerPage}
                        itemLabel="reviewers"
                      />
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>My Review Request</h3>
              </div>

              <TableToolbar
                search={requestSearch}
                onSearchChange={setRequestSearch}
                onRefresh={handleRefreshRequests}
                isRefreshing={isLoadingRequests}
                searchPlaceholder="Search by manuscript, reviewer, or status…"
                refreshLabel="Refresh"
              />

              <div className={styles.tableResponsive}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>MANUSCRIPT TITLE</th>
                      <th>ASSIGNED REVIEWER</th>
                      <th>SUBMISSION DATE</th>
                      <th>REVIEW FEE</th>
                      <th>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingRequests ? (
                      <tr>
                        <td colSpan={6} className={styles.emptyRow} data-testid="requests-loading">
                          Loading review requests…
                        </td>
                      </tr>
                    ) : requestsError ? (
                      <tr>
                        <td colSpan={6} className={styles.emptyRow} data-testid="requests-error" role="alert">
                          {requestsError}
                        </td>
                      </tr>
                    ) : requests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={styles.emptyRow} data-testid="requests-empty">
                          No review requests submitted yet.
                        </td>
                      </tr>
                    ) : reqTotalItems === 0 ? (
                      <tr>
                        <td colSpan={6} className={styles.emptyRow} data-testid="requests-empty-search">
                          No review requests match "{requestSearch.trim()}".
                        </td>
                      </tr>
                    ) : (
                      pagedRequests.map((req) => {
                        // Progressive paper-title hydration (defect 1B).
                        const resolution = resolvePaperTitle({
                          req,
                          papersById,
                          extraPapersById,
                        });
                        const isPaperLoading =
                          resolution.kind === 'id' &&
                          req.paperId != null &&
                          loadingPaperIds.has(String(req.paperId));
                        const manuscriptTitle =
                          resolution.kind === 'title'
                            ? resolution.title
                            : resolution.kind === 'loading' ||
                              isPaperLoading
                              ? 'Loading manuscript…'
                              : resolution.kind === 'id'
                                ? `Paper #${resolution.paperId}`
                                : 'Manuscript details unavailable';
                        // Reviewer lookup with type-tolerant string/number
                        // comparison (defect 1B item 5).
                        const reviewerInfo = lookupReviewer(req);
                        const reviewerName = reviewerInfo?.name ??
                          (req.reviewerId != null
                            ? 'Reviewer (profile not yet completed)'
                            : 'Reviewer details unavailable');
                        const reviewerInitials = reviewerInfo?.initials ?? initialsFromName(reviewerName);
                        const reviewerAvatarBg = reviewerInfo?.avatarBg ?? '#1D2A4A';
                        const feeValue = req.fee ?? 0;
                        const dateValue = req.createdAt
                          ? new Date(req.createdAt).toISOString().split('T')[0]
                          : '';
                        const rowKey = req.id ?? `${req.paperId}-${req.reviewerId}-${dateValue}`;
                        return (
                          <tr key={rowKey} data-testid="requests-row">
                            <td className={styles.manuscriptCell}>
                              <FileText size={16} className={styles.fileIcon} />
                              <span className={styles.fileNameText}>{manuscriptTitle}</span>
                            </td>
                            <td className={styles.reviewerCell}>
                              <div className={styles.reviewerCellInner}>
                                <div
                                  className={styles.avatarCircleSmall}
                                  style={{ backgroundColor: reviewerAvatarBg }}
                                >
                                  {reviewerInitials}
                                </div>
                                <span className={styles.reviewerNameText}>{reviewerName}</span>
                              </div>
                            </td>
                            <td className={styles.dateCell}>{dateValue}</td>
                            <td className={styles.feeCell}>{feeValue.toLocaleString('vi-VN')} VND</td>
                            <td>
                              <ReviewRequestStatusBadge status={req.status} />
                            </td>
                            <td>
                              <button
                                type="button"
                                className={styles.btnActionDetails}
                                onClick={() => setDetailsRequest(req)}
                                aria-label="View Details"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {!isLoadingRequests && requests.length > 0 && (
                <TablePagination
                  page={reqPage}
                  totalPages={reqTotalPages}
                  totalItems={reqTotalItems}
                  startIndex={reqStartIndex}
                  endIndex={reqEndIndex}
                  onPrev={prevReqPage}
                  onNext={nextReqPage}
                  onPage={setReqPage}
                  itemLabel="requests"
                />
              )}
            </div>
          )}
        </>
      )}

      {screenState === 'create-request' && selectedReviewer && (
        <div className={styles.createRequestContainer}>
          <div className={styles.breadcrumbs}>
            Home &gt; Reviewer Directory &gt; Submit Manuscript Request
          </div>

          <div className={styles.header}>
            <h1 className={styles.pageTitle}>Create Peer Review Request</h1>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.reviewerSummaryCard}>
              <div className={styles.sectionHeaderLabel}>REVIEWER PROFILE</div>
              <div className={styles.avatarCircleLarge} style={{ backgroundColor: selectedReviewer.avatarBg }}>
                {selectedReviewer.initials}
              </div>
              <h2 className={styles.formReviewerName}>{selectedReviewer.name}</h2>
              <span className={styles.formReviewerTitle}>{selectedReviewer.title}</span>

              <div className={styles.formStatsGrid}>
                <div className={styles.formStatCol}>
                  <span className={styles.formStatVal}>{selectedReviewer.hIndex}</span>
                  <span className={styles.formStatLabel}>H-Index</span>
                </div>
                <div className={styles.formStatCol}>
                  <span className={styles.formStatVal}>{selectedReviewer.publications}</span>
                  <span className={styles.formStatLabel}>Publications</span>
                </div>
                <div className={styles.formStatCol}>
                  <span className={styles.formStatVal}>{selectedReviewer.reviews}</span>
                  <span className={styles.formStatLabel}>Reviews</span>
                </div>
              </div>

              <div className={styles.formFeeBox}>
                <span className={styles.formFeeLabel}>Base Review Fee</span>
                <span className={styles.formFeeVal}>{selectedReviewer.fee.toLocaleString('vi-VN')} VND</span>
              </div>

              <div className={styles.specializationsContainer}>
                <span className={styles.specLabel}>Specializations</span>
                <div className={styles.specTagsGrid}>
                  {selectedReviewer.specializations.map((spec, idx) => (
                    <span key={idx} className={styles.specTag}>{spec}</span>
                  ))}
                </div>
              </div>

              <div className={styles.orcidBanner}>
                <span className={styles.orcidIcon}><Link size={16} /></span>
                <span className={styles.orcidLabel}>ORCID:</span>
                <span className={styles.orcidVal}>{selectedReviewer.orcid}</span>
              </div>
            </div>

            <div className={styles.formFieldsCard}>
              <div className={styles.sectionHeaderLabel}>MANUSCRIPT SUBMISSION</div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Select Paper</label>
                <div className={styles.selectWrapper}>
                  <select
                    className={styles.formSelect}
                    value={selectedPaperId}
                    onChange={(e) => setSelectedPaperId(e.target.value)}
                  >
                    <option value="">Select a paper...</option>
                    {papers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title || 'Untitled'}
                      </option>
                    ))}
                  </select>
                  <span className={styles.selectArrow}>&gt;</span>
                </div>
                <span className={styles.fieldHelper}>Choose the manuscript you wish to submit for peer review</span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Notes to Reviewer</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Describe your review requirements, specific areas to focus on..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={5}
                />
                <span className={styles.charCounter}>{notes.length} / 500 characters</span>
              </div>

              <div className={styles.estimateBanner}>
                <span className={styles.infoIcon}><Clock size={16} /></span>
                <div className={styles.estimateTextWrapper}>
                  <span className={styles.estimateTitle}>Estimated Completion: 7 Days</span>
                </div>
                <span className={styles.estimateSub}>Based on reviewer availability</span>
              </div>
            </div>
          </div>

          {submitError && (
            <div className={styles.submitErrorBanner} role="alert">
              <span className={styles.submitErrorIcon} aria-hidden="true"><AlertTriangle size={16} /></span>
              <span className={styles.submitErrorText}>{submitError}</span>
              <button
                type="button"
                className={styles.submitErrorDismiss}
                onClick={() => setSubmitError(null)}
                aria-label="Dismiss error"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className={styles.policyCard}>
            <div className={styles.policyHeader}>
              <span className={styles.policyShieldIcon} aria-hidden="true"><Shield size={18} /></span>
              <span className={styles.policyHeaderTitle}>Lock &amp; Refund Policy</span>
            </div>

            <ul className={styles.policyList}>
              <li>
                <strong>Funds will be locked safely</strong> when you confirm payment — the total amount
                (<b>{(selectedReviewer.fee + 25000).toLocaleString('vi-VN')} VND</b>, including the 25,000 VND processing tax)
                is deducted from your wallet and held by the platform.
              </li>
              <li>
                <strong>Released to the reviewer&apos;s wallet</strong> only after they complete the review
                AND you accept the delivered review.
              </li>
              <li>
                <strong>If the reviewer declines the request</strong> or does not respond within
                <b> 7 days</b> of submission, the full amount (including processing tax) is
                <b> automatically refunded</b> to your wallet.
              </li>
              <li>
                <strong>If you reject the delivered review</strong> on valid grounds (per our dispute policy),
                the full amount is refunded.
              </li>
              <li>
                <strong>Once this review request is submitted, you cannot delete or cancel the
                active request or delete the related manuscript while the Reviewer is processing it.</strong>
                {' '}This protects the Reviewer&apos;s access, evaluation record, and payment/refund history.
                Deletion becomes available only when allowed by the final request state and platform policy.
              </li>
            </ul>

            <label className={styles.policyCheckboxRow}>
              <input
                type="checkbox"
                className={styles.policyCheckbox}
                checked={acceptedPolicy}
                onChange={(e) => setAcceptedPolicy(e.target.checked)}
              />
              <span className={styles.policyCheckboxText}>
                I have read and agree to the Lock &amp; Refund Policy above. I understand that the total amount
                (<b>{(selectedReviewer.fee + 25000).toLocaleString('vi-VN')} VND</b>) will be locked in my wallet
                until the review is delivered and accepted (or a refund is triggered). I also acknowledge I will
                not be able to delete this active review request or its manuscript while the Reviewer is
                processing it.
              </span>
            </label>
          </div>

          <div className={styles.confirmationStatusBar}>
            <span className={styles.confirmationText}>
              <Check size={14} style={{ verticalAlign: 'middle' }} /> Review request will be sent to {selectedReviewer.name} upon confirmation
            </span>
            <div className={styles.confirmationActions}>
              <button
                className={styles.formCancelBtn}
                onClick={() => {
                  setScreenState('list');
                  setSelectedReviewer(null);
                  setAcceptedPolicy(false);
                }}
              >
                <X size={13} style={{ verticalAlign: 'middle' }} /> Cancel
              </button>
              <button
                className={styles.formConfirmBtn}
                onClick={handleProceedToPayment}
                disabled={!acceptedPolicy || isSubmittingRequest}
              >
                {isSubmittingRequest ? 'Submitting…' : 'Confirm & Submit Request ›'}
              </button>
            </div>
          </div>
        </div>
      )}

      {topUpReviewer && (
        <TopUpModal
          isOpen={true}
          onClose={() => setTopUpReviewer(null)}
          onSuccess={handleTopUpSuccess}
          shortfallAmount={topUpReviewer.fee - (walletBalance ?? 0)}
          reviewerName={topUpReviewer.name}
        />
      )}

      {showSuccessModal && selectedReviewer && (
        <div className={styles.modalOverlay}>
          <div className={styles.successModalCard}>
            <div className={styles.successIconWrapper}>
              <span className={styles.successCheckIcon}><Check size={28} strokeWidth={3} /></span>
            </div>
            <h3 className={styles.successTitle}>Review Request Submitted Successfully!</h3>
            <p className={styles.successDescription}>
              <b>{(selectedReviewer.fee + 25000).toLocaleString('vi-VN')} VND</b> has been deducted
              from your wallet and is held in hold. Your request has been routed to {selectedReviewer.name}.
            </p>

            <div className={styles.successDetailsTable}>
              <div className={styles.successTableRow}>
                <span className={styles.successTableLabel}>Request ID</span>
                <span className={styles.successTableVal}>
                  {lastSubmittedRequest?.id != null
                    ? `#REQ-${lastSubmittedRequest.id}`
                    : '#REQ-pending'}
                </span>
              </div>
              <div className={styles.successTableRow}>
                <span className={styles.successTableLabel}>Status</span>
                <span className={`${styles.statusDotLabel} ${styles.statusWaiting}`}>
                  {lastSubmittedRequest?.status ?? 'Pending'} — Waiting for Review
                </span>
              </div>
              <div className={styles.successTableRow}>
                <span className={styles.successTableLabel}>Assigned to</span>
                <span className={styles.successTableVal}>{selectedReviewer.name}</span>
              </div>
            </div>

            <button className={styles.goToRequestsBtn} onClick={handleGoToRequests}>
              Go to My Review Requests →
            </button>
          </div>
        </div>
      )}

      {/* Researcher View Details modal (defect 1C). */}
      <ReviewRequestDetailsModal
        isOpen={!!detailsRequest}
        request={detailsRequest}
        papersById={papersById}
        extraPapersById={extraPapersById}
        reviewerLookup={lookupReviewer}
        onClose={() => setDetailsRequest(null)}
      />
    </div>
  );
};

export default DiscoverReviewers;
