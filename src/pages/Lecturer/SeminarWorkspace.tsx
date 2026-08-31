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
  Inbox as InboxIcon,
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
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button/Button';
import styles from './SeminarWorkspace.module.css';

const SEMINARS_PER_PAGE = 3;

type TabKey = 'all' | 'upcoming' | 'completed' | 'drafts';

const formatSeminarId = (id: number): string =>
  `SEM-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`;

const formatBytesTitle = (raw: string): string => raw;

export const SeminarWorkspace = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [currentSeminarPage, setCurrentSeminarPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGeneratedModal, setShowGeneratedModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showAttendeeFeedbackModal, setShowAttendeeFeedbackModal] =
    useState(false);
  const [
    selectedSeminarForAttendeeFeedback,
    setSelectedSeminarForAttendeeFeedback,
  ] = useState<SeminarCard | null>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [bannerText, setBannerText] = useState('');
  const [bannerVariant, setBannerVariant] = useState<'success' | 'error'>(
    'success',
  );
  const [selectedSeminarForFeedback, setSelectedSeminarForFeedback] =
    useState<SeminarCard | null>(null);

  const [showAiModal, setShowAiModal] = useState(false);
  const [selectedSeminarForAi, setSelectedSeminarForAi] =
    useState<SeminarCard | null>(null);

  // Create modal form state
  const [seminarName, setSeminarName] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [seminarDetails, setSeminarDetails] = useState('');
  const [guestEmails, setGuestEmails] = useState<string[]>([]);
  const [emailInputText, setEmailInputText] = useState('');
  const [sendReminder, setSendReminder] = useState(true);

  const [generatedMeetLink, setGeneratedMeetLink] = useState('');

  // ── Seminar data via hooks ───────────────────────────────────────────────────
  const {
    seminars,
    isLoading: isLoadingSeminars,
    error: loadSeminarsError,
    refetch,
    backendAvailability,
  } = useSeminars();

  const { currentRole, currentUserId, canModify } = useSeminarRoleContext();

  const handleCreateSuccess = useCallback(
    (created: { seminarId: number; onlineLink?: string | null }) => {
      setGeneratedMeetLink(created.onlineLink ?? '');
      setBannerText(
        `"${seminarName || 'Seminar'}" has been created.`,
      );
      setBannerVariant('success');
      setShowSuccessBanner(true);
      setShowCreateModal(false);
      setShowGeneratedModal(true);
    },
    [seminarName],
  );

  const { createSeminar, isCreating: isCreatingSeminar } =
    useCreateSeminar(handleCreateSuccess, refetch);

  const { sendReminder: doSendReminder, isSending: isSendingReminder } =
    useSendReminder(undefined, refetch);

  const reminderInFlightRef = useRef(false);

  const { participants: allParticipants, isLoading: isLoadingParticipants } =
    useSeminarParticipants(selectedSeminarForFeedback?.seminarId);

  // ── Tab filter + counts ───────────────────────────────────────
  const seminarCounts = useMemo(
    () =>
      seminars.reduce(
        (counts, seminar) => {
          const effective = deriveEffectiveStatus(
            seminar.status,
            seminar.endTime,
          );
          if (effective === 'UPCOMING' || effective === 'IN PROGRESS') {
            counts.upcoming += 1;
          } else if (effective === 'COMPLETED') {
            counts.completed += 1;
          } else if (effective === 'DRAFT') {
            counts.drafts += 1;
          }
          return counts;
        },
        { upcoming: 0, completed: 0, drafts: 0 },
      ),
    [seminars],
  );

  const filteredSeminars = useMemo(() => {
    return seminars.filter((sem) => {
      const effective = deriveEffectiveStatus(sem.status, sem.endTime);
      if (activeTab === 'upcoming') {
        return effective === 'UPCOMING' || effective === 'IN PROGRESS';
      }
      if (activeTab === 'completed') return effective === 'COMPLETED';
      if (activeTab === 'drafts') return effective === 'DRAFT';
      return true;
    });
  }, [activeTab, seminars]);

  const totalSeminarPages = Math.max(
    1,
    Math.ceil(filteredSeminars.length / SEMINARS_PER_PAGE),
  );
  const safeSeminarPage = Math.min(currentSeminarPage, totalSeminarPages);
  const paginatedSeminars = useMemo(
    () =>
      filteredSeminars.slice(
        (safeSeminarPage - 1) * SEMINARS_PER_PAGE,
        safeSeminarPage * SEMINARS_PER_PAGE,
      ),
    [filteredSeminars, safeSeminarPage],
  );

  const minDateTime = useMemo(
    () => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
    [],
  );

  const announce = useCallback(
    (message: string, variant: 'success' | 'error' = 'success') => {
      setBannerText(message);
      setBannerVariant(variant);
      setShowSuccessBanner(true);
    },
    [],
  );

  // ── Create form helpers ─────────────────────────────────────────
  const handleAddEmail = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && emailInputText.trim()) {
      e.preventDefault();
      const candidate = emailInputText.trim();
      if (!guestEmails.includes(candidate)) {
        setGuestEmails([...guestEmails, candidate]);
      }
      setEmailInputText('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    setGuestEmails(guestEmails.filter((x) => x !== email));
  };

  const handleCreateSeminarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModify) {
      announce('You do not have permission to create seminars.', 'error');
      return;
    }
    if (!seminarName.trim()) {
      announce('Please enter a seminar name.', 'error');
      return;
    }
    if (!dateTime.trim()) {
      announce('Please select a date and time.', 'error');
      return;
    }
    if (!seminarDetails.trim()) {
      announce('Please enter seminar details.', 'error');
      return;
    }
    const minTime = new Date(Date.now() + 60 * 60 * 1000);
    if (new Date(dateTime) < minTime) {
      announce(
        'Seminars must be scheduled at least 1 hour in advance.',
        'error',
      );
      return;
    }
    const startTime = new Date(dateTime).toISOString();
    const endTime = new Date(
      new Date(dateTime).getTime() + 60 * 60 * 1000,
    ).toISOString();
    const fullContent = seminarName.trim()
      ? `[${seminarName.trim()}] ${seminarDetails.trim()}`
      : seminarDetails.trim();

    try {
      await createSeminar({
        startTime,
        endTime,
        content: fullContent,
        guestEmails: guestEmails.length > 0 ? guestEmails : undefined,
        isReminderSent: sendReminder,
        status: 'Upcoming',
      });
      // Reset form for next create.
      setSeminarName('');
      setDateTime('');
      setSeminarDetails('');
      setGuestEmails([]);
      setEmailInputText('');
      setSendReminder(true);
    } catch {
      // Error already announced by hook via the banner mechanism on parent.
    }
  };

  const handleOpenFeedbackModal = (sem: SeminarCard) => {
    setSelectedSeminarForFeedback(sem);
    setShowFeedbackModal(true);
  };

  const handleRemindPending = async (seminarId: number) => {
    if (reminderInFlightRef.current) return;
    reminderInFlightRef.current = true;
    try {
      await doSendReminder(seminarId);
      announce('Reminder sent successfully.');
    } catch {
      announce('Failed to send reminder. Please try again.', 'error');
    } finally {
      reminderInFlightRef.current = false;
    }
  };

  const handleOpenAiSummary = useCallback((sem: SeminarCard) => {
    setSelectedSeminarForAi(sem);
    setShowAiModal(true);
  }, []);

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'all', label: 'All Seminars', count: seminars.length },
    {
      key: 'upcoming',
      label: 'Upcoming',
      count: seminarCounts.upcoming,
    },
    {
      key: 'completed',
      label: 'Completed',
      count: seminarCounts.completed,
    },
    { key: 'drafts', label: 'Drafts', count: seminarCounts.drafts },
  ];

  const headerActions = (
    <>
      <Button
        variant="outline"
        size="md"
        leftIcon={
          isLoadingSeminars ? (
            <Loader size={14} className={styles.spinning} aria-hidden />
          ) : (
            <RefreshCw size={14} aria-hidden />
          )
        }
        onClick={() => void refetch()}
        disabled={isLoadingSeminars}
        aria-label="Refresh seminars"
      >
        {isLoadingSeminars ? 'Refreshing…' : 'Refresh'}
      </Button>
      {canModify && (
        <Button
          variant="primary"
          size="md"
          className={styles.actionBtnLecturer}
          leftIcon={<Plus size={16} aria-hidden />}
          onClick={() => setShowCreateModal(true)}
        >
          Create Seminar
        </Button>
      )}
    </>
  );

  return (
    <div
      className={styles.page}
      data-testid="lecturer-seminar-workspace"
    >
      <PageHeader
        eyebrow={currentRole ? `${currentRole.toUpperCase()} WORKSPACE` : 'WORKSPACE'}
        title="Seminar & Workshop Management"
        description={
          canModify
            ? 'Manage your scheduled seminars, share resources, and collect feedback.'
            : 'Browse upcoming and completed seminars you have been invited to.'
        }
        actions={headerActions}
        accent="var(--ars-lecturer)"
      />

      {/* BANNERS */}
      {showSuccessBanner && (
        <div
          className={`${styles.banner} ${
            bannerVariant === 'error' ? styles.bannerError : ''
          }`}
          role={bannerVariant === 'error' ? 'alert' : 'status'}
        >
          <span className={styles.bannerIcon}>
            {bannerVariant === 'success' ? (
              <Check size={14} strokeWidth={3} aria-hidden />
            ) : (
              <AlertTriangle size={14} aria-hidden />
            )}
          </span>
          <div className={styles.bannerBody}>
            <span className={styles.bannerTitle}>
              {bannerVariant === 'success'
                ? 'Seminar Created Successfully'
                : 'Action Failed'}
            </span>
            <span className={styles.bannerText}>{bannerText}</span>
          </div>
          <button
            type="button"
            className={styles.bannerCloseBtn}
            onClick={() => setShowSuccessBanner(false)}
            aria-label="Dismiss"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      {loadSeminarsError && (
        <ErrorBanner
          tone="error"
          title="Failed to load seminars"
          message={loadSeminarsError}
          retry={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
            >
              Retry
            </Button>
          }
        />
      )}

      {backendAvailability !== 'full' && (
        <div className={styles.backendBanner} role="status" aria-live="polite">
          <span className={styles.backendBannerIcon}>
            <Lock size={14} aria-hidden />
          </span>
          <div className={styles.backendBannerBody}>
            <span className={styles.backendBannerTitle}>
              Seminar list unavailable for your role
            </span>
            <p className={styles.backendBannerText}>
              The seminar list is currently only available to the seminar
              organizer (Lecturer role). Showing the BE-wide seminar and
              participant rows to a Researcher, Reviewer, or Graduate Student
              would expose every participant's name and email across the
              platform. Once the BE ships a participant-scoped read, this
              surface will populate automatically — no FE change required.
            </p>
          </div>
        </div>
      )}

      {/* Tabs row */}
      <div className={styles.toolbarRow}>
        <div className={styles.tabs} role="tablist" aria-label="Filter seminars">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              className={`${styles.tabBtn} ${
                activeTab === t.key ? styles.tabActive : ''
              }`}
              onClick={() => {
                setActiveTab(t.key);
                setCurrentSeminarPage(1);
              }}
            >
              {t.label}
              <span className={styles.tabCount}>{t.count}</span>
            </button>
          ))}
        </div>
        <span className={styles.toolbarMeta}>
          Showing {paginatedSeminars.length > 0
            ? `${(safeSeminarPage - 1) * SEMINARS_PER_PAGE + 1}–${Math.min(safeSeminarPage * SEMINARS_PER_PAGE, filteredSeminars.length)}`
            : '0'} of {filteredSeminars.length} seminars
        </span>
      </div>

      {/* List */}
      {isLoadingSeminars ? (
        <SkeletonRow count={4} withHeader />
      ) : backendAvailability !== 'full' ? (
        <EmptyState
          icon={<Lock size={20} aria-hidden />}
          title="Seminars are temporarily unavailable"
          description="The backend did not provide a readable seminar list for this session."
        />
      ) : activeTab === 'drafts' && filteredSeminars.length === 0 ? (
        <EmptyState
          icon={<FileText size={20} aria-hidden />}
          title="No drafts"
          description="Saved drafts will appear here once the BE exposes draft lifecycle."
        />
      ) : filteredSeminars.length === 0 ? (
        <EmptyState
          icon={<Inbox size={20} aria-hidden />}
          title="No seminars yet"
          description={
            canModify
              ? 'Click "Create Seminar" to schedule your first one.'
              : 'No seminars scheduled or invited at this time.'
          }
        />
      ) : (
        <ul className={styles.list}>
          {paginatedSeminars.map((sem) => {
            const seminarStartDate = sem.startTime
              ? new Date(sem.startTime)
              : null;
            const seminarEndDate = sem.endTime ? new Date(sem.endTime) : null;
            const dateLabel = seminarStartDate
              ? seminarStartDate.toISOString().split('T')[0]
              : '';
            const timeLabel =
              seminarStartDate && seminarEndDate &&
              !Number.isNaN(seminarStartDate.getTime())
                ? `${seminarStartDate.toISOString().slice(11, 16)} – ${seminarEndDate
                    .toISOString()
                    .slice(11, 16)} (UTC)`
                : '';
            const isCompleted =
              sem.effectiveStatus === 'COMPLETED' ||
              sem.status === 'COMPLETED';
            const owns = ownsSeminar(sem, currentUserId, currentRole);
            const showAi = canModify && owns && isCompleted;
            const showFeedbackOrganizer =
              canModify && owns && isCompleted;
            return (
                  <li className={styles.seminarCard} key={sem.seminarId}>
                    <div className={styles.cardTopRow}>
                      <div className={styles.metaRow}>
                        <span className={styles.metaBadge}>
                          ID {formatSeminarId(sem.seminarId)}
                        </span>
                      </div>
                      <div className={styles.dateMeta}>
                        <span className={styles.dateMetaInline}>
                          <Calendar size={12} aria-hidden />
                          {dateLabel}
                        </span>
                        <span className={styles.dateMetaInline}>
                          <Clock size={12} aria-hidden />
                          {timeLabel}
                        </span>
                      </div>
                    </div>

                    <h3 className={styles.cardTitle}>
                      {formatBytesTitle(sem.title)}
                    </h3>
                    <p className={styles.cardDescription}>
                      {sem.content || 'No description provided.'}
                    </p>

                    {sem.maxParticipants != null && !isCompleted && (
                      <div className={styles.capacityRow}>
                        Up to {sem.maxParticipants} participants
                      </div>
                    )}

                    {isValidMeetLink(sem.onlineLink) && (
                      <div className={styles.meetBox}>
                        <Video size={14} aria-hidden />
                        <a
                          href={sem.onlineLink}
                          className={styles.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {sem.onlineLink}
                        </a>
                      </div>
                    )}

                    {isCompleted && (
                      <div className={styles.progressBlock}>
                        <div className={styles.progressLabels}>
                          <span>Feedback submissions</span>
                          <span className={styles.progressValue}>
                            {sem.feedbackSubmitted}/{sem.feedbackTotal}
                          </span>
                        </div>
                        <div className={styles.progressBarBg}>
                          <div
                            className={styles.progressBarFill}
                            style={{
                              width:
                                sem.feedbackTotal > 0
                                  ? `${(sem.feedbackSubmitted /
                                      sem.feedbackTotal) *
                                      100}%`
                                  : '0%',
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className={styles.cardActions}>
                      {isCompleted ? (
                        <>
                          {showAi && (
                            <button
                              type="button"
                              className={styles.actionBtnOutline}
                              onClick={() => handleOpenAiSummary(sem)}
                            >
                              <Eye size={14} aria-hidden />
                              View Notes
                            </button>
                          )}
                          {showFeedbackOrganizer ? (
                            <button
                              type="button"
                              className={styles.actionBtnPrimary}
                              onClick={() => handleOpenFeedbackModal(sem)}
                            >
                              <ClipboardList size={14} aria-hidden />
                              Feedback &amp; Grading
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={styles.actionBtnPrimary}
                              onClick={() => {
                                setSelectedSeminarForAttendeeFeedback(sem);
                                setShowAttendeeFeedbackModal(true);
                              }}
                            >
                              <ClipboardList size={14} aria-hidden />
                              Submit Feedback
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles.actionBtnPrimary}
                            onClick={() =>
                              window.open(sem.onlineLink, '_blank')
                            }
                            disabled={!isValidMeetLink(sem.onlineLink)}
                          >
                            <Video size={14} aria-hidden />
                            Join Google Meet
                          </button>
                          {canModify && owns && (
                            <button
                              type="button"
                              className={styles.actionBtnOutline}
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  sem.onlineLink ?? '',
                                );
                                announce('Invite link copied.');
                              }}
                              disabled={!isValidMeetLink(sem.onlineLink)}
                            >
                              <Mail size={14} aria-hidden />
                              Send Invite Link
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.actionBtnGhost}
                            disabled
                          >
                            Feedback (available after completion)
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
          })}
        </ul>
      )}

      {totalSeminarPages > 1 && (
        <div className={styles.paginationRow}>
          <button
            type="button"
            className={styles.paginationBtn}
            onClick={() => setCurrentSeminarPage((p) => Math.max(1, p - 1))}
            disabled={safeSeminarPage <= 1}
          >
            Previous
          </button>
          <span className={styles.paginationLabel}>
            Page {safeSeminarPage} of {totalSeminarPages}
          </span>
          <button
            type="button"
            className={styles.paginationBtn}
            onClick={() =>
              setCurrentSeminarPage((p) => Math.min(totalSeminarPages, p + 1))
            }
            disabled={safeSeminarPage >= totalSeminarPages}
          >
            Next
          </button>
        </div>
      )}

      {/* CREATE SEMINAR MODAL */}
      {showCreateModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalIconCircle}>
                  <Plus size={18} aria-hidden />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>
                    Create New Academic Seminar
                  </h3>
                  <span className={styles.modalSubtitle}>
                    A Google Meet link will be auto-generated.
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <form
              onSubmit={handleCreateSeminarSubmit}
              className={styles.modalBody}
            >
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="seminar-name">
                  Seminar Name
                </label>
                <input
                  id="seminar-name"
                  type="text"
                  className={styles.formInput}
                  value={seminarName}
                  onChange={(e) => setSeminarName(e.target.value)}
                  placeholder="Advanced Cloud Routing Architecture Seminar"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="seminar-date">
                  Date &amp; Time
                </label>
                <input
                  id="seminar-date"
                  type="datetime-local"
                  className={styles.formInput}
                  value={
                    dateTime ? new Date(dateTime).toISOString().slice(0, 16) : ''
                  }
                  min={minDateTime}
                  onChange={(e) => {
                    const localValue = e.target.value;
                    if (!localValue) {
                      setDateTime('');
                      return;
                    }
                    setDateTime(new Date(localValue).toISOString());
                  }}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="seminar-details">
                  Seminar Details
                </label>
                <textarea
                  id="seminar-details"
                  className={styles.formTextarea}
                  value={seminarDetails}
                  onChange={(e) => setSeminarDetails(e.target.value)}
                  placeholder="Deep dive into modular backend routing networks and high-concurrency telemetry."
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Guest Email Invitations
                </label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={emailInputText}
                  onChange={(e) => setEmailInputText(e.target.value)}
                  onKeyDown={handleAddEmail}
                  placeholder="Type email and press Enter…"
                />
                <span className={styles.helperText}>
                  Press Enter to add each address.
                </span>
                {guestEmails.length > 0 && (
                  <div className={styles.emailPills}>
                    {guestEmails.map((email) => (
                      <span key={email} className={styles.emailPill}>
                        <Mail size={12} aria-hidden />
                        {email}
                        <button
                          type="button"
                          className={styles.emailPillRemove}
                          onClick={() => handleRemoveEmail(email)}
                          aria-label={`Remove ${email}`}
                        >
                          <X size={12} aria-hidden />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  className={styles.checkboxInput}
                  checked={sendReminder}
                  onChange={(e) => setSendReminder(e.target.checked)}
                />
                <span className={styles.checkboxLabel}>
                  <strong>Send Email Reminder</strong>
                  <span className={styles.checkboxSub}>
                    Auto-send an email reminder to guests one day before the
                    seminar starts.
                  </span>
                </span>
              </label>

              <div className={styles.modalFooter}>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreatingSeminar}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  className={styles.actionBtnLecturer}
                  leftIcon={
                    isCreatingSeminar ? (
                      <Loader
                        size={14}
                        className={styles.spinning}
                        aria-hidden
                      />
                    ) : (
                      <Video size={14} aria-hidden />
                    )
                  }
                  disabled={isCreatingSeminar}
                >
                  {isCreatingSeminar
                    ? 'Creating…'
                    : 'Generate & Create Seminar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GENERATED-MEET DIALOG */}
      {showGeneratedModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <span className={styles.generatedIcon}>
              <Check size={28} strokeWidth={3} aria-hidden />
            </span>
            <h3 className={styles.generatedTitle}>
              Seminar Created &amp; Google Meet Link Generated
            </h3>
            <p className={styles.generatedSub}>{seminarName}</p>

            <div className={styles.meetCard}>
              <span className={styles.meetCardLabel}>
                <Video size={14} aria-hidden />
                Google Meet Link
              </span>
              <div className={styles.meetCardRow}>
                <input
                  type="text"
                  className={styles.meetCardInput}
                  value={generatedMeetLink}
                  readOnly
                />
                <button
                  type="button"
                  className={styles.copyBtn}
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

            <div className={styles.inviteAlert}>
              <div className={styles.inviteAlertTitleRow}>
                <AlertTriangle size={14} aria-hidden />
                <span>
                  Email invitations have been sent to invited guests. An
                  automated reminder will be sent{' '}
                  <strong>1 day before</strong> the seminar starts.
                </span>
              </div>
              <div className={styles.inviteAlertSent}>
                <Mail size={12} aria-hidden />
                Sent to: {guestEmails.join(', ') || '(none)'}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setShowGeneratedModal(false);
                  setSeminarName('');
                  setSeminarDetails('');
                  setDateTime('');
                  setGuestEmails([]);
                  setEmailInputText('');
                  setGeneratedMeetLink('');
                }}
              >
                Back to Seminars
              </Button>
              <Button
                variant="primary"
                size="md"
                leftIcon={<Video size={14} aria-hidden />}
                onClick={() =>
                  window.open(generatedMeetLink, '_blank', 'noopener')
                }
                className={styles.actionBtnSuccess}
              >
                Launch Google Meet
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK & GRADING MODAL */}
      {showFeedbackModal && selectedSeminarForFeedback && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={`${styles.modalCard} ${styles.modalCardLarge}`}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalIconCircle}>
                  <ClipboardList size={18} aria-hidden />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>
                    Feedback &amp; Grading Review
                  </h3>
                  <span className={styles.modalSubtitle}>
                    {selectedSeminarForFeedback.title}
                    {selectedSeminarForFeedback.startTime
                      ? ` · ${new Date(selectedSeminarForFeedback.startTime)
                          .toISOString()
                          .split('T')[0]}`
                      : ''}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setShowFeedbackModal(false)}
                aria-label="Close"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.statsGrid}>
                <div className={styles.statCell}>
                  <span className={styles.statLabel}>Total Invited</span>
                  <span className={styles.statValue}>
                    {allParticipants.length}
                  </span>
                </div>
                <div className={styles.statCell}>
                  <span className={styles.statLabel}>Submitted</span>
                  <span className={styles.statValue}>
                    {
                      allParticipants.filter(
                        (p) =>
                          p.invitationStatus?.toLowerCase() === 'submitted',
                      ).length
                    }
                  </span>
                </div>
                <div className={styles.statCell}>
                  <span className={styles.statLabel}>Pending</span>
                  <span className={styles.statValue}>
                    {
                      allParticipants.filter(
                        (p) =>
                          p.invitationStatus?.toLowerCase() !== 'submitted',
                      ).length
                    }
                  </span>
                </div>
                <div className={styles.statCell}>
                  <span className={styles.statLabel}>Avg. Score</span>
                  <span className={styles.statValue}>—</span>
                </div>
                <div className={styles.statWide}>
                  <div className={styles.statWideHeader}>
                    <span className={styles.statLabel}>Completion</span>
                    <span className={styles.statPercent}>
                      {allParticipants.length > 0
                        ? `${Math.round(
                            (allParticipants.filter(
                              (p) =>
                                p.invitationStatus?.toLowerCase() ===
                                'submitted',
                            ).length /
                              allParticipants.length) *
                              100,
                          )}%`
                        : '—'}
                    </span>
                  </div>
                  <div className={styles.progressBarBg}>
                    <div
                      className={styles.progressBarFill}
                      style={{
                        width:
                          allParticipants.length > 0
                            ? `${
                                (allParticipants.filter(
                                  (p) =>
                                    p.invitationStatus?.toLowerCase() ===
                                    'submitted',
                                ).length /
                                  allParticipants.length) *
                                100
                              }%`
                            : '0%',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.participantsWrap}>
                {isLoadingParticipants ? (
                  <div className={styles.participantsLoading}>
                    <SkeletonRow count={3} />
                  </div>
                ) : allParticipants.length === 0 ? (
                  <EmptyState
                    icon={<InboxIcon size={18} aria-hidden />}
                    title="No participants invited yet"
                    description="Invite guests from the Create Seminar flow."
                    compact
                  />
                ) : (
                  <table className={styles.participantsTable}>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Status</th>
                        <th>Evaluation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allParticipants.map((p) => (
                        <tr key={p.seminarParticipantId ?? p.userId}>
                          <td>
                            <div className={styles.participantCell}>
                              <span className={styles.participantAvatar}>
                                {(p.userFullName ?? p.userEmail ?? '??')
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </span>
                              <div>
                                <span className={styles.participantName}>
                                  {p.userFullName ?? p.userEmail ?? 'Unknown'}
                                </span>
                                {p.userEmail && (
                                  <span className={styles.participantEmail}>
                                    {p.userEmail}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            {p.invitationStatus?.toLowerCase() ===
                            'submitted' ? (
                              <span className={styles.metaBadge}>
                                <Check
                                  size={12}
                                  strokeWidth={3}
                                  aria-hidden
                                />
                                Submitted
                              </span>
                            ) : (
                              <span
                                className={`${styles.metaBadge} ${styles.pendingPill}`}
                              >
                                <Clock size={12} aria-hidden /> Pending
                              </span>
                            )}
                          </td>
                          <td className={styles.evaluationCell}>
                            {p.participantEvaluation ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className={styles.modalFooter}>
              {canModify &&
                ownsSeminar(
                  selectedSeminarForFeedback,
                  currentUserId,
                  currentRole,
                ) && (
                  <Button
                    variant="outline"
                    size="md"
                    leftIcon={
                      isSendingReminder ? (
                        <Loader
                          size={14}
                          className={styles.spinning}
                          aria-hidden
                        />
                      ) : (
                        <Mail size={14} aria-hidden />
                      )
                    }
                    onClick={() =>
                      void handleRemindPending(
                        selectedSeminarForFeedback.seminarId,
                      )
                    }
                    disabled={
                      isSendingReminder ||
                      allParticipants.filter(
                        (p) =>
                          p.invitationStatus?.toLowerCase() !== 'submitted',
                      ).length === 0
                    }
                  >
                    {isSendingReminder
                      ? 'Sending…'
                      : `Remind Pending (${allParticipants.length})`}
                  </Button>
                )}
              <Button
                variant="primary"
                size="md"
                onClick={() => setShowFeedbackModal(false)}
                className={styles.actionBtnLecturer}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI SUMMARY MODAL */}
      {showAiModal && selectedSeminarForAi && (
        <AudioSummaryModal
          seminarId={selectedSeminarForAi.seminarId}
          seminarTitle={selectedSeminarForAi.title}
          isOpen={showAiModal}
          onClose={() => setShowAiModal(false)}
          onSuccess={(id) => {
            void refetch();
            void id;
          }}
        />
      )}

      {/* ATTENDEE FEEDBACK MODAL */}
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
