import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import {
  normalizeResearchTopicStatus,
  canTransitionResearchTopic,
} from '../utils/researchStatus';
import type {
  ResearchTopicCreateRequest,
  ResearchTopicUpdateRequest,
} from '../types/researchWorkflowDtos';

type TopicGuidelineFields = {
  topicGuidelines?: string | null;
  topicGuidelinesUrl?: string | null;
};

export type ResearchTopicCreatePayload = ResearchTopicCreateRequest & TopicGuidelineFields;
export type ResearchTopicUpdatePayload = ResearchTopicUpdateRequest & TopicGuidelineFields;

// Status enums per `docs/local-only/research-workflow-contract.md` §3.
export type ResearchTopicStatus = 'OPEN' | 'ASSIGNED' | 'COMPLETED' | 'CLOSED';

export const RESEARCH_TOPIC_STATUSES: readonly ResearchTopicStatus[] = [
  'OPEN',
  'ASSIGNED',
  'COMPLETED',
  'CLOSED',
] as const;

const RESEARCH_TOPIC_ENDPOINTS = {
  GET_ALL: API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_TOPIC.GET_ALL,
  GET_BY_ID: API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_TOPIC.GET_BY_ID,
  CREATE: API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_TOPIC.CREATE,
  UPDATE: API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_TOPIC.UPDATE,
  DELETE: API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_TOPIC.DELETE,
} as const;

// Re-export the canonical status-transition predicate from the shared status
// utility so callers can import both surface names from this service file.
export { canTransitionResearchTopic };

// BE response shape — every property is optional/nullable per the Swagger
// ResearchTopic schema (the BE does not yet ship a typed response body).
export interface ResearchTopic {
  id?: number;
  topicId?: number;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  materialsUrl?: string | null;
  topicGuidelines?: string | null;
  topicGuidelinesUrl?: string | null;
  assignedGroupIds?: number[] | null;
  lecturerId?: number | null;
  lecturerName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const normalizeResearchTopic = (raw: ResearchTopic): ResearchTopic => ({
  ...raw,
  id: raw.topicId ?? raw.id ?? undefined,
});

const normalizeResearchTopicList = (data: unknown): ResearchTopic[] => {
  const raw = Array.isArray(data) ? (data as ResearchTopic[]) : [];
  return raw.map(normalizeResearchTopic);
};

export const researchTopicService = {
  getAll: async (): Promise<ResearchTopic[]> => {
    const response = await api.get<ResearchTopic[]>(
      RESEARCH_TOPIC_ENDPOINTS.GET_ALL,
    );
    return normalizeResearchTopicList(response.data);
  },

  getById: async (id: number): Promise<ResearchTopic> => {
    const response = await api.get<ResearchTopic>(
      RESEARCH_TOPIC_ENDPOINTS.GET_BY_ID(id),
    );
    return normalizeResearchTopic(response.data);
  },

  create: async (
    payload: ResearchTopicCreatePayload,
  ): Promise<ResearchTopic> => {
    const response = await api.post<ResearchTopic>(
      RESEARCH_TOPIC_ENDPOINTS.CREATE,
      payload,
    );
    return normalizeResearchTopic(response.data);
  },

  update: async (
    id: number,
    payload: ResearchTopicUpdatePayload,
  ): Promise<ResearchTopic> => {
    const response = await api.put<ResearchTopic>(
      RESEARCH_TOPIC_ENDPOINTS.UPDATE(id),
      payload,
    );
    return normalizeResearchTopic(response.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(RESEARCH_TOPIC_ENDPOINTS.DELETE(id));
  },

  getMyTopics: async (): Promise<ResearchTopic[]> => {
    const response = await api.get<ResearchTopic[]>(
      API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_TOPIC.MY_TOPICS,
    );
    return normalizeResearchTopicList(response.data);
  },
};

// Defensive helper for any caller that needs to read the materials URL safely.
export const getResearchTopicMaterialsUrl = (
  t: ResearchTopic | null | undefined,
): string => t?.materialsUrl ?? '';

// Defensive helper for any caller that needs to read the topic status safely.
export const getResearchTopicStatus = (
  t: ResearchTopic | null | undefined,
): ResearchTopicStatus => normalizeResearchTopicStatus(t?.status ?? null);

export default researchTopicService;
