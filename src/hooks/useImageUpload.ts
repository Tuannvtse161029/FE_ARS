import { useCallback, useRef, useState } from 'react';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  type UploadTask,
  type UploadTaskSnapshot,
} from 'firebase/storage';
import { storage, isFirebaseConfigured } from '../firebase';

export interface UseImageUploadReturn {
  uploadImage: (file: File) => Promise<string | null>;
  progress: number;
  isUploading: boolean;
  error: string | null;
  imageUrl: string | null;
  resetUpload: () => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];

export const useImageUpload = (
  folderPath: string = 'forum_images/'
): UseImageUploadReturn => {
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const uploadTaskRef = useRef<UploadTask | null>(null);

  const resetUpload = useCallback(() => {
    if (uploadTaskRef.current) {
      uploadTaskRef.current.cancel();
      uploadTaskRef.current = null;
    }
    setProgress(0);
    setIsUploading(false);
    setError(null);
    setImageUrl(null);
  }, []);

  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      if (!isFirebaseConfigured()) {
        setError('Firebase storage is not configured. Please add your Firebase credentials to the .env file.');
        setImageUrl(null);
        return null;
      }

      if (!storage) {
        setError('Firebase storage is not initialized.');
        setImageUrl(null);
        return null;
      }

      if (!IMAGE_MIME_TYPES.includes(file.type)) {
        setError('Only JPEG, PNG, GIF, and WebP images are allowed.');
        setImageUrl(null);
        return null;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError('File size must be 10 MB or less.');
        setImageUrl(null);
        return null;
      }

      try {
        setError(null);
        setProgress(0);
        setIsUploading(true);
        setImageUrl(null);

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
        setImageUrl(url);
        setIsUploading(false);
        uploadTaskRef.current = null;
        return url;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Upload failed. Please try again.';
        setError(message);
        setIsUploading(false);
        setImageUrl(null);
        uploadTaskRef.current = null;
        return null;
      }
    },
    [folderPath, storage]
  );

  return {
    uploadImage,
    progress,
    isUploading,
    error,
    imageUrl,
    resetUpload,
  };
};

export default useImageUpload;
