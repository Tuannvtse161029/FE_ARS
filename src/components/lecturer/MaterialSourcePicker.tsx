// MaterialSourcePicker — three-source material picker used by the
// Lecturer "Create Research Topic" modal and the LearningMaterialModal
// "Add material" form. The picker is a self-contained widget that exposes
// a single source value via `onChange`. Parents consume the value and
// decide how to persist it (e.g. set `materialsUrl` on a topic, or POST
// `fileUrl` to learningMaterialService.create).
//
// Three mutually-exclusive sources:
//   - Link     → HTTPS URL pasted directly
//   - Upload   → PDF / doc / image uploaded to Firebase Storage via the
//                existing `useFirebaseFileUpload` hook
//   - Library  → existing `LearningMaterial` item picked from a card grid
//
// Switching tabs clears the previous source so callers can rely on the
// invariant "value.kind matches the active tab" — no stale uploads leaking
// into a URL field, no orphan library selections hanging around after the
// user starts a new URL paste.

import { useEffect, useRef, useState } from 'react';
import {
  Link2,
  Upload,
  Library,
  CloudUpload,
  X,
  Loader,
  Check,
  AlertTriangle,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLearningMaterials } from '../../hooks/useLearningMaterials';
import {
  useFirebaseFileUpload,
  FILE_UPLOAD_ACCEPT,
} from '../../hooks/useFirebaseFileUpload';
import { defaultLearningMaterialFolderPath } from '../../services/learningMaterial.service';
import type { LearningMaterial } from '../../services/learningMaterial.service';
import { validateHttpsUrl } from '../../utils/validationRules';
import { FieldError } from '../FieldError';
import styles from './MaterialSourcePicker.module.css';

export type MaterialSourceValue =
  | { kind: 'url'; url: string }
  | { kind: 'file'; fileUrl: string; fileName: string }
  | { kind: 'library'; learningMaterialId: number };

export interface MaterialSourcePickerProps {
  onChange: (value: MaterialSourceValue | null) => void;
  value: MaterialSourceValue | null;
  errorMessage?: string | null;
  /** Optional id prefix for the URL input (helpful for aria-describedby). */
  inputId?: string;
}

type TabId = 'link' | 'upload' | 'library';

const TAB_ORDER: ReadonlyArray<TabId> = ['link', 'upload', 'library'];

const formatTitle = (m: LearningMaterial): string => {
  if (m.title && m.title.trim().length > 0) return m.title.trim();
  if (m.id) return `Material #${m.id}`;
  return 'Untitled material';
};

