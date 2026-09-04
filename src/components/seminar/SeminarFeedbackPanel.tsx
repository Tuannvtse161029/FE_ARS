/**
 * SeminarFeedbackPanel — Lecturer/Researcher (owner) feedback view.
 *
 * Layout:
 * 1. Stats header: total invited / submitted / pending / declined / completion
 * 2. Action row: Send reminder + Generate AI summary
 * 3. Raw participant feedback list (when BE returns rows)
 * 4. AI Feedback Analysis (when generated)
 *
 * Owner-only. Participants never see this surface.
 * Never renders `rating` / `averageScore` — the new feedback model is
 * structured (overallComment, strengths, improvements, suggestions).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader,
  Mail,
  RefreshCw,
  Sparkles,
  Inbox,
  Brain,
  TrendingUp,
  Clock,
  XCircle,
  Users,
  Lightbulb,
  ThumbsUp,
  Wrench,
  MessageSquareText,
  Quote,
  Eye,
} from 'lucide-react';
import {
  seminarService,
  type SeminarFeedbackAiContent,
  type SeminarFeedbackAiSummary,
  type SeminarParticipantFeedback,
  type SeminarStats,
} from '../../services/seminar.service';
import { SeminarFeedbackModal } from './SeminarFeedbackModal';
import styles from './SeminarFeedbackPanel.module.css';

interface SeminarFeedbackPanelProps {
  seminarId: number;
  seminarTitle: string;
  /** Optional pre-loaded stats payload from the parent. */
  initialStats?: SeminarStats | null;
  /** Optional pre-loaded AI summary JSON string (from GET /api/Seminar/{id}). */
  initialAiSummaryJson?: string | null;
  /** Optional pre-loaded AI summary timestamp. */
  initialAiGeneratedAt?: string | null;
  /** Surfaced back up so the page can refresh related cards. */
  onRefreshSeminar?: () => void;
}

const formatTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
};

