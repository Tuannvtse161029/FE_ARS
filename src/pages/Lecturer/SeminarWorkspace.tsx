import { useState } from 'react';
import styles from './SeminarWorkspace.module.css';

interface Seminar {
  id: string;
  title: string;
  status: 'UPCOMING' | 'IN PROGRESS' | 'COMPLETED';
  date: string;
  time: string;
  description: string;
  inviteCount: number;
  avatars: string[];
  meetLink: string;
  feedbackSubmitted?: number;
  feedbackTotal?: number;
  isNew?: boolean;
}

interface StudentGrade {
  name: string;
  email: string;
  status: 'SUBMITTED' | 'PENDING';
  score?: string;
  comment?: string;
}

export const SeminarWorkspace = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'completed' | 'drafts'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGeneratedModal, setShowGeneratedModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [bannerText, setBannerText] = useState('');
  const [selectedSeminarForFeedback, setSelectedSeminarForFeedback] = useState<Seminar | null>(null);

  // AI Summarizer states (Frame 35 & 36)
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiModalStep, setAiModalStep] = useState<'upload' | 'results'>('upload');
  const [aiNotesSaved, setAiNotesSaved] = useState(false);
  const [selectedSeminarForAi, setSelectedSeminarForAi] = useState<Seminar | null>(null);

  // Form states inside Create Modal (Frame 30)
  const [seminarName, setSeminarName] = useState('Advanced Cloud Routing Architecture Seminar');
  const [dateTime, setDateTime] = useState('2026-07-29 · 10:00 AM');
  const [seminarDetails, setSeminarDetails] = useState('Deep dive into modular backend routing networks and high-concurrency telemetry.');
  const [guestEmails, setGuestEmails] = useState(['student1@ars.edu.vn', 'researcher.b@ars.edu.vn']);
  const [emailInputText, setEmailInputText] = useState('');
  const [sendReminder, setSendReminder] = useState(true);

  // Generated Meet link state for Frame 31
  const [generatedMeetLink, setGeneratedMeetLink] = useState('https://meet.google.com/xyz-uvwx-rst');

  // Initial seminars list
  const [seminars, setSeminars] = useState<Seminar[]>([
    {
      id: 'SEM-2026-047',
      title: 'Distributed Systems & Scalability Thesis Defense',
      status: 'UPCOMING',
      date: '2026-07-28',
      time: '14:00 – 15:30 (UTC+7)',
      description: 'Reviewing phase 3 architectural milestones for graduate research groups. Covers consensus algorithms, partition tolerance analysis, and live scalability benchmarks.',
      inviteCount: 12,
      avatars: ['AB', 'BN', 'CK', 'DP'],
      meetLink: 'https://meet.google.com/abc-defg-hij',
    },
    {
      id: 'SEM-2026-044',
      title: 'Machine Learning Fairness & Bias Auditing Workshop',
      status: 'IN PROGRESS',
      date: '2026-07-26',
      time: '09:00 – 11:00 (UTC+7)',
      description: 'Examining algorithmic bias detection frameworks applied to graduate admissions datasets with live demo.',
      inviteCount: 8,
      avatars: ['XY', 'ZT', 'KW'],
      meetLink: 'https://meet.google.com/mno-pqrs-tuv',
    },
    {
      id: 'SEM-2026-041',
      title: 'Graph Neural Networks for Citation Analysis',
      status: 'COMPLETED',
      date: '2026-07-22',
      time: '10:00 – 11:30 (UTC+7)',
      description: 'Post-session review of GNN architectures applied to academic citation graphs. Covered node classification and link prediction benchmarks.',
      inviteCount: 4,
      avatars: ['PD', 'JD', 'TL', 'MN'],
      meetLink: 'https://meet.google.com/gnn-cite-xyz',
      feedbackSubmitted: 4,
      feedbackTotal: 4,
    },
    {
      id: 'SEM-2026-039',
      title: 'Phase 2 Milestone Review – Distributed DBs',
      status: 'COMPLETED',
      date: '2026-07-20',
      time: '14:00 – 15:00 (UTC+7)',
      description: 'Completed review of distributed database consistency models, replication strategies, and CAP theorem applications across research submissions.',
      inviteCount: 4,
      avatars: ['AB', 'XY', 'MN'],
      meetLink: 'https://meet.google.com/ddb-phase2',
      feedbackSubmitted: 3,
      feedbackTotal: 4,
    },
  ]);

  // Mock Student Grades for Feedback Modal (Frame 34)
  const studentGradesList: StudentGrade[] = [
    {
      name: 'Anh Nguyen Thi',
      email: 'student1@ars.edu.vn',
      status: 'SUBMITTED',
      score: '8.5/10',
      comment: 'Excellent replication strategy analysis.',
    },
    {
      name: 'Bao Tran Van',
      email: 'researcher.b@ars.edu.vn',
      status: 'SUBMITTED',
      score: '7.0/10',
      comment: 'Good work, more depth on CAP theorem needed.',
    },
    {
      name: 'Chi Pham Minh',
      email: 'chi.pm@ars.edu.vn',
      status: 'SUBMITTED',
      score: '9.0/10',
      comment: 'Outstanding distributed DB design proposal.',
    },
    {
      name: 'Duc Le Hoang',
      email: 'duc.lh@ars.edu.vn',
      status: 'PENDING',
      score: '-',
      comment: 'No submission yet',
    },
  ];

  // Filters logic
  const filteredSeminars = seminars.filter((sem) => {
    if (activeTab === 'upcoming') {
      return sem.status === 'UPCOMING' || sem.status === 'IN PROGRESS';
    }
    if (activeTab === 'completed') {
      return sem.status === 'COMPLETED';
    }
    if (activeTab === 'drafts') {
      return false; // No drafts
    }
    return true; // All
  });

  const handleAddEmail = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && emailInputText.trim()) {
      if (!guestEmails.includes(emailInputText.trim())) {
        setGuestEmails([...guestEmails, emailInputText.trim()]);
      }
      setEmailInputText('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    setGuestEmails(guestEmails.filter((x) => x !== email));
  };

  const handleCreateSeminarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seminarName.trim()) {
      alert('Please enter a seminar name.');
      return;
    }

    const meetUrl = 'https://meet.google.com/xyz-uvwx-rst';
    setGeneratedMeetLink(meetUrl);

    const newSem: Seminar = {
      id: 'SEM-2026-049',
      title: seminarName,
      status: 'UPCOMING',
      date: '2026-07-29',
      time: '10:00 AM (UTC+7)',
      description: seminarDetails || 'Deep dive into modular backend routing networks and high-concurrency telemetry.',
      inviteCount: guestEmails.length > 0 ? guestEmails.length : 2,
      avatars: ['AN', 'BT'],
      meetLink: meetUrl,
      isNew: true,
    };

    setSeminars([newSem, ...seminars]);
    setShowCreateModal(false);
    setShowGeneratedModal(true);
    setBannerText(`"${seminarName}" has been created and Google Meet link generated.`);
    setShowSuccessBanner(true);
  };

  const handleOpenFeedbackModal = (sem: Seminar) => {
    setSelectedSeminarForFeedback(sem);
    setShowFeedbackModal(true);
  };

  const handleRemindPending = () => {
    alert('An automated email reminder has been sent to Duc Le Hoang (duc.lh@ars.edu.vn).');
  };

  return (
    <div className={styles.seminarWorkspace}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; <span className={styles.activeBreadcrumb}>Academic Seminars</span>
      </div>

      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Seminar & Workshop Management</h1>
          <p className={styles.pageSubtitle}>
            Manage your scheduled seminars, share resources, and collect feedback.
          </p>
        </div>
        <button className={styles.createSeminarBtn} onClick={() => setShowCreateModal(true)}>
          ＋ Create Seminar
        </button>
      </div>

      {/* SUCCESS TOAST BANNER (Frame 32 & 33) */}
      {showSuccessBanner && (
        <div className={styles.successToastBanner}>
          <div className={styles.toastLeft}>
            <span className={styles.toastCheckIcon}>✓</span>
            <div>
              <span className={styles.toastTitle}>Seminar Created Successfully</span>
              <p className={styles.toastSub}>{bannerText}</p>
            </div>
          </div>
          <div className={styles.toastRight}>
            <span className={styles.justNowText}>Just now</span>
            <button className={styles.toastCloseBtn} onClick={() => setShowSuccessBanner(false)}>✕</button>
          </div>
        </div>
      )}

      {/* Tab filter list */}
      <div className={styles.tabsRow}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'all' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Seminars ({seminars.length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'upcoming' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Upcoming ({seminars.filter((s) => s.status !== 'COMPLETED').length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'completed' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed ({seminars.filter((s) => s.status === 'COMPLETED').length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'drafts' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('drafts')}
        >
          Drafts
        </button>

        <span className={styles.showingCountRight}>
          Showing {filteredSeminars.length} of {seminars.length} seminars
        </span>
      </div>

      {/* Main Seminar list */}
      <div className={styles.seminarsList}>
        {activeTab === 'drafts' ? (
          <div className={styles.emptyDrafts}>
            <span className={styles.emptyIcon}>📄</span>
            <h4 className={styles.emptyTitle}>No drafts</h4>
            <p className={styles.emptyText}>Saved drafts will appear here.</p>
          </div>
        ) : (
          filteredSeminars.map((sem) => (
            <div className={styles.seminarCard} key={sem.id}>
              {/* Top metadata */}
              <div className={styles.cardHeaderRow}>
                <div className={styles.badgeRow}>
                  {sem.isNew && <span className={styles.newBadgePill}>NEW Just created</span>}
                  {sem.status === 'UPCOMING' && <span className={styles.statusUpcoming}>● UPCOMING</span>}
                  {sem.status === 'IN PROGRESS' && <span className={styles.statusInProgress}>● IN PROGRESS</span>}
                  {sem.status === 'COMPLETED' && <span className={styles.statusCompleted}>● COMPLETED</span>}
                  <span className={styles.seminarId}>ID: {sem.id}</span>
                </div>
                <div className={styles.dateMeta}>
                  <span>📅 {sem.date}</span>
                  <span style={{ marginLeft: '12px' }}>🕒 {sem.time}</span>
                </div>
              </div>

              {/* Title and description */}
              <h3 className={styles.seminarTitle}>{sem.title}</h3>
              <p className={styles.seminarDescription}>{sem.description}</p>

              {/* Roster & Avatar list */}
              {sem.status !== 'COMPLETED' && (
                <div className={styles.rosterRow}>
                  <span className={styles.inviteCountText}>{sem.inviteCount} invited</span>
                  <div className={styles.avatarList}>
                    {sem.avatars.map((av, idx) => (
                      <div className={styles.avatarCircle} key={idx}>
                        {av}
                      </div>
                    ))}
                    {sem.inviteCount > sem.avatars.length && (
                      <div className={styles.avatarMore}>+{sem.inviteCount - sem.avatars.length}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Google Meet Box */}
              <div className={styles.meetBox}>
                <span className={styles.meetIcon}>📹</span>
                <a href={sem.meetLink} className={sem.meetLinkText} target="_blank" rel="noopener noreferrer">
                  {sem.meetLink} ↗
                </a>
              </div>

              {/* Completed Feedback Bar */}
              {sem.status === 'COMPLETED' && sem.feedbackSubmitted !== undefined && sem.feedbackTotal !== undefined && (
                <div className={styles.feedbackProgressBlock}>
                  <div className={styles.feedbackProgressLabels}>
                    <span className={styles.progressLabel}>Feedback submissions</span>
                    <span className={styles.progressText}>
                      {sem.feedbackSubmitted} / {sem.feedbackTotal}
                    </span>
                  </div>
                  <div className={styles.progressBg}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${(sem.feedbackSubmitted / sem.feedbackTotal) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Card Actions */}
              <div className={styles.cardActionsRow}>
                {sem.status === 'COMPLETED' ? (
                  <>
                    <button
                      className={styles.viewNotesBtn}
                      onClick={() => {
                        setSelectedSeminarForAi(sem);
                        if (aiNotesSaved) {
                          setAiModalStep('results');
                        } else {
                          setAiModalStep('upload');
                        }
                        setShowAiModal(true);
                      }}
                    >
                      {aiNotesSaved ? (
                        <>
                          👁️ View Notes (AI Generated){' '}
                          <span className={styles.greenAiBadge}>✓ AI</span>
                        </>
                      ) : (
                        '👁️ View Notes'
                      )}
                    </button>
                    <button
                      className={styles.feedbackGradingBtn}
                      onClick={() => handleOpenFeedbackModal(sem)}
                    >
                      📋 Form Feedback & Grading{' '}
                      <span className={styles.gradingBadge}>
                        {sem.feedbackSubmitted}/{sem.feedbackTotal} Submitted
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className={styles.joinMeetBtn}
                      onClick={() => window.open(sem.meetLink, '_blank')}
                    >
                      📹 Join Google Meet
                    </button>
                    <button
                      className={styles.sendInviteBtn}
                      onClick={() => {
                        navigator.clipboard.writeText(sem.meetLink);
                        alert('Copied invite link!');
                      }}
                    >
                      ✉️ Send Invite Link
                    </button>
                    <button className={styles.feedbackDisabledBtn} disabled>
                      Form Feedback (Available after completion)
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* FRAME 30: CREATE NEW ACADEMIC SEMINAR MODAL */}
      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.createModalCard}>
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalHeaderIcon}>＋</span>
                <div>
                  <h3 className={styles.modalTitle}>Create New Academic Seminar</h3>
                  <span className={styles.modalSubtitle}>Fill in details — a Google Meet link will be auto-generated</span>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            <form onSubmit={handleCreateSeminarSubmit} className={styles.modalForm}>
              {/* Seminar Name */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Seminar Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={seminarName}
                  onChange={(e) => setSeminarName(e.target.value)}
                  placeholder="Advanced Cloud Routing Architecture Seminar"
                  required
                />
              </div>

              {/* Date & Time */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Date & Time</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  placeholder="2026-07-29 · 10:00 AM"
                  required
                />
              </div>

              {/* Seminar Details */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Seminar Details</label>
                <textarea
                  className={styles.formTextarea}
                  value={seminarDetails}
                  onChange={(e) => setSeminarDetails(e.target.value)}
                  placeholder="Deep dive into modular backend routing networks and high-concurrency telemetry."
                  rows={4}
                  required
                />
              </div>

              {/* Guest Email Invitations */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Guest Email Invitations (comma-separated)</label>
                <div className={styles.emailsInputBox}>
                  <input
                    type="text"
                    className={styles.emailRawInput}
                    value={emailInputText}
                    onChange={(e) => setEmailInputText(e.target.value)}
                    onKeyDown={handleAddEmail}
                    placeholder="Type email and press Enter..."
                  />
                  <div className={styles.emailTagsContainer}>
                    {guestEmails.map((email) => (
                      <span key={email} className={styles.emailPill}>
                        ✉️ {email}
                        <button
                          type="button"
                          className={styles.removeEmailCross}
                          onClick={() => handleRemoveEmail(email)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Checkbox Send Reminder */}
              <div className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  id="sendReminderCheck"
                  className={styles.checkboxInput}
                  checked={sendReminder}
                  onChange={(e) => setSendReminder(e.target.checked)}
                />
                <label htmlFor="sendReminderCheck" className={styles.checkboxLabel}>
                  <b>Send Email Reminder</b>
                  <span className={styles.checkboxSub}>Auto-send an email reminder to guests 1 day before the seminar starts</span>
                </label>
              </div>

              {/* Actions */}
              <div className={styles.modalFormFooter}>
                <button
                  type="button"
                  className={styles.modalCancelBtn}
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.modalSubmitNavyBtn}>
                  📹 Generate & Create Seminar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FRAME 31: SEMINAR CREATED & GOOGLE MEET LINK GENERATED MODAL */}
      {showGeneratedModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.generatedModalCard}>
            <div className={styles.generatedIconCircle}>✓</div>
            <h3 className={styles.generatedTitle}>Seminar Created & Google Meet Link Generated!</h3>
            <p className={styles.generatedSub}>{seminarName}</p>

            {/* Meet Link copy box */}
            <div className={styles.generatedMeetCard}>
              <div className={styles.generatedMeetLabel}>📹 Google Meet Link</div>
              <div className={styles.generatedMeetInputRow}>
                <input
                  type="text"
                  className={styles.generatedMeetInput}
                  value={generatedMeetLink}
                  readOnly
                />
                <button
                  className={styles.copyLinkBlueBtn}
                  onClick={() => {
                    navigator.clipboard.writeText(generatedMeetLink);
                    alert('Copied Google Meet link!');
                  }}
                >
                  📋 Copy Link
                </button>
              </div>
            </div>

            {/* Yellow alert box */}
            <div className={styles.yellowAlertBox}>
              <div className={styles.yellowAlertTitleRow}>
                <span className={styles.yellowAlertIcon}>⚠️</span>
                <span>Email invitations have been sent to invited guests. An automated reminder will be sent <b>1 day before</b> the seminar starts.</span>
              </div>
              <div className={styles.yellowSentText}>
                ✉️ Sent to: {guestEmails.join(', ')}
              </div>
            </div>

            {/* Action buttons */}
            <div className={styles.generatedModalFooter}>
              <button
                className={styles.backToSeminarsBtn}
                onClick={() => setShowGeneratedModal(false)}
              >
                Back to Seminars
              </button>
              <button
                className={styles.launchMeetGreenBtn}
                onClick={() => window.open(generatedMeetLink, '_blank')}
              >
                📹 Launch Google Meet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FRAME 34: FEEDBACK & GRADING REVIEW MODAL */}
      {showFeedbackModal && selectedSeminarForFeedback && (
        <div className={styles.modalOverlay}>
          <div className={styles.feedbackModalCard}>
            {/* Header */}
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.feedbackModalIcon}>📋</span>
                <div>
                  <h3 className={styles.modalTitle}>Feedback & Grading Review</h3>
                  <span className={styles.modalSubtitle}>
                    {selectedSeminarForFeedback.title} · {selectedSeminarForFeedback.date}
                  </span>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowFeedbackModal(false)}>×</button>
            </div>

            {/* Stats Metrics Bar */}
            <div className={styles.feedbackStatsGrid}>
              <div className={styles.statBlock}>
                <span className={styles.statLabel}>Total Invited</span>
                <span className={styles.statVal}>4</span>
              </div>
              <div className={styles.statBlock}>
                <span className={styles.statLabel}>Submitted</span>
                <span className={styles.statVal}>3</span>
              </div>
              <div className={styles.statBlock}>
                <span className={styles.statLabel}>Pending</span>
                <span className={styles.statVal}>1</span>
              </div>
              <div className={styles.statBlock}>
                <span className={styles.statLabel}>Avg. Score</span>
                <span className={styles.statVal}>8.2</span>
              </div>
              <div className={styles.statBlockCompletion}>
                <div className={styles.completionHeaderRow}>
                  <span className={styles.statLabel}>Completion</span>
                  <span className={styles.completionPercent}>75%</span>
                </div>
                <div className={styles.completionBarBg}>
                  <div className={styles.completionBarFill} style={{ width: '75%' }}></div>
                </div>
              </div>
            </div>

            {/* Student Grading Table */}
            <div className={styles.studentGradesTableWrapper}>
              <table className={styles.studentGradesTable}>
                <thead>
                  <tr>
                    <th>STUDENT</th>
                    <th>STATUS</th>
                    <th>SCORE</th>
                    <th>COMMENT</th>
                  </tr>
                </thead>
                <tbody>
                  {studentGradesList.map((st, i) => (
                    <tr key={i}>
                      <td>
                        <div className={styles.studentCellBlock}>
                          <span className={styles.studentAvatarMini}>{st.name.slice(0, 2).toUpperCase()}</span>
                          <div>
                            <span className={styles.studentNameText}>{st.name}</span>
                            <span className={styles.studentEmailText}>{st.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {st.status === 'SUBMITTED' ? (
                          <span className={styles.submittedPill}>✓ SUBMITTED</span>
                        ) : (
                          <span className={styles.pendingPill}>🕒 PENDING</span>
                        )}
                      </td>
                      <td className={styles.scoreValText}>{st.score}</td>
                      <td className={styles.commentText}>{st.comment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className={styles.feedbackModalFooter}>
              <button className={styles.remindPendingBtn} onClick={handleRemindPending}>
                ✉️ Remind Pending (1)
              </button>
              <button className={styles.modalCloseNavyBtn} onClick={() => setShowFeedbackModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FRAME 35 & 36: SEMINAR RECORDING AI SUMMARIZER MODAL */}
      {showAiModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.aiSummarizerModalCard}>
            {/* Header */}
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.aiIconCircle}>✨</span>
                <div>
                  <h3 className={styles.modalTitle}>Seminar Recording AI Summarizer</h3>
                  <span className={styles.modalSubtitle}>Upload meeting media to generate automated AI notes.</span>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowAiModal(false)}>×</button>
            </div>

            {/* Content for Step 1: Upload (Frame 35) or Step 2: Results (Frame 36) */}
            <div className={styles.aiModalContentArea}>
              {/* Media Dropzone */}
              <div className={styles.mediaDropzone}>
                <span className={styles.dropzoneFilmIcon}>🎬</span>
                <span className={styles.dropzoneMainText}>Drag & drop your meeting recording here or click to browse</span>
                <span className={styles.dropzoneSubText}>Supported formats: .mp4, .wav · Maximum file size: Below 3 GB</span>
                <button className={styles.browseFilesBtn} type="button">
                  📤 Browse files
                </button>
              </div>

              {/* Attached file card */}
              <div className={styles.attachedFileCard}>
                <span className={styles.attachedFilmIcon}>📼</span>
                <div className={styles.attachedFileMeta}>
                  <span className={styles.attachedFileName}>Phase2_DB_Review_20260720.mp4</span>
                  <span className={styles.attachedFileSize}>1.2 GB · Ready to process</span>
                </div>
                <span className={styles.attachedPillBadge}>✓ Attached</span>
              </div>

              {/* STEP 2 RESULTS PANEL (Frame 36) */}
              {aiModalStep === 'results' && (
                <div className={styles.aiGeneratedResultsCard}>
                  <div className={styles.aiResultsHeaderRow}>
                    <div className={styles.aiResultsHeaderLeft}>
                      <span className={styles.sparkleIcon}>✨</span>
                      <span className={styles.aiResultsTitle}>AI Generated Notes & Key Takeaways</span>
                    </div>
                    <span className={styles.regenerationAttemptsPill}>🔄 Regeneration Attempts Left: 3/3</span>
                  </div>

                  <div className={styles.aiResultSection}>
                    <h5 className={styles.aiSectionLabel}>EXECUTIVE OVERVIEW</h5>
                    <p className={styles.aiSectionText}>
                      Discussed distributed database consistency models, multi-region replication latency, and trade-offs under CAP theorem constraints.
                    </p>
                  </div>

                  <div className={styles.aiResultSection}>
                    <h5 className={styles.aiSectionLabel}>KEY ACTION ITEMS</h5>
                    <div className={styles.actionItemsList}>
                      <div className={styles.actionItemRow}>
                        <span className={styles.actionNumBadge}>1</span>
                        <span>Group 1 to migrate metadata to PostgreSQL with read replicas.</span>
                      </div>
                      <div className={styles.actionItemRow}>
                        <span className={styles.actionNumBadge}>2</span>
                        <span>Group 2 approved for testing Raft consensus protocol.</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.aiResultSection}>
                    <h5 className={styles.aiSectionLabel}>PARTICIPANT ENGAGEMENT</h5>
                    <div className={styles.engagementBadge}>
                      🟢 <b>4/4 active</b> participants active in Q&A session.
                    </div>
                  </div>

                  <div className={styles.aiDisclaimerFooter}>
                    ⓘ AI-generated content. Review for accuracy before saving. Notes will be attached to the seminar record permanently.
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className={styles.aiModalFooter}>
              {aiModalStep === 'upload' ? (
                <>
                  <span className={styles.filesReadyText}>📁 1 file ready · 1.2 GB</span>
                  <div className={styles.footerBtnsRight}>
                    <button className={styles.modalCancelBtn} onClick={() => setShowAiModal(false)}>
                      Cancel
                    </button>
                    <button
                      className={styles.summarizeMagicBtn}
                      onClick={() => setAiModalStep('results')}
                    >
                      🪄 Click to Summarize
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button className={styles.regenerateBtn} onClick={() => alert('Regenerated AI notes!')}>
                    🔄 Regenerate (3/3 Left)
                  </button>
                  <div className={styles.footerBtnsRight}>
                    <button className={styles.modalCancelBtn} onClick={() => setShowAiModal(false)}>
                      Cancel
                    </button>
                    <button
                      className={styles.agreeSaveNavyBtn}
                      onClick={() => {
                        setAiNotesSaved(true);
                        setBannerText(
                          'AI Seminar Notes successfully saved and attached to Phase 2 Milestone Review - Distributed DBs.\nGenerated by AI · Accessible via "View Notes (AI Generated)" on the seminar card below.'
                        );
                        setShowSuccessBanner(true);
                        setShowAiModal(false);
                      }}
                    >
                      ✔ Agree & Save Notes
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeminarWorkspace;
