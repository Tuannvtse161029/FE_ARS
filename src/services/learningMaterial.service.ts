import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  LearningMaterialCreateRequest,
  LearningMaterialUpdateRequest,
} from '../types/researchWorkflowDtos';

const LEARNING_MATERIAL_ENDPOINTS = {
  GET_ALL: API_ENDPOINTS.RESEARCH_WORKFLOW.LEARNING_MATERIAL.GET_ALL,
  GET_BY_ID: API_ENDPOINTS.RESEARCH_WORKFLOW.LEARNING_MATERIAL.GET_BY_ID,
  CREATE: API_ENDPOINTS.RESEARCH_WORKFLOW.LEARNING_MATERIAL.CREATE,
  UPDATE: API_ENDPOINTS.RESEARCH_WORKFLOW.LEARNING_MATERIAL.UPDATE,
  DELETE: API_ENDPOINTS.RESEARCH_WORKFLOW.LEARNING_MATERIAL.DELETE,
} as const;

// BE response shape — every property is optional/nullable per the Swagger
// LearningMaterial schema.
export interface LearningMaterial {
  id?: number;
  learningMaterialId?: number;
  lecturerId?: number | null;
  title?: string | null;
  fileUrl?: string | null;
  description?: string | null;
  subFieldId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

const normalizeLearningMaterial = (raw: LearningMaterial): LearningMaterial => ({
  ...raw,
  id: raw.learningMaterialId ?? raw.id ?? undefined,
});

const normalizeLearningMaterialList = (data: unknown): LearningMaterial[] => {
  const raw = Array.isArray(data) ? (data as LearningMaterial[]) : [];
  return raw.map(normalizeLearningMaterial);
};

export const learningMaterialService = {
  getAll: async (): Promise<LearningMaterial[]> => {
    const response = await api.get<LearningMaterial[]>(
      LEARNING_MATERIAL_ENDPOINTS.GET_ALL,
    );
    return normalizeLearningMaterialList(response.data);
  },

  getById: async (id: number): Promise<LearningMaterial> => {
    const response = await api.get<LearningMaterial>(
      LEARNING_MATERIAL_ENDPOINTS.GET_BY_ID(id),
    );
    return normalizeLearningMaterial(response.data);
  },

  // The standard CRUD path. For the Lecturer console "Add material" flow, the
  // FE uploads the binary PDF via `useFirebaseUpload(folderPath)` first, then
  // posts `{ title, fileUrl, ... }` here. The typed DTO accepts a `fileUrl`
  // string — caller is responsible for producing it (Firebase URL).
  create: async (
    payload: LearningMaterialCreateRequest,
  ): Promise<LearningMaterial> => {
    const response = await api.post<LearningMaterial>(
      LEARNING_MATERIAL_ENDPOINTS.CREATE,
      payload,
    );
    return normalizeLearningMaterial(response.data);
  },

  update: async (
    id: number,
    payload: LearningMaterialUpdateRequest,
  ): Promise<LearningMaterial> => {
    const response = await api.put<LearningMaterial>(
      LEARNING_MATERIAL_ENDPOINTS.UPDATE(id),
      payload,
    );
    return normalizeLearningMaterial(response.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(LEARNING_MATERIAL_ENDPOINTS.DELETE(id));
  },
};

// Default Firebase folder for lecturer-uploaded learning materials. Reusing
// the existing `useFirebaseUpload` hook means we get validation (PDF-only,
// ≤10MB), sanitised filenames and progress tracking for free. Material PDFs
// live under `learning-materials/{lecturerId}/...` so an admin can audit a
// single lecturer's contributions at a glance.
export const defaultLearningMaterialFolderPath = (
  lecturerId?: number | null,
): string => {
  const safeId = lecturerId ?? 'unknown';
  return `learning-materials/${safeId}/`;
};

export default learningMaterialService;
