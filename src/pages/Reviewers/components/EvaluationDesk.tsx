import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../routes/paths';
import { PdfViewer } from '../../../components/PdfViewer';
import styles from './EvaluationDesk.module.css';

export const EvaluationDesk = () => {
  const navigate = useNavigate();

  // Ratings for 5 criteria
  const [originality, setOriginality] = useState(4);
  const [literatureReview, setLiteratureReview] = useState(4);
  const [methodology, setMethodology] = useState(5);
  const [resultsDiscussion, setResultsDiscussion] = useState(4);
  const [formattingStructure, setFormattingStructure] = useState(5);
  
  const [finalDecision, setFinalDecision] = useState('Accept');
  const [qualitativeComments, setQualitativeComments] = useState(
    'This paper makes a substantial contribution to the field of distributed systems. The modular architecture is elegantly designed and the experimental evaluation is rigorous. I recommend acceptance with minor revisions to address the scalability claims under adversarial network conditions and to include a more detailed comparison with recent 2025 literature on adaptive routing protocols.'
  );

  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSaveDraft = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('ars_framework_submitted', 'true');

    // Release 500,000 VND to available wallets
    const currentWallet = localStorage.getItem('ars_wallet');
    const newWallet = (currentWallet ? parseInt(currentWallet, 10) : 1500000) + 500000;
    localStorage.setItem('ars_wallet', newWallet.toString());

    const currentReviewerBalance = localStorage.getItem('ars_reviewer_balance');
    const newReviewerBalance = (currentReviewerBalance ? parseInt(currentReviewerBalance, 10) : 4200000) + 500000;
    localStorage.setItem('ars_reviewer_balance', newReviewerBalance.toString());

    // Dispatch wallet update
    window.dispatchEvent(new Event('wallet-update'));

    setIsSubmitted(true);
  };

  // Render rating numbers helper
  const renderRatingButtons = (currentVal: number, setVal: (n: number) => void) => {
    return (
      <div className={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num}
            type="button"
            className={`${styles.ratingBtn} ${currentVal === num ? styles.activeRatingBtn : ''}`}
            onClick={() => setVal(num)}
          >
            {num}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.evaluationDesk}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; Assigned Review Tasks &gt; <span className={styles.activeBreadcrumb}>Evaluation Desk</span>
      </div>

      {/* Sub header details */}
      <div className={styles.subHeader}>
        <div className={styles.subHeaderLeft}>
          <span className={styles.docIcon}>📄</span>
          <div className={styles.docMeta}>
            <h2 className={styles.docTitle}>Framework_Design_v2.pdf</h2>
            <span className={styles.docSubText}>Submission #2847 · Journal of Distributed Computing</span>
          </div>
        </div>
        <span className={styles.inReviewBadge}>● IN REVIEW</span>
      </div>

      {/* Grid: PDF + Scorecard */}
      <div className={styles.deskGrid}>
        
        {/* Left Column: PDF Viewer */}
        <div className={styles.pdfViewerCard}>
          <div className={styles.pdfHeader}>
            <span className={styles.pdfTitle}>PDF VIEWER: Framework_Design_v2.pdf</span>
            <div className={styles.pdfControls}>
              <span>&lt; Page 1 of 14 &gt;</span>
              <span className={styles.zoomControl}>🔍 100% 🔍</span>
              <span className={styles.pdfActionBtn}>🔄</span>
              <span className={styles.pdfActionBtn}>⬇️</span>
            </div>
          </div>
          <div className={styles.pdfBody}>
            <PdfViewer url="/sample.pdf" />
          </div>
        </div>

        {/* Right Column: Scorecard */}
        <div className={styles.scorecardCard}>
          <div className={styles.scorecardHeader}>
            <h3 className={styles.scorecardTitle}>CRITERIA EVALUATION SCORECARD</h3>
            <span className={styles.autosaveBadge}>✓ Draft Autosaved</span>
          </div>

          <form onSubmit={handleSubmit} className={styles.scorecardBody}>
            
            {/* 1. ORIGINALITY */}
            <div className={styles.scorecardSection}>
              <div className={styles.sectionHeaderRow}>
                <span className={styles.sectionTitle}>1. ORIGINALITY</span>
                {renderRatingButtons(originality, setOriginality)}
              </div>
              <p className={styles.criteriaFeedbackText}>
                The paper presents a genuinely novel approach to modular backend routing that distinguishes itself clearly from prior art. The concept of decoupled orchestration layers is well-motivated.
              </p>
            </div>

            {/* 2. LITERATURE REVIEW */}
            <div className={styles.scorecardSection}>
              <div className={styles.sectionHeaderRow}>
                <span className={styles.sectionTitle}>2. LITERATURE REVIEW</span>
                {renderRatingButtons(literatureReview, setLiteratureReview)}
              </div>
              <p className={styles.criteriaFeedbackText}>
                The literature review is comprehensive and covers the relevant works in distributed systems. A few recent 2025 publications on CAP theorem extensions could strengthen the survey.
              </p>
            </div>

            {/* 3. METHODOLOGY */}
            <div className={styles.scorecardSection}>
              <div className={styles.sectionHeaderRow}>
                <span className={styles.sectionTitle}>3. METHODOLOGY</span>
                {renderRatingButtons(methodology, setMethodology)}
              </div>
              <p className={styles.criteriaFeedbackText}>
                Methodology is rigorous and reproducible. The three production-scale environment benchmarks are well-documented with clear threat-to-validity analysis.
              </p>
            </div>

            {/* 4. RESULTS & DISCUSSION */}
            <div className={styles.scorecardSection}>
              <div className={styles.sectionHeaderRow}>
                <span className={styles.sectionTitle}>4. RESULTS & DISCUSSION</span>
                {renderRatingButtons(resultsDiscussion, setResultsDiscussion)}
              </div>
              <p className={styles.criteriaFeedbackText}>
                Results are clearly presented. The 47% throughput improvement claim is well-supported by the experimental data. Discussion of limitations is honest and appropriate.
              </p>
            </div>

            {/* 5. FORMATTING & STRUCTURE */}
            <div className={styles.scorecardSection}>
              <div className={styles.sectionHeaderRow}>
                <span className={styles.sectionTitle}>5. FORMATTING & STRUCTURE</span>
                {renderRatingButtons(formattingStructure, setFormattingStructure)}
              </div>
              <p className={styles.criteriaFeedbackText}>
                Paper adheres strictly to the Journal of Distributed Computing style guide. Figures are crisp and properly captioned. References are consistently formatted.
              </p>
            </div>

            {/* 6. FINAL DECISION */}
            <div className={styles.scorecardSection} style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <span className={styles.sectionTitle}>6. FINAL DECISION</span>
              <div className={styles.dropdownWrapper}>
                <select
                  className={styles.finalDecisionSelect}
                  value={finalDecision}
                  onChange={(e) => setFinalDecision(e.target.value)}
                >
                  <option value="Accept">Accept</option>
                  <option value="Reject">Reject</option>
                </select>
              </div>
            </div>

            {/* 7. QUALITATIVE COMMENTS */}
            <div className={styles.scorecardSection} style={{ borderBottom: 'none', paddingBottom: 0, marginTop: '10px' }}>
              <span className={styles.sectionTitle}>7. QUALITATIVE COMMENTS</span>
              <textarea
                className={styles.qualitativeTextarea}
                value={qualitativeComments}
                onChange={(e) => setQualitativeComments(e.target.value)}
                rows={6}
                required
              />
            </div>

            {/* Actions Footer inside form card */}
            <div className={styles.actionsFooter}>
              <button 
                type="button" 
                className={styles.saveDraftBtn}
                onClick={handleSaveDraft}
              >
                💾 {isSaved ? 'Draft Saved!' : 'Save Draft'}
              </button>
              <button type="submit" className={styles.submitBtn}>
                ✉️ Submit Final Feedback to Author
              </button>
            </div>

          </form>
        </div>

      </div>

      {/* Success Modal (Frame 20) */}
      {isSubmitted && (
        <div className={styles.modalOverlay}>
          <div className={styles.successModalCard} style={{ maxWidth: '520px', padding: '32px' }}>
            <button className={styles.closeModalCross} onClick={() => navigate(ROUTES.REVIEW_TASKS)}>×</button>
            <div className={styles.successIconCircle} style={{ width: '56px', height: '56px', backgroundColor: '#e6fcf5', color: '#099268' }}>✓</div>
            <h3 className={styles.successModalTitle} style={{ fontSize: '1.25rem', marginTop: '10px' }}>Evaluation Submitted Successfully!</h3>
            <p className={styles.successModalText} style={{ color: '#64748b' }}>
              Your feedback has been securely delivered to the author for review.
            </p>

            {/* Escrow Funds Released Alert card */}
            <div className={styles.escrowReleasedAlertCard}>
              <span className={styles.escrowAlertIcon}>🔓</span>
              <div className={styles.escrowAlertMeta}>
                <h4 className={styles.escrowAlertTitle}>Escrow Funds Released!</h4>
                <p className={styles.escrowAlertText}>
                  <b>500,000 VND</b> has been automatically transferred to your withdrawable wallet balance.
                </p>
              </div>
            </div>

            {/* Transaction ID */}
            <div className={styles.transactionIdRow}>
              <span className={styles.txLabel}>Transaction ID</span>
              <span className={styles.txVal}>#ESCROW-RELEASE-9921</span>
            </div>

            <button className={styles.successBtn} onClick={() => navigate(ROUTES.REVIEW_TASKS)}>
              Return to Review Directory
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvaluationDesk;
