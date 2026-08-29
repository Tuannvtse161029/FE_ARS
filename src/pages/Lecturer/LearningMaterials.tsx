// Lecturer — Learning Materials (top-level page)
//
// This is the canonical Lecturer surface for managing Learning Materials.
// Previously, materials were managed only inside the per-topic modal
// (LearningMaterialModal) launched from the Research Topic row — that made
// it impossible to enumerate "all my materials" without first opening a
// topic. Per the Coordinator brief, Learning Materials is its own top-level
// nav item with its own page.
//
// All data comes from the live API (`learningMaterialService.getAll`).
// No mock records. The Lecturer UI is the same form/modal used by the
// per-topic flow (title + file URL + optional sub-field id) so creation
// here also propagates to the topic-scoped list.

import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLearningMaterials } from '../../hooks/useLearningMaterials';
import { learningMaterialService } from '../../services/learningMaterial.service';
import type { LearningMaterial } from '../../services/learningMaterial.service';
import { FieldError } from '../../components/FieldError';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { usePagination } from '../../hooks/usePagination';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import { ROUTES } from '../../routes/paths';
import { validateHttpsUrl, validatePositiveInteger } from '../../utils/validationRules';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import styles from './LearningMaterials.module.css';

const formatTitle = (m: LearningMaterial): string => {
  if (m.title && m.title.trim().length > 0) return m.title.trim();
  if (m.id) return `Material #${m.id}`;
  return 'Untitled material';
};

