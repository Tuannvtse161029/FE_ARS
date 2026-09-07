/**
 * Flat taxonomy hook for the research catalog filters.
 *
 * Loads the full MajorField → SubField hierarchy once and builds
 * O(1) lookup tables so the catalog can:
 *   1. Render Domain / Field / Subfield filter options from the API
 *      (instead of deriving them from whatever papers happen to be loaded).
 *   2. Match papers against the taxonomy without re-fetching.
 *
 * Usage:
 *   const { taxonomy, isLoading } = useFieldTaxonomy();
 */
import { useEffect, useState } from 'react';
import { fieldService } from '../services/field.service';
import type { MajorField, SubField } from '../types/domain';
import { isValidEntityId } from '../utils/entityId';

/** Normalized SubField record keyed by id. */
type SubFieldEntry = SubField & { majorFieldId: number; majorFieldName: string };

export interface FieldTaxonomy {
  /** All top-level domains (MajorFields), each with nested subFields populated. */
  majorFields: MajorField[];
  /**
   * O(1) lookup: subFieldId → { subField, majorFieldId, majorFieldName }.
   * Unavailable when the MajorField/SubField API hasn't returned yet.
   */
  subFieldLookup: Map<number, SubFieldEntry>;
  /** SubField ids that appear in the loaded paper set. */
  activeSubFieldIds: Set<number>;
  /** MajorField ids that have at least one paper. */
  activeMajorFieldIds: Set<number>;
}

export function useFieldTaxonomy(
  papersSubFieldIds: Array<{ subFieldId: number | null }>,
): {
  taxonomy: FieldTaxonomy;
  isLoading: boolean;
  error: Error | null;
} {
  const [majorFields, setMajorFields] = useState<MajorField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fieldService
      .getAllMajor()
      .then((list) => {
        if (cancelled) return;
        setMajorFields(list);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Failed to load taxonomy'));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Build O(1) lookup map and active-id sets from the loaded MajorFields.
  const subFieldLookup = new Map<number, SubFieldEntry>();
  for (const mf of majorFields) {
    if (!mf.subFields) continue;
    for (const sf of mf.subFields) {
      if (isValidEntityId(sf.id)) {
        subFieldLookup.set(sf.id, {
          ...sf,
          majorFieldId: sf.majorFieldId,
          majorFieldName: mf.name,
        });
      }
    }
  }

  // Which subFieldIds / majorFieldIds actually have papers in the loaded set?
  const activeSubFieldIds = new Set<number>();
  const activeMajorFieldIds = new Set<number>();
  for (const { subFieldId } of papersSubFieldIds) {
    if (isValidEntityId(subFieldId)) {
      activeSubFieldIds.add(subFieldId);
      const entry = subFieldLookup.get(subFieldId);
      if (entry) {
        activeMajorFieldIds.add(entry.majorFieldId);
      }
    }
  }

  return {
    taxonomy: { majorFields, subFieldLookup, activeSubFieldIds, activeMajorFieldIds },
    isLoading,
    error,
  };
}
