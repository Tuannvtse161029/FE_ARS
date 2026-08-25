import { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import LazyPdfViewer from '../../components/PdfViewer/LazyPdfViewer';
import { ScorecardModal } from '../Reviewer/components/ScorecardModal';
import { storage } from '../../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { paperService } from '../../services/paper.service';
import { usePapers } from '../../hooks/usePapers';
import { useMajorFields, useSubFields } from '../../hooks/useMajorFields';
import { parseEntityId } from '../../utils/entityId';
import { usePaperReviewLocks } from '../../hooks/usePaperReviewLocks';
import { useCompletedReviewRequestForPaper } from '../../hooks/useCompletedReviewRequestForPaper';
import { useAuthenticatedResearcher } from '../../hooks/useAuthenticatedResearcher';
import { PaperLockBadge } from '../../components/researcher/PaperLockBadge';
import { FieldError } from '../../components/FieldError';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { usePagination } from '../../hooks/usePagination';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import {
  MAX_FILE_SIZE_BYTES,
  ACCEPT_FILE_MIME,
  validatePdfFile,
} from '../../utils/validationRules';
import {
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Eye,
  Upload,
  Check,
  Trash2,
  Loader2,
  Lock,
} from 'lucide-react';
import styles from './Papers.module.css';

interface Paper {
  id: string;
  name: string;
  date: string;
  status: 'Waiting for Review' | 'Draft' | 'Accepted' | 'Rejected';
  hasNote: boolean;
  fileUrl?: string;
}

type UploadPhase = 'idle' | 'preview' | 'confirm';

// Domain error codes the BE may emit when rejecting a paper delete. We treat
// any of these (or a 409 Conflict in general) as the "active review request"
// case. Anything else (network, 5xx, auth) keeps its normal meaning.
const PAPER_LOCK_ERROR_CODES = new Set<string>([
  'PAPER_HAS_ACTIVE_REVIEW_REQUEST',
  'PAPER_HAS_ACTIVE_REVIEW_REQUESTS',
  'REVIEW_REQUEST_ACTIVE',
]);

/**
 * Inspects a thrown error from `paperService.delete` and decides whether it
 * looks like a "this paper is locked because of an active review request"
 * rejection. Uses the HTTP status (409 Conflict) as the primary signal and
 * falls back to known domain-error codes. We deliberately do NOT inspect the
 * English message text: network / auth / 500 errors must keep their original
 * meaning even if their strings happen to contain the word "review".
 */
function isPaperDeleteLockError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  if (status === 409) return true;
  const data = (err.response?.data ?? {}) as {
    code?: unknown;
    error?: unknown;
  };
  const candidate = (data.code ?? data.error) as unknown;
  if (typeof candidate === 'string' && PAPER_LOCK_ERROR_CODES.has(candidate.toUpperCase())) {
    return true;
  }
  return false;
}

/**
 * Returns a domain-specific user-facing message for a paper delete rejection.
 * Prefers the BE message when it is safe + human-friendly; otherwise falls
 * back to the canonical lock explanation. This is the ONLY place where the
 * canonical phrasing is defined for paper locks.
 */
function paperDeleteLockMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = (err.response?.data ?? {}) as { message?: unknown };
    const beMessage = typeof data.message === 'string' ? data.message.trim() : '';
    if (beMessage.length > 0) return beMessage;
  }
  return 'This paper cannot be deleted because it has an active review request. The paper must remain available until the request reaches a final state.';
}

