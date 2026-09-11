/**
 * usePublicProfileData — orchestrator hook that fans out to the existing
 * services to build the data bundle each role's public view needs.
 *
 * Design principles:
 *   1. No new BE endpoints, no new fields on existing endpoints. We use
 *      only services that are already wired.
 *   2. Role-specific bundles are populated ONLY for the matching role —
 *      e.g. the `lecturer` key is populated only when `role === 'Lecturer'`.
 *   3. Every fetch is client-side filtered per the existing pattern in
 *      `profileExtras.service.ts`. A BE ticket is the right path for
 *      proper server-side filtering.
 *   4. All network errors are swallowed (return null/empty) so that one
 *      broken role-specific endpoint cannot blank the whole profile. The
 *      caller renders honest empty states when data is missing.
 *
 * Sourcing rules:
 *   - `profile`, `publications`, `forumPosts`     → useProfile + useProfileExtras
 *   - Reviewer     metrics, expertise, availability → /api/ProfessionalProfile
 *   - Researcher   metrics, expertise                → /api/ProfessionalProfile
 *   - Lecturer     upcoming seminars, groups, materials
 *                     → seminarService, researchGroupService, learningMaterialService
 *   - Graduate Student
 *                     group memberships, phased reports, seminar participations
 *                     → groupMemberService, phasedReportService, seminarService.participants
 */

import { useEffect, useMemo, useState } from 'react';
import type { Profile } from '../types/profile';
import { reviewerService, type ReviewerProfile } from '../services/reviewer.service';
import { researchGroupService, type ResearchGroup } from '../services/researchGroup.service';
import { learningMaterialService, type LearningMaterial } from '../services/learningMaterial.service';
import { seminarService, type Seminar } from '../services/seminar.service';
import { groupMemberService, type GroupMember } from '../services/groupMember.service';
import { phasedReportService, type PhasedReport } from '../services/phasedReport.service';
import { parseApiDateTimeAsUtc } from '../utils/datetime';
import type { ProfilePublicationPreview, ProfileForumPostPreview } from '../services/profileExtras.service';

export type PublicProfileRole = 'Reviewer' | 'Researcher' | 'Lecturer' | 'Graduate Student';

export interface PublicSeminarRow {
  id: number;
  title: string;
  startTime: string | null;
  endTime: string | null;
  status: string;
  effectiveStatus: string;
}

export interface PublicGroupRow {
  id: number | null;
  name: string;
  description: string | null;
  memberCount: number | null;
  isActive: boolean | null;
  topicTitle: string | null;
}

export interface PublicationRow {
  id: number;
  title: string;
  year: number | null;
  type: string;
  status: string;
}

export interface ReportMilestoneRow {
  id: number;
  phaseNumber: number | null;
  milestoneTitle: string | null;
  status: string;
  deadlineAt: string | null;
  submittedAt: string | null;
  groupName: string | null;
  topicTitle: string | null;
}

export interface PublicProfileData {
  /** Core profile record (from /api/Profile/{id}). */
  profile: Profile | null;
  /** Publications + forum posts the BE exposes for this user. */
  extras: {
    publications: ProfilePublicationPreview[];
    forumPosts: ProfileForumPostPreview[];
  };
  /** Lecturer's joined year (from `user.createdAt`). */
  joinedYear: number | null;
  /** Loading state for the role-specific bundle. */
  isRoleLoading: boolean;
  /** Error message for the role-specific bundle (null when ok). */
  roleError: string | null;

  reviewer?: {
    professionalProfile: ReviewerProfile | null;
    isAvailable: boolean | null;
    hindex: number | null;
    totalCitations: number | null;
    publicationCount: number | null;
    majorFieldName: string | null;
    subFieldName: string | null;
    expertiseChips: string[];
    yearStream: Array<{ label: string; value: number }>;
  };

  researcher?: {
    hindex: number | null;
    totalCitations: number | null;
    publicationCount: number | null;
    majorFieldName: string | null;
    subFieldName: string | null;
    publications: PublicationRow[];
    yearStream: Array<{ label: string; value: number }>;
    activeSinceYear: number | null;
  };

  lecturer?: {
    upcomingSeminars: PublicSeminarRow[];
    seminarsHostedCount: number;
    publicGroups: PublicGroupRow[];
    materialsCount: number;
  };

  graduateStudent?: {
    primaryGroup: PublicGroupRow | null;
    groups: PublicGroupRow[];
    reportMilestones: ReportMilestoneRow[];
    seminarsAttendedCount: number;
    reportsSubmittedCount: number;
    joinedYear: number | null;
  };
}

