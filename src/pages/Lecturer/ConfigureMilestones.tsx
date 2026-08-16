import { useState } from 'react';
import { Circle, Upload, FileText, X, Check } from 'lucide-react';
import styles from './ConfigureMilestones.module.css';

export const ConfigureMilestones = () => {
  const [phase, setPhase] = useState('Phase 2: Literature Review Submission');
  const [description, setDescription] = useState(
    'Submit a comprehensive critique analyzing 15 or more peer-reviewed articles published within the last five years. The review must adhere to the PRISMA 2020 reporting guidelines and include a structured synthesis covering: (1) methodology appraisal using standardized rubrics, (2) thematic clustering by intervention type and outcome domain, (3) a comparative risk-of-bias table using the Cochrane RoB 2.0 instrument, and (4) a gap analysis section identifying opportunities for future empirical inquiry. Minimum word count: 6,500 words excluding references and appendices. All citations must conform to APA 7th edition format.'
  );
  const [dueDate, setDueDate] = useState('2026-08-01 23:59:59');
  
  // Simulated file upload state
  const [uploadedFiles, setUploadedFiles] = useState<string[]>(['Report3_References.docx']);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleRemoveFile = (fileName: string) => {
    setUploadedFiles(uploadedFiles.filter((x) => x !== fileName));
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert('Please enter milestone requirements.');
      return;
    }
    setIsSuccess(true);
  };

  return (
    <div className={styles.configureMilestones}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; Guidance Group &gt; Core Automation Network V3 &gt; <span className={styles.activeBreadcrumb}>Configure Milestones</span>
      </div>

      {/* Page header and card */}
      <div className={styles.configCard}>
        <div className={styles.cardHeader}>
          <div className={styles.headerTitleRow}>
            <span className={styles.headerLabel}>MILESTONE CONFIGURATION</span>
            <h1 className={styles.pageTitle}>CONFIGURE MILESTONE TARGETS</h1>
          </div>
          <span className={styles.draftBadge}>
            <Circle size={8} fill="currentColor" aria-hidden style={{ marginRight: 4 }} />
            DRAFT
          </span>
        </div>

        <form onSubmit={handlePublish} className={styles.form}>
          {/* Milestone Track Phase */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>* Milestone Track Phase</label>
            <select
              className={styles.formSelect}
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
            >
              <option>Phase 1: Project Introduction Draft</option>
              <option>Phase 2: Literature Review Submission</option>
              <option>Phase 3: Methodology & Implementation Details</option>
              <option>Phase 4: Final Evaluation Report</option>
            </select>
            <span className={styles.helperText}>
              Select the research phase this milestone belongs to within the active automation network.
            </span>
          </div>

          {/* Description Requirements */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>* Description Requirements & Guidelines</label>
            <textarea
              className={styles.formTextarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              required
            />
            <div className={styles.textMeta}>
              <span className={styles.helperText}>
                Provide detailed submission requirements, evaluation criteria, and formatting standards.
              </span>
              <span className={styles.charCounter}>{description.length} / 8,000</span>
            </div>
          </div>

          {/* Due date row */}
          <div className={styles.rowFormGroup}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.formLabel}>* Hard Due Date & Timeline Boundary</label>
              <input
                type="text"
                className={styles.formInput}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="YYYY-MM-DD HH:mm:ss"
                required
              />
              <span className={styles.helperText}>
                UTC timestamp. Submissions received after this boundary will be automatically flagged as non-compliant.
              </span>
            </div>

            {/* Warning days remaining box */}
            <div className={styles.remainingBox}>
              <Circle size={8} fill="currentColor" className={styles.remainingDot} aria-hidden />
              <div className={styles.remainingTexts}>
                <span className={styles.remainingTitle}>38 days remaining</span>
                <span className={styles.remainingSub}>Deadline - Aug 1, 2026 - 23:59 UTC</span>
              </div>
            </div>
          </div>

          {/* Reference Materials upload zone */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Reference Materials / Supporting Instructions Template</label>
            <div className={styles.uploadZone}>
              <Upload size={28} className={styles.uploadIcon} aria-hidden />
              <p className={styles.uploadTitle}>[Drag & Drop reference PDFs or template DOCX documents here]</p>
              <p className={styles.uploadSub}>or <span className={styles.browseLink}>browse files</span> - PDF, DOCX supported - Max 25 MB per file</p>
            </div>

            {/* Uploaded files queue */}
            {uploadedFiles.length > 0 && (
              <div className={styles.filesList}>
                {uploadedFiles.map((file) => (
                  <div key={file} className={styles.fileRow}>
                    <FileText size={16} className={styles.fileIcon} aria-hidden />
                    <span className={styles.fileName}>{file}</span>
                    <button
                      type="button"
                      className={styles.removeFileBtn}
                      onClick={() => handleRemoveFile(file)}
                      aria-label={`Remove ${file}`}
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <span className={styles.helperText} style={{ marginTop: '2px' }}>
              Uploaded materials will be distributed to participants upon milestone activation.
            </span>
          </div>

          {/* Action button */}
          <button type="submit" className={styles.publishBtn}>
            PUBLISH MILESTONE REQUIREMENTS
          </button>
          <p className={styles.publishDisclaimer}>
            Publishing will notify all assigned team members and activate submission tracking across the network.
          </p>
        </form>
      </div>

      {/* Success Modal */}
      {isSuccess && (
        <div className={styles.modalOverlay}>
          <div className={styles.successModalCard}>
            <div className={styles.successIconCircle}>
            <Check size={28} strokeWidth={3} aria-hidden />
          </div>
            <h3 className={styles.successModalTitle}>Milestone Requirements Published!</h3>
            <p className={styles.successModalText}>
              The milestone "<b>{phase}</b>" is now live. Team members have been alerted and the submission deadline is active.
            </p>
            <button className={styles.successBtn} onClick={() => setIsSuccess(false)}>
              Back to Guidance
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigureMilestones;