export const Papers = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal States
  const [selectedPaperForScorecard, setSelectedPaperForScorecard] = useState<string | null>(null);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [paperToDelete, setPaperToDelete] = useState<Paper | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Active filter tab state
  const [activeTab, setActiveTab] = useState<'all' | 'waiting' | 'accepted' | 'rejected' | 'draft'>('all');

  // Papers are loaded from the BE via usePapers (no hardcoded initial state).
  // The hook enforces cross-account isolation by filtering out records whose
  // ownership field disagrees with the authenticated researcher.
  const {
    papers: fetchedPapers,
    isLoading: isPapersLoading,
    error: papersError,
    refetch: refetchPapers,
    detectedCrossAccountLeak: papersLeak,
  } = usePapers({ pageNumber: 1, pageSize: 50 });

  // Cross-account isolation: surfaced as a security banner + BTR signal.
  // The hook itself drops the foreign records — this flag exists so the UI
  // can alert the researcher AND so the BE team knows to fix the root
  // cause.
  const { researcherUserId } = useAuthenticatedResearcher();

  // Research field taxonomy is loaded from the BE via /api/MajorField and /api/SubField.
  const { fields: majorFields, isLoading: isLoadingMajorFields, error: majorFieldsError } = useMajorFields();
  const { subFields: allSubfields } = useSubFields(); // Load all Subfields for lookup map

  // Build Subfield lookup map to avoid N+1 queries in Paper list
  const subfieldMap = useMemo(
    () => new Map(allSubfields.map((sf) => [sf.id, sf])),
    [allSubfields]
  );

  // Review requests + per-paper lock state. The hook is the single source
  // of truth shared with DiscoverReviewers so a successful submission there
  // immediately re-evaluates the lock here.
  const {
    getLockForPaper,
    requests,
    isLoading: isReviewRequestsLoading,
    error: reviewRequestsLoadError,
    refetch: refetchReviewRequests,
  } = usePaperReviewLocks();

  // The completed review request for the paper currently shown in the ScorecardModal.
  // null when no completed request exists yet — ScorecardModal then renders the
  // "not yet submitted" hint rather than a fabricated scorecard.
  const completedReviewRequestForSelectedPaper = useCompletedReviewRequestForPaper(
    selectedPaperForScorecard,
    requests,
  );

  // Local state mirrors the BE-loaded papers for interactive operations (upload/delete).
  const [papers, setPapers] = useState<Paper[]>([]);

  // Keep this page in sync with submissions / terminal transitions from the
  // DiscoverReviewers flow. The event also triggers a paper-list refetch so
  // terminal states (e.g. a Completed request) release the lock in this view
  // without a manual page reload.
  useEffect(() => {
    const handler = () => void refetchReviewRequests();
    window.addEventListener('review-update', handler);
    return () => window.removeEventListener('review-update', handler);
  }, [refetchReviewRequests]);

  // Sync BE-loaded papers into local state (mapping API shape to UI shape).
  useEffect(() => {
    const mapped: Paper[] = fetchedPapers.map((p) => {
      const created = p.createdAt ? new Date(p.createdAt) : null;
      const updated = p.updatedAt ? new Date(p.updatedAt) : null;
      const hasScorecard =
        created !== null &&
        updated !== null &&
        updated.getTime() - created.getTime() > 1000;
      const rawStatus = p.status ?? 'Waiting for Review';
      const allowedStatuses: Paper['status'][] = ['Waiting for Review', 'Draft', 'Accepted', 'Rejected'];
      const status: Paper['status'] = allowedStatuses.includes(rawStatus as Paper['status'])
        ? (rawStatus as Paper['status'])
        : 'Waiting for Review';
      return {
        id: String(p.id),
        name: p.title || p.fileUrl?.split('/').pop() || 'Untitled',
        date: p.createdAt ? p.createdAt.split('T')[0] : '',
        status,
        hasNote: hasScorecard,
        fileUrl: p.fileUrl,
      };
    });
    setPapers(mapped);
  }, [fetchedPapers]);

  // Upload flow state
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Taxonomy state: single Major → single Subfield
  const [selectedMajorId, setSelectedMajorId] = useState<number | null>(null);
  const [selectedSubfieldId, setSelectedSubfieldId] = useState<number | null>(null);
  const { subFields: filteredSubfields, isLoading: isLoadingSubfields, error: subfieldError } = useSubFields(selectedMajorId ?? undefined);

  // Paper metadata for upload
  const [paperTitle, setPaperTitle] = useState('');
  const [paperAbstract, setPaperAbstract] = useState('');
  const MAX_ABSTRACT_WORDS = 500;

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [abstractError, setAbstractError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Word count for abstract
  const abstractWordCount = paperAbstract.trim() ? paperAbstract.trim().split(/\s+/).length : 0;

  // Auto-dismiss toast after 2 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileResult = validatePdfFile(file);
      if (!fileResult.ok) {
        setFileError(fileResult.message ?? 'Invalid PDF file.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setFileError(null);
      // MIME sniffing is more reliable than the file extension, so check both.
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== ACCEPT_FILE_MIME) {
        setFileError('Only PDF files are accepted.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setFileError('File exceeds the 10 MB limit.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setSelectedFile(file);
      setSelectedMajorId(null);
      setSelectedSubfieldId(null);
      setPaperTitle('');
      setPaperAbstract('');
      setUploadPhase('preview');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUploadPaper = () => {
    const trimmedTitle = paperTitle.trim();
    if (!trimmedTitle) {
      setTitleError('Title is required.');
      return;
    }
    setTitleError(null);
    if (!selectedSubfieldId) return; // Subfield is required
    setUploadPhase('confirm');
  };

  const handleConfirmUpload = async () => {
    const trimmedTitle = paperTitle.trim();
    const trimmedAbstract = paperAbstract.trim();
    let hasError = false;

    if (!trimmedTitle) {
      setTitleError('Title is required.');
      hasError = true;
    } else {
      setTitleError(null);
    }
    if (!trimmedAbstract) {
      setAbstractError('Abstract is required.');
      hasError = true;
    } else {
      setAbstractError(null);
    }
    if (hasError) return;

    if (!selectedFile || !selectedSubfieldId || !storage) return;
    const fileResult = validatePdfFile(selectedFile);
    if (!fileResult.ok) {
      setFileError(fileResult.message);
      setUploadPhase('preview');
      return;
    }
    setIsUploading(true);

    const storageRef = ref(storage, `papers/${Date.now()}_${selectedFile.name}`);
    const task = uploadBytesResumable(storageRef, selectedFile);

    task.on(
      'state_changed',
      () => {},
      (error) => {
        console.error('Upload failed:', error);
        setIsUploading(false);
        setUploadPhase('preview');
      },
      async () => {
        const pdfUrl = await getDownloadURL(task.snapshot.ref);

        try {
          const createdPaper = await paperService.create({
            title: paperTitle,
            abstract: paperAbstract.trim() || undefined,
            fileUrl: pdfUrl,
            issn: false,
            isOpenAccess: false,
            quartile: undefined,
            subFieldId: selectedSubfieldId,
          });

          // Verify the paper was saved by fetching it back
          try {
            await paperService.getById(createdPaper.id);
            setToastMessage({ text: 'Document uploaded successfully', type: 'success' });
          } catch {
            setToastMessage({ text: 'Paper uploaded but verification failed.', type: 'error' });
          }

          const today = new Date().toISOString().split('T')[0];
          const newPaper: Paper = {
            id: createdPaper.id,
            name: selectedFile.name,
            date: today,
            status: 'Waiting for Review',
            hasNote: false,
          };
          setPapers(prev => [newPaper, ...prev]);
        } catch (apiError) {
          console.error('Failed to save paper to database:', apiError);
          setToastMessage({ text: 'Failed to upload paper. Please try again.', type: 'error' });
        } finally {
          setSelectedFile(null);
          setSelectedMajorId(null);
          setSelectedSubfieldId(null);
          setPaperTitle('');
          setPaperAbstract('');
          setIsUploading(false);
          setUploadPhase('idle');
        }
      }
    );
  };

  const handleRemovePaper = () => {
    setSelectedFile(null);
    setSelectedMajorId(null);
    setSelectedSubfieldId(null);
    setPaperTitle('');
    setPaperAbstract('');
    setTitleError(null);
    setAbstractError(null);
    setFileError(null);
    setUploadPhase('idle');
  };

  const handleDeleteTablePaper = (paper: Paper) => {
    // Defensive: refuse to open the confirmation modal when we already know
    // the paper is locked by an active review request. The button is already
    // disabled in this state, but this catches keyboard / programmatic paths.
    const lock = getLockForPaper(paper.id);
    if (lock.isLocked) {
      setToastMessage({
        text: paperDeleteLockMessage({ response: { data: {} } }),
        type: 'error',
      });
      return;
    }
    setPaperToDelete(paper);
  };

  const handleConfirmDelete = async () => {
    if (!paperToDelete) return;

    // Re-check the lock before destructive action. This handles the case
    // where the user opened the modal while the request list was loading
    // and the lock only became known after the modal opened.
    const lock = getLockForPaper(paperToDelete.id);
    if (lock.isLocked) {
      setIsDeleting(false);
      setPaperToDelete(null);
      setToastMessage({
        text: paperDeleteLockMessage({ response: { data: {} } }),
        type: 'error',
      });
      return;
    }

    setIsDeleting(true);
    try {
      await paperService.delete(paperToDelete.id);
      setPapers((prev) => prev.filter((p) => p.id !== paperToDelete.id));
      setToastMessage({ text: 'Paper deleted successfully', type: 'success' });
    } catch (err) {
      console.error('Failed to delete paper:', err);
      if (isPaperDeleteLockError(err)) {
        // BE confirmed an active review request at the last mile.
        // Keep the paper in local state and surface a domain-specific message.
        setToastMessage({
          text: paperDeleteLockMessage(err),
          type: 'error',
        });
      } else {
        const fallback = (err as Error)?.message ?? 'Unknown error';
        setToastMessage({
          text: `Failed to delete paper: ${fallback}`,
          type: 'error',
        });
      }
    } finally {
      setIsDeleting(false);
      setPaperToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setPaperToDelete(null);
  };

  const handleCancelPopup = () => {
    setTitleError(null);
    setUploadPhase('preview');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetchPapers();
    } catch {
      setToastMessage({ text: 'Failed to refresh papers.', type: 'error' });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter papers based on active tab
  const [search, setSearch] = useState('');

  const tabFiltered = useMemo(
    () =>
      papers.filter((paper) => {
        if (activeTab === 'all') return true;
        if (activeTab === 'waiting') return paper.status === 'Waiting for Review';
        if (activeTab === 'accepted') return paper.status === 'Accepted';
        if (activeTab === 'rejected') return paper.status === 'Rejected';
        if (activeTab === 'draft') return paper.status === 'Draft';
        return true;
      }),
    [papers, activeTab],
  );

  const filteredPapers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = tabFiltered.filter((p) =>
      [p.name, p.status, p.date].join(' ').toLowerCase().includes(query),
    );
    // Newest first by date.
    return [...base].sort(
      (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime(),
    );
  }, [tabFiltered, search]);

  const {
    page,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    pageItems: pagedPapers,
    setPage,
    next,
    prev,
    resetPage,
  } = usePagination<Paper>(filteredPapers, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetPage();
  }, [search, activeTab, resetPage]);

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Waiting for Review': return styles.statusWaiting;
      case 'Draft': return styles.statusDraft;
      case 'Accepted': return styles.statusAccepted;
      case 'Rejected': return styles.statusRejected;
      default: return '';
    }
  };

  return (
    <div className={styles.papersPage}>
      {/* Page Title */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.pageMarker}>01 / MANUSCRIPT STUDIO</span>
          <h1 className={styles.pageTitle}>My Research Papers</h1>
          <p className={styles.pageSubtitle}>
            Submit manuscripts, track peer review status, and review feedback.
          </p>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`${styles.toast} ${toastMessage.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{toastMessage.text}</span>
          <button className={styles.toastClose} onClick={() => setToastMessage(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Cross-account data-isolation warning.
          Defense-in-depth only — the underlying filter has already stripped
          the foreign rows. The BE team has been notified via BTR. */}
      {papersLeak && researcherUserId !== null && (
        <div
          className={styles.formError}
          role="alert"
          data-testid="papers-leak-warning"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <AlertCircle size={16} aria-hidden="true" />
          <span>
            The server returned records that do not belong to your account. They
            have been hidden, but this is a backend security issue — please
            contact the BE team. Reference: researcher-data-isolation BTR.
          </span>
        </div>
      )}

      {/* Tabs Filter */}
      <div className={styles.tabsRow}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'all' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Research Paper
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'waiting' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('waiting')}
        >
          Waiting For Review
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'accepted' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('accepted')}
        >
          Accept Paper
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'rejected' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('rejected')}
        >
          Reject Paper
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'draft' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('draft')}
        >
          Draft
        </button>
      </div>

      {/* Papers Table Card */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>My Papers</h3>
          <div className={styles.sectionHeaderRight}>
            <span className={styles.manuscriptCount}>{filteredPapers.length} manuscripts</span>
          </div>
        </div>

        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          searchPlaceholder="Search manuscripts by name, status, or date…"
          refreshLabel="Refresh"
        />

        <div className={styles.tableResponsive}>
          {papersError && (
            <div className={styles.formError} role="alert" data-testid="papers-error">
              Could not load papers: {papersError.message}
            </div>
          )}
          {isPapersLoading && papers.length === 0 ? (
            <div className={styles.skeletonList} aria-busy="true" data-testid="papers-loading">
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.skeletonRow} />
              ))}
            </div>
          ) : papers.length === 0 ? (
            <div className={styles.emptyRow} data-testid="papers-empty">
              No manuscripts uploaded yet.
            </div>
          ) : totalItems === 0 ? (
            <div className={styles.emptyRow} data-testid="papers-empty-search">
              No manuscripts match "{search.trim()}".
            </div>
          ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>MANUSCRIPT</th>
                <th>SUBFIELD</th>
                <th>SUBMITTED</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {pagedPapers.map((paper) => {
                  const lock = getLockForPaper(paper.id);
                  const isLocked = lock.isLocked;
                  const primaryReviewer = lock.reviewerNames[0] ?? null;
                  const deleteTitle = isLocked
                    ? `This paper cannot be deleted because it has an active review request${primaryReviewer ? ` assigned to ${primaryReviewer}` : ''}.`
                    : reviewRequestsLoadError
                      ? 'We could not verify whether this paper has an active review request. Refresh the page and try again.'
                      : isReviewRequestsLoading
                        ? 'Checking review request status…'
                        : `Delete "${paper.name}"`;
                  
                  // Resolve Subfield name from lookup map
                  const paperData = fetchedPapers.find(p => p.id === paper.id);
                  const subfieldId = (paperData as any)?.subfieldId ?? (paperData as any)?.subFieldId;
                  const subfieldName = subfieldId 
                    ? (subfieldMap.get(Number(subfieldId))?.name ?? 'Unknown')
                    : 'Not assigned';
                  
                  return (
                    <tr key={paper.id} data-testid="papers-row" data-locked={isLocked ? 'true' : 'false'}>
                      <td className={styles.manuscriptCell}>
                        <FileText size={16} className={styles.fileIcon} />
                        <span className={styles.fileNameText}>{paper.name}</span>
                      </td>
                      <td className={styles.subfieldCell}>{subfieldName}</td>
                      <td className={styles.dateCell}>{paper.date}</td>
                      <td>
                        <div className={styles.statusCellInner}>
                          <span className={`${styles.statusDotLabel} ${getStatusClass(paper.status)}`}>
                            ● {paper.status}
                          </span>
                          <PaperLockBadge
                            isLocked={isLocked}
                            reviewerName={primaryReviewer}
                            activeRequestCount={lock.activeRequestCount}
                            variant="compact"
                          />
                        </div>
                      </td>
                      <td>
                        <div className={styles.actionCellBtns}>
                          <button
                            className={styles.btnActionView}
                            onClick={() => {
                              if (!paper.fileUrl) return;
                              setPdfViewerUrl(paper.fileUrl);
                            }}
                            disabled={!paper.fileUrl}
                          >
                            <Eye size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                            View
                          </button>
                          {paper.status !== 'Waiting for Review' && (
                            <button
                              className={`${styles.btnActionNote} ${paper.status === 'Accepted' ? styles.btnActionNoteAccept : styles.btnActionNoteReject}`}
                              onClick={() => setSelectedPaperForScorecard(paper.name)}
                            >
                              <FileText size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                              Reviewer Note
                            </button>
                          )}
                          <button
                            className={styles.btnActionDelete}
                            onClick={() => handleDeleteTablePaper(paper)}
                            disabled={isLocked || isReviewRequestsLoading || !!reviewRequestsLoadError}
                            title={deleteTitle}
                            aria-label={deleteTitle}
                            aria-disabled={isLocked || isReviewRequestsLoading || !!reviewRequestsLoadError}
                            data-testid="papers-delete-btn"
                            data-locked={isLocked ? 'true' : 'false'}
                          >
                            {isLocked ? (
                              <Lock size={12} style={{ verticalAlign: 'middle' }} />
                            ) : (
                              <Trash2 size={12} style={{ verticalAlign: 'middle' }} />
                            )}
                            {isLocked ? 'Locked' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          )}
        </div>
        {!isPapersLoading && papers.length > 0 ? (
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            startIndex={startIndex}
            endIndex={endIndex}
            onPrev={prev}
            onNext={next}
            onPage={setPage}
            itemLabel="manuscripts"
          />
        ) : null}
      </div>

      {/* Upload Box Container */}
      <div className={styles.sectionCard}>
        <h3 className={styles.uploadSectionTitle}>Upload New Research Paper</h3>

        <input
          type="file"
          accept=".pdf"
          ref={fileInputRef}
          onChange={handleFileChange}
          data-testid="papers-file-input"
          style={{ display: 'none' }}
        />

        <div className={styles.uploadZone} onClick={handleUploadClick}>
          <div className={styles.uploadIconWrapper}>
            <Upload size={32} />
          </div>
          <p className={styles.uploadZoneTitle}>Click to upload or drag & drop</p>
          <p className={styles.uploadZoneSubtitle}>PDF files only · Max 50 MB</p>
          <p className={styles.uploadZoneOr}>or</p>
          <button className={styles.browseFilesBtn} onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}>
            Browse Files
          </button>
        </div>
        <FieldError id="papers-file-error" message={fileError} testId="papers-file-error" />
      </div>

      {/* Scorecard Modal — shows live evaluation data when a completed review request
          exists for the selected paper. Fetches evaluation by reviewRequest.id and
          resolves reviewer name via reviewerLookup.service. */}
      {selectedPaperForScorecard && (
        <ScorecardModal
          isOpen={true}
          onClose={() => setSelectedPaperForScorecard(null)}
          reviewRequest={completedReviewRequestForSelectedPaper}
          reviewerId={completedReviewRequestForSelectedPaper?.reviewerId ?? undefined}
        />
      )}

      {/* Fullscreen PDF Viewer Modal Overlay */}
      {pdfViewerUrl && (
        <div className={styles.pdfViewerModalOverlay}>
          <div className={styles.pdfViewerModalCard}>
            <div className={styles.pdfViewerHeader}>
              <h3 className={styles.pdfViewerTitle}>Document Preview</h3>
              <button className={styles.closePdfBtn} onClick={() => setPdfViewerUrl(null)}>
                Close Preview
              </button>
            </div>
            <div className={styles.pdfViewerBody}>
              <LazyPdfViewer url={pdfViewerUrl} />
            </div>
          </div>
        </div>
      )}

      {/* Upload Preview Modal */}
      {uploadPhase === 'preview' && selectedFile && (
        <div className={styles.uploadModalOverlay}>
          <div className={styles.uploadModalCard} data-testid="upload-preview-card">
            {/* Modal Header */}
            <div className={styles.uploadModalHeader}>
              <h3 className={styles.uploadModalTitle}>Upload Paper Preview</h3>
              <button className={styles.closeUploadBtn} data-testid="close-upload-btn" onClick={handleRemovePaper}>
                <X size={16} />
              </button>
            </div>

            {/* Modal Body: split layout */}
            <div className={styles.uploadModalBody}>
              {/* Left: PDF Viewer */}
              <div className={styles.uploadPreviewLeft}>
                <LazyPdfViewer url={selectedFile} />
              </div>

              {/* Right: Research Fields */}
              <div className={styles.uploadPreviewRight}>
                {/* Paper Metadata Section */}
                <div className={styles.paperMetaSection}>
                  <div className={styles.paperMetaSectionHeader}>
                    <h4 className={styles.paperMetaSectionTitle}>Paper Details</h4>
                  </div>

                  {/* Title input (required) */}
                  <div className={styles.paperMetaField}>
                    <label className={styles.paperMetaLabel}>
                      Title <span className={styles.requiredStar}>*</span>
                    </label>
                    <input
                      type="text"
                      id="paper-title"
                      className={`${styles.paperMetaInput} ${titleError ? styles.paperMetaInputError : ''}`}
                      placeholder="e.g., A Modular Backend Network Protocol..."
                      value={paperTitle}
                      onChange={(e) => {
                        setPaperTitle(e.target.value);
                        if (e.target.value.trim()) setTitleError(null);
                        setAbstractError(null);
                      }}
                      aria-invalid={Boolean(titleError)}
                      aria-describedby={titleError ? 'paper-title-error' : undefined}
                    />
                    <FieldError id="paper-title-error" message={titleError} testId="papers-title-error" />
                  </div>

                  {/* Abstract textarea (optional, word-limited) */}
                  <div className={styles.paperMetaField}>
                    <label className={styles.paperMetaLabel}>
                      Abstract <span className={styles.requiredStar}>*</span>
                    </label>
                    <textarea
                      className={styles.paperMetaTextarea}
                      placeholder="Summarize your research paper..."
                      value={paperAbstract}
                      onChange={(e) => {
                        const words = e.target.value.trim() ? e.target.value.trim().split(/\s+/).length : 0;
                        if (words <= MAX_ABSTRACT_WORDS) {
                          setPaperAbstract(e.target.value);
                        }
                        setAbstractError(null);
                      }}
                      rows={4}
                      aria-invalid={Boolean(abstractError)}
                      aria-describedby={abstractError ? 'paper-abstract-error' : undefined}
                    />
                    <FieldError id="paper-abstract-error" message={abstractError} testId="papers-abstract-error" />
                    <span className={`${styles.wordCount} ${abstractWordCount > MAX_ABSTRACT_WORDS ? styles.wordCountError : ''}`}>
                      {abstractWordCount} / {MAX_ABSTRACT_WORDS} words
                    </span>
                  </div>
                </div>

                {/* Taxonomy Section */}
                <div className={styles.fieldsSection}>
                  <div className={styles.fieldsSectionHeader}>
                    <h4 className={styles.fieldsSectionTitle}>Research Field Classification</h4>
                    <span className={styles.requiredStar}>*</span>
                  </div>

                  {/* Major Field Selection */}
                  <div className={styles.paperMetaField}>
                    <label className={styles.paperMetaLabel} htmlFor="majorField-select">
                      Major Field <span className={styles.requiredStar}>*</span>
                    </label>
                    {majorFieldsError && (
                      <div className={styles.fieldsWarning}>
                        Major Fields could not be loaded.
                      </div>
                    )}

                    <select
                      id="majorField-select"
                      className={styles.paperMetaInput}
                      value={selectedMajorId != null ? String(selectedMajorId) : ''}
                      onChange={(e) => {
                        setSelectedMajorId(parseEntityId(e.target.value));
                        setSelectedSubfieldId(null);
                      }}
                      disabled={isLoadingMajorFields}
                    >
                      <option value="">Select a Major Field</option>
                      {majorFields.map((field) => (
                        <option key={field.id} value={String(field.id)}>
                          {field.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subfield Selection */}
                  <div className={styles.paperMetaField}>
                    <label className={styles.paperMetaLabel} htmlFor="subfield-select">
                      Subfield <span className={styles.requiredStar}>*</span>
                    </label>
                    {!selectedMajorId ? (
                      <div className={styles.fieldsHint}>
                        Select a Major Field to view its Subfields.
                      </div>
                    ) : isLoadingSubfields ? (
                      <div className={styles.fieldsHint}>
                        Loading Subfields...
                      </div>
                    ) : subfieldError ? (
                      <div className={styles.fieldsWarning}>
                        Subfields could not be loaded.
                      </div>
                    ) : filteredSubfields.length === 0 ? (
                      <div className={styles.fieldsWarning}>
                        No Subfields are available for this Major Field.
                      </div>
                    ) : (
                      <select
                        id="subfield-select"
                        className={styles.paperMetaInput}
                        value={selectedSubfieldId != null ? String(selectedSubfieldId) : ''}
                        onChange={(e) => {
                          const id = parseEntityId(e.target.value);
                          setSelectedSubfieldId(id);
                        }}
                      >
                        <option value="">Select a Subfield</option>
                        {filteredSubfields.map((subfield) => (
                          <option key={subfield.id} value={String(subfield.id)}>
                            {subfield.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {!selectedSubfieldId && selectedMajorId && !isLoadingSubfields && filteredSubfields.length > 0 && (
                    <p className={styles.fieldsWarning}>Please select a Subfield to continue.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={styles.uploadModalFooter}>
              <div className={styles.uploadFooterRight}>
                <button className={styles.cancelBtn} onClick={handleRemovePaper}>
                  Cancel
                </button>
                <button
                  className={styles.uploadBtn}
                  onClick={handleUploadPaper}
                  disabled={!paperTitle.trim() || !selectedSubfieldId}
                >
                  <Upload size={14} />
                  Upload Paper
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Upload Popup */}
      {uploadPhase === 'confirm' && selectedFile && (
        <div className={styles.popupOverlay}>
          <div className={styles.popupCard}>
            <div className={styles.popupIcon}>
              <FileText size={32} color="#2563eb" />
            </div>
            <h3 className={styles.popupTitle}>Confirm Upload</h3>
            <p className={styles.popupSubtitle}>Please review your paper details before uploading.</p>

            <div className={styles.popupDetails}>
              <div className={styles.popupDetailRow}>
                <span className={styles.popupDetailLabel}>Title</span>
                <span className={styles.popupDetailValue}>{paperTitle}</span>
              </div>
              <div className={styles.popupDetailRow}>
                <span className={styles.popupDetailLabel}>File Name</span>
                <span className={styles.popupDetailValue}>{selectedFile.name}</span>
              </div>
              <div className={styles.popupDetailRow}>
                <span className={styles.popupDetailLabel}>Submission Date</span>
                <span className={styles.popupDetailValue}>{new Date().toISOString().split('T')[0]}</span>
              </div>
              <div className={styles.popupDetailRow}>
                <span className={styles.popupDetailLabel}>Major Field</span>
                <span className={styles.popupDetailValue}>
                  {majorFields.find(f => f.id === selectedMajorId)?.name ?? 'N/A'}
                </span>
              </div>
              <div className={styles.popupDetailRow}>
                <span className={styles.popupDetailLabel}>Subfield</span>
                <span className={styles.popupDetailValue}>
                  {filteredSubfields.find(f => f.id === selectedSubfieldId)?.name ?? 'N/A'}
                </span>
              </div>
            </div>

            <div className={styles.popupActions}>
              <button className={styles.popupCancelBtn} onClick={handleCancelPopup} disabled={isUploading}>
                Cancel
              </button>
              <button className={styles.popupConfirmBtn} onClick={handleConfirmUpload} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <span className={styles.spinner}></span>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Confirm Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {paperToDelete && (() => {
        const modalLock = getLockForPaper(paperToDelete.id);
        const modalPrimaryReviewer = modalLock.reviewerNames[0] ?? null;
        const modalExplanation = modalLock.isLocked
          ? modalPrimaryReviewer
            ? `This paper cannot be deleted because it has an active review request assigned to ${modalPrimaryReviewer}. The paper must remain available until the request reaches a final state.`
            : 'This paper cannot be deleted because it has an active review request. The paper must remain available until the request reaches a final state.'
          : null;
        return (
          <div className={styles.popupOverlay}>
            <div className={styles.popupCard}>
              <div className={`${styles.popupIcon} ${modalLock.isLocked ? styles.popupIconLock : styles.popupIconDanger}`}>
                {modalLock.isLocked ? (
                  <Lock size={32} color="#007AFF" aria-hidden="true" />
                ) : (
                  <AlertCircle size={32} color="#ef4444" />
                )}
              </div>
              <h3 className={styles.popupTitle}>
                {modalLock.isLocked ? 'Paper Locked' : 'Delete Paper?'}
              </h3>
              {modalLock.isLocked ? (
                <>
                  <p className={styles.popupSubtitle}>
                    You can&apos;t delete <strong>&quot;{paperToDelete.name}&quot;</strong> right now.
                  </p>
                  <div className={styles.lockedReason} role="alert">
                    <Lock size={16} aria-hidden="true" />
                    <span>{modalExplanation}</span>
                  </div>
                </>
              ) : (
                <p className={styles.popupSubtitle}>
                  Are you sure you want to delete <strong>&quot;{paperToDelete.name}&quot;</strong>?
                  This action cannot be undone.
                </p>
              )}
              <div className={styles.popupActions}>
                <button
                  className={styles.popupCancelBtn}
                  onClick={handleCancelDelete}
                  disabled={isDeleting}
                >
                  {modalLock.isLocked ? 'Close' : 'Cancel'}
                </button>
                <button
                  className={styles.popupDangerBtn}
                  onClick={handleConfirmDelete}
                  disabled={isDeleting || modalLock.isLocked || isReviewRequestsLoading || !!reviewRequestsLoadError}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={14} className={styles.spinningIcon} />
                      Deleting…
                    </>
                  ) : modalLock.isLocked ? (
                    <>
                      <Lock size={14} />
                      Locked — Cannot Delete
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Delete Paper
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Papers;
