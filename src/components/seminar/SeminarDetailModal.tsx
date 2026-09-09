/**
 * SeminarDetailModal
 *
 * Read-only pop-up that the lecturer can open from the "Seminar Detail"
 * button on any seminar card. Displays:
 *
 *   • Title
 *   • Description (full content from the BE)
 *   • Date / time — start and end, rendered in the user's locale via
 *     the same `parseApiDateTimeAsUtc()` helper used by the rest of the
 *     FE so we don't drift from the workspace time-zone.
 *   • Invited participants — full list of rows from `seminar.participants`
 *     with name, email, and current invitation status.
 *
 * No mutations happen here — it is purely informational. All styling uses
 * the ARS Paper Day tokens (see `src/styles/ars-tokens.css`).
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  Calendar,
  Clock,
  Mail,
  Users,
  X,
} from 'lucide-react';
import type { SeminarCard } from '../../services/seminar.service';
import {
  parseApiDateTimeAsUtc,
  formatDisplayDate,
  formatDisplayTime,
} from '../../utils/datetime';
import { useLocale } from '../../i18n/I18nContext';
import styles from './SeminarDetailModal.module.css';

interface SeminarDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  seminar: SeminarCard | null;
}

const STATUS_LABELS: Record<string, { en: string; vi: string; tone: string }> = {
  Pending: { en: 'Pending', vi: 'Đang chờ', tone: 'pending' },
  Invited: { en: 'Invited', vi: 'Đã mời', tone: 'invited' },
  Accepted: { en: 'Accepted', vi: 'Đã chấp nhận', tone: 'accepted' },
  Declined: { en: 'Declined', vi: 'Đã từ chối', tone: 'declined' },
  Attended: { en: 'Attended', vi: 'Đã tham dự', tone: 'attended' },
  Completed: { en: 'Completed', vi: 'Hoàn thành', tone: 'completed' },
};

const normalizeStatusKey = (raw: string | null | undefined): string => {
  if (!raw) return 'Pending';
  const trimmed = raw.trim();
  // Match exact keys first (case-insensitive), then fall back to the first
  // capitalized word — covers common serializer quirks.
  const exact = Object.keys(STATUS_LABELS).find(
    (k) => k.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exact) return exact;
  return (
    trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
  );
};

export const SeminarDetailModal: React.FC<SeminarDetailModalProps> = ({
  isOpen,
  onClose,
  seminar,
}) => {
  const locale = useLocale();
  const isVi = locale === 'vi';
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Escape closes the modal — same convention as the other seminar modals.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Focus the close button on open for keyboard users.
  useEffect(() => {
    if (isOpen) closeBtnRef.current?.focus();
  }, [isOpen]);

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const participants = useMemo(
    () => seminar?.participants ?? [],
    [seminar?.participants],
  );

  const startDate = seminar ? parseApiDateTimeAsUtc(seminar.startTime) : null;
  const endDate = seminar ? parseApiDateTimeAsUtc(seminar.endTime) : null;

  if (!isOpen || !seminar) return null;

  const startDateLabel = startDate ? formatDisplayDate(startDate, locale) : '';
  const startTimeLabel = startDate ? formatDisplayTime(startDate, locale) : '';
  const endTimeLabel = endDate ? formatDisplayTime(endDate, locale) : '';
  const hasEndTime = endDate != null;

  const description =
    seminar.content && seminar.content.trim().length > 0
      ? seminar.content
      : isVi
        ? 'Chưa có mô tả cho buổi hội thảo này.'
        : 'No description has been provided for this seminar yet.';

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="seminar-detail-title"
      onClick={(e) => {
        // Click-outside closes the modal.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon} aria-hidden>
              <Calendar size={18} />
            </div>
            <div className={styles.headerText}>
              <h2
                id="seminar-detail-title"
                className={styles.title}
              >
                {seminar.title}
              </h2>
              <p className={styles.subtitle}>
                {isVi
                  ? 'Thông tin chi tiết và danh sách người đã được mời.'
                  : 'Full seminar information and the list of invited participants.'}
              </p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={isVi ? 'Đóng' : 'Close'}
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className={styles.body}>
          {/* Description */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <FileTextGlyph />
              {isVi ? 'Mô tả' : 'Description'}
            </h3>
            <p className={styles.description}>{description}</p>
          </section>

          {/* Date & Time */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <Calendar size={14} aria-hidden />
              {isVi ? 'Ngày & giờ' : 'Date & time'}
            </h3>
            <div className={styles.dateTimeGrid}>
              <div className={styles.dateTimeItem}>
                <span className={styles.dateTimeLabel}>
                  {isVi ? 'Ngày bắt đầu' : 'Start date'}
                </span>
                <span className={styles.dateTimeValue}>
                  {startDateLabel ||
                    (isVi ? 'Chưa xác định' : 'Not scheduled')}
                </span>
              </div>
              <div className={styles.dateTimeItem}>
                <span className={styles.dateTimeLabel}>
                  <Clock size={12} aria-hidden />
                  {isVi ? 'Giờ bắt đầu' : 'Start time'}
                </span>
                <span className={styles.dateTimeValue}>
                  {startTimeLabel || '—'}
                </span>
              </div>
              {hasEndTime && (
                <div className={styles.dateTimeItem}>
                  <span className={styles.dateTimeLabel}>
                    <Clock size={12} aria-hidden />
                    {isVi ? 'Giờ kết thúc' : 'End time'}
                  </span>
                  <span className={styles.dateTimeValue}>
                    {endTimeLabel || '—'}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Participants */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <Users size={14} aria-hidden />
              {isVi ? 'Người đã được mời' : 'Invited participants'}
              <span className={styles.participantCount}>
                {' '}({participants.length})
              </span>
            </h3>
            {participants.length === 0 ? (
              <div className={styles.emptyParticipants}>
                <AlertTriangle size={14} aria-hidden />
                <span>
                  {isVi
                    ? 'Chưa có người tham dự nào được mời cho buổi hội thảo này.'
                    : 'No participants have been invited to this seminar yet.'}
                </span>
              </div>
            ) : (
              <ul className={styles.participantList}>
                {participants.map((p, idx) => {
                  const statusKey = normalizeStatusKey(p.invitationStatus);
                  const statusMeta =
                    STATUS_LABELS[statusKey] ?? STATUS_LABELS.Pending;
                  const name =
                    p.userFullName?.trim() ||
                    p.invitedEmail?.split('@')[0] ||
                    (isVi ? 'Người tham dự' : 'Participant');
                  const email =
                    p.userEmail?.trim() ||
                    p.invitedEmail?.trim() ||
                    (isVi
                      ? 'Chưa có địa chỉ email'
                      : 'No email address on file');
                  const statusLabel = isVi
                    ? statusMeta.vi
                    : statusMeta.en;
                  return (
                    <li
                      key={`${p.seminarParticipantId ?? `${p.userId ?? 'x'}_${idx}`}`}
                      className={styles.participantRow}
                    >
                      <div className={styles.participantAvatar}>
                        {name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className={styles.participantInfo}>
                        <span className={styles.participantName}>
                          {name}
                        </span>
                        <span className={styles.participantEmail}>
                          <Mail size={11} aria-hidden /> {email}
                        </span>
                      </div>
                      <span
                        className={`${styles.statusChip} ${styles[`statusChip_${statusMeta.tone}`] ?? ''}`}
                      >
                        {statusLabel}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.closeFooterBtn}
            onClick={onClose}
          >
            {isVi ? 'Đóng' : 'Close'}
          </button>
        </footer>
      </div>
    </div>
  );
};

// Local FileText glyph — keeps the import surface tight and lets us style
// it the same way as the other section icons.
const FileTextGlyph: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export default SeminarDetailModal;
