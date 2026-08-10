import { useState, useRef } from 'react';
import styles from './SubmitReport.module.css';

export const SubmitReport = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Simulated file upload state
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string } | null>({
    name: 'Report1_Project Introduction.docx',
    size: '0.22 MB',
  });
  const [notes, setNotes] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setUploadedFile({
        name: file.name,
        size: `${sizeMB} MB`,
      });
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile) {
      alert('Please upload a report file first.');
      return;
    }
    setIsSuccess(true);
  };

  return (
    <div className={styles.submitReportPage}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; Collaborative Workspace &gt; Core Automation Network V3 &gt; <span className={styles.activeBreadcrumb}>Submit Report</span>
      </div>

      {/* Page Title */}
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Submit Milestone Research Report</h1>
      </div>

      {/* Main Grid */}
      <div className={styles.submitGrid}>
        
        {/* Left Column: Milestone Details */}
        <div className={styles.detailsCard}>
          <h3 className={styles.sectionTitle}>MILESTONE DETAILS CRITERIA</h3>
          
          <div className={styles.detailsGroup}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>TARGET</span>
              <span className={styles.detailVal}>Phase 2 Literature Review</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>ASSIGNED BY</span>
              <span className={styles.detailVal}>Dr. Pham Lecturer</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>REQUIREMENTS</span>
              <span className={styles.detailVal}>Analyze 15 papers.</span>
            </div>
          </div>

          {/* Deadline Warning banner */}
          <div className={styles.deadlineWarning}>
            <span className={styles.warningIcon}>⚠️</span>
            <span className={styles.warningText}>[!!] 4 Days 6 Hours Left</span>
          </div>
        </div>

        {/* Right Column: Artifact Submission */}
        <div className={styles.submissionCard}>
          <h3 className={styles.sectionTitle}>ARTIFACT SUBMISSION DROPZONE</h3>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {uploadedFile ? (
            /* Uploaded file details card */
            <div className={styles.fileCardZone}>
              <div className={styles.fileIcon}>📄</div>
              <div className={styles.fileMeta}>
                <span className={styles.fileName}>{uploadedFile.name}</span>
                <span className={styles.fileSize}>{uploadedFile.size}</span>
              </div>
              <button
                type="button"
                className={styles.removeFileBtn}
                onClick={handleRemoveFile}
              >
                ✕ Remove file
              </button>
            </div>
          ) : (
            /* Empty drag & drop zone */
            <div className={styles.dropzone} onClick={handleBrowseClick}>
              <div className={styles.uploadIcon}>⬆️</div>
              <p className={styles.dropzoneTitle}>Drag & Drop report file here</p>
              <p className={styles.dropzoneSub}>
                or <span className={styles.browseLink}>browse files</span> - PDF, DOCX supported - Max 25 MB
              </p>
            </div>
          )}

          {/* Notes input */}
          <div className={styles.notesGroup}>
            <label className={styles.notesLabel}>STUDENT GROUP NOTES / COMMENTS</label>
            <textarea
              className={styles.notesTextarea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes for your supervisor..."
              rows={4}
            />
          </div>
        </div>

      </div>

      {/* Submit Action Center */}
      <div className={styles.submitActionCenter}>
        <button 
          type="button" 
          className={styles.submitBtn} 
          onClick={handleSubmit}
          disabled={!uploadedFile}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <polyline points="9 15 12 12 15 15"></polyline>
          </svg>
          Submit Report File
        </button>
      </div>

      {/* Success Modal */}
      {isSuccess && (
        <div className={styles.modalOverlay}>
          <div className={styles.successModalCard}>
            <div className={styles.successIconCircle}>✓</div>
            <h3 className={styles.successModalTitle}>Report Submitted Successfully!</h3>
            <p className={styles.successModalText}>
              Your milestone report "<b>{uploadedFile?.name}</b>" has been uploaded to the collaborative workspace. Your advisor has been notified.
            </p>
            <button className={styles.successBtn} onClick={() => setIsSuccess(false)}>
              Back to Workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmitReport;
