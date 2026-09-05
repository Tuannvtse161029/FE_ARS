/**
 * SeminarList — seminar list with cards and pagination
 *
 * Extracted from src/pages/Lecturer/SeminarWorkspace.tsx
 */
import { useState } from 'react';
import {
  Calendar,
  Clock,
  Video,
  Eye,
  ClipboardList,
  Mail,
  Inbox,
  Lock,
} from 'lucide-react';
import { useLocale } from '../../../i18n/I18nContext';
import {
  GOOGLE_MEET_FREE_PARTICIPANT_CAP,
  isValidMeetLink,
  ownsSeminar,
  type SeminarCard,
} from '../../../services/seminar.service';
import type { SeminarBackendAvailability } from '../../../hooks/useSeminar';
import { formatDisplayDate, formatDisplayTime } from '../../../utils/datetime';
import { EmptyState } from '../../../components/EmptyState';
import { SkeletonRow } from '../../../components/SkeletonRow';
import { GoogleMeetCapacityMeter } from '../../../components/seminar/GoogleMeetCapacityMeter';
import { SeminarFeedbackModal } from '../../../components/seminar/SeminarFeedbackModal';
import { SeminarFeedbackModalShell } from '../../../components/seminar/SeminarFeedbackModalShell';
import { SeminarFeedbackPanel } from '../../../components/seminar/SeminarFeedbackPanel';
import { AudioSummaryModal } from '../../../components/seminar/AudioSummaryModal';
// CSS module kept at the original SeminarWorkspace CSS location for now.
import styles from '../../../pages/Lecturer/SeminarWorkspace.module.css';

export interface SeminarListProps {
  filteredSeminars: SeminarCard[];
  paginatedPage: number;
  paginatedTotalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  isLoading: boolean;
  backendAvailability: SeminarBackendAvailability;
  canModify: boolean;
  currentUserId: number | null;
  currentRole: string | null;
  onRefetch: () => void;
  onShowSuccess: (text: string) => void;
}

const formatSeminarId = (id: number): string =>
  `SEM-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`;

