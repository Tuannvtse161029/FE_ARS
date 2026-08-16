import { useCallback, useRef, useState } from 'react';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  type UploadTask,
} from 'firebase/storage';
import { storage, isFirebaseConfigured } from '../firebase';

// PNG / JPG / PDF for the Approve-Payout modal receipt.
// Sibling to `useFirebaseUpload` (which stays PDF-only for manuscript upload).
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const RECEIPT_FOLDER = 'withdrawal_receipts/';

export type ReceiptFileKind = 'pdf' | 'image';

export interface ReceiptDraft {
  file: File;
  previewUrl: string;
  kind: ReceiptFileKind;
  sizeBytes: number;
}

export interface UseReceiptUploadReturn {
  draft: ReceiptDraft | null;
  isUploading: boolean;
  progress: number;
  error: string | null;
  uploadedUrl: string | null;
  selectFile: (file: File | null) => void;
  reset: () => void;
  upload: () => Promise<string>;
}

function classify(file: File): ReceiptFileKind | null {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/png' || file.type === 'image/jpeg') return 'image';
  return null;
}

export const useReceiptUpload = (): UseReceiptUploadReturn => {
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const uploadTaskRef = useRef<UploadTask | null>(null);

  const reset = useCallback(() => {
    if (uploadTaskRef.current) {
      uploadTaskRef.current.cancel();
      uploadTaskRef.current = null;
    }
    setDraft((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setProgress(0);
    setIsUploading(false);
    setError(null);
    setUploadedUrl(null);
  }, []);

  const selectFile = useCallback((file: File | null) => {
    setError(null);
    setUploadedUrl(null);
    if (!file) {
      reset();
      return;
    }
    const kind = classify(file);
    if (!kind) {
      reset();
      setError('Only PDF, PNG, or JPG files are accepted.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      reset();
      setError('Receipt file must be 10 MB or less.');
      return;
    }
    setDraft((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return {
        file,
        previewUrl: URL.createObjectURL(file),
        kind,
        sizeBytes: file.size,
      };
    });
  }, [reset]);

  const upload = useCallback(async (): Promise<string> => {
    if (!draft) {
      const message = 'No receipt file selected.';
      setError(message);
      throw new Error(message);
    }
    if (!isFirebaseConfigured() || !storage) {
      setError(
        'Firebase storage is not configured. Add your Firebase credentials to .env to enable receipt uploads.',
      );
      throw new Error('Firebase storage not configured');
    }

    setError(null);
    setProgress(0);
    setIsUploading(true);
    setUploadedUrl(null);

    try {
      const sanitizedName = draft.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueName = `${Date.now()}_${sanitizedName}`;
      const fileRef = ref(storage, `${RECEIPT_FOLDER}${uniqueName}`);
      const task = uploadBytesResumable(fileRef, draft.file);
      uploadTaskRef.current = task;

      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          (snapshot) => {
            const pct = snapshot.totalBytes > 0
              ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
              : 0;
            setProgress(pct);
          },
          (err) => reject(err),
          () => resolve(),
        );
      });

      const url = await getDownloadURL(task.snapshot.ref);
      setUploadedUrl(url);
      setIsUploading(false);
      uploadTaskRef.current = null;
      return url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setError(message);
      setIsUploading(false);
      uploadTaskRef.current = null;
      throw err;
    }
  }, [draft]);

  return {
    draft,
    isUploading,
    progress,
    error,
    uploadedUrl,
    selectFile,
    reset,
    upload,
  };
};

export default useReceiptUpload;
