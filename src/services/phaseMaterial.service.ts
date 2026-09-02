// PhaseMaterial service.
//
// Manages the assignment of LearningMaterials to phases of a topic-group.
// The BE stores these as a PhaseMaterial junction table.
//
// Usage flow:
//   1. Lecturer opens ConfigureMilestones, selects a group.
//   2. Each phase editor shows a "Material" dropdown (sorted newest-first).
//   3. On save, the FE calls phaseMaterialService.assignForPhase(...)
//      to persist the link (or delete it if "None" is selected).
//   4. LearningMaterials.tsx calls getMaterialUsages(id) before showing
//      the delete confirmation — if all usages are expired (phase deadline
//      passed) the warning is suppressed.
//
// No mock / fallback data. All data is live from the API.

import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single PhaseMaterial assignment row. */
export interface PhaseMaterial {
  id?: number;
  phaseMaterialId?: number;
  learningMaterialId?: number;
  topicId?: number;
  phaseNumber?: number;
  researchGroupId?: number;
  createdAt?: string;
}

/**
 * Describes where a LearningMaterial is currently assigned.
 * Used to power the "Used In" column and the smart delete warning.
 */
export interface MaterialUsage {
  phaseMaterialId: number;
  topicId: number;
  topicTitle: string;
  researchGroupId: number;
  researchGroupName: string;
  phaseNumber: number;
  phaseTitle: string;
  phaseDeadlineAt: string;
  /** True when the phase deadline has passed — the material can be safely deleted. */
  isExpired: boolean;
}

// ─── Service ────────────────────────────────────────────────────────────────

const ENDPOINTS = {
  ASSIGN: API_ENDPOINTS.RESEARCH_WORKFLOW.PHASE_MATERIAL.ASSIGN,
  DELETE: API_ENDPOINTS.RESEARCH_WORKFLOW.PHASE_MATERIAL.DELETE,
  GET_BY_PHASE: API_ENDPOINTS.RESEARCH_WORKFLOW.PHASE_MATERIAL.GET_BY_PHASE,
} as const;

const normalizePhaseMaterial = (raw: PhaseMaterial): PhaseMaterial => ({
  ...raw,
  phaseMaterialId: raw.phaseMaterialId ?? raw.id ?? undefined,
});

export const phaseMaterialService = {
  /**
   * Fetch all PhaseMaterial assignments for a given topic+group.
   * Returns a flat list; the caller groups by phaseNumber.
   */
  getByTopicGroup: async (
    topicId: number,
    researchGroupId: number,
  ): Promise<PhaseMaterial[]> => {
    const response = await api.get<PhaseMaterial[]>(ENDPOINTS.GET_BY_PHASE, {
      params: { topicId, researchGroupId },
    });
    const list = Array.isArray(response.data) ? response.data : [];
    return list.map(normalizePhaseMaterial);
  },

  /**
   * Assign (or update) the material for a specific phase.
   * Pass learningMaterialId=null to unassign.
   */
  assignForPhase: async (payload: {
    topicId: number;
    researchGroupId: number;
    phaseNumber: number;
    learningMaterialId: number | null;
  }): Promise<PhaseMaterial> => {
    const response = await api.post<PhaseMaterial>(
      ENDPOINTS.ASSIGN,
      payload,
    );
    return normalizePhaseMaterial(response.data);
  },

  /**
   * Remove a PhaseMaterial assignment by its id.
   */
  unassign: async (phaseMaterialId: number): Promise<void> => {
    await api.delete(ENDPOINTS.DELETE(phaseMaterialId));
  },
};

// ─── Usage helper (used by LearningMaterials page) ────────────────────────────

const LM_ENDPOINTS = {
  GET_USAGES: API_ENDPOINTS.RESEARCH_WORKFLOW.LEARNING_MATERIAL.GET_USAGES,
} as const;

export const learningMaterialUsageService = {
  /**
   * Returns all places where a material is currently assigned to a phase.
   * Used by LearningMaterials.tsx to show the "Used In" column and
   * to determine whether the delete warning should appear.
   *
   * The BE returns `isExpired: true` for phases whose deadline has passed,
   * so the FE can suppress the warning when ALL usages are expired.
   */
  getUsages: async (materialId: number): Promise<MaterialUsage[]> => {
    const response = await api.get<MaterialUsage[]>(
      LM_ENDPOINTS.GET_USAGES(materialId),
    );
    const list = Array.isArray(response.data) ? response.data : [];
    // Normalise isExpired client-side as a fallback if BE doesn't set it.
    return list.map((item) => ({
      ...item,
      isExpired:
        item.isExpired ??
        (item.phaseDeadlineAt
          ? new Date(item.phaseDeadlineAt) < new Date()
          : false),
    }));
  },
};

export default phaseMaterialService;
