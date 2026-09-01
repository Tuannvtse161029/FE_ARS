/**
 * StudentResearchGroups — Research Journey
 * ARS Research Constellation — Graduate Student workspace
 *
 * Two surfaces:
 *  - Overview: list of joined groups with an invitation banner
 *  - Workspace (per group): milestone progress, learning materials, group
 *    members, and the milestone-reports table
 *
 * Design rules applied:
 *  - PageHeader + role accent `--ars-gradstudent`
 *  - Shared `EmptyState`, `ErrorBanner`, `SkeletonRow`, `StatusBadge`
 *  - Tables use `TableToolbar` + `TablePagination`
 *  - No inline styles in JSX (CSS Modules only)
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  FileText,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useStudentGroups } from '../../hooks/useStudentGroups';
import { usePhasedReports } from '../../hooks/usePhasedReports';
import { useLearningMaterials } from '../../hooks/useLearningMaterials';
import { groupMemberService, type GroupMember } from '../../services/groupMember.service';
import { lecturerLookupService } from '../../services/lecturerLookup.service';
import InvitationBanner from '../../components/gradstudent/InvitationBanner';
import RejectionFeedbackBanner from '../../components/gradstudent/RejectionFeedbackBanner';
import SubmitReportModal from '../../components/gradstudent/SubmitReportModal';
import MilestoneProgress from '../../components/research/MilestoneProgress';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import BackendGapBanner from '../../components/BackendGapBanner';
import { usePagination } from '../../hooks/usePagination';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import { useListShortcuts } from '../../hooks/useListShortcuts';
import type { SubmittedPhasedReport } from '../../services/phasedReport.service';
import type { LearningMaterial } from '../../services/learningMaterial.service';
import styles from './StudentResearchGroups.module.css';

const DEFAULT_FOLDER_KEY = 'milestone';
const ROLE_ACCENT = 'var(--ars-gradstudent)';

type StatusFilter = 'all' | 'WAITING' | 'SUBMITTED' | 'EVALUATED' | 'REJECTED';
export const StudentResearchGroups = (): JSX.Element => {
  const { user } = useAuth();
  const studentId = user?.userId ?? null;

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resubmitting, setResubmitting] = useState<SubmittedPhasedReport | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<SubmittedPhasedReport | null>(null);
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
        <ErrorBanner
          tone="error"
          message="Please sign in to view your research groups."
        />
      </div>
    );
  }

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
        onRefresh={handleRefresh}
        studentId={studentId}
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
      <PageHeader
        eyebrow="RESEARCH GROUPS"
        title="My Research Groups"
        description={
          guidanceProject
            ? `Active guidance project: ${guidanceProject.title}`
            : 'You have not yet started a guidance project.'
        }
        accent={ROLE_ACCENT}
        actions={
          <Button
            variant="outline"
            size="sm"
            leftIcon={
              isLoading ? (
                <Loader2 size={13} className={styles.spin} />
              ) : (
                <RefreshCw size={13} />
              )
            }
            onClick={handleRefresh}
            disabled={isLoading}
          >
            Refresh
          </Button>
        }
      />

      <InvitationBanner
        invitation={null}
        onAccept={() => undefined}
        onDecline={() => undefined}
      />

      {error ? (
        <ErrorBanner tone="error" message={error.message} />
      ) : null}

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>My Joined Research Groups</h2>
          <p className={styles.sectionSubtitle}>
            Collaborate with lecturers and complete assigned topics.
          </p>
        </div>

        {isLoading ? (
          <SkeletonRow count={3} rowHeight={88} gap={12} />
        ) : joinedGroups.length === 0 ? (
          <EmptyState
            icon={<Inbox size={24} />}
            title="No research groups yet"
            description="Once a lecturer adds you to a group, it will appear here."
          />
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
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleSelectGroup(g.id)}
                >
                  Open Group Workspace
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

// ---------- WorkspaceView ----------

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
  onRefresh: () => Promise<void>;
  studentId: number | null;
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
  onRefresh,
  studentId,
  phaseKey,
  phaseTitle,
}: WorkspaceViewProps): JSX.Element {
  const lecturerId = group.lecturerId;

  const {
    page: reportsTablePage,
    totalPages: reportsTotalPages,
    totalItems: reportsTotalItems,
    startIndex: reportsStartIndex,
    endIndex: reportsEndIndex,
    pageItems: pagedReports,
    setPage: setReportsPage,
    next: nextReportsPage,
    prev: prevReportsPage,
    resetPage: resetReportsPage,
  } = usePagination<SubmittedPhasedReport>(reports, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetReportsPage();
  }, [searchText, statusFilter, resetReportsPage]);

  // Part 3 — keyboard shortcuts for the milestone-reports table.
  // j/k navigate rows, Enter opens the PDF if available,
  // f focuses the toolbar search input.
  const { selectedIndex } = useListShortcuts({
    itemCount: pagedReports.length,
    onOpen: (index) => {
      const report = pagedReports[index];
      if (report?.reportFileUrl) {
        window.open(report.reportFileUrl, '_blank', 'noopener,noreferrer');
      }
    },
  });

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

  const currentMember = useMemo(
    () => members.find((member) => member.studentId === studentId) ?? null,
    [members, studentId],
  );
  const isCurrentUserLeader = Boolean(currentMember?.isLeader || group.isLeader);

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
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<ArrowLeft size={14} />}
        onClick={onBack}
        className={styles.backLinkBtn}
      >
        Back to Research Groups
      </Button>

      <PageHeader
        eyebrow="GROUP WORKSPACE"
        title={group.name}
        description={`Supervised by ${lecturerName}${
          group.description ? ` · ${group.description}` : ''
        }`}
        accent={ROLE_ACCENT}
        actions={
          isCurrentUserLeader ? (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<FileText size={14} />}
              onClick={() => onOpenSubmit()}
            >
              Submit milestone report
            </Button>
          ) : (
            <span className={styles.permissionNote} role="status">
              Only your Group Leader can submit this phase report.
            </span>
          )
        }
      />

      <BackendGapBanner
        field="ProjectGuideline and phase-group task"
        feature="Guidelines and group-specific phase instructions"
      />

      {latestRejected ? (
        <RejectionFeedbackBanner
          report={latestRejected}
          lecturerName={lecturerName}
          onResubmit={isCurrentUserLeader ? onOpenSubmit : undefined}
        />
      ) : null}

      <section className={styles.card}>
        <MilestoneProgress reports={reports} />
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Learning materials</h3>
          <p className={styles.sectionSubtitle}>
            Shared by your lecturer. Files appear here once published.
          </p>
        </div>
        {materialsLoading ? (
          <SkeletonRow count={2} rowHeight={48} gap={12} />
        ) : visibleMaterials.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={24} />}
            title="No learning materials yet"
            description="Lecturer materials will appear here once they publish them for this group."
            compact
          />
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

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Group members</h3>
          <p className={styles.sectionSubtitle}>
            Other students assigned to this group. The list is filtered
            client-side because BE does not expose `?researchGroupId=`.
          </p>
        </div>
        {membersLoading ? (
          <SkeletonRow count={2} rowHeight={48} gap={12} />
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            title="No fellow members yet"
            description="Other students in this group will appear here once they join."
            compact
          />
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
        </div>

        <TableToolbar
          search={searchText}
          onSearchChange={onSearchChange}
          onRefresh={onRefresh}
          isRefreshing={reportsLoading}
          searchPlaceholder="Search by report id, status, or feedback…"
          refreshLabel="Refresh"
          filters={
            <label className={styles.filterField}>
              <select
                value={statusFilter}
                onChange={(e) =>
                  onStatusFilterChange(e.target.value as StatusFilter)
                }
                aria-label="Filter reports by status"
              >
                <option value="all">All statuses</option>
                <option value="WAITING">Waiting</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="EVALUATED">Evaluated</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </label>
          }
        />

        {reportsLoading ? (
          <SkeletonRow count={4} rowHeight={40} gap={8} />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<Inbox size={24} />}
            title="No reports yet"
            description="Use Submit milestone report to upload your first PDF."
            compact
          />
        ) : reportsTotalItems === 0 ? (
          <EmptyState
            icon={<Inbox size={24} />}
            title="No matching reports"
            description="No reports match the current filters."
            compact
          />
        ) : (
          <>
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
                  {pagedReports.map((report, index) => (
                    <tr
                      key={report.id}
                      data-testid="srg-row"
                      className={selectedIndex === index ? styles.selectedRow : ''}
                    >
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
                        <StatusBadge status={report.status} size="sm" />
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
                          {report.status === 'REJECTED' && isCurrentUserLeader ? (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => onOpenSubmit(report)}
                            >
                              Resubmit
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={reportsTablePage}
              totalPages={reportsTotalPages}
              totalItems={reportsTotalItems}
              startIndex={reportsStartIndex}
              endIndex={reportsEndIndex}
              onPrev={prevReportsPage}
              onNext={nextReportsPage}
              onPage={setReportsPage}
              itemLabel="reports"
            />
          </>
        )}
      </section>

      {submittingReport ? (
        <SubmitReportModal
          isOpen={submittingReport}
          researchGroupId={group.id}
          groupMemberId={currentMember?.id ?? currentMember?.groupMemberId ?? undefined}
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
