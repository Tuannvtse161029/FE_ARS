/**
 *
 * SeminarFeedbackPanel — Lecturer/Researcher (owner) feedback view.
 *
 *
 * Layout:
 *
 * 1. Stats header: total invited / submitted / pending / declined / completion
 *
 * 2. Action row: Send reminder + Generate AI summary
 *
 * 3. Raw participant feedback list (when BE returns rows)
 *
 * 4. AI Feedback Analysis (when generated)
 *
 *
 * Owner-only. Participants never see this surface.
 *
 * Never renders `rating` / `averageScore` — the new feedback model is
 *
 * structured (overallComment, strengths, improvements, suggestions).
 *
 */

import { useEffect, useMemo, useState } from 'react';

import {
  AlertCircle,
  CheckCircle2,
  Loader,
  Mail,
  RefreshCw,
  Inbox,
  Brain,
  TrendingUp,
  Clock,
  XCircle,
  Users,
  ThumbsUp,
  Wrench,
  Quote,
  Eye,
  Sliders,
} from 'lucide-react';

import { useLocale, useT } from '../../i18n/I18nContext';

import {
  hasSubmittedFeedback,
  parseAiFeedback,
  seminarService,
  type SeminarFeedbackAiContent,
  type SeminarFeedbackSummary,
  type SeminarParticipantFeedback,
  type SeminarStats,
  deriveEffectiveStatus,
  type EffectiveSeminarStatus,
} from '../../services/seminar.service';

import {
  parseParticipantAnswers,
  type FeedbackQuestion,
} from '../../types/seminarFeedback';

import { SeminarFeedbackModal } from './SeminarFeedbackModal';
import { RawFeedbackViewModal } from './RawFeedbackViewModal';
import { SeminarFeedbackSetupModal } from './SeminarFeedbackSetupModal';

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
  /**
   * Optional pre-loaded dynamic questions (ticket §22). When provided, the
   * raw feedback render joins each participant `feedbackJson` answer with
   * its matching question so the host can show the question text instead of
   * raw `questionId` keys.
   */
  initialQuestions?: FeedbackQuestion[];
  /** Surfaced back up so the page can refresh related cards. */
  onRefreshSeminar?: () => void;
  /**
   * Effective seminar status (BE status folded with end-time). Used to
   * lock the "Configure Questions" affordance on completed seminars.
   */
  effectiveStatus?: EffectiveSeminarStatus | null;
  /** Optional end-time ISO string — fallback when effectiveStatus absent. */
  endTime?: string | null;
}

/**
 * Returns true when `text` contains at least one Vietnamese diacritic character.
 * Used to detect BE-generated AI summaries that are in Vietnamese so the panel
 * can surface a bilingual note without auto-triggering a paid regeneration.
 *
 * Covered range: U+00C0–U+1EF9 covers À-ỹ (A-ỹ with diacritics).
 * Common ASCII characters are excluded so this never fires on plain English.
 */
const containsVietnameseDiacritics = (text: string): boolean =>
  /[À-ỹà-ỹ]/.test(text);

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

/**
 * True when the participant has at least one text or rating answer (parsed
 * from `feedbackJson`). Per ticket §19/§22, NEVER use `invitationStatus`
 * alone — `feedbackJson` is the source of truth.
 */
const isParticipantSubmitted = (
  row?: Pick<SeminarParticipantFeedback, 'feedbackJson' | 'feedbackSubmittedAt'>,
): boolean => hasSubmittedFeedback(row);

