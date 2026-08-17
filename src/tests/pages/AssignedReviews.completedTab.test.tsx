/**
 * Defect 2A — Reviewer "Completed" tab transition tests.
 *
 * Tests the central normalizer (`getReviewRequestTab`) is wired into
 * `AssignedReviews`'s filter + counts, and the type-tolerant `reviewerId`
 * comparator accepts both numeric and string IDs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { getAllMock, paperServiceGetByIdMock, useAuthStoreState } = vi.hoisted(() => ({
  getAllMock: vi.fn(),
  paperServiceGetByIdMock: vi.fn(),
  useAuthStoreState: { id: 7 } as { id: number | undefined },
}));

vi.mock('../../services/reviewRequest.service', () => ({
  reviewRequestService: {
    getAll: getAllMock,
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../../services/paper.service', () => ({
  paperService: {
    getAll: vi.fn().mockResolvedValue({ items: [] }),
    getById: paperServiceGetByIdMock,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../../store/authSlice', () => ({
  useAuthStore: <T,>(selector: (s: { user: { id: number } | null }) => T) =>
    selector({ user: useAuthStoreState.id != null ? { id: useAuthStoreState.id } : null }),
}));

import { AssignedReviews } from '../../pages/Reviewer/AssignedReviews';
import type { ReviewRequest } from '../../services/reviewRequest.service';

const baseReq = (overrides: Partial<ReviewRequest>): ReviewRequest => ({
  id: 1,
  paperId: 100,
  reviewerId: 7,
  fee: 25000,
  status: 'Pending',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('AssignedReviews — defect 2A Completed tab transition', () => {
  beforeEach(() => {
    getAllMock.mockReset();
    paperServiceGetByIdMock.mockReset();
    useAuthStoreState.id = 7;
    paperServiceGetByIdMock.mockResolvedValue({
      id: '100',
      title: 'Paper',
      status: '',
    });
  });

  it('counts Completed rows via the central normalizer (defect 2A item 6)', async () => {
    getAllMock.mockResolvedValueOnce([
      baseReq({ id: 1, status: 'Pending', paperId: 100 }),
      baseReq({ id: 2, status: 'In Progress', paperId: 101 }),
      baseReq({ id: 3, status: 'Completed', paperId: 102 }),
      baseReq({ id: 4, status: 'DONE', paperId: 103 }),
      baseReq({ id: 5, status: 'Completed', paperId: 104 }),
    ]);

    render(
      <MemoryRouter>
        <AssignedReviews />
      </MemoryRouter>
    );

    // Defect 2A item 6 — counts use the same central normalizer.
    // Seed: 1 Pending, 1 In Progress, 3 Completed.
    await waitFor(() => expect(screen.getByText(/Completed \(3\)/)).toBeTruthy());
    expect(screen.getByText(/In Progress \(1\)/)).toBeTruthy();
    expect(screen.getByText(/Pending \/ Action Required \(1\)/)).toBeTruthy();
  });

  it('shows Completed rows only in the Completed tab — and not in Pending', async () => {
    getAllMock.mockResolvedValueOnce([
      baseReq({ id: 1, status: 'Pending', paperId: 100 }),
      baseReq({ id: 2, status: 'Completed', paperId: 101 }),
    ]);

    render(
      <MemoryRouter>
        <AssignedReviews />
      </MemoryRouter>
    );

    // Default tab is Pending. The Completed row should NOT be visible yet.
    await waitFor(() => screen.getByText('Paper #100'));
    expect(screen.queryByText('Paper #101')).toBeNull();
  });

  it('accepts reviewerId as string (mixed types, defect 2A item 5)', async () => {
    // Some BE payloads emit reviewerId as a numeric string.
    getAllMock.mockResolvedValueOnce([
      baseReq({ id: 1, status: 'Pending', paperId: 100, reviewerId: '7' as unknown as number }),
    ]);

    render(
      <MemoryRouter>
        <AssignedReviews />
      </MemoryRouter>
    );
    await waitFor(() => screen.getByText('Paper #100'));
  });
});