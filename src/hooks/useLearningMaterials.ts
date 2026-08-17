import { useEffect, useState, useCallback } from 'react';
import {
  learningMaterialService,
  type LearningMaterial,
} from '../services/learningMaterial.service';

interface UseLearningMaterialsResult {
  materials: LearningMaterial[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UseLearningMaterialsOptions {
  // When set, only materials whose `lecturerId` matches are returned.
  // BE has no server-side filter, so we do it client-side.
  lecturerId?: number | null;
}

export const useLearningMaterials = (
  options: UseLearningMaterialsOptions = {},
): UseLearningMaterialsResult => {
  const { lecturerId } = options;
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await learningMaterialService.getAll();
      const filtered = lecturerId
        ? list.filter((m) => m.lecturerId === lecturerId)
        : list;
      setMaterials(filtered);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to load learning materials.'),
      );
      setMaterials([]);
    } finally {
      setIsLoading(false);
    }
  }, [lecturerId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { materials, isLoading, error, refetch };
};

export default useLearningMaterials;