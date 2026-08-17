import api from './axios';

// TODO(lead): the canonical endpoint constants live in `src/utils/constants.ts`
// under `API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_TOPIC.*` per the contract.
// Until the lead adds them, we hard-code the Swagger paths here so the service
// is fully self-contained and does not import a non-existent key.
const RESEARCH_TOPIC_ENDPOINTS = {
  GET_ALL: '/api/ResearchTopic',
  GET_BY_ID: (id: number) => `/api/ResearchTopic/${id}`,
  CREATE: '/api/ResearchTopic',
  UPDATE: (id: number) => `/api/ResearchTopic/${id}`,
  DELETE: (id: number) => `/api/ResearchTopic/${id}`,
} as const;

// Status enums per `docs/local-only/research-workflow-contract.md` §3.
export type ResearchTopicStatus = 'OPEN' | 'ASSIGNED' | 'COMPLETED' | 'CLOSED';

export const RESEARCH_TOPIC_STATUSES: readonly ResearchTopicStatus[] = [
  'OPEN',
  'ASSIGNED',
  'COMPLETED',
  'CLOSED',
] as const;

const RESEARCH_TOPIC_TRANSITIONS: Record<
  ResearchTopicStatus,
  readonly ResearchTopicStatus[]
> = {
  OPEN: ['ASSIGNED', 'CLOSED'],
  ASSIGNED: ['COMPLETED', 'CLOSED'],
  COMPLETED: [],
  CLOSED: [],
};

export const canTransitionResearchTopic = (
  from: ResearchTopicStatus,
  to: ResearchTopicStatus,
): boolean => RESEARCH_TOPIC_TRANSITIONS[from].includes(to);

export interface ResearchTopic {
  id?: number;
  topicId?: number;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  materialsUrl?: string | null;
  // Optional joined field the BE may surface once the M:N resolver lands.
  assignedGroupIds?: number[] | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResearchTopicCreateRequest {
  title?: string | null;
  description?: string | null;
  status?: ResearchTopicStatus | string | null;
  materialsUrl?: string | null;
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
    payload: ResearchTopicCreateRequest,
  ): Promise<ResearchTopic> => {
    const response = await api.post<ResearchTopic>(
      RESEARCH_TOPIC_ENDPOINTS.CREATE,
      payload,
    );
    return normalizeResearchTopic(response.data);
  },

  update: async (
    id: number,
    payload: Partial<ResearchTopicCreateRequest>,
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
};

// Defensive helper for any caller that needs to read the materials URL safely.
export const getResearchTopicMaterialsUrl = (
  t: ResearchTopic | null | undefined,
): string => t?.materialsUrl ?? '';

export default researchTopicService;