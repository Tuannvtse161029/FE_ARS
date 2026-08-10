import React, { useState, useRef } from 'react';
import styles from './CreatePostModal.module.css';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (content: string, file: { name: string; size: string; type: string; url?: string } | null) => void;
  userInitials: string;
  username: string;
}

export const CreatePostModal = ({
  isOpen,
  onClose,
  onPublish,
  userInitials,
  username,
}: CreatePostModalProps) => {
  const [content, setContent] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: string; type: string; url?: string } | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAttachPdfClick = () => {
    pdfInputRef.current?.click();
  };

  const handleUploadImageClick = () => {
    imageInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (file) {
      // Calculate file size
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      
      setAttachedFile({
        name: file.name,
        size: `${sizeMB} MB`,
        type: type === 'pdf' ? 'PDF Document' : 'Image File',
        url: URL.createObjectURL(file), // create temporary URL to preview if needed
      });
    }
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handlePublish = () => {
    if (!content.trim() && !attachedFile) return;
    onPublish(content, attachedFile);
    setContent('');
    setAttachedFile(null);
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Create Forum Post</h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {/* User Card */}
        <div className={styles.userCard}>
          <div className={styles.avatarCircle}>{userInitials}</div>
          <div className={styles.userInfo}>
            <span className={styles.username}>{username}</span>
            <span className={styles.postingTo}>Posting to Forums</span>
          </div>
        </div>

        {/* Text Input Area */}
        <div className={styles.inputArea}>
          <textarea
            placeholder="Share your research thoughts, PDF paper, or image..."
            className={styles.textarea}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
          />
        </div>

        {/* Hidden inputs */}
        <input
          type="file"
          accept=".pdf"
          ref={pdfInputRef}
          onChange={(e) => handleFileChange(e, 'pdf')}
          style={{ display: 'none' }}
        />
        <input
          type="file"
          accept="image/*"
          ref={imageInputRef}
          onChange={(e) => handleFileChange(e, 'image')}
          style={{ display: 'none' }}
        />

        {/* Attachment Options */}
        <div className={styles.attachmentOptions}>
          <button className={styles.attachBtn} onClick={handleAttachPdfClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.pdfIcon}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            Attach PDF Paper
          </button>
          <button className={styles.attachBtn} onClick={handleUploadImageClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.imageIcon}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            Upload Image
          </button>
        </div>

        {/* File preview alert */}
        {attachedFile && (
          <div className={styles.fileAlert}>
            <div className={styles.fileInfo}>
              <span className={styles.checkIcon}>✓</span>
              <div className={styles.fileDetails}>
                <span className={styles.fileName}>{attachedFile.name}</span>
                <span className={styles.fileMeta}>{attachedFile.size} - {attachedFile.type}</span>
              </div>
            </div>
            <button className={styles.removeFileBtn} onClick={handleRemoveFile}>&times;</button>
          </div>
        )}

        {/* Footer actions */}
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={styles.publishBtn}
            onClick={handlePublish}
            disabled={!content.trim() && !attachedFile}
          >
            Publish Post
          </button>
        </div>
      </div>
    </div>
  );
};
