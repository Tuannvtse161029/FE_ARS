/**
 * Hook-level tests for src/hooks/useProfile.ts.
 *
 * Hard guarantees exercised here:
 *   1. The hook refuses to fetch when `authenticatedUserId` is null /
 *      undefined / 0 / negative. The page can rely on `isUnauthenticated`
 *      to render its guard.
 *   2. The hook NEVER trusts a route / query / caller-supplied id — the
 *      only id passed to `profileService.getCurrent` and `update` is the
 *      `authenticatedUserId` argument.
 *   3. Save state is tracked separately from fetch state — `isSaving`,
 *      `saveError`, and `clearSaveError` form their own lifecycle so the
 *      page can show an inline save error without hiding the cached
 *      profile.
 *   4. On fetch error: `profile` stays null and `error` is populated so
 *      the page renders an honest error state, never a fake row.
 *   5. On save error: the hook does NOT mutate `profile` — the page can
 *      keep showing the user's last draft.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act as actReact, renderHook, waitFor } from '@testing-library/react';

const serviceMock = vi.hoisted(() => ({
  getCurrent: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../../src/services/profile.service', () => ({
  profileService: serviceMock,
}));

import { useProfile } from '../../../src/hooks/useProfile';

describe('useProfile', () => {
  beforeEach(() => {
    serviceMock.getCurrent.mockReset();
    serviceMock.update.mockReset();
  });

  it('stays unauthenticated and skips the fetch when authenticatedUserId is null', async () => {
    const { result } = renderHook(() => useProfile(null));
    await waitFor(() => expect(result.current.isUnauthenticated).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.profile).toBeNull();
    expect(result.current.error).toBeNull();
    expect(serviceMock.getCurrent).not.toHaveBeenCalled();
  });

  it('treats 0 / negative / NaN ids as unauthenticated', async () => {
    for (const bad of [0, -1, Number.NaN]) {
      const { result } = renderHook(() => useProfile(bad as number | null));
      await waitFor(() => expect(result.current.isUnauthenticated).toBe(true));
      expect(serviceMock.getCurrent).not.toHaveBeenCalled();
    }
  });

  it('fetches via profileService.getCurrent and populates the profile', async () => {
    serviceMock.getCurrent.mockResolvedValueOnce({
      userId: 42,
      fullName: 'Dr. Test',
      academicTitle: 'Prof.',
      bio: 'hi',
      keywords: ['AI'],
    });

    const { result } = renderHook(() => useProfile(42));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(serviceMock.getCurrent).toHaveBeenCalledTimes(1);
    expect(serviceMock.getCurrent).toHaveBeenCalledWith(42);
    expect(result.current.profile?.fullName).toBe('Dr. Test');
    expect(result.current.error).toBeNull();
  });

  it('exposes error state when the fetch fails (and keeps profile null)', async () => {
    serviceMock.getCurrent.mockRejectedValueOnce(new Error('503 Unavailable'));

    const { result } = renderHook(() => useProfile(7));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toMatch(/503/);
    expect(result.current.profile).toBeNull();
  });

  it('save() routes the payload to profileService.update with the authenticated id', async () => {
    serviceMock.getCurrent.mockResolvedValueOnce({ userId: 42 });
    serviceMock.update.mockResolvedValueOnce({
      userId: 42,
      fullName: 'Dr. New',
    });

    const { result } = renderHook(() => useProfile(42));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let savedProfile: unknown = null;
    await actReact(async () => {
      savedProfile = await result.current.save({ fullName: 'Dr. New' });
    });

    expect(serviceMock.update).toHaveBeenCalledTimes(1);
    const [calledId, payload] = serviceMock.update.mock.calls[0];
    expect(calledId).toBe(42);
    expect(payload).toEqual({ fullName: 'Dr. New' });
    expect((savedProfile as { fullName?: string })?.fullName).toBe('Dr. New');
    expect(result.current.saveError).toBeNull();
  });

  it('save() surfaces BE errors and does not mutate the cached profile', async () => {
    serviceMock.getCurrent.mockResolvedValueOnce({
      userId: 42,
      fullName: 'Dr. Existing',
    });
    serviceMock.update.mockRejectedValueOnce(new Error('400 Bad Request'));

    const { result } = renderHook(() => useProfile(42));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let saved: unknown;
    await actReact(async () => {
      saved = await result.current.save({ fullName: 'Dr. New' });
    });

    expect(saved).toBeNull();
    expect(result.current.saveError?.message).toMatch(/400/);
    // The cached profile is NOT overwritten with a fake success.
    expect(result.current.profile?.fullName).toBe('Dr. Existing');
  });

  it('save() refuses to run when authenticatedUserId is missing', async () => {
    const { result } = renderHook(() => useProfile(null));
    let saved: unknown;
    await actReact(async () => {
      saved = await result.current.save({ fullName: 'noop' });
    });
    expect(saved).toBeNull();
    expect(serviceMock.update).not.toHaveBeenCalled();
    expect(result.current.saveError).toBeInstanceOf(Error);
  });

  it('clearSaveError() nulls out saveError so the page can hide the banner', async () => {
    serviceMock.getCurrent.mockResolvedValueOnce({ userId: 42 });
    serviceMock.update.mockRejectedValueOnce(new Error('Boom'));
    const { result } = renderHook(() => useProfile(42));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await actReact(async () => {
      await result.current.save({ fullName: 'X' });
    });
    expect(result.current.saveError).not.toBeNull();
    actReact(() => result.current.clearSaveError());
    expect(result.current.saveError).toBeNull();
  });

  it('refetch() can be called manually and re-runs the fetch', async () => {
    serviceMock.getCurrent.mockResolvedValueOnce({ userId: 42, fullName: 'A' });
    serviceMock.getCurrent.mockResolvedValueOnce({ userId: 42, fullName: 'B' });

    const { result } = renderHook(() => useProfile(42));
    await waitFor(() => expect(result.current.profile?.fullName).toBe('A'));

    await actReact(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.profile?.fullName).toBe('B'));
    expect(serviceMock.getCurrent).toHaveBeenCalledTimes(2);
  });

  it('never falls back to a fake profile when the fetch rejects', async () => {
    serviceMock.getCurrent.mockRejectedValueOnce(new Error('Network down'));
    const { result } = renderHook(() => useProfile(99));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.profile).toBeNull();
    expect(result.current.error?.message).toMatch(/Network down/);
  });
});