export const SeminarList: React.FC<SeminarListProps> = ({
  filteredSeminars,
  paginatedPage,
  paginatedTotalPages,
  onPageChange,
  pageSize,
  isLoading,
  backendAvailability,
  canModify,
  currentUserId,
  currentRole,
  onRefetch,
  onShowSuccess,
}) => {
  const locale = useLocale();
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedSeminarForFeedback, setSelectedSeminarForFeedback] = useState<SeminarCard | null>(null);
  const [showAttendeeFeedbackModal, setShowAttendeeFeedbackModal] = useState(false);
  const [selectedSeminarForAttendeeFeedback, setSelectedSeminarForAttendeeFeedback] = useState<SeminarCard | null>(null);
  const [isAttendeeFeedbackPreview, setIsAttendeeFeedbackPreview] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [selectedSeminarForAi, setSelectedSeminarForAi] = useState<SeminarCard | null>(null);

  const paginatedSeminars = filteredSeminars.slice((paginatedPage - 1) * pageSize, paginatedPage * pageSize);

  const handleOpenFeedbackModal = (sem: SeminarCard) => {
    setSelectedSeminarForFeedback(sem);
    setShowFeedbackModal(true);
  };

  const handleOpenAiSummary = (sem: SeminarCard) => {
    setSelectedSeminarForAi(sem);
    setShowAiModal(true);
  };

  return (
    <>
      {isLoading ? (
        <SkeletonRow count={4} withHeader />
      ) : backendAvailability !== 'full' ? (
        <EmptyState icon={<Lock size={20} aria-hidden />} title="Seminars are temporarily unavailable" description="The backend did not provide a readable seminar list for this session." />
      ) : filteredSeminars.length === 0 ? (
        <EmptyState icon={<Inbox size={20} aria-hidden />} title="No seminars yet" description={canModify ? 'Click "Create Seminar" to schedule your first one.' : 'No seminars scheduled or invited at this time.'} />
      ) : (
        <ul className={styles.list}>
          {paginatedSeminars.map((sem) => {
            const seminarStartDate = sem.startTime ? new Date(sem.startTime) : null;
            const seminarEndDate = sem.endTime ? new Date(sem.endTime) : null;
            const dateLabel = seminarStartDate ? formatDisplayDate(seminarStartDate, locale) : '';
            const timeLabel = seminarStartDate && seminarEndDate && !Number.isNaN(seminarStartDate.getTime())
              ? `${formatDisplayTime(seminarStartDate, locale)} – ${formatDisplayTime(seminarEndDate, locale)}`
              : '';
            const isCompleted = sem.effectiveStatus === 'COMPLETED' || sem.status === 'COMPLETED';
            const owns = ownsSeminar(sem, currentUserId, currentRole);
            const showAi = canModify && owns && isCompleted;
            const showFeedbackOrganizer = canModify && owns && isCompleted;
            return (
              <li className={styles.seminarCard} key={sem.seminarId}>
                <div className={styles.cardTopRow}>
                  <div className={styles.metaRow}>
                    <span className={styles.metaBadge}>ID {formatSeminarId(sem.seminarId)}</span>
                  </div>
                  <div className={styles.dateMeta}>
                    <span className={styles.dateMetaInline}><Calendar size={12} aria-hidden />{dateLabel}</span>
                    <span className={styles.dateMetaInline}><Clock size={12} aria-hidden />{timeLabel}</span>
                  </div>
                </div>

                <div className={styles.cardTitleRow}>
                  <h3 className={styles.cardTitle}>{sem.title}</h3>
                  <span className={`${styles.statusBadge} ${styles[`statusBadge_${sem.effectiveStatus.replace(/\s+/g, '_')}`] ?? ''}`}>
                    {sem.effectiveStatus === 'IN PROGRESS' && <span className={styles.statusPulse} aria-hidden="true" />}
                    <span>{sem.effectiveStatus}</span>
                  </span>
                </div>
                <p className={styles.cardDescription}>{sem.content || 'No description provided.'}</p>

                {isValidMeetLink(sem.onlineLink) && !isCompleted && (
                  <div className={styles.capacityWrapper}>
                    <GoogleMeetCapacityMeter
                      current={sem.participantCount || 0}
                      cap={sem.maxParticipants && sem.maxParticipants > 0 ? Math.min(sem.maxParticipants, GOOGLE_MEET_FREE_PARTICIPANT_CAP) : GOOGLE_MEET_FREE_PARTICIPANT_CAP}
                      compact
                    />
                  </div>
                )}

                {isValidMeetLink(sem.onlineLink) && (
                  <div className={styles.meetBox}>
                    <Video size={14} aria-hidden />
                    <a href={sem.onlineLink} className={styles.meetLink} target="_blank" rel="noopener noreferrer">{sem.onlineLink}</a>
                  </div>
                )}

                {isCompleted && (
                  <div className={styles.progressBlock}>
                    <div className={styles.progressLabels}>
                      <span>Feedback submissions</span>
                      <span className={styles.progressValue}>{sem.feedbackSubmitted}/{sem.feedbackTotal}</span>
                    </div>
                    <div className={styles.progressBarBg}>
                      <div className={styles.progressBarFill} style={{ width: sem.feedbackTotal > 0 ? `${(sem.feedbackSubmitted / sem.feedbackTotal) * 100}%` : '0%' }} />
                    </div>
                  </div>
                )}

                <div className={styles.cardActions}>
                  {isCompleted ? (
                    <>
                      {showAi && (
                        <button type="button" className={styles.actionBtnOutline} onClick={() => handleOpenAiSummary(sem)}>
                          <Eye size={14} aria-hidden /> View Notes
                        </button>
                      )}
                      {showFeedbackOrganizer ? (
                        <button type="button" className={styles.actionBtnPrimary} onClick={() => handleOpenFeedbackModal(sem)}>
                          <ClipboardList size={14} aria-hidden /> Feedback &amp; Grading
                        </button>
                      ) : (
                        <button type="button" className={styles.actionBtnPrimary} onClick={() => {
                          setSelectedSeminarForAttendeeFeedback(sem);
                          setIsAttendeeFeedbackPreview(false);
                          setShowAttendeeFeedbackModal(true);
                        }}>
                          <ClipboardList size={14} aria-hidden /> Submit Feedback
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button type="button" className={styles.actionBtnPrimary} onClick={() => window.open(sem.onlineLink, '_blank')} disabled={!isValidMeetLink(sem.onlineLink)}>
                        <Video size={14} aria-hidden /> Join Google Meet
                      </button>
                      {canModify && owns && (
                        <button type="button" className={styles.actionBtnOutline} onClick={() => { navigator.clipboard.writeText(sem.onlineLink ?? ''); onShowSuccess('Invite link copied.'); }} disabled={!isValidMeetLink(sem.onlineLink)}>
                          <Mail size={14} aria-hidden /> Send Invite Link
                        </button>
                      )}
                      <button type="button" className={styles.actionBtnOutline} onClick={() => {
                        setSelectedSeminarForAttendeeFeedback(sem);
                        setIsAttendeeFeedbackPreview(true);
                        setShowAttendeeFeedbackModal(true);
                      }} aria-label={`Preview feedback form for ${sem.title}`}>
                        <ClipboardList size={14} aria-hidden /> Preview feedback form
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {paginatedTotalPages > 1 && (
        <div className={styles.paginationRow}>
          <button type="button" className={styles.paginationBtn} onClick={() => onPageChange(Math.max(1, paginatedPage - 1))} disabled={paginatedPage <= 1}>
            Previous
          </button>
          <span className={styles.paginationLabel}>Page {paginatedPage} of {paginatedTotalPages}</span>
          <button type="button" className={styles.paginationBtn} onClick={() => onPageChange(Math.min(paginatedTotalPages, paginatedPage + 1))} disabled={paginatedPage >= paginatedTotalPages}>
            Next
          </button>
        </div>
      )}

      {/* Feedback Modals */}
      {showFeedbackModal && selectedSeminarForFeedback && (
        <SeminarFeedbackModalShell
          seminarTitle={selectedSeminarForFeedback.title}
          startTime={selectedSeminarForFeedback.startTime}
          endTime={selectedSeminarForFeedback.endTime}
          onClose={() => { setShowFeedbackModal(false); setSelectedSeminarForFeedback(null); }}
        >
          <SeminarFeedbackPanel
            seminarId={selectedSeminarForFeedback.seminarId}
            seminarTitle={selectedSeminarForFeedback.title}
            initialAiSummaryJson={typeof selectedSeminarForFeedback.aiSummary === 'string' ? selectedSeminarForFeedback.aiSummary : null}
            initialAiGeneratedAt={(selectedSeminarForFeedback as { aiFeedbackGeneratedAt?: string | null }).aiFeedbackGeneratedAt ?? null}
            onRefreshSeminar={onRefetch}
          />
        </SeminarFeedbackModalShell>
      )}

      {showAiModal && selectedSeminarForAi && (
        <AudioSummaryModal
          seminarId={selectedSeminarForAi.seminarId}
          seminarTitle={selectedSeminarForAi.title}
          isOpen={showAiModal}
          initialAiSummary={selectedSeminarForAi.aiSummary ?? null}
          onClose={() => setShowAiModal(false)}
          onSuccess={(id) => { onRefetch(); void id; }}
        />
      )}

      {showAttendeeFeedbackModal && selectedSeminarForAttendeeFeedback && (
        <SeminarFeedbackModal
          isOpen={showAttendeeFeedbackModal}
          onClose={() => { setShowAttendeeFeedbackModal(false); setIsAttendeeFeedbackPreview(false); }}
          seminarId={selectedSeminarForAttendeeFeedback.seminarId}
          seminarTitle={selectedSeminarForAttendeeFeedback.title}
          previewMode={isAttendeeFeedbackPreview}
          onSuccess={onRefetch}
        />
      )}
    </>
  );
};

export default SeminarList;
