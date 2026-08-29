import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  ResearchGroupCreateRequest,
  ResearchGroupUpdateRequest,
} from '../types/researchWorkflowDtos';

// ResearchGroup status is DERIVED until BE ships the `Status` column per the
// gap ticket §E.6. Until then, the FE computes `OPEN | ASSIGNED | COMPLETED`
// from `topicId != null` and from the related `ResearchTopic.status` (loaded
// separately by the caller — see `deriveGroupStatus` below).
export type ResearchGroupDerivedStatus = 'OPEN' | 'ASSIGNED' | 'COMPLETED';

// BE response shape (defensive — fields are all nullable per Swagger).
export interface ResearchGroup {
  id?: number;
  researchGroupId?: number;
  lecturerId?: number | null;
  topicId?: number | null;
  name?: string | null;
  description?: string | null;
  deadline?: string | null;
  assignedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const RESEARCH_GROUP_ENDPOINTS = {
  GET_ALL: API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_GROUP.GET_ALL,
  GET_BY_ID: API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_GROUP.GET_BY_ID,
  CREATE: API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_GROUP.CREATE,
  UPDATE: API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_GROUP.UPDATE,
  DELETE: (id: number) => API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_GROUP.UPDATE(id),
} as const;

const normalizeResearchGroup = (raw: ResearchGroup): ResearchGroup => ({
  ...raw,
  id: raw.researchGroupId ?? raw.id ?? undefined,
});

const normalizeResearchGroupList = (data: unknown): ResearchGroup[] => {
  const raw = Array.isArray(data) ? (data as ResearchGroup[]) : [];
  return raw.map(normalizeResearchGroup);
};

export const researchGroupService = {
  getAll: async (): Promise<ResearchGroup[]> => {
    const response = await api.get<ResearchGroup[]>(
      RESEARCH_GROUP_ENDPOINTS.GET_ALL,
    );
    return normalizeResearchGroupList(response.data);
  },

  getById: async (id: number): Promise<ResearchGroup> => {
    const response = await api.get<ResearchGroup>(
      RESEARCH_GROUP_ENDPOINTS.GET_BY_ID(id),
    );
    return normalizeResearchGroup(response.data);
  },

  create: async (
    payload: ResearchGroupCreateRequest,
  ): Promise<ResearchGroup> => {
    const response = await api.post<ResearchGroup>(
      RESEARCH_GROUP_ENDPOINTS.CREATE,
      payload,
    );
    return normalizeResearchGroup(response.data);
  },

  update: async (
    id: number,
    payload: ResearchGroupUpdateRequest,
  ): Promise<ResearchGroup> => {
    const response = await api.put<ResearchGroup>(
      RESEARCH_GROUP_ENDPOINTS.UPDATE(id),
      payload,
    );
    return normalizeResearchGroup(response.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(RESEARCH_GROUP_ENDPOINTS.DELETE(id));
  },

  getMyGroups: async (): Promise<ResearchGroup[]> => {
    try {
      const response = await api.get<ResearchGroup[]>(
        API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_GROUP.MY_GROUPS,
      );
      return normalizeResearchGroupList(response.data);
    } catch {
      return researchGroupService.getAll();
    }
  },

  invite: async (
    groupId: number,
    emails: string[],
  ): Promise<ResearchGroupInviteResponse> => {
    const response = await api.post<ResearchGroupInviteResponse>(
      API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_GROUP.INVITE(groupId),
      { emails },
    );
    return response.data;
  },
};

export interface ResearchGroupInviteResponse {
  researchGroupId: number;
  totalInvited: number;
  successEmails?: string[] | null;
  notFoundEmails?: string[] | null;
  alreadyMemberEmails?: string[] | null;
}

// Status derivation helper — see contract §3.
// Inputs: the group's own row + the related topic (may be null/undefined when
// the topic hasn't been loaded yet). Output is the FE-canonical derived
// status used by the Lecturer console.
export const deriveGroupStatus = (
  group: ResearchGroup | null | undefined,
  relatedTopicStatus: string | null | undefined,
): ResearchGroupDerivedStatus => {
  if (!group) return 'OPEN';
  if (!group.topicId) return 'OPEN';
  const normalised = (relatedTopicStatus ?? '').toLowerCase().trim();
  if (normalised === 'completed') return 'COMPLETED';
  // Any other assigned topic (OPEN, ASSIGNED, CLOSED) counts as ASSIGNED on
  // the group — the lecturer console treats it as "in progress".
  return 'ASSIGNED';
};

// Assign a topic to a list of groups. There is no
// `POST /api/ResearchTopic/{id}/assign` endpoint per the contract §2 so we
// have to call PUT /api/ResearchGroup/{id} once per selected group, attaching
// the topicId. Returns a per-group outcome so the caller can surface conflicts
// honestly (the BE will 409 if the group is locked by another topic).
export interface GroupAssignOutcome {
  groupId: number;
  ok: boolean;
  error?: string;
  group?: ResearchGroup;
}

export const assignTopicToGroups = async (
  topicId: number,
  groupIds: number[],
): Promise<GroupAssignOutcome[]> => {
  const settled = await Promise.allSettled(
    groupIds.map((groupId) =>
      researchGroupService.update(groupId, {
        lecturerId: null,
        topicId,
        name: null,
        description: null,
        deadline: null,
        assignedAt: new Date().toISOString(),
      }),
    ),
  );
  return settled.map((result, idx) => {
    const groupId = groupIds[idx] ?? -1;
    if (result.status === 'fulfilled') {
      return { groupId, ok: true, group: result.value };
    }
    const reason = result.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : 'Server conflict: group may already be locked by another topic.';
    return { groupId, ok: false, error: message };
  });
};

export default researchGroupService;
