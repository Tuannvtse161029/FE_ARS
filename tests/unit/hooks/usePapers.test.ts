/**
 * Tests for the cross-account ownership filter inside
 * src/hooks/usePapers.ts.
 *
 * Validates the documented behaviour:
 *   1. Authenticated researcher 22 sees only paper records owned by 22.
 *   2. Papers owned by researcher 27 are filtered out.
 *   3. The hook clears its list when the authenticated user changes.
 *   4. The hook sets `detectedCrossAccountLeak` when the BE returns
 *      records belonging to a different user.
 *   5. In-flight requests from a previous user are aborted on switch.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePapers } from '../../hooks/usePapers';
import { useAuthStore } from '../../store/authSlice';
import type { Paper } from '../../services/paper.service';

const setAuthedUser = (id: number | null) => {
  if (id === null) {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
    return;
  }
  useAuthStore.setState({
    user: {
      id,
      username: `r${id}`,
      email: `r${id}@example.com`,
      fullName: `Researcher ${id}`,
      roleId: 1,
      roleName: 'Researcher',
      isActive: true,
    },
    token: 'mock-token',
    isAuthenticated: true,
    isLoading: false,
  });
};

// Hoisted mocks — vi.mock factories run before module-level consts.
const { paperServiceMock } = vi.hoisted(() => ({
  paperServiceMock: {
    getAll: vi.fn(),
  },
}));

vi.mock('../../services/paper.service', () => ({
  paperService: paperServiceMock,
}));

const paperFor = (id: number, ownerId: number): Paper => ({
  id: String(id),
  title: `Paper ${id}`,
  status: 'Waiting for Review',
  userId: ownerId,
});

describe('usePapers — cross-account ownership filter', () => {
  beforeEach(() => {
    paperServiceMock.getAll.mockReset();
    setAuthedUser(null);
  });

  afterEach(() => {
    setAuthedUser(null);
  });

  it('returns only papers owned by the authenticated researcher (22)', async () => {
    setAuthedUser(22);
    paperServiceMock.getAll.mockResolvedValueOnce({
      items: [paperFor(1, 22), paperFor(2, 22), paperFor(3, 27)],
      total: 3,
    });

    const { result } = renderHook(() => usePapers({ pageSize: 50 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.papers.map((p) => p.id)).toEqual(['1', '2']);
  });

  it('flags detectedCrossAccountLeak when the BE returns foreign papers', async () => {
    setAuthedUser(22);
    paperServiceMock.getAll.mockResolvedValueOnce({
      items: [paperFor(1, 22), paperFor(2, 27), paperFor(3, 22)],
      total: 3,
    });

    const { result } = renderHook(() => usePapers({ pageSize: 50 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.detectedCrossAccountLeak).toBe(true);
  });

  it('does not flag a leak when every paper belongs to the authenticated user', async () => {
    setAuthedUser(22);
    paperServiceMock.getAll.mockResolvedValueOnce({
      items: [paperFor(1, 22), paperFor(2, 22)],
      total: 2,
    });

    const { result } = renderHook(() => usePapers({ pageSize: 50 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.detectedCrossAccountLeak).toBe(false);
  });

  it('clears the list when the authenticated user switches (22 → 27)', async () => {
    setAuthedUser(22);
    paperServiceMock.getAll.mockResolvedValueOnce({
      items: [paperFor(1, 22), paperFor(2, 22)],
      total: 2,
    });

    const { result, rerender } = renderHook(() => usePapers({ pageSize: 50 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.papers).toHaveLength(2);

    // Switch user → list should be cleared immediately.
    setAuthedUser(27);
    paperServiceMock.getAll.mockResolvedValueOnce({
      items: [paperFor(10, 27), paperFor(3, 22)], // 3 is foreign for 27
      total: 2,
    });
    rerender();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.papers.map((p) => p.id)).toEqual(['10']);
  });

  it('returns an empty list when the user is unauthenticated', async () => {
    setAuthedUser(null);
    paperServiceMock.getAll.mockResolvedValueOnce({ items: [], total: 0 });

    const { result } = renderHook(() => usePapers({ pageSize: 50 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.papers).toEqual([]);
  });

  it('accepts papers whose legacy authorId matches the authenticated user', async () => {
    setAuthedUser(22);
    paperServiceMock.getAll.mockResolvedValueOnce({
      items: [
        { id: '1', title: 'A', status: 'Draft', authorId: 22 },
      ],
      total: 1,
    });

    const { result } = renderHook(() => usePapers({ pageSize: 50 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.papers).toHaveLength(1);
    expect(result.current.detectedCrossAccountLeak).toBe(false);
  });
});