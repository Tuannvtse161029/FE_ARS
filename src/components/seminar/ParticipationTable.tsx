/**
 * ParticipationTable — shared surface for the Seminar Participations
 * page and the "My Participations" tab in SeminarWorkspace.
 *
 * Reads from `useSeminarParticipations` and renders:
 *   • Toolbar with debounced search, refresh button, status filter tabs
 *     (All / Invitations / Upcoming / In Progress / Completed), and a
 *     live result count.
 *   • Rows: Seminar Name, Detail, Time Started, Status, Actions.
 *   • Per-row action buttons that switch on invitationStatus +
 *     effectiveStatus (Accept / Reject / Participate / Submit Feedback /
 *     View Feedback).
 *
 * The Google Meet URL is NEVER rendered as a clickable link per the
 * product spec — it is only opened through the Participate button's
 * `window.open(onlineLink, '_blank', 'noopener')` hand-off.
 *
 * Datetime rule: every read of `startTime` / `endTime` is routed through
 * `parseApiDateTimeAsUtc` so display + disabled-state calculation match
 * the lecturer's local wall-clock pick.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Loader,
  RefreshCw,
  Search,
  Video,
  XCircle,
} from 'lucide-react';
import { useLocale } from '../../i18n/I18nContext';
import { EmptyState } from '../EmptyState';
import { SkeletonRow } from '../SkeletonRow';
import { SeminarFeedbackModal } from './SeminarFeedbackModal';
import { ConfirmModal } from '../lecturer/ConfirmModal';
import { ErrorBanner } from '../ErrorBanner';
import {
  deriveEffectiveStatus,
  type EffectiveSeminarStatus,
} from '../../services/seminar.service';
import {
  formatDisplayDate,
  formatDisplayTime,
  parseApiDateTimeAsUtc,
} from '../../utils/datetime';
import {
  useAcceptInvitation,
  useDeclineInvitation,
  useSeminarParticipations,
  type ParticipationRow,
} from '../../hooks/useSeminarParticipations';
import styles from './ParticipationTable.module.css';

type StatusFilter = 'all' | 'invitations' | 'upcoming' | 'in-progress' | 'completed';

const SEARCH_DEBOUNCE_MS = 200;

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'invitations', label: 'Invitations' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

export interface ParticipationTableProps {
  /**
   * If true, the table is rendered inside the Lecturer / Researcher
   * workspace tab. Kept for downstream wiring (e.g. a different PageHeader
   * eyebrow) — the surface itself is identical.
   */
  embedded?: boolean;
}

