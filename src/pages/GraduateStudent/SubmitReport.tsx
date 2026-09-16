import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Clock,
  FileText,
  Inbox,
  Loader2,
  Crown,
  CheckCircle2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useI18n, useLocale } from '../../i18n/I18nContext';
import type { Locale } from '../../i18n/translations';
import { useStudentGroups } from '../../hooks/useStudentGroups';
import { usePhasedReports } from '../../hooks/usePhasedReports';
import SubmitReportModal from '../../components/gradstudent/SubmitReportModal';
import PhaseReportDetailModal from '../../components/gradstudent/PhaseReportDetailModal';
import ExtendDeadlineModal from '../../components/lecturer/ExtendDeadlineModal';
import { lecturerLookupService } from '../../services/lecturerLookup.service';
import {
  listReportsForGroup,
  type PhasedReport,
  type SubmittedPhasedReport,
} from '../../services/phasedReport.service';
import { formatDisplayDateTime } from '../../utils/datetime';
import { derivePhasedReportDisplay } from '../../utils/phasedReport';
import { safeHref } from '../../utils/validationRules';
import styles from './SubmitReport.module.css';

const formatDate = (iso: string | null | undefined, locale: Locale): string => {
  return formatDisplayDateTime(iso, locale);
};


export const SubmitReport = (): JSX.Element => {
  const { t } = useI18n();
  const { user } = useAuth();
  const locale = useLocale();
  const studentId = user?.userId ?? null;

  const {
    primaryGroup,
    primaryTopic,
    joinedGroups,
    isLoading,
    error,
    refetch: refetchStudentGroups,
  } = useStudentGroups(studentId);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [targetPhase, setTargetPhase] = useState<{
    groupId: number;
    phaseNumber: number;
    phasedReportId?: number;
    title: string;
  } | null>(null);

  const [resubmitting, setResubmitting] = useState<SubmittedPhasedReport | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<SubmittedPhasedReport | null>(null);

  // Cache of resolved lecturer display names so we never show a synthetic
  // "Lecturer #N" placeholder. The lookup is event-driven — see the
  // `ars:lecturer-name-resolved` listener further down.
  const [lecturerNames, setLecturerNames] = useState<Record<number, string>>({});

  const primaryGroupId = primaryGroup?.id ?? null;

  const isLecturer = user?.role === 'Lecturer' || (user as { roleName?: string })?.roleName === 'Lecturer';
  const [deadlineModalReport, setDeadlineModalReport] = useState<PhasedReport | null>(null);

  const { refetch: refetchReports } = usePhasedReports(primaryGroupId);

  // Per-group submission state. One student can join multiple research
  // groups, so the table must show a row per (group × milestone). The
  // current `usePhasedReports` hook is wired to a single primary group;
  // we keep that for the legacy lecturer view and ALSO walk every joined
  // group to build the row source the new per-group table renders.
  const [groupReports, setGroupReports] = useState<
    Record<number, SubmittedPhasedReport[]>
  >({});
  const [isLoadingGroupReports, setIsLoadingGroupReports] =
    useState<boolean>(false);

  const lecturerId = primaryGroup?.lecturerId ?? null;

  // Fetch PhasedReport rows for every joined group the student currently
  // belongs to. Failures are isolated to the failing group so one bad
  // network call doesn't break the entire table.
  const loadAllGroupReports = useCallback(async (): Promise<void> => {
    const groups = joinedGroups;
    if (!studentId || groups.length === 0) {
      setGroupReports({});
      return;
    }
    setIsLoadingGroupReports(true);
    const settled = await Promise.allSettled(
      groups.map(async (group) => {
        const gid =
          typeof group.id === 'number'
            ? group.id
            : (group as { researchGroupId?: number }).researchGroupId;
        if (typeof gid !== 'number' || gid <= 0) return null;
        const reports = await listReportsForGroup(gid).catch(() => []);
        return { gid, reports };
      }),
    );
    const next: Record<number, SubmittedPhasedReport[]> = {};
    for (const entry of settled) {
      if (entry.status !== 'fulfilled' || !entry.value) continue;
      next[entry.value.gid] = entry.value.reports;
    }
    setGroupReports(next);
    setIsLoadingGroupReports(false);
  }, [studentId, joinedGroups]);

  useEffect(() => {
    void loadAllGroupReports();
  }, [loadAllGroupReports]);

  // Determine leader information

  // Build the source-of-truth rows for the per-group milestone table.
  // Each joined group contributes every PhasedReport (PhasedReport rows
  // already represent a (group, phase) pair on the BE — the table simply
  // flattens them). Groups without any reports still produce a single
  // "empty" placeholder row so the student knows the group exists but
  // has no milestones yet.
  interface GroupMilestoneRow {
    key: string;
    groupId: number;
    group: import('../../services/groupMembership.service').StudentGroupView;
    report: SubmittedPhasedReport | null;
    isEmpty: boolean;
  }
  const groupMilestoneRows = useMemo<GroupMilestoneRow[]>(() => {
    const rows: GroupMilestoneRow[] = [];
    for (const group of joinedGroups) {
      const gid =
        typeof group.id === 'number'
          ? group.id
          : (group as { researchGroupId?: number }).researchGroupId;
      if (typeof gid !== 'number' || gid <= 0) continue;
      const reports = groupReports[gid] ?? [];
      if (reports.length === 0) {
        rows.push({
          key: `empty-${gid}`,
          groupId: gid,
          group,
          report: null,
          isEmpty: true,
        });
      } else {
        for (const report of reports) {
          rows.push({
            key: `${gid}-${report.id}`,
            groupId: gid,
            group,
            report,
            isEmpty: false,
          });
        }
      }
    }
    return rows;
  }, [joinedGroups, groupReports]);

  // Track which groups the current student is a leader of. The action
  // column keys off this — only leader rows get a Submit / Resubmit
  // button.
  const isLeaderForGroup = useMemo(() => {
    const flags = new Set<number>();
    for (const group of joinedGroups) {
      const gid =
        typeof group.id === 'number'
          ? group.id
          : (group as { researchGroupId?: number }).researchGroupId;
      if (typeof gid !== 'number' || gid <= 0) continue;
      if (group.isLeader) flags.add(gid);
    }
    return flags;
  }, [joinedGroups]);

  const leaderGroupCount = isLeaderForGroup.size;
  const totalJoinedGroupCount = useMemo(
    () =>
      joinedGroups.filter(
        (g) => typeof g.id === 'number',
      ).length,
    [joinedGroups],
  );

  // Active-group check. The legacy `isGroupActive` only describes the
  // primary group, but the per-group table needs that for every row.
  const isGroupActiveById = useMemo(() => {
    const map: Record<number, boolean> = {};
    for (const group of joinedGroups) {
      const gid =
        typeof group.id === 'number'
          ? group.id
          : (group as { researchGroupId?: number }).researchGroupId;
      if (typeof gid !== 'number' || gid <= 0) continue;
      map[gid] = group.isActive !== false;
    }
    return map;
  }, [joinedGroups]);

  // Track which milestone row is currently being inspected in the detail
  // modal. The detail view shows the lecturer’s score, evaluation, and
  // (when rejected) the resubmission reason, plus a Resubmit CTA for
  // leaders.
  const [detailRow, setDetailRow] = useState<SubmittedPhasedReport | null>(null);

  // Same treatment for the lecturer display name. The existing
  // `lecturerLookupService` already handles caching; we just forward the
  // primary group's lecturer id into its queue so the banner reads
  // "Dr. Nguyen Van A" instead of "Lecturer #4".
  useEffect(() => {
    if (typeof lecturerId !== 'number' || lecturerId <= 0) return;
    const resolved = lecturerLookupService.getLecturerDisplayName(lecturerId);
    setLecturerNames((prev) =>
      prev[lecturerId] === resolved ? prev : { ...prev, [lecturerId]: resolved },
    );
    void lecturerLookupService.ensureLecturerDisplayName(lecturerId);
  }, [lecturerId]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<{ lecturerId: number }>).detail;
      if (!detail) return;
      const name = lecturerLookupService.getLecturerDisplayName(detail.lecturerId);
    setLecturerNames((prev) => ({ ...prev, [detail.lecturerId]: name }));
    };
    window.addEventListener('ars:lecturer-name-resolved', handler as EventListener);
    return () => {
      window.removeEventListener(
        'ars:lecturer-name-resolved',
        handler as EventListener,
      );
    };
  }, []);

  const resolvedLecturerName = useMemo(() => {
    if (typeof lecturerId !== 'number' || lecturerId <= 0) return '';
    return (
      lecturerNames[lecturerId] ??
      lecturerLookupService.getLecturerDisplayName(lecturerId) ??
      ''
    );
  }, [lecturerId, lecturerNames]);

  // The BE ships an `isActive` flag on ResearchGroup. When the lecturer
  // deactivates a group, students must not be able to submit further
  // phase reports (per the agreed contract — see
  // tickets/backend/BE_PHASED_REPORT_DEADLINE_PERSISTENCE.md for the
  // adjacent ticket and the user's confirmation that an inactive group
  // must block submissions). Treat `undefined` as "active" because the
  // FE derives true for legacy rows that never had the column populated.
  const isGroupActive = primaryGroup?.isActive !== false;

  // Per-group GroupMember look-up. The modal needs the groupMemberId for
  // the SPECIFIC row the user clicked, not whichever topic is currently
  // selected (the legacy code bound it to the primary topic's topicMembers
  // list, which doesn't exist when one student belongs to several
  // groups each with their own membershipId).
  const membershipIdForGroup = useCallback(
    (groupId: number): number | undefined => {
      if (!studentId) return undefined;
      const match = joinedGroups.find(
        (g) => g.id === groupId,
      );
      if (match && typeof match.membershipId === 'number') {
        return match.membershipId;
      }
      // No membershipId is a soft fallback for legacy endpoints where
      // `groupMemberId` is optional. The submit modal will surface the
      // missing value via its own validation.
      return undefined;
    },
    [studentId, joinedGroups],
  );

  useEffect(() => {
    if (!submitting) {
      setResubmitting(null);
      setTargetPhase(null);
    }
  }, [submitting]);

  const handleSubmitted = async (report: SubmittedPhasedReport): Promise<void> => {
    setLastSubmitted(report);
    await Promise.all([refetchStudentGroups(), refetchReports()]);
    // Per-group table needs the broadest refetch possible — see the
    // preceding effect for the rationale.
    await loadAllGroupReports();
    // If a detail modal was open, refresh its underlying snapshot.
    setDetailRow((current) => {
      if (!current) return current;
      if (current.id !== report.id) return current;
      return report;
    });
  };

  const handleOpenPhaseSubmit = (
    groupId: number,
    phaseNumber: number,
    phasedReportId?: number,
    title?: string,
  ): void => {
    setTargetPhase({
      groupId,
      phaseNumber,
      phasedReportId,
      title: title || `${t('student.phaseReport.phasePrefix', 'Phase')} ${phaseNumber}`,
    });
    setSubmitting(true);
  };

  const handleCloseSubmit = (): void => {
    setSubmitting(false);
  };

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.errorBanner}>
          <AlertCircle size={16} />
          <span>{t('student.phaseReport.signInPrompt', 'Please sign in to view and submit research reports.')}</span>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case 'Passed':
        return { className: styles.statusPassed, label: t('student.phaseReport.statusPassed', 'Passed') };
      case 'OnTime':
        return { className: styles.statusOnTime, label: t('student.phaseReport.statusOnTime', 'On time') };
      case 'Overdue':
        return { className: styles.statusOverdue, label: t('student.phaseReport.statusOverdue', 'Overdue') };
      case 'Rejected':
      case 'REJECTED':
        return { className: styles.statusRejected, label: t('student.phaseReport.statusRejected', 'Rejected') };
      case 'SUBMITTED':
        return { className: styles.statusPending, label: t('student.phaseReport.submittedShort', 'Submitted') };
      case 'EVALUATED':
        return { className: styles.statusPassed, label: t('student.phaseReport.evaluatedShort', 'Evaluated') };
      case 'Pending':
      case 'WAITING':
        return { className: styles.statusPending, label: t('student.phaseReport.statusPending', 'Pending') };
      default:
        return { className: styles.statusPending, label: t('student.phaseReport.statusPending', 'Pending') };
    }
  };

  // Active submission phases: rows that the student can still upload a
  // report to (or that are already in flight). The per-group table hides
  // rows that are completely "Passed" so the table stays focused on
  // outstanding work.
  const rowsForTable = useMemo(() => {
    if (groupMilestoneRows.length === 0) return groupMilestoneRows;
    return groupMilestoneRows.filter((row) => {
      if (row.isEmpty) return true;
      return row.report?.status !== 'Passed';
    });
  }, [groupMilestoneRows]);

  const topicTitleFor = (group: import('../../services/groupMembership.service').StudentGroupView): string => {
    // The BE doesn't always populate `topicTitle` on the StudentGroupView.
    // `primaryTopic` only represents the primary group's topic, so we
    // fall back to a generic placeholder for non-primary groups.
    if (primaryGroup && primaryTopic && group.id === primaryGroup.id) {
      return primaryTopic.title ?? '';
    }
    return t('student.phaseReport.table.unassignedTopic', 'Unassigned topic');
  };

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumbs}>
        {t('student.phaseReport.breadcrumbHome', 'Home')} &gt;{' '}
        {t('student.phaseReport.breadcrumbWorkspace', 'Collaborative Workspace')} &gt;{' '}
        <span className={styles.activeBreadcrumb}>
          {t('student.phaseReport.breadcrumbSubmit', 'Submit Progress Report')}
        </span>
      </nav>

      <header className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>
            {t('student.phaseReport.title', 'Submit Research Report by Phase')}
          </h1>
          <p className={styles.pageSubtitle}>
            {t(
              'student.phaseReport.pageDescription',
              'Track every research group you belong to, see your milestone deadlines, submit each report on schedule, and check the lecturer’s evaluation once it’s reviewed.',
            )}
          </p>
        </div>
      </header>

      {error ? (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={16} />
          <span>{error.message}</span>
        </div>
      ) : null}

      {/* Leader-only callout. Tells leaders which of their groups accept
          uploads; reassures members that they can still see the table. */}
      {totalJoinedGroupCount > 0 && leaderGroupCount > 0 ? (
        <section
          className={`${styles.leaderNotice} ${styles.leaderNoticeActive}`}
          aria-labelledby="leader-permission-title"
        >
          <Crown size={18} aria-hidden />
          <div>
            <h2 id="leader-permission-title" className={styles.leaderNoticeTitle}>
              {t('student.phaseReport.table.leaderOnlyTitle', 'Leader-only submissions')}
            </h2>
            <p className={styles.leaderNoticeText}>
              {t(
                'student.phaseReport.table.leaderOnlyDescription',
                'You are a leader of {count} group(s). Other group members can read the submission table but only leaders can upload a report.',
              ).replace('{count}', String(leaderGroupCount))}
            </p>
          </div>
        </section>
      ) : null}

      {/* Top of table: lecturer view of the primary group so the lecturer
          can still extend deadlines without leaving the page. */}
      {isLecturer && primaryGroup && !isGroupActive ? (
        <section
          className={`${styles.leaderNotice} ${styles.leaderNoticeInactive}`}
          aria-labelledby="group-inactive-title"
        >
          <AlertCircle size={18} aria-hidden />
          <div>
            <h2 id="group-inactive-title" className={styles.leaderNoticeTitle}>
              {t(
                'student.phaseReport.groupInactiveTitle',
                'This research group is inactive',
              )}
            </h2>
            <p className={styles.leaderNoticeText}>
              {t(
                'student.phaseReport.groupInactiveText',
                'Your lecturer has deactivated this group, so phase report submissions are paused. You can still read previous reports and feedback, but you cannot upload new reports until the group is reactivated.',
              )}
            </p>
          </div>
        </section>
      ) : null}

      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2 className={styles.cardTitle}>
            {t('student.phaseReport.table.title', 'Research groups & milestones')}
          </h2>
        </div>

        {isLoading || isLoadingGroupReports ? (
          <div className={styles.detailRow}>
            <Loader2 size={14} className={styles.spin} />
            <span>
              {t(
                'student.phaseReport.table.loading',
                'Loading milestones for your groups…',
              )}
            </span>
          </div>
        ) : rowsForTable.length === 0 ? (
          <div className={styles.emptyState}>
            <Inbox size={18} />
            <span>
              {t(
                'student.phaseReport.table.emptyDescription',
                "Once your lecturer creates phase milestones for a group, you'll see them here.",
              )}
            </span>
          </div>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    {t('student.phaseReport.table.columnGroup', 'Research group')}
                  </th>
                  <th>
                    {t('student.phaseReport.table.columnTopic', 'Topic')}
                  </th>
                  <th>
                    {t('student.phaseReport.table.columnPhase', 'Phase')}
                  </th>
                  <th>
                    {t('student.phaseReport.table.columnDeadline', 'Deadline')}
                  </th>
                  <th>
                    {t('student.phaseReport.table.columnStatus', 'Status')}
                  </th>
                  <th>
                    {t('student.phaseReport.table.columnScore', 'Score')}
                  </th>
                  <th>
                    {t('student.phaseReport.table.columnAction', 'Action')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rowsForTable.map((row) => {
                  const isLeaderForRow = isLeaderForGroup.has(row.groupId);
                  const rowActive = isGroupActiveById[row.groupId] !== false;
                  const report = row.report;
                  const phaseLabel = report?.phaseNumber
                    ? `${t('student.phaseReport.phasePrefix', 'Phase')} ${report.phaseNumber}`
                    : t('student.phaseReport.phasePrefix', 'Phase');
                  // Bug fix (Sep 2026): the BE endpoint
                  // /api/PhasedReport/group/{groupId} returns
                  // `status: "Pending"` for milestones whose deadline has
                  // already passed without a submission, so we derive the
                  // overdue flag and badge label client-side via the shared
                  // `derivePhasedReportDisplay` helper. This keeps Alex's
                  // view consistent with the Lecturer GroupDetail
                  // timeline (see src/pages/Lecturer/GroupDetail.tsx).
                  const display = report
                    ? derivePhasedReportDisplay(report)
                    : { overdue: false, badge: 'Pending' as const };
                  const statusInfo = getStatusBadge(
                    display.badge === 'Pending' ? (report?.status ?? display.badge) : display.badge,
                  );
                  const hasFile = Boolean(report?.reportFileUrl);
                  return (
                    <tr key={row.key}>
                      <td>
                        <div className={styles.groupCell}>
                          <span className={styles.groupName}>
                            {row.group.name ??
                              t(
                                'student.phaseReport.table.unassignedGroup',
                                'Unassigned group',
                              )}
                          </span>
                          {isLeaderForRow ? (
                            <span className={styles.leaderBadge}>
                              <Crown size={11} aria-hidden />
                              {t(
                                'student.phaseReport.table.roleBadge',
                                'Leader',
                              )}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <span className={styles.mutedCell}>
                          {topicTitleFor(row.group)}
                        </span>
                      </td>
                      <td>
                        <span className={styles.milestoneName}>
                          {report?.milestoneTitle || phaseLabel}
                        </span>
                      </td>
                      <td>
                        <span className={styles.dateText}>
                          <Calendar size={12} aria-hidden />
                          {report?.deadlineAt
                            ? formatDate(report.deadlineAt, locale)
                            : '—'}
                          {display.overdue ? (
                            <span className={styles.overdueLabel}>
                              {t('student.phaseReport.overdue', 'Overdue')}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td>
                        {report ? (
                          <span
                            className={`${styles.statusBadge} ${statusInfo.className}`}
                          >
                            {statusInfo.label}
                          </span>
                        ) : (
                          <span className={styles.mutedCell}>
                            {t(
                              'student.phaseReport.notSubmitted',
                              'Not submitted',
                            )}
                          </span>
                        )}
                      </td>
                      <td>
                        {typeof report?.lectureFeedback === 'number' ? (
                          <span className={styles.scoreValue}>
                            {report.lectureFeedback}
                            {t(
                              'student.phaseReport.table.detailOutOf',
                              '/10',
                            )}
                          </span>
                        ) : (
                          <span className={styles.mutedCell}>—</span>
                        )}
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          {/* View detail — available once a row has been
                              submitted (so the student can read lecturer
                              feedback, see the score, and find the
                              resubmission reason). */}
                          {report && hasFile ? (
                            <button
                              type="button"
                              className={styles.detailBtn}
                              onClick={() => setDetailRow(report)}
                            >
                              <FileText size={12} aria-hidden />
                              {t(
                                'student.phaseReport.viewDetail',
                                'View details',
                              )}
                            </button>
                          ) : null}
                          {report?.reportFileUrl &&
                          safeHref(report.reportFileUrl) ? (
                            <a
                              href={safeHref(report.reportFileUrl) ?? '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.linkBtn}
                            >
                              <FileText size={12} aria-hidden />
                              {t(
                                'student.phaseReport.table.viewPdf',
                                'View PDF',
                              )}
                            </a>
                          ) : null}
                          {/* Submit / Resubmit — gated to the row's group
                              leader AND active status. Non-leaders see a
                              muted note explaining who can submit. */}
                          {report &&
                          !hasFile &&
                          isLeaderForRow &&
                          rowActive ? (
                            <button
                              type="button"
                              className={styles.submitPhaseBtn}
                              onClick={() =>
                                handleOpenPhaseSubmit(
                                  row.groupId,
                                  report.phaseNumber ?? 1,
                                  report.id,
                                  report.milestoneTitle,
                                )
                              }
                            >
                              <Upload size={12} aria-hidden />
                              {t(
                                'student.phaseReport.submit',
                                'Submit report',
                              )}
                            </button>
                          ) : null}
                          {report &&
                          hasFile &&
                          report.status === 'REJECTED' &&
                          isLeaderForRow &&
                          rowActive ? (
                            <button
                              type="button"
                              className={styles.submitPhaseBtn}
                              onClick={() => {
                                setResubmitting(report);
                                handleOpenPhaseSubmit(
                                  row.groupId,
                                  report.phaseNumber ?? 1,
                                  report.id,
                                  report.milestoneTitle,
                                );
                              }}
                            >
                              <Upload size={12} aria-hidden />
                              {t(
                                'student.phaseReport.table.resubmitCta',
                                'Resubmit report',
                              )}
                            </button>
                          ) : null}
                          {!rowActive ? (
                            <span className={styles.mutedNote}>
                              {t(
                                'student.phaseReport.table.inactiveCta',
                                'This group is inactive. Submissions are paused.',
                              )}
                            </span>
                          ) : null}
                          {!isLeaderForRow &&
                          !report?.reportFileUrl &&
                          rowActive ? (
                            <span className={styles.mutedNote}>
                              {t(
                                'student.phaseReport.table.viewOnlyCta',
                                'You are a group member. Only the group leader can submit this report.',
                              )}
                            </span>
                          ) : null}
                          {/* Lecturer: Update Deadline on every active row. */}
                          {isLecturer && report && rowActive ? (
                            <button
                              type="button"
                              className={styles.extendDeadlineButton}
                              onClick={() => setDeadlineModalReport(report)}
                              title={
                                locale === 'en'
                                  ? 'Extend deadline for this phase'
                                  : 'Gia hạn deadline cho giai đoạn này'
                              }
                            >
                              <Clock size={12} aria-hidden />
                              {locale === 'en'
                                ? 'Update Deadline'
                                : 'Gia hạn deadline'}
                            </button>
                          ) : null}
                          {row.isEmpty ? (
                            <span className={styles.mutedNote}>
                              {t(
                                'student.phaseReport.milestonesEmpty',
                                'Your supervisor has not configured any phase milestones for this topic yet. Ask them to set up milestones so your group can begin submitting reports.',
                              )}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {lastSubmitted ? (
        <section
          className={`${styles.leaderNotice} ${styles.leaderNoticeActive}`}
          aria-labelledby="last-submitted-title"
        >
          <CheckCircle2 size={18} aria-hidden />
          <div>
            <h2
              id="last-submitted-title"
              className={styles.leaderNoticeTitle}
            >
              {t(
                'student.phaseReport.table.lastSubmittedTitle',
                'Your latest submission was recorded',
              )}
            </h2>
            <p className={styles.leaderNoticeText}>
              {t(
                'student.phaseReport.table.lastSubmittedBody',
                'Refresh the table to see the lecturer’s evaluation once they review your report.',
              )}
            </p>
          </div>
        </section>
      ) : null}

      {submitting && targetPhase ? (
        <SubmitReportModal
          isOpen={submitting}
          researchGroupId={targetPhase.groupId}
          groupMemberId={membershipIdForGroup(targetPhase.groupId)}
          topicId={undefined}
          phaseNumber={targetPhase.phaseNumber}
          phasedReportId={targetPhase.phasedReportId}
          phaseKey={`group-${targetPhase.groupId}-phase-${targetPhase.phaseNumber}`}
          phaseTitle={
            targetPhase.title ||
            `${t('student.phaseReport.phasePrefix', 'Phase')} ${targetPhase.phaseNumber}`
          }
          {...(typeof lecturerId === 'number'
            ? {
                lecturerName:
                  resolvedLecturerName ||
                  `${t('student.phaseReport.lecturerPrefix', 'Lecturer')} #${lecturerId}`,
              }
            : {})}
          resubmittingReport={resubmitting}
          isSubmitting={false}
          lastSubmitted={lastSubmitted}
          onClose={handleCloseSubmit}
          onSubmitted={handleSubmitted}
        />
      ) : null}

      {deadlineModalReport && (
        <ExtendDeadlineModal
          isOpen={deadlineModalReport !== null}
          report={deadlineModalReport}
          groupName={primaryGroup?.name}
          onClose={() => setDeadlineModalReport(null)}
          onSuccess={async () => {
            setDeadlineModalReport(null);
            await refetchReports();
            await loadAllGroupReports();
          }}
        />
      )}

      {detailRow ? (
        <PhaseReportDetailModal
          isOpen={detailRow !== null}
          report={detailRow}
          groupName={
            joinedGroups.find((g) => g.id === detailRow.researchGroupId)?.name
          }
          lecturerName={
            lecturerLookupService.getLecturerDisplayName(
              joinedGroups.find(
                (g) => g.id === detailRow.researchGroupId,
              )?.lecturerId ?? -1,
            ) || ''
          }
          onClose={() => setDetailRow(null)}
        />
      ) : null}
    </div>
  );
};

export default SubmitReport;
