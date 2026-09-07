/**
 * WorkspaceView — group workspace with milestones, materials, members
 *
 * Extracted from src/pages/GraduateStudent/StudentResearchGroups.tsx
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Inbox,
  FileText,
  Users,
} from 'lucide-react';
import { useI18n, useLocale } from '../../../i18n/I18nContext';
import { useLearningMaterials } from '../../../hooks/useLearningMaterials';
import { groupMemberService, type GroupMember } from '../../../services/groupMember.service';
import RejectionFeedbackBanner from '../../../components/gradstudent/RejectionFeedbackBanner';
import SubmitReportModal from '../../../components/gradstudent/SubmitReportModal';
import PhaseReportDetailModal from '../../../components/gradstudent/PhaseReportDetailModal';
import MilestoneProgress from '../../../components/research/MilestoneProgress';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyState } from '../../../components/EmptyState';
import { SkeletonRow } from '../../../components/SkeletonRow';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { TableToolbar } from '../../../components/table/TableToolbar';
import { TablePagination } from '../../../components/table/TablePagination';
import { SortableHeader } from '../../../components/table/SortableHeader';
import BackendGapBanner from '../../../components/BackendGapBanner';
import { usePagination } from '../../../hooks/usePagination';
import { useTableSort } from '../../../hooks/useTableSort';
import { DEFAULT_PAGE_SIZE } from '../../../utils/tableConstants';
import { useListShortcuts } from '../../../hooks/useListShortcuts';
import type { SubmittedPhasedReport } from '../../../services/phasedReport.service';
import type { LearningMaterial } from '../../../services/learningMaterial.service';
import type { StudentGroupView } from '../../../services/groupMembership.service';
// CSS module kept at the original StudentResearchGroups CSS location for now.
import styles from '../../pages/GraduateStudent/StudentResearchGroups.module.css';

type StatusFilter = 'all' | 'WAITING' | 'SUBMITTED' | 'EVALUATED' | 'REJECTED';
type ReportsSortColumn = 'phase' | 'milestone' | 'submitted' | 'deadline' | 'score' | 'status';

const DEFAULT_FOLDER_KEY = 'milestone';

export interface WorkspaceViewProps {
  group: StudentGroupView;
  lecturerName: string;
  reports: SubmittedPhasedReport[];
  reportsLoading: boolean;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  studentId: number | null;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  group,
  lecturerName,
  reports,
  reportsLoading,
  onBack,
  onRefresh,
  studentId,
}) => {
  const { t } = useI18n();
  const locale = useLocale();
  const copy = (en: string, vi: string): string => (locale === 'vi' ? vi : en);
  const lecturerId = group.lecturerId;

  const reportsSort = useTableSort<SubmittedPhasedReport, ReportsSortColumn>('submitted', 'desc');

  const [searchText, setSearchText] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resubmitting, setResubmitting] = useState<SubmittedPhasedReport | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<SubmittedPhasedReport | null>(null);

  const STATUS_FILTER_OPTIONS = [
    { value: 'all' as const, label: copy('All statuses', 'Tất cả trạng thái') },
    { value: 'WAITING' as const, label: copy('Waiting', 'Đang chờ') },
    { value: 'SUBMITTED' as const, label: copy('Submitted', 'Đã nộp') },
    { value: 'EVALUATED' as const, label: copy('Evaluated', 'Đã đánh giá') },
    { value: 'REJECTED' as const, label: copy('Rejected', 'Đã từ chối') },
  ];

  const sortedFilteredReports = useMemo(() => {
    const lowered = searchText.trim().toLowerCase();
    const base = reports.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (lowered.length === 0) return true;
      const haystack = [`Report #${r.id}`, r.status, r.finalOutcomeEvaluation ?? '', r.capacityEvaluation ?? '']
        .join(' ').toLowerCase();
      return haystack.includes(lowered);
    });
    return reportsSort.sortedItemsBy(base, (report) => {
      switch (reportsSort.sortState.column) {
        case 'phase': return report.phaseNumber ?? report.id ?? null;
        case 'milestone': return report.milestoneTitle ?? '';
        case 'submitted': return report.submittedAt ?? null;
        case 'deadline': return report.deadlineAt ?? null;
        case 'score': return report.lectureFeedback ?? null;
        case 'status':
        default: return report.status;
      }
    });
  }, [reports, searchText, statusFilter, reportsSort]);

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
  } = usePagination<SubmittedPhasedReport>(sortedFilteredReports, DEFAULT_PAGE_SIZE);

  useEffect(() => { resetReportsPage(); }, [searchText, statusFilter, reportsSort.sortState, resetReportsPage]);

  const { selectedIndex } = useListShortcuts({
    itemCount: pagedReports.length,
    onOpen: (index) => {
      const report = pagedReports[index];
      if (report?.reportFileUrl) window.open(report.reportFileUrl, '_blank', 'noopener,noreferrer');
    },
  });

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState<boolean>(true);
  useEffect(() => {
    let cancelled = false;
    setMembersLoading(true);
    void groupMemberService.getMembersForGroup(group.id)
      .then((rows) => { if (!cancelled) setMembers(rows); })
      .catch(() => { if (!cancelled) setMembers([]); })
      .finally(() => { if (!cancelled) setMembersLoading(false); });
    return () => { cancelled = true; };
  }, [group.id]);

  const currentMember = useMemo(() => members.find((member) => member.studentId === studentId) ?? null, [members, studentId]);
  const isCurrentUserLeader = Boolean(currentMember?.isLeader || group.isLeader);

  const { materials, isLoading: materialsLoading } = useLearningMaterials({ lecturerId });
  const visibleMaterials = useMemo<LearningMaterial[]>(() => {
    if (materials.length === 0) return [];
    if (typeof group.topicId === 'number' && group.topicId > 0) {
      const filtered = materials.filter((m) => m.subFieldId === group.topicId || m.subFieldId === null);
      return filtered.length > 0 ? filtered : materials;
    }
    return materials;
  }, [materials, group.topicId]);

  const latestRejected = useMemo<SubmittedPhasedReport | null>(
    () => reports.find((r) => r.status === 'REJECTED') ?? null,
    [reports],
  );

  const [viewDetailReport, setViewDetailReport] = useState<SubmittedPhasedReport | null>(null);

  const phaseKey = group.name ? group.name.toLowerCase().replace(/\s+/g, '-') : DEFAULT_FOLDER_KEY;
  const phaseTitle = group.name;

  return (
    <div className={styles.page}>
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={onBack} className={styles.backLinkBtn}>
        {copy('Back to Research Groups', 'Quay lại danh sách nhóm')}
      </Button>

      <PageHeader
        eyebrow={copy('GROUP WORKSPACE', 'KHÔNG GIAN NHÓM')}
        title={group.name}
        description={`${copy('Supervised by', 'Giảng viên hướng dẫn')}: ${lecturerName}${group.description ? ` · ${group.description}` : ''}`}
        accent="var(--accent-primary)"
        actions={
          isCurrentUserLeader ? (
            <Button variant="primary" size="sm" leftIcon={<FileText size={14} />} onClick={() => { setResubmitting(null); setSubmitting(true); }}>
              {copy('Submit milestone report', 'Nộp báo cáo giai đoạn')}
            </Button>
          ) : (
            <span className={styles.permissionNote} role="status">
              {copy('Only your Group Leader can submit this phase report.', 'Chỉ Trưởng nhóm (Leader) mới có thể nộp báo cáo giai đoạn này.')}
            </span>
          )
        }
      />

      <BackendGapBanner field="ProjectGuideline and phase-group task" feature="Guidelines and group-specific phase instructions" />

      {latestRejected ? (
        <RejectionFeedbackBanner report={latestRejected} lecturerName={lecturerName} onResubmit={isCurrentUserLeader ? () => { setResubmitting(latestRejected); setSubmitting(true); } : undefined} />
      ) : null}

      <section className={styles.card}>
        <MilestoneProgress reports={reports} />
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>{copy('Learning materials', 'Tài liệu học tập')}</h3>
          <p className={styles.sectionSubtitle}>{copy('Shared by your lecturer. Files appear here once published.', 'Được chia sẻ bởi giảng viên. Tệp sẽ xuất hiện ở đây sau khi được tải lên.')}</p>
        </div>
        {materialsLoading ? (
          <SkeletonRow count={2} rowHeight={48} gap={12} />
        ) : visibleMaterials.length === 0 ? (
          <EmptyState icon={<BookOpen size={24} />} title={copy('No learning materials yet', 'Chưa có tài liệu học tập nào')} description={copy('Lecturer materials will appear here once they publish them for this group.', 'Tài liệu từ giảng viên sẽ hiển thị ở đây khi được chia sẻ cho nhóm này.')} compact />
        ) : (
          <ul className={styles.materialList}>
            {visibleMaterials.map((m) => (
              <li key={m.id ?? m.learningMaterialId ?? m.title} className={styles.materialItem}>
                <span className={styles.materialTitle}>{m.title ?? copy('Untitled material', 'Tài liệu chưa đặt tên')}</span>
                {m.fileUrl ? <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.linkBtn}>{copy('Open PDF', 'Xem PDF')}</a> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>{copy('Group members', 'Thành viên nhóm')}</h3>
          <p className={styles.sectionSubtitle}>{copy('Other students assigned to this group.', 'Các sinh viên khác tham gia vào nhóm nghiên cứu này.')}</p>
        </div>
        {membersLoading ? (
          <SkeletonRow count={2} rowHeight={48} gap={12} />
        ) : members.length === 0 ? (
          <EmptyState icon={<Users size={24} />} title={copy('No fellow members yet', 'Chưa có thành viên nào khác')} description={copy('Other students in this group will appear here once they join.', 'Các sinh viên khác trong nhóm sẽ xuất hiện ở đây khi tham gia.')} compact />
        ) : (
          <ul className={styles.memberList}>
            {members.map((m) => (
              <li key={m.id ?? m.groupMemberId} className={styles.memberItem}>
                <span className={styles.memberLabel}>{copy('Student', 'Sinh viên')} #{m.studentId ?? '?'}</span>
                <span className={styles.activityPill}>{m.activityStatus ?? 'ACTIVE'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>{copy('Milestone Reports (Phase Reports)', 'Báo cáo giai đoạn (Phase Reports)')}</h3>
          {!isCurrentUserLeader && (
            <p className={styles.permissionNote} role="status">
              {copy('You are a group member. Only the Group Leader can submit progress reports.', 'Bạn là thành viên nhóm. Chỉ Trưởng nhóm (Leader) mới có thể nộp báo cáo tiến độ.')}
            </p>
          )}
        </div>

        <TableToolbar
          search={searchText}
          onSearchChange={setSearchText}
          onRefresh={() => void onRefresh()}
          isRefreshing={reportsLoading}
          searchPlaceholder={copy('Search by phase, status, or feedback…', 'Tìm kiếm theo giai đoạn, trạng thái, hoặc nhận xét…')}
          refreshLabel={copy('Refresh', 'Làm mới')}
          filters={
            <label className={styles.filterField}>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} aria-label={copy('Filter reports by status', 'Lọc báo cáo theo trạng thái')}>
                <option value="all">{copy('All statuses', 'Tất cả trạng thái')}</option>
                <option value="WAITING">{copy('Waiting', 'Đang chờ')}</option>
                <option value="SUBMITTED">{copy('Submitted', 'Đã nộp')}</option>
                <option value="EVALUATED">{copy('Evaluated', 'Đã đánh giá')}</option>
                <option value="REJECTED">{copy('Rejected', 'Đã từ chối')}</option>
              </select>
            </label>
          }
        />

        {reportsLoading ? (
          <SkeletonRow count={4} rowHeight={40} gap={8} />
        ) : reports.length === 0 ? (
          <EmptyState icon={<Inbox size={24} />} title={copy('No reports yet', 'Chưa có báo cáo nào')} description={isCurrentUserLeader ? copy('Use the Submit button on each Phase row below to upload a report.', 'Nhấn nút Nộp tại từng giai đoạn bên dưới để tải lên báo cáo.') : copy('The group leader has not submitted any phase reports yet.', 'Trưởng nhóm chưa nộp báo cáo giai đoạn nào.')} compact />
        ) : reportsTotalItems === 0 ? (
          <EmptyState icon={<Inbox size={24} />} title={copy('No matching reports', 'Không tìm thấy báo cáo phù hợp')} description={copy('No reports match the current filters.', 'Không có báo cáo nào khớp với bộ lọc hiện tại.')} compact />
        ) : (
          <>
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th><SortableHeader column="phase" label={copy('Phase', 'Giai đoạn')} cycleSort={reportsSort.cycleSort} ariaSortFor={reportsSort.ariaSortFor} /></th>
                    <th><SortableHeader column="milestone" label={copy('Milestone', 'Cột mốc')} cycleSort={reportsSort.cycleSort} ariaSortFor={reportsSort.ariaSortFor} /></th>
                    <th><SortableHeader column="submitted" label={copy('Submitted', 'Ngày nộp')} cycleSort={reportsSort.cycleSort} ariaSortFor={reportsSort.ariaSortFor} /></th>
                    <th><SortableHeader column="deadline" label={copy('Deadline', 'Hạn nộp')} cycleSort={reportsSort.cycleSort} ariaSortFor={reportsSort.ariaSortFor} /></th>
                    <th><SortableHeader column="status" label={copy('Status', 'Trạng thái')} cycleSort={reportsSort.cycleSort} ariaSortFor={reportsSort.ariaSortFor} filterOptions={STATUS_FILTER_OPTIONS} activeFilter={statusFilter} onFilterChange={(next) => setStatusFilter(next as StatusFilter)} /></th>
                    <th><SortableHeader column="score" label={copy('Score', 'Điểm')} cycleSort={reportsSort.cycleSort} ariaSortFor={reportsSort.ariaSortFor} align="right" /></th>
                    <th>{copy('Action', 'Thao tác')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedReports.map((report, index) => {
                    const canSubmit = isCurrentUserLeader && (
                      report.status === 'Pending' || report.status === 'WAITING' ||
                      report.status === 'REJECTED' || !report.submittedAt
                    );
                    const isSubmitted = report.submittedAt || report.status === 'Passed' || report.status === 'SUBMITTED' || report.status === 'EVALUATED';
                    return (
                      <tr key={report.id} data-testid="srg-row" className={selectedIndex === index ? styles.selectedRow : ''}>
                        <td>
                          <span className={styles.reportIdPill}>Phase {report.phaseNumber ?? report.id}</span>
                        </td>
                        <td>
                          <span className={styles.milestoneName}>{report.milestoneTitle || `Phase ${report.phaseNumber ?? report.id}`}</span>
                        </td>
                        <td>
                          {report.submittedAt ? (
                            <span className={styles.dateText}><Calendar size={12} />{new Date(report.submittedAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', { dateStyle: 'medium' })}</span>
                          ) : (
                            <span className={styles.mutedText}>{t('student.phaseReport.notSubmitted', 'Chưa nộp')}</span>
                          )}
                        </td>
                        <td>
                          {report.deadlineAt ? (
                            <span className={`${styles.dateText} ${report.isOverdue ? styles.overdueDate : ''}`}>
                              <Calendar size={12} />
                              {new Date(report.deadlineAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', { dateStyle: 'medium' })}
                              {report.isOverdue ? <span className={styles.overdueLabel}>{t('student.phaseReport.overdue', 'Quá hạn')}</span> : null}
                            </span>
                          ) : (
                            <span className={styles.mutedText}>—</span>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={report.status} size="sm" />
                        </td>
                        <td>
                          {typeof report.lectureFeedback === 'number' ? (
                            <span className={styles.scoreValue}>{report.lectureFeedback}/10</span>
                          ) : (
                            <span className={styles.mutedText}>—</span>
                          )}
                        </td>
                        <td>
                          <div className={styles.rowActions}>
                            {isSubmitted ? (
                              <button type="button" className={styles.detailBtn} onClick={() => setViewDetailReport(report)}>
                                <FileText size={12} aria-hidden />{t('student.phaseReport.viewDetail', 'Xem chi tiết')}
                              </button>
                            ) : null}
                            {report.reportFileUrl ? (
                              <a href={report.reportFileUrl} target="_blank" rel="noopener noreferrer" className={styles.linkBtn}>{copy('Open PDF', 'Xem PDF')}</a>
                            ) : null}
                            {isCurrentUserLeader && canSubmit ? (
                              <button type="button" className={styles.submitPhaseBtn} onClick={() => { setResubmitting(report.status === 'REJECTED' ? report : null); setSubmitting(true); }}>
                                {report.status === 'REJECTED' ? t('student.phaseReport.resubmit', 'Nộp lại') : `${t('student.phaseReport.submit', 'Nộp Phase')} ${report.phaseNumber ?? ''}`}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
              itemLabel={copy('reports', 'báo cáo')}
            />
          </>
        )}
      </section>

      {submitting && (
        <SubmitReportModal
          isOpen={submitting}
          researchGroupId={group.id}
          groupMemberId={currentMember?.id ?? currentMember?.groupMemberId ?? undefined}
          phaseKey={phaseKey}
          phaseTitle={phaseTitle}
          lecturerName={lecturerName}
          resubmittingReport={resubmitting}
          isSubmitting={submitting}
          lastSubmitted={lastSubmitted}
          onClose={() => { setSubmitting(false); setResubmitting(null); }}
          onSubmitted={async (report) => { setLastSubmitted(report); await onRefresh(); }}
        />
      )}

      <PhaseReportDetailModal
        isOpen={viewDetailReport !== null}
        report={viewDetailReport}
        groupName={group.name}
        lecturerName={lecturerName}
        onClose={() => setViewDetailReport(null)}
      />
    </div>
  );
};

export default WorkspaceView;
