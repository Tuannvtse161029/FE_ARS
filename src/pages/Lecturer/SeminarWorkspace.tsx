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
}

export const SeminarWorkspace = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'completed' | 'drafts'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Form states inside modal
  const [topicTitle, setTopicTitle] = useState('Distributed Ledger Implementations in Modern Cloud Architectures');
  const [abstract, setAbstract] = useState('');
  const [startDate, setStartDate] = useState('2026-08-15T14:00');
  const [endDate, setEndDate] = useState('2026-08-15T16:00');
  const [invitees, setInvitees] = useState(['Student_Group_A', 'Res_A_Nguyen']);
  const [searchText, setSearchText] = useState('');

  // Initial seminars list
  const [seminars, setSeminars] = useState<Seminar[]>([
    {
      id: 'SEM-2026-047',
      title: 'Distributed Systems & Scalability Thesis Defense',
      status: 'UPCOMING',
      date: '2026-07-28',
      time: '14:00 - 15:30 (UTC+7)',
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
      time: '09:00 - 11:00 (UTC+7)',
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
      time: '10:00 - 11:30 (UTC+7)',
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
      time: '14:00 - 15:00 (UTC+7)',
      description: 'Completed review of distributed database consistency models, replication strategies, and CAP theorem applications across research submissions.',
      inviteCount: 4,
      avatars: ['AB', 'XY', 'MN'],
      meetLink: 'https://meet.google.com/ddb-phase2',
      feedbackSubmitted: 3,
      feedbackTotal: 4,
    },
  ]);

  // Filters logic
  const filteredSeminars = seminars.filter((sem) => {
    if (activeTab === 'upcoming') {
      return sem.status === 'UPCOMING' || sem.status === 'IN PROGRESS';
    }
    if (activeTab === 'completed') {
      return sem.status === 'COMPLETED';
    }
    if (activeTab === 'drafts') {
      return false; // No drafts mock
    }
    return true; // All
  });

  const handleAddInvitee = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchText.trim()) {
      if (!invitees.includes(searchText.trim())) {
        setInvitees([...invitees, searchText.trim()]);
      }
      setSearchText('');
    }
  };

  const handleRemoveInvitee = (name: string) => {
    setInvitees(invitees.filter((x) => x !== name));
  };

  const handleCreateSeminar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicTitle.trim()) {
      alert('Please enter a seminar topic title.');
      return;
    }

    const newSeminar: Seminar = {
      id: `SEM-2026-${Math.floor(100 + Math.random() * 900)}`,
      title: topicTitle,
      status: 'UPCOMING',
      date: startDate.slice(0, 10),
      time: `${startDate.slice(11)} - ${endDate.slice(11)} (UTC+7)`,
      description: abstract || 'No abstract description provided.',
      inviteCount: invitees.length,
      avatars: invitees.slice(0, 4).map((x) => x.slice(0, 2).toUpperCase()),
      meetLink: 'https://meet.google.com/abc-defg-hij',
    };

    setSeminars([newSeminar, ...seminars]);
    setShowCreateModal(false);
    setIsSuccess(true);
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

              {/* Google Meet Box */}
              <div className={styles.meetBox}>
                <span className={styles.meetIcon}>📹</span>
                <a href={sem.meetLink} className={sem.meetLinkText} target="_blank" rel="noopener noreferrer">
                  {sem.meetLink} ↗
                </a>
              </div>

              {/* Completed Feedback Bar */}
              {sem.status === 'COMPLETED' && sem.feedbackSubmitted && sem.feedbackTotal && (
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
                {sem.status === 'COMPLETED' ? (
                  <button className={styles.feedbackGradingBtn}>
                    📋 Form Feedback & Grading <span className={styles.gradingBadge}>{sem.feedbackSubmitted}/{sem.feedbackTotal} Submitted</span>
                  </button>
                ) : (
                  <button className={styles.feedbackDisabledBtn} disabled>
                    Form Feedback (Available after completion)
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE SEMINAR MODAL FORM */}
      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.configCard} style={{ maxWidth: '640px', padding: '30px' }}>
            <div className={styles.modalHeaderRow}>
              <div>
                <h2 className={styles.cardTitle}>SEMINAR CONFIGURATION PANEL</h2>
                <p className={styles.cardSubtitle}>Complete all required fields to provision a scheduled seminar event.</p>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            <form className={styles.form} onSubmit={handleCreateSeminar}>
              {/* Topic Title */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* SEMINAR TOPIC TITLE</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={topicTitle}
                  onChange={(e) => setTopicTitle(e.target.value)}
                  placeholder="e.g. Distributed Ledger Implementations in Modern Cloud Architectures"
                  required
                />
              </div>

              {/* Abstract Overview */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* ABSTRACT OVERVIEW</label>
                <textarea
                  className={styles.formTextarea}
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  placeholder="Describe the seminar topic details, research focus, and outline of the academic study..."
                  rows={4}
                  required
                />
              </div>

              {/* Date Row */}
              <div className={styles.rowFormGroup}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.formLabel}>* START DATE-TIME</label>
                  <input
                    type="datetime-local"
                    className={styles.formDateInput}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.formLabel}>* END DATE-TIME</label>
                  <input
                    type="datetime-local"
                    className={styles.formDateInput}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Invite participants */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* INVITE PARTICIPANTS</label>
                <div className={styles.multiSelectInputWrapper}>
                  <div className={styles.tagsContainer}>
                    {invitees.map((item) => (
                      <span key={item} className={styles.inviteeTag}>
                        {item}
                        <button
                          type="button"
                          className={styles.removeTagBtn}
                          onClick={() => handleRemoveInvitee(item)}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    className={styles.multiSelectInput}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={handleAddInvitee}
                    placeholder={invitees.length === 0 ? "Type and press Enter..." : ""}
                  />
                </div>
              </div>

              {/* Footer buttons */}
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Create Seminar Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {isSuccess && (
        <div className={styles.modalOverlay}>
          <div className={styles.successModalCard}>
            <div className={styles.successIconCircle}>✓</div>
            <h3 className={styles.successModalTitle}>Seminar Event Scheduled!</h3>
            <p className={styles.successModalText}>
              The seminar "<b>{topicTitle}</b>" has been successfully provisioned. Invitations have been dispatched to all selected students and research cohorts.
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

export default SeminarWorkspace;