/** Internal "raw" state. Keeps the per-role data opt-in / isolated. */
interface RawRoleData {
  reviewer?: PublicProfileData['reviewer'];
  researcher?: PublicProfileData['researcher'];
  lecturer?: PublicProfileData['lecturer'];
  graduateStudent?: PublicProfileData['graduateStudent'];
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

const safeText = (value: string | null | undefined): string =>
  typeof value === 'string' ? value.trim() : '';

const extractYear = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const parsed = parseApiDateTimeAsUtc(iso) ?? new Date(iso);
  if (!parsed) return null;
  const y = parsed.getFullYear();
  return Number.isFinite(y) ? y : null;
};

const normalizePublicationRow = (
  pub: ProfilePublicationPreview,
  fallbackStatus = 'PUBLISHED',
): PublicationRow => {
  const year = extractYear(pub.publishedAt);
  const type = pub.doi ? 'Article' : 'Article';
  return {
    id: pub.id,
    title: safeText(pub.title) || `Untitled #${pub.id}`,
    year,
    type,
    status: fallbackStatus,
  };
};

const groupYearStream = (
  rows: Array<{ publishedAt: string | null }>,
): Array<{ label: string; value: number }> => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const y = extractYear(row.publishedAt);
    if (y == null) continue;
    const key = String(y);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }));
};

const normalizeGroupRow = (group: ResearchGroup): PublicGroupRow => ({
  id: group.id ?? null,
  name: safeText(group.name) || `Research group #${group.id ?? '?'}`,
  description: safeText(group.description) || null,
  memberCount: typeof group.memberCount === 'number' ? group.memberCount : null,
  isActive: typeof group.isActive === 'boolean' ? group.isActive : null,
  topicTitle: safeText(group.topicTitle) || null,
});

const normalizeMaterialRow = (m: LearningMaterial): { lecturerId: number | null } => ({
  lecturerId: typeof m.lecturerId === 'number' ? m.lecturerId : null,
});

const normalizeSeminarRow = (s: Seminar): PublicSeminarRow => {
  const statusRaw = safeText(s.status) || null;
  const startDate = parseApiDateTimeAsUtc(s.startTime);
  const endDate = parseApiDateTimeAsUtc(s.endTime ?? null);
  const now = new Date();
  let effectiveStatus: string;
  if (!endDate) {
    effectiveStatus = startDate && startDate.getTime() <= now.getTime() ? 'IN PROGRESS' : 'UPCOMING';
  } else if (endDate.getTime() < now.getTime()) {
    effectiveStatus = 'COMPLETED';
  } else if (startDate && startDate.getTime() <= now.getTime()) {
    effectiveStatus = 'IN PROGRESS';
  } else {
    effectiveStatus = 'UPCOMING';
  }
  return {
    id: s.seminarId,
    title: safeText(s.title ?? s.content) || `Seminar #${s.seminarId}`,
    startTime: s.startTime ?? null,
    endTime: s.endTime ?? null,
    status: statusRaw ?? 'Upcoming',
    effectiveStatus,
  };
};

const milestoneStatusLabel = (status: string | null | undefined): string => {
  if (!status) return 'Waiting';
  const v = status.toLowerCase().trim();
  if (v === 'submitted' || v === 'submitted_for_review' || v === 'pending_review') return 'Submitted';
  if (v === 'evaluated' || v === 'approved') return 'Evaluated';
  if (v === 'rejected') return 'Rejected';
  if (v === 'waiting' || v === 'pending' || v === 'awaiting') return 'Waiting';
  if (v === 'ontime' || v === 'on time') return 'On time';
  if (v === 'overdue' || v === 'late') return 'Overdue';
  if (v === 'passed' || v === 'pass') return 'Passed';
  return status;
};

const normalizeMilestone = (report: PhasedReport): ReportMilestoneRow => ({
  id: report.id ?? report.phasedReportId ?? 0,
  phaseNumber: typeof report.phaseNumber === 'number' ? report.phaseNumber : null,
  milestoneTitle:
    safeText(report.milestoneTitle) ||
    safeText(report.topicTitle) ||
    `Phase ${report.phaseNumber ?? '?'}`,
  status: milestoneStatusLabel(report.status),
  deadlineAt: report.deadlineAt ?? report.deadline ?? null,
  submittedAt: report.submittedAt ?? null,
  groupName: safeText(report.groupName) || null,
  topicTitle: safeText(report.topicTitle) || null,
});

const filterGroupsByLecturer = (groups: ResearchGroup[], lecturerId: number): PublicGroupRow[] =>
  groups
    .filter((g) => g.lecturerId === lecturerId)
    .map(normalizeGroupRow);

