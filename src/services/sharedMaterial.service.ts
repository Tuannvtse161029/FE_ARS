import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { SharedMaterialCreateRequest, SharedMaterialUpdateRequest } from '../types/researchWorkflowDtos';

export interface ColleagueUser {
  id: number;
  fullName: string;
  email: string;
  roleName?: string | null;
  roles?: string[];
  avatarUrl?: string | null;
  isEmailVerified?: boolean;
  isActive?: boolean;
}

export interface SharedMaterial extends SharedMaterialCreateRequest {
  sharedMaterialId: number;
  id?: number;
  direction?: 'outbound' | 'inbound' | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  learningMaterialId?: number | null;
  learningMaterialTitle?: string | null;
  title?: string | null;
  learningMaterialUrl?: string | null;
  fileUrl?: string | null;
  url?: string | null;
  description?: string | null;
  lecturerName?: string | null;
  sharedWithName?: string | null;
  expiresAt?: string | null;
  respondedAt?: string | null;
  effectiveStatus?: string | null;
  canRevoke?: boolean;
  canRespond?: boolean;
  daysRemaining?: number;
}

const normalize = (raw: any): SharedMaterial => {
  const paperId = raw.paperId ?? raw.learningMaterialId ?? null;
  const learningMaterialId = raw.learningMaterialId ?? raw.paperId ?? null;
  const title = raw.learningMaterialTitle ?? raw.title ?? null;
  const learningMaterialTitle = raw.learningMaterialTitle ?? raw.title ?? null;
  const fileUrl = raw.learningMaterialUrl ?? raw.fileUrl ?? raw.url ?? null;
  const learningMaterialUrl = raw.learningMaterialUrl ?? raw.fileUrl ?? raw.url ?? null;

  return {
    ...raw,
    sharedMaterialId: raw.sharedMaterialId ?? raw.id ?? 0,
    id: raw.sharedMaterialId ?? raw.id,
    paperId,
    learningMaterialId,
    title,
    learningMaterialTitle,
    fileUrl,
    learningMaterialUrl,
    url: fileUrl,
    lecturerName: raw.lecturerName ?? null,
    sharedWithName: raw.sharedWithName ?? null,
    effectiveStatus: raw.effectiveStatus ?? null,
    daysRemaining: typeof raw.daysRemaining === 'number' ? raw.daysRemaining : undefined,
  };
};
const list = (data: unknown): SharedMaterial[] => {
  if (Array.isArray(data)) return data.map((item) => normalize(item as SharedMaterial));
  if (data && typeof data === 'object') {
    const value = data as { items?: unknown; data?: unknown };
    if (Array.isArray(value.items)) return list(value.items);
    if (Array.isArray(value.data)) return list(value.data);
  }
  return [];
};

export const sharedMaterialService = {
  async getAll(): Promise<SharedMaterial[]> {
    const response = await api.get(API_ENDPOINTS.RESEARCH_WORKFLOW.SHARED_MATERIAL.GET_ALL);
    return list(response.data);
  },
  async getColleagues(): Promise<ColleagueUser[]> {
    const response = await api.get(API_ENDPOINTS.RESEARCH_WORKFLOW.SHARED_MATERIAL.COLLEAGUES);
    const data = response.data;
    if (Array.isArray(data)) return data as ColleagueUser[];
    if (data && typeof data === 'object') {
      const value = data as { items?: ColleagueUser[]; data?: ColleagueUser[] };
      if (Array.isArray(value.items)) return value.items;
      if (Array.isArray(value.data)) return value.data;
    }
    return [];
  },
  async create(payload: SharedMaterialCreateRequest): Promise<SharedMaterial> {
    const response = await api.post(API_ENDPOINTS.RESEARCH_WORKFLOW.SHARED_MATERIAL.CREATE, payload);
    return normalize(response.data as SharedMaterial);
  },
  async update(id: number, payload: SharedMaterialUpdateRequest): Promise<SharedMaterial> {
    const response = await api.put(API_ENDPOINTS.RESEARCH_WORKFLOW.SHARED_MATERIAL.UPDATE(id), payload);
    return normalize(response.data as SharedMaterial);
  },
  async delete(id: number): Promise<void> {
    await api.delete(API_ENDPOINTS.RESEARCH_WORKFLOW.SHARED_MATERIAL.DELETE(id));
  },
};

export default sharedMaterialService;
