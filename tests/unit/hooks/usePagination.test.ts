import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '../../../src/hooks/usePagination';

describe('usePagination', () => {
  it('returns page 1 slice for a 12-item dataset at pageSize 10', () => {
    const items = Array.from({ length: 12 }, (_, i) => i + 1);
    const { result } = renderHook(() => usePagination(items, 10));
    expect(result.current.page).toBe(1);
    expect(result.current.totalItems).toBe(12);
    expect(result.current.totalPages).toBe(2);
    expect(result.current.startIndex).toBe(1);
    expect(result.current.endIndex).toBe(10);
    expect(result.current.pageItems).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.current.hasNext).toBe(true);
    expect(result.current.hasPrev).toBe(false);
  });

  it('advances to page 2 and surfaces records 11–12', () => {
    const items = Array.from({ length: 12 }, (_, i) => i + 1);
    const { result } = renderHook(() => usePagination(items, 10));
    act(() => result.current.next());
    expect(result.current.page).toBe(2);
    expect(result.current.startIndex).toBe(11);
    expect(result.current.endIndex).toBe(12);
    expect(result.current.pageItems).toEqual([11, 12]);
    expect(result.current.hasNext).toBe(false);
    expect(result.current.hasPrev).toBe(true);
  });

  it('clamps page when items shrink below the active page', () => {
    const items = Array.from({ length: 30 }, (_, i) => i + 1);
    const { result, rerender } = renderHook(
      ({ data }: { data: number[] }) => usePagination(data, 10),
      { initialProps: { data: items } },
    );
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
    // Now shrink the dataset to only 5 items — page should clamp back to 1.
    rerender({ data: items.slice(0, 5) });
    expect(result.current.page).toBe(1);
    expect(result.current.pageItems).toEqual([1, 2, 3, 4, 5]);
  });

  it('empties pageItems when the dataset is empty', () => {
    const { result } = renderHook(() => usePagination<number>([], 10));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageItems).toEqual([]);
    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(0);
  });

  it('resetPage() always lands back on page 1', () => {
    const items = Array.from({ length: 20 }, (_, i) => i + 1);
    const { result } = renderHook(() => usePagination(items, 10));
    act(() => result.current.setPage(2));
    act(() => result.current.resetPage());
    expect(result.current.page).toBe(1);
  });

  it('setPageSize() resets to page 1', () => {
    const items = Array.from({ length: 50 }, (_, i) => i + 1);
    const { result } = renderHook(() => usePagination(items, 10));
    act(() => result.current.setPage(2));
    act(() => result.current.setPageSize(25));
    expect(result.current.pageSize).toBe(25);
    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(2);
  });
});
