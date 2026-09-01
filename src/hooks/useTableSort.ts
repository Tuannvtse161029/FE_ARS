// useTableSort — generic sort state + comparator for any table.
//
// Design:
//   - The hook owns a single piece of state: `{ column, direction }`.
//   - `direction` cycles: null → 'asc' → 'desc' → null (back to natural order).
//     Null means "no explicit sort" — the caller is responsible for applying
//     its default order (typically newest-first by createdAt) when `direction`
//     is null. This keeps the "newest by default" promise of the design
//     system intact while still letting users re-sort by any visible column.
//   - `sortedItemsBy(items, getValue)` takes the original list and returns a
//     NEW sorted array without mutating the input. The comparator looks up
//     the value via `getValue(item)` so the caller controls how each column
//     extracts its comparable value (string, number, ISO date, etc.).
//   - `cycleSort(column)` is the single click handler to wire to the header.

import { useCallback, useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortState<K extends string> {
  column: K | null;
  direction: SortDirection;
}

export interface UseTableSortResult<T, K extends string> {
  sortState: SortState<K>;
  /** Returns a new array sorted by the current sortState, using `getValue`. */
  sortedItemsBy: <V>(
    items: T[],
    getValue: (item: T) => V | null | undefined,
  ) => T[];
  /** Click handler — pass the column id to cycle asc → desc → null. */
  cycleSort: (column: K) => void;
  /** Set an explicit sort (e.g. from a column header dropdown). */
  setSort: (column: K, direction: SortDirection) => void;
  /** Clear sort so callers can fall back to their default order. */
  clearSort: () => void;
  /**
   * Render-prop for sortable column headers — returns the aria-sort value
   * for the active column, or undefined for inactive columns.
   */
  ariaSortFor: (column: K) => 'ascending' | 'descending' | 'none' | undefined;
}

export function useTableSort<T, K extends string>(
  defaultColumn?: K,
  defaultDirection: SortDirection = 'desc',
): UseTableSortResult<T, K> {
  const [sortState, setSortState] = useState<SortState<K>>(() => ({
    column: defaultColumn ?? null,
    direction: defaultColumn ? defaultDirection : 'asc',
  }));

  const sortedItemsBy = useCallback(
    <V,>(items: T[], getValue: (item: T) => V | null | undefined): T[] => {
      const { column, direction } = sortState;
      if (!column) return items;
      const factor = direction === 'asc' ? 1 : -1;
      const copy = items.slice();
      copy.sort((a, b) => {
        const va = getValue(a);
        const vb = getValue(b);
        // Nulls / undefined always sort last regardless of direction.
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === 'number' && typeof vb === 'number') {
          return (va - vb) * factor;
        }
        if (typeof va === 'string' && typeof vb === 'string') {
          // Try ISO date compare first — most createdAt/updatedAt columns
          // are ISO strings, so this lets date strings sort correctly
          // without forcing every caller to convert them.
          const da = new Date(va).getTime();
          const db = new Date(vb).getTime();
          if (
            !Number.isNaN(da) &&
            !Number.isNaN(db) &&
            // Only use date compare if both strings parse to distinct dates.
            da !== db &&
            va.length >= 10 &&
            vb.length >= 10
          ) {
            return (da - db) * factor;
          }
          return va.localeCompare(vb) * factor;
        }
        // Mixed types — fallback to string compare.
        return String(va).localeCompare(String(vb)) * factor;
      });
      return copy;
    },
    [sortState],
  );

  const cycleSort = useCallback((column: K) => {
    setSortState((prev) => {
      if (prev.column !== column) {
        // First click on a column always starts ascending.
        return { column, direction: 'asc' };
      }
      // Same column — cycle asc → desc → cleared (null).
      if (prev.direction === 'asc') {
        return { column, direction: 'desc' };
      }
      return { column: null, direction: 'asc' };
    });
  }, []);

  const setSort = useCallback((column: K, direction: SortDirection) => {
    setSortState({ column, direction });
  }, []);

  const clearSort = useCallback(() => {
    setSortState({ column: null, direction: 'asc' });
  }, []);

  const ariaSortFor = useCallback(
    (column: K): 'ascending' | 'descending' | 'none' | undefined => {
      if (sortState.column !== column) return undefined;
      return sortState.direction === 'asc' ? 'ascending' : 'descending';
    },
    [sortState],
  );

  // Memoised so consumers don't re-render when only the callback's
  // identity changes.
  return useMemo(
    () => ({
      sortState,
      sortedItemsBy,
      cycleSort,
      setSort,
      clearSort,
      ariaSortFor,
    }),
    [sortState, sortedItemsBy, cycleSort, setSort, clearSort, ariaSortFor],
  );
}