const filterSeminarsByHost = (seminars: Seminar[], hostId: number): Seminar[] =>
  seminars.filter((s) => s.organizerId === hostId);

const filterSeminarsUpcoming = (rows: Seminar[]): Seminar[] => {
  const now = Date.now();
  return rows.filter((s) => {
    const end = parseApiDateTimeAsUtc(s.endTime ?? null);
    if (end && end.getTime() < now) return false;
    const mapped = (s.status ?? '').toLowerCase().trim();
    if (mapped === 'inactive' || mapped === 'suspended' || mapped === 'suspend') return false;
    if (mapped === 'completed' || mapped === 'complete' || mapped === 'done') return false;
    return true;
  });
};

const filterMembersByStudent = (members: GroupMember[], studentId: number): GroupMember[] =>
  members.filter((m) => m.studentId === studentId && m.researchGroupId != null);

const filterReportsByStudent = (
  reports: PhasedReport[],
  studentGroupIds: Set<number>,
): PhasedReport[] =>
  reports.filter((r) => {
    if (r.researchGroupId != null && studentGroupIds.has(r.researchGroupId)) return true;
    return false;
  });

const countSeminarAttended = (
  participants: ReadonlyArray<{ userId?: number | null | undefined }>,
  userId: number,
): number =>
  participants.filter((p) => p.userId === userId).length;

/* ── Hook ──────────────────────────────────────────────────────────────── */

export interface UsePublicProfileDataArgs {
  role: PublicProfileRole | null;
  /** Resolved profile user id. */
  userId: number | null;
  /** Joined year (user.createdAt) — already resolved by the parent page. */
  joinedYear?: number | null;
  /** Already-fetched profile record (from useProfile). */
  profile?: Profile | null;
  /** Already-fetched extras (publications + forum posts). */
  publications?: ProfilePublicationPreview[];
  forumPosts?: ProfileForumPostPreview[];
}

