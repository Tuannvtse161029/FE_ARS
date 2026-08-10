import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useFirebaseUpload } from '../../../hooks/useFirebaseUpload';
import styles from './PdfDropzone.module.css';

interface PdfDropzoneProps {
  onUploadComplete: (file: File, pdfUrl: string) => void;
  onRemove: () => void;
  pdfUrl: string | null;
  uploadedFile: File | null;
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

const PdfIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M9 13h6" />
    <path d="M9 17h6" />
  </svg>
);

const UploadCloudIcon = () => (
  <svg className={styles.dropzoneIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const PdfDropzone = ({
  onUploadComplete,
  onRemove,
  pdfUrl,
  uploadedFile,
}: PdfDropzoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const pendingFileRef = useRef<File | null>(null);
  const deliveredUrlRef = useRef<string | null>(null);
  const { uploadPdf, progress, isUploading, error, pdfUrl: hookPdfUrl, resetUpload } =
    useFirebaseUpload();

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
          <PdfIcon />
        </div>
        <div className={styles.previewInfo}>
          <p className={styles.previewName}>{uploadedFile.name}</p>
          <p className={styles.previewSize}>{formatFileSize(uploadedFile.size)}</p>
          <span className={styles.previewBadge}>
            <CheckIcon /> Uploaded
          </span>
        </div>
        <button
          type="button"
          className={styles.previewRemove}
          onClick={handleRemove}
          aria-label="Remove uploaded PDF"
        >
          <CloseIcon />
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
        aria-label="Upload verification PDF"
      >
        <UploadCloudIcon />
        <p className={styles.dropzoneText}>
          Drag &amp; drop verification document here, or{' '}
          <span className={styles.dropzoneBrowse}>browse files</span>
        </p>
        <p className={styles.dropzoneHint}>PDF only, max 10MB</p>
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
        <div className={styles.progressWrapper}>
          <div className={styles.progressBarOuter}>
            <div
              className={styles.progressBarInner}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className={styles.progressLabel}>Uploading... {progress}%</p>
        </div>
      )}

      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
};

export default PdfDropzone;
