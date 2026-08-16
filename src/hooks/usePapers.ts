import { useEffect, useState } from 'react';
import { paperService, Paper } from '../services/paper.service';
import type { PagedResult } from '../types/api';

interface UsePapersResult {
  papers: Paper[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePapers(params?: { pageNumber?: number; pageSize?: number; status?: string }): UsePapersResult {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPapers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result: PagedResult<Paper> = await paperService.getAll({
        pageNumber: params?.pageNumber ?? 1,
        pageSize: params?.pageSize ?? 50,
        status: params?.status,
      });
      setPapers(result.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load papers'));
      setPapers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchPapers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.pageNumber, params?.pageSize, params?.status]);

  return { papers, isLoading, error, refetch: fetchPapers };
}