export const ParticipationTable: React.FC<ParticipationTableProps> = ({ embedded }) => {
  const locale = useLocale();
  const copy = (en: string, vi: string) => (locale === 'vi' ? vi : en);

  const { rows, isLoading, error, refetch } = useSeminarParticipations();
  const { accept, isAccepting } = useAcceptInvitation(refetch);
  const { decline, isDeclining } = useDeclineInvitation(refetch);

  // Debounced search — keeps the input snappy while the filter recomputes.
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setSearchQuery(searchInput.trim().toLowerCase()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Per-row action state.
  const [busyRowId, setBusyRowId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<{ row: ParticipationRow } | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<
    | { row: ParticipationRow; previewMode: boolean; isEditing: boolean }
    | null
  >(null);

  // Effective (computed) status + start/end parsed once per row, reused
  // for the disabled-state predicate, status pill, and time cell.
  const enrichedRows = useMemo(() => {
    return rows.map((row) => {
      const start = parseApiDateTimeAsUtc(row.startTime);
      const end = parseApiDateTimeAsUtc(row.endTime);
      const effective = deriveEffectiveStatus('Upcoming', row.endTime);
      return {
        row,
        start,
        end,
        effective,
        startMs: start?.getTime() ?? Number.POSITIVE_INFINITY,
      };
    });
  }, [rows]);

  // Counts per status tab. "Invitations" is its own bucket because it
  // overlaps with both Upcoming and In Progress; we keep it distinct.
  const counts = useMemo(() => {
    const init = { all: rows.length, invitations: 0, upcoming: 0, inProgress: 0, completed: 0 };
    for (const { row, effective } of enrichedRows) {
      if (row.invitationStatus === 'PENDING') {
        init.invitations += 1;
      }
      if (effective === 'UPCOMING') init.upcoming += 1;
      if (effective === 'IN PROGRESS') init.inProgress += 1;
      if (effective === 'COMPLETED') init.completed += 1;
    }
    return init;
  }, [enrichedRows, rows.length]);

  // Search + filter pipeline.
  const filtered = useMemo(() => {
    return enrichedRows.filter(({ row, effective }) => {
      if (searchQuery) {
        const haystack = `${row.title} ${row.detail} ${row.organizerName ?? ''}`.toLowerCase();
        if (!haystack.includes(searchQuery)) return false;
      }
      switch (statusFilter) {
        case 'invitations':
          return row.invitationStatus === 'PENDING';
        case 'upcoming':
          return effective === 'UPCOMING' && row.invitationStatus !== 'DECLINED';
        case 'in-progress':
          return effective === 'IN PROGRESS' && row.invitationStatus !== 'DECLINED';
        case 'completed':
          return effective === 'COMPLETED' && row.invitationStatus !== 'DECLINED';
        case 'all':
        default:
          return row.invitationStatus !== 'DECLINED';
      }
    });
  }, [enrichedRows, searchQuery, statusFilter]);

  const handleAccept = async (row: ParticipationRow) => {
    if (row.seminarParticipantId == null) return;
    setBusyRowId(row.seminarId);
    try {
      await accept(row.seminarParticipantId);
    } catch {
      // The hook surfaces the error string itself; we keep the table open.
    } finally {
      setBusyRowId(null);
    }
  };

  const handleDecline = async () => {
    if (!rejecting || rejecting.row.seminarParticipantId == null) return;
    setBusyRowId(rejecting.row.seminarId);
    try {
      await decline(rejecting.row.seminarParticipantId);
      setRejecting(null);
    } catch {
      // hook surfaces error; keep modal open so the user can retry.
    } finally {
      setBusyRowId(null);
    }
  };

  const handleParticipate = (row: ParticipationRow) => {
    if (!row.onlineLink) return;
    window.open(row.onlineLink, '_blank', 'noopener,noreferrer');
  };

  const openSubmitFeedback = (row: ParticipationRow) => {
    setFeedbackModal({ row, previewMode: false, isEditing: row.participantSubmitted });
  };

  const openViewFeedback = (row: ParticipationRow) => {
    setFeedbackModal({ row, previewMode: true, isEditing: true });
  };

  // Render helpers
  const renderStatusPill = (effective: EffectiveSeminarStatus, invitation: ParticipationRow['invitationStatus']) => {
    if (invitation === 'PENDING') {
      return (
        <span className={`${styles.statusPill} ${styles.statusPillPending}`}>
          Pending invitation
        </span>
      );
    }
    if (invitation === 'DECLINED') {
      return (
        <span className={`${styles.statusPill} ${styles.statusPillDeclined}`}>Declined</span>
      );
    }
    if (effective === 'IN PROGRESS') {
      return (
        <span className={`${styles.statusPill} ${styles.statusPillInProgress}`}>
          <span className={styles.statusPulse} aria-hidden />
          In progress
        </span>
      );
    }
    if (effective === 'COMPLETED') {
      return (
        <span className={`${styles.statusPill} ${styles.statusPillCompleted}`}>
          {invitation === 'SUBMITTED' ? 'Completed · feedback submitted' : 'Completed'}
        </span>
      );
    }
    return (
      <span className={`${styles.statusPill} ${styles.statusPillInvited}`}>Upcoming</span>
    );
  };

  const renderActions = (row: ParticipationRow, effective: EffectiveSeminarStatus, startMs: number) => {
    const now = Date.now();
    const started = now >= startMs;
    const isBusy = busyRowId === row.seminarId || isAccepting || isDeclining;

    // DECLINED → read-only "you've declined this seminar" row.
    if (row.invitationStatus === 'DECLINED') {
      return (
        <div className={styles.actionsCell}>
          <span className={styles.cellSub}>
            {copy(
              'You declined this invitation. The host will not expect feedback.',
              'Bạn đã từ chối lời mời. Diễn giả sẽ không yêu cầu phản hồi.'
            )}
          </span>
        </div>
      );
    }

    // PENDING invitation → Accept / Reject.
    if (row.invitationStatus === 'PENDING') {
      return (
        <div className={styles.actionsCell}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            disabled={isBusy || row.seminarParticipantId == null}
            onClick={() => void handleAccept(row)}
          >
            <CheckCircle2 size={14} aria-hidden />
            Accept invitation
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnDestructive}`}
            disabled={isBusy || row.seminarParticipantId == null}
            onClick={() => setRejecting({ row })}
          >
            <XCircle size={14} aria-hidden />
            Reject invitation
          </button>
        </div>
      );
    }

    // INVITED → Participate (disabled until startTime) + optional Reject.
    if (row.invitationStatus === 'INVITED') {
      const tooltip = started
        ? 'Open the Google Meet link'
        : `The seminar will start at ${formatDisplayTime(
            parseApiDateTimeAsUtc(row.startTime),
            locale,
          )} on ${formatDisplayDate(parseApiDateTimeAsUtc(row.startTime), locale)}.`;
      return (
        <div className={styles.actionsCell}>
          <div className={styles.actionBtnTooltip} data-tooltip={tooltip}>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              disabled={!started || !row.onlineLink}
              onClick={() => handleParticipate(row)}
              aria-label={
                started
                  ? `Join ${row.title} on Google Meet`
                  : `The seminar will start at ${formatDisplayTime(
                      parseApiDateTimeAsUtc(row.startTime),
                      locale,
                    )}`
              }
            >
              <Video size={14} aria-hidden />
              Participate
            </button>
          </div>
          {row.seminarParticipantId != null && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnDestructive}`}
              disabled={isBusy}
              onClick={() => setRejecting({ row })}
            >
              <XCircle size={14} aria-hidden />
              Reject invitation
            </button>
          )}
        </div>
      );
    }

    // COMPLETED → Submit Feedback / View Feedback.
    if (effective === 'COMPLETED') {
      if (row.participantSubmitted) {
        return (
          <div className={styles.actionsCell}>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnOutline}`}
              onClick={() => openViewFeedback(row)}
            >
              <ClipboardList size={14} aria-hidden />
              View feedback
            </button>
          </div>
        );
      }
      return (
        <div className={styles.actionsCell}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={() => openSubmitFeedback(row)}
          >
            <ClipboardList size={14} aria-hidden />
            Submit feedback
          </button>
        </div>
      );
    }

    // UPCOMING / IN PROGRESS → Participate (only meaningful while INVITED;
    // defensive default for SUBMITTED-before-completion rows).
    return (
      <div className={styles.actionsCell}>
        <div className={styles.actionBtnTooltip} data-tooltip="Open the Google Meet link">
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            disabled={!started || !row.onlineLink}
            onClick={() => handleParticipate(row)}
          >
            <Video size={14} aria-hidden />
            Participate
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.wrapper} data-embedded={embedded ? 'true' : 'false'}>
      {error && (
        <ErrorBanner
          tone="error"
          title="Failed to load your participations"
          message={error}
          retry={
            <button
              type="button"
              className={styles.refreshBtn}
              onClick={() => void refetch()}
            >
              <RefreshCw size={14} aria-hidden /> Retry
            </button>
          }
        />
      )}

      <div className={styles.toolbar}>
        <div className={styles.toolbarTopRow}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden>
              <Search size={14} />
            </span>
            <input
              type="search"
              className={styles.searchInput}
              placeholder={copy('Search participations by title or organizer…', 'Tìm theo tên hội thảo hoặc người tổ chức…')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label={copy('Search participations', 'Tìm kiếm lượt tham gia')}
            />
          </div>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => void refetch()}
            disabled={isLoading}
            aria-label="Refresh participations"
          >
            {isLoading ? (
              <Loader size={14} className={styles.spinning} aria-hidden />
            ) : (
              <RefreshCw size={14} aria-hidden />
            )}
            {isLoading ? copy('Refreshing…', 'Đang tải…') : copy('Refresh', 'Làm mới')}
          </button>
        </div>

        <div className={styles.statusTabs} role="tablist" aria-label={copy('Filter participations', 'Lọc lượt tham gia')}>
          {STATUS_TABS.map((t) => {
            const countKey =
              t.key === 'all'
                ? counts.all
                : t.key === 'invitations'
                ? counts.invitations
                : t.key === 'upcoming'
                ? counts.upcoming
                : t.key === 'in-progress'
                ? counts.inProgress
                : counts.completed;
            const isActive = statusFilter === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`${styles.statusTabBtn} ${isActive ? styles.statusTabActive : ''}`}
                onClick={() => setStatusFilter(t.key)}
              >
                {t.label}
                <span className={styles.statusTabCount}>{countKey}</span>
              </button>
            );
          })}
          <span className={styles.toolbarMeta}>
            {copy(
              `Showing ${filtered.length} of ${rows.length} seminars`,
              `Hiển thị ${filtered.length} / ${rows.length} hội thảo`,
            )}
          </span>
        </div>
      </div>

      {isLoading ? (
        <SkeletonRow count={5} withHeader />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={20} aria-hidden />}
          title={
            searchQuery || statusFilter !== 'all'
              ? copy('No matching participations', 'Không có lượt tham gia phù hợp')
              : copy('You have no seminar participations yet', 'Bạn chưa có lượt tham gia hội thảo nào')
          }
          description={
            searchQuery || statusFilter !== 'all'
              ? copy('Try clearing the filters or refreshing the list.', 'Hãy thử xóa bộ lọc hoặc tải lại danh sách.')
              : copy('When a lecturer invites you to a seminar, it will appear here.', 'Khi giảng viên mời bạn tham dự hội thảo, nó sẽ xuất hiện ở đây.')
          }
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{copy('Seminar', 'Hội thảo')}</th>
                <th scope="col">{copy('Detail', 'Chi tiết')}</th>
                <th scope="col">{copy('Time Started', 'Thời gian')}</th>
                <th scope="col">{copy('Status', 'Trạng thái')}</th>
                <th scope="col">{copy('Actions', 'Hành động')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ row, effective, start }) => (
                <tr key={row.seminarId}>
                  <td>
                    <span className={styles.cellTitle}>{row.title}</span>
                    <span className={styles.cellSub}>
                      {row.organizerName
                        ? copy(`Hosted by ${row.organizerName}`, `Do ${row.organizerName} tổ chức`)
                        : `SEM-${String(row.seminarId).padStart(3, '0')}`}
                    </span>
                  </td>
                  <td>
                    <span className={styles.cellDetail}>{row.detail || '—'}</span>
                  </td>
                  <td>
                    <span className={styles.cellTime}>
                      <strong>{start ? formatDisplayDate(start, locale) : '—'}</strong>
                      <span>
                        {start && row.endTime
                          ? `${formatDisplayTime(start, locale)} – ${formatDisplayTime(
                              parseApiDateTimeAsUtc(row.endTime),
                              locale,
                            )}`
                          : start
                          ? formatDisplayTime(start, locale)
                          : ''}
                      </span>
                    </span>
                  </td>
                  <td>{renderStatusPill(effective, row.invitationStatus)}</td>
                  <td>
                    {renderActions(
                      row,
                      effective,
                      start?.getTime() ?? Number.POSITIVE_INFINITY,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject confirmation modal — replaces window.confirm() per the
          "No Native Browser Dialogs" rule. */}
      {rejecting && (
        <ConfirmModal
          open={Boolean(rejecting)}
          title={copy('Decline this seminar invitation?', 'Từ chối lời mời hội thảo này?')}
          description={copy(
            `${rejecting.row.title} will be removed from your active invitations. The host will be notified.`,
            `${rejecting.row.title} sẽ bị xoá khỏi danh sách lời mời của bạn. Diễn giả sẽ nhận được thông báo.`,
          )}
          variant="destructive"
          confirmLabel={copy('Decline invitation', 'Từ chối lời mời')}
          cancelLabel={copy('Cancel', 'Huỷ')}
          onConfirm={() => void handleDecline()}
          onClose={() => setRejecting(null)}
        />
      )}

      {/* Submit / View feedback modal — reuses the existing dynamic
          feedback component with `previewMode` for read-only inspection. */}
      {feedbackModal && (
        <SeminarFeedbackModal
          isOpen={Boolean(feedbackModal)}
          onClose={() => setFeedbackModal(null)}
          seminarId={feedbackModal.row.seminarId}
          seminarTitle={feedbackModal.row.title}
          previewMode={feedbackModal.previewMode}
          hasSubmittedBefore={feedbackModal.isEditing}
          existingDynamicAnswersRaw={feedbackModal.row.feedbackJson}
          onSuccess={() => void refetch()}
        />
      )}
    </div>
  );
};

export default ParticipationTable;