const initialsOf = (name: string | null | undefined, fallback: string): string => {
  if (!name) return fallback.slice(0, 2).toUpperCase();
  return name
    .split(/\s+/)
    .map((s) => s[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || fallback.slice(0, 2).toUpperCase();
};

const isFeedbackContentEmpty = (
  content?: SeminarParticipantFeedback['feedback'],
): boolean => {
  if (!content) return true;
  if (content.overallComment && content.overallComment.trim().length > 0)
    return false;
  if (content.strengths?.some((s) => s.trim().length > 0)) return false;
  if (content.improvements?.some((s) => s.trim().length > 0)) return false;
  if (content.suggestions?.some((s) => s.trim().length > 0)) return false;
  return true;
};

export const SeminarFeedbackPanel: React.FC<SeminarFeedbackPanelProps> = ({
  seminarId,
  seminarTitle,
  initialStats = null,
  initialAiSummaryJson = null,
  initialAiGeneratedAt = null,
  onRefreshSeminar,
}) => {
  const [stats, setStats] = useState<SeminarStats | null>(initialStats);
  const [feedback, setFeedback] = useState<SeminarParticipantFeedback[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [reminderSending, setReminderSending] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [aiSummary, setAiSummary] = useState<SeminarFeedbackAiSummary | null>(
    null,
  );
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Hydrate the AI summary from the Seminar.feedback JSON string when the
  // page opens, so the panel can show "last generated" before any click.
  useEffect(() => {
    if (!initialAiSummaryJson) {
      setAiSummary(null);
      return;
    }
    const parsedContent = seminarServiceLikeParse(initialAiSummaryJson);
    if (!parsedContent) return;
    setAiSummary({
      seminarId,
      feedbackCount: feedback.length || 0,
      feedback: parsedContent,
      generatedAt: initialAiGeneratedAt ?? new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAiSummaryJson, initialAiGeneratedAt, seminarId]);

  const loadStats = async (): Promise<void> => {
    const data = await seminarService.getStats(seminarId);
    setStats(data);
  };

  const loadFeedback = async (): Promise<void> => {
    setLoadingFeedback(true);
    setFeedbackError(null);
    try {
      const data = await seminarService.getFeedbackList(seminarId);
      setFeedback(data ?? []);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        (err instanceof Error ? err.message : null) ??
        'Could not load participant feedback.';
      setFeedbackError(message);
      setFeedback([]);
    } finally {
      setLoadingFeedback(false);
    }
  };

  useEffect(() => {
    void loadStats();
    void loadFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seminarId]);

  const submittedCount = useMemo(
    () =>
      feedback.filter((row) => !isFeedbackContentEmpty(row.feedback)).length,
    [feedback],
  );

  const handleSendReminder = async (): Promise<void> => {
    if (reminderSending) return;
    setReminderSending(true);
    setReminderMessage(null);
    try {
      const result = await seminarService.sendFeedbackReminders(seminarId);
      setReminderMessage({
        type: 'success',
        text:
          result.sent > 0
            ? `Reminder sent to ${result.sent} participant${
                result.sent === 1 ? '' : 's'
              }.${result.skipped > 0 ? ` ${result.skipped} skipped.` : ''}`
            : 'No eligible participants needed a reminder right now.',
      });
      void loadStats();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        (err instanceof Error ? err.message : null) ??
        'Could not send feedback reminders.';
      setReminderMessage({ type: 'error', text: message });
    } finally {
      setReminderSending(false);
    }
  };

  const handleGenerateAi = async (): Promise<void> => {
    if (aiGenerating) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const result = await seminarService.summarizeFeedback(seminarId);
      setAiSummary(result);
      onRefreshSeminar?.();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        (err instanceof Error ? err.message : null) ??
        'Could not generate the AI feedback summary.';
      setAiError(message);
    } finally {
      setAiGenerating(false);
    }
  };

  const completionPct = stats?.completionPercentage ?? 0;

  return (
    <div className={styles.panel}>
      {/* ── Stats header ─────────────────────────────────────── */}
      <section className={styles.statsSection}>
        <header className={styles.statsHeader}>
          <div>
            <h3 className={styles.statsTitle}>Participant Feedback</h3>
            <p className={styles.statsSubtitle}>
              Structured responses from every invited participant of{' '}
              <span className={styles.statsSeminarName}>{seminarTitle}</span>.
            </p>
          </div>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => {
              void loadStats();
              void loadFeedback();
            }}
            aria-label="Refresh feedback stats"
            disabled={loadingFeedback}
          >
            <RefreshCw
              size={14}
              className={loadingFeedback ? styles.spinning : undefined}
              aria-hidden
            />
            Refresh
          </button>
        </header>

        <div className={styles.statsGrid} role="list">
          <StatCell
            label="Total invited"
            value={stats?.totalInvited ?? 0}
            icon={<Users size={16} aria-hidden />}
            tone="neutral"
          />
          <StatCell
            label="Submitted feedback"
            value={submittedCount}
            icon={<CheckCircle2 size={16} aria-hidden />}
            tone="success"
          />
          <StatCell
            label="Pending feedback"
            value={stats?.pending ?? 0}
            icon={<Clock size={16} aria-hidden />}
            tone="warning"
          />
          <StatCell
            label="Declined"
            value={stats?.declined ?? 0}
            icon={<XCircle size={16} aria-hidden />}
            tone="danger"
          />
          <StatCell
            label="Completion"
            value={`${Math.round(completionPct)}%`}
            icon={<TrendingUp size={16} aria-hidden />}
            tone="info"
            isPrimary
          />
        </div>

        {/* Completion progress */}
        <div className={styles.progressBlock}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${Math.min(100, completionPct)}%` }}
              aria-hidden
            />
          </div>
          <span className={styles.progressLabel}>
            {submittedCount} of {stats?.totalInvited ?? 0} participants have
            submitted feedback
          </span>
        </div>

        {/* Action row */}
        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.previewBtn}
            onClick={() => setShowPreviewModal(true)}
            data-testid="preview-feedback-form"
          >
            <Eye size={14} aria-hidden />
            Preview Form
          </button>
          <button
            type="button"
            className={styles.reminderBtn}
            onClick={() => void handleSendReminder()}
            disabled={
              reminderSending ||
              (stats?.pending ?? 0) === 0 ||
              aiGenerating
            }
          >
            {reminderSending ? (
              <>
                <Loader size={14} className={styles.spinning} aria-hidden />
                Sending…
              </>
            ) : (
              <>
                <Mail size={14} aria-hidden />
                Send Reminder
                {(stats?.pending ?? 0) > 0 && (
                  <span className={styles.actionCount}>
                    {stats?.pending}
                  </span>
                )}
              </>
            )}
          </button>
          <button
            type="button"
            className={styles.aiBtn}
            onClick={() => void handleGenerateAi()}
            disabled={aiGenerating || submittedCount === 0}
            data-testid="generate-ai-feedback-summary"
          >
            {aiGenerating ? (
              <>
                <Loader size={14} className={styles.spinning} aria-hidden />
                Generating AI summary…
              </>
            ) : aiSummary ? (
              <>
                <RefreshCw size={14} aria-hidden />
                Regenerate AI Summary
              </>
            ) : (
              <>
                <Sparkles size={14} aria-hidden />
                Generate AI Feedback Summary
              </>
            )}
          </button>
        </div>

        {reminderMessage && (
          <div
            className={`${styles.actionMessage} ${
              reminderMessage.type === 'success'
                ? styles.actionMessageSuccess
                : styles.actionMessageError
            }`}
            role={reminderMessage.type === 'error' ? 'alert' : 'status'}
          >
            {reminderMessage.type === 'success' ? (
              <CheckCircle2 size={14} aria-hidden />
            ) : (
              <AlertCircle size={14} aria-hidden />
            )}
            <span>{reminderMessage.text}</span>
          </div>
        )}
        {submittedCount === 0 && !aiError && (
          <p className={styles.aiHint}>
            AI summary becomes available once at least one participant submits
            feedback.
          </p>
        )}
      </section>

      {/* ── AI Feedback Analysis ───────────────────────────────── */}
      {(aiSummary || aiGenerating || aiError) && (
        <section className={styles.aiSection} aria-labelledby="ai-summary-title">
          <header className={styles.aiHeader}>
            <span className={styles.aiIcon}>
              <Brain size={16} aria-hidden />
            </span>
            <div>
              <h3 id="ai-summary-title" className={styles.aiTitle}>
                AI Feedback Analysis
              </h3>
              <p className={styles.aiSubtitle}>
                Synthesized from {aiSummary?.feedbackCount ?? submittedCount}{' '}
                participant response
                {(aiSummary?.feedbackCount ?? submittedCount) === 1 ? '' : 's'}
              </p>
            </div>
            {aiSummary && (
              <span className={styles.aiTimestamp}>
                Generated {formatTime(aiSummary.generatedAt)}
              </span>
            )}
          </header>

          {aiGenerating ? (
            <div className={styles.aiLoading} role="status">
              <Loader size={18} className={styles.spinning} aria-hidden />
              <div>
                <strong>Generating AI feedback summary…</strong>
                <span>
                  Reading through every submitted response and clustering the
                  themes. This usually takes a few seconds.
                </span>
              </div>
            </div>
          ) : aiError ? (
            <div className={styles.aiError} role="alert">
              <AlertCircle size={14} aria-hidden />
              <span>{aiError}</span>
            </div>
          ) : aiSummary ? (
            <AiSummaryBody summary={aiSummary.feedback} />
          ) : null}
        </section>
      )}

      {/* ── Raw participant feedback ───────────────────────────── */}
      <section className={styles.feedbackSection}>
        <header className={styles.feedbackHeader}>
          <h3 className={styles.feedbackTitle}>Raw Participant Feedback</h3>
          <p className={styles.feedbackSubtitle}>
            Responses stay private to the organizer. Each card shows the
            structured fields submitted by that participant.
          </p>
        </header>

        {feedbackError && (
          <div className={styles.feedbackError} role="alert">
            <AlertCircle size={14} aria-hidden />
            <span>{feedbackError}</span>
          </div>
        )}

        {loadingFeedback ? (
          <div className={styles.feedbackLoading}>
            <Loader size={16} className={styles.spinning} aria-hidden />
            Loading participant feedback…
          </div>
        ) : feedback.length === 0 ? (
          <div className={styles.feedbackEmpty}>
            <Inbox size={20} aria-hidden />
            <div>
              <strong>No participants invited yet.</strong>
              <span>
                Once you invite participants, their feedback will appear here
                once the seminar ends.
              </span>
            </div>
          </div>
        ) : (
          <ul className={styles.feedbackList}>
            {feedback.map((row) => (
              <FeedbackCard key={row.seminarParticipantId} entry={row} />
            ))}
          </ul>
        )}
      </section>

      {/* ── Preview form modal (host-only) ──────────────────── */}
      <SeminarFeedbackModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        seminarId={seminarId}
        seminarTitle={seminarTitle}
        previewMode
      />
    </div>
  );
};

// ─── Helper subcomponents ───────────────────────────────────────────

interface StatCellProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  isPrimary?: boolean;
}

const StatCell: React.FC<StatCellProps> = ({
  label,
  value,
  icon,
  tone,
  isPrimary = false,
}) => {
  const toneClass = `${styles.statCell} ${styles[`tone_${tone}`]} ${
    isPrimary ? styles.statCellPrimary : ''
  }`;
  return (
    <div className={toneClass} role="listitem">
      <span className={styles.statCellIcon}>{icon}</span>
      <span className={styles.statCellValue}>{value}</span>
      <span className={styles.statCellLabel}>{label}</span>
    </div>
  );
};

interface FeedbackCardProps {
  entry: SeminarParticipantFeedback;
}

const FeedbackCard: React.FC<FeedbackCardProps> = ({ entry }) => {
  const displayName =
    entry.userFullName ??
    entry.invitedEmail ??
    entry.userEmail ??
    `Participant #${entry.seminarParticipantId}`;
  const content = entry.feedback;
  const empty = isFeedbackContentEmpty(content);
  const initials = initialsOf(entry.userFullName, displayName);

  return (
    <li className={styles.feedbackCard}>
      <header className={styles.feedbackCardHeader}>
        <div className={styles.feedbackIdentity}>
          <span className={styles.feedbackAvatar} aria-hidden>
            {initials}
          </span>
          <div className={styles.feedbackIdentityMeta}>
            <span className={styles.feedbackName}>{displayName}</span>
            {entry.userEmail && entry.userEmail !== displayName && (
              <span className={styles.feedbackEmail}>{entry.userEmail}</span>
            )}
          </div>
        </div>
        <div className={styles.feedbackMeta}>
          {entry.invitationStatus && (
            <span
              className={`${styles.feedbackStatusPill} ${
                entry.invitationStatus.toLowerCase() === 'submitted' ||
                !empty
                  ? styles.feedbackStatusSubmitted
                  : entry.invitationStatus.toLowerCase() === 'declined'
                    ? styles.feedbackStatusDeclined
                    : styles.feedbackStatusPending
              }`}
            >
              {entry.invitationStatus}
            </span>
          )}
          {entry.feedbackSubmittedAt && (
            <span className={styles.feedbackTime}>
              Submitted {formatTime(entry.feedbackSubmittedAt)}
            </span>
          )}
          {entry.feedbackUpdatedAt &&
            entry.feedbackUpdatedAt !== entry.feedbackSubmittedAt && (
              <span className={styles.feedbackTime}>
                Updated {formatTime(entry.feedbackUpdatedAt)}
              </span>
            )}
        </div>
      </header>

      {empty ? (
        <div className={styles.feedbackCardEmpty}>
          <Quote size={14} aria-hidden />
          <span>No structured feedback submitted yet.</span>
        </div>
      ) : (
        <div className={styles.feedbackBody}>
          {content?.overallComment &&
            content.overallComment.trim().length > 0 && (
              <FeedbackQuoteSection
                icon={<MessageSquareText size={14} aria-hidden />}
                label="Overall comment"
                body={content.overallComment.trim()}
              />
            )}
          {content?.strengths && content.strengths.length > 0 && (
            <FeedbackBulletSection
              icon={<ThumbsUp size={14} aria-hidden />}
              label="Strengths"
              items={content.strengths.filter((s) => s.trim().length > 0)}
              variant="strength"
            />
          )}
          {content?.improvements && content.improvements.length > 0 && (
            <FeedbackBulletSection
              icon={<Wrench size={14} aria-hidden />}
              label="Areas for improvement"
              items={content.improvements.filter((s) => s.trim().length > 0)}
              variant="improvement"
            />
          )}
          {content?.suggestions && content.suggestions.length > 0 && (
            <FeedbackBulletSection
              icon={<Lightbulb size={14} aria-hidden />}
              label="Suggestions"
              items={content.suggestions.filter((s) => s.trim().length > 0)}
              variant="suggestion"
            />
          )}
        </div>
      )}
    </li>
  );
};

interface FeedbackBulletSectionProps {
  icon: React.ReactNode;
  label: string;
  items: string[];
  variant: 'strength' | 'improvement' | 'suggestion';
}

const FeedbackBulletSection: React.FC<FeedbackBulletSectionProps> = ({
  icon,
  label,
  items,
  variant,
}) => {
  if (items.length === 0) return null;
  return (
    <section
      className={`${styles.feedbackBulletSection} ${styles[`feedbackVariant_${variant}`]}`}
    >
      <header className={styles.feedbackBulletHeader}>
        <span className={styles.feedbackBulletIcon}>{icon}</span>
        <span className={styles.feedbackBulletLabel}>{label}</span>
        <span className={styles.feedbackBulletCount}>{items.length}</span>
      </header>
      <ul className={styles.feedbackBulletList}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
};

interface FeedbackQuoteSectionProps {
  icon: React.ReactNode;
  label: string;
  body: string;
}

const FeedbackQuoteSection: React.FC<FeedbackQuoteSectionProps> = ({
  icon,
  label,
  body,
}) => {
  return (
    <section className={styles.feedbackQuoteSection}>
      <header className={styles.feedbackBulletHeader}>
        <span className={styles.feedbackBulletIcon}>{icon}</span>
        <span className={styles.feedbackBulletLabel}>{label}</span>
      </header>
      <blockquote className={styles.feedbackQuote}>{body}</blockquote>
    </section>
  );
};

interface AiSummaryBodyProps {
  summary: SeminarFeedbackAiContent;
}

const AiSummaryBody: React.FC<AiSummaryBodyProps> = ({ summary }) => {
  const sections: Array<{
    icon: React.ReactNode;
    label: string;
    items: string[];
    variant: 'strength' | 'improvement' | 'suggestion' | 'neutral';
  }> = [
    {
      icon: <ThumbsUp size={14} aria-hidden />,
      label: 'Common strengths',
      items: summary.commonStrengths,
      variant: 'strength',
    },
    {
      icon: <Wrench size={14} aria-hidden />,
      label: 'Areas for improvement',
      items: summary.areasForImprovement,
      variant: 'improvement',
    },
    {
      icon: <Lightbulb size={14} aria-hidden />,
      label: 'Common suggestions',
      items: summary.commonSuggestions,
      variant: 'suggestion',
    },
    {
      icon: <Quote size={14} aria-hidden />,
      label: 'Conflicting feedback',
      items: summary.conflictingFeedback,
      variant: 'neutral',
    },
    {
      icon: <TrendingUp size={14} aria-hidden />,
      label: 'Recommended actions',
      items: summary.recommendedActions,
      variant: 'neutral',
    },
  ];

  return (
    <div className={styles.aiBody}>
      <section className={styles.aiOverall}>
        <span className={styles.aiOverallLabel}>Overall assessment</span>
        <p className={styles.aiOverallText}>{summary.overallAssessment}</p>
      </section>
      <div className={styles.aiSectionsGrid}>
        {sections.map((section) =>
          section.items.length === 0 ? null : (
            <AiSummaryList
              key={section.label}
              icon={section.icon}
              label={section.label}
              items={section.items}
              variant={section.variant}
            />
          ),
        )}
      </div>
    </div>
  );
};

interface AiSummaryListProps {
  icon: React.ReactNode;
  label: string;
  items: string[];
  variant: 'strength' | 'improvement' | 'suggestion' | 'neutral';
}

const AiSummaryList: React.FC<AiSummaryListProps> = ({
  icon,
  label,
  items,
  variant,
}) => (
  <section
    className={`${styles.aiListSection} ${styles[`aiVariant_${variant}`]}`}
  >
    <header className={styles.aiListHeader}>
      <span className={styles.aiListIcon}>{icon}</span>
      <span className={styles.aiListLabel}>{label}</span>
      <span className={styles.aiListCount}>{items.length}</span>
    </header>
    <ul className={styles.aiList}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  </section>
);

// ── Internal helpers ───────────────────────────────────────────────

// Local re-export of parseAiFeedback so we don't need to import the service
// directly in two places — keeps the panel self-contained for the JSX.
function seminarServiceLikeParse(value: string): SeminarFeedbackAiContent | null {
  try {
    const parsed = JSON.parse(value) as Partial<SeminarFeedbackAiContent>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.overallAssessment !== 'string') return null;
    return {
      overallAssessment: parsed.overallAssessment,
      commonStrengths: Array.isArray(parsed.commonStrengths)
        ? (parsed.commonStrengths.filter((x) => typeof x === 'string') as string[])
        : [],
      areasForImprovement: Array.isArray(parsed.areasForImprovement)
        ? (parsed.areasForImprovement.filter((x) => typeof x === 'string') as string[])
        : [],
      commonSuggestions: Array.isArray(parsed.commonSuggestions)
        ? (parsed.commonSuggestions.filter((x) => typeof x === 'string') as string[])
        : [],
      conflictingFeedback: Array.isArray(parsed.conflictingFeedback)
        ? (parsed.conflictingFeedback.filter((x) => typeof x === 'string') as string[])
        : [],
      recommendedActions: Array.isArray(parsed.recommendedActions)
        ? (parsed.recommendedActions.filter((x) => typeof x === 'string') as string[])
        : [],
    };
  } catch {
    return null;
  }
}

export default SeminarFeedbackPanel;
