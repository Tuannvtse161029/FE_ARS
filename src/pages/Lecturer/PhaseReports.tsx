/**
 * PhaseReports — Lecturer phased-report review console (table view).
 *
 * Single page that lists every PhasedReport owned by the lecturer's
 * research groups as a sortable, searchable, status-filtered table.
 *
 * URL contract is preserved:
 *   /lecturer/phase-reports[?topicId=<id>[&groupId=<id>]]
 *
 * `?topicId=` and `?groupId=` apply a read-only pre-filter so deep links
 * from `ResearchGroup` keep working — they're surfaced as a "Filtered to
 * topic #X · Clear" chip above the table rather than routing into a
 * separate drilled-in view.
 *
 * Behaviour:
 *   - Search bar matches free text against topic title, group name,
 *     phase title, and student name.
 *   - Status tabs (All / Awaiting / Submitted / Overdue / Evaluated /
 *     Rejected) filter the table; counts always reflect the full owned
 *     set, not the search-filtered set.
 *   - When consecutive rows share a research topic (or topic + group),
 *     those cells are visually merged via `rowSpan` so the topic name
 *     appears once, vertically centered across its phase rows.
 *   - Each row carries an explicit "Evaluate / View detail" button that
 *     opens the detail modal — the row itself is not clickable, so the
 *     lecturer always knows where to click.
 *   - "Update deadline" stays disabled until the report is overdue.
 *   - The grading form inside the detail modal renders a "Not submitted
 *     yet" panel until the student uploads a file; lecturers can still
 *     extend the deadline from the modal.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  Eye,
  Inbox,
  Loader,
  RefreshCw,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useResearchGroups } from '../../hooks/useResearchGroups';
import { useResearchTopics } from '../../hooks/useResearchTopics';
import {
  phasedReportService,
  type PhasedReport,
} from '../../services/phasedReport.service';
import { ExtendDeadlineModal } from '../../components/lecturer/ExtendDeadlineModal';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import { PhaseReportDetailModal } from '../../components/lecturer/PhaseReportDetailModal';
import {
  PhaseReportStatusTabs,
  type PhaseReportStatusFilter,
} from '../../components/lecturer/PhaseReportStatusTabs';
import {
  classifyPhaseReportStatus,
  classifyPhaseReportStatusToFilter,
  filterByPhaseReportStatus,
  isLecturerDeadlineOverdue,
  statusLabelOf,
} from '../../utils/lecturerPhaseStatus';
import { useI18n } from '../../i18n/I18nContext';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonRow } from '../../components/SkeletonRow';
import { TableToolbar } from '../../components/table/TableToolbar';
import {
  parseIdFromSearch,
  parseTopicIdFromSearch,
} from '../../utils/topicRouting';
import { formatDisplayDate } from '../../utils/datetime';
import styles from './PhaseReports.module.css';

// ─── Status mapping ─────────────────────────────────────────────────────────
//
// `statusFilterOf`, `statusLabelOf`, and `isLecturerDeadlineOverdue` are
// implemented in `src/utils/lecturerPhaseStatus.ts` so the September
// 2026 OnTime regression can be pinned by a unit test that imports the
// pure classifier without mounting the whole PhaseReports page (and
// its React Router + Auth + ResearchGroups hook chain).
//
// The export from that utility is already imported at the top of this
// file, so the rest of the component is unchanged. The local alias
// `isDeadlineOverdue` preserves the original call-sites.

const isDeadlineOverdue = isLecturerDeadlineOverdue;

// ─── Row-span / row layout helpers ──────────────────────────────────────────

interface DisplayRow {
  report: PhasedReport;
  topicRowSpan: number;
  groupRowSpan: number;
  isFirstOfTopic: boolean;
  isFirstOfGroup: boolean;
}

/**
 * Walk the sorted list and assign rowspan values for consecutive rows
 * that share a research topic (or topic + group). The first row in each
 * consecutive run renders the cell; subsequent rows skip it so HTML's
 * rowSpan renders a single tall cell visually centred across them.
 */
