import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../routes/paths';
import styles from './ReviewTasks.module.css';

export const ReviewTasks = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'pending' | 'inprogress' | 'completed'>('pending');
  const [isFrameworkSubmitted] = useState(() => {
    return localStorage.getItem('ars_framework_submitted') === 'true';
  });

  return (
    <div className={styles.tasksPage}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; <span className={styles.activeBreadcrumb}>Assigned Review Tasks</span>
      </div>

      {/* Page Header */}
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Assigned Review Tasks</h1>
        <p className={styles.pageSubtitle}>
          Manage your review assignments and track evaluation progress.
        </p>
      </div>

      {/* Tabs list */}
      <div className={styles.tabsRow}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'pending' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending / Action Required ({isFrameworkSubmitted ? 1 : 2})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'inprogress' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('inprogress')}
        >
          In Progress / Draft Saved (1)
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'completed' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed Reviews (142)
        </button>
      </div>

      {/* Tab content panels */}
      <div className={styles.tabContent}>
        
        {/* TAB 1: PENDING */}
        {activeTab === 'pending' && (
          <div className={styles.cardsList}>
            {/* Card 1 */}
            {!isFrameworkSubmitted && (
              <div className={styles.taskCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderLeft}>
                    <span className={styles.docIcon}>📄</span>
                    <div className={styles.docMeta}>
                      <h3 className={styles.docTitle}>Framework_Design_v2.pdf</h3>
                      <span className={styles.authorName}>Priya R. Subramaniam et al. - MIT</span>
                    </div>
                  </div>
                  <button 
                    className={styles.evaluateBtn}
                    onClick={() => navigate(ROUTES.EVALUATION)}
                  >
                    ✓ Evaluate Paper
                  </button>
                </div>
                <div className={styles.cardBadges}>
                  <span className={styles.tagBadge}>#ComputerScience</span>
                  <span className={styles.deadlineOrange}>🕒 Deadline: 3 Days Remaining</span>
                  <span className={styles.feeLocked}>🔒 500,000 VND (Escrow Locked)</span>
                </div>
              </div>
            )}

            {/* Card 2 */}
            <div className={styles.taskCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderLeft}>
                  <span className={styles.docIcon}>📄</span>
                  <div className={styles.docMeta}>
                    <h3 className={styles.docTitle}>Cloud_Routing_v1.pdf</h3>
                    <span className={styles.authorName}>David G. Lee et al. - UC Berkeley</span>
                  </div>
                </div>
                <button 
                  className={styles.evaluateBtn}
                  onClick={() => navigate(ROUTES.EVALUATION)}
                >
                  ✓ Evaluate Paper
                </button>
              </div>
              <div className={styles.cardBadges}>
                <span className={styles.tagBadge}>#SoftwareEngineering</span>
                <span className={styles.deadlineGray}>🕒 Deadline: 7 Days Remaining</span>
                <span className={styles.feeLocked}>🔒 500,000 VND (Escrow Locked)</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: IN PROGRESS */}
        {activeTab === 'inprogress' && (
          <div className={styles.cardsList}>
            <div className={styles.taskCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderLeft}>
                  <span className={styles.docIcon}>📄</span>
                  <div className={styles.docMeta}>
                    <h3 className={styles.docTitle}>ML_Pipeline_Architecture_draft.pdf</h3>
                    <span className={styles.authorName}>Lena W. Hoffmann et al. - Stanford AI Lab</span>
                  </div>
                </div>
                <button 
                  className={styles.evaluateBtn}
                  onClick={() => navigate(ROUTES.EVALUATION)}
                >
                  ✓ Evaluate Paper
                </button>
              </div>
              <div className={styles.cardBadges}>
                <span className={styles.tagBadge}>#MachineLearning</span>
                <span className={styles.deadlineOrange}>🕒 Deadline: 2026-08-01 - 10 Days Remaining</span>
                <span className={styles.feeLocked}>🔒 600,000 VND (Escrow Locked)</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: COMPLETED */}
        {activeTab === 'completed' && (
          <div className={styles.cardsList}>
            <div className={styles.taskCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderLeft}>
                  <span className={styles.docIcon} style={{ color: '#10b981' }}>✓</span>
                  <div className={styles.docMeta}>
                    <h3 className={styles.docTitle}>Graph_Neural_Nets_v3.pdf</h3>
                    <span className={styles.completedSubText}>
                      Completed · 2026-06-15 · Final Decision: <b>Accept with Minor Revisions</b>
                    </span>
                  </div>
                </div>
                <button className={styles.viewScorecardBtn} onClick={() => alert('Scorecard Details: 4.8/5.0 Composite Score.')}>
                  View Scorecard
                </button>
              </div>
              <div className={styles.cardBadges}>
                <span className={styles.feeReleased}>💰 500,000 VND Released</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ReviewTasks;
