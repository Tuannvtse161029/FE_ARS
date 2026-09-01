// Lecturer — Materials (combined Learning + Shared Materials page)
//
// This is the canonical Lecturer surface for managing both Learning Materials
// and Shared Materials under a single "Materials" tab.
//
// Previously there were two separate pages:
//   - Learning Materials (route: /lecturer/learning-materials) — reference PDFs
//     and resources linked to research topics.
//   - Shared Materials (route: /lecturer/shared-materials) — research papers
//     shared with colleagues.
//
// Both are now unified here with a tab switcher. The old routes are kept for
// backward compatibility but redirect to this page.

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  X,
  FileText,
  Loader,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Library,
  Trash2,
  Pencil,
  Link2,
  Upload,
  Check,
  CloudUpload,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLearningMaterials } from '../../hooks/useLearningMaterials';
import {
  learningMaterialService,
  defaultLearningMaterialFolderPath,
} from '../../services/learningMaterial.service';
import type { LearningMaterial } from '../../services/learningMaterial.service';
import { sharedMaterialService, type SharedMaterial } from '../../services/sharedMaterial.service';
import {
  useFirebaseFileUpload,
  FILE_UPLOAD_ACCEPT,
} from '../../hooks/useFirebaseFileUpload';
import { FieldError } from '../../components/FieldError';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { SortableHeader } from '../../components/table/SortableHeader';
import { usePagination } from '../../hooks/usePagination';
import { useTableSort } from '../../hooks/useTableSort';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import { ROUTES } from '../../routes/paths';
import { validateHttpsUrl } from '../../utils/validationRules';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { useListShortcuts } from '../../hooks/useListShortcuts';
import { BackendGapBanner } from '../../components/BackendGapBanner';
import styles from './Materials.module.css';

type TabId = 'my-materials' | 'shared-materials';

// Sortable column ids for the Learning Materials (My Materials) table.
type LMSortColumn = 'title' | 'subField' | 'updatedAt';
// Sortable column ids for the Shared Materials table.
type SMSortColumn = 'paperId' | 'colleague' | 'status' | 'createdAt';

// Shared material status values that appear in the filter dropdown.
const SHARED_STATUS_OPTIONS = ['ACTIVE', 'ARCHIVED'] as const;
type SharedMaterialStatusFilter = 'ALL' | typeof SHARED_STATUS_OPTIONS[number];

// ── Learning Materials helpers ─────────────────────────────────────────────

const formatTitle = (m: LearningMaterial): string => {
  if (m.title && m.title.trim().length > 0) return m.title.trim();
  if (m.id) return `Material #${m.id}`;
  return 'Untitled material';
};

// ── Shared Materials helpers ──────────────────────────────────────────────

  // BackendGapBanner below surfaces the catalog-metadata gap honestly — no
  // mock catalog placeholder is rendered here, since this would otherwise
  // mask whether the API exposes `title`, `description`, `materialType`,
  // `url`, or `topicId`. See docs/LECTURER_SWAGGER_INTEGRATION_REPORT.md.

// ── Main combined page ───────────────────────────────────────────────────

