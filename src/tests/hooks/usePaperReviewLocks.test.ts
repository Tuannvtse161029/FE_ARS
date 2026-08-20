import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { getAllMock, getByIdMock, paperGetAllMock } = vi.hoisted(() => ({
  getAllMock: vi.fn(),
  getByIdMock: vi.fn(),
  paperGetAllMock: vi.fn(),
}));

vi.mock('../../services/reviewRequest.service', () => ({
  reviewRequestService: {
    getAll: getAllMock,
    getById: getByIdMock,
  },
}));

vi.mock('../../services/paper.service', () => ({
  paperService: {
    getAll: paperGetAllMock,
  },
}));

import { usePaperReviewLocks } from '../../hooks/usePaperReviewLocks';
import { useAuthStore } from '../../store/authSlice';
import type { ReviewRequest } from '../../services/reviewRequest.service';

const baseReq = (overrides: Partial<ReviewRequest> = {}): ReviewRequest => ({
  id: 1,
  paperId: 100,
  reviewerId: 7,
  fee: 25000,
  status: 'Pending',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

// Seed an authenticated researcher with a userId that owns paperId 100.
// The hook now resolves the identity from the auth store and uses
// paperService.getAll to build the ownedPaperIds set used for review-
// request ownership filtering.
const seedAuthenticatedResearcher = (userId: number) => {
  useAuthStore.setState({
    user: {
      id: userId,
      username: `r${userId}`,
      email: `r${userId}@example.com`,
      fullName: `Researcher ${userId}`,
      roleId: 1,
      roleName: 'Researcher',
      isActive: true,
    },
    token: 'mock-token',
    isAuthenticated: true,
    isLoading: false,
    effectiveRole: 'Researcher',
  });
};

describe('usePaperReviewLocks — mergePendingRequest preserves non-null IDs (defect 1B)', () => {
  beforeEach(() => {
    getAllMock.mockReset();
    getByIdMock.mockReset();
    paperGetAllMock.mockReset();
    // Default: the researcher's own papers contain id=100 (matches baseReq's paperId).
    paperGetAllMock.mockResolvedValue({
      items: [
        { id: '100', title: 'Mine', status: 'Waiting for Review', userId: 22 },
      ],
      total: 1,
    });
    getAllMock.mockResolvedValue([]);
    getByIdMock.mockResolvedValue(null);
    seedAuthenticatedResearcher(22);
  });

  it('preserves paperId and reviewerId when a sparse update omits them', async () => {
    const { result } = renderHook(() => usePaperReviewLocks());

    // Wait for initial BE load to finish (returns []).
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Seed with a fully populated row.
    act(() => {
      result.current.mergePendingRequest(baseReq());
    });

    // A subsequent sparse update from the BE (status-only) must NOT erase IDs.
    act(() => {
      result.current.mergePendingRequest(
        baseReq({
          status: 'Completed',
          // Defect 1B — sparse update omits IDs entirely.
          paperId: undefined as unknown as number,
          reviewerId: undefined as unknown as number,
        }),
      );
    });

    const merged = result.current.requests.find((r) => r.id === 1);
    expect(merged).toBeDefined();
    expect(merged?.paperId).toBe(100);
    expect(merged?.reviewerId).toBe(7);
    expect(merged?.status).toBe('Completed');
  });

  it('updates paperId when the new value is non-null', async () => {
    // Update the seed: the researcher now also owns paper 200.
    paperGetAllMock.mockResolvedValueOnce({
      items: [
        { id: '100', title: 'Mine', status: 'Waiting for Review', userId: 22 },
        { id: '200', title: 'New', status: 'Draft', userId: 22 },
      ],
      total: 2,
    });
    const { result } = renderHook(() => usePaperReviewLocks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.mergePendingRequest(baseReq());
    });
    act(() => {
      result.current.mergePendingRequest(baseReq({ paperId: 200 }));
    });
    const merged = result.current.requests.find((r) => r.id === 1);
    expect(merged?.paperId).toBe(200);
    expect(merged?.reviewerId).toBe(7);
  });

  it('appends a brand-new row when the id is not present', async () => {
    // Seed papers include id 300 so the new request passes ownership.
    paperGetAllMock.mockResolvedValueOnce({
      items: [
        { id: '100', title: 'Mine', status: 'Waiting for Review', userId: 22 },
        { id: '300', title: 'Another', status: 'Draft', userId: 22 },
      ],
      total: 2,
    });
    const { result } = renderHook(() => usePaperReviewLocks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.mergePendingRequest(
        baseReq({ id: 2, paperId: 300, reviewerId: 8 }),
      );
    });
    expect(result.current.requests).toHaveLength(1);
    expect(result.current.requests[0].paperId).toBe(300);
  });

  it('refetches requests when the review-update custom event fires', async () => {
    const { result } = renderHook(() => usePaperReviewLocks());

    // Wait for initial load.
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Initial load returned empty.
    expect(result.current.requests).toHaveLength(0);

    // A second BE response is ready for the refetch. The new request
    // must reference a paperId the researcher owns, so seed 50 in the
    // second paper-getAll mock.
    getAllMock.mockResolvedValueOnce([
      baseReq({ id: 10, status: 'Completed', paperId: 50 }),
    ]);
    paperGetAllMock.mockResolvedValueOnce({
      items: [
        { id: '100', title: 'Mine', status: 'Waiting for Review', userId: 22 },
        { id: '50', title: 'New', status: 'Draft', userId: 22 },
      ],
      total: 2,
    });

    // Fire the custom event that EvaluationDesk dispatches after a successful submit.
    act(() => {
      window.dispatchEvent(
        new CustomEvent('review-update', {
          detail: { reviewRequestId: 10, status: 'Completed' },
        }),
      );
    });

    // The hook refetches and replaces the list with the new data.
    await waitFor(() => expect(result.current.requests).toHaveLength(1));
    expect(result.current.requests[0].id).toBe(10);
    expect(result.current.requests[0].status).toBe('Completed');
  });

  it('refuses to merge a payload whose paperId is not owned by the researcher', async () => {
    // Seed: researcher 22 owns paper 100 only.
    const { result } = renderHook(() => usePaperReviewLocks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // A merge call referencing paperId 999 (NOT in the owned set) must be ignored.
    act(() => {
      result.current.mergePendingRequest(
        baseReq({ id: 99, paperId: 999, reviewerId: 7 }),
      );
    });
    expect(result.current.requests).toHaveLength(0);
  });
});