import { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Wallet,
  FileText,
  Circle,
  Link,
  Clock,
  AlertTriangle,
  X,
  Shield,
  Check,
} from 'lucide-react';
import { TopUpModal } from './components/TopUpModal';
import { paperService } from '../../services/paper.service';
import type { Paper } from '../../services/paper.service';
import type { ReviewerProfile } from '../../services/reviewer.service';
import { reviewRequestService, type ReviewRequest } from '../../services/reviewRequest.service';
import { useReviewerProfiles } from '../../hooks/useReviewerProfiles';
import { useFollowReviewer } from '../../hooks/useFollowers';
import { useWallet } from '../../hooks/useWallet';
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
  const name = p.fullName?.trim() || `Reviewer #${userId}`;
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

  // Review requests history state — hydrated from BE
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
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
    const handler = () => void loadRequests();
    window.addEventListener('review-update', handler);
    return () => window.removeEventListener('review-update', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ── Hydrate My Review Requests when the user opens that tab for the first time,
  // or when the tab is re-entered after a successful submission.
  useEffect(() => {
    if (activeTab === 'requests' && requests.length === 0 && !isLoadingRequests) {
      setIsLoadingRequests(true);
      loadRequests();
    }
    // We intentionally only watch activeTab — the in-component loadRequests() is
    // called explicitly after a successful POST and from the Refresh button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Lookups for joining BE ReviewRequest rows → UI display fields.
  const paperTitleById = new Map<string | number, string>(
    papers.map((p) => [p.id as unknown as number, p.title || 'Untitled'])
  );
  const reviewerNameByUserId = new Map<number, { name: string; initials: string; avatarBg: string }>();
  reviewers.forEach((r) => {
    const uid = parseInt(r.id.replace('rev-', ''), 10);
    if (Number.isFinite(uid)) {
      reviewerNameByUserId.set(uid, { name: r.name, initials: r.initials, avatarBg: r.avatarBg });
    }
  });

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

      // 3. Refetch the list so the new row shows up in My Review Requests.
      try {
        const fresh = await reviewRequestService.getAll();
        setRequests(fresh);
      } catch {
        // Non-fatal — the table will just miss this row until next refresh.
      }

      setLastSubmittedRequest(created);
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

  // Hydrate My Review Requests from the BE.
  const loadRequests = async () => {
    setRequestsError(null);
    try {
      const list = await reviewRequestService.getAll();
      setRequests(list);
    } catch (err) {
      const message = (err as { message?: string })?.message || 'Failed to load review requests.';
      setRequestsError(message);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  // Refresh the Discover Reviewers list — re-fetches reviewer profiles.
  const handleRefreshReviewers = async () => {
    await refetchReviewers();
  };

  return (
    <div className={styles.reviewersPage}>
      {/* LIST SCREEN */}
      {screenState === 'list' && (
        <>
          <div className={styles.header}>
            <h1 className={styles.pageTitle}>Reviewers List</h1>
            <button
              className={styles.refreshBtn}
              onClick={handleRefreshReviewers}
              aria-label="Refresh reviewer list"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
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
                <div className={styles.emptyReviewersHint}>Loading reviewers…</div>
              ) : reviewers.length === 0 ? (
                <div className={styles.emptyReviewersHint}>
                  No reviewers available yet.
                </div>
              ) : (
                <div className={styles.reviewersGrid}>
                  {reviewers.map((reviewer) => {
                    const balance = walletBalance ?? 0;
                    const hasSufficientFunds = balance >= reviewer.fee;
                    const shortfall = Math.max(0, reviewer.fee - balance);

                    return (
                    <div key={reviewer.id} className={styles.reviewerCard}>
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
              )}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>My Review Request</h3>
              </div>

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
                        <td colSpan={6} className={styles.emptyRow}>
                          Loading review requests…
                        </td>
                      </tr>
                    ) : requestsError ? (
                      <tr>
                        <td colSpan={6} className={styles.emptyRow}>
                          {requestsError}
                        </td>
                      </tr>
                    ) : requests.length > 0 ? (
                      requests.map((req) => {
                        const manuscriptTitle =
                          req.paperTitle && req.paperTitle.trim()
                            ? req.paperTitle
                            : req.paperId != null
                              ? (paperTitleById.get(req.paperId) ?? `Paper #${req.paperId}`)
                              : 'Manuscript details unavailable';
                        const reviewerInfo =
                          req.reviewerId != null
                            ? reviewerNameByUserId.get(req.reviewerId)
                            : undefined;
                        const reviewerName = req.reviewerName?.trim()
                          ? req.reviewerName
                          : req.reviewerId != null
                            ? (reviewerInfo?.name ?? `Reviewer #${req.reviewerId}`)
                            : 'Reviewer details unavailable';
                        const reviewerInitials = reviewerInfo?.initials ?? initialsFromName(reviewerName);
                        const reviewerAvatarBg = reviewerInfo?.avatarBg ?? '#1D2A4A';
                        const feeValue = req.fee ?? 0;
                        const dateValue = req.createdAt
                          ? new Date(req.createdAt).toISOString().split('T')[0]
                          : '';
                        const status = (req.status ?? 'Pending') as string;
                        const rowKey = req.id ?? `${req.paperId}-${req.reviewerId}-${dateValue}`;
                        return (
                          <tr key={rowKey}>
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
                              <span className={`${styles.statusDotLabel} ${styles.statusPending}`}>
                                <Circle size={8} fill="currentColor" style={{ verticalAlign: 'middle' }} /> {status}
                              </span>
                            </td>
                            <td>
                              <button className={styles.btnActionDetails}>View Details</button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className={styles.emptyRow}>
                          No review requests submitted yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {requests.length > 0 && (
                <div className={styles.tableFooter}>
                  <span>Showing {requests.length} of {requests.length} requests</span>
                  <span className={styles.footerTime}>
                    Last updated:{' '}
                    {requests[0].createdAt
                      ? new Date(requests[0].createdAt).toISOString().split('T')[0]
                      : '—'}{' '}
                    at {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ICT
                  </span>
                </div>
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
                until the review is delivered and accepted (or a refund is triggered).
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
    </div>
  );
};

export default DiscoverReviewers;
