// useFirebaseFileUpload — general-purpose Firebase Storage upload for learning
// materials (PDF, Word, Excel, PowerPoint, images, etc.). The existing
// `useFirebaseUpload` hook is hardcoded to PDF-only and is used by the
// registration / research-submission flows that must reject non-PDFs.
//
// Materials are reference content attached to a research topic. The lecturer
// may paste a syllabus, an Excel tracking sheet, a slide deck, or an image of
// a whiteboard — anything goes — so this hook mirrors the `useFirebaseUpload`
// surface but with a permissive MIME allow-list.
//
// Usage:
//   const { uploadFile, progress, isUploading, error, fileUrl, resetUpload } =
//     useFirebaseFileUpload('learning-materials/42/');
//   const url = await uploadFile(pickedFile);

import { useCallback, useRef, useState } from 'react';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  type UploadTask,
  type UploadTaskSnapshot,
} from 'firebase/storage';
import { storage, isFirebaseConfigured } from '../firebase';

export interface UseFirebaseFileUploadReturn {
  uploadFile: (file: File) => Promise<string | null>;
  progress: number;
  isUploading: boolean;
  error: string | null;
  fileUrl: string | null;
  resetUpload: () => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Permissive set covering the common reference-material formats. The check is
// by `file.type` (which browsers set from the extension) — unknown extensions
// fall through with a friendly error rather than being uploaded.
export const FILE_UPLOAD_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/rtf',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const;

export type FileUploadMimeType = (typeof FILE_UPLOAD_MIME_TYPES)[number];

export const FILE_UPLOAD_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.jpg,.jpeg,.png,.gif,.webp,.svg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,image/jpeg,image/png,image/gif,image/webp,image/svg+xml';

export const useFirebaseFileUpload = (
  folderPath: string = 'learning-materials/'
): UseFirebaseFileUploadReturn => {
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const uploadTaskRef = useRef<UploadTask | null>(null);

  const resetUpload = useCallback(() => {
    if (uploadTaskRef.current) {
      uploadTaskRef.current.cancel();
      uploadTaskRef.current = null;
    }
    setProgress(0);
    setIsUploading(false);
    setError(null);
    setFileUrl(null);
  }, []);

  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      if (!isFirebaseConfigured()) {
        setError(
          'Firebase storage is not configured. Please add your Firebase credentials to the .env file.',
        );
        setFileUrl(null);
        return null;
      }

      if (!storage) {
        setError('Firebase storage is not initialized.');
        setFileUrl(null);
        return null;
      }

      if (!(FILE_UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)) {
        setError(
          'Unsupported file type. Allowed: PDF, Word, Excel, PowerPoint, text, CSV, and common image formats.',
        );
        setFileUrl(null);
        return null;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError('File size must be 10 MB or less.');
        setFileUrl(null);
        return null;
      }

      try {
        setError(null);
        setProgress(0);
        setIsUploading(true);
        setFileUrl(null);

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
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
              );
              setProgress(pct);
            },
            (err) => {
              reject(err);
            },
            () => {
              resolve();
            },
          );
        });

        const url = await getDownloadURL(task.snapshot.ref);
        setFileUrl(url);
        setIsUploading(false);
        uploadTaskRef.current = null;
        return url;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Upload failed. Please try again.';
        setError(message);
        setIsUploading(false);
        setFileUrl(null);
        uploadTaskRef.current = null;
        return null;
      }
    },
    [folderPath, storage],
  );

  return {
    uploadFile,
    progress,
    isUploading,
    error,
    fileUrl,
    resetUpload,
  };
};

export default useFirebaseFileUpload;