const buildDisplayRows = (rows: PhasedReport[]): DisplayRow[] => {
  const result: DisplayRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const r = rows[i];
    const topic = r.topicTitle ?? '';
    const group = r.researchGroupId ?? -1;

    // Topic run
    let topicEnd = i + 1;
    while (
      topicEnd < rows.length &&
      (rows[topicEnd].topicTitle ?? '') === topic
    ) {
      topicEnd++;
    }
    // Topic + group run (within the topic run)
    let groupEnd = i + 1;
    while (
      groupEnd < topicEnd &&
      (rows[groupEnd].researchGroupId ?? -1) === group
    ) {
      groupEnd++;
    }

    const topicRowSpan = topicEnd - i;
    const groupRowSpan = groupEnd - i;

    result.push({
      report: r,
      topicRowSpan,
      groupRowSpan,
      isFirstOfTopic: true,
      isFirstOfGroup: true,
    });

    for (let j = i + 1; j < groupEnd; j++) {
      result.push({
        report: rows[j],
        topicRowSpan: 1,
        groupRowSpan: 1,
        isFirstOfTopic: false,
        isFirstOfGroup: false,
      });
    }
    i = groupEnd;
  }
  return result;
};

// ─── Component ───────────────────────────────────────────────────────────────

export const PhaseReports = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();

  // URL-scoped filter values (null = show all)
  // Use parseTopicIdFromSearch so we distinguish "missing param" from
  // "invalid id" — both are treated as "no filter active" but the chip
  // needs to know the difference for its loading / missing states.
  const { topicId: urlTopicId } = parseTopicIdFromSearch(searchParams);
  const urlGroupId = parseIdFromSearch(searchParams, 'groupId');

  const { groups, isLoading: groupsLoading } = useResearchGroups({
    lecturerId: user?.userId ?? null,
  });

  // Fetch the full lecturer-owned topic list so the scope chip can resolve
  // the numeric topicId to a human-readable title.  The hook call mirrors
  // GroupDetail.tsx (lines 204-208).
  const { topics, isLoading: topicsLoading } = useResearchTopics({
    ownerUserId: user?.userId ?? null,
  });

  const topicName = useMemo((): string | null => {
    if (urlTopicId === null) return null;
    const found = topics.find((t) => t.id === urlTopicId);
    return found?.title ?? null;
  }, [urlTopicId, topics]);

  const [reports, setReports] = useState<PhasedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<PhaseReportStatusFilter>('all');
  const [detailReport, setDetailReport] = useState<PhasedReport | null>(null);
  const [deadlineModalReport, setDeadlineModalReport] =
    useState<PhasedReport | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await phasedReportService.getAll();
      setReports(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to load phase reports.',
      );
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Only show reports owned by the lecturer's groups. URL pre-filters
  // (topicId / groupId) apply before the search + status filter layer.
  const ownedReports = useMemo(() => {
    const ids = new Set(
      groups
        .map((g) => g.id)
        .filter((id): id is number => typeof id === 'number'),
    );
    let base = reports.filter(
      (r) =>
        typeof r.researchGroupId === 'number' &&
        ids.has(r.researchGroupId),
    );
    if (urlTopicId !== null) {
      base = base.filter((r) => r.topicId === urlTopicId);
    }
    if (urlGroupId !== null) {
      base = base.filter((r) => r.researchGroupId === urlGroupId);
    }
    return base;
  }, [groups, reports, urlTopicId, urlGroupId]);

  const groupNames = useMemo(
    () =>
      new Map(groups.map((g) => [g.id, g.name ?? `Group #${g.id}`])),
    [groups],
  );

  // Filter-tab counts — always reflect the FULL owned set so the user
  // can see how many of each status exist before picking a filter.
  const filterCounts = useMemo(() => {
    const counts: Record<
      'all' | 'awaiting-submission' | 'submitted' | 'overdue' | 'evaluated' | 'rejected',
      number
    > = {
      all: ownedReports.length,
      'awaiting-submission': 0,
      submitted: 0,
      overdue: 0,
      evaluated: 0,
      rejected: 0,
    };
    const now = new Date();
    for (const r of ownedReports) {
      const cls = classifyPhaseReportStatus(r, now);
      const key = classifyPhaseReportStatusToFilter(cls);
      if (key in counts) counts[key] += 1;
    }
    return counts;
  }, [ownedReports]);

  // Search + status filter pipeline applied on top of `ownedReports`,
  // then sorted so consecutive same-topic / same-group rows are
  // adjacent. Topic / group rowspan merging reads from this sorted list.
  const displayedReports = useMemo(() => {
    const now = new Date();
    let rows = ownedReports;
    if (statusFilter !== 'all') {
      rows = filterByPhaseReportStatus(rows, statusFilter, now);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        [r.topicTitle, r.groupName, r.studentName, r.milestoneTitle]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    // Stable ordering: overdue first, then submitted (awaiting review), then
    // rejected, then awaiting-submission, then evaluated.
    const bucketOrder: Record<
      'overdue' | 'submitted' | 'rejected' | 'awaiting-submission' | 'evaluated',
      number
    > = {
      overdue: 0,
      submitted: 1,
      rejected: 2,
      'awaiting-submission': 3,
      evaluated: 4,
    };
    return [...rows].sort((a, b) => {
      const order =
        bucketOrder[classifyPhaseReportStatus(a, now).status as keyof typeof bucketOrder] -
        bucketOrder[classifyPhaseReportStatus(b, now).status as keyof typeof bucketOrder];
      if (order !== 0) return order;
      const topicCompare = String(a.topicTitle ?? '').localeCompare(
        String(b.topicTitle ?? ''),
      );
      if (topicCompare !== 0) return topicCompare;
      // Within the same topic, group consecutive rows so the group cell
      // can also be merged.
      const aGroup = a.researchGroupId ?? -1;
      const bGroup = b.researchGroupId ?? -1;
      if (aGroup !== bGroup) return aGroup - bGroup;
      // Within the same topic + group, sort by phase number so phase 1
      // sits above phase 2.
      return (a.phaseNumber ?? 0) - (b.phaseNumber ?? 0);
    });
  }, [ownedReports, statusFilter, search]);

  // Compute rowSpan metadata for visual merging.
  const displayRows = useMemo(
    () => buildDisplayRows(displayedReports),
    [displayedReports],
  );

  // True when a deep-link pre-filter is active and the URL still has it.
  // topicName is:
  //   null      → no topicId in URL → chip hidden
  //   string    → topicId valid + name resolved
  //   undefined → topicId present but name not yet fetched / not in list
  const scopeChipVisible = urlTopicId !== null;
  const scopeChipLabel = useMemo((): string => {
    if (urlTopicId === null) return '';
    if (topicsLoading) {
      return t('lecturer.phaseReports.scopeChipLoading', 'Loading topic…');
    }
    if (topicName !== null) return topicName;
    // Missing from the list (network error, or the user navigated to a
    // topic they no longer own). Show a graceful fallback — never raw "#N".
    return t(
      'lecturer.phaseReports.scopeChipMissing',
      'Selected research topic',
    );
  }, [urlTopicId, topicName, topicsLoading, t]);

  return (
    <div className={styles.page}>
      {/* ── Page header ──────────────────────────────────────── */}
      <PageHeader
        title={t('lecturer.phaseReports.title', 'Phase Reports')}
        description={t(
          'lecturer.phaseReports.description',
          'Review submissions across every topic, phase, and research group.',
        )}
        actions={
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading || groupsLoading}
            leftIcon={<RefreshCw size={15} />}
          >
            {t('common.refresh', 'Refresh')}
          </Button>
        }
        accent="var(--ars-lecturer)"
      />

      {/* ── Scope chip (only when a deep-link filter is active) ── */}
      {scopeChipVisible && (
        <div className={styles.scopeChip}>
          <span>
            {t('lecturer.phaseReports.scopeChipPrefix', 'Filtered to topic:')}{' '}
            <strong>{scopeChipLabel}</strong>
          </span>
          <Link to="/lecturer/phase-reports" className={styles.scopeChipClear}>
            <X size={12} aria-hidden />{' '}
            {t('lecturer.phaseReports.scopeClear', 'Clear filter')}
          </Link>
        </div>
      )}

      {/* ── Toolbar (search only — refresh lives in the header) ── */}
      <div className={styles.toolbarRow}>
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          onRefresh={() => void load()}
          isRefreshing={loading || groupsLoading}
          hideRefresh
          className={styles.fullRowToolbar}
          searchFieldClassName={styles.wideSearchField}
          searchPlaceholder={t(
            'lecturer.phaseReports.searchPlaceholder',
            'Search by topic, group, phase, or student…',
          )}
        />
      </div>

      {/* ── Status filter tabs ────────────────────────────── */}
      <div className={styles.filterRow}>
        <PhaseReportStatusTabs
          value={statusFilter}
          onChange={setStatusFilter}
          counts={filterCounts}
          labels={{
            all: t('lecturer.phaseReports.filters.all', 'All'),
            'awaiting-submission': t(
              'lecturer.phaseReports.filters.awaiting',
              'Awaiting',
            ),
            submitted: t(
              'lecturer.phaseReports.filters.submitted',
              'Submitted',
            ),
            overdue: t(
              'lecturer.phaseReports.filters.overdue',
              'Overdue',
            ),
            evaluated: t(
              'lecturer.phaseReports.filters.evaluated',
              'Evaluated',
            ),
            rejected: t(
              'lecturer.phaseReports.filters.rejected',
              'Rejected',
            ),
          }}
        />
      </div>

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div className={styles.errorState} role="alert">
          <AlertTriangle size={14} aria-hidden />
          {error}
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────── */}
      {loading || groupsLoading ? (
        <div className={styles.loadingWrap}>
          <div className={styles.loadingRow}>
            <Loader size={16} className={styles.spinning} aria-hidden />{' '}
            Loading reports…
          </div>
          <SkeletonRow count={6} withHeader />
        </div>
      ) : displayRows.length === 0 ? (
        <EmptyState
          icon={<Inbox size={24} aria-hidden />}
          title={
            statusFilter !== 'all' || search.trim()
              ? t(
                  'lecturer.phaseReports.empty.filtered',
                  'No reports match this filter',
                )
              : t(
                  'lecturer.phaseReports.empty.all',
                  'No phase reports yet',
                )
          }
          description={
            statusFilter !== 'all' || search.trim()
              ? t(
                  'lecturer.phaseReports.empty.filteredDescription',
                  'Try adjusting the search or switching to a different status filter.',
                )
              : t(
                  'lecturer.phaseReports.empty.allDescription',
                  'Once a student submits a phase report for one of your research groups, it will appear here for review.',
                )
          }
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.reportsTable}>
            <thead>
              <tr>
                <th>
                  {t(
                    'lecturer.phaseReports.columns.topic',
                    'Research topic',
                  )}
                </th>
                <th>
                  {t(
                    'lecturer.phaseReports.columns.group',
                    'Research group',
                  )}
                </th>
                <th>
                  {t('lecturer.phaseReports.columns.phase', 'Phase')}
                </th>
                <th>
                  {t(
                    'lecturer.phaseReports.columns.deadline',
                    'Deadline',
                  )}
                </th>
                <th>
                  {t('lecturer.phaseReports.columns.status', 'Status')}
                </th>
                <th className={styles.actionsHeader} aria-label={t('lecturer.phaseReports.columns.actions', 'Actions')} />
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const { report } = row;
                const id = report.id ?? report.phasedReportId;
                const groupLabel =
                  groupNames.get(report.researchGroupId ?? -1) ??
                  report.groupName ??
                  '—';
                const phaseLabel =
                  report.milestoneTitle ??
                  `Phase ${report.phaseNumber ?? '—'}`;
                const deadlineText = formatDisplayDate(report.deadlineAt);
                const overdue = isDeadlineOverdue(report);
                const colTopic = t(
                  'lecturer.phaseReports.columns.topic',
                  'Research topic',
                );
                const colGroup = t(
                  'lecturer.phaseReports.columns.group',
                  'Research group',
                );
                const colPhase = t(
                  'lecturer.phaseReports.columns.phase',
                  'Phase',
                );
                const colDeadline = t(
                  'lecturer.phaseReports.columns.deadline',
                  'Deadline',
                );
                const colStatus = t(
                  'lecturer.phaseReports.columns.status',
                  'Status',
                );
                const colActions = t(
                  'lecturer.phaseReports.columns.actions',
                  'Actions',
                );
                const hasSubmission =
                  !!report.submittedAt && !!report.reportFileUrl;
                const evaluateLabel = hasSubmission
                  ? t(
                      'lecturer.phaseReports.actions.evaluate',
                      'Evaluate',
                    )
                  : t(
                      'lecturer.phaseReports.actions.viewDetail',
                      'View detail',
                    );
                return (
                  <tr
                    key={
                      id ??
                      `${report.topicId}-${report.researchGroupId}-${report.phaseNumber}`
                    }
                    className={styles.row}
                  >
                    {row.isFirstOfTopic && (
                      <td
                        className={styles.topicCell}
                        data-cell={colTopic}
                        rowSpan={row.topicRowSpan}
                      >
                        {report.topicTitle ?? '—'}
                      </td>
                    )}
                    {row.isFirstOfGroup && (
                      <td
                        className={styles.groupCell}
                        data-cell={colGroup}
                        rowSpan={row.groupRowSpan}
                      >
                        {groupLabel}
                      </td>
                    )}
                    <td data-cell={colPhase}>{phaseLabel}</td>
                    <td
                      data-cell={colDeadline}
                      className={
                        overdue ? styles.deadlineDanger : undefined
                      }
                    >
                      {deadlineText}
                    </td>
                    <td data-cell={colStatus}>
                      <StatusBadge
                        status={statusLabelOf(report)}
                        normalizedStatus={classifyPhaseReportStatus(report).status}
                        label={statusLabelOf(report)}
                        size="sm"
                      />
                    </td>
                    <td
                      className={styles.actionsCell}
                      data-cell={colActions}
                    >
                      <div className={styles.actionsRow}>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setDetailReport(report)}
                          leftIcon={<Eye size={13} />}
                          title={evaluateLabel}
                        >
                          {evaluateLabel}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeadlineModalReport(report)}
                          disabled={!overdue || id == null}
                          leftIcon={<Clock size={13} />}
                          title={
                            overdue
                              ? t(
                                  'lecturer.phaseReports.detail.updateDeadline',
                                  'Update deadline',
                                )
                              : t(
                                  'lecturer.phaseReports.tooltips.updateDeadlineDisabled',
                                  'Update deadline is available once the deadline has passed',
                                )
                          }
                        >
                          {t(
                            'lecturer.phaseReports.detail.updateDeadline',
                            'Update deadline',
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detail modal (header + PDF + inline grading form) ─ */}
      <PhaseReportDetailModal
        isOpen={detailReport !== null}
        report={detailReport}
        groupName={
          detailReport
            ? (groupNames.get(detailReport.researchGroupId ?? -1) ??
              detailReport.groupName ??
              undefined)
            : undefined
        }
        isDeadlineOverdue={
          detailReport ? isDeadlineOverdue(detailReport) : false
        }
        onClose={() => setDetailReport(null)}
        onRequestExtendDeadline={(r) => {
          if (!isDeadlineOverdue(r)) return;
          setDetailReport(null);
          setDeadlineModalReport(r);
        }}
        onSubmitted={() => {
          setDetailReport(null);
          void load();
        }}
      />

      {/* ── Extend deadline modal (page-level) ─────────────── */}
      <ExtendDeadlineModal
        isOpen={deadlineModalReport !== null}
        report={deadlineModalReport}
        groupName={
          deadlineModalReport
            ? (groupNames.get(deadlineModalReport.researchGroupId ?? -1) ??
              deadlineModalReport.groupName ??
              undefined)
            : undefined
        }
        onClose={() => setDeadlineModalReport(null)}
        onSuccess={() => {
          setDeadlineModalReport(null);
          void load();
        }}
      />
    </div>
  );
};

export default PhaseReports;
