import api from './axios';

// TODO(lead): the canonical endpoint constants live in `src/utils/constants.ts`
// under `API_ENDPOINTS.RESEARCH_WORKFLOW.LEARNING_MATERIAL.*` per the contract.
const LEARNING_MATERIAL_ENDPOINTS = {
  GET_ALL: '/api/LearningMaterial',
  GET_BY_ID: (id: number) => `/api/LearningMaterial/${id}`,
  CREATE: '/api/LearningMaterial',
  UPDATE: (id: number) => `/api/LearningMaterial/${id}`,
  DELETE: (id: number) => `/api/LearningMaterial/${id}`,
} as const;

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

export interface LearningMaterialCreateRequest {
  lecturerId?: number | null;
  title?: string | null;
  fileUrl?: string | null;
  description?: string | null;
  subFieldId?: number | null;
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
    payload: Partial<LearningMaterialCreateRequest>,
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