export const LecturerLearningMaterialsPage = () => {
  const { user } = useAuth();
  const lecturerId = user?.userId ?? null;
  const { materials, isLoading, error, refetch } = useLearningMaterials({
    lecturerId,
  });

  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Add form state ────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newFileUrl, setNewFileUrl] = useState('');
  const [newSubFieldId, setNewSubFieldId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [titleFieldError, setTitleFieldError] = useState<string | null>(null);
  const [urlFieldError, setUrlFieldError] = useState<string | null>(null);
  const [subFieldIdError, setSubFieldIdError] = useState<string | null>(null);

  // ── Banner state ──────────────────────────────────────────────────────
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter((m) =>
      [m.title ?? '', m.description ?? '', m.fileUrl ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [materials, search]);

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
  } = usePagination<LearningMaterial>(filtered, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetPage();
  }, [search, resetPage]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!lecturerId) {
      setFormError('No lecturer session — please sign in again.');
      return;
    }
    const title = newTitle.trim();
    const fileUrl = newFileUrl.trim();
    const titleErr = !title ? 'Title is required.' : null;
    const urlErr = validateHttpsUrl(fileUrl);
    const subErr = validatePositiveInteger(newSubFieldId);
    setTitleFieldError(titleErr);
    setUrlFieldError(urlErr);
    setSubFieldIdError(subErr);
    if (titleErr || urlErr || subErr) {
      return;
    }
    const subFieldIdNum = newSubFieldId.trim().length
      ? Number(newSubFieldId.trim())
      : undefined;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await learningMaterialService.create({
        lecturerId,
        title,
        fileUrl,
        description: null,
        subFieldId:
          typeof subFieldIdNum === 'number' && Number.isFinite(subFieldIdNum)
            ? subFieldIdNum
            : null,
      });
      setNewTitle('');
      setNewFileUrl('');
      setNewSubFieldId('');
      setTitleFieldError(null);
      setUrlFieldError(null);
      setSubFieldIdError(null);
      showBanner('Material added to your library.');
      await refetch();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'The server rejected the material. Please try again.';
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
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
      await refetch();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete the material.';
      showBanner(message, 'error');
    }
  };

  return (
    <div
      className={styles.researchGroupPage}
      data-testid="lecturer-learning-materials"
    >
      <PageHeader
        eyebrow="LECTURER WORKSPACE"
        title="Learning Materials"
        description="Reference PDFs and resources linked to your research topics. Attach a Firebase Storage URL for each material."
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
              aria-label="Refresh"
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus size={16} aria-hidden />}
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? 'Hide form' : 'Add Material'}
            </Button>
          </>
        }
        accent="var(--ars-lecturer)"
      />

      <div className={styles.breadcrumbs}>
        Home &gt; <Link to={ROUTES.FORUM}>Forums</Link> &gt;{' '}
        <span className={styles.activeBreadcrumb}>Learning Materials</span>
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

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span className={styles.errorBannerIcon}>
            <AlertTriangle size={14} aria-hidden />
            <span>{error.message}</span>
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

      {showForm && (
        <form onSubmit={handleAdd} className={styles.modalCard}>
          <div className={styles.modalHeaderRow}>
            <div className={styles.modalTitleBlock}>
              <span className={styles.modalIconCircle}>
                <Library size={18} aria-hidden />
              </span>
              <div>
                <h3 className={styles.modalTitle}>Add a learning material</h3>
                <span className={styles.modalSubtitle}>
                  Paste a Firebase Storage URL and a title.
                </span>
              </div>
            </div>
          </div>
          <div className={styles.modalForm}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="lm-title">
                * Title
              </label>
<input
              id="lm-title"
              type="text"
              className={`${styles.formInput} ${titleFieldError ? styles.formInputError : ''}`}
              value={newTitle}
              onChange={(e) => {
                setNewTitle(e.target.value);
                if (titleFieldError) setTitleFieldError(null);
              }}
              aria-invalid={Boolean(titleFieldError)}
              aria-describedby={titleFieldError ? 'lm-title-error' : undefined}
              required
            />
            <FieldError id="lm-title-error" message={titleFieldError} testId="lm-title-error" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="lm-url">
              * File URL
            </label>
            <input
              id="lm-url"
              type="url"
              className={`${styles.formInput} ${urlFieldError ? styles.formInputError : ''}`}
              value={newFileUrl}
              onChange={(e) => {
                setNewFileUrl(e.target.value);
                if (urlFieldError) setUrlFieldError(null);
              }}
              placeholder="https://firebasestorage.googleapis.com/.../syllabus.pdf"
              aria-invalid={Boolean(urlFieldError)}
              aria-describedby={urlFieldError ? 'lm-url-error' : undefined}
              required
            />
            <FieldError id="lm-url-error" message={urlFieldError} testId="lm-url-error" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="lm-subfield">
              Sub-field ID (optional)
            </label>
            <input
              id="lm-subfield"
              type="number"
              className={`${styles.formInput} ${subFieldIdError ? styles.formInputError : ''}`}
              value={newSubFieldId}
              onChange={(e) => {
                setNewSubFieldId(e.target.value);
                if (subFieldIdError) setSubFieldIdError(null);
              }}
              placeholder="42"
              aria-invalid={Boolean(subFieldIdError)}
              aria-describedby={subFieldIdError ? 'lm-subfield-error' : undefined}
            />
            <FieldError id="lm-subfield-error" message={subFieldIdError} testId="lm-subfield-error" />
          </div>
            {formError && (
              <div className={styles.errorBanner} role="alert">
                <AlertTriangle size={14} aria-hidden />
                <span>{formError}</span>
              </div>
            )}
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowForm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.submitNavyBtn}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader
                    size={14}
                    className={styles.spinningIcon}
                    aria-hidden
                  />
                ) : (
                  <Plus size={14} aria-hidden />
                )}
                {isSubmitting ? 'Adding…' : 'Add Material'}
              </button>
            </div>
          </div>
        </form>
      )}

      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        searchPlaceholder="Search materials by title, description, or URL"
        refreshLabel="Refresh"
      />
      <div className={styles.tableCard}>
        {isLoading ? (
          <div className={styles.tableEmpty} role="status">
            <Loader size={16} className={styles.spinningIcon} aria-hidden />
            Loading materials…
          </div>
        ) : materials.length === 0 ? (
          <div className={styles.tableEmpty}>
            <FileText size={20} aria-hidden /> No learning materials yet.
            Click "Add Material" to upload your first one.
          </div>
        ) : totalItems === 0 ? (
          <div className={styles.tableEmpty}>
            No materials match "{search.trim()}".
          </div>
        ) : (
          <>
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>TITLE</th>
                    <th>SUB-FIELD</th>
                    <th>UPDATED</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((m) => {
                    const id = typeof m.id === 'number' ? m.id : -1;
                    return (
                      <tr key={String(m.id ?? id)}>
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
                              onClick={() => void handleDelete(id)}
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
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              startIndex={startIndex}
              endIndex={endIndex}
              onPrev={prev}
              onNext={next}
              onPage={setPage}
              itemLabel="materials"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default LecturerLearningMaterialsPage;