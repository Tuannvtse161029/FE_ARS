import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import styles from './ResolveReportModal.module.css';
import type {
  ViolationReport,
  ViolationResolutionAction,
} from '../../types/adminAuxiliary';
import { useI18n, useLocale } from '../../i18n/I18nContext';

interface ResolveReportModalProps {
  report: ViolationReport | null;
  isOpen: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: (
    reportId: number,
    action: ViolationResolutionAction,
    note: string,
  ) => Promise<void> | void;
}

const AVAILABLE_ACTIONS: ViolationResolutionAction[] = ['DISMISS'];

export function ResolveReportModal({
  report,
  isOpen,
  isSubmitting,
  errorMessage,
  onClose,
  onConfirm,
}: ResolveReportModalProps): JSX.Element | null {
  const { t } = useI18n();
  const locale = useLocale();
  const intlTag = locale === 'en' ? 'en-US' : 'vi-VN';
  const [selectedAction, setSelectedAction] = useState<ViolationResolutionAction>(
    'DISMISS',
  );
  const [note, setNote] = useState('');

  const isReadOnly = report?.status !== 'PENDING';

  // Reset internal state every time the modal re-opens so a stale note/action
  // from a previous report doesn't bleed into the next one.
  useEffect(() => {
    if (isOpen) {
      setSelectedAction('DISMISS');
      setNote('');
    }
  }, [isOpen, report?.reportId]);

  if (!isOpen || !report) return null;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (isReadOnly) {
      onClose();
      return;
    }
    await onConfirm(report.reportId, selectedAction, note.trim());
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget && !isSubmitting) onClose();
  };

  const getActionLabel = (action: ViolationResolutionAction): string => {
    switch (action) {
      case 'DISMISS':
        return t('admin.contentReports.modal.actionDismiss', 'Dismiss Report');
      case 'DELETE_CONTENT_WARN':
        return t('admin.contentReports.modal.actionDeleteWarn', 'Delete Content & Send Warning');
      case 'DELETE_CONTENT_SUSPEND_14D':
        return t('admin.contentReports.modal.actionDeleteSuspend', 'Delete Content & Suspend User (14 days)');
    }
  };

  const getActionDescription = (action: ViolationResolutionAction): string => {
    switch (action) {
      case 'DISMISS':
        return t('admin.contentReports.modal.descDismiss', 'Mark the report as a false alarm. No content change, no user action.');
      case 'DELETE_CONTENT_WARN':
        return t('admin.contentReports.modal.descDeleteWarn', 'Remove the offending content from the platform and email the author a warning.');
      case 'DELETE_CONTENT_SUSPEND_14D':
        return t('admin.contentReports.modal.descDeleteSuspend', "Remove the offending content and suspend the author's account for 14 days. The audit log records both actions.");
    }
  };

  const getTargetTypeLabel = (): string => {
    if (report.type === 'FORUM_POST') {
      return t('admin.contentReports.table.typeForumPost', 'Forum Post');
    }
    if (report.type === 'FORUM_COMMENT') {
      return t('admin.contentReports.table.typeForumComment', 'Forum Comment');
    }
    return t('admin.contentReports.table.typeResearchPaper', 'Research Paper');
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="resolve-report-title"
      onClick={handleOverlayClick}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 id="resolve-report-title" className={styles.title}>
            {isReadOnly
              ? t('admin.contentReports.modal.viewTitle', `Violation report details #${report.reportId}`, { reportId: report.reportId })
              : t('admin.contentReports.modal.resolveTitle', `Resolve violation report #${report.reportId}`, { reportId: report.reportId })}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            aria-label={t('common.close', 'Close')}
            onClick={onClose}
            disabled={isSubmitting}
          >
            ×
          </button>
        </header>

        <div className={`${styles.content} ${isReadOnly ? styles.contentSingleCol : ''}`}>
          <section className={styles.leftPane}>
            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>{t('admin.contentReports.table.type', 'Report type')}</span>
                <span className={styles.metaValue}>{getTargetTypeLabel()}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>{t('admin.contentReports.table.status', 'Status')}</span>
                <span className={styles.metaValue}>
                  <span className={`${styles.statusBadge} ${styles[`status_${report.status}`] ?? ''}`}>
                    {t(`common.status.${report.status.toLowerCase()}`, report.status)}
                  </span>
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>{t('admin.contentReports.modal.targetContentId', 'Target Content ID')}</span>
                <span className={styles.metaValue}>
                  #{report.targetContentId}
                  {report.type === 'FORUM_POST' || report.type === 'FORUM_COMMENT' ? (
                    <a
                      href="/forum"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.viewContentLink}
                      title={t('admin.contentReports.modal.viewInForum', 'View in Forum')}
                    >
                      <ExternalLink size={12} /> {t('admin.contentReports.modal.viewInForum', 'View in Forum')}
                    </a>
                  ) : report.type === 'RESEARCH_PAPER' ? (
                    <a
                      href={`/admin/paper-submissions/${report.targetContentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.viewContentLink}
                      title={t('admin.contentReports.modal.viewPaper', 'View Paper')}
                    >
                      <ExternalLink size={12} /> {t('admin.contentReports.modal.viewPaper', 'View Paper')}
                    </a>
                  ) : null}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>{t('admin.contentReports.table.targetAuthor', 'Target author')}</span>
                <span className={styles.metaValue}>{report.targetAuthorName}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>{t('admin.contentReports.table.reportedBy', 'Reported by')}</span>
                <span className={styles.metaValue}>{report.reportedByName}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>{t('admin.contentReports.table.date', 'Filed')}</span>
                <span className={styles.metaValue}>
                  {new Date(report.date).toLocaleString(intlTag)}
                </span>
              </div>
              <div className={`${styles.metaItem} ${styles.metaItemFull}`}>
                <span className={styles.metaLabel}>{t('admin.contentReports.table.reason', 'Reason')}</span>
                <span className={styles.metaValue}>{report.reason}</span>
              </div>
            </div>

            <div className={styles.reportedContentBlock}>
              <span className={styles.metaLabel}>
                {t('admin.contentReports.table.reportedContent', 'Reported content')}
              </span>
              <blockquote className={styles.reportedContent}>
                {report.reportedContent && report.reportedContent !== '—'
                  ? report.reportedContent
                  : t('admin.contentReports.modal.noNotes', 'No additional notes recorded.')}
              </blockquote>
            </div>

            {!isReadOnly && (
              <>
                <label className={styles.fieldLabel} htmlFor="resolve-note">
                  {t('admin.contentReports.modal.notesLabel', 'Verification notes (internal)')}
                </label>
                <textarea
                  id="resolve-note"
                  className={styles.noteInput}
                  placeholder={t('admin.contentReports.modal.notesPlaceholder', 'Why are you resolving this way? (Optional; saved to the audit log.)')}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  disabled={isSubmitting}
                />
              </>
            )}
          </section>

          {!isReadOnly ? (
            <section className={styles.rightPane}>
              <h3 className={styles.actionsHeading}>
                {t('admin.contentReports.modal.chooseResolution', 'Choose resolution')}
              </h3>
              <div className={styles.actions}>
                {AVAILABLE_ACTIONS.map((a) => {
                  const selected = selectedAction === a;
                  return (
                    <button
                      type="button"
                      key={a}
                      className={`${styles.actionButton} ${selected ? styles.actionSelected : ''}`}
                      onClick={() => setSelectedAction(a)}
                      disabled={isSubmitting}
                    >
                      <span
                        className={`${styles.actionRadio} ${selected ? styles.actionRadioChecked : ''}`}
                        aria-hidden
                      />
                      <span>
                        <span className={styles.actionLabel}>{getActionLabel(a)}</span>
                        <span className={styles.actionDescription}>
                          {getActionDescription(a)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className={styles.rightPane}>
              <div className={styles.resolutionCard}>
                <h4 className={styles.resolutionCardTitle}>
                  {t('admin.contentReports.modal.resolutionDetails', 'Resolution Details')}
                </h4>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>{t('admin.contentReports.table.status', 'Status')}</span>
                  <span className={`${styles.statusBadge} ${styles[`status_${report.status}`] ?? ''}`}>
                    {t(`common.status.${report.status.toLowerCase()}`, report.status)}
                  </span>
                </div>
                {report.resolution?.note && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>{t('admin.contentReports.modal.notesLabel', 'Notes')}</span>
                    <p className={styles.resolutionCardNotes}>{report.resolution.note}</p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {errorMessage ? (
          <p role="alert" className={styles.error}>
            {errorMessage}
          </p>
        ) : null}

        <footer className={styles.footer}>
          {isReadOnly ? (
            <button
              type="button"
              className={styles.confirmButton}
              onClick={onClose}
            >
              {t('common.close', 'Close')}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={onClose}
                disabled={isSubmitting}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                form="resolve-report-form"
                className={styles.confirmButton}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? t('admin.contentReports.modal.resolving', 'Resolving…')
                  : t('admin.contentReports.modal.confirmResolution', 'Confirm Resolution')}
              </button>
            </>
          )}
        </footer>

        <form
          id="resolve-report-form"
          onSubmit={handleSubmit}
          className={styles.hiddenForm}
        />
      </div>
    </div>
  );
}

export default ResolveReportModal;
