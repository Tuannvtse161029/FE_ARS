import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  RefreshCw,
  Check,
  X,
  Loader,
  FileText,
  Inbox,
  Calendar,
  Clock,
  Video,
  Eye,
  ClipboardList,
  Mail,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import {
  deriveEffectiveStatus,
  isValidMeetLink,
  ownsSeminar,
  type SeminarCard,
} from '../../services/seminar.service';
import {
  useSeminars,
  useCreateSeminar,
  useSendReminder,
  useSeminarParticipants,
  useSeminarRoleContext,
} from '../../hooks/useSeminar';
import { AudioSummaryModal } from '../../components/seminar/AudioSummaryModal';
import { SeminarFeedbackModal } from '../../components/seminar/SeminarFeedbackModal';
import styles from './SeminarWorkspace.module.css';

export const SeminarWorkspace = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'completed' | 'drafts'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGeneratedModal, setShowGeneratedModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showAttendeeFeedbackModal, setShowAttendeeFeedbackModal] = useState(false);
  const [selectedSeminarForAttendeeFeedback, setSelectedSeminarForAttendeeFeedback] = useState<SeminarCard | null>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [bannerText, setBannerText] = useState('');
  const [selectedSeminarForFeedback, setSelectedSeminarForFeedback] = useState<SeminarCard | null>(null);

  // AI Summary integration point — Agent 23 wires the actual modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [selectedSeminarForAi, setSelectedSeminarForAi] = useState<SeminarCard | null>(null);

  // Form states inside Create Modal
  const [seminarName, setSeminarName] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [seminarDetails, setSeminarDetails] = useState('');
  const [guestEmails, setGuestEmails] = useState<string[]>([]);
  const [emailInputText, setEmailInputText] = useState('');
  const [sendReminder, setSendReminder] = useState(true);

  // Google Meet link from BE on create
  const [generatedMeetLink, setGeneratedMeetLink] = useState('');

  // ── Seminar data via hooks ───────────────────────────────────────────────────
  const { seminars, isLoading: isLoadingSeminars, error: loadSeminarsError, refetch, backendAvailability } =
    useSeminars();

  // ── Role context (preserves Lecturer-only writes; surfaces read-only caps) ───
  // `canModify` gates every write affordance below. Researchers, Reviewers and
  // Graduate Students that ever reach this page (the current App.tsx guard
  // is Lecturer+ Graduate Student) see a read-only surface — the BE is still
  // the authority on authorization. See `ownsSeminar()` for the per-row
  // ownership predicate used by the Feedback & Grading modal.
  //
  // `backendAvailability` reports whether the live role-scoped read contract
  // is available. The hook never uses global participant rows for viewers.
  const {
    currentRole,
    currentUserId,
    canModify,
  } = useSeminarRoleContext();

  // ── Create seminar ────────────────────────────────────────────────────────────
  const handleCreateSuccess = useCallback(
    (created: { seminarId: number; onlineLink?: string | null }) => {
      setGeneratedMeetLink(created.onlineLink ?? '');
      setBannerText(`"${seminarName || 'Seminar'}" has been created.`);
      setShowSuccessBanner(true);
      setShowCreateModal(false);
      setShowGeneratedModal(true);
    },
    [seminarName]
  );

  const { createSeminar, isCreating: isCreatingSeminar } = useCreateSeminar(
    handleCreateSuccess,
    refetch
  );

  // ── Send reminder ────────────────────────────────────────────────────────────
  const { sendReminder: doSendReminder, isSending: isSendingReminder } =
    useSendReminder(undefined, refetch);

  // Double-click guard — prevents racing calls from rapid button presses
  const reminderInFlightRef = useRef(false);

  // ── Participants for feedback modal ──────────────────────────────────────────
  const { participants: allParticipants, isLoading: isLoadingParticipants } =
    useSeminarParticipants(selectedSeminarForFeedback?.seminarId);

  // Hybrid ID format for display
  const formatSeminarId = (id: number): string => {
    const year = new Date().getFullYear();
    return `SEM-${year}-${String(id).padStart(3, '0')}`;
  };

  // Parse a display date-time string into ISO start/end (1-hour default).
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

  const seminarCounts = useMemo(() => seminars.reduce((counts, seminar) => {
    const effective = deriveEffectiveStatus(seminar.status, seminar.endTime);
    counts.upcoming += effective === 'UPCOMING' || effective === 'IN PROGRESS' ? 1 : 0;
    counts.completed += effective === 'COMPLETED' ? 1 : 0;
    return counts;
  }, { upcoming: 0, completed: 0 }), [seminars]);

  // Tab filtering — uses effectiveStatus so past-endTime seminars appear in "Completed"
  const filteredSeminars = useMemo(() => seminars.filter((sem) => {
    const effective = deriveEffectiveStatus(sem.status, sem.endTime);
    if (activeTab === 'upcoming') {
      return effective === 'UPCOMING' || effective === 'IN PROGRESS';
    }
    if (activeTab === 'completed') {
      return effective === 'COMPLETED';
    }
    if (activeTab === 'drafts') {
      return effective === 'DRAFT';
    }
    return true;
  }), [activeTab, seminars]);

  const minDateTime = useMemo(() => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16), []);
  const announce = useCallback((message: string) => {
    setBannerText(message);
    setShowSuccessBanner(true);
  }, []);

  // Email invite helpers
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

  // Create submit
  const handleCreateSeminarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModify) {
      announce('Chỉ Giảng viên (Lecturer) mới có quyền tạo Seminar.');
      return;
    }
    if (!seminarName.trim()) { announce('Please enter a seminar name.'); return; }
    if (!dateTime.trim())   { announce('Please select a date and time.'); return; }
    if (!seminarDetails.trim()) { announce('Please enter seminar details.'); return; }

    // Enforce at least 1-hour-in-advance rule (belt-and-suspenders over the min attribute).
    const minTime = new Date(Date.now() + 60 * 60 * 1000);
    if (new Date(dateTime) < minTime) {
      announce('Seminars must be scheduled at least 1 hour in advance.');
      return;
    }

    const { startTime, endTime } = parseDateTimeRange(dateTime);
    const fullContent = seminarName.trim()
      ? `[${seminarName.trim()}] ${seminarDetails.trim()}`
      : seminarDetails.trim();

    await createSeminar({
      startTime,
      endTime,
      content: fullContent,
      guestEmails: guestEmails.length > 0 ? guestEmails : undefined,
      isReminderSent: sendReminder,
      status: 'Upcoming',
    });
  };

  // Feedback modal
  const handleOpenFeedbackModal = (sem: SeminarCard) => {
    setSelectedSeminarForFeedback(sem);
    setShowFeedbackModal(true);
  };

  // Reminder — calls the real API hook with double-click guard
  const handleRemindPending = async (seminarId: number) => {
    if (reminderInFlightRef.current) return;
    reminderInFlightRef.current = true;
    try {
      await doSendReminder(seminarId);
      announce('Reminder sent successfully.');
    } catch {
      announce('Failed to send reminder. Please try again.');
    } finally {
      reminderInFlightRef.current = false;
    }
  };

  // AI Summary integration point — Agent 23 wires the actual modal
  const handleOpenAiSummary = useCallback((sem: SeminarCard) => {
    setSelectedSeminarForAi(sem);
    setShowAiModal(true);
  }, []);

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
            {canModify
              ? 'Manage your scheduled seminars, share resources, and collect feedback.'
              : 'Browse upcoming and completed seminars you have been invited to.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => { void refetch(); }}
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
          {canModify && (
            <button className={styles.createSeminarBtn} onClick={() => setShowCreateModal(true)}>
              <Plus size={16} aria-hidden />
              Create Seminar
            </button>
          )}
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
          Upcoming ({seminarCounts.upcoming})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'completed' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed ({seminarCounts.completed})
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

      {/* The hook uses organizer-scoped reads for Lecturers and the live
          participant-scoped reads for other route-guarded business roles. */}
      {backendAvailability !== 'full' && (
        <div className={styles.backendAvailabilityBanner} role="status" aria-live="polite">
          <span className={styles.backendAvailabilityIcon}>
            <Lock size={14} aria-hidden />
          </span>
          <div className={styles.backendAvailabilityBody}>
            <span className={styles.backendAvailabilityTitle}>
              Seminar list unavailable for your role
            </span>
            <p className={styles.backendAvailabilityText}>
              The seminar list is currently only available to the seminar organizer
              (Lecturer role). Showing the BE-wide seminar and participant rows to a
              Researcher, Reviewer, or Graduate Student would expose every
              participant's name and email across the platform, which this build
              refuses to do. The platform team has logged this as a backend gap
              (see <code>docs/PUBLICATION_FLOW_API_BLOCKERS.md §3.8</code>). Once
              the BE ships a participant-scoped read, this surface will populate
              automatically — no code change is required on your end.
            </p>
          </div>
        </div>
      )}

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
              onClick={() => { void refetch(); }}
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
        ) : backendAvailability !== 'full' ? (
          <div className={styles.emptyDrafts}>
            <Lock size={28} className={styles.emptyIcon} aria-hidden />
            <h4 className={styles.emptyTitle}>Seminars are temporarily unavailable</h4>
            <p className={styles.emptyText}>
              The backend did not provide a readable seminar list for this session.
            </p>
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
            <p className={styles.emptyText}>
              {canModify
                ? 'Click "+ Create Seminar" to schedule your first one.'
                : 'No seminars scheduled or invited at this time.'}
            </p>
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

              {/* Google Meet Box — only shown when BE returns a valid HTTPS Google Meet URL */}
              {isValidMeetLink(sem.onlineLink) && (
                <div className={styles.meetBox}>
                  <Video size={14} className={styles.meetIcon} aria-hidden />
                  <a href={sem.onlineLink} className={styles.meetLinkText} target="_blank" rel="noopener noreferrer">
                    {sem.onlineLink}
                  </a>
                </div>
              )}

              {/* Feedback progress bar — real counts from participant list */}
              {sem.status === 'COMPLETED' && (
                <div className={styles.feedbackProgressBlock}>
                  <div className={styles.feedbackProgressLabels}>
                    <span className={styles.progressLabel}>Feedback submissions</span>
                    <span className={styles.progressText}>
                      {sem.feedbackSubmitted}/{sem.feedbackTotal}
                    </span>
                  </div>
                  <div className={styles.progressBg}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width:
                          sem.feedbackTotal > 0
                            ? `${(sem.feedbackSubmitted / sem.feedbackTotal) * 100}%`
                            : '0%',
                      }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Card Actions */}
              <div className={styles.cardActionsRow}>
                {(sem.effectiveStatus === 'COMPLETED' || sem.status === 'COMPLETED') ? (
                  <>
                    {canModify && ownsSeminar(sem, currentUserId, currentRole) && (
                      <button
                        className={styles.viewNotesBtn}
                        onClick={() => handleOpenAiSummary(sem)}
                      >
                        <Eye size={14} aria-hidden />
                        View Notes
                      </button>
                    )}
                    {canModify && ownsSeminar(sem, currentUserId, currentRole) ? (
                      <button
                        className={styles.feedbackGradingBtn}
                        onClick={() => handleOpenFeedbackModal(sem)}
                      >
                        <ClipboardList size={14} aria-hidden />
                        Form Feedback & Grading
                      </button>
                    ) : (
                      <button
                        className={styles.feedbackGradingBtn}
                        onClick={() => {
                          setSelectedSeminarForAttendeeFeedback(sem);
                          setShowAttendeeFeedbackModal(true);
                        }}
                      >
                        <ClipboardList size={14} aria-hidden />
                        Gửi Form Feedback
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      className={styles.joinMeetBtn}
                      onClick={() => window.open(sem.onlineLink, '_blank')}
                      disabled={!isValidMeetLink(sem.onlineLink)}
                    >
                      <Video size={14} aria-hidden />
                      Join Google Meet
                    </button>
                    {canModify && ownsSeminar(sem, currentUserId, currentRole) && (
                      <button
                        className={styles.sendInviteBtn}
                        onClick={() => {
                          navigator.clipboard.writeText(sem.onlineLink);
                          announce('Invite link copied.');
                        }}
                        disabled={!isValidMeetLink(sem.onlineLink)}
                      >
                        <Mail size={14} aria-hidden />
                        Send Invite Link
                      </button>
                    )}
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
                  type="datetime-local"
                  className={styles.formInput}
                  value={dateTime ? new Date(dateTime).toISOString().slice(0, 16) : ''}
                  min={minDateTime}
                  onChange={(e) => {
                    const localValue = e.target.value; // "2026-07-29T10:00"
                    if (!localValue) { setDateTime(''); return; }
                    // Convert local time to an ISO string so the API and parseDateTimeRange stay compatible.
                    setDateTime(new Date(localValue).toISOString());
                  }}
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
                    announce('Google Meet link copied.');
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

            {/* Stats Metrics Bar — computed from real participant list */}
            <div className={styles.feedbackStatsGrid}>
              <div className={styles.statBlock}>
                <span className={styles.statLabel}>Total Invited</span>
                <span className={styles.statVal}>{allParticipants.length}</span>
              </div>
              <div className={styles.statBlock}>
                <span className={styles.statLabel}>Submitted</span>
                <span className={styles.statVal}>
                  {allParticipants.filter((p) => p.invitationStatus?.toLowerCase() === 'submitted').length}
                </span>
              </div>
              <div className={styles.statBlock}>
                <span className={styles.statLabel}>Pending</span>
                <span className={styles.statVal}>
                  {allParticipants.filter((p) => p.invitationStatus?.toLowerCase() !== 'submitted').length}
                </span>
              </div>
              <div className={styles.statBlock}>
                <span className={styles.statLabel}>Avg. Score</span>
                <span className={styles.statVal}>—</span>
              </div>
              <div className={styles.statBlockCompletion}>
                <div className={styles.completionHeaderRow}>
                  <span className={styles.statLabel}>Completion</span>
                  <span className={styles.completionPercent}>
                    {allParticipants.length > 0
                      ? `${Math.round(
                          (allParticipants.filter(
                            (p) => p.invitationStatus?.toLowerCase() === 'submitted'
                          ).length /
                            allParticipants.length) *
                            100
                        )}%`
                      : '—'}
                  </span>
                </div>
                <div className={styles.completionBarBg}>
                  <div
                    className={styles.completionBarFill}
                    style={{
                      width:
                        allParticipants.length > 0
                          ? `${
                              (allParticipants.filter(
                                (p) => p.invitationStatus?.toLowerCase() === 'submitted'
                              ).length /
                                allParticipants.length) *
                              100
                            }%`
                          : '0%',
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Participant Table — real API data */}
            <div className={styles.studentGradesTableWrapper}>
              {isLoadingParticipants ? (
                <div className={styles.emptyDrafts}>
                  <Loader size={20} className={styles.emptyIcon} aria-hidden />
                  <span>Loading participants…</span>
                </div>
              ) : allParticipants.length === 0 ? (
                <div className={styles.emptyDrafts}>
                  <Inbox size={20} className={styles.emptyIcon} aria-hidden />
                  <span>No participants invited yet.</span>
                </div>
              ) : (
                <table className={styles.studentGradesTable}>
                  <thead>
                    <tr>
                      <th>STUDENT</th>
                      <th>STATUS</th>
                      <th>EVALUATION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allParticipants.map((p) => (
                      <tr key={p.seminarParticipantId ?? p.userId}>
                        <td>
                          <div className={styles.studentCellBlock}>
                            <span className={styles.studentAvatarMini}>
                              {(p.userFullName ?? p.userEmail ?? '??')
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                            <div>
                              <span className={styles.studentNameText}>
                                {p.userFullName ?? p.userEmail ?? 'Unknown'}
                              </span>
                              {p.userEmail && (
                                <span className={styles.studentEmailText}>
                                  {p.userEmail}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          {p.invitationStatus?.toLowerCase() === 'submitted' ? (
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
                        <td className={styles.commentText}>
                          {p.participantEvaluation ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className={styles.feedbackModalFooter}>
              {canModify && ownsSeminar(selectedSeminarForFeedback, currentUserId, currentRole) && (
                <button
                  className={styles.remindPendingBtn}
                  onClick={() =>
                    selectedSeminarForFeedback &&
                    void handleRemindPending(selectedSeminarForFeedback.seminarId)
                  }
                  disabled={
                    isSendingReminder ||
                    allParticipants.filter((p) => p.invitationStatus?.toLowerCase() !== 'submitted')
                      .length === 0
                  }
                >
                  {isSendingReminder ? (
                    <Loader size={14} className={styles.spinningIcon} aria-hidden />
                  ) : (
                    <Mail size={14} aria-hidden />
                  )}
                  Remind Pending ({allParticipants.length})
                </button>
              )}
              <button className={styles.modalCloseNavyBtn} onClick={() => setShowFeedbackModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Summary Modal — wired by Agent 23 */}
      {showAiModal && selectedSeminarForAi && (
        <AudioSummaryModal
          seminarId={selectedSeminarForAi.seminarId}
          seminarTitle={selectedSeminarForAi.title}
          isOpen={showAiModal}
          onClose={() => setShowAiModal(false)}
          onSuccess={(id) => {
            void refetch(); // Refresh so aiSummary appears on card
            void id;
          }}
        />
      )}

      {/* Attendee / Student Feedback Modal */}
      {showAttendeeFeedbackModal && selectedSeminarForAttendeeFeedback && (
        <SeminarFeedbackModal
          isOpen={showAttendeeFeedbackModal}
          onClose={() => setShowAttendeeFeedbackModal(false)}
          seminarId={selectedSeminarForAttendeeFeedback.seminarId}
          seminarTitle={selectedSeminarForAttendeeFeedback.title}
          currentUserId={currentUserId}
          onSuccess={() => {
            void refetch();
          }}
        />
      )}
    </div>
  );
};

export default SeminarWorkspace;
