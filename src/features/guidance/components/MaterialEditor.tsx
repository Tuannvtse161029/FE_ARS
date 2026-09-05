/**
 * MaterialEditor — material creation/edit form modal
 *
 * Extracted from src/pages/Lecturer/Materials.tsx
 */
import { useEffect, useState, type FormEvent } from 'react';
import {
  X,
  Library,
  AlertTriangle,
  Upload,
  Link2,
  Check,
  CloudUpload,
  Loader,
} from 'lucide-react';
import { FieldError } from '../../../components/FieldError';
import { FILE_UPLOAD_ACCEPT } from '../../../hooks/useFirebaseFileUpload';
// CSS module kept at the original Materials CSS location for now.
import styles from '../../pages/Lecturer/Materials.module.css';

export interface MaterialEditorProps {
  onClose: () => void;
  onSubmit: (
    title: string,
    description: string,
    sourceMode: 'file' | 'url',
    uploadedFile: File | null,
    fileUrl: string
  ) => Promise<boolean>;
  uploadProgress: number;
  isUploading: boolean;
  uploadError: string | null;
  uploadedUrl: string | null;
  onUploadFile: (file: File) => Promise<string | null>;
  onResetUpload: () => void;
}

export const MaterialEditor: React.FC<MaterialEditorProps> = ({
  onClose,
  onSubmit,
  uploadProgress,
  isUploading,
  uploadError,
  uploadedUrl,
  onUploadFile,
  onResetUpload,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceMode, setSourceMode] = useState<'file' | 'url'>('file');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // ESC key closes the modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const titleErr = !title.trim() ? 'Title is required.' : null;
    setTitleError(titleErr);
    if (titleErr) return;

    setSubmitting(true);
    setFormError(null);
    const ok = await onSubmit(title, description, sourceMode, uploadedFile, fileUrl);
    if (!ok) {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} role="presentation" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form onSubmit={handleSubmit} className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="lm-modal-title">
        <div className={styles.modalHeaderRow}>
          <div className={styles.modalTitleBlock}>
            <span className={styles.modalIconCircle}><Library size={18} aria-hidden /></span>
            <div>
              <h3 id="lm-modal-title" className={styles.modalTitle}>Add a learning material</h3>
              <span className={styles.modalSubtitle}>Upload a file or paste a URL — both are optional.</span>
            </div>
          </div>
          <button type="button" className={styles.modalCloseBtn} onClick={onClose} aria-label="Close" disabled={submitting}>
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="lm-title">* Title</label>
            <input
              id="lm-title"
              type="text"
              className={`${styles.formInput} ${titleError ? styles.formInputError : ''}`}
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(null); }}
              aria-invalid={Boolean(titleError)}
              aria-describedby={titleError ? 'lm-title-error' : undefined}
              required
            />
            <FieldError id="lm-title-error" message={titleError} testId="lm-title-error" />
          </div>

          <div className={styles.sourceModeToggle} role="group" aria-label="Choose material source">
            <button type="button" className={`${styles.modeBtn} ${sourceMode === 'file' ? styles.modeBtnActive : ''}`} onClick={() => setSourceMode('file')} aria-pressed={sourceMode === 'file'}>
              <Upload size={14} aria-hidden />
              Upload file
            </button>
            <button type="button" className={`${styles.modeBtn} ${sourceMode === 'url' ? styles.modeBtnActive : ''}`} onClick={() => setSourceMode('url')} aria-pressed={sourceMode === 'url'}>
              <Link2 size={14} aria-hidden />
              Paste URL
            </button>
          </div>

          {sourceMode === 'file' && (
            <div className={styles.formGroup}>
              <span className={styles.formLabel}>File (optional)</span>
              {uploadedFile && uploadedUrl ? (
                <div className={styles.filePreviewCard}>
                  <div className={styles.filePreviewIcon}><Check size={16} aria-hidden /></div>
                  <div className={styles.filePreviewInfo}>
                    <span className={styles.filePreviewName}>{uploadedFile.name}</span>
                    <span className={styles.filePreviewSize}>{((uploadedFile.size) / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                  <button type="button" className={styles.filePreviewRemove} onClick={() => { setUploadedFile(null); onResetUpload(); }} aria-label="Remove selected file">
                    <X size={14} aria-hidden />
                  </button>
                </div>
              ) : isUploading ? (
                <div className={styles.uploadProgressBox}>
                  <div className={styles.uploadProgressBarOuter}>
                    <div className={styles.uploadProgressBarInner} style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className={styles.uploadProgressLabel}>Uploading… {uploadProgress}%</span>
                </div>
              ) : (
                <div
                  className={styles.fileDropzone}
                  onClick={() => { const input = document.getElementById('lm-file-input') as HTMLInputElement | null; input?.click(); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (document.getElementById('lm-file-input') as HTMLInputElement | null)?.click(); } }}
                  tabIndex={0}
                  role="button"
                  aria-label="Select a file to upload"
                >
                  <CloudUpload size={22} className={styles.dropzoneIcon} aria-hidden />
                  <span className={styles.dropzoneText}>Click to browse — PDF, Word, Excel, PowerPoint, image</span>
                  <span className={styles.dropzoneHint}>Max 10 MB</span>
                  <input
                    id="lm-file-input"
                    type="file"
                    className={styles.hiddenFileInput}
                    accept={FILE_UPLOAD_ACCEPT}
                    onChange={async (e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (!file) return;
                      setUploadedFile(file);
                      const url = await onUploadFile(file);
                      if (!url) setUploadedFile(null);
                      if (e.target) e.target.value = '';
                    }}
                    disabled={isUploading}
                  />
                </div>
              )}
              {uploadError && !formError && <p className={styles.uploadErrorText} role="alert">{uploadError}</p>}
            </div>
          )}

          {sourceMode === 'url' && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="lm-url">File URL (optional)</label>
              <input
                id="lm-url"
                type="url"
                className={`${styles.formInput} ${urlError ? styles.formInputError : ''}`}
                value={fileUrl}
                onChange={(e) => { setFileUrl(e.target.value); if (urlError) setUrlError(null); }}
                placeholder="https://firebasestorage.googleapis.com/.../syllabus.pdf"
                aria-invalid={Boolean(urlError)}
                aria-describedby={urlError ? 'lm-url-error' : undefined}
              />
              <FieldError id="lm-url-error" message={urlError} testId="lm-url-error" />
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="lm-description">Description (optional)</label>
            <textarea id="lm-description" className={styles.formTextarea} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief note about this material…" rows={3} />
          </div>

          {formError && (
            <div className={styles.errorBanner} role="alert">
              <AlertTriangle size={14} aria-hidden />
              <span>{formError}</span>
            </div>
          )}

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className={styles.submitNavyBtn} disabled={submitting || isUploading}>
              {submitting || isUploading ? <Loader size={14} className={styles.spinningIcon} aria-hidden /> : <X size={14} aria-hidden style={{ display: 'none' }} />}
              {submitting ? 'Adding…' : isUploading ? 'Uploading…' : 'Add Material'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default MaterialEditor;
