import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useReviewerProfiles,
  useReviewerAvailability,
} from '../../../src/hooks/useReviewerProfiles';
import { reviewerService } from '../../../src/services/reviewer.service';

vi.mock('../../../src/services/reviewer.service', () => ({
  reviewerService: {
    getAll: vi.fn(),
    updateAvailability: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
  },
}));

const mockedService = reviewerService as unknown as {
  getAll: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  mockedService.getAll.mockReset();
});

describe('useReviewerAvailability — case-by-case (addendum §C)', () => {
  it('returns null and isLoading=true while the BE request is in flight', async () => {
    let resolveList!: (v: unknown[]) => void;
    mockedService.getAll.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );

    const { result } = renderHook(() => useReviewerAvailability(42));

    // Synchronous first paint: indeterminate, never `Available`.
    expect(result.current.isAvailable).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();

    await act(async () => {
      resolveList([]);
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('returns `true` when the profile explicitly has isAvailable=true', async () => {
    mockedService.getAll.mockResolvedValue([
      {
        userId: 42,
        isAvailable: true,
      },
    ]);

    const { result } = renderHook(() => useReviewerAvailability(42));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAvailable).toBe(true);
  });

  it('respects an explicit isAvailable=false — never defaults to true', async () => {
    mockedService.getAll.mockResolvedValue([
      {
        userId: 42,
        isAvailable: false,
      },
    ]);

    const { result } = renderHook(() => useReviewerAvailability(42));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAvailable).toBe(false);
  });

  it('defaults to available when isAvailable is genuinely missing on a valid profile (?? true)', async () => {
    mockedService.getAll.mockResolvedValue([
      {
        userId: 42,
        // isAvailable intentionally absent
      },
    ]);

    const { result } = renderHook(() => useReviewerAvailability(42));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAvailable).toBe(true);
  });

  it('returns null when no profile is found for the user (NOT silently available)', async () => {
    mockedService.getAll.mockResolvedValue([
      { userId: 999, isAvailable: true },
    ]);

    const { result } = renderHook(() => useReviewerAvailability(42));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAvailable).toBeNull();
  });

  it('surfaces API failure as an error and keeps isAvailable null (no silent Available)', async () => {
    mockedService.getAll.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useReviewerAvailability(42));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAvailable).toBeNull();
    expect(result.current.error?.message).toBe('boom');
  });

  it('returns null when no userId is supplied', async () => {
    const { result } = renderHook(() => useReviewerAvailability(undefined));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAvailable).toBeNull();
    expect(mockedService.getAll).not.toHaveBeenCalled();
  });

  it('uses `?? true` semantics: null isAvailable on the profile still defaults to true', async () => {
    // Defensive: covers any path where BE may serialise as `null`.
    mockedService.getAll.mockResolvedValue([
      { userId: 42, isAvailable: null as unknown as boolean },
    ]);

    const { result } = renderHook(() => useReviewerAvailability(42));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // `typeof null === 'object'`, so the branch falls through to the default.
    expect(result.current.isAvailable).toBe(true);
  });
});

describe('useReviewerProfiles — list contract', () => {
  it('exposes isLoading=true then settles to the fetched list', async () => {
    mockedService.getAll.mockResolvedValue([
      { userId: 1, isAvailable: true },
      { userId: 2, isAvailable: false },
    ]);

    const { result } = renderHook(() => useReviewerProfiles());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.profiles).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it('surfaces API failure as an error and an empty list (no silent data)', async () => {
    mockedService.getAll.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useReviewerProfiles());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.profiles).toEqual([]);
    expect(result.current.error?.message).toBe('network down');
  });
});
