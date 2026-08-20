import { useEffect, useState } from 'react';
import { fieldService } from '../services/field.service';
import type { MajorField, SubField } from '../types/domain';
import { isValidEntityId } from '../utils/entityId';

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

/**
 * Fetches subfields for a given major field.
 * Only triggers a fetch when `selectedMajorFieldId` is a valid positive integer.
 * Returns empty subfields and clears errors when no valid major field is selected.
 */
export function useSubFields(selectedMajorFieldId?: number | null): UseSubFieldsResult {
  const [subFields, setSubFields] = useState<SubField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = async () => {
    // Guard: do NOT call SubField API without a valid majorFieldId.
    // This prevents HTTP 400 "majorFieldId required" and NaN in request URLs.
    if (!isValidEntityId(selectedMajorFieldId)) {
      setSubFields([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const list = await fieldService.getAllSub(selectedMajorFieldId);
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
  }, [selectedMajorFieldId]);

  return { subFields, isLoading, error, refetch };
}
