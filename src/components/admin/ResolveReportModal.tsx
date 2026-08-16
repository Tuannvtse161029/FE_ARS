import { useEffect, useState } from 'react';
import styles from './ResolveReportModal.module.css';
import type {
  ViolationReport,
  ViolationResolutionAction,
} from '../../types/adminAuxiliary';

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

const ACTION_LABELS: Record<ViolationResolutionAction, string> = {
  DISMISS: 'Dismiss Report',
  DELETE_CONTENT_WARN: 'Delete Content & Send Warning',
  DELETE_CONTENT_SUSPEND_14D: 'Delete Content & Suspend User (14 days)',
};

const ACTION_DESCRIPTIONS: Record<ViolationResolutionAction, string> = {
  DISMISS: 'Mark the report as a false alarm. No content change, no user action.',
  DELETE_CONTENT_WARN:
    'Remove the offending content from the platform and email the author a warning.',
  DELETE_CONTENT_SUSPEND_14D:
    'Remove the offending content and suspend the author\'s account for 14 days. The audit log records both actions.',
};

export function ResolveReportModal({
  report,
  isOpen,
  isSubmitting,
  errorMessage,
  onClose,
  onConfirm,
}: ResolveReportModalProps): JSX.Element | null {
  const [selectedAction, setSelectedAction] = useState<ViolationResolutionAction>(
    'DELETE_CONTENT_WARN',
  );
  const [note, setNote] = useState('');

  // Reset internal state every time the modal re-opens so a stale note/action
  // from a previous report doesn't bleed into the next one.
  useEffect(() => {
    if (isOpen) {
      setSelectedAction('DELETE_CONTENT_WARN');
      setNote('');
    }
  }, [isOpen, report?.reportId]);

  if (!isOpen || !report) return null;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    await onConfirm(report.reportId, selectedAction, note.trim());
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget && !isSubmitting) onClose();
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
            Resolve violation report #{report.reportId}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            aria-label="Close"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ×
          </button>
        </header>

        <div className={styles.content}>
          <section className={styles.leftPane}>
            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Report type</span>
                <span className={styles.metaValue}>
                  {report.type === 'FORUM_COMMENT' ? 'Forum Comment' : 'Research Paper'}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Target author</span>
                <span className={styles.metaValue}>{report.targetAuthorName}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Reported by</span>
                <span className={styles.metaValue}>{report.reportedByName}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Filed</span>
                <span className={styles.metaValue}>
                  {new Date(report.date).toLocaleString('vi-VN')}
                </span>
              </div>
              <div className={`${styles.metaItem} ${styles.metaItemFull}`}>
                <span className={styles.metaLabel}>Reason</span>
                <span className={styles.metaValue}>{report.reason}</span>
              </div>
            </div>

            <div className={styles.reportedContentBlock}>
              <span className={styles.metaLabel}>Reported content</span>
              <blockquote className={styles.reportedContent}>
                {report.reportedContent}
              </blockquote>
            </div>

            <label className={styles.fieldLabel} htmlFor="resolve-note">
              Verification notes (internal)
            </label>
            <textarea
              id="resolve-note"
              className={styles.noteInput}
              placeholder="Why are you resolving this way? (Optional; saved to the audit log.)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </section>

          <section className={styles.rightPane}>
            <h3 className={styles.actionsHeading}>Choose resolution</h3>
            <div className={styles.actions}>
              {(Object.keys(ACTION_LABELS) as ViolationResolutionAction[]).map((a) => {
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
                      <span className={styles.actionLabel}>{ACTION_LABELS[a]}</span>
                      <span className={styles.actionDescription}>
                        {ACTION_DESCRIPTIONS[a]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {errorMessage ? (
          <p role="alert" className={styles.error}>
            {errorMessage}
          </p>
        ) : null}

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="resolve-report-form"
            className={styles.confirmButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Resolving…' : 'Confirm Resolution'}
          </button>
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