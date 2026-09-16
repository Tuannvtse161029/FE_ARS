/**
 * useTopicLearningMaterials — React hook for the topic-level Learning
 * Material attachments surfaced via
 * `GET /api/ResearchTopic/{topicId}/learning-materials`.
 *
 * Why a dedicated hook exists:
 * ----------------------------------------------------------------
 * The Lecturer `LearningMaterialModal` writes topic attachments to the
 * BE under `ResearchTopic/{topicId}/learning-materials`. Both
 * `useLearningMaterials` (the lecturer library hook) and
 * `derivePhaseMaterialsForGroup` (the per-phase helper) read from
 * DIFFERENT endpoints — neither of them returns topic-level
 * attachments, so without this hook the materials a lecturer just
 * attached to the Research Topic were silently dropped from the
 * research-group detail page and the graduate-student workspace.
 *
 * Usage:
 *
 *   const { materials, isLoading, error, refetch } = useTopicLearningMaterials(topicId);
 *
 * - `topicId`: the Research Topic primary key. Pass `null` to disable
 *   fetching (the hook returns an empty array and `isLoading=false`).
 * - `materials` are normalised to `LearningMaterial`-compatible shape so
 *   callers that already render `LearningMaterial[]` do not need any
 *   downstream changes.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  topicLearningMaterialService,
} from '../services/researchTopic.service';
import type {
  TopicLearningMaterialResponse,
} from '../types/researchWorkflowDtos';
import type { LearningMaterial } from '../services/learningMaterial.service';

export interface UseTopicLearningMaterialsResult {
  materials: LearningMaterial[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const toLearningMaterial = (
  m: TopicLearningMaterialResponse,
): LearningMaterial => {
  // BE columns disagree across versions: some payloads only set `id`,
  // some only set `learningMaterialId`, some set both. Pick whichever
  // is populated and fall back to `undefined` so callers can read `.id`
  // safely without runtime checks.
  const resolvedId =
    typeof m.learningMaterialId === 'number'
      ? m.learningMaterialId
      : typeof (m as { id?: number }).id === 'number'
        ? (m as { id?: number }).id
        : undefined;
  return {
    id: resolvedId,
    learningMaterialId: resolvedId,
    lecturerId: m.lecturerId ?? null,
    title: m.title ?? null,
    fileUrl: m.fileUrl ?? null,
    description: m.description ?? null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
};

export const useTopicLearningMaterials = (
  topicId: number | null | undefined,
): UseTopicLearningMaterialsResult => {
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (topicId === null || topicId === undefined || Number.isNaN(topicId)) {
      setMaterials([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const rows = await topicLearningMaterialService.getByTopicId(topicId);
      setMaterials(rows.map(toLearningMaterial));
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error('Failed to load topic learning materials.'),
      );
      setMaterials([]);
    } finally {
      setIsLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { materials, isLoading, error, refetch };
};

export default useTopicLearningMaterials;
