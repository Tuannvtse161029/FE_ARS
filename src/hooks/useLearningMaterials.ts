import { useEffect, useState, useCallback } from 'react';
import {
  learningMaterialService,
  type LearningMaterial,
} from '../services/learningMaterial.service';
import { sharedMaterialService } from '../services/sharedMaterial.service';

interface UseLearningMaterialsResult {
  materials: LearningMaterial[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UseLearningMaterialsOptions {
  // When set, only materials whose `lecturerId` matches or materials
  // shared with this lecturer and ACCEPTED are returned.
  lecturerId?: number | null;
  includeShared?: boolean;
}

export const useLearningMaterials = (
  options: UseLearningMaterialsOptions = {},
): UseLearningMaterialsResult => {
  const { lecturerId, includeShared = true } = options;
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [list, shared] = await Promise.all([
        learningMaterialService.getAll(),
        lecturerId && includeShared
          ? sharedMaterialService.getAll().catch(() => [])
          : Promise.resolve([]),
      ]);

      let filtered: LearningMaterial[] = list;
      if (lecturerId) {
        // Collect IDs of materials shared with this colleague that were ACCEPTED or ACTIVE
        const acceptedShared = shared.filter((s) => {
          const status = (s.status ?? '').toUpperCase();
          return (
            s.sharedWithColleagueId === lecturerId &&
            (status === 'ACCEPTED' || status === 'ACTIVE')
          );
        });

        const acceptedIds = new Set(
          acceptedShared
            .map((s) => s.paperId ?? s.learningMaterialId)
            .filter((id): id is number => typeof id === 'number'),
        );

        filtered = list.filter(
          (m) =>
            m.lecturerId === lecturerId ||
            (typeof m.id === 'number' && acceptedIds.has(m.id)),
        );

        // In case the backend shared material record has title/fileUrl but the
        // underlying learning material was not present in the global list:
        for (const s of acceptedShared) {
          const sid = s.paperId ?? s.learningMaterialId;
          const exists =
            typeof sid === 'number' && filtered.some((m) => m.id === sid);
          if (
            !exists &&
            (s.learningMaterialTitle ||
              s.title ||
              s.learningMaterialUrl ||
              s.fileUrl)
          ) {
            filtered.push({
              id: typeof sid === 'number' ? sid : (s.sharedMaterialId ?? undefined),
              learningMaterialId:
                typeof sid === 'number' ? sid : undefined,
              lecturerId: s.lecturerId,
              title:
                s.learningMaterialTitle ||
                s.title ||
                `Material #${sid ?? '—'}`,
              fileUrl:
                s.learningMaterialUrl || s.fileUrl || s.url || null,
              description: s.description || null,
              createdAt: s.sharedAt || s.createdAt || undefined,
            });
          }
        }
      }

      setMaterials(filtered);
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error('Failed to load learning materials.'),
      );
      setMaterials([]);
    } finally {
      setIsLoading(false);
    }
  }, [lecturerId, includeShared]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { materials, isLoading, error, refetch };
};

export default useLearningMaterials;