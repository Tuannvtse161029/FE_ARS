import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronRight, FileText, Inbox, Loader, RefreshCw, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useResearchGroups } from '../../hooks/useResearchGroups';
import { phasedReportService, type PhasedReport } from '../../services/phasedReport.service';
import { EvaluateReportModal } from '../../components/lecturer/EvaluateReportModal';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import { BackendGapBanner } from '../../components/BackendGapBanner';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState';
import styles from './PhaseReports.module.css';

const dateLabel = (value?: string | null) => {
  if (!value) return 'Not submitted';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
};

const displayStatus = (report: PhasedReport) => {
  const raw = (report.status ?? '').toLowerCase().replace(/[ _-]/g, '');
  if (raw === 'rejected' || raw === 'denied') return 'Rejected';
  if (raw === 'evaluated' || raw === 'passed' || raw === 'approved') return 'Accepted';
  if (raw === 'underreview' || raw === 'pendingreview') return 'Under Review';
  if (raw === 'submitted' || raw === 'submittedforreview') {
    const overdue = report.isOverdue ?? Boolean(report.submittedAt && report.deadlineAt && new Date(report.submittedAt) > new Date(report.deadlineAt));
    return overdue ? 'Overdue Submitted' : 'Submitted On Time';
  }
  if (raw === 'notopen') return 'Not Open';
  return 'Awaiting Submission';
};

interface PhaseGroup { phase: number; title: string; reports: PhasedReport[] }

export const PhaseReports = () => {
  const { user } = useAuth();
  const { groups, isLoading: groupsLoading } = useResearchGroups({ lecturerId: user?.userId ?? null });
  const [reports, setReports] = useState<PhasedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PhasedReport | null>(null);
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true); setError(null);
    try { setReports(await phasedReportService.getAll()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load phase reports.'); setReports([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const ownedReports = useMemo(() => {
    const ids = new Set(groups.map((group) => group.id).filter((id): id is number => typeof id === 'number'));
    return reports.filter((report) => typeof report.researchGroupId === 'number' && ids.has(report.researchGroupId));
  }, [groups, reports]);

  const grouped = useMemo(() => {
    const topics = new Map<string, Map<number, PhaseGroup>>();
    for (const report of ownedReports) {
      const topicKey = String(report.topicId ?? report.topicTitle ?? 'unassigned');
      const phases = topics.get(topicKey) ?? new Map<number, PhaseGroup>();
      const phase = report.phaseNumber ?? 0;
      const current = phases.get(phase) ?? { phase, title: report.milestoneTitle ?? `Phase ${phase || 'unassigned'}`, reports: [] };
      current.reports.push(report); phases.set(phase, current); topics.set(topicKey, phases);
    }
    return topics;
  }, [ownedReports]);

  const groupNames = useMemo(() => new Map(groups.map((group) => [group.id, group.name ?? `Group #${group.id}`])), [groups]);
  const toggleTopic = (key: string) => setOpenTopics((current) => ({ ...current, [key]: current[key] === false }));

  return <div className={styles.page}>
    <PageHeader eyebrow="LECTURER WORKSPACE" title="Phase Reports" description="Review submissions grouped by topic, phase, and research group." actions={<Button variant="outline" onClick={() => void load()} disabled={loading || groupsLoading} leftIcon={<RefreshCw size={15} />}>Refresh</Button>} />
    <BackendGapBanner field="PhasedReport.phaseId / resubmission lineage" feature="Stable phase identity and persisted rejected-report revision history" />
    {error && <div className={styles.errorState} role="alert">{error}</div>}
    {loading || groupsLoading ? (
      <div className={styles.loading}>
        <Loader size={18} className={styles.spinning} aria-hidden /> Loading reports…
      </div>
    ) : grouped.size === 0 ? (
      <EmptyState
        icon={<Inbox size={24} aria-hidden />}
        title="No phase reports yet"
        description="Once a student submits a phase report for one of your research groups, it will appear here for review."
      />
    ) : <div className={styles.topics}>
      {Array.from(grouped.entries()).map(([topicKey, phases]) => {
        const open = openTopics[topicKey] !== false;
        const first = Array.from(phases.values())[0]?.reports[0];
        const reportCount = ownedReports.filter((r) => String(r.topicId ?? r.topicTitle ?? 'unassigned') === topicKey).length;
        return <section className={styles.topic} key={topicKey}>
          <button
            className={styles.topicHeader}
            type="button"
            onClick={() => toggleTopic(topicKey)}
            aria-expanded={open}
          >
            <span className={styles.topicChevron}>
              {open ? <ChevronDown size={17} aria-hidden /> : <ChevronRight size={17} aria-hidden />}
            </span>
            <span className={styles.topicHeaderMain}>
              <strong className={styles.topicTitle}>{first?.topicTitle ?? `Topic ${topicKey}`}</strong>
              <small className={styles.topicSubtitle}>{reportCount} report{reportCount === 1 ? '' : 's'}</small>
            </span>
          </button>
          {open && <div className={styles.phaseList}>
            {Array.from(phases.values()).sort((a, b) => a.phase - b.phase).map((phase) => (
              <div className={styles.phase} key={phase.phase}>
                <div className={styles.phaseHeading}>
                  <h3>{phase.title}</h3>
                  <span className={styles.phaseHeadingCount}>{phase.reports.length} report{phase.reports.length === 1 ? '' : 's'}</span>
                </div>
                <div className={styles.reportList}>
                  {phase.reports.map((report) => {
                    const id = report.id ?? report.phasedReportId;
                    const groupLabel = groupNames.get(report.researchGroupId ?? -1) ?? report.groupName ?? 'Unassigned group';
                    return (
                      <article className={styles.report} key={id ?? `${topicKey}-${phase.phase}-${report.researchGroupId}`}>
                        <div className={styles.reportMain}>
                          <div className={styles.reportTitle}>
                            <StatusBadge status={displayStatus(report)} label={displayStatus(report)} size="sm" />
                            <strong>{groupLabel}</strong>
                          </div>
                          <div className={styles.meta}>
                            <span><Users size={13} aria-hidden /> {report.studentName ?? 'Group member not supplied'}</span>
                            <span><Calendar size={13} aria-hidden /> Due {dateLabel(report.deadlineAt)}</span>
                            <span>Submitted {dateLabel(report.submittedAt)}</span>
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
                            <span className={styles.noFilePill}>No file uploaded</span>
                          )}
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setSelected(report)}
                            disabled={id == null}
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
          </div>}
        </section>;
      })}
    </div>}
    <EvaluateReportModal isOpen={selected !== null} report={selected} onClose={() => setSelected(null)} onSubmitted={() => { setSelected(null); void load(); }} />
  </div>;
};

export default PhaseReports;