export const LecturerMaterialsPage = () => {
  const { user } = useAuth();
  const lecturerId = user?.userId ?? null;

  // ── Tab state ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('my-materials');

  // ════════════════════════════════════════════════════════════════════════
  // TAB 1: My Materials (Learning Materials)
  // ════════════════════════════════════════════════════════════════════════

  const { materials, isLoading: lmLoading, error: lmError, refetch: refetchLearning } =
    useLearningMaterials({ lecturerId });

  const [lmSearch, setLmSearch] = useState('');
  const [lmRefreshing, setLmRefreshing] = useState(false);
  // Default sort by updatedAt (newest first) so freshly added materials
  // surface at the top. The user can override per column header click.
  const lmSort = useTableSort<LearningMaterial, LMSortColumn>(
    'updatedAt',
    'desc',
  );

  // Add form state (Learning Materials)
  const [lmShowForm, setLmShowForm] = useState(false);
  const [lmTitle, setLmTitle] = useState('');
  const [lmDescription, setLmDescription] = useState('');
  // The form is mutually exclusive: the user either uploads a file OR pastes a
  // URL — never both. `lmSourceMode` reflects which path they chose, driven by
  // whether they have selected a file. When a file is selected the URL field
  // is hidden; when no file is selected the URL field is shown (optional).
  const [lmSourceMode, setLmSourceMode] = useState<'file' | 'url'>('file');
  const [lmUploadedFile, setLmUploadedFile] = useState<File | null>(null);
  const [lmFileUrl, setLmFileUrl] = useState('');
  const [lmSubmitting, setLmSubmitting] = useState(false);
  const [lmFormError, setLmFormError] = useState<string | null>(null);
  const [lmTitleError, setLmTitleError] = useState<string | null>(null);
  const [lmUrlError, setLmUrlError] = useState<string | null>(null);

  // Firebase upload for the optional file attachment.
  const {
    uploadFile,
    progress: lmUploadProgress,
    isUploading: lmIsUploading,
    error: lmUploadError,
    fileUrl: lmUploadedUrl,
    resetUpload: lmResetUpload,
  } = useFirebaseFileUpload(
    defaultLearningMaterialFolderPath(lecturerId),
  );

  // Banner state
  const [banner, setBanner] = useState<{
    visible: boolean;
    text: string;
    variant: 'success' | 'error';
  }>({ visible: false, text: '', variant: 'success' });

  const showBanner = (
    text: string,
    variant: 'success' | 'error' = 'success',
  ) => {
    setBanner({ visible: true, text, variant });
    window.setTimeout(
      () => setBanner({ visible: false, text: '', variant: 'success' }),
      4000,
    );
  };

  const lmFiltered = useMemo(() => {
    const q = lmSearch.trim().toLowerCase();
    const sorted = [...materials].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da; // newest created first
    });
    if (!q) return sorted;
    return sorted.filter((m) =>
      [m.title ?? '', m.description ?? '', m.fileUrl ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [materials, lmSearch]);

  const lmSorted = useMemo(
    () =>
      lmSort.sortedItemsBy(lmFiltered, (m) => {
        switch (lmSort.sortState.column) {
          case 'title':
            return m.title ?? '';
          case 'subField':
            return m.subFieldId ?? null;
          case 'updatedAt':
          default:
            return m.updatedAt ?? m.id ?? null;
        }
      }),
    [lmFiltered, lmSort],
  );

  const {
    page: lmPage,
    totalPages: lmTotalPages,
    totalItems: lmTotalItems,
    startIndex: lmStartIndex,
    endIndex: lmEndIndex,
    pageItems: lmPageItems,
    setPage: setLmPage,
    next: lmNext,
    prev: lmPrev,
    resetPage: resetLmPage,
  } = usePagination<LearningMaterial>(lmSorted, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetLmPage();
  }, [lmSearch, lmSort.sortState, resetLmPage]);

  // Keyboard shortcuts for My Materials table
  const { selectedIndex: lmSelectedIndex } = useListShortcuts({
    itemCount: lmPageItems.length,
    onOpen: (index) => {
      const material = lmPageItems[index];
      if (!material?.fileUrl) return;
      window.open(material.fileUrl, '_blank', 'noopener,noreferrer');
    },
    onNew: () => setLmShowForm((v) => !v),
  });

  const handleLmRefresh = async () => {
    if (lmRefreshing) return;
    setLmRefreshing(true);
    try {
      await refetchLearning();
    } finally {
      setLmRefreshing(false);
    }
  };

  const handleLmAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!lecturerId) {
      setLmFormError('No lecturer session — please sign in again.');
      return;
    }
    const title = lmTitle.trim();
    const description = lmDescription.trim();

    const titleErr = !title ? 'Title is required.' : null;
    setLmTitleError(titleErr);
    if (titleErr) return;

    let resolvedUrl: string | null = null;

    if (lmSourceMode === 'file') {
      // User chose file upload — must have a file selected.
      if (!lmUploadedFile) {
        setLmFormError(
          'Please select a file to upload, or switch to the URL option below.',
        );
        return;
      }
      // The file may already be uploaded (url already set) or needs uploading now.
      if (lmUploadedUrl) {
        resolvedUrl = lmUploadedUrl;
      } else {
        // Upload synchronously; parent already disabled the button.
        setLmFormError(null);
        resolvedUrl = await uploadFile(lmUploadedFile);
        if (!resolvedUrl) {
          setLmFormError(
            lmUploadError ?? 'File upload failed. Please try again.',
          );
          return;
        }
      }
    } else {
      // User chose URL — fileUrl is optional so no validation when empty.
      const urlVal = lmFileUrl.trim();
      if (urlVal.length > 0) {
        const urlErr = validateHttpsUrl(urlVal);
        setLmUrlError(urlErr);
        if (urlErr) return;
      }
      resolvedUrl = urlVal.length > 0 ? urlVal : null;
    }

    setLmSubmitting(true);
    setLmFormError(null);
    try {
      await learningMaterialService.create({
        lecturerId,
        title,
        fileUrl: resolvedUrl,
        description: description.length > 0 ? description : null,
        subFieldId: null,
      });
      setLmTitle('');
      setLmDescription('');
      setLmFileUrl('');
      setLmUploadedFile(null);
      lmResetUpload();
      setLmSourceMode('file');
      setLmTitleError(null);
      setLmUrlError(null);
      showBanner('Material added to your library.');
      await refetchLearning();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'The server rejected the material. Please try again.';
      setLmFormError(message);
    } finally {
      setLmSubmitting(false);
    }
  };

  const handleLmDelete = async (id: number) => {
    if (!id) return;
    if (
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function'
    ) {
      const ok = window.confirm(
        'Delete this material? This cannot be undone.',
      );
      if (!ok) return;
    }
    try {
      await learningMaterialService.delete(id);
      showBanner('Material deleted.');
      await refetchLearning();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete the material.';
      showBanner(message, 'error');
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // TAB 2: Shared Materials
  // ════════════════════════════════════════════════════════════════════════

  const [sharedItems, setSharedItems] = useState<SharedMaterial[]>([]);
  const [sharedLoading, setSharedLoading] = useState(true);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [sharedStatusFilter, setSharedStatusFilter] =
    useState<SharedMaterialStatusFilter>('ALL');
  // Default sort by createdAt (newest first) so freshly shared papers
  // surface at the top. The user can override per column header click.
  const smSort = useTableSort<SharedMaterial, SMSortColumn>(
    'createdAt',
    'desc',
  );
  const [sharedModalOpen, setSharedModalOpen] = useState(false);
  const [sharedEditing, setSharedEditing] = useState<SharedMaterial | null>(null);
  const [sharedPaperId, setSharedPaperId] = useState('');
  const [sharedColleagueId, setSharedColleagueId] = useState('');
  const [sharedStatus, setSharedStatus] = useState('ACTIVE');
  const [sharedSaving, setSharedSaving] = useState(false);

  const loadShared = useCallback(async () => {
    setSharedLoading(true);
    setSharedError(null);
    try {
      setSharedItems(await sharedMaterialService.getAll());
    } catch {
      setSharedError('Shared materials could not be loaded.');
    } finally {
      setSharedLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShared();
  }, [loadShared]);

  const startSharedCreate = () => {
    setSharedEditing(null);
    setSharedPaperId('');
    setSharedColleagueId('');
    setSharedStatus('ACTIVE');
    setSharedModalOpen(true);
  };

  const startSharedEdit = (item: SharedMaterial) => {
    setSharedEditing(item);
    setSharedPaperId(String(item.paperId ?? ''));
    setSharedColleagueId(String(item.sharedWithColleagueId ?? ''));
    setSharedStatus(item.status ?? 'ACTIVE');
    setSharedModalOpen(true);
  };

  const sharedSorted = useMemo(() => {
    // 1) Apply the status filter (client-side; the BE doesn't expose
    //    `?status=` for SharedMaterial yet).
    const statusFiltered =
      sharedStatusFilter === 'ALL'
        ? sharedItems
        : sharedItems.filter((item) => item.status === sharedStatusFilter);
    // 2) Sort using the column the user picked via the header.
    return smSort.sortedItemsBy(statusFiltered, (item) => {
      switch (smSort.sortState.column) {
        case 'paperId':
          return item.paperId ?? null;
        case 'colleague':
          return item.sharedWithColleagueId ?? null;
        case 'status':
          return item.status ?? '';
        case 'createdAt':
        default:
          return item.createdAt ?? item.sharedAt ?? null;
      }
    });
  }, [sharedItems, smSort, sharedStatusFilter]);

  // Keyboard shortcuts for Shared Materials grid
  const { selectedIndex: sharedSelectedIndex } = useListShortcuts({
    itemCount: sharedSorted.length,
    onOpen: (index) => {
      const item = sharedSorted[index];
      if (item) startSharedEdit(item);
    },
    onNew: startSharedCreate,
    onFilterFocus: null,
  });

  const handleSharedSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSharedSaving(true);
    setSharedError(null);
    const payload = {
      lecturerId,
      paperId: sharedPaperId ? Number(sharedPaperId) : null,
      sharedWithColleagueId: sharedColleagueId ? Number(sharedColleagueId) : null,
      sharedAt: sharedEditing?.sharedAt ?? new Date().toISOString(),
      status: sharedStatus || null,
    };
    try {
      if (sharedEditing?.sharedMaterialId) {
        await sharedMaterialService.update(sharedEditing.sharedMaterialId, payload);
      } else {
        await sharedMaterialService.create(payload);
      }
      setSharedModalOpen(false);
      await loadShared();
    } catch {
      setSharedError('The shared material could not be saved.');
    } finally {
      setSharedSaving(false);
    }
  };

  const handleSharedDelete = async (item: SharedMaterial) => {
    if (!item.sharedMaterialId || !window.confirm('Delete this shared material?')) return;
    try {
      await sharedMaterialService.delete(item.sharedMaterialId);
      await loadShared();
    } catch {
      setSharedError('The shared material could not be deleted.');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      className={styles.materialsPage}
      data-testid="lecturer-materials"
    >
      <PageHeader
        eyebrow="LECTURER WORKSPACE"
        title="Materials"
        description="Manage your learning materials and shared research papers in one place."
        accent="var(--ars-lecturer)"
      />

      <div className={styles.breadcrumbs}>
        Home &gt; <Link to={ROUTES.FORUM}>Forums</Link> &gt;{' '}
        <span className={styles.activeBreadcrumb}>Materials</span>
      </div>

      {banner.visible && (
        <div className={styles.successToastBanner}>
          <div className={styles.toastLeft}>
            <span className={styles.toastCheckIcon}>
              {banner.variant === 'success' ? (
                <Plus size={14} strokeWidth={3} aria-hidden />
              ) : (
                <AlertTriangle size={14} aria-hidden />
              )}
            </span>
            <div>
              <span className={styles.toastTitle}>
                {banner.variant === 'success' ? 'Action Successful' : 'Action Failed'}
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

      {/* Tab Switcher */}
      <div className={styles.tabBar} role="tablist" aria-label="Materials sections">
        <div className={styles.tabBarLeft}>
          <button
            type="button"
            role="tab"
            id="tab-my-materials"
            aria-selected={activeTab === 'my-materials'}
            aria-controls="panel-my-materials"
            className={`${styles.tabBtn} ${activeTab === 'my-materials' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('my-materials')}
          >
            <Library size={16} aria-hidden />
            My Materials
          </button>
          <button
            type="button"
            role="tab"
            id="tab-shared-materials"
            aria-selected={activeTab === 'shared-materials'}
            aria-controls="panel-shared-materials"
            className={`${styles.tabBtn} ${activeTab === 'shared-materials' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('shared-materials')}
          >
            <Link2 size={16} aria-hidden />
            Shared Materials
          </button>
        </div>

        {/* Actions — visible only on the My Materials tab */}
        {activeTab === 'my-materials' && (
          <div className={styles.tabBarActions}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={
                lmLoading ? (
                  <Loader size={13} className={styles.spinningIcon} aria-hidden />
                ) : (
                  <RefreshCw size={13} aria-hidden />
                )
              }
              onClick={() => void handleLmRefresh()}
              disabled={lmLoading}
              aria-label="Refresh materials"
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={14} aria-hidden />}
              onClick={() => setLmShowForm((v) => !v)}
            >
              {lmShowForm ? 'Hide form' : 'Add Material'}
            </Button>
          </div>
        )}
      </div>

      {/* ── TAB 1: My Materials ──────────────────────────────────────────── */}
      <div
        id="panel-my-materials"
        role="tabpanel"
        aria-labelledby="tab-my-materials"
        className={`${styles.tabPanel} ${activeTab !== 'my-materials' ? styles.tabPanelHidden : ''}`}
      >
        {lmError && (
          <div className={styles.errorBanner} role="alert">
            <span className={styles.errorBannerIcon}>
              <AlertTriangle size={14} aria-hidden />
              <span>{lmError.message}</span>
            </span>
            <button
              type="button"
              className={styles.errorRetryBtn}
              onClick={() => void refetchLearning()}
            >
              Retry
            </button>
          </div>
        )}

        {lmShowForm && (
          <form onSubmit={handleLmAdd} className={styles.modalCard}>
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalIconCircle}>
                  <Library size={18} aria-hidden />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>Add a learning material</h3>
                  <span className={styles.modalSubtitle}>
                    Upload a file or paste a URL — both are optional.
                  </span>
                </div>
              </div>
            </div>
            <div className={styles.modalForm}>
              {/* Title */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="lm-title">
                  * Title
                </label>
                <input
                  id="lm-title"
                  type="text"
                  className={`${styles.formInput} ${lmTitleError ? styles.formInputError : ''}`}
                  value={lmTitle}
                  onChange={(e) => {
                    setLmTitle(e.target.value);
                    if (lmTitleError) setLmTitleError(null);
                  }}
                  aria-invalid={Boolean(lmTitleError)}
                  aria-describedby={lmTitleError ? 'lm-title-error' : undefined}
                  required
                />
                <FieldError id="lm-title-error" message={lmTitleError} testId="lm-title-error" />
              </div>

              {/* Source mode toggle */}
              <div className={styles.sourceModeToggle} role="group" aria-label="Choose material source">
                <button
                  type="button"
                  className={`${styles.modeBtn} ${lmSourceMode === 'file' ? styles.modeBtnActive : ''}`}
                  onClick={() => setLmSourceMode('file')}
                  aria-pressed={lmSourceMode === 'file'}
                >
                  <Upload size={14} aria-hidden />
                  Upload file
                </button>
                <button
                  type="button"
                  className={`${styles.modeBtn} ${lmSourceMode === 'url' ? styles.modeBtnActive : ''}`}
                  onClick={() => setLmSourceMode('url')}
                  aria-pressed={lmSourceMode === 'url'}
                >
                  <Link2 size={14} aria-hidden />
                  Paste URL
                </button>
              </div>

              {/* File upload area (shown when file mode is active) */}
              {lmSourceMode === 'file' && (
                <div className={styles.formGroup}>
                  <span className={styles.formLabel}>File (optional)</span>
                  {lmUploadedFile && lmUploadedUrl ? (
                    /* Uploaded file preview */
                    <div className={styles.filePreviewCard}>
                      <div className={styles.filePreviewIcon}>
                        <Check size={16} aria-hidden />
                      </div>
                      <div className={styles.filePreviewInfo}>
                        <span className={styles.filePreviewName}>{lmUploadedFile.name}</span>
                        <span className={styles.filePreviewSize}>
                          {((lmUploadedFile.size) / 1024 / 1024).toFixed(1)} MB
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.filePreviewRemove}
                        onClick={() => {
                          setLmUploadedFile(null);
                          lmResetUpload();
                        }}
                        aria-label="Remove selected file"
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </div>
                  ) : lmIsUploading ? (
                    /* Upload progress */
                    <div className={styles.uploadProgressBox}>
                      <div className={styles.uploadProgressBarOuter}>
                        <div
                          className={styles.uploadProgressBarInner}
                          style={{ width: `${lmUploadProgress}%` }}
                        />
                      </div>
                      <span className={styles.uploadProgressLabel}>
                        Uploading… {lmUploadProgress}%
                      </span>
                    </div>
                  ) : (
                    /* File picker */
                    <div
                      className={styles.fileDropzone}
                      onClick={() => {
                        const input = document.getElementById('lm-file-input') as HTMLInputElement | null;
                        input?.click();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          (document.getElementById('lm-file-input') as HTMLInputElement | null)?.click();
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label="Select a file to upload"
                    >
                      <CloudUpload size={22} className={styles.dropzoneIcon} aria-hidden />
                      <span className={styles.dropzoneText}>
                        Click to browse — PDF, Word, Excel, PowerPoint, image
                      </span>
                      <span className={styles.dropzoneHint}>Max 10 MB</span>
                      <input
                        id="lm-file-input"
                        type="file"
                        className={styles.hiddenFileInput}
                        accept={FILE_UPLOAD_ACCEPT}
                        onChange={async (e) => {
                          const file = e.target.files?.[0] ?? null;
                          if (!file) return;
                          setLmUploadedFile(file);
                          const url = await uploadFile(file);
                          if (!url) {
                            setLmUploadedFile(null);
                            setLmFormError(lmUploadError ?? 'Upload failed.');
                          }
                          // Reset the input so the same file can be re-selected.
                          if (e.target) e.target.value = '';
                        }}
                        disabled={lmIsUploading}
                      />
                    </div>
                  )}
                  {lmUploadError && !lmFormError && (
                    <p className={styles.uploadErrorText} role="alert">{lmUploadError}</p>
                  )}
                </div>
              )}

              {/* URL input (shown when url mode is active) */}
              {lmSourceMode === 'url' && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="lm-url">
                    File URL (optional)
                  </label>
                  <input
                    id="lm-url"
                    type="url"
                    className={`${styles.formInput} ${lmUrlError ? styles.formInputError : ''}`}
                    value={lmFileUrl}
                    onChange={(e) => {
                      setLmFileUrl(e.target.value);
                      if (lmUrlError) setLmUrlError(null);
                    }}
                    placeholder="https://firebasestorage.googleapis.com/.../syllabus.pdf"
                    aria-invalid={Boolean(lmUrlError)}
                    aria-describedby={lmUrlError ? 'lm-url-error' : undefined}
                  />
                  <FieldError id="lm-url-error" message={lmUrlError} testId="lm-url-error" />
                </div>
              )}

              {/* Description */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="lm-description">
                  Description (optional)
                </label>
                <textarea
                  id="lm-description"
                  className={styles.formTextarea}
                  value={lmDescription}
                  onChange={(e) => setLmDescription(e.target.value)}
                  placeholder="Brief note about this material…"
                  rows={3}
                />
              </div>

              {lmFormError && (
                <div className={styles.errorBanner} role="alert">
                  <AlertTriangle size={14} aria-hidden />
                  <span>{lmFormError}</span>
                </div>
              )}
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => {
                    setLmShowForm(false);
                    setLmUploadedFile(null);
                    lmResetUpload();
                    setLmSourceMode('file');
                    setLmTitle('');
                    setLmDescription('');
                    setLmFileUrl('');
                    setLmTitleError(null);
                    setLmUrlError(null);
                    setLmFormError(null);
                  }}
                  disabled={lmSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitNavyBtn}
                  disabled={lmSubmitting || lmIsUploading}
                >
                  {lmSubmitting || lmIsUploading ? (
                    <Loader
                      size={14}
                      className={styles.spinningIcon}
                      aria-hidden
                    />
                  ) : (
                    <Plus size={14} aria-hidden />
                  )}
                  {lmSubmitting
                    ? 'Adding…'
                    : lmIsUploading
                    ? 'Uploading…'
                    : 'Add Material'}
                </button>
              </div>
            </div>
          </form>
        )}

        <TableToolbar
          search={lmSearch}
          onSearchChange={setLmSearch}
          onRefresh={handleLmRefresh}
          isRefreshing={lmRefreshing}
          searchPlaceholder="Search materials by title, description, or URL"
          refreshLabel="Refresh"
        />

        <div className={styles.tableCard}>
          {lmLoading ? (
            <div className={styles.tableEmpty} role="status">
              <Loader size={16} className={styles.spinningIcon} aria-hidden />
              Loading materials…
            </div>
          ) : materials.length === 0 ? (
            <div className={styles.tableEmpty}>
              <FileText size={20} aria-hidden /> No learning materials yet.
              Click "Add Material" to upload your first one.
            </div>
          ) : lmTotalItems === 0 ? (
            <div className={styles.tableEmpty}>
              No materials match "{lmSearch.trim()}".
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
                          label="TITLE"
                          cycleSort={lmSort.cycleSort}
                          ariaSortFor={lmSort.ariaSortFor}
                        />
                      </th>
                      <th>
                        <SortableHeader
                          column="subField"
                          label="SUB-FIELD"
                          cycleSort={lmSort.cycleSort}
                          ariaSortFor={lmSort.ariaSortFor}
                          align="right"
                        />
                      </th>
                      <th>
                        <SortableHeader
                          column="updatedAt"
                          label="UPDATED"
                          cycleSort={lmSort.cycleSort}
                          ariaSortFor={lmSort.ariaSortFor}
                        />
                      </th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lmPageItems.map((m, index) => {
                      const id = typeof m.id === 'number' ? m.id : -1;
                      return (
                        <tr
                          key={String(m.id ?? id)}
                          className={lmSelectedIndex === index ? styles.selectedRow : ''}
                        >
                          <td>
                            <span className={styles.topicNameText}>
                              {formatTitle(m)}
                            </span>
                            {m.description?.trim() && (
                              <div className={styles.topicDescText}>
                                {m.description}
                              </div>
                            )}
                          </td>
                          <td>
                            {m.subFieldId != null
                              ? `Sub-field #${m.subFieldId}`
                              : '—'}
                          </td>
                          <td>{m.updatedAt ? m.updatedAt.split('T')[0] : '—'}</td>
                          <td>
                            <div className={styles.topicActionStack}>
                              {m.fileUrl && (
                                <a
                                  className={styles.assignGroupBtn}
                                  href={m.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink size={14} aria-hidden />
                                  Open
                                </a>
                              )}
                              <button
                                type="button"
                                className={styles.closeTopicBtn}
                                onClick={() => void handleLmDelete(id)}
                                disabled={id < 0}
                                aria-label={`Delete ${formatTitle(m)}`}
                              >
                                <Trash2 size={14} aria-hidden />
                                Delete
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
                page={lmPage}
                totalPages={lmTotalPages}
                totalItems={lmTotalItems}
                startIndex={lmStartIndex}
                endIndex={lmEndIndex}
                onPrev={lmPrev}
                onNext={lmNext}
                onPage={setLmPage}
                itemLabel="materials"
              />
            </>
          )}
        </div>
      </div>

      {/* ── TAB 2: Shared Materials ──────────────────────────────────────── */}
      <div
        id="panel-shared-materials"
        role="tabpanel"
        aria-labelledby="tab-shared-materials"
        className={`${styles.tabPanel} ${activeTab !== 'shared-materials' ? styles.tabPanelHidden : ''}`}
      >
        <div className={styles.sharedToolbar}>
          <select
            className={styles.filterSelect}
            value={sharedStatusFilter}
            onChange={(event) =>
              setSharedStatusFilter(
                event.target.value as SharedMaterialStatusFilter,
              )
            }
            aria-label="Filter shared materials by status"
          >
            <option value="ALL">All statuses</option>
            {SHARED_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === 'ACTIVE' ? 'Active' : 'Archived'}
              </option>
            ))}
          </select>
          <span>
            {sharedLoading
              ? 'Loading…'
              : `${sharedSorted.length} shared ${sharedSorted.length === 1 ? 'paper' : 'papers'}`}
          </span>
          <Button
            variant="outline"
            size="md"
            leftIcon={sharedLoading ? <Loader size={14} className={styles.spinningIcon} /> : <RefreshCw size={14} />}
            onClick={() => void loadShared()}
            disabled={sharedLoading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus size={16} />}
            onClick={startSharedCreate}
          >
            Share paper
          </Button>
        </div>

        <BackendGapBanner
          field="SharedMaterial.title, description, materialType, url, topicId"
          feature="PDF, Drive, website, and reference catalog metadata"
        />

        {sharedError && (
          <div className={styles.errorBanner} role="alert">
            <span className={styles.errorBannerIcon}>
              <AlertTriangle size={14} aria-hidden />
              <span>{sharedError}</span>
            </span>
          </div>
        )}

        {sharedLoading ? (
          <div className={styles.sharedEmpty}>
            <Loader size={16} className={styles.spinningIcon} />
            Loading shared materials…
          </div>
        ) : sharedSorted.length === 0 ? (
          <div className={styles.sharedEmpty}>
            <FileText size={28} />
            <strong>No shared papers yet</strong>
            <span>Use Share paper to create a collaboration record.</span>
          </div>
        ) : (
          <div className={styles.sharedGrid}>
            {sharedSorted.map((item, index) => (
              <article
                className={`${styles.sharedCard} ${sharedSelectedIndex === index ? styles.selectedCard : ''}`}
                key={item.sharedMaterialId}
                data-testid="shared-material-card"
              >
                <div className={styles.sharedCardIcon}>
                  <FileText size={20} />
                </div>
                <div className={styles.sharedCardBody}>
                  <h3>Paper #{item.paperId ?? 'Not supplied'}</h3>
                  <p>Shared with colleague #{item.sharedWithColleagueId ?? 'Not supplied'}</p>
                  <span className={styles.sharedStatus}>{item.status ?? 'Unknown'}</span>
                  <small>
                    {item.sharedAt ? new Date(item.sharedAt).toLocaleDateString() : 'Date not supplied'}
                  </small>
                </div>
                <div className={styles.sharedCardActions}>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Edit"
                    onClick={() => startSharedEdit(item)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Delete"
                    onClick={() => void handleSharedDelete(item)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Shared Materials Modal */}
        {sharedModalOpen && (
          <div className={styles.overlay} role="presentation">
            <form className={styles.modal} onSubmit={handleSharedSubmit}>
              <div className={styles.modalHeaderRow}>
                <h2>{sharedEditing ? 'Edit shared paper' : 'Share a paper'}</h2>
                <Button
                  variant="ghost"
                  type="button"
                  aria-label="Close"
                  onClick={() => setSharedModalOpen(false)}
                >
                  <X size={18} />
                </Button>
              </div>
              <label className={styles.formGroup}>
                Paper ID
                <input
                  required
                  inputMode="numeric"
                  value={sharedPaperId}
                  onChange={(e) => setSharedPaperId(e.target.value)}
                />
              </label>
              <label className={styles.formGroup}>
                Colleague ID
                <input
                  required
                  inputMode="numeric"
                  value={sharedColleagueId}
                  onChange={(e) => setSharedColleagueId(e.target.value)}
                />
              </label>
              <label className={styles.formGroup}>
                Status
                <select
                  value={sharedStatus}
                  onChange={(e) => setSharedStatus(e.target.value)}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
              <div className={styles.modalFooter}>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setSharedModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={sharedSaving}>
                  {sharedSaving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default LecturerMaterialsPage;
