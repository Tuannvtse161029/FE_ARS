import React, { useEffect, useState } from 'react';
import { AlertCircle, Calendar, Clock, Info, Loader2, X } from 'lucide-react';
import {
  phasedReportService,
  type PhasedReport,
} from '../../services/phasedReport.service';
import { useLocale } from '../../i18n/I18nContext';
import styles from './ExtendDeadlineModal.module.css';

export interface ExtendDeadlineModalProps {
  isOpen: boolean;
  report: PhasedReport | null;
  groupName?: string;
  onClose: () => void;
  onSuccess: (updatedReport: PhasedReport) => void;
}

export const ExtendDeadlineModal: React.FC<ExtendDeadlineModalProps> = ({
  isOpen,
  report,
  groupName,
  onClose,
  onSuccess,
}) => {
  const locale = useLocale();
  const copy = (en: string, vi: string) => (locale === 'en' ? en : vi);

  const [deadlineInput, setDeadlineInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize deadline input when modal opens
  useEffect(() => {
    if (isOpen && report) {
      setError(null);
      // Default new deadline: 7 days from current deadline (or 7 days from now)
      const base = report.deadlineAt ? new Date(report.deadlineAt) : new Date();
      const defaultDate = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      // Format as YYYY-MM-DDTHH:mm for datetime-local input
      const year = defaultDate.getFullYear();
      const month = String(defaultDate.getMonth() + 1).padStart(2, '0');
      const day = String(defaultDate.getDate()).padStart(2, '0');
      const hours = String(defaultDate.getHours()).padStart(2, '0');
      const minutes = String(defaultDate.getMinutes()).padStart(2, '0');
      setDeadlineInput(`${year}-${month}-${day}T${hours}:${minutes}`);
    }
  }, [isOpen, report]);

  if (!isOpen || !report) return null;

  const reportId = report.id ?? report.phasedReportId;
  const phaseNum = report.phaseNumber ?? 1;
  const phaseTitle = report.milestoneTitle || `${copy('Phase', 'Giai đoạn')} ${phaseNum}`;
  const displayGroup = groupName || report.groupName || copy('Research Group', 'Nhóm nghiên cứu');

  const formatDisplayDate = (iso?: string | null) => {
    if (!iso) return copy('No deadline set', 'Chưa đặt hạn chót');
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportId) {
      setError(copy('Invalid report ID.', 'Mã báo cáo không hợp lệ.'));
      return;
    }
    if (!deadlineInput) {
      setError(copy('Please select a new deadline.', 'Vui lòng chọn hạn chót mới.'));
      return;
    }

    const newDate = new Date(deadlineInput);
    if (Number.isNaN(newDate.getTime())) {
      setError(copy('Invalid date format.', 'Định dạng ngày giờ không hợp lệ.'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await phasedReportService.extendDeadline(reportId, {
        deadlineAt: newDate.toISOString(),
      });
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      const resp = (err as { response?: { data?: { message?: string; title?: string } } })?.response;
      const msg =
        resp?.data?.message ||
        resp?.data?.title ||
        (err instanceof Error ? err.message : '') ||
        copy('Failed to extend deadline.', 'Không thể gia hạn deadline.');
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="extend-deadline-title">
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleWrap}>
            <h3 id="extend-deadline-title" className={styles.modalTitle}>
              {copy('Extend Phase Deadline', 'Gia Hạn Hạn Nộp Báo Cáo')}
            </h3>
            <span className={styles.modalSubtitle}>
              {copy('Phase', 'Giai đoạn')} {phaseNum}: {phaseTitle}
            </span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={copy('Close', 'Đóng')}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.infoBlock}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>
              <Calendar size={13} aria-hidden /> {copy('Research Group', 'Nhóm nghiên cứu')}:
            </span>
            <span className={styles.infoValue}>{displayGroup}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>
              <Clock size={13} aria-hidden /> {copy('Current Deadline', 'Hạn chót hiện tại')}:
            </span>
            <span className={styles.infoValue}>{formatDisplayDate(report.deadlineAt)}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>
              {copy('Current Status', 'Trạng thái hiện tại')}:
            </span>
            <span className={styles.infoValue}>{report.status || 'Pending'}</span>
          </div>
        </div>

        <div className={styles.noticeBox}>
          <Info size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            {copy(
              'Extending the deadline will automatically reset this report status to "Pending", allowing students to submit or resubmit their progress report.',
              'Gia hạn deadline sẽ tự động chuyển trạng thái báo cáo về "Pending", cho phép sinh viên nộp hoặc nộp lại báo cáo tiến độ.',
            )}
          </span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="extend-deadline-input">
              {copy('New Deadline (Date & Time)', 'Hạn chót mới (Ngày & Giờ)')}
            </label>
            <input
              id="extend-deadline-input"
              type="datetime-local"
              className={styles.inputDate}
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {error && (
            <div className={styles.errorBanner} role="alert">
              <AlertCircle size={15} aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.btnCancel}
              onClick={onClose}
              disabled={isSubmitting}
            >
              {copy('Cancel', 'Hủy')}
            </button>
            <button
              type="submit"
              className={styles.btnSubmit}
              disabled={isSubmitting || !deadlineInput}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className={styles.spinning} aria-hidden />
                  {copy('Updating…', 'Đang cập nhật…')}
                </>
              ) : (
                <>
                  <Clock size={15} aria-hidden />
                  {copy('Update Deadline', 'Cập Nhật Hạn Chót')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExtendDeadlineModal;
