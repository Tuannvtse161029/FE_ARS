/**
 * Hook-level tests for src/hooks/useLecturerProfile.ts.
 *
 * Per lead-phase-c-contract.md §2.1 (S-8): the hook silently fails on 4xx/5xx
 * and falls back to `Lecturer #<id>`. Two components rendering with the same
 * `lecturerId` MUST share one network call (module-scoped cache).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { getByIdMock } = vi.hoisted(() => ({ getByIdMock: vi.fn() }));

vi.mock('../../../src/services/user.service', () => ({
  userService: { getById: getByIdMock },
}));

import { useLecturerProfile } from '../../../src/hooks/useLecturerProfile';

describe('useLecturerProfile', () => {
  beforeEach(() => {
    getByIdMock.mockReset();
  });

  it('returns "Lecturer #<id>" placeholder when lecturerId is null (no fetch)', async () => {
    const { result } = renderHook(() => useLecturerProfile(null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.displayName).toBe('Lecturer');
    expect(result.current.error).toBeNull();
    expect(getByIdMock).not.toHaveBeenCalled();
  });

  it('calls userService.getById(id) exactly once on first render with a valid id', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 7,
      username: 'dr.smith',
      email: 'smith@example.com',
      fullName: 'Dr. Smith',
      roleId: 4,
      roleName: 'Lecturer',
      isActive: true,
    });
    const { result } = renderHook(() => useLecturerProfile(7));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getByIdMock).toHaveBeenCalledTimes(1);
    expect(getByIdMock).toHaveBeenCalledWith(7);
    expect(result.current.displayName).toBe('Dr. Smith');
  });

  it('deduplicates concurrent calls for the same id (module cache)', async () => {
    getByIdMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                id: 8,
                username: 'dr.jones',
                email: 'jones@example.com',
                fullName: 'Dr. Jones',
                roleId: 4,
                roleName: 'Lecturer',
                isActive: true,
              }),
            0,
          );
        }),
    );

    const first = renderHook(() => useLecturerProfile(8));
    const second = renderHook(() => useLecturerProfile(8));
    await waitFor(() =>
      expect(first.result.current.isLoading && second.result.current.isLoading).toBe(
        false,
      ),
    );

    expect(getByIdMock).toHaveBeenCalledTimes(1);
    first.unmount();
    second.unmount();
  });

  it('silent failure on 4xx: no throw, error populated, placeholder name', async () => {
    getByIdMock.mockRejectedValueOnce(new Error('404 Not Found'));
    const { result } = renderHook(() => useLecturerProfile(42));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.displayName).toBe('Lecturer #42');
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toMatch(/404/);
  });

  it('silent failure on 5xx: same shape (placeholder + Error populated)', async () => {
    getByIdMock.mockRejectedValueOnce(new Error('503 Service Unavailable'));
    const { result } = renderHook(() => useLecturerProfile(99));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.displayName).toBe('Lecturer #99');
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toMatch(/503/);
  });

  it('returns the resolved user display name on success', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 11,
      username: 'dr.full',
      email: 'full@example.com',
      fullName: 'Prof. Full Name',
      roleId: 4,
      roleName: 'Lecturer',
      isActive: true,
    });
    const { result } = renderHook(() => useLecturerProfile(11));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.displayName).toBe('Prof. Full Name');
    expect(result.current.error).toBeNull();
  });
});