export const SeminarFeedbackPanel = ({
  seminarId,
  seminarTitle,
  initialStats = null,
  initialAiSummaryJson = null,
  initialAiGeneratedAt = null,
  initialQuestions,
  effectiveStatus,
  endTime,
  onRefreshSeminar,
}: SeminarFeedbackPanelProps) => {
  const t = useT();
  const locale = useLocale();
  const isVi = locale === 'vi';

  const [stats, setStats] = useState<SeminarStats | null>(initialStats);
  const [feedback, setFeedback] = useState<SeminarParticipantFeedback[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<FeedbackQuestion[]>(initialQuestions ?? []);
  const [showSetupModal, setShowSetupModal] = useState(false);

  const [reminderSending, setReminderSending] = useState(false);

  // Effective completion gate (worker B) — the panel hides Configure
  // Questions on completed seminars. The parent passes
  // `effectiveStatus`; we re-derive from `endTime` as a fallback so a
  // missing or stale prop cannot leave the affordance open.
  const isSeminarCompleted =
    effectiveStatus === 'COMPLETED' ||
    deriveEffectiveStatus(undefined, endTime ?? null) === 'COMPLETED';

  const [reminderMessage, setReminderMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [aiSummary, setAiSummary] = useState<SeminarFeedbackSummary | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Fetch dynamic questions if not provided
  useEffect(() => {
    let isMounted = true;
    if (initialQuestions && initialQuestions.length > 0) {
      setQuestions(initialQuestions);
      return;
    }
    void seminarService.getFeedbackQuestions(seminarId).then((qs) => {
      if (isMounted && qs && qs.length > 0) {
        setQuestions(qs);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [seminarId, initialQuestions]);

  // Hydrate the AI summary from the Seminar.feedbackJson string (ticket §32)
  // when the page opens, so the panel can show "last generated" before any
  // click. The BE returns this in `GET /api/Seminar/{id}` and we parse it
  // via the canonical `parseAiFeedback` helper.
  useEffect(() => {
    if (!initialAiSummaryJson) {
      setAiSummary(null);
      return;
    }
    const parsedContent = parseAiFeedback(initialAiSummaryJson);
    if (!parsedContent) return;
    setAiSummary({
      seminarId,
      feedbackCount: feedback.length || 0,
      summary: parsedContent.overallAssessment,
      highlights: parsedContent.commonStrengths,
      concerns: [
        ...parsedContent.areasForImprovement,
        ...parsedContent.commonSuggestions,
        ...parsedContent.conflictingFeedback,
      ],
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
        t('feedback.aiError');
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
    () => feedback.filter((row) => isParticipantSubmitted(row)).length,
    [feedback],
  );

  /**
   * True when the parsed AI summary content contains Vietnamese diacritics,
   * meaning the BE-generated summary is in Vietnamese and the FE should show
   * a bilingual notice. The user must explicitly click "Regenerate" — this
   * never auto-triggers a paid POST.
   */
  const isVietnameseSummary = useMemo(() => {
    if (!initialAiSummaryJson) return false;
    return containsVietnameseDiacritics(initialAiSummaryJson);
  }, [initialAiSummaryJson]);

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
            ? t('feedback.action.reminderSent', undefined, {
                count: result.sent,
                skipped: result.skipped,
              })
            : t('feedback.action.noReminderNeeded'),
      });
      void loadStats();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        (err instanceof Error ? err.message : null) ??
        t('feedback.action.reminderError');
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
      const result = await seminarService.summarizeSeminarFeedback(seminarId);
      setAiSummary(result);
      onRefreshSeminar?.();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        (err instanceof Error ? err.message : null) ??
        t('feedback.action.aiError');
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
            <h3 className={styles.statsTitle}>{t('feedback.title')}</h3>
            <p className={styles.statsSubtitle}>
              {t('feedback.subtitle', undefined, { seminar: seminarTitle })}
            </p>
          </div>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => {
              void loadStats();
              void loadFeedback();
            }}
            aria-label={t('feedback.btnRefreshAria')}
            disabled={loadingFeedback}
          >
            <RefreshCw
              size={14}
              className={loadingFeedback ? styles.spinning : undefined}
              aria-hidden
            />
            {t('feedback.btnRefresh')}
          </button>
        </header>

        <div className={styles.statsGrid} role="list">
          <StatCell
            label={t('feedback.stats.totalInvited')}
            value={stats?.totalInvited ?? 0}
            icon={<Users size={16} aria-hidden />}
            tone="neutral"
          />
          <StatCell
            label={t('feedback.stats.submittedFeedback')}
            value={submittedCount}
            icon={<CheckCircle2 size={16} aria-hidden />}
            tone="success"
          />
          <StatCell
            label={t('feedback.stats.pendingFeedback')}
            value={stats?.pending ?? 0}
            icon={<Clock size={16} aria-hidden />}
            tone="warning"
          />
          <StatCell
            label={t('feedback.stats.declined')}
            value={stats?.declined ?? 0}
            icon={<XCircle size={16} aria-hidden />}
            tone="danger"
          />
          <StatCell
            label={t('feedback.stats.completion')}
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
            {t('feedback.progress.label', undefined, {
              submitted: submittedCount,
              total: stats?.totalInvited ?? 0,
            })}
          </span>
        </div>

        {/* Action row */}
        <div className={styles.actionRow}>
          {!isSeminarCompleted && (
            <button
              type="button"
              className={styles.setupBtn}
              onClick={() => setShowSetupModal(true)}
              data-testid="setup-feedback-form"
            >
              <Sliders size={14} aria-hidden />
              {t('feedback.action.configureQuestions')}
            </button>
          )}

          <button
            type="button"
            className={styles.previewBtn}
            onClick={() => setShowPreviewModal(true)}
            data-testid="preview-feedback-form"
          >
            <Eye size={14} aria-hidden />
            {t('feedback.action.previewForm')}
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
                {t('feedback.action.sending')}
              </>
            ) : (
              <>
                <Mail size={14} aria-hidden />
                {t('feedback.action.sendReminder')}
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
                {t('feedback.action.generatingAi')}
              </>
            ) : aiSummary ? (
              <>
                <RefreshCw size={14} aria-hidden />
                {t('feedback.action.regenerateAi')}
              </>
            ) : (
              <>
                <Brain size={14} aria-hidden />
                {t('feedback.action.generateAi')}
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
            {t('feedback.hint.noSubmissions')}
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
                {t('feedback.ai.title')}
              </h3>
              <p className={styles.aiSubtitle}>
                {t('feedback.ai.subtitle', undefined, {
                  count: aiSummary?.feedbackCount ?? submittedCount,
                })}
              </p>
            </div>
            {aiSummary && (
              <span className={styles.aiTimestamp}>
                {t('feedback.ai.generatedAt', undefined, { time: formatTime(aiSummary.generatedAt) })}
              </span>
            )}
          </header>

          {aiGenerating ? (
            <div className={styles.aiLoading} role="status">
              <Loader size={18} className={styles.spinning} aria-hidden />
              <div>
                <strong>{t('feedback.ai.generating')}</strong>
                <span>{t('feedback.ai.generatingDetail')}</span>
              </div>
            </div>
          ) : aiError ? (
            <div className={styles.aiError} role="alert">
              <AlertCircle size={14} aria-hidden />
              <span>{aiError}</span>
            </div>
          ) : aiSummary ? (
            <>
              {/* Bilingual note — shown only when the BE returned Vietnamese content.
                  This does NOT auto-trigger a regeneration; it is purely informational. */}
              {isVietnameseSummary && !aiGenerating && (
                <div className={styles.vietnameseNote} role="note">
                  <AlertCircle size={14} aria-hidden />
                  <div>
                    <strong>{t('feedback.vietnameseNote.title')}</strong>
                    <span>{t('feedback.vietnameseNote.body')}</span>
                  </div>
                </div>
              )}
              <AiSummaryBody summary={aiSummary} />
            </>
          ) : null}
        </section>
      )}

      {/* ── Raw participant feedback ───────────────────────────── */}
      <section className={styles.feedbackSection}>
        <header className={styles.feedbackHeader}>
          <h3 className={styles.feedbackTitle}>{t('feedback.raw.title')}</h3>
          <p className={styles.feedbackSubtitle}>
            {t('feedback.raw.subtitle')}
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
            {t('feedback.raw.loading')}
          </div>
        ) : feedback.length === 0 ? (
          <div className={styles.feedbackEmpty}>
            <Inbox size={20} aria-hidden />
            <div>
              <strong>{t('feedback.raw.empty.title')}</strong>
              <span>{t('feedback.raw.empty.body')}</span>
            </div>
          </div>
        ) : (
          <ul className={styles.feedbackList}>
            {feedback.map((row) => (
              <FeedbackCard
                key={row.seminarParticipantId}
                entry={row}
                questions={questions}
                t={t}
              />
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

      {/* ── Configure questions modal (host-only) ──────────── */}
      {showSetupModal && (
        <SeminarFeedbackSetupModal
          isOpen={showSetupModal}
          onClose={() => setShowSetupModal(false)}
          seminarId={seminarId}
          seminarTitle={seminarTitle}
          onSuccess={(updated) => {
            setQuestions(updated);
            onRefreshSeminar?.();
          }}
        />
      )}
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

const StatCell = ({
  label,
  value,
  icon,
  tone,
  isPrimary = false,
}: StatCellProps) => {
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
  questions?: FeedbackQuestion[];
  /** Injected by parent so the card can render translated button labels. */
  t: ReturnType<typeof useT>;
}

const FeedbackCard = ({ entry, questions, t }: FeedbackCardProps) => {
  const displayName =
    entry.userFullName ??
    entry.invitedEmail ??
    entry.userEmail ??
    `Participant #${entry.seminarParticipantId}`;

  const hasSubmission = isParticipantSubmitted(entry);
  const answers = parseParticipantAnswers(entry.feedbackJson);
  const initials = initialsOf(entry.userFullName, displayName);
  const [viewerOpen, setViewerOpen] = useState(false);
  const answerCount = answers.length;
  const hasQuestions = (questions ?? []).length > 0;

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
          <button
            type="button"
            className={styles.feedbackViewBtn}
            onClick={() => setViewerOpen(true)}
            disabled={!hasSubmission}
            title={
              hasSubmission
                ? t('feedback.raw.view', undefined, { 0: displayName })
                : `${displayName} has not submitted yet`
            }
            aria-label={
              hasSubmission
                ? `View raw feedback from ${displayName}`
                : `${displayName} has not submitted feedback yet`
            }
          >
            <Eye size={14} aria-hidden />
            {hasSubmission
              ? t('feedback.raw.viewN', undefined, { count: answerCount })
              : t('feedback.raw.view')}
          </button>
        </div>
        <div className={styles.feedbackMeta}>
          {entry.invitationStatus && (
            <span
              className={`${styles.feedbackStatusPill} ${
                entry.invitationStatus.toLowerCase() === 'submitted' ||
                hasSubmission
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
              {t('feedback.raw.submittedAt', undefined, { time: formatTime(entry.feedbackSubmittedAt) })}
            </span>
          )}
          {entry.feedbackUpdatedAt &&
            entry.feedbackUpdatedAt !== entry.feedbackSubmittedAt && (
              <span className={styles.feedbackTime}>
                {t('feedback.raw.updatedAt', undefined, { time: formatTime(entry.feedbackUpdatedAt) })}
              </span>
            )}
        </div>
      </header>

      {!hasSubmission && (
        <div className={styles.feedbackCardEmpty}>
          <Quote size={14} aria-hidden />
          <span>{t('feedback.raw.noSubmission')}</span>
        </div>
      )}

      <RawFeedbackViewModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        entry={entry}
        questions={questions}
      />
    </li>
  );
};

interface AiSummaryBodyProps {
  summary: SeminarFeedbackSummary;
}

const AiSummaryBody = ({ summary }: AiSummaryBodyProps) => {
  const t = useT();
  const sections: Array<{
    icon: React.ReactNode;
    labelKey: string;
    items: string[];
    variant: 'strength' | 'improvement' | 'suggestion' | 'neutral';
  }> = [
    {
      icon: <ThumbsUp size={14} aria-hidden />,
      labelKey: 'feedback.ai.commonStrengths',
      items: summary.highlights,
      variant: 'strength',
    },
    {
      icon: <Wrench size={14} aria-hidden />,
      labelKey: 'feedback.ai.areasForImprovement',
      items: summary.concerns,
      variant: 'improvement',
    },
  ];

  return (
    <div className={styles.aiBody}>
      <section className={styles.aiOverall}>
        <span className={styles.aiOverallLabel}>{t('feedback.ai.overallAssessment')}</span>
        <p className={styles.aiOverallText}>{summary.summary}</p>
      </section>

      <div className={styles.aiSectionsGrid}>
        {sections.map((section) =>
          section.items.length === 0 ? null : (
            <AiSummaryList
              key={section.labelKey}
              icon={section.icon}
              label={t(section.labelKey)}
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

const AiSummaryList = ({
  icon,
  label,
  items,
  variant,
}: AiSummaryListProps) => (
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

export default SeminarFeedbackPanel;