export function usePublicProfileData({
  role,
  userId,
  joinedYear: joinedYearArg = null,
  profile = null,
  publications = [],
  forumPosts = [],
}: UsePublicProfileDataArgs): PublicProfileData {
  const [roleData, setRoleData] = useState<RawRoleData>({});
  const [isRoleLoading, setIsRoleLoading] = useState<boolean>(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  // ── Reviewer + Researcher: ProfessionalProfile (hindex, citations, expertise)
  useEffect(() => {
    if (!userId || (role !== 'Reviewer' && role !== 'Researcher')) return;
    let cancelled = false;
    setIsRoleLoading(true);
    setRoleError(null);
    reviewerService
      .getById(userId)
      .then((prof) => {
        if (cancelled) return;
        const expertiseChips = [
          safeText(prof?.majorFieldName) || null,
          safeText(prof?.subFieldName) || null,
        ].filter((x): x is string => Boolean(x));
        if (role === 'Reviewer') {
          const yearStream = publications
            .map((p) => ({ publishedAt: p.publishedAt }))
            .filter((p) => p.publishedAt != null);
          setRoleData((prev) => ({
            ...prev,
            reviewer: {
              professionalProfile: prof ?? null,
              isAvailable: typeof prof?.isAvailable === 'boolean' ? prof.isAvailable : null,
              hindex: prof?.hindex ?? null,
              totalCitations: prof?.totalCitations ?? null,
              publicationCount: prof?.publicationCount ?? null,
              majorFieldName: prof?.majorFieldName ?? null,
              subFieldName: prof?.subFieldName ?? null,
              expertiseChips,
              yearStream: groupYearStream(yearStream),
            },
          }));
        } else if (role === 'Researcher') {
          // ProfilePublicationPreview doesn't expose `status` — the BE filters
          // out non-PUBLISHED rows in profileExtras.service.ts. Treat every
          // row in the preview as eligible for the publication register.
          const publicationRows = publications
            .slice(0, 6)
            .map((p) => normalizePublicationRow(p));
          const yearStream = groupYearStream(
            publications.map((p) => ({ publishedAt: p.publishedAt })),
          );
          setRoleData((prev) => ({
            ...prev,
            researcher: {
              hindex: prof?.hindex ?? null,
              totalCitations: prof?.totalCitations ?? null,
              publicationCount: prof?.publicationCount ?? null,
              majorFieldName: prof?.majorFieldName ?? null,
              subFieldName: prof?.subFieldName ?? null,
              publications: publicationRows,
              yearStream,
              activeSinceYear: joinedYearArg,
            },
          }));
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRoleError(err instanceof Error ? err.message : 'Failed to load academic metrics.');
      })
      .finally(() => {
        if (!cancelled) setIsRoleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role, userId, publications, joinedYearArg]);

  // ── Lecturer: groups, seminars, materials
  useEffect(() => {
    if (!userId || role !== 'Lecturer') return;
    let cancelled = false;
    setIsRoleLoading(true);
    setRoleError(null);
    Promise.all([
      researchGroupService.getAll().catch(() => [] as ResearchGroup[]),
      seminarService.getAll().catch(() => [] as Seminar[]),
      learningMaterialService.getAll().catch(() => [] as LearningMaterial[]),
    ])
      .then(([groups, seminars, materials]) => {
        if (cancelled) return;
        const hosted = filterSeminarsByHost(seminars, userId);
        const upcoming = filterSeminarsUpcoming(hosted)
          .sort((a, b) => {
            const ax = parseApiDateTimeAsUtc(a.startTime)?.getTime() ?? 0;
            const bx = parseApiDateTimeAsUtc(b.startTime)?.getTime() ?? 0;
            return ax - bx;
          })
          .slice(0, 6)
          .map(normalizeSeminarRow);
        const publicGroups = filterGroupsByLecturer(groups, userId);
        const materialsCount = materials
          .map(normalizeMaterialRow)
          .filter((m) => m.lecturerId === userId).length;
        setRoleData((prev) => ({
          ...prev,
          lecturer: {
            upcomingSeminars: upcoming,
            seminarsHostedCount: hosted.length,
            publicGroups,
            materialsCount,
          },
        }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRoleError(err instanceof Error ? err.message : 'Failed to load lecturer data.');
      })
      .finally(() => {
        if (!cancelled) setIsRoleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role, userId]);

  // ── Graduate Student: groups membership, phased reports, seminar participations
  useEffect(() => {
    if (!userId || role !== 'Graduate Student') return;
    let cancelled = false;
    setIsRoleLoading(true);
    setRoleError(null);
    Promise.all([
      groupMemberService.getAll().catch(() => [] as GroupMember[]),
      researchGroupService.getAll().catch(() => [] as ResearchGroup[]),
      phasedReportService.getAll().catch(() => [] as PhasedReport[]),
      seminarService.getAll().catch(() => [] as Seminar[]),
    ])
      .then(([members, groups, reports, seminars]) => {
        if (cancelled) return;
        const myMemberships = filterMembersByStudent(members, userId);
        const studentGroupIds = new Set<number>();
        for (const m of myMemberships) {
          if (typeof m.researchGroupId === 'number') studentGroupIds.add(m.researchGroupId);
        }
        const groupsForStudent: PublicGroupRow[] = [];
        for (const g of groups) {
          if (typeof g.id === 'number' && studentGroupIds.has(g.id)) {
            groupsForStudent.push({
              ...normalizeGroupRow(g),
              memberCount:
                typeof g.memberCount === 'number'
                  ? g.memberCount
                  : groupsForStudent.find((x) => x.id === g.id)?.memberCount ?? null,
            });
          }
        }
        const primary = groupsForStudent[0] ?? null;
        const reportsForStudent = filterReportsByStudent(reports, studentGroupIds);
        const milestones = reportsForStudent
          .map(normalizeMilestone)
          .sort((a, b) => (a.phaseNumber ?? 0) - (b.phaseNumber ?? 0));
        const reportsSubmitted = reportsForStudent.filter(
          (r) => typeof r.status === 'string' && r.status.toLowerCase() !== 'waiting',
        ).length;
        let seminarsAttended = 0;
        for (const sem of seminars) {
          const parts = Array.isArray(sem.participants) ? sem.participants : [];
          seminarsAttended += countSeminarAttended(parts, userId);
        }
        setRoleData((prev) => ({
          ...prev,
          graduateStudent: {
            primaryGroup: primary,
            groups: groupsForStudent,
            reportMilestones: milestones,
            seminarsAttendedCount: seminarsAttended,
            reportsSubmittedCount: reportsSubmitted,
            joinedYear: joinedYearArg,
          },
        }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRoleError(err instanceof Error ? err.message : 'Failed to load graduate student data.');
      })
      .finally(() => {
        if (!cancelled) setIsRoleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role, userId, joinedYearArg]);

  const result = useMemo<PublicProfileData>(
    () => ({
      profile: profile ?? null,
      extras: { publications, forumPosts },
      joinedYear: joinedYearArg,
      isRoleLoading,
      roleError,
      ...roleData,
    }),
    [profile, publications, forumPosts, joinedYearArg, isRoleLoading, roleError, roleData],
  );

  return result;
}

export default usePublicProfileData;
