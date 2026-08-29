import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

/**
 * SubField grading rubric — derived from the live Swagger contract:
 * https://arsplatform.onrender.com/swagger/index.html
 *
 * The Swagger doc exposes GradingRubricCriterionRequest as the CRUD body
 * for SubField.gradingRubric (see swagger.json → GradingRubricCriterionRequest
 * and SubFieldCreateRequest.gradingRubric). The subfield *response* shape is
 * declared as `SubField` without an embedded schema, so we model the rubric
 * criteria here verbatim from the GradingRubricCriterionRequest contract.
 *
 * Required: `code`, `title`. Optional: `description`, `maxScore` (1..10),
 * `order` (1..int32.max), `standardReferences` (string[]).
 */
export interface GradingRubricCriterion {
  code: string;
  title: string;
  description?: string | null;
  maxScore?: number | null;
  order?: number | null;
  standardReferences?: string[] | null;
}

/**
 * SubField entity — minimal projection of the BE response shape. The Swagger
 * doc only mandates `id`/`subFieldId` + name on the entity; gradingRubric is
 * the array of criteria defined for that subfield.
 */
export interface SubField {
  id: number;
  subFieldId?: number;
  name?: string;
  description?: string | null;
  majorFieldId?: number | null;
  gradingRubric?: GradingRubricCriterion[] | null;
}

interface SubFieldApiResponse {
  id?: unknown;
  subFieldId?: unknown;
  name?: unknown;
  description?: unknown;
  majorFieldId?: unknown;
  gradingRubric?: unknown;
}

/**
 * Normalize a single criterion payload from the BE. Mirrors the wire contract
 * in GradingRubricCriterionRequest — null/undefined optionals collapse to
 * undefined so the consumer can use `.maxScore`/`?.order` safely.
 */
function normalizeCriterion(raw: unknown): GradingRubricCriterion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const code = typeof r.code === 'string' ? r.code : null;
  const title = typeof r.title === 'string' ? r.title : null;
  if (!code || !title) return null;
  const maxScore =
    typeof r.maxScore === 'number' && Number.isFinite(r.maxScore) ? r.maxScore : null;
  const order =
    typeof r.order === 'number' && Number.isFinite(r.order) ? r.order : null;
  const standardReferences = Array.isArray(r.standardReferences)
    ? (r.standardReferences.filter((s) => typeof s === 'string') as string[])
    : null;
  return {
    code,
    title,
    description: typeof r.description === 'string' ? r.description : null,
    maxScore,
    order,
    standardReferences,
  };
}

function normalizeSubField(value: SubFieldApiResponse): SubField | null {
  const idRaw = value.id ?? value.subFieldId;
  const numericId = typeof idRaw === 'number' ? idRaw : Number(idRaw);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;

  const rubricRaw = Array.isArray(value.gradingRubric) ? value.gradingRubric : null;
  const gradingRubric = rubricRaw
    ? (rubricRaw
        .map(normalizeCriterion)
        .filter((c): c is GradingRubricCriterion => c !== null) ?? null)
    : null;

  const majorFieldId =
    typeof value.majorFieldId === 'number' && Number.isFinite(value.majorFieldId)
      ? value.majorFieldId
      : null;

  return {
    id: numericId,
    subFieldId: numericId,
    name: typeof value.name === 'string' ? value.name : undefined,
    description: typeof value.description === 'string' ? value.description : null,
    majorFieldId,
    gradingRubric,
  };
}

export const subFieldService = {
  /**
   * Fetch a single SubField by its numeric id. Used by the Reviewer
   * Reviewer publication flow to read the paper's subField and its gradingRubric.
   */
  getById: async (id: number): Promise<SubField | null> => {
    if (!Number.isFinite(id) || id <= 0) return null;
    const response = await api.get<unknown>(
      API_ENDPOINTS.SUB_FIELD.GET_BY_ID(id)
    );
    const data = response.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return normalizeSubField(data as SubFieldApiResponse);
  },

  /**
   * Normalize an already-fetched SubField payload (e.g. embedded in a Paper
   * response). Returns null when the payload does not carry a valid id.
   */
  normalize: normalizeSubField,
};

export default subFieldService;
