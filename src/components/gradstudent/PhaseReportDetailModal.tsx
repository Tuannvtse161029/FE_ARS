import React, { useEffect } from 'react';
import {
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  MessageSquare,
  Star,
  User,
  X,
} from 'lucide-react';
import type { SubmittedPhasedReport } from '../../services/phasedReport.service';
import { StatusBadge } from '../lecturer/StatusBadge';
import { Button } from '../Button/Button';
import { useLocale } from '../../i18n/I18nContext';
import styles from './PhaseReportDetailModal.module.css';

export interface PhaseReportDetailModalProps {
  isOpen: boolean;
  report: SubmittedPhasedReport | null;
  groupName?: string;
  topicTitle?: string;
  lecturerName?: string;
  onClose: () => void;
}

export const PhaseReportDetailModal: React.FC<PhaseReportDetailModalProps> = ({
  isOpen,
  report,
  groupName,
  topicTitle,
  lecturerName,
  onClose,
}) => {
  const locale = useLocale();
  const copy = (en: string, vi: string): string => (locale === 'en' ? en : vi);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !report) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const hasEvaluation =
    typeof report.lectureFeedback === 'number' ||
    Boolean(report.finalOutcomeEvaluation) ||
    Boolean(report.lecturerDescription) ||
    Boolean(report.capacityEvaluation);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="phase-report-detail-title"
      onClick={handleOverlayClick}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 id="phase-report-detail-title" className={styles.title}>
              {report.milestoneTitle || `Phase ${report.phaseNumber ?? ''} Report`}
            </h2>
            <span className={styles.subtitle}>
              {groupName ? `${copy('Group', 'Nhóm')}: ${groupName}` : ''}
              {topicTitle ? ` · ${copy('Topic', 'Đề tài')}: ${topicTitle}` : ''}
              {lecturerName ? ` · ${copy('Lecturer', 'Giảng viên')}: ${lecturerName}` : ''}
            </span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={copy('Close', 'Đóng')}
          >
            <X size={18} />
          </button>
        </header>

        <div className={styles.body}>
          {/* Metadata Grid */}
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>{copy('Phase', 'Giai đoạn')}</span>
              <span className={styles.metaValue}>
                Phase {report.phaseNumber ?? report.id}
              </span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>{copy('Status', 'Trạng thái')}</span>
              <div className={styles.metaValue}>
                <StatusBadge status={report.status} size="sm" />
                {report.isOverdue ? (
                  <span className={styles.overdueBadge}>{copy('Overdue', 'Quá hạn')}</span>
                ) : report.submittedAt && report.deadlineAt ? (
                  <span className={styles.onTimeBadge}>{copy('On time', 'Đúng hạn')}</span>
                ) : null}
              </div>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>{copy('Deadline', 'Hạn nộp (Deadline)')}</span>
              <span className={styles.metaValue}>
                <Clock size={14} color="#64748b" />
                {report.deadlineAt
                  ? new Date(report.deadlineAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : copy('No deadline', 'Không có hạn chót')}
              </span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>{copy('Submitted Date', 'Ngày nộp bài')}</span>
              <span className={styles.metaValue}>
                <Calendar size={14} color="#64748b" />
                {report.submittedAt
                  ? new Date(report.submittedAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : copy('Not submitted', 'Chưa nộp bài')}
              </span>
            </div>
            {report.studentName && (
              <div className={styles.metaItem} style={{ gridColumn: 'span 2' }}>
                <span className={styles.metaLabel}>{copy('Submitted by', 'Người nộp báo cáo')}</span>
                <span className={styles.metaValue}>
                  <User size={14} color="#64748b" />
                  {report.studentName}
                </span>
              </div>
            )}
          </div>

          {/* Attached Document Section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <FileText size={16} color="#0284c7" />
              {copy('Submitted Report Document', 'Tài liệu báo cáo đã nộp')}
            </h3>
            {report.reportFileUrl ? (
              <div className={styles.fileCard}>
                <div className={styles.fileInfo}>
                  <FileText size={24} className={styles.fileIcon} />
                  <div className={styles.fileName}>
                    {report.milestoneTitle || `${copy('Phase Report', 'Báo cáo giai đoạn')} ${report.phaseNumber ?? ''}`}.pdf
                  </div>
                </div>
                <a
                  href={report.reportFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.openFileBtn}
                >
                  <ExternalLink size={14} /> {copy('View PDF', 'Xem PDF')}
                </a>
              </div>
            ) : (
              <div className={styles.noEval}>
                {copy('No PDF report attached for this phase.', 'Chưa có tệp tài liệu PDF nào được đính kèm cho giai đoạn này.')}
              </div>
            )}
          </div>

          {/* Lecturer Evaluation Section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <MessageSquare size={16} color="#16a34a" />
              {copy('Lecturer Evaluation & Feedback', 'Đánh giá & Nhận xét của Giảng viên')}
            </h3>
            {hasEvaluation ? (
              <div className={styles.evalCard}>
                {typeof report.lectureFeedback === 'number' && (
                  <div className={styles.scoreRow}>
                    <span className={styles.evalLabel}>{copy('Evaluation Score:', 'Điểm đánh giá:')}</span>
                    <span className={styles.scorePill}>
                      <Star size={14} fill="#ffffff" />
                      {report.lectureFeedback} / 10
                    </span>
                  </div>
                )}
                {report.lecturerDescription && (
                  <div className={styles.evalItem}>
                    <span className={styles.evalLabel}>{copy('Lecturer Feedback:', 'Nhận xét của Giảng viên:')}</span>
                    <p className={styles.evalText}>{report.lecturerDescription}</p>
                  </div>
                )}
                {report.finalOutcomeEvaluation && (
                  <div className={styles.evalItem}>
                    <span className={styles.evalLabel}>{copy('Outcome Evaluation:', 'Kết luận nghiệm thu:')}</span>
                    <p className={styles.evalText}>{report.finalOutcomeEvaluation}</p>
                  </div>
                )}
                {report.capacityEvaluation && (
                  <div className={styles.evalItem}>
                    <span className={styles.evalLabel}>{copy('Capacity Evaluation:', 'Đánh giá năng lực:')}</span>
                    <p className={styles.evalText}>{report.capacityEvaluation}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.noEval}>
                {copy('This report is awaiting lecturer review and evaluation.', 'Báo cáo đang chờ Giảng viên phụ trách xem xét và cho điểm đánh giá.')}
              </div>
            )}
          </div>
        </div>

        <footer className={styles.footer}>
          <Button variant="secondary" size="md" onClick={onClose}>
            {copy('Close', 'Đóng')}
          </Button>
        </footer>
      </div>
    </div>
  );
};

export default PhaseReportDetailModal;
