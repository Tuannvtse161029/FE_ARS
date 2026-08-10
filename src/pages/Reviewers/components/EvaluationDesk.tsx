import { useState } from 'react';
import { PdfViewer } from '../../../components/PdfViewer';
import styles from './EvaluationDesk.module.css';

interface CriteriaScore {
  methodology: number;
  contribution: number;
  literature: number;
  clarity: number;
}

export const EvaluationDesk = () => {
  const [scores, setScores] = useState<CriteriaScore>({
    methodology: 5,
    contribution: 4,
    literature: 4,
    clarity: 5,
  });
  const [comments, setComments] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Compute composite score
  const compositeScore = ((scores.methodology + scores.contribution + scores.literature + scores.clarity) / 4).toFixed(1);
  const compositePercent = (parseFloat(compositeScore) / 5) * 100;

  const handleScoreChange = (criteria: keyof CriteriaScore, val: number) => {
    setScores({
      ...scores,
      [criteria]: val,
    });
  };

  const handleSaveDraft = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleSubmitFeedback = () => {
    if (comments.length < 50) {
      alert('Please write at least 50 characters of comments to provide thorough feedback.');
      return;
    }
    setIsSubmitted(true);
  };

  return (
    <div className={styles.evaluationDesk}>
      {/* Breadcrumbs & Status */}
      <div className={styles.headerRow}>
        <div className={styles.breadcrumbs}>
          Home &gt; Assigned Review Tasks &gt; <span className={styles.activeBreadcrumb}>Evaluation Desk</span>
          <span className={styles.statusBadge}>● IN REVIEW</span>
        </div>
      </div>

      {/* Manuscript Info Banner */}
      <div className={styles.manuscriptBanner}>
        <div className={styles.bannerFileIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </div>
        <div className={styles.bannerInfo}>
          <h2 className={styles.manuscriptTitle}>Framework_Design_v2.pdf</h2>
          <p className={styles.manuscriptSub}>
            Submission #2847 - Journal of Distributed Computing - Submitted Jun 3, 2026
          </p>
        </div>
      </div>

      {/* Main Grid: PDF Viewer + Scorecard */}
      <div className={styles.deskGrid}>
        
        {/* Left Column: PDF Viewer */}
        <div className={styles.pdfViewerCard}>
          <div className={styles.pdfHeader}>
            <span className={styles.pdfTitle}>PDF VIEWER: Framework_Design_v2.pdf</span>
            <div className={styles.pdfControls}>
              <span>Page 1 of 14</span>
              <button className={styles.pdfControlBtn}>🔍 100%</button>
              <button className={styles.pdfControlBtn}>🔄</button>
              <button className={styles.pdfControlBtn}>⬇</button>
            </div>
          </div>
          <div className={styles.pdfBody}>
            <PdfViewer url="/sample.pdf" />
          </div>
          {/* Review Deadline Banner at bottom of Sidebar */}
          <div className={styles.deadlineStickyBar}>
            <span className={styles.clockIcon}>🕒</span>
            <div className={styles.deadlineInfo}>
              <span className={styles.deadlineDateLabel}>Review Deadline</span>
              <span className={styles.deadlineDate}>Jul 15, 2026</span>
            </div>
            <span className={styles.progressPercent}>60% complete · 3 pending</span>
          </div>
        </div>

        {/* Right Column: Scorecard Form */}
        <div className={styles.scorecardCard}>
          <div className={styles.scorecardHeader}>
            <h3 className={styles.scorecardTitle}>CRITERIA EVALUATION SCORECARD</h3>
            <span className={styles.autosaveBadge}>DRAFT AUTOSAVED</span>
          </div>

          <div className={styles.scorecardBody}>
            {/* Quantitative Section */}
            <div className={styles.sectionTitle}>Quantitative Assessment</div>

            <div className={styles.criteriaSelects}>
              {/* Methodology Integrity */}
              <div className={styles.criteriaGroup}>
                <label className={styles.criteriaLabel}>Methodology Integrity</label>
                <select
                  className={styles.criteriaSelect}
                  value={scores.methodology}
                  onChange={(e) => handleScoreChange('methodology', parseInt(e.target.value, 10))}
                >
                  <option value={5}>Score 5 - Excellent and reproducible methodology</option>
                  <option value={4}>Score 4 - Solid experimental setup with minor limits</option>
                  <option value={3}>Score 3 - Average setup, lacks extensive comparison</option>
                  <option value={2}>Score 2 - Faulty methodology or insufficient baselines</option>
                  <option value={1}>Score 1 - Critical methodology flaws</option>
                </select>
              </div>

              {/* Academic Contribution */}
              <div className={styles.criteriaGroup}>
                <label className={styles.criteriaLabel}>Academic Contribution</label>
                <select
                  className={styles.criteriaSelect}
                  value={scores.contribution}
                  onChange={(e) => handleScoreChange('contribution', parseInt(e.target.value, 10))}
                >
                  <option value={5}>Score 5 - Highly original, substantial value add</option>
                  <option value={4}>Score 4 - Good innovation, builds on existing work</option>
                  <option value={3}>Score 3 - Moderate contribution, incremental update</option>
                  <option value={2}>Score 2 - Minor contribution, explores solved ideas</option>
                  <option value={1}>Score 1 - No notable contribution or novelty</option>
                </select>
              </div>

              {/* Literature Review Depth */}
              <div className={styles.criteriaGroup}>
                <label className={styles.criteriaLabel}>Literature Review Depth</label>
                <select
                  className={styles.criteriaSelect}
                  value={scores.literature}
                  onChange={(e) => handleScoreChange('literature', parseInt(e.target.value, 10))}
                >
                  <option value={5}>Score 5 - Comprehensive references, covers up to 2025</option>
                  <option value={4}>Score 4 - Thorough review with minor literature gaps</option>
                  <option value={3}>Score 3 - Basic review, misses key recent studies</option>
                  <option value={2}>Score 2 - Weak review, superficial references</option>
                  <option value={1}>Score 1 - Totally inadequate bibliography</option>
                </select>
              </div>

              {/* Clarity & Presentation */}
              <div className={styles.criteriaGroup}>
                <label className={styles.criteriaLabel}>Clarity & Presentation</label>
                <select
                  className={styles.criteriaSelect}
                  value={scores.clarity}
                  onChange={(e) => handleScoreChange('clarity', parseInt(e.target.value, 10))}
                >
                  <option value={5}>Score 5 - Crisp figures, precise terminology</option>
                  <option value={4}>Score 4 - Easy to read with small styling issues</option>
                  <option value={3}>Score 3 - Satisfactory clarity, needs minor editing</option>
                  <option value={2}>Score 2 - Hard to follow, layout exceeds limit</option>
                  <option value={1}>Score 1 - Unreadable, poor structure</option>
                </select>
              </div>
            </div>

            {/* Composite Score Panel */}
            <div className={styles.compositePanel}>
              <div className={styles.compositeHeader}>
                <span className={styles.compositeLabel}>Composite Score</span>
                <span className={styles.compositeVal}>{compositeScore} <span className={styles.compositeMax}>/ 5.0</span></span>
              </div>
              <div className={styles.progressBarWrapper}>
                <div className={styles.progressBar} style={{ width: `${compositePercent}%` }}></div>
              </div>
              <span className={styles.recommendationText}>
                RECOMMENDATION: {parseFloat(compositeScore) >= 4.0 ? 'ACCEPT WITH MINOR REVISIONS' : parseFloat(compositeScore) >= 3.0 ? 'RE-SUBMIT FOR REVIEW' : 'REJECT'}
              </span>
            </div>

            {/* Qualitative Section */}
            <div className={styles.sectionTitle} style={{ marginTop: '10px' }}>Qualitative Review</div>

            <div className={styles.criteriaGroup}>
              <label className={styles.criteriaLabel}>Qualitative Comments (Min 200 chars)</label>
              <textarea
                className={styles.commentsTextarea}
                placeholder="Enter your qualitative evaluation of this submission..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={5}
              />
              <span className={styles.commentsCounter}>
                {comments.length} characters (Min 50 for draft save, 200 for submit)
              </span>
            </div>
          </div>

          {/* Form Actions */}
          <div className={styles.actionsFooter}>
            <button className={styles.draftBtn} onClick={handleSaveDraft}>
              🕒 {isSaved ? 'Draft Saved!' : 'Save Draft'}
            </button>
            <button className={styles.submitBtn} onClick={handleSubmitFeedback}>
              ✓ Submit Final Feedback to Author
            </button>
          </div>
        </div>
      </div>

      {/* Submission Success Dialog */}
      {isSubmitted && (
        <div className={styles.modalOverlay}>
          <div className={styles.successModal}>
            <div className={styles.successIconCircle}>✓</div>
            <h3 className={styles.successModalTitle}>Evaluation Submitted Successfully!</h3>
            <p className={styles.successModalText}>
              Your grading scorecard has been recorded. Escrow funds will be released to your wallet upon author acknowledgement.
            </p>
            <button className={styles.successBtn} onClick={() => setIsSubmitted(false)}>
              Close Desk
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvaluationDesk;
