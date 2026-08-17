import { useEffect, useState, useCallback } from 'react';
import {
  getAllGuidanceProjects,
  type GuidanceProject,
} from '../services/guidanceProject.service';

interface UseGuidanceProjectsResult {
  projects: GuidanceProject[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGuidanceProjects = (): UseGuidanceProjectsResult => {
  const [projects, setProjects] = useState<GuidanceProject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await getAllGuidanceProjects();
      setProjects(list);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to load guidance projects.'),
      );
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { projects, isLoading, error, refetch };
};

export default useGuidanceProjects;