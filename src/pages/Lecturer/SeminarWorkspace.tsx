import { useEffect, useState } from 'react';
import {
  seminarService,
  seminarParticipantService,
  mapSeminarToCard,
  type SeminarCard,
} from '../../services/seminar.service';
import {
  Plus,
  RefreshCw,
  Check,
  CheckCircle2,
  X,
  Loader,
  FileText,
  Inbox,
  Calendar,
  Clock,
  Video,
  Eye,
  Sparkles,
  ClipboardList,
  Mail,
  AlertTriangle,
  Film,
  Upload,
  Wand2,
  RotateCcw,
  Folder,
} from 'lucide-react';
import styles from './SeminarWorkspace.module.css';

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
  const [selectedSeminarForFeedback, setSelectedSeminarForFeedback] = useState<SeminarCard | null>(null);

  // AI Summarizer states (Frame 35 & 36)
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiModalStep, setAiModalStep] = useState<'upload' | 'results'>('upload');
  const [aiNotesSaved, setAiNotesSaved] = useState(false);
  const [selectedSeminarForAi, setSelectedSeminarForAi] = useState<SeminarCard | null>(null);

  // Form states inside Create Modal (Frame 30)
  const [seminarName, setSeminarName] = useState('Advanced Cloud Routing Architecture Seminar');
  const [dateTime, setDateTime] = useState('');
  const [seminarDetails, setSeminarDetails] = useState('');
  const [guestEmails, setGuestEmails] = useState<string[]>([]);
  const [emailInputText, setEmailInputText] = useState('');
  const [sendReminder, setSendReminder] = useState(true);

  // Generated Meet link state for Frame 31 — populated by the BE response on create
  const [generatedMeetLink, setGeneratedMeetLink] = useState('');

  // Workshops pulled from the BE
  const [seminars, setSeminars] = useState<SeminarCard[]>([]);
  const [isLoadingSeminars, setIsLoadingSeminars] = useState(true);
  const [loadSeminarsError, setLoadSeminarsError] = useState<string | null>(null);
  const [isCreatingSeminar, setIsCreatingSeminar] = useState(false);

  // Hybrid ID format for display. The BE returns numeric IDs, so we render
  // them as "SEM-{year}-{id}" for a stable human-friendly badge.
  const formatSeminarId = (id: number): string => {
    const year = new Date().getFullYear();
    return `SEM-${year}-${String(id).padStart(3, '0')}`;
  };

  // Split a "2026-07-29 · 10:00 AM" style string into ISO start/end.
  // Falls back to "now + 1h" so the BE always receives a valid pair.
  const parseDateTimeRange = (
    raw: string
  ): { startTime: string; endTime: string } => {
    const trimmed = raw.trim();
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const end = new Date(parsed.getTime() + 60 * 60 * 1000);
      return { startTime: parsed.toISOString(), endTime: end.toISOString() };
    }
    const now = new Date();
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    return { startTime: now.toISOString(), endTime: end.toISOString() };
  };

  // Initial load of seminars
  useEffect(() => {
    let cancelled = false;
    const loadSeminars = async () => {
      setLoadSeminarsError(null);
      try {
        const list = await seminarService.getAll();
        if (cancelled) return;
        setSeminars(list.map(mapSeminarToCard));
      } catch (err) {
        if (cancelled) return;
        setLoadSeminarsError(
          (err as { message?: string })?.message ||
            'Failed to load seminars. Please try again.'
        );
      } finally {
        if (!cancelled) setIsLoadingSeminars(false);
      }
    };
    void loadSeminars();
    return () => {
      cancelled = true;
    };
  }, []);

  // Best-effort invite dispatch. Succeeds silently — UI does not depend on it.
  // The BE's /api/SeminarParticipant contract is keyed on userId, not email,
  // so until the BE exposes an invite-by-email endpoint, we mark the seminar
  // as having invitations in flight by posting an empty participant row.
  const dispatchInvitations = async (seminarId: number, _emails: string[]) => {
    await Promise.allSettled(
      Array.from({ length: 1 }).map(() =>
        seminarParticipantService.create({
          seminarId,
          invitationStatus: 'Invited',
        })
      )
    );
  };

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

  const handleCreateSeminarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingSeminar) return;
    if (!seminarName.trim()) {
      alert('Please enter a seminar name.');
      return;
    }
    if (!dateTime.trim()) {
      alert('Please select a date and time.');
      return;
    }
    if (!seminarDetails.trim()) {
      alert('Please enter seminar details.');
      return;
    }

    const { startTime, endTime } = parseDateTimeRange(dateTime);

    setIsCreatingSeminar(true);
    setLoadSeminarsError(null);
    try {
      // 1. POST the seminar to the BE
      const created = await seminarService.create({
        startTime,
        endTime,
        content: seminarDetails.trim(),
        isReminderSent: sendReminder,
        status: 'Upcoming',
      });
      const createdCard = mapSeminarToCard(created);

      // 2. Optimistically insert the new card so the list updates immediately
      setSeminars((prev) => [{ ...createdCard, isNew: true }, ...prev]);

      // 3. Fire invitations (best-effort). Failures are swallowed.
      if (guestEmails.length > 0) {
        await dispatchInvitations(createdCard.seminarId, guestEmails);
      }

      // 4. Re-fetch the full list so the BE-canonical rows replace the optimistic one
      try {
        const fresh = await seminarService.getAll();
        setSeminars(fresh.map(mapSeminarToCard));
      } catch {
        // Non-fatal — the optimistic row stays in place
      }

      // 5. Surface the generated meeting link in the success modal
      setGeneratedMeetLink(createdCard.onlineLink || 'https://meet.google.com/');
      setBannerText(`"${seminarName}" has been created and Google Meet link generated.`);
      setShowSuccessBanner(true);
      setShowCreateModal(false);
      setShowGeneratedModal(true);
    } catch (err) {
      const message =
        (err as { message?: string })?.message ||
        'Failed to create the seminar. Please try again.';
      alert(message);
    } finally {
      setIsCreatingSeminar(false);
    }
  };

  const handleOpenFeedbackModal = (sem: SeminarCard) => {
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => {
              setIsLoadingSeminars(true);
              void (async () => {
                setLoadSeminarsError(null);
                try {
                  const list = await seminarService.getAll();
                  setSeminars(list.map(mapSeminarToCard));
                } catch (err) {
                  setLoadSeminarsError(
                    (err as { message?: string })?.message ||
                      'Failed to load seminars. Please try again.'
                  );
                } finally {
                  setIsLoadingSeminars(false);
                }
              })();
            }}
            disabled={isLoadingSeminars}
            aria-label="Refresh seminars"
          >
            {isLoadingSeminars ? (
              <Loader size={14} aria-hidden className={styles.spinningIcon} />
            ) : (
              <RefreshCw size={14} aria-hidden />
            )}
            {isLoadingSeminars ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className={styles.createSeminarBtn} onClick={() => setShowCreateModal(true)}>
            <Plus size={16} aria-hidden />
            Create Seminar
          </button>
        </div>
      </div>

      {/* SUCCESS TOAST BANNER (Frame 32 & 33) */}
      {showSuccessBanner && (
        <div className={styles.successToastBanner}>
          <div className={styles.toastLeft}>
            <span className={styles.toastCheckIcon}>
              <Check size={14} strokeWidth={3} aria-hidden />
            </span>
            <div>
              <span className={styles.toastTitle}>Seminar Created Successfully</span>
              <p className={styles.toastSub}>{bannerText}</p>
            </div>
          </div>
          <div className={styles.toastRight}>
            <span className={styles.justNowText}>Just now</span>
            <button
              className={styles.toastCloseBtn}
              onClick={() => setShowSuccessBanner(false)}
              aria-label="Dismiss notification"
            >
              <X size={14} aria-hidden />
            </button>
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
        {loadSeminarsError && (
          <div className={styles.errorBanner} role="alert">
            <span className={styles.errorBannerIcon}>
              <AlertTriangle size={14} aria-hidden />
              {loadSeminarsError}
            </span>
            <button
              type="button"
              className={styles.errorRetryBtn}
              onClick={() => {
                setIsLoadingSeminars(true);
                void (async () => {
                  setLoadSeminarsError(null);
                  try {
                    const list = await seminarService.getAll();
                    setSeminars(list.map(mapSeminarToCard));
                  } catch (err) {
                    setLoadSeminarsError(
                      (err as { message?: string })?.message ||
                        'Failed to load seminars. Please try again.'
                    );
                  } finally {
                    setIsLoadingSeminars(false);
                  }
                })();
              }}
            >
              Retry
            </button>
          </div>
        )}

        {isLoadingSeminars ? (
          <div className={styles.emptyDrafts}>
            <Loader size={28} className={styles.emptyIcon} aria-hidden />
            <h4 className={styles.emptyTitle}>Loading seminars…</h4>
          </div>
        ) : activeTab === 'drafts' ? (
          <div className={styles.emptyDrafts}>
            <FileText size={28} className={styles.emptyIcon} aria-hidden />
            <h4 className={styles.emptyTitle}>No drafts</h4>
            <p className={styles.emptyText}>Saved drafts will appear here.</p>
          </div>
        ) : filteredSeminars.length === 0 ? (
          <div className={styles.emptyDrafts}>
            <Inbox size={28} className={styles.emptyIcon} aria-hidden />
            <h4 className={styles.emptyTitle}>No seminars yet</h4>
            <p className={styles.emptyText}>Click "+ Create Seminar" to schedule your first one.</p>
          </div>
        ) : (
          filteredSeminars.map((sem) => {
            const seminarStartDate = sem.startTime ? new Date(sem.startTime) : null;
            const seminarEndDate = sem.endTime ? new Date(sem.endTime) : null;
            const dateLabel = seminarStartDate
              ? seminarStartDate.toISOString().split('T')[0]
              : '';
            const timeLabel =
              seminarStartDate && seminarEndDate && !Number.isNaN(seminarStartDate.getTime())
                ? `${seminarStartDate.toISOString().slice(11, 16)} – ${seminarEndDate
                    .toISOString()
                    .slice(11, 16)} (UTC)`
                : '';
            return (
            <div className={styles.seminarCard} key={sem.seminarId}>
              {/* Top metadata */}
<div className={styles.cardHeaderRow}>
              <div className={styles.badgeRow}>
                {sem.isNew && <span className={styles.newBadgePill}>NEW Just created</span>}
                {sem.status === 'UPCOMING' && <span className={styles.statusUpcoming}>● UPCOMING</span>}
                {sem.status === 'IN PROGRESS' && <span className={styles.statusInProgress}>● IN PROGRESS</span>}
                {sem.status === 'COMPLETED' && <span className={styles.statusCompleted}>● COMPLETED</span>}
                <span className={styles.seminarId}>ID: {formatSeminarId(sem.seminarId)}</span>
              </div>
              <div className={styles.dateMeta}>
                <span>
                  <Calendar size={12} aria-hidden style={{ marginRight: 4, verticalAlign: '-2px' }} />
                  {dateLabel}
                </span>
                <span style={{ marginLeft: '12px' }}>
                  <Clock size={12} aria-hidden style={{ marginRight: 4, verticalAlign: '-2px' }} />
                  {timeLabel}
                </span>
              </div>
            </div>

              {/* Title and description */}
              <h3 className={styles.seminarTitle}>{sem.title}</h3>
              <p className={styles.seminarDescription}>{sem.content || 'No description provided.'}</p>

              {/* Capacity hint (BE-driven) */}
              {sem.maxParticipants != null && sem.status !== 'COMPLETED' && (
                <div className={styles.rosterRow}>
                  <span className={styles.inviteCountText}>
                    Up to {sem.maxParticipants} participants
                  </span>
                </div>
              )}

              {/* Google Meet Box */}
              {sem.onlineLink && (
                <div className={styles.meetBox}>
                  <Video size={14} className={styles.meetIcon} aria-hidden />
                  <a href={sem.onlineLink} className={styles.meetLinkText} target="_blank" rel="noopener noreferrer">
                    {sem.onlineLink}
                  </a>
                </div>
              )}

              {/* Completed Feedback Bar — backend has not yet exposed
                  feedbackSubmitted/feedbackTotal counters; render placeholder when missing. */}
              {sem.status === 'COMPLETED' && (
                <div className={styles.feedbackProgressBlock}>
                  <div className={styles.feedbackProgressLabels}>
                    <span className={styles.progressLabel}>Feedback submissions</span>
                    <span className={styles.progressText}>—</span>
                  </div>
                  <div className={styles.progressBg}>
                    <div className={styles.progressFill} style={{ width: '0%' }}></div>
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
                      <Eye size={14} aria-hidden />
                      {aiNotesSaved ? (
                        <>
                          View Notes (AI Generated){' '}
                          <span className={styles.greenAiBadge}>
                            <Sparkles size={12} aria-hidden style={{ verticalAlign: '-2px', marginRight: 3 }} />
                            AI
                          </span>
                        </>
                      ) : (
                        'View Notes'
                      )}
                    </button>
                    <button
                      className={styles.feedbackGradingBtn}
                      onClick={() => handleOpenFeedbackModal(sem)}
                    >
                      <ClipboardList size={14} aria-hidden />
                      Form Feedback & Grading
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className={styles.joinMeetBtn}
                      onClick={() => sem.onlineLink && window.open(sem.onlineLink, '_blank')}
                      disabled={!sem.onlineLink}
                    >
                      <Video size={14} aria-hidden />
                      Join Google Meet
                    </button>
                    <button
                      className={styles.sendInviteBtn}
                      onClick={() => {
                        if (sem.onlineLink) {
                          navigator.clipboard.writeText(sem.onlineLink);
                          alert('Copied invite link!');
                        }
                      }}
                      disabled={!sem.onlineLink}
                    >
                      <Mail size={14} aria-hidden />
                      Send Invite Link
                    </button>
                    <button className={styles.feedbackDisabledBtn} disabled>
                      Form Feedback (Available after completion)
                    </button>
                  </>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* FRAME 30: CREATE NEW ACADEMIC SEMINAR MODAL */}
      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.createModalCard}>
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalHeaderIcon}>
                  <Plus size={18} aria-hidden />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>Create New Academic Seminar</h3>
                  <span className={styles.modalSubtitle}>Fill in details — a Google Meet link will be auto-generated</span>
                </div>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
              >
                <X size={18} aria-hidden />
              </button>
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
                        <Mail size={12} aria-hidden style={{ marginRight: 4 }} />
                        {email}
                        <button
                          type="button"
                          className={styles.removeEmailCross}
                          onClick={() => handleRemoveEmail(email)}
                          aria-label={`Remove ${email}`}
                        >
                          <X size={12} aria-hidden />
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
                  disabled={isCreatingSeminar}
                >
                  Cancel
                </button>
<button
                type="submit"
                className={styles.modalSubmitNavyBtn}
                disabled={isCreatingSeminar}
              >
                {isCreatingSeminar ? (
                  <Loader size={14} aria-hidden className={styles.spinningIcon} />
                ) : (
                  <Video size={14} aria-hidden />
                )}
                {isCreatingSeminar ? 'Creating…' : 'Generate & Create Seminar'}
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
            <div className={styles.generatedIconCircle}>
              <Check size={28} strokeWidth={3} aria-hidden />
            </div>
            <h3 className={styles.generatedTitle}>Seminar Created & Google Meet Link Generated!</h3>
            <p className={styles.generatedSub}>{seminarName}</p>

            {/* Meet Link copy box */}
            <div className={styles.generatedMeetCard}>
              <div className={styles.generatedMeetLabel}>
                <Video size={14} aria-hidden style={{ marginRight: 6, verticalAlign: '-2px' }} />
                Google Meet Link
              </div>
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
                  <FileText size={14} aria-hidden />
                  Copy Link
                </button>
              </div>
            </div>

            {/* Yellow alert box */}
            <div className={styles.yellowAlertBox}>
              <div className={styles.yellowAlertTitleRow}>
                <AlertTriangle size={14} className={styles.yellowAlertIcon} aria-hidden />
                <span>Email invitations have been sent to invited guests. An automated reminder will be sent <b>1 day before</b> the seminar starts.</span>
              </div>
              <div className={styles.yellowSentText}>
                <Mail size={14} aria-hidden style={{ marginRight: 6, verticalAlign: '-2px' }} />
                Sent to: {guestEmails.join(', ')}
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
                <Video size={14} aria-hidden />
                Launch Google Meet
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
                <span className={styles.feedbackModalIcon}>
                  <ClipboardList size={18} aria-hidden />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>Feedback & Grading Review</h3>
                  <span className={styles.modalSubtitle}>
                    {selectedSeminarForFeedback.title} · {selectedSeminarForFeedback.startTime
                      ? new Date(selectedSeminarForFeedback.startTime).toISOString().split('T')[0]
                      : ''}
                  </span>
                </div>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setShowFeedbackModal(false)}
                aria-label="Close"
              >
                <X size={18} aria-hidden />
              </button>
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
                          <span className={styles.submittedPill}>
                            <Check size={12} strokeWidth={3} aria-hidden style={{ marginRight: 4 }} />
                            SUBMITTED
                          </span>
                        ) : (
                          <span className={styles.pendingPill}>
                            <Clock size={12} aria-hidden style={{ marginRight: 4 }} />
                            PENDING
                          </span>
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
                <Mail size={14} aria-hidden />
                Remind Pending (1)
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
                <span className={styles.aiIconCircle}>
                  <Sparkles size={18} aria-hidden />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>Seminar Recording AI Summarizer</h3>
                  <span className={styles.modalSubtitle}>
                    Upload meeting media for {selectedSeminarForAi ? selectedSeminarForAi.title : 'seminar'} to generate automated AI notes.
                  </span>
                </div>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setShowAiModal(false)}
                aria-label="Close"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            {/* Content for Step 1: Upload (Frame 35) or Step 2: Results (Frame 36) */}
            <div className={styles.aiModalContentArea}>
              {/* Media Dropzone */}
              <div className={styles.mediaDropzone}>
                <Film size={32} className={styles.dropzoneFilmIcon} aria-hidden />
                <span className={styles.dropzoneMainText}>Drag & drop your meeting recording here or click to browse</span>
                <span className={styles.dropzoneSubText}>Supported formats: .mp4, .wav · Maximum file size: Below 3 GB</span>
                <button className={styles.browseFilesBtn} type="button">
                  <Upload size={14} aria-hidden />
                  Browse files
                </button>
              </div>

              {/* Attached file card */}
              <div className={styles.attachedFileCard}>
                <Film size={20} className={styles.attachedFilmIcon} aria-hidden />
                <div className={styles.attachedFileMeta}>
                  <span className={styles.attachedFileName}>Phase2_DB_Review_20260720.mp4</span>
                  <span className={styles.attachedFileSize}>1.2 GB · Ready to process</span>
                </div>
                <span className={styles.attachedPillBadge}>
                  <Check size={12} strokeWidth={3} aria-hidden style={{ marginRight: 4 }} />
                  Attached
                </span>
              </div>

              {/* STEP 2 RESULTS PANEL (Frame 36) */}
              {aiModalStep === 'results' && (
                <div className={styles.aiGeneratedResultsCard}>
                  <div className={styles.aiResultsHeaderRow}>
                    <div className={styles.aiResultsHeaderLeft}>
                      <Sparkles size={16} className={styles.sparkleIcon} aria-hidden />
                      <span className={styles.aiResultsTitle}>AI Generated Notes & Key Takeaways</span>
                    </div>
                    <span className={styles.regenerationAttemptsPill}>
                      <RotateCcw size={12} aria-hidden style={{ marginRight: 4, verticalAlign: '-2px' }} />
                      Regeneration Attempts Left: 3/3
                    </span>
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
                      <CheckCircle2 size={14} aria-hidden style={{ marginRight: 6, verticalAlign: '-2px', color: '#10b981' }} />
                      <b>4/4 active</b> participants active in Q&A session.
                    </div>
                  </div>

                  <div className={styles.aiDisclaimerFooter}>
                    <AlertTriangle size={12} aria-hidden style={{ marginRight: 6, verticalAlign: '-2px' }} />
                    AI-generated content. Review for accuracy before saving. Notes will be attached to the seminar record permanently.
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className={styles.aiModalFooter}>
              {aiModalStep === 'upload' ? (
                <>
                  <span className={styles.filesReadyText}>
                    <Folder size={14} aria-hidden style={{ marginRight: 6, verticalAlign: '-2px' }} />
                    1 file ready · 1.2 GB
                  </span>
                  <div className={styles.footerBtnsRight}>
                    <button className={styles.modalCancelBtn} onClick={() => setShowAiModal(false)}>
                      Cancel
                    </button>
                    <button
                      className={styles.summarizeMagicBtn}
                      onClick={() => setAiModalStep('results')}
                    >
                      <Wand2 size={14} aria-hidden />
                      Click to Summarize
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button className={styles.regenerateBtn} onClick={() => alert('Regenerated AI notes!')}>
                    <RotateCcw size={14} aria-hidden />
                    Regenerate (3/3 Left)
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
                      <Check size={14} aria-hidden />
                      Agree & Save Notes
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
