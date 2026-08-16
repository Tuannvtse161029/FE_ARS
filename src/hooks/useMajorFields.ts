import { useEffect, useState } from 'react';
import { fieldService } from '../services/field.service';
import type { MajorField, SubField } from '../types/domain';

interface UseMajorFieldsResult {
  fields: MajorField[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useMajorFields(): UseMajorFieldsResult {
  const [fields, setFields] = useState<MajorField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await fieldService.getAllMajor();
      setFields(list);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load major fields'));
      setFields([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
  }, []);

  return { fields, isLoading, error, refetch };
}

interface UseSubFieldsResult {
  subFields: SubField[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useSubFields(majorFieldId?: number): UseSubFieldsResult {
  const [subFields, setSubFields] = useState<SubField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await fieldService.getAllSub(majorFieldId);
      setSubFields(list);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load sub fields'));
      setSubFields([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majorFieldId]);

  return { subFields, isLoading, error, refetch };
}