export const MaterialSourcePicker = ({
  onChange,
  value,
  errorMessage,
  inputId = 'materialSourcePickerUrl',
}: MaterialSourcePickerProps) => {
  const { user } = useAuth();
  const lecturerId = user?.userId ?? null;

  // ── Tab state is local UI state — NOT derived from `value`. If it were
  // derived, switching tabs would clear the previous tab's input, which
  // fires `onChange(null)`, which makes `value` null, which makes the
  // derived tab snap back to 'link' — so the user could never leave the
  // Link tab. Sync the tab from `value` only at mount time.
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (!value) return 'link';
    if (value.kind === 'url') return 'link';
    if (value.kind === 'file') return 'upload';
    return 'library';
  });

  const [linkUrl, setLinkUrl] = useState<string>(() =>
    value?.kind === 'url' ? value.url : '',
  );
  const [linkError, setLinkError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    () => (value?.kind === 'file' ? value.fileName : null),
  );

  const [pickedLibraryId, setPickedLibraryId] = useState<number | null>(() =>
    value?.kind === 'library' ? value.learningMaterialId : null,
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Firebase upload hook — same config the existing Materials.tsx uses
  // ── so file naming + size limits are consistent across surfaces.
  const {
    uploadFile,
    progress,
    isUploading,
    error: uploadError,
    fileUrl: uploadedFileUrl,
    resetUpload,
  } = useFirebaseFileUpload(defaultLearningMaterialFolderPath(lecturerId));

  const {
    materials,
    isLoading: libraryLoading,
    error: libraryError,
    refetch: refetchLibrary,
  } = useLearningMaterials({ lecturerId });

  // ── Re-emit onChange whenever any source produces a complete value.
  // ── Single source of truth: value is owned by the parent, this widget
  // ── only forwards changes.
  useEffect(() => {
    if (activeTab === 'link') {
      const trimmed = linkUrl.trim();
      if (!trimmed) {
        onChange(null);
        return;
      }
      const err = validateHttpsUrl(trimmed);
      if (err) {
        // Soft-clear: keep the user's text but signal that the value is
        // not yet valid. We don't emit onChange(null) so the parent keeps
        // whatever it had; UI feedback comes from linkError below.
        return;
      }
      onChange({ kind: 'url', url: trimmed });
    } else if (activeTab === 'upload') {
      if (uploadedFileUrl && uploadedFileName) {
        onChange({
          kind: 'file',
          fileUrl: uploadedFileUrl,
          fileName: uploadedFileName,
        });
      } else {
        onChange(null);
      }
    } else {
      if (pickedLibraryId != null) {
        onChange({ kind: 'library', learningMaterialId: pickedLibraryId });
      } else {
        onChange(null);
      }
    }
    // We intentionally don't depend on `onChange` — parents usually pass an
    // inline closure. Re-emitting on every render would spam the parent.
  }, [activeTab, linkUrl, uploadedFileUrl, uploadedFileName, pickedLibraryId]);

  const switchTab = (next: TabId) => {
    if (next === activeTab) return;
    // Clear the previous tab's state so the new tab starts empty.
    if (next !== 'link') {
      setLinkUrl('');
      setLinkError(null);
    }
    if (next !== 'upload') {
      setSelectedFile(null);
      setUploadedFileName(null);
      resetUpload();
    }
    if (next !== 'library') {
      setPickedLibraryId(null);
    }
    setActiveTab(next);
  };

  const handleFilePicked = async (file: File | null) => {
    if (!file) return;
    setSelectedFile(file);
    setUploadedFileName(file.name);
    const url = await uploadFile(file);
    if (!url) {
      // Reset preview state so the UI doesn't show a fake success.
      setSelectedFile(null);
      setUploadedFileName(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveUploadedFile = () => {
    setSelectedFile(null);
    setUploadedFileName(null);
    resetUpload();
  };

  return (
    <div
      className={styles.picker}
      data-testid="material-source-picker"
      role="group"
      aria-label="Choose material source"
    >
      {/* Tab strip — three mutually exclusive sources */}
      <div className={styles.tabStrip} role="tablist">
        {TAB_ORDER.map((tabId) => {
          const label =
            tabId === 'link'
              ? 'Link'
              : tabId === 'upload'
                ? 'Upload'
                : 'From Library';
          const Icon =
            tabId === 'link' ? Link2 : tabId === 'upload' ? Upload : Library;
          const isActive = activeTab === tabId;
          return (
            <button
              key={tabId}
              type="button"
              role="tab"
              id={`msp-tab-${tabId}`}
              aria-selected={isActive}
              aria-controls={`msp-panel-${tabId}`}
              className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ''}`}
              onClick={() => switchTab(tabId)}
            >
              <Icon size={14} aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      {errorMessage && (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={14} aria-hidden />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Link tab ─────────────────────────────────────────────── */}
      <div
        id="msp-panel-link"
        role="tabpanel"
        aria-labelledby="msp-tab-link"
        className={`${styles.panel} ${activeTab !== 'link' ? styles.panelHidden : ''}`}
      >
        <label className={styles.fieldLabel} htmlFor={inputId}>
          Reference URL
        </label>
        <input
          id={inputId}
          type="url"
          className={`${styles.urlInput} ${linkError ? styles.inputError : ''}`}
          value={linkUrl}
          onChange={(e) => {
            setLinkUrl(e.target.value);
            if (linkError) setLinkError(null);
          }}
          onBlur={(e) => {
            const trimmed = e.target.value.trim();
            if (trimmed) setLinkError(validateHttpsUrl(trimmed));
          }}
          placeholder="https://firebasestorage.googleapis.com/.../syllabus.pdf"
          aria-invalid={Boolean(linkError)}
          aria-describedby={linkError ? `${inputId}-error` : `${inputId}-hint`}
          data-testid="material-source-picker-url"
        />
        <FieldError
          id={`${inputId}-error`}
          message={linkError}
          testId="material-source-picker-url-error"
        />
        <div className={styles.hint} id={`${inputId}-hint`}>
          Paste any HTTPS URL — typically a Firebase Storage PDF link.
        </div>
      </div>

      {/* ── Upload tab ───────────────────────────────────────────── */}
      <div
        id="msp-panel-upload"
        role="tabpanel"
        aria-labelledby="msp-tab-upload"
        className={`${styles.panel} ${activeTab !== 'upload' ? styles.panelHidden : ''}`}
      >
        {uploadedFileUrl && uploadedFileName ? (
          <div className={styles.filePreview} data-testid="material-source-picker-file-preview">
            <div className={styles.filePreviewIcon}>
              <Check size={16} aria-hidden />
            </div>
            <div className={styles.filePreviewInfo}>
              <span className={styles.filePreviewName}>{uploadedFileName}</span>
              <span className={styles.filePreviewSize}>
                {selectedFile
                  ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB`
                  : 'Uploaded'}
              </span>
            </div>
            <button
              type="button"
              className={styles.filePreviewRemove}
              onClick={handleRemoveUploadedFile}
              aria-label="Remove selected file"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ) : isUploading ? (
          <div className={styles.uploadProgress} data-testid="material-source-picker-progress">
            <div className={styles.uploadProgressBarOuter}>
              <div
                className={styles.uploadProgressBarInner}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className={styles.uploadProgressLabel}>
              Uploading… {progress}%
            </span>
          </div>
        ) : (
          <div
            className={styles.dropzone}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0] ?? null;
              void handleFilePicked(file);
            }}
            tabIndex={0}
            role="button"
            aria-label="Select a file to upload"
            data-testid="material-source-picker-dropzone"
          >
            <CloudUpload size={22} aria-hidden />
            <span className={styles.dropzoneText}>
              Drop a file or click to browse
            </span>
            <span className={styles.dropzoneHint}>
              PDF, Word, Excel, PowerPoint, image — max 10 MB
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept={FILE_UPLOAD_ACCEPT}
              className={styles.hiddenFileInput}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                void handleFilePicked(file);
              }}
              disabled={isUploading}
            />
          </div>
        )}
        {uploadError && (
          <p className={styles.uploadErrorText} role="alert">
            {uploadError}
          </p>
        )}
      </div>

      {/* ── Library tab ──────────────────────────────────────────── */}
      <div
        id="msp-panel-library"
        role="tabpanel"
        aria-labelledby="msp-tab-library"
        className={`${styles.panel} ${activeTab !== 'library' ? styles.panelHidden : ''}`}
      >
        {libraryError && (
          <div className={styles.errorBanner} role="alert">
            <AlertTriangle size={14} aria-hidden />
            <span>{libraryError.message}</span>
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => void refetchLibrary()}
            >
              Retry
            </button>
          </div>
        )}
        {libraryLoading ? (
          <div className={styles.loadingPanel}>
            <Loader size={16} className={styles.spinningIcon} aria-hidden />
            Loading your library…
          </div>
        ) : materials.length === 0 ? (
          <div className={styles.emptyPanel}>
            <Library size={18} aria-hidden />
            <span>
              Your library is empty. Use the Link or Upload tab to attach a
              material, or add one from the Materials page first.
            </span>
          </div>
        ) : (
          <div className={styles.libraryGrid} data-testid="material-source-picker-library">
            {materials.map((m) => {
              const id = typeof m.id === 'number' ? m.id : -1;
              const isSelected = pickedLibraryId === id;
              const description = m.description?.trim() ?? '';
              return (
                <article
                  key={`msp-mat-${id}`}
                  className={`${styles.libraryCard} ${isSelected ? styles.libraryCardSelected : ''}`}
                  aria-pressed={isSelected}
                >
                  <div className={styles.libraryCardIcon}>
                    <FileText size={18} aria-hidden />
                  </div>
                  <div className={styles.libraryCardBody}>
                    <h4 className={styles.libraryCardTitle}>{formatTitle(m)}</h4>
                    {description ? (
                      <p className={styles.libraryCardDesc}>{description}</p>
                    ) : (
                      <p className={styles.libraryCardDescMuted}>No description</p>
                    )}
                    {m.fileUrl && (
                      <a
                        className={styles.libraryCardLink}
                        href={m.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={12} aria-hidden />
                        Preview
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    className={`${styles.useBtn} ${isSelected ? styles.useBtnSelected : ''}`}
                    onClick={() => setPickedLibraryId(isSelected ? null : id)}
                    aria-label={
                      isSelected
                        ? `Unselect ${formatTitle(m)}`
                        : `Use ${formatTitle(m)}`
                    }
                  >
                    {isSelected ? (
                      <>
                        <Check size={14} aria-hidden /> Selected
                      </>
                    ) : (
                      'Use this material'
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MaterialSourcePicker;