import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { SharedMaterialCreateRequest, SharedMaterialUpdateRequest } from '../types/researchWorkflowDtos';

export interface SharedMaterial extends SharedMaterialCreateRequest {
  sharedMaterialId: number;
  id?: number;
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
