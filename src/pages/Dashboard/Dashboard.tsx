import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../routes/paths';
import styles from './Dashboard.module.css';

// SVG Icons
const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <circle cx="17" cy="8" r="1"></circle>
  </svg>
);

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

export const Dashboard = () => {
  const navigate = useNavigate();

  // Selected role for dashboard layout switching
  const [activeRole, setActiveRole] = useState<'Researcher' | 'Reviewer' | 'Lecturer' | 'Graduate Student'>('Researcher');

  const [isFrameworkSubmitted, setIsFrameworkSubmitted] = useState(false);

  useEffect(() => {
    // Sync active role with layout
    const checkRole = () => {
      const saved = localStorage.getItem('ars_active_role');
      if (saved) setActiveRole(saved as any);
      setIsFrameworkSubmitted(localStorage.getItem('ars_framework_submitted') === 'true');
    };
    checkRole();
    window.addEventListener('storage', checkRole);
    // Poll to detect localstorage updates instantly
    const interval = setInterval(checkRole, 500);
    return () => {
      window.removeEventListener('storage', checkRole);
      clearInterval(interval);
    };
  }, []);

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
                <span className={styles.quickCardIcon}><UploadIcon /></span>
                <span className={styles.quickCardText}>Upload New Manuscript Artifact</span>
              </div>
              <span className={styles.quickCardArrow}>&gt;</span>
            </div>

            <div className={styles.quickCard} onClick={() => navigate(ROUTES.REVIEWERS)}>
              <div className={styles.quickCardLeft}>
                <span className={styles.quickCardIcon} style={{ color: '#10b981' }}><UsersIcon /></span>
                <span className={styles.quickCardText}>Find Expert Peer Reviewers Pool</span>
              </div>
              <span className={styles.quickCardArrow}>&gt;</span>
            </div>

            <div className={styles.quickCard}>
              <div className={styles.quickCardLeft}>
                <span className={styles.quickCardIcon} style={{ color: '#f59e0b' }}><CalendarIcon /></span>
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
                  <p className={styles.activityDesc}>Manuscript v2 review funds are safely held in escrow</p>
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
              <span className={styles.redesignMetricTitle}>HELD IN ESCROW</span>
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

  // RENDER: LECTURER CONSOLE (FRAME 11)
  return (
    <div className={styles.dashboard}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; <span className={styles.activeBreadcrumb}>Lecturer Management Console</span>
      </div>

      {/* Header */}
      <div className={styles.roleHeaderArea}>
        <h1 className={styles.roleTitle}>Lecturer Console</h1>
        <p className={styles.roleSubtitle}>Manage cohorts, seminars, and materials from a single workspace.</p>
      </div>

      {/* Grid: Groups status + seminars */}
      <div className={styles.resGrid}>
        {/* Left Column: Guided Active Groups */}
        <div className={styles.studentInfoCard}>
          <div className={styles.studentCardHeader}>
            <span className={styles.studentCardHeaderTitle}>GUIDED ACTIVE GROUPS STATUS</span>
          </div>

          <div className={styles.lecturerGroupsList}>
            {/* Group 1 */}
            <div className={styles.lecturerGroupItem}>
              <div className={styles.groupMetaHeader}>
                <div>
                  <span className={styles.groupNumber}>GROUP 01</span>
                  <h4 className={styles.groupProjectTitle}>Core Automation V3</h4>
                </div>
                <div className={styles.groupStatusRow}>
                  <span className={`${styles.statusDotLabel} ${styles.statusPending}`}>Pending Review</span>
                  <span className={styles.groupPhaseLabel}>Phase 2</span>
                </div>
              </div>
              <div className={styles.groupItemFooter}>
                <span className={styles.groupMembersText}>4 members · 3 submissions pending</span>
                <button 
                  className={styles.reviewSubmissionsBtn}
                  onClick={() => navigate(ROUTES.RESEARCH_GROUP)}
                >
                  Review Submissions ↗
                </button>
              </div>
            </div>

            {/* Group 2 */}
            <div className={styles.lecturerGroupItem} style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div className={styles.groupMetaHeader}>
                <div>
                  <span className={styles.groupNumber}>GROUP 02</span>
                  <h4 className={styles.groupProjectTitle}>Data Mining Group B</h4>
                </div>
                <div className={styles.groupStatusRow}>
                  <span className={`${styles.statusDotLabel} ${styles.statusAccepted}`}>On Track</span>
                  <span className={styles.groupPhaseLabel} style={{ color: '#64748b' }}>No action required</span>
                </div>
              </div>
              <div className={styles.groupItemFooter}>
                <span className={styles.groupMembersText}>6 members</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Upcoming planned seminars */}
        <div className={styles.studentInfoCard}>
          <div className={styles.studentCardHeader}>
            <span className={styles.studentCardHeaderTitle}>UPCOMING PLANNED SEMINARS</span>
          </div>

          <div className={styles.lecturerSeminarCard}>
            <div className={styles.seminarSessionCard}>
              <div className={styles.seminarIconCircle}>📹</div>
              <div className={styles.seminarSessionMeta}>
                <span className={styles.seminarSessionLabel}>NEXT SESSION</span>
                <h4 className={styles.seminarSessionTitle}>Distributed Ledgers</h4>
                <span className={styles.seminarSessionTime}>🕒 2026-07-15 - 14:00 UTC</span>
              </div>
            </div>
            {/* Meet Link banner */}
            <div className={styles.meetLinkBanner}>
              <span className={styles.meetDot}>●</span>
              <span>Meet Linked</span>
            </div>
          </div>

          <div className={styles.lecturerSeminarFooter}>
            <span className={styles.additionalSeminars}>2 additional seminars scheduled</span>
            <button 
              className={styles.launchSeminarHubBtn}
              onClick={() => navigate(ROUTES.SEMINAR_WORKSPACE)}
            >
              Launch Seminar Hub ↗
            </button>
          </div>
        </div>
      </div>

      {/* Quick Controls Section */}
      <div className={styles.studentFeedbackCard}>
        <div className={styles.studentCardHeader}>
          <span className={styles.studentCardHeaderTitle}>CONSOLE QUICK MANAGEMENT CONTROLS</span>
        </div>

        <div className={styles.lecturerControlsGrid}>
          <div className={styles.controlCard} onClick={() => navigate(ROUTES.RESEARCH_GROUP)}>
            <div className={styles.controlCardLeft}>
              <span className={styles.controlIconBg}>＋</span>
              <div className={styles.controlMeta}>
                <span className={styles.controlTitle}>Instantiate New Guidance Group</span>
                <span className={styles.controlSub}>Create & configure a cohort</span>
              </div>
            </div>
            <span className={styles.controlArrow}>&gt;</span>
          </div>

          <div className={styles.controlCard} onClick={() => navigate(ROUTES.SEMINAR_WORKSPACE)}>
            <div className={styles.controlCardLeft}>
              <span className={styles.controlIconBg} style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>📅</span>
              <div className={styles.controlMeta}>
                <span className={styles.controlTitle}>Schedule Academic Seminar</span>
                <span className={styles.controlSub}>Set date, topic & link</span>
              </div>
            </div>
            <span className={styles.controlArrow}>&gt;</span>
          </div>

          <div className={styles.controlCard}>
            <div className={styles.controlCardLeft}>
              <span className={styles.controlIconBg} style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>📁</span>
              <div className={styles.controlMeta}>
                <span className={styles.controlTitle}>Distribute Colleague Materials</span>
                <span className={styles.controlSub}>Push docs to group members</span>
              </div>
            </div>
            <span className={styles.controlArrow}>&gt;</span>
          </div>

          <div className={styles.controlCard}>
            <div className={styles.controlCardLeft}>
              <span className={styles.controlIconBg} style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>🛡️</span>
              <div className={styles.controlMeta}>
                <span className={styles.controlTitle}>Open Access License Auditing</span>
                <span className={styles.controlSub}>Review permissions & access</span>
              </div>
            </div>
            <span className={styles.controlArrow}>&gt;</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
