import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  MajorField,
  SubField,
  MajorFieldCreateRequest,
  SubFieldCreateRequest,
  GradingRubricCriterion,
  SubFieldWithRubric,
  PatchRubricRequest,
} from '../types/domain';
import { isValidEntityId } from '../utils/entityId';

/**
 * Error thrown when an invalid majorFieldId is passed to a service method.
 */
export class InvalidMajorFieldIdError extends Error {
  constructor(value: unknown) {
    super(`Invalid majorFieldId: ${String(value)}. Must be a positive integer.`);
    this.name = 'InvalidMajorFieldIdError';
  }
}

interface MajorFieldApiResponse {
  id?: unknown;
  majorFieldId?: unknown;
  name?: unknown;
  description?: unknown;
  subFields?: SubFieldApiResponse[];
}

function normalizeMajorField(value: MajorFieldApiResponse): MajorField | null {
  const id = value.id ?? value.majorFieldId;
  const numericId = typeof id === 'number' ? id : Number(id);

  if (!isValidEntityId(numericId) || typeof value.name !== 'string') {
    return null;
  }

  return {
    id: numericId,
    name: value.name,
    description: typeof value.description === 'string' ? value.description : null,
    ...(Array.isArray(value.subFields)
      ? {
          subFields: value.subFields
            .map(normalizeSubField)
            .filter((field): field is SubField => field !== null),
        }
      : {}),
  };
}

interface SubFieldApiResponse {
  id?: unknown;
  subFieldId?: unknown;
  majorFieldId?: unknown;
  name?: unknown;
  description?: unknown;
}

function normalizeSubField(value: SubFieldApiResponse): SubField | null {
  const id = value.id ?? value.subFieldId;
  const numericId = typeof id === 'number' ? id : Number(id);
  const majorFieldId = typeof value.majorFieldId === 'number'
    ? value.majorFieldId
    : Number(value.majorFieldId);

  if (!isValidEntityId(numericId) || !isValidEntityId(majorFieldId) || typeof value.name !== 'string') {
    return null;
  }

  return {
    id: numericId,
    majorFieldId,
    name: value.name,
    description: typeof value.description === 'string' ? value.description : null,
  };
}

export const fieldService = {
  getAllMajor: async (): Promise<MajorField[]> => {
    const response = await api.get<MajorFieldApiResponse[]>(API_ENDPOINTS.MAJOR_FIELD.GET_ALL);
    if (!Array.isArray(response.data)) return [];

    return response.data
      .map(normalizeMajorField)
      .filter((field): field is MajorField => field !== null);
  },

  createMajor: async (data: MajorFieldCreateRequest): Promise<MajorField> => {
    const response = await api.post<MajorField>(API_ENDPOINTS.MAJOR_FIELD.CREATE, data);
    return response.data;
  },

  /**
   * Fetches all subfields for a given major field.
   * @param majorFieldId - Must be a valid positive integer.
   * @throws InvalidMajorFieldIdError if majorFieldId is not a valid positive integer.
   */
  getAllSub: async (majorFieldId?: number): Promise<SubField[]> => {
    // Guard: SubField API requires a valid positive integer majorFieldId.
    // Rejecting undefined / NaN / 0 / negative numbers prevents HTTP 400.
    if (!isValidEntityId(majorFieldId)) {
      throw new InvalidMajorFieldIdError(majorFieldId);
    }
    const response = await api.get<SubFieldApiResponse[]>(API_ENDPOINTS.SUB_FIELD.GET_ALL, {
      params: { majorFieldId },
    });
    if (!Array.isArray(response.data)) return [];

    return response.data
      .map(normalizeSubField)
      .filter((field): field is SubField => field !== null);
  },

  createSub: async (data: SubFieldCreateRequest): Promise<SubField> => {
    const response = await api.post<SubField>(API_ENDPOINTS.SUB_FIELD.CREATE, data);
    return response.data;
  },

  getSubFieldById: async (id: number): Promise<any> => {
    const response = await api.get(API_ENDPOINTS.SUB_FIELD.GET_BY_ID(id));
    return response.data;
  },

  /**
   * Fetches all SubFields including their gradingRubric array.
   * Used by the Admin GradingRubric management page.
   */
  listSubFieldsWithRubric: async (): Promise<SubFieldWithRubric[]> => {
    const response = await api.get<unknown[]>(API_ENDPOINTS.SUB_FIELD.GET_ALL);
    if (!Array.isArray(response.data)) return [];
    return response.data.map((raw): SubFieldWithRubric => {
      const r = raw as Record<string, unknown>;
      const id = (r['subFieldId'] ?? r['id'] ?? 0) as number;
      const rubricRaw = Array.isArray(r['gradingRubric']) ? r['gradingRubric'] : [];
      const rubric: GradingRubricCriterion[] = rubricRaw.map((item) => {
        const c = item as Record<string, unknown>;
        return {
          code: String(c['code'] ?? ''),
          title: String(c['title'] ?? ''),
          description: String(c['description'] ?? ''),
          maxScore: typeof c['maxScore'] === 'number' ? c['maxScore'] : Number(c['maxScore'] ?? 0),
          order: typeof c['order'] === 'number' ? c['order'] : Number(c['order'] ?? 0),
          standardReferences: Array.isArray(c['standardReferences'])
            ? (c['standardReferences'] as unknown[]).map(String)
            : [],
        };
      });
      return {
        subFieldId: typeof id === 'number' ? id : Number(id),
        name: String(r['name'] ?? ''),
        majorFieldName: String(r['majorFieldName'] ?? ''),
        description: typeof r['description'] === 'string' ? r['description'] : null,
        gradingRubric: rubric,
      };
    });
  },

  /**
   * Replaces the GradingRubric for a given SubField.
   * Uses PATCH /api/SubField/{id}/rubric — does NOT touch name, majorFieldId, or description.
   */
  patchRubric: async (id: number, rubric: GradingRubricCriterion[]): Promise<void> => {
    const body: PatchRubricRequest = { gradingRubric: rubric };
    await api.patch(API_ENDPOINTS.SUB_FIELD.PATCH_RUBRIC(id), body);
  },
};

