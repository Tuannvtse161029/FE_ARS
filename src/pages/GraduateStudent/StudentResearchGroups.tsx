import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  FileText,
  Filter,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useStudentGroups } from '../../hooks/useStudentGroups';
import { usePhasedReports } from '../../hooks/usePhasedReports';
import { useLearningMaterials } from '../../hooks/useLearningMaterials';
import { groupMemberService, type GroupMember } from '../../services/groupMember.service';
import {
  lecturerLookupService,
} from '../../services/lecturerLookup.service';
import { getPrimaryMembershipId } from '../../components/gradstudent/utils';
import InvitationBanner from '../../components/gradstudent/InvitationBanner';
import RejectionFeedbackBanner from '../../components/gradstudent/RejectionFeedbackBanner';
import SubmitReportModal from '../../components/gradstudent/SubmitReportModal';
import MilestoneProgress from '../../components/research/MilestoneProgress';
import type { PhasedReportStatus } from '../../types/research';
import type { SubmittedPhasedReport } from '../../services/phasedReport.service';
import type { LearningMaterial } from '../../services/learningMaterial.service';
import styles from './StudentResearchGroups.module.css';

// Workspace that lists the Graduate Student's joined groups and per-group
// PhasedReports. Phase C contract §3.2 G5:
//
//   - Group members list via `groupMemberService.getMembersForGroup(groupId)`
//   - Learning materials list via `useLearningMaterials({ lecturerId })`
//     filtered by group/topic (BE has no group FK).
//   - `<MilestoneProgress />` consumes Grad-side reports.
//   - Lecturer name resolution via silent-failure `lecturerLookup.service.ts`.
//   - Invitation banner stays read-only with status field.
//   - All Bearer-auth-only read paths (no Bearer is forced here — the global
//     `axios` interceptor handles it for every request).

const DEFAULT_FOLDER_KEY = 'milestone';

type StatusFilter = 'all' | 'WAITING' | 'SUBMITTED' | 'EVALUATED' | 'REJECTED';

const STATUS_PALETTE: Record<PhasedReportStatus, string> = {
  WAITING: styles.statusWaiting,
  SUBMITTED: styles.statusSubmitted,
  EVALUATED: styles.statusEvaluated,
  REJECTED: styles.statusRejected,
};

