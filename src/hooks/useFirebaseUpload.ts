import { useCallback, useRef, useState } from 'react';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  type UploadTask,
  type UploadTaskSnapshot,
} from 'firebase/storage';
import { storage, isFirebaseConfigured } from '../firebase';

export interface UseFirebaseUploadReturn {
  uploadPdf: (file: File) => Promise<void>;
  progress: number;
  isUploading: boolean;
  error: string | null;
  pdfUrl: string | null;
  resetUpload: () => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const PDF_MIME_TYPE = 'application/pdf';

export const useFirebaseUpload = (
  folderPath: string = 'verification_docs/'
): UseFirebaseUploadReturn => {
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const uploadTaskRef = useRef<UploadTask | null>(null);

  const resetUpload = useCallback(() => {
    if (uploadTaskRef.current) {
      uploadTaskRef.current.cancel();
      uploadTaskRef.current = null;
    }
    setProgress(0);
    setIsUploading(false);
    setError(null);
    setPdfUrl(null);
  }, []);

  const uploadPdf = useCallback(
    async (file: File): Promise<void> => {
      if (!isFirebaseConfigured()) {
        setError('Firebase storage is not configured. Please add your Firebase credentials to the .env file.');
        setPdfUrl(null);
        return;
      }

      if (!storage) {
        setError('Firebase storage is not initialized.');
        setPdfUrl(null);
        return;
      }

      if (file.type !== PDF_MIME_TYPE) {
        setError('Only PDF files are allowed.');
        setPdfUrl(null);
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError('File size must be 10 MB or less.');
        setPdfUrl(null);
        return;
      }

      try {
        setError(null);
        setProgress(0);
        setIsUploading(true);
        setPdfUrl(null);

        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueName = `${Date.now()}_${sanitizedName}`;
        const fileRef = ref(storage, `${folderPath}${uniqueName}`);

        const task = uploadBytesResumable(fileRef, file);
        uploadTaskRef.current = task;

        await new Promise<void>((resolve, reject) => {
          task.on(
            'state_changed',
            (snapshot: UploadTaskSnapshot) => {
              const pct = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              );
              setProgress(pct);
            },
            (err) => {
              reject(err);
            },
            () => {
              resolve();
            }
          );
        });

        const url = await getDownloadURL(task.snapshot.ref);
        setPdfUrl(url);
        setIsUploading(false);
        uploadTaskRef.current = null;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Upload failed. Please try again.';
        setError(message);
        setIsUploading(false);
        setPdfUrl(null);
        uploadTaskRef.current = null;
      }
    },
    [folderPath, storage]
  );

  return {
    uploadPdf,
    progress,
    isUploading,
    error,
    pdfUrl,
    resetUpload,
  };
};

export default useFirebaseUpload;
