import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../routes/paths';
import styles from './Dashboard.module.css';
import { Upload } from '../../assets/icons/UploadIcon';
import { Users } from '../../assets/icons/UsersIcon';
import { Calendar } from '../../assets/icons/CalendarIcon';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Dashboard layout is keyed off the authenticated user's role from the JWT.
  // No in-app role switching — users with multiple roles pick one at re-login.
  const activeRole = (user?.role as 'Researcher' | 'Reviewer' | 'Lecturer' | 'Graduate Student') ?? 'Researcher';

  const [isFrameworkSubmitted] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem('ars_framework_submitted') === 'true';
  });

  // Invitation tracking state for AI Match list
  const [invitedReviewers, setInvitedReviewers] = useState<{ [name: string]: boolean }>({});

  const handleInviteReviewer = (name: string) => {
    setInvitedReviewers({
      ...invitedReviewers,
      [name]: true
    });
  };

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER: RESEARCHER CENTRAL (FRAME 8)
  // ───────────────────────────────────────────────────────────────────────────
  if (activeRole === 'Researcher') {
    return (
      <div className={styles.dashboard}>
        {/* Breadcrumbs */}
        <div className={styles.breadcrumbs}>
          Home &gt; <span className={styles.activeBreadcrumb}>Researcher Central Dashboard</span>
        </div>

        {/* Dashboard Title Banner */}
        <div className={styles.roleHeaderArea}>
          <h1 className={styles.roleTitle}>Researcher Central</h1>
          <p className={styles.roleSubtitle}>Thursday, 26 June 2025 · Academic Year 2024-2025</p>
        </div>

        {/* Frame 8 split content */}
        <div className={styles.resGrid}>
          {/* Left Column: Quick Actions */}
          <div className={styles.quickActionsCol}>
            <div className={styles.sectionHeaderLabel}>QUICK ACTIONS WORKSPACE</div>
            
            <div className={styles.quickCard} onClick={() => navigate(ROUTES.PAPERS)}>
              <div className={styles.quickCardLeft}>
                <span className={styles.quickCardIcon}><Upload size={18} /></span>
                <span className={styles.quickCardText}>Upload New Manuscript Artifact</span>
              </div>
              <span className={styles.quickCardArrow}>&gt;</span>
            </div>

            <div className={styles.quickCard} onClick={() => navigate(ROUTES.REVIEWERS)}>
              <div className={styles.quickCardLeft}>
                <span className={styles.quickCardIcon} style={{ color: '#10b981' }}><Users size={18} /></span>
                <span className={styles.quickCardText}>Find Expert Peer Reviewers Pool</span>
              </div>
              <span className={styles.quickCardArrow}>&gt;</span>
            </div>

            <div className={styles.quickCard}>
              <div className={styles.quickCardLeft}>
                <span className={styles.quickCardIcon} style={{ color: '#f59e0b' }}><Calendar size={18} /></span>
                <span className={styles.quickCardText}>Browse Upcoming Faculty Seminars</span>
              </div>
              <span className={styles.quickCardArrow}>&gt;</span>
            </div>

            {/* Helper tip */}
            <div className={styles.resTipBox}>
              <span className={styles.tipLabel}>Tip:</span>
              <span className={styles.tipText}>
                Upload manuscripts before the Q2 2025 submission deadline - July 15, 2025.
              </span>
            </div>
          </div>

          {/* Right Column: Activities and AI recommends */}
          <div className={styles.activitiesCol}>
            {/* Core Recent Activities */}
            <div className={styles.sectionHeaderWrapper}>
              <div className={styles.sectionHeaderLabel}>CORE RECENT ACTIVITIES</div>
              <span className={styles.blueBadge}>2 NEW</span>
            </div>

            <div className={styles.activitiesContainer}>
              <div className={styles.activityRow}>
                <span className={styles.activityDot}>●</span>
                <div className={styles.activityMeta}>
                  <p className={styles.activityDesc}>Manuscript v2 review funds are safely held in hold</p>
                  <span className={styles.activityTime}>2h ago</span>
                </div>
              </div>
              <div className={styles.activityRow}>
                <span className={styles.activityDot}>●</span>
                <div className={styles.activityMeta}>
                  <p className={styles.activityDesc}>Dr. Nguyen Van A accepted your evaluation request</p>
                  <span className={styles.activityTime}>5h ago</span>
                </div>
              </div>
            </div>

            {/* AI Recommendations */}
            <div className={styles.sectionHeaderWrapper} style={{ marginTop: '20px' }}>
              <div>
                <div className={styles.sectionHeaderLabel}>AI RECOMMENDATIONS</div>
                <span className={styles.engineText}>GPT-4o · Reviewer Match Engine</span>
              </div>
            </div>

            <div className={styles.aiRecommendationsList}>
              {/* Reviewer 1 */}
              <div className={styles.aiReviewerCard}>
                <div className={styles.aiCardMain}>
                  <div className={styles.aiAvatar} style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>VA</div>
                  <div className={styles.aiMeta}>
                    <div className={styles.aiNameRow}>
                      <span className={styles.aiReviewerName}>Dr. Nguyen Van A</span>
                      <span className={styles.matchPill}>Match 94%</span>
                    </div>
                    <span className={styles.aiReviewerSub}>Computational Linguistics · Ho Chi Minh City University</span>
                  </div>
                </div>

                <div className={styles.aiCardStatsRow}>
                  <div className={styles.aiStatCol}>
                    <span className={styles.aiStatTitle}>PUBLICATIONS</span>
                    <span className={styles.aiStatVal}>47</span>
                  </div>
                  <div className={styles.aiStatCol}>
                    <span className={styles.aiStatTitle}>H-INDEX</span>
                    <span className={styles.aiStatVal}>12</span>
                  </div>
                  <button 
                    className={`${styles.inviteReviewerBtn} ${invitedReviewers['Dr. Nguyen Van A'] ? styles.invitedBtn : ''}`}
                    onClick={() => handleInviteReviewer('Dr. Nguyen Van A')}
                    disabled={invitedReviewers['Dr. Nguyen Van A']}
                  >
                    {invitedReviewers['Dr. Nguyen Van A'] ? 'Invited' : 'Invite Reviewer'}
                  </button>
                </div>
              </div>

              {/* Reviewer 2 */}
              <div className={styles.aiReviewerCard}>
                <div className={styles.aiCardMain}>
                  <div className={styles.aiAvatar} style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>VB</div>
                  <div className={styles.aiMeta}>
                    <div className={styles.aiNameRow}>
                      <span className={styles.aiReviewerName}>Prof. Le Van B</span>
                      <span className={styles.matchPill} style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>Match 88%</span>
                    </div>
                    <span className={styles.aiReviewerSub}>Natural Language Processing · Hanoi University of Science</span>
                  </div>
                </div>

                <div className={styles.aiCardStatsRow}>
                  <div className={styles.aiStatCol}>
                    <span className={styles.aiStatTitle}>PUBLICATIONS</span>
                    <span className={styles.aiStatVal}>63</span>
                  </div>
                  <div className={styles.aiStatCol}>
                    <span className={styles.aiStatTitle}>H-INDEX</span>
                    <span className={styles.aiStatVal}>18</span>
                  </div>
                  <button 
                    className={`${styles.inviteReviewerBtn} ${invitedReviewers['Prof. Le Van B'] ? styles.invitedBtn : ''}`}
                    onClick={() => handleInviteReviewer('Prof. Le Van B')}
                    disabled={invitedReviewers['Prof. Le Van B']}
                  >
                    {invitedReviewers['Prof. Le Van B'] ? 'Invited' : 'Invite Reviewer'}
                  </button>
                </div>
              </div>
            </div>

            {/* AI recommends footer */}
            <div className={styles.aiRecommendsFooter}>
              <span>✨ AI matched 14 additional reviewers for your manuscript topics.</span>
              <button className={styles.viewAllMatchLink} onClick={() => navigate(ROUTES.REVIEWERS)}>View all</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER: EXPERT REVIEWER ASSESSMENT PORTAL (FRAME 15/16)
  // ───────────────────────────────────────────────────────────────────────────
  const [acceptingRequests, setAcceptingRequests] = useState(true);

  if (activeRole === 'Reviewer') {
    return (
      <div className={styles.dashboard}>
        {/* Breadcrumbs */}
        <div className={styles.breadcrumbs}>
          Home &gt; <span className={styles.activeBreadcrumb}>Reviewer Management Console</span>
        </div>

        {/* Welcome Dashboard Card */}
        <div className={styles.reviewerWelcomeCard}>
          <div className={styles.welcomeLeft}>
            <span className={styles.welcomeCategory}>REVIEWER DASHBOARD</span>
            <h2 className={styles.welcomeBigTitle}>Welcome back, Dr. Nguyen Van A!</h2>
            <p className={styles.welcomeSubtitle}>
              You have <span className={styles.highlightText}>{isFrameworkSubmitted ? 1 : 2} review tasks</span> pending evaluation.
              {!acceptingRequests && (
                <> Your next deadline is in <span className={styles.highlightText} style={{ color: '#eab308' }}>3 days</span>.</>
              )}
            </p>
            <button 
              className={styles.goToReviewBtn}
              onClick={() => navigate(ROUTES.REVIEW_TASKS)}
            >
              📄 Go to Review Paper
            </button>
          </div>

          {/* Interactive Accepting Requests Toggle */}
          <div className={styles.toggleWrapper}>
            <span className={styles.toggleLabel}>Accepting New Requests</span>
            <button 
              type="button"
              className={`${styles.toggleSwitch} ${acceptingRequests ? styles.toggleOn : styles.toggleOff}`}
              onClick={() => setAcceptingRequests(!acceptingRequests)}
            >
              <span className={styles.toggleSlider}></span>
            </button>
          </div>
        </div>

        {/* Row of 3 Metrics Cards */}
        <div className={styles.reviewerRedesignMetricsRow}>
          <div className={styles.redesignMetricCard}>
            <div className={styles.redesignCardHeader}>
              <span className={styles.redesignMetricTitle}>PENDING REVIEWS</span>
              <span className={styles.actionNeededBadge}>Action Needed</span>
            </div>
            <span className={styles.redesignMetricVal}>{isFrameworkSubmitted ? 1 : 2}</span>
          </div>

          <div className={styles.redesignMetricCard}>
            <div className={styles.redesignCardHeader}>
              <span className={styles.redesignMetricTitle}>COMPLETED REVIEWS</span>
              <span className={styles.allTimeBadge}>All Time</span>
            </div>
            <span className={styles.redesignMetricVal}>142</span>
          </div>

          <div className={styles.redesignMetricCard}>
            <div className={styles.redesignCardHeader}>
              <span className={styles.redesignMetricTitle}>HELD IN HOLD</span>
              <span className={styles.lockedBadge}>Locked</span>
            </div>
            <div className={styles.escrowValRow}>
              <span className={styles.redesignMetricVal}>{isFrameworkSubmitted ? '500,000' : '1,000,000'}</span>
              <span className={styles.escrowCurrency}>VND</span>
            </div>
          </div>
        </div>

        {/* Urgent Review required banner (yellow warning block) */}
        {!isFrameworkSubmitted && (
          <div className={styles.urgentBannerRow}>
            <div className={styles.urgentBannerLeft}>
              <span className={styles.urgentIconCircle}>⚡</span>
              <div className={styles.urgentMeta}>
                <span className={styles.urgentTitleLabel}>Urgent Review Required</span>
                <span className={styles.urgentDesc}>
                  Framework_Design_v2.pdf · Deadline: <b>3 Days</b> · Fee: <b>500,000 VND</b>
                </span>
              </div>
            </div>
            <button 
              className={styles.startEvaluationBtn}
              onClick={() => navigate(ROUTES.EVALUATION)}
            >
              🚀 Start Evaluation
            </button>
          </div>
        )}

        {/* Section: Assigned Review Requests */}
        <div className={styles.reviewerQueueCard} style={{ padding: '24px 20px', borderRadius: '16px' }}>
          <div className={styles.queueHeader} style={{ marginBottom: '15px' }}>
            <div className={styles.queueTitleWrapper}>
              <span className={styles.queueIcon}>📋</span>
              <h3 className={styles.queueTitle} style={{ color: '#0f172a' }}>Assigned Review Requests</h3>
              <span className={styles.actionNeededPill}>Action Needed</span>
            </div>
            <button className={styles.viewAllTableLink} onClick={() => navigate(ROUTES.REVIEW_TASKS)}>View All ↗</button>
          </div>

          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>PAPER</th>
                  <th>DOMAIN</th>
                  <th>DEADLINE</th>
                  <th>FEE</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {!isFrameworkSubmitted && (
                  <tr>
                    <td className={styles.manuscriptTitleText}>Framework_Design_v2.pdf</td>
                    <td>
                      <span className={styles.domainPill}>#ComputerScience</span>
                    </td>
                    <td>
                      <span className={styles.remainingOrange}>🕒 3 Days Remaining</span>
                    </td>
                    <td className={styles.feeBalanceText} style={{ color: '#0f172a' }}>500,000 VND</td>
                    <td>
                      <button 
                        className={styles.evaluateRequestBtn}
                        onClick={() => navigate(ROUTES.EVALUATION)}
                      >
                        Evaluate
                      </button>
                    </td>
                  </tr>
                )}
                <tr>
                  <td className={styles.manuscriptTitleText}>Cloud_Routing_v1.pdf</td>
                  <td>
                    <span className={styles.domainPill}>#SoftwareEngineering</span>
                  </td>
                  <td>
                    <span className={styles.remainingGray}>🕒 7 Days Remaining</span>
                  </td>
                  <td className={styles.feeBalanceText} style={{ color: '#0f172a' }}>500,000 VND</td>
                  <td>
                    <button 
                      className={styles.evaluateRequestBtn}
                      onClick={() => navigate(ROUTES.EVALUATION)}
                    >
                      Evaluate
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section: Recently Completed Reviews */}
        <div className={styles.reviewerQueueCard} style={{ padding: '24px 20px', borderRadius: '16px' }}>
          <div className={styles.queueHeader} style={{ marginBottom: '15px' }}>
            <div className={styles.queueTitleWrapper}>
              <span className={styles.queueIcon}>✓</span>
              <h3 className={styles.queueTitle} style={{ color: '#0f172a' }}>Recently Completed Reviews</h3>
            </div>
            <button className={styles.viewAllTableLink} onClick={() => navigate(ROUTES.REVIEW_TASKS)}>View All ↗</button>
          </div>

          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>PAPER</th>
                  <th>FINAL DECISION</th>
                  <th>DATE</th>
                  <th>FEE</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.manuscriptTitleText}>Distributed_DB_v3.pdf</td>
                  <td>
                    <span className={styles.completedDecisionBadge}>Accept with Minor Revisions</span>
                  </td>
                  <td>2026-07-10</td>
                  <td className={styles.feeBalanceText} style={{ color: '#0f172a' }}>500,000 VND</td>
                  <td>
                    <button className={styles.viewScorecardBtn} onClick={() => navigate(ROUTES.REVIEW_TASKS)}>
                      View Scorecard
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER: GRADUATE STUDENT COLLABORATIVE HUB (FRAME 10)
  // ───────────────────────────────────────────────────────────────────────────
  if (activeRole === 'Graduate Student') {
    return (
      <div className={styles.dashboard}>
        {/* Breadcrumbs */}
        <div className={styles.breadcrumbs}>
          Home &gt; <span className={styles.activeBreadcrumb}>Student Collaborative Hub</span>
        </div>

        {/* Dashboard Title Banner */}
        <div className={styles.roleHeaderArea} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className={styles.roleTitle}>My Dashboard</h1>
            <p className={styles.roleSubtitle}>Graduate Student Portal — Research Collaboration Workspace</p>
          </div>
          <span className={styles.syncBadge}>LAST SYNC: 2026-06-26 09:14</span>
        </div>

        {/* Frame 10 Top Cards grid */}
        <div className={styles.studentTopGrid}>
          {/* Research Group info */}
          <div className={styles.studentInfoCard}>
            <div className={styles.studentCardHeader}>
              <span className={styles.studentCardHeaderIcon}>👥</span>
              <span className={styles.studentCardHeaderTitle}>BOUNDED RESEARCH GROUP INFORMATION</span>
            </div>
            
            <div className={styles.studentInfoTable}>
              <div className={styles.studentInfoRow}>
                <span className={styles.infoLabel}>ACTIVE GROUP</span>
                <span className={styles.infoVal}>Core Automation V3</span>
              </div>
              <div className={styles.studentInfoRow}>
                <span className={styles.infoLabel}>ADVISOR HOST</span>
                <span className={styles.infoVal}>Dr. Pham Lecturer</span>
              </div>
              <div className={styles.studentInfoRow}>
                <span className={styles.infoLabel}>ASSIGNED ROSTER</span>
                <span className={styles.infoVal}>3 Members Active</span>
              </div>
            </div>
          </div>

          {/* Current timeline milestones */}
          <div className={styles.studentInfoCard}>
            <div className={styles.studentCardHeader}>
              <span className={styles.studentCardHeaderIcon}>📅</span>
              <span className={styles.studentCardHeaderTitle}>CURRENT TIMELINE MILESTONES</span>
            </div>

            <div className={styles.studentInfoTable}>
              <div className={styles.studentInfoRow}>
                <span className={styles.infoLabel}>TARGET</span>
                <span className={styles.infoVal}>Phase 2 Lit Review</span>
              </div>
              <div className={styles.studentInfoRow}>
                <span className={styles.infoLabel}>DUE DATE</span>
                <span className={styles.infoVal}>2026-08-01 23:59</span>
              </div>
              <div className={styles.studentInfoRow}>
                <span className={styles.infoLabel}>STATUS</span>
                <span className={styles.studentWarningBadge}>⚠️ [!!] Pending Submission</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom advisor feedback */}
        <div className={styles.studentFeedbackCard}>
          <div className={styles.studentCardHeader}>
            <span className={styles.studentCardHeaderIcon}>🔔</span>
            <span className={styles.studentCardHeaderTitle}>RECENT ADVISOR FEEDBACK & NOTICES</span>
          </div>

          {/* Feedback notice row */}
          <div className={styles.feedbackNoticeBox}>
            <div className={styles.feedbackNoticeHeader}>
              <div className={styles.advisorAvatarCircle}>P</div>
              <div className={styles.advisorMeta}>
                <span className={styles.advisorName}>Dr. Pham Lecturer</span>
                <span className={styles.noticeDate}>2026-06-24 &mdash; Feedback Notice</span>
              </div>
            </div>
            <p className={styles.noticeContent}>
              "Please expand your literature review section to include at least 15 peer-reviewed references as specified."
            </p>
          </div>

          {/* Action button */}
          <button 
            className={styles.uploadPhaseReportBtn}
            onClick={() => navigate(ROUTES.SUBMIT_REPORT)}
          >
            [ Upload Phase Report Artifact ]
          </button>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER: LECTURER CONSOLE DASHBOARD (FRAME 25)
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.dashboard}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; <span className={styles.activeBreadcrumb}>Lecturer Management Console</span>
      </div>

      {/* Welcome Card Banner */}
      <div className={styles.reviewerWelcomeCard} style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)', color: '#ffffff' }}>
        <div className={styles.welcomeLeft}>
          <span className={styles.welcomeCategory} style={{ color: '#93c5fd' }}>LECTURER OVERVIEW</span>
          <h2 className={styles.welcomeBigTitle} style={{ color: '#ffffff' }}>Welcome back, Lecturer! 👋</h2>
          <p className={styles.welcomeSubtitle} style={{ color: '#cbd5e1' }}>
            Track your active paper progress or request peer reviews. Your research impact grows with every submission.
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button 
              className={styles.goToReviewBtn}
              onClick={() => navigate(ROUTES.SEMINAR_WORKSPACE)}
              style={{ backgroundColor: '#ffffff', color: '#1e293b' }}
            >
              ＋ Create Seminar
            </button>
            <button 
              className={styles.goToReviewBtn}
              onClick={() => navigate(ROUTES.RESEARCH_GROUP)}
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              ＋ Create Research Group
            </button>
          </div>
        </div>
      </div>

      {/* Lecturer Metrics Row */}
      <div className={styles.reviewerRedesignMetricsRow}>
        <div className={styles.redesignMetricCard}>
          <div className={styles.redesignCardHeader}>
            <span className={styles.redesignMetricTitle}>ACTIVE GROUPS</span>
            <span className={styles.actionNeededBadge} style={{ backgroundColor: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' }}>Active</span>
          </div>
          <span className={styles.redesignMetricVal}>5</span>
        </div>

        <div className={styles.redesignMetricCard}>
          <div className={styles.redesignCardHeader}>
            <span className={styles.redesignMetricTitle}>UPCOMING SEMINARS</span>
            <span className={styles.allTimeBadge} style={{ backgroundColor: '#faf5ff', color: '#7c3aed', borderColor: '#e9d5ff' }}>Scheduled</span>
          </div>
          <span className={styles.redesignMetricVal}>2</span>
        </div>

        <div className={styles.redesignMetricCard}>
          <div className={styles.redesignCardHeader}>
            <span className={styles.redesignMetricTitle}>PENDING REPORTS</span>
            <span className={styles.lockedBadge} style={{ backgroundColor: '#fffbeb', color: '#d97706', borderColor: '#fef3c7' }}>Action Required</span>
          </div>
          <span className={styles.redesignMetricVal}>3</span>
        </div>
      </div>

      {/* Grid structure split */}
      <div className={styles.resGrid}>
        
        {/* Left Column: Pending Student Phase Reports (Needs Grading) */}
        <div className={styles.reviewerQueueCard} style={{ padding: '24px 20px', borderRadius: '16px' }}>
          <div className={styles.queueHeader} style={{ marginBottom: '15px' }}>
            <div className={styles.queueTitleWrapper}>
              <span className={styles.queueIcon}>📝</span>
              <h3 className={styles.queueTitle} style={{ color: '#0f172a' }}>Pending Student Phase Reports (Needs Grading)</h3>
              <span className={styles.actionNeededPill} style={{ backgroundColor: '#ffeecb', color: '#d97706' }}>3 Pending</span>
            </div>
          </div>

          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>RESEARCH GROUP</th>
                  <th>REPORT</th>
                  <th>SUBMITTED</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <button className={styles.researchGroupLinkBtn} onClick={() => navigate(ROUTES.RESEARCH_GROUP)}>
                      RG-2026-012
                    </button>
                    <span className={styles.groupSubName} style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>Scalable Routing</span>
                  </td>
                  <td className={styles.manuscriptTitleText} style={{ fontWeight: 600 }}>Phase 3 Report</td>
                  <td style={{ color: '#d97706', fontWeight: 600 }}>Submitted 2 hours ago</td>
                  <td>
                    <button className={styles.gradeReportBtn} onClick={() => navigate(ROUTES.CONFIGURE_MILESTONES)}>
                      Grade Report
                    </button>
                  </td>
                </tr>
                <tr>
                  <td>
                    <button className={styles.researchGroupLinkBtn} onClick={() => navigate(ROUTES.RESEARCH_GROUP)}>
                      RG-2026-015
                    </button>
                    <span className={styles.groupSubName} style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>Speech AI Team</span>
                  </td>
                  <td className={styles.manuscriptTitleText} style={{ fontWeight: 600 }}>Phase 2 Report</td>
                  <td style={{ color: '#64748b' }}>Submitted Yesterday</td>
                  <td>
                    <button className={styles.gradeReportBtn} onClick={() => navigate(ROUTES.CONFIGURE_MILESTONES)}>
                      Grade Report
                    </button>
                  </td>
                </tr>
                <tr>
                  <td>
                    <button className={styles.researchGroupLinkBtn} onClick={() => navigate(ROUTES.RESEARCH_GROUP)}>
                      RG-2026-009
                    </button>
                    <span className={styles.groupSubName} style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>Graph Neural Nets</span>
                  </td>
                  <td className={styles.manuscriptTitleText} style={{ fontWeight: 600 }}>Phase 1 Report</td>
                  <td style={{ color: '#64748b' }}>Submitted 3 days ago</td>
                  <td>
                    <button className={styles.gradeReportBtn} onClick={() => navigate(ROUTES.CONFIGURE_MILESTONES)}>
                      Grade Report
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Today's Seminar Schedule */}
        <div className={styles.reviewerQueueCard} style={{ padding: '24px 20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div className={styles.queueHeader} style={{ marginBottom: '0' }}>
            <div className={styles.queueTitleWrapper}>
              <span className={styles.queueIcon}>📅</span>
              <h3 className={styles.queueTitle} style={{ color: '#0f172a' }}>Today's Seminar Schedule</h3>
              <span className={styles.actionNeededPill} style={{ backgroundColor: '#f3e8ff', color: '#7c3aed' }}>1 Today</span>
            </div>
          </div>

          {/* Schedule card */}
          <div className={styles.todayScheduleBox}>
            <div className={styles.scheduleBadgeRow}>
              <span className={styles.upcomingTodayBadge}>● Upcoming Today</span>
              <span className={styles.scheduleIdText}>SEM-2026-047</span>
            </div>

            <h4 className={styles.scheduleTitleText}>Distributed Systems Thesis Defense</h4>
            <div className={styles.scheduleTimeText}>🕒 14:00 - 15:30 (UTC+7)</div>

            {/* Meet link textbox input */}
            <div className={styles.meetTextboxRow}>
              <span className={styles.meetTextboxIcon}>📹</span>
              <input 
                type="text" 
                className={styles.meetTextboxInput} 
                value="https://meet.google.com/abc-defg-hij" 
                readOnly 
              />
              <button 
                type="button" 
                className={styles.meetCopyBtn}
                onClick={() => {
                  navigator.clipboard.writeText('https://meet.google.com/abc-defg-hij');
                  alert('Copied meet link!');
                }}
              >
                📋
              </button>
            </div>

            <button 
              className={styles.joinMeetGreenBtn}
              onClick={() => window.open('https://meet.google.com/abc-defg-hij', '_blank')}
            >
              📹 Join Google Meet
            </button>
          </div>

          <button 
            className={styles.viewAllSeminarsLink}
            onClick={() => navigate(ROUTES.SEMINAR_WORKSPACE)}
          >
            View All Seminars &gt;
          </button>
        </div>
      </div>

      {/* Bottom Section: My Active Research Groups (Quick Monitoring) */}
      <div className={styles.reviewerQueueCard} style={{ padding: '24px 20px', borderRadius: '16px' }}>
        <div className={styles.queueHeader} style={{ marginBottom: '20px' }}>
          <div className={styles.queueTitleWrapper}>
            <span className={styles.queueIcon}>👥</span>
            <h3 className={styles.queueTitle} style={{ color: '#0f172a' }}>My Active Research Groups (Quick Monitoring)</h3>
            <span className={styles.actionNeededPill} style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>5 Groups</span>
          </div>
        </div>

        {/* Groups monitoring list */}
        <div className={styles.groupsProgressList}>
          {/* Group 1 */}
          <div className={styles.groupProgressItem}>
            <div className={styles.groupProgressMeta}>
              <div className={styles.groupProgressNameBlock}>
                <span className={styles.groupProgressIcon}>👥</span>
                <div>
                  <h4 className={styles.groupProgressTitle}>Scalable Routing Architecture Group</h4>
                  <span className={styles.groupProgressRoster}>3 Members</span>
                </div>
              </div>
              <span className={styles.groupProgressPhaseBadge} style={{ backgroundColor: '#e6fffa', color: '#00b894' }}>Phase 3</span>
            </div>
            <div className={styles.progressBarWrapper}>
              <div className={styles.progressBarBg}>
                <div className={styles.progressBarFill} style={{ width: '85%', backgroundColor: '#00b894' }}></div>
              </div>
              <span className={styles.progressPercentText}>85%</span>
            </div>
            <button className={styles.viewGroupArrowBtn} onClick={() => navigate(ROUTES.RESEARCH_GROUP)}>
              View Group &rarr;
            </button>
          </div>

          {/* Group 2 */}
          <div className={styles.groupProgressItem}>
            <div className={styles.groupProgressMeta}>
              <div className={styles.groupProgressNameBlock}>
                <span className={styles.groupProgressIcon}>👥</span>
                <div>
                  <h4 className={styles.groupProgressTitle}>AI Speech-to-Text Research Team</h4>
                  <span className={styles.groupProgressRoster}>2 Members</span>
                </div>
              </div>
              <span className={styles.groupProgressPhaseBadge} style={{ backgroundColor: '#ebf8ff', color: '#3182ce' }}>Phase 2</span>
            </div>
            <div className={styles.progressBarWrapper}>
              <div className={styles.progressBarBg}>
                <div className={styles.progressBarFill} style={{ width: '60%', backgroundColor: '#3182ce' }}></div>
              </div>
              <span className={styles.progressPercentText}>60%</span>
            </div>
            <button className={styles.viewGroupArrowBtn} onClick={() => navigate(ROUTES.RESEARCH_GROUP)}>
              View Group &rarr;
            </button>
          </div>

          {/* Group 3 */}
          <div className={styles.groupProgressItem}>
            <div className={styles.groupProgressMeta}>
              <div className={styles.groupProgressNameBlock}>
                <span className={styles.groupProgressIcon}>👥</span>
                <div>
                  <h4 className={styles.groupProgressTitle}>Graph Neural Networks Team</h4>
                  <span className={styles.groupProgressRoster}>4 Members</span>
                </div>
              </div>
              <span className={styles.groupProgressPhaseBadge} style={{ backgroundColor: '#faf5ff', color: '#805ad5' }}>Phase 1</span>
            </div>
            <div className={styles.progressBarWrapper}>
              <div className={styles.progressBarBg}>
                <div className={styles.progressBarFill} style={{ width: '40%', backgroundColor: '#805ad5' }}></div>
              </div>
              <span className={styles.progressPercentText}>40%</span>
            </div>
            <button className={styles.viewGroupArrowBtn} onClick={() => navigate(ROUTES.RESEARCH_GROUP)}>
              View Group &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
