// Read-only access to /api/GuidanceProject and /api/ResearchTopic from the
// Graduate Student side. Agent 1 (lecturer) owns the WRITE surface for both
// resources — see docs/local-only/research-workflow-contract.md §8.
//
// The GradStudent dashboard needs to surface:
//   - the student's active Guidance Project (linking them to a lecturer)
//   - the topic assigned to their joined group (if any)
//
// The BE has no `?studentId=` filter on GuidanceProject — the FE fetches all
// and filters client-side (documented gap §2). Topic is resolved via the
// group's `topicId`; the topic detail is fetched separately and cached.

import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import {
  normalizeGuidanceProjectStatus,
  normalizeResearchTopicStatus,
} from '../utils/researchStatus';
import type {
  GuidanceProject,
  GuidanceProjectStatus,
  ResearchTopic,
  ResearchTopicStatus,
} from '../types/research';

// ---------- Normalization ----------

const toGuidanceProject = (raw: unknown): GuidanceProject | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const idCandidate =
    (typeof r.id === 'number' && r.id) ||
    (typeof r.guidanceProjectId === 'number' && r.guidanceProjectId) ||
    0;
  const lecturerIdCandidate =
    (typeof r.lecturerId === 'number' && r.lecturerId) || 0;
  const studentIdCandidate =
    (typeof r.studentId === 'number' && r.studentId) || 0;
  if (idCandidate === 0) {
    return null;
  }
  const status: GuidanceProjectStatus = normalizeGuidanceProjectStatus(
    typeof r.status === 'string' ? r.status : null,
  );
  return {
    id: idCandidate,
    lecturerId: lecturerIdCandidate,
    studentId: studentIdCandidate,
    title: typeof r.title === 'string' ? r.title : `Project #${idCandidate}`,
    description:
      typeof r.description === 'string' ? r.description : undefined,
    status,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : undefined,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
    researchGroupId: typeof r.researchGroupId === 'number' ? r.researchGroupId : undefined,
    researchGroupName: typeof r.researchGroupName === 'string' ? r.researchGroupName : undefined,
  };
};

const toResearchTopic = (raw: unknown): ResearchTopic | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const idCandidate =
    (typeof r.id === 'number' && r.id) ||
    (typeof r.topicId === 'number' && r.topicId) ||
    0;
  if (idCandidate === 0) return null;
  const status: ResearchTopicStatus = normalizeResearchTopicStatus(
    typeof r.status === 'string' ? r.status : null,
  );
  return {
    id: idCandidate,
    title: typeof r.title === 'string' ? r.title : `Topic #${idCandidate}`,
    description:
      typeof r.description === 'string' ? r.description : undefined,
    status,
    materialsUrl:
      typeof r.materialsUrl === 'string' ? r.materialsUrl : undefined,
    assignedGroupId:
      typeof r.assignedGroupId === 'number'
        ? r.assignedGroupId
        : typeof r.topicId === 'number' && r.assignedGroupId === null
        ? null
        : undefined,
  };
};

const toGuidanceProjectArray = (raw: unknown): GuidanceProject[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => toGuidanceProject(item))
    .filter((item): item is GuidanceProject => item !== null);
};

const toResearchTopicArray = (raw: unknown): ResearchTopic[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => toResearchTopic(item))
    .filter((item): item is ResearchTopic => item !== null);
};

// ---------- Reads ----------

export const getAllGuidanceProjects = async (): Promise<GuidanceProject[]> => {
  const response = await api.get<unknown>(
    API_ENDPOINTS.RESEARCH_WORKFLOW.GUIDANCE_PROJECT.GET_ALL,
  );
  return toGuidanceProjectArray(response.data);
};

export const getGuidanceProjectById = async (
  id: number,
): Promise<GuidanceProject> => {
  const response = await api.get<unknown>(
    API_ENDPOINTS.RESEARCH_WORKFLOW.GUIDANCE_PROJECT.GET_BY_ID(id),
  );
  const normalized = toGuidanceProject(response.data);
  if (!normalized) {
    throw new Error(`GuidanceProject ${id}: malformed response from BE`);
  }
  return normalized;
};

export const getAllResearchTopics = async (): Promise<ResearchTopic[]> => {
  const response = await api.get<unknown>(
    API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_TOPIC.GET_ALL,
  );
  return toResearchTopicArray(response.data);
};

export const getResearchTopicById = async (
  id: number,
): Promise<ResearchTopic> => {
  const response = await api.get<unknown>(
    API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_TOPIC.GET_BY_ID(id),
  );
  const normalized = toResearchTopic(response.data);
  if (!normalized) {
    throw new Error(`ResearchTopic ${id}: malformed response from BE`);
  }
  return normalized;
};

// Resolve a student's active Guidance Project (prefer ONGOING over PROPOSED).
export const getActiveGuidanceProjectForStudent = async (
  studentId: number,
): Promise<GuidanceProject | null> => {
  const all = await getAllGuidanceProjects();
  const mine = all.filter((p) => p.studentId === studentId);
  const ongoing = mine.find((p) => p.status === 'ONGOING');
  if (ongoing) return ongoing;
  const proposed = mine.find((p) => p.status === 'PROPOSED');
  return proposed ?? null;
};

export const guidanceProjectService = {
  getAllGuidanceProjects,
  getGuidanceProjectById,
  getActiveGuidanceProjectForStudent,
};

export const researchTopicService = {
  getAllResearchTopics,
  getResearchTopicById,
};

// Re-export the domain types for callers that previously imported them from
// this service file (Agent-1 hooks: useGuidanceProjects, useResearchTopics).
// The canonical home is `src/types/research.ts` (lead-owned).
export type { GuidanceProject, ResearchTopic } from '../types/research';

export default guidanceProjectService;