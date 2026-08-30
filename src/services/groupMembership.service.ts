// Read-only access to /api/GroupMember and /api/ResearchGroup from the
// Graduate Student side. Agent 1 (lecturer) owns the WRITE surface for both
// resources — see docs/local-only/research-workflow-contract.md §8.
//
// The GradStudent flow needs to:
//   1. List every GroupMember row, then filter by current studentId
//      (BE has no `?studentId=` filter — documented gap).
//   2. Resolve each GroupMember.researchGroupId against /api/ResearchGroup
//      to get the group name/description/lecturer for the dashboard.

import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { GroupMember, ResearchGroup } from '../types/research';
import { researchGroupService } from './researchGroup.service';

// ---------- Normalization ----------

const toGroupMember = (raw: unknown): GroupMember | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const idCandidate =
    (typeof r.id === 'number' && r.id) ||
    (typeof r.groupMemberId === 'number' && r.groupMemberId) ||
    0;
  const researchGroupIdCandidate =
    (typeof r.researchGroupId === 'number' && r.researchGroupId) ||
    (typeof r.groupId === 'number' && r.groupId) ||
    0;
  const studentIdCandidate =
    (typeof r.studentId === 'number' && r.studentId) || 0;
  if (idCandidate === 0 || researchGroupIdCandidate === 0 || studentIdCandidate === 0) {
    return null;
  }
  return {
    id: idCandidate,
    researchGroupId: researchGroupIdCandidate,
    studentId: studentIdCandidate,
    activityStatus:
      typeof r.activityStatus === 'string' ? r.activityStatus : undefined,
    joinedAt: typeof r.joinedAt === 'string' ? r.joinedAt : undefined,
  };
};

const toResearchGroup = (raw: unknown): ResearchGroup | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const idCandidate =
    (typeof r.id === 'number' && r.id) ||
    (typeof r.researchGroupId === 'number' && r.researchGroupId) ||
    0;
  if (idCandidate === 0) return null;
  return {
    id: idCandidate,
    lecturerId:
      typeof r.lecturerId === 'number' ? r.lecturerId : null,
    topicId: typeof r.topicId === 'number' ? r.topicId : null,
    name: typeof r.name === 'string' ? r.name : `Group #${idCandidate}`,
    description:
      typeof r.description === 'string' ? r.description : undefined,
    deadline: typeof r.deadline === 'string' ? r.deadline : undefined,
    assignedAt:
      typeof r.assignedAt === 'string' ? r.assignedAt : undefined,
  };
};

const toResearchGroupArray = (raw: unknown): ResearchGroup[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => toResearchGroup(item))
    .filter((item): item is ResearchGroup => item !== null);
};

const toGroupMemberArray = (raw: unknown): GroupMember[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => toGroupMember(item))
    .filter((item): item is GroupMember => item !== null);
};

// ---------- Reads ----------

export const getAllGroupMembers = async (): Promise<GroupMember[]> => {
  const response = await api.get<unknown>(
    API_ENDPOINTS.RESEARCH_WORKFLOW.GROUP_MEMBER.GET_ALL,
  );
  return toGroupMemberArray(response.data);
};

export const getAllResearchGroups = async (): Promise<ResearchGroup[]> => {
  const response = await api.get<unknown>(
    API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_GROUP.GET_ALL,
  );
  return toResearchGroupArray(response.data);
};

export const getResearchGroupById = async (
  id: number,
): Promise<ResearchGroup> => {
  const response = await api.get<unknown>(
    API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_GROUP.GET_BY_ID(id),
  );
  const normalized = toResearchGroup(response.data);
  if (!normalized) {
    throw new Error(`ResearchGroup ${id}: malformed response from BE`);
  }
  return normalized;
};

// ---------- Aggregate: the groups this student has joined ----------
//
// Combines the two GETs above, then filters the GroupMember list by the
// supplied studentId. The result is the resolved ResearchGroup[] for the
// student, ready to feed the dashboard / workspace pages.
export interface StudentGroupView extends ResearchGroup {
  membershipId: number;
  activityStatus?: string;
  joinedAt?: string;
  isLeader?: boolean;
}

export const getJoinedGroupsForStudent = async (
  studentId: number,
): Promise<StudentGroupView[]> => {
  const groups = await researchGroupService.getMyGroups();
  return groups
    .map((group): StudentGroupView | null => {
      const id = group.id ?? group.researchGroupId;
      if (typeof id !== 'number' || id <= 0) return null;
      const member = (group.members ?? []).find((raw) => {
        if (!raw || typeof raw !== 'object') return false;
        const row = raw as { studentId?: unknown };
        return Number(row.studentId) === studentId;
      }) as Record<string, unknown> | undefined;
      if (!member) return null;
      const membershipId = Number(member.groupMemberId ?? member.id);
      if (!Number.isFinite(membershipId) || membershipId <= 0) return null;
      return {
        id,
        lecturerId: group.lecturerId ?? null,
        topicId: group.topicId ?? null,
        name: group.name ?? `Group #${id}`,
        description: group.description ?? undefined,
        deadline: group.deadline ?? undefined,
        assignedAt: group.assignedAt ?? undefined,
        membershipId,
        activityStatus: typeof member.activityStatus === 'string' ? member.activityStatus : undefined,
        joinedAt: typeof member.joinedAt === 'string' ? member.joinedAt : undefined,
        isLeader: Boolean(member.isLeader || member.leaderId),
      };
    })
    .filter((item): item is StudentGroupView => item !== null);
};

export const groupMembershipService = {
  getAllGroupMembers,
  getAllResearchGroups,
  getResearchGroupById,
  getJoinedGroupsForStudent,
};

export default groupMembershipService;
