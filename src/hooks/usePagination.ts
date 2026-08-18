import { useCallback, useEffect, useMemo, useState } from 'react';

// usePagination — generic helper for any indexed table list.
//
// Inputs:
//   - items: the full filtered dataset (already narrowed by search/filter)
//   - pageSize: how many items per page (defaults to 10)
//
// Returns:
//   - page (1-based), totalPages, current slice, control callbacks
//   - resetPage() for callers to call when the search query changes
//
// We deliberately keep this as a plain hook (no React Query / Zustand) so any
// table page can drop it in next to the existing service hooks.

export interface UsePaginationResult<T> {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  pageItems: T[];
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  next: () => void;
  prev: () => void;
  resetPage: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

export function usePagination<T>(
  items: T[],
  pageSize: number = 10,
): UsePaginationResult<T> {
  const [page, setPageRaw] = useState(1);
  const [size, setSizeRaw] = useState(pageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / size));

  // Clamp page whenever totalPages shrinks (post-search / post-refresh).
  // If the items array is empty we keep the user on page 1 and let the
  // caller render the empty state — `pageItems` will simply be `[]`.
  useEffect(() => {
    if (totalItems === 0) {
      if (page !== 1) setPageRaw(1);
      return;
    }
    if (page > totalPages) {
      setPageRaw(totalPages);
    }
  }, [page, totalItems, totalPages]);

  const startIndex = totalItems === 0 ? 0 : (page - 1) * size + 1;
  const endIndex = Math.min(page * size, totalItems);
  const pageItems = useMemo(
    () => items.slice((page - 1) * size, page * size),
    [items, page, size],
  );

  const setPage = useCallback(
    (next: number) => {
      if (!Number.isFinite(next)) return;
      const clamped = Math.min(Math.max(1, Math.trunc(next)), totalPages);
      setPageRaw(clamped);
    },
    [totalPages],
  );

  const setPageSize = useCallback((next: number) => {
    if (!Number.isFinite(next) || next <= 0) return;
    setSizeRaw(Math.trunc(next));
    setPageRaw(1);
  }, []);

  const next = useCallback(() => {
    setPage(page + 1);
  }, [page, setPage]);

  const prev = useCallback(() => {
    setPage(page - 1);
  }, [page, setPage]);

  const resetPage = useCallback(() => {
    setPageRaw(1);
  }, []);

  return {
    page,
    pageSize: size,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    pageItems,
    setPage,
    setPageSize,
    next,
    prev,
    resetPage,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