export const StudentResearchGroups = (): JSX.Element => {
  const { user } = useAuth();
  const studentId = user?.userId ?? null;

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resubmitting, setResubmitting] = useState<SubmittedPhasedReport | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<SubmittedPhasedReport | null>(null);
  // Cache of resolved lecturer display names. Populated lazily by the
  // fire-and-forget probe in `lecturerLookupService.ensureLecturerDisplayName`.
  // We mirror the service cache into local state so a successful lookup
  // re-renders the workspace without making the helper React-aware.
  const [lecturerNames, setLecturerNames] = useState<Record<number, string>>({});

  const { joinedGroups, guidanceProject, isLoading, error, refetch } =
    useStudentGroups(studentId);
  const {
    reports,
    isLoading: reportsLoading,
    refetch: refetchReports,
  } = usePhasedReports(selectedGroupId);

  const selectedGroup = useMemo(() => {
    if (selectedGroupId === null) return null;
    return joinedGroups.find((g) => g.id === selectedGroupId) ?? null;
  }, [joinedGroups, selectedGroupId]);

  // Subscribe to the lecturerLookup service's resolution event so any
  // successful `userService.getById` probe re-renders the workspace.
  useEffect(() => {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<{ lecturerId: number }>).detail;
      if (!detail) return;
      const name = lecturerLookupService.getLecturerDisplayName(detail.lecturerId);
      setLecturerNames((prev) => ({ ...prev, [detail.lecturerId]: name }));
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(
        'ars:lecturer-name-resolved',
        handler as EventListener,
      );
      return () => {
        window.removeEventListener(
          'ars:lecturer-name-resolved',
          handler as EventListener,
        );
      };
    }
    return undefined;
  }, []);

  // Trigger fire-and-forget probes for every lecturer id we surface. Safe to
  // re-run on every render — the helper dedupes.
  const uniqueLecturerIds = useMemo(() => {
    const ids = new Set<number>();
    joinedGroups.forEach((g) => {
      if (typeof g.lecturerId === 'number' && g.lecturerId > 0) {
        ids.add(g.lecturerId);
      }
    });
    if (selectedGroup && typeof selectedGroup.lecturerId === 'number') {
      ids.add(selectedGroup.lecturerId);
    }
    if (guidanceProject && typeof guidanceProject.lecturerId === 'number') {
      ids.add(guidanceProject.lecturerId);
    }
    return Array.from(ids);
  }, [joinedGroups, selectedGroup, guidanceProject]);

  useEffect(() => {
    uniqueLecturerIds.forEach((id) => {
      lecturerLookupService.ensureLecturerDisplayName(id);
    });
  }, [uniqueLecturerIds]);

  const lecturerNameFor = (lecturerId: number | null | undefined): string => {
    if (typeof lecturerId !== 'number' || lecturerId <= 0) {
      return 'Lecturer';
    }
    const cached = lecturerNames[lecturerId];
    if (cached) return cached;
    // Fallback: synchronous read of the service's own module-scoped cache.
    // When the probe is still in flight this returns the `Lecturer #<id>`
    // fallback and the resolution event will re-render later.
    return lecturerLookupService.getLecturerDisplayName(lecturerId);
  };

  const filteredReports = useMemo(() => {
    const lowered = searchText.trim().toLowerCase();
    return reports
      .filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (lowered.length === 0) return true;
        const haystack = [
          `Report #${r.id}`,
          r.status,
          r.finalOutcomeEvaluation ?? '',
          r.capacityEvaluation ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(lowered);
      })
      .sort((a, b) => {
        const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [reports, searchText, statusFilter]);

  const handleRefresh = async (): Promise<void> => {
    await refetch();
    await refetchReports();
  };

  const handleSelectGroup = (groupId: number): void => {
    setSelectedGroupId(groupId);
    setSubmitting(false);
    setResubmitting(null);
    setLastSubmitted(null);
  };

  const handleOpenSubmit = (report?: SubmittedPhasedReport): void => {
    if (!selectedGroup) return;
    setResubmitting(report ?? null);
    setSubmitting(true);
  };

  const handleSubmitted = async (report: SubmittedPhasedReport): Promise<void> => {
    setLastSubmitted(report);
    await refetchReports();
  };

  const handleCloseSubmit = (): void => {
    setSubmitting(false);
    setResubmitting(null);
  };

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.errorBanner}>
          Please sign in to view your research groups.
        </div>
      </div>
    );
  }

  // ----- Workspace view -----
  if (selectedGroup) {
    const lecturerId = selectedGroup.lecturerId;
    return (
      <WorkspaceView
        group={selectedGroup}
        lecturerName={lecturerNameFor(lecturerId)}
        reports={filteredReports}
        reportsLoading={reportsLoading}
        searchText={searchText}
        onSearchChange={setSearchText}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onBack={() => setSelectedGroupId(null)}
        onOpenSubmit={handleOpenSubmit}
        isSubmitting={submitting}
        submittingReport={submitting}
        resubmittingReport={resubmitting}
        lastSubmitted={lastSubmitted}
        onCloseSubmit={handleCloseSubmit}
        onSubmitted={handleSubmitted}
        joinedGroups={joinedGroups}
        phaseKey={
          selectedGroup.name
            ? selectedGroup.name.toLowerCase().replace(/\s+/g, '-')
            : DEFAULT_FOLDER_KEY
        }
        phaseTitle={selectedGroup.name}
      />
    );
  }

  // ----- Overview view -----
  return (
    <div className={styles.page}>
      <header className={styles.overviewHeader}>
        <div>
          <h1 className={styles.pageTitle}>Research Groups</h1>
          <p className={styles.pageSubtitle}>
            {guidanceProject
              ? `Active guidance project: ${guidanceProject.title}`
              : 'You have not yet started a guidance project.'}
          </p>
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={handleRefresh}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 size={14} className={styles.spin} />
          ) : (
            <RefreshCw size={14} />
          )}
          <span>Refresh</span>
        </button>
      </header>

      {/* Read-only invitation banner. Renders nothing when no invitation is
          present; the BE has no /api/GroupInvitation so we cannot pre-load
          this from the server. The banner is an honest UI surface that
          documents the gap. */}
      <InvitationBanner
        invitation={null}
        onAccept={() => undefined}
        onDecline={() => undefined}
      />

      {error ? (
        <div className={styles.errorBanner} role="alert">
          {error.message}
        </div>
      ) : null}

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>My Joined Research Groups</h2>
          <p className={styles.sectionSubtitle}>
            Collaborate with lecturers and complete assigned topics.
          </p>
        </div>

        {isLoading ? (
          <div className={styles.emptyCard}>
            <Loader2 size={18} className={styles.spin} />
            <span>Loading your groups…</span>
          </div>
        ) : joinedGroups.length === 0 ? (
          <div className={styles.emptyCard}>
            <Inbox size={18} />
            <span>
              You haven&apos;t joined any research group yet. Once a lecturer
              adds you to one, it will appear here.
            </span>
          </div>
        ) : (
          <ul className={styles.groupList}>
            {joinedGroups.map((g) => (
              <li key={g.id} className={styles.groupCard}>
                <div className={styles.groupCardLeft}>
                  <span className={styles.groupIconCircle} aria-hidden>
                    <Users size={22} />
                  </span>
                  <div className={styles.groupInfo}>
                    <div className={styles.groupTitleRow}>
                      <h3 className={styles.groupName}>{g.name}</h3>
                      <span className={styles.activityPill}>
                        {g.activityStatus ?? 'ACTIVE'}
                      </span>
                    </div>
                    <div className={styles.groupMetaRow}>
                      <span>
                        <Mail size={12} />
                        Supervised by {lecturerNameFor(g.lecturerId)}
                      </span>
                      <span>
                        <Calendar size={12} />
                        {g.joinedAt
                          ? `Joined ${new Date(g.joinedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}`
                          : 'Recently joined'}
                      </span>
                    </div>
                    {g.description ? (
                      <p className={styles.groupDescription}>{g.description}</p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.openWorkspaceBtn}
                  onClick={() => handleSelectGroup(g.id)}
                >
                  Open Group Workspace
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

// ---------- WorkspaceView (split-out for readability) ----------

interface WorkspaceViewProps {
  group: import('../../services/groupMembership.service').StudentGroupView;
  lecturerName: string;
  reports: SubmittedPhasedReport[];
  reportsLoading: boolean;
  searchText: string;
  onSearchChange: (next: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (next: StatusFilter) => void;
  onBack: () => void;
  onOpenSubmit: (report?: SubmittedPhasedReport) => void;
  isSubmitting: boolean;
  submittingReport: boolean;
  resubmittingReport: SubmittedPhasedReport | null;
  lastSubmitted: SubmittedPhasedReport | null;
  onCloseSubmit: () => void;
  onSubmitted: (report: SubmittedPhasedReport) => Promise<void> | void;
  joinedGroups: ReadonlyArray<import('../../services/groupMembership.service').StudentGroupView>;
  phaseKey: string;
  phaseTitle: string;
}

function WorkspaceView({
  group,
  lecturerName,
  reports,
  reportsLoading,
  searchText,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onBack,
  onOpenSubmit,
  isSubmitting,
  submittingReport,
  resubmittingReport,
  lastSubmitted,
  onCloseSubmit,
  onSubmitted,
  joinedGroups,
  phaseKey,
  phaseTitle,
}: WorkspaceViewProps): JSX.Element {
  const lecturerId = group.lecturerId;

  // G5(a) — group members via shared helper.
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState<boolean>(true);
  useEffect(() => {
    let cancelled = false;
    setMembersLoading(true);
void groupMemberService
    .getMembersForGroup(group.id)
      .then((rows) => {
        if (!cancelled) setMembers(rows);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [group.id]);

  // G5(b) — learning materials scoped by lecturerId; no server-side group FK.
  const { materials, isLoading: materialsLoading } = useLearningMaterials({
    lecturerId,
  });
  const visibleMaterials = useMemo<LearningMaterial[]>(() => {
    if (materials.length === 0) return [];
    if (typeof group.topicId === 'number' && group.topicId > 0) {
      const filtered = materials.filter(
        (m) => m.subFieldId === group.topicId || m.subFieldId === null,
      );
      return filtered.length > 0 ? filtered : materials;
    }
    return materials;
  }, [materials, group.topicId]);

  const latestRejected = useMemo<SubmittedPhasedReport | null>(
    () => reports.find((r) => r.status === 'REJECTED') ?? null,
    [reports],
  );

  return (
    <div className={styles.page}>
      <button
        type="button"
        className={styles.backLinkBtn}
        onClick={onBack}
      >
        <ArrowLeft size={14} />
        <span>Back to Research Groups</span>
      </button>

      <header className={styles.workspaceHeaderCard}>
        <div className={styles.workspaceHeaderLeft}>
          <span className={styles.workspaceIconCircle} aria-hidden>
            <Users size={24} />
          </span>
          <div>
            <h2 className={styles.workspaceTitle}>{group.name}</h2>
            <p className={styles.workspaceSubtitle}>
              Supervised by {lecturerName}
              {group.description ? ` · ${group.description}` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => onOpenSubmit()}
        >
          <FileText size={14} />
          <span>Submit milestone report</span>
        </button>
      </header>

      {/* If the latest report is REJECTED, surface the banner. */}
      {latestRejected ? (
        <RejectionFeedbackBanner
          report={latestRejected}
          lecturerName={lecturerName}
          onResubmit={onOpenSubmit}
        />
      ) : null}

      {/* G5(c) — shared MilestoneProgress card. */}
      <section className={styles.card}>
        <MilestoneProgress reports={reports} />
      </section>

      {/* G5(b) — learning materials scoped by group. */}
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Learning materials</h3>
          <p className={styles.sectionSubtitle}>
            Shared by your lecturer. Files appear here once published.
          </p>
        </div>
        {materialsLoading ? (
          <div className={styles.emptyCard}>
            <Loader2 size={14} className={styles.spin} />
            <span>Loading materials…</span>
          </div>
        ) : visibleMaterials.length === 0 ? (
          <div className={styles.emptyCard}>
            <BookOpen size={14} />
            <span>No learning materials published for this group yet.</span>
          </div>
        ) : (
          <ul className={styles.materialList}>
            {visibleMaterials.map((m) => (
              <li key={m.id ?? m.learningMaterialId ?? m.title} className={styles.materialItem}>
                <span className={styles.materialTitle}>{m.title ?? 'Untitled material'}</span>
                {m.fileUrl ? (
                  <a
                    href={m.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.linkBtn}
                  >
                    Open PDF
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* G5(a) — fellow group members. */}
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Group members</h3>
          <p className={styles.sectionSubtitle}>
            Other students assigned to this group. The list is filtered
            client-side because BE does not expose `?researchGroupId=`.
          </p>
        </div>
        {membersLoading ? (
          <div className={styles.emptyCard}>
            <Loader2 size={14} className={styles.spin} />
            <span>Loading members…</span>
          </div>
        ) : members.length === 0 ? (
          <div className={styles.emptyCard}>
            <Users size={14} />
            <span>No fellow members yet.</span>
          </div>
        ) : (
          <ul className={styles.memberList}>
            {members.map((m) => (
              <li key={m.id ?? m.groupMemberId} className={styles.memberItem}>
                <span className={styles.memberLabel}>
                  Student #{m.studentId ?? '?'}
                </span>
                <span className={styles.activityPill}>
                  {m.activityStatus ?? 'ACTIVE'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>Milestone Reports</h3>
          <div className={styles.tableFilters}>
            <label className={styles.searchField}>
              <Search size={14} />
              <input
                type="search"
                placeholder="Search reports…"
                value={searchText}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </label>
            <label className={styles.filterField}>
              <Filter size={14} />
              <select
                value={statusFilter}
                onChange={(e) =>
                  onStatusFilterChange(e.target.value as StatusFilter)
                }
              >
                <option value="all">All statuses</option>
                <option value="WAITING">Waiting</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="EVALUATED">Evaluated</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </label>
          </div>
        </div>

        {reportsLoading ? (
          <div className={styles.emptyCard}>
            <Loader2 size={18} className={styles.spin} />
            <span>Loading reports…</span>
          </div>
        ) : reports.length === 0 ? (
          <div className={styles.emptyCard}>
            <Inbox size={18} />
            <span>
              No reports match your filters yet. Use{' '}
              <strong>Submit milestone report</strong> to upload one.
            </span>
          </div>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Lecturer Feedback</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <span className={styles.reportIdPill}>
                        #{report.id}
                      </span>
                    </td>
                    <td>
                      {report.submittedAt ? (
                        <span className={styles.dateText}>
                          <Calendar size={12} />
                          {new Date(report.submittedAt).toLocaleDateString(
                            'en-US',
                            { dateStyle: 'medium' },
                          )}
                        </span>
                      ) : (
                        <span className={styles.mutedText}>Unknown</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${STATUS_PALETTE[report.status]}`}
                      >
                        {report.status}
                      </span>
                    </td>
                    <td>
                      {report.finalOutcomeEvaluation ? (
                        <span className={styles.feedbackText}>
                          {report.finalOutcomeEvaluation.length > 80
                            ? `${report.finalOutcomeEvaluation.slice(0, 80)}…`
                            : report.finalOutcomeEvaluation}
                        </span>
                      ) : (
                        <span className={styles.mutedText}>
                          {report.status === 'EVALUATED'
                            ? `Grade: ${report.lectureFeedback ?? '—'}/10`
                            : '—'}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        {report.reportFileUrl ? (
                          <a
                            href={report.reportFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.linkBtn}
                          >
                            Open PDF
                          </a>
                        ) : null}
                        {report.status === 'REJECTED' ? (
                          <button
                            type="button"
                            className={styles.resubmitBtn}
                            onClick={() => onOpenSubmit(report)}
                          >
                            Resubmit
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {submittingReport ? (
        <SubmitReportModal
          isOpen={submittingReport}
          researchGroupId={group.id}
          groupMemberId={getPrimaryMembershipId(joinedGroups) ?? undefined}
          phaseKey={phaseKey}
          phaseTitle={phaseTitle}
          lecturerName={lecturerName}
          resubmittingReport={resubmittingReport}
          isSubmitting={isSubmitting}
          lastSubmitted={lastSubmitted}
          onClose={onCloseSubmit}
          onSubmitted={onSubmitted}
        />
      ) : null}
    </div>
  );
}

export default StudentResearchGroups;