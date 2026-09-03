import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useFirebaseUpload } from '../../../hooks/useFirebaseUpload';
import { useI18n } from '../../../i18n/I18nContext';
import styles from './PdfDropzone.module.css';
import { FileText, CloudUpload, Check, X } from 'lucide-react';

interface PdfDropzoneProps {
  onUploadComplete: (file: File, pdfUrl: string) => void;
  onRemove: () => void;
  pdfUrl: string | null;
  uploadedFile: File | null;
  /** Fires whenever the upload state changes (true during upload, false when idle/done). */
  onUploadStateChange?: (isUploading: boolean) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
};

export const PdfDropzone = ({
  onUploadComplete,
  onRemove,
  pdfUrl,
  uploadedFile,
  onUploadStateChange,
}: PdfDropzoneProps) => {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const pendingFileRef = useRef<File | null>(null);
  const deliveredUrlRef = useRef<string | null>(null);
  const { uploadPdf, progress, isUploading, error, pdfUrl: hookPdfUrl, resetUpload } =
    useFirebaseUpload();

  // Propagate isUploading state up to the parent (Register) so the submit
  // button can be disabled while the PDF is still uploading to Firebase.
  useEffect(() => {
    onUploadStateChange?.(isUploading);
  }, [isUploading, onUploadStateChange]);

  useEffect(() => {
    if (
      hookPdfUrl &&
      pendingFileRef.current &&
      deliveredUrlRef.current !== hookPdfUrl
    ) {
      onUploadComplete(pendingFileRef.current, hookPdfUrl);
      deliveredUrlRef.current = hookPdfUrl;
    }
  }, [hookPdfUrl, onUploadComplete]);

  const processFile = async (file: File | null) => {
    if (!file) return;
    pendingFileRef.current = file;
    deliveredUrlRef.current = null;
    await uploadPdf(file);
  };

  const onInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    await processFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isUploading) setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0] ?? null;
    await processFile(file);
  };

  const onZoneClick = () => {
    if (!isUploading) inputRef.current?.click();
  };

  const onZoneKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const handleRemove = () => {
    resetUpload();
    pendingFileRef.current = null;
    deliveredUrlRef.current = null;
    onRemove();
  };

  if (pdfUrl && uploadedFile) {
    return (
      <div className={styles.previewCard}>
        <div className={styles.previewIcon}>
          <FileText size={22} />
        </div>
        <div className={styles.previewInfo}>
          <p className={styles.previewName}>{uploadedFile.name}</p>
          <p className={styles.previewSize}>{formatFileSize(uploadedFile.size)}</p>
          <span className={styles.previewBadge}>
            <Check size={14} /> {t('register.dropzone.uploaded')}
          </span>
        </div>
        <button
          type="button"
          className={styles.previewRemove}
          onClick={handleRemove}
          aria-label={t('register.dropzone.removeLabel')}
        >
          <X size={18} />
        </button>
      </div>
    );
  }

  const dropzoneClasses = [
    styles.dropzone,
    isDragging ? styles['dropzone--dragging'] : '',
    isUploading ? styles['dropzone--disabled'] : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <div
        className={dropzoneClasses}
        onClick={onZoneClick}
        onKeyDown={onZoneKeyDown}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label={t('register.dropzone.uploadLabel')}
        aria-disabled={isUploading}
        aria-busy={isUploading}
      >
        <CloudUpload size={24} className={styles.dropzoneIcon} />
        <p className={styles.dropzoneText}>
          {t('register.dropzone.text')}{' '}
          <span className={styles.dropzoneBrowse}>{t('register.dropzone.browse')}</span>
        </p>
        <p className={styles.dropzoneHint}>{t('register.dropzone.hint')}</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className={styles.hiddenInput}
          data-testid="file-input"
          onChange={onInputChange}
          disabled={isUploading}
        />
      </div>

      {isUploading && (
        <div className={styles.progressWrapper} role="status" aria-live="polite">
          <div className={styles.progressBarOuter}>
            <div
              className={styles.progressBarInner}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className={styles.progressLabel}>{t('register.dropzone.uploading')} {progress}%</p>
        </div>
      )}

      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </div>
  );
};

export default PdfDropzone;
