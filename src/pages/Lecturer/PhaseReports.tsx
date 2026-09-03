/**
 * PhaseReports — Lecturer phased-report review console.
 *
 * Supports two modes:
 *  - All topics (no query params): shows all owned topics with their
 *    phase reports, grouped by topic → phase.
 *  - Topic-scoped (topicId in URL): shows only the specified topic's
 *    phase reports, grouped by phase.
 *
 * The URL contract is:
 *   /lecturer/phase-reports[?topicId=<id>[&groupId=<id>]]
 *
 * The page reads from the URL on every mount and never falls back to a
 * default topic. All data comes from the live PhasedReport API.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronRight,
  Clock,
  FileText,
  Inbox,
  Loader,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useResearchGroups } from '../../hooks/useResearchGroups';
import {
  phasedReportService,
  type PhasedReport,
} from '../../services/phasedReport.service';
import { EvaluateReportModal } from '../../components/lecturer/EvaluateReportModal';
import { ExtendDeadlineModal } from '../../components/lecturer/ExtendDeadlineModal';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import { InlineNotice } from '../../components/InlineNotice/InlineNotice';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState';
import { parseIdFromSearch } from '../../utils/topicRouting';
import styles from './PhaseReports.module.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const dateLabel = (value?: string | null): string => {
  if (!value) return 'Not submitted';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
};

const displayStatus = (report: PhasedReport): string => {
  const raw = (report.status ?? '').toLowerCase().replace(/[ _-]/g, '');
  if (raw === 'rejected' || raw === 'denied') return 'Rejected';
  if (raw === 'evaluated' || raw === 'passed' || raw === 'approved') return 'Accepted';
  if (raw === 'underreview' || raw === 'pendingreview') return 'Under Review';
  if (raw === 'submitted' || raw === 'submittedforreview') {
    const overdue =
      report.isOverdue ??
      Boolean(
        report.submittedAt &&
          report.deadlineAt &&
          new Date(report.submittedAt) > new Date(report.deadlineAt),
      );
    return overdue ? 'Overdue Submitted' : 'Submitted On Time';
  }
  if (raw === 'notopen') return 'Not Open';
  return 'Awaiting Submission';
};

interface PhaseGroup {
  phase: number;
  title: string;
  reports: PhasedReport[];
}

interface TopicGroup {
  topicId: number;
  topicTitle: string;
  phases: Map<number, PhaseGroup>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const PhaseReports = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // URL-scoped filter values (null = show all)
  const urlTopicId = parseIdFromSearch(searchParams, 'topicId');
  const urlGroupId = parseIdFromSearch(searchParams, 'groupId');

  const { groups, isLoading: groupsLoading } = useResearchGroups({
    lecturerId: user?.userId ?? null,
  });

  const [reports, setReports] = useState<PhasedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PhasedReport | null>(null);
  const [deadlineModalReport, setDeadlineModalReport] = useState<PhasedReport | null>(null);

  // Determine page mode
  const isScoped = urlTopicId !== null;
  const scopeDescription = isScoped
    ? urlGroupId !== null
      ? 'Showing reports for a specific group'
      : 'Showing reports for a specific topic'
    : 'Showing all your topics';

  // Load all reports; filtering happens in the derived state below.
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await phasedReportService.getAll();
      setReports(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load phase reports.');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Only show reports owned by the lecturer's groups.
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
    // Apply URL filters (topicId, then optionally groupId).
    if (urlTopicId !== null) {
      base = base.filter((r) => r.topicId === urlTopicId);
    }
    if (urlGroupId !== null) {
      base = base.filter((r) => r.researchGroupId === urlGroupId);
    }
    return base;
  }, [groups, reports, urlTopicId, urlGroupId]);

  // Group by topic → phase number.
  const topicGrouped = useMemo((): Map<string, TopicGroup> => {
    const map = new Map<string, TopicGroup>();
    for (const report of ownedReports) {
      const topicKey = String(
        report.topicId ?? report.topicTitle ?? 'unassigned',
      );
      let topicGroup = map.get(topicKey);
      if (!topicGroup) {
        topicGroup = {
          topicId: typeof report.topicId === 'number' ? report.topicId : -1,
          topicTitle: report.topicTitle ?? `Topic ${topicKey}`,
          phases: new Map<number, PhaseGroup>(),
        };
        map.set(topicKey, topicGroup);
      }
      const phaseNum = report.phaseNumber ?? 0;
      let phaseGroup = topicGroup.phases.get(phaseNum);
      if (!phaseGroup) {
        phaseGroup = {
          phase: phaseNum,
          title:
            report.milestoneTitle ?? `Phase ${phaseNum || 'unassigned'}`,
          reports: [],
        };
        topicGroup.phases.set(phaseNum, phaseGroup);
      }
      phaseGroup.reports.push(report);
    }
    return map;
  }, [ownedReports]);

  const groupNames = useMemo(
    () =>
      new Map(
        groups.map((g) => [
          g.id,
          g.name ?? `Group #${g.id}`,
        ]),
      ),
    [groups],
  );

  // When scoped by topicId, the URL is the source of truth — no
  // client-side open/close state needed for the topic grid.

  return (
    <div className={styles.page}>
      {/* ── Page header ─────────────────────────────────────────── */}
      <PageHeader
        eyebrow="LECTURER WORKSPACE"
        title="Phase Reports"
        description={
          isScoped
            ? `${scopeDescription}. Use the links below to navigate the full drill-down.`
            : 'Review submissions grouped by topic, phase, and research group.'
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={loading || groupsLoading}
              leftIcon={<RefreshCw size={15} />}
            >
              Refresh
            </Button>
            {isScoped && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<ArrowLeft size={14} />}
                onClick={() => window.history.back()}
              >
                Back
              </Button>
            )}
          </>
        }
        accent="var(--ars-lecturer)"
      />

      {/* ── URL scope breadcrumb (when scoped) ─────────────────── */}
      {isScoped && (
        <div className={styles.scopeBreadcrumb}>
          <Link
            to="/lecturer/phase-reports"
            className={styles.scopeBreadcrumbLink}
          >
            All Topics
          </Link>
          {urlTopicId !== null && (
            <>
              <ChevronRight size={13} aria-hidden />
              <span className={styles.scopeBreadcrumbCurrent}>
                Topic #{urlTopicId}
              </span>
            </>
          )}
          {urlGroupId !== null && (
            <>
              <ChevronRight size={13} aria-hidden />
              <span className={styles.scopeBreadcrumbCurrent}>
                Group #{urlGroupId}
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Compact inline notice — replaces the prior full-width
          BackendGapBanner. Only surfaces when there's something to explain
          about the resubmission lineage. Otherwise quiet. */}
      {ownedReports.some(
        (r) =>
          r.status === 'SUBMITTED' &&
          typeof (r as { previousReportId?: unknown }).previousReportId !==
            'number',
      ) && (
        <InlineNotice
          tone="info"
          title="Resubmission lineage"
          description="Older reports are detected via the legacy __LINEAGE__: sentinel. New BE responses will populate the structured previousReportId column."
        />
      )}

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div className={styles.errorState} role="alert">
          <AlertTriangle size={14} aria-hidden />
          {error}
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────── */}
      {loading || groupsLoading ? (
        <div className={styles.loading}>
          <Loader size={18} className={styles.spinning} aria-hidden />{' '}
          Loading reports…
        </div>
      ) : topicGrouped.size === 0 ? (
        <EmptyState
          icon={<Inbox size={24} aria-hidden />}
          title={isScoped ? 'No reports for this scope' : 'No phase reports yet'}
          description={
            isScoped
              ? 'There are no phase reports matching the selected topic or group.'
              : 'Once a student submits a phase report for one of your research groups, it will appear here for review.'
          }
        />
      ) : (
        <div className={styles.topics}>
          {/* Topic ordering: any topic with at least one SUBMITTED / REJECTED
              report needing lecturer review surfaces first. Within each
              priority bucket the lecturer's natural newest-first order is
              preserved. */}
          {Array.from(topicGrouped.entries())
            .map(([key, group]) => ({ key, group }))
            .sort((a, b) => {
              const aHas = Array.from(a.group.phases.values()).some((p) =>
                p.reports.some(
                  (r) => r.status === 'SUBMITTED' || r.status === 'REJECTED',
                ),
              );
              const bHas = Array.from(b.group.phases.values()).some((p) =>
                p.reports.some(
                  (r) => r.status === 'SUBMITTED' || r.status === 'REJECTED',
                ),
              );
              if (aHas !== bHas) return aHas ? -1 : 1;
              return 0;
            })
            .map(({ key: topicKey, group: topicGroup }) => {
            const reportCount = topicGroup.phases.size;
            const totalReports = Array.from(topicGroup.phases.values()).reduce(
              (acc, p) => acc + p.reports.length,
              0,
            );
            const needsReview = Array.from(
              topicGroup.phases.values(),
            ).some((p) =>
              p.reports.some(
                (r) => r.status === 'SUBMITTED' || r.status === 'REJECTED',
              ),
            );
            const focusHref = isScoped
              ? '/lecturer/phase-reports'
              : `/lecturer/phase-reports?topicId=${topicGroup.topicId}`;
            const focusLabel = isScoped ? 'Back to all topics' : 'Open topic';
            return (
              <Link
                to={focusHref}
                className={styles.topicCard}
                key={topicKey}
                title={focusLabel}
              >
                <div className={styles.topicCardHeader}>
                  <span className={styles.topicCardTitleWrap}>
                    <h3 className={styles.topicCardTitle}>
                      {topicGroup.topicTitle}
                    </h3>
                    {needsReview && (
                      <span className={styles.topicCardPulse} aria-hidden />
                    )}
                  </span>
                  <ChevronRight
                    size={18}
                    className={styles.topicCardArrow}
                    aria-hidden
                  />
                </div>
                <div className={styles.topicCardStats}>
                  <span className={styles.topicStat}>
                    <FileText size={14} aria-hidden />
                    <strong>{totalReports}</strong> report
                    {totalReports !== 1 ? 's' : ''}
                  </span>
                  <span className={styles.topicStat}>
                    <Inbox size={14} aria-hidden />
                    <strong>{reportCount}</strong> phase
                    {reportCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className={styles.topicCardFooter}>
                  <span className={styles.topicCardAction}>
                    {focusLabel}
                  </span>
                  {needsReview && (
                    <span className={styles.topicCardReviewPill}>
                      Needs review
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Scoped phase reports ───────────────────────────────── */}
      {isScoped && !loading && !groupsLoading && topicGrouped.size > 0 && (
        <div className={styles.scopedPhases}>
          {Array.from(topicGrouped.entries()).map(([, topicGroup]) => (
            <section className={styles.topicDetail} key={topicGroup.topicId}>
              <header className={styles.topicDetailHeader}>
                <h2 className={styles.topicDetailTitle}>
                  {topicGroup.topicTitle}
                </h2>
                <Link
                  to="/lecturer/phase-reports"
                  className={styles.backToTopicsLink}
                >
                  ← Back to all topics
                </Link>
              </header>
              <div className={styles.phaseList}>
                {Array.from(topicGroup.phases.values())
                  .sort((a, b) => a.phase - b.phase)
                  .map((phase) => (
                    <div className={styles.phase} key={phase.phase}>
                      <div className={styles.phaseHeading}>
                        <h3>{phase.title}</h3>
                        <span className={styles.phaseHeadingCount}>
                          {phase.reports.length} report
                          {phase.reports.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className={styles.reportList}>
                        {phase.reports.map((report) => {
                          const id = report.id ?? report.phasedReportId;
                          const groupLabel =
                            groupNames.get(report.researchGroupId ?? -1) ??
                            report.groupName ??
                            'Unassigned group';
                          return (
                            <article
                              className={styles.report}
                              key={id ?? `${phase.phase}-${report.researchGroupId}`}
                            >
                              <div className={styles.reportMain}>
                                <div className={styles.reportTitle}>
                                  <StatusBadge
                                    status={displayStatus(report)}
                                    label={displayStatus(report)}
                                    size="sm"
                                  />
                                </div>
                                <strong className={styles.reportGroupName}>
                                  {groupLabel}
                                </strong>
                                <div className={styles.meta}>
                                  <span className={styles.metaItem}>
                                    <Users size={13} aria-hidden />
                                    <span className={styles.metaLabel}>
                                      Student
                                    </span>
                                    <span className={styles.metaValue}>
                                      {report.studentName ?? 'Not supplied'}
                                    </span>
                                  </span>
                                  <span className={styles.metaItem}>
                                    <Clock size={13} aria-hidden />
                                    <span className={styles.metaLabel}>
                                      Deadline
                                    </span>
                                    <span className={styles.metaValue}>
                                      {dateLabel(report.deadlineAt)}
                                    </span>
                                  </span>
                                  <span className={styles.metaItem}>
                                    <Calendar size={13} aria-hidden />
                                    <span className={styles.metaLabel}>
                                      Submitted
                                    </span>
                                    <span className={styles.metaValue}>
                                      {dateLabel(report.submittedAt)}
                                    </span>
                                  </span>
                                </div>
                              </div>
                              <div className={styles.actions}>
                                {report.reportFileUrl ? (
                                  <a
                                    className={styles.openPdfLink}
                                    href={report.reportFileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <FileText size={14} aria-hidden /> Open PDF
                                  </a>
                                ) : (
                                  <span className={styles.noFilePill}>
                                    No file uploaded
                                  </span>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDeadlineModalReport(report)}
                                  disabled={id == null}
                                  leftIcon={<Clock size={13} />}
                                  title="Extend deadline for this phase report"
                                >
                                  Update Deadline
                                </Button>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => setSelected(report)}
                                  disabled={id == null || !report.reportFileUrl}
                                  title={
                                    !report.reportFileUrl
                                      ? 'Review opens once a student uploads the report PDF.'
                                      : 'Open the evaluation modal'
                                  }
                                >
                                  Review
                                </Button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Evaluation modal ────────────────────────────────── */}
      <EvaluateReportModal
        isOpen={selected !== null}
        report={selected}
        onClose={() => setSelected(null)}
        onSubmitted={() => {
          setSelected(null);
          void load();
        }}
      />

      {/* ── Extend deadline modal ───────────────────────────── */}
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
