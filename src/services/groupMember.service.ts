import api from './axios';

// TODO(lead): the canonical endpoint constants live in `src/utils/constants.ts`
// under `API_ENDPOINTS.RESEARCH_WORKFLOW.GROUP_MEMBER.*` per the contract.
//
// SHARED SERVICE — both Agent-1 (Lecturer) and Agent-2 (GradStudent) read
// from this file. To avoid coupling the two views, this file ONLY exposes
// the raw CRUD plus a defensive client-side filter helper for the
// `studentId` case (BE doesn't expose `?studentId=` per contract §2).
//
// Do NOT add Lecturer-specific UI helpers (e.g. status badges, member-card
// formatting) here — those belong in `src/components/lecturer/`. The Grad
// student side has its own `gradstudent/` folder with a parallel helper if
// the two diverge.
const GROUP_MEMBER_ENDPOINTS = {
  GET_ALL: '/api/GroupMember',
  GET_BY_ID: (id: number) => `/api/GroupMember/${id}`,
  CREATE: '/api/GroupMember',
  UPDATE: (id: number) => `/api/GroupMember/${id}`,
  DELETE: (id: number) => `/api/GroupMember/${id}`,
} as const;

export interface GroupMember {
  id?: number;
  groupMemberId?: number;
  researchGroupId?: number | null;
  studentId?: number | null;
  activityStatus?: string | null;
  joinedAt?: string | null;
}

export interface GroupMemberCreateRequest {
  researchGroupId?: number | null;
  studentId?: number | null;
  activityStatus?: string | null;
  joinedAt?: string | null;
}

const normalizeGroupMember = (raw: GroupMember): GroupMember => ({
  ...raw,
  id: raw.groupMemberId ?? raw.id ?? undefined,
});

const normalizeGroupMemberList = (data: unknown): GroupMember[] => {
  const raw = Array.isArray(data) ? (data as GroupMember[]) : [];
  return raw.map(normalizeGroupMember);
};

export const groupMemberService = {
  getAll: async (): Promise<GroupMember[]> => {
    const response = await api.get<GroupMember[]>(GROUP_MEMBER_ENDPOINTS.GET_ALL);
    return normalizeGroupMemberList(response.data);
  },

  getById: async (id: number): Promise<GroupMember> => {
    const response = await api.get<GroupMember>(
      GROUP_MEMBER_ENDPOINTS.GET_BY_ID(id),
    );
    return normalizeGroupMember(response.data);
  },

  create: async (
    payload: GroupMemberCreateRequest,
  ): Promise<GroupMember> => {
    const response = await api.post<GroupMember>(
      GROUP_MEMBER_ENDPOINTS.CREATE,
      payload,
    );
    return normalizeGroupMember(response.data);
  },

  update: async (
    id: number,
    payload: Partial<GroupMemberCreateRequest>,
  ): Promise<GroupMember> => {
    const response = await api.put<GroupMember>(
      GROUP_MEMBER_ENDPOINTS.UPDATE(id),
      payload,
    );
    return normalizeGroupMember(response.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(GROUP_MEMBER_ENDPOINTS.DELETE(id));
  },

  // Group-keyed helper added in Phase C (Lead, lead-phase-c-contract.md §3.3
  // SHARED / cross-side). The BE does not expose `?researchGroupId=` so the FE
  // fetches all rows and filters client-side. Used by:
  //   - Agent 1 Lecturer/GroupDetail.tsx (group roster).
  //   - Agent 2 GraduateStudent/StudentResearchGroups.tsx (fellow members card).
  //   - Agent 2 GraduateStudentDashboard.tsx (group-member summary).
  getMembersForGroup: async (researchGroupId: number): Promise<GroupMember[]> => {
    const response = await api.get<GroupMember[]>(GROUP_MEMBER_ENDPOINTS.GET_ALL);
    const all = normalizeGroupMemberList(response.data);
    return all.filter((m) => m.researchGroupId === researchGroupId);
  },
};

// Client-side filter helper for the GradStudent "My groups" view, since BE
// does not expose `?studentId=` (contract §2). Returns only the rows that
// match the given studentId; throws nothing — empty input → empty output.
export const filterGroupMembersByStudentId = (
  members: readonly GroupMember[],
  studentId: number,
): GroupMember[] =>
  members.filter((m) => m.studentId === studentId);

// Group-keyed index helper: builds `{ [groupId]: GroupMember[] }` from a flat
// list of members. Both views (Lecturer roster, GradStudent workspace) need
// this — kept here as a pure function so neither side has to reimplement it.
export const indexGroupMembersByGroupId = (
  members: readonly GroupMember[],
): Record<number, GroupMember[]> => {
  const acc: Record<number, GroupMember[]> = {};
  for (const m of members) {
    const gid = m.researchGroupId;
    if (gid === null || gid === undefined) continue;
    const bucket = acc[gid] ?? [];
    bucket.push(m);
    acc[gid] = bucket;
  }
  return acc;
};

export default groupMemberService;