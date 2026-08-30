/**
 * Privacy tests for the seminar hooks.
 *
 * Pins the privacy contract documented in
 * PUBLICATION_FLOW_API_BLOCKERS.md §3.8 — non-Lecturer roles MUST NOT
 * trigger global /api/Seminar or /api/SeminarParticipant calls because
 * the BE returns every row platform-wide with no participant filter.
 *
 * These tests run against the real hooks (not the demo adapter) so a
 * future refactor that "helpfully" prefetches the participant list will
 * fail here, not in production.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { apiGetMock } = vi.hoisted(() => ({ apiGetMock: vi.fn() }));

vi.mock('../../../src/services/axios', () => ({
  default: {
    get: apiGetMock,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../src/services/auth.service', () => ({
  default: { login: vi.fn(), logout: vi.fn() },
  clearAuthSession: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: null as
    | null
    | {
        id: number;
        roleId: number | null;
        roleName: string | null;
        isActive: boolean;
      },
  effectiveRole: null as string | null,
}));

vi.mock('../../../src/store', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));

import { useSeminars, useSeminarParticipants } from '../../../src/hooks/useSeminar';
import {
  getSeminarBackendAvailability,
} from '../../../src/hooks/useSeminar';

describe('getSeminarBackendAvailability', () => {
  it("returns 'full' for Lecturer", () => {
    expect(getSeminarBackendAvailability('Lecturer')).toBe('full');
  });

  it("returns 'full' for every role because read endpoints are role-scoped", () => {
    expect(getSeminarBackendAvailability('Researcher')).toBe('full');
    expect(getSeminarBackendAvailability('Reviewer')).toBe('full');
    expect(getSeminarBackendAvailability('Graduate Student')).toBe('full');
    expect(getSeminarBackendAvailability('Admin')).toBe('full');
  });

  it("returns 'full' for null / Guest / unknown roles before the hook's auth gate", () => {
    expect(getSeminarBackendAvailability(null)).toBe('full');
    expect(getSeminarBackendAvailability('Guest')).toBe('full');
    expect(getSeminarBackendAvailability(undefined)).toBe('full');
  });
});

describe('useSeminars — privacy posture (PUBLICATION_FLOW_API_BLOCKERS.md §3.8)', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    authState.user = null;
    authState.effectiveRole = null;
  });

  it('Lecturer: hits BOTH /api/Seminar and /api/SeminarParticipant (preserves existing Lecturer behavior)', async () => {
    authState.user = {
      id: 42,
      roleId: 4,
      roleName: 'Lecturer',
      isActive: true,
    };
    apiGetMock.mockResolvedValue({ data: [] });

    renderHook(() => useSeminars());

    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    const calledPaths = apiGetMock.mock.calls.map((c) => c[0]);
    expect(calledPaths).toContain('/api/Seminar');
    expect(calledPaths).toContain('/api/SeminarParticipant');
  });

  it('Researcher: calls only participant-scoped seminar endpoints', async () => {
    authState.user = {
      id: 7,
      roleId: 1,
      roleName: 'Researcher',
      isActive: true,
    };
    apiGetMock.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useSeminars());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const calledPaths = apiGetMock.mock.calls.map((c) => c[0]);
    expect(calledPaths).toContain('/api/Seminar/my-invitations');
    expect(calledPaths).toContain('/api/SeminarParticipant/my-seminars');
    expect(calledPaths).not.toContain('/api/Seminar');
    expect(calledPaths).not.toContain('/api/SeminarParticipant');
    expect(result.current.seminars).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.backendAvailability).toBe('full');
  });

  it('Reviewer: calls only participant-scoped seminar endpoints', async () => {
    authState.user = {
      id: 9,
      roleId: 3,
      roleName: 'Reviewer',
      isActive: true,
    };
    apiGetMock.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useSeminars());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const calledPaths = apiGetMock.mock.calls.map((c) => c[0]);
    expect(calledPaths).toContain('/api/Seminar/my-invitations');
    expect(calledPaths).toContain('/api/SeminarParticipant/my-seminars');
    expect(calledPaths).not.toContain('/api/Seminar');
    expect(calledPaths).not.toContain('/api/SeminarParticipant');
    expect(result.current.seminars).toEqual([]);
    expect(result.current.backendAvailability).toBe('full');
  });

  it('Graduate Student: calls only participant-scoped seminar endpoints', async () => {
    authState.user = {
      id: 11,
      roleId: 5,
      roleName: 'Graduate Student',
      isActive: true,
    };
    apiGetMock.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useSeminars());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const calledPaths = apiGetMock.mock.calls.map((c) => c[0]);
    expect(calledPaths).toContain('/api/Seminar/my-invitations');
    expect(calledPaths).toContain('/api/SeminarParticipant/my-seminars');
    expect(calledPaths).not.toContain('/api/Seminar');
    expect(calledPaths).not.toContain('/api/SeminarParticipant');
    expect(result.current.seminars).toEqual([]);
    expect(result.current.backendAvailability).toBe('full');
  });

  it('Unauthenticated: NEVER calls the BE', async () => {
    authState.user = null;
    authState.effectiveRole = null;

    const { result } = renderHook(() => useSeminars());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(result.current.backendAvailability).toBe('full');
  });

  it('Admin: NEVER calls the BE (no seminar ownership by Admin)', async () => {
    authState.user = {
      id: 1,
      roleId: 2,
      roleName: 'Admin',
      isActive: true,
    };

    const { result } = renderHook(() => useSeminars());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(result.current.seminars).toEqual([]);
    expect(result.current.backendAvailability).toBe('full');
  });

  it('Guest effectiveRole with Lecturer roleName: NEVER calls the BE (effectiveRole wins)', async () => {
    authState.effectiveRole = 'Guest';
    authState.user = {
      id: 5,
      roleId: 4,
      roleName: 'Lecturer',
      isActive: false,
    };

    const { result } = renderHook(() => useSeminars());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(result.current.backendAvailability).toBe('full');
  });

  it('refetch() for a Researcher repeats only participant-scoped calls', async () => {
    authState.user = {
      id: 7,
      roleId: 1,
      roleName: 'Researcher',
      isActive: true,
    };
    apiGetMock.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useSeminars());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    apiGetMock.mockClear();

    await result.current.refetch();
    const calledPaths = apiGetMock.mock.calls.map((c) => c[0]);
    expect(calledPaths).toEqual(
      expect.arrayContaining([
        '/api/Seminar/my-invitations',
        '/api/SeminarParticipant/my-seminars',
      ]),
    );
    expect(calledPaths).not.toContain('/api/Seminar');
    expect(calledPaths).not.toContain('/api/SeminarParticipant');
  });
});

describe('useSeminarParticipants — privacy posture', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    authState.user = null;
    authState.effectiveRole = null;
  });

  it('Lecturer: hits /api/SeminarParticipant (preserves existing Lecturer behavior)', async () => {
    authState.user = {
      id: 42,
      roleId: 4,
      roleName: 'Lecturer',
      isActive: true,
    };
    apiGetMock.mockResolvedValue({ data: [] });

    renderHook(() => useSeminarParticipants(1));

    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    const calledPaths = apiGetMock.mock.calls.map((c) => c[0]);
    expect(calledPaths).toContain('/api/SeminarParticipant');
  });

  it('Researcher: calls only /api/SeminarParticipant/my-seminars', async () => {
    authState.user = {
      id: 7,
      roleId: 1,
      roleName: 'Researcher',
      isActive: true,
    };
    apiGetMock.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useSeminarParticipants(1));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGetMock).toHaveBeenCalledWith('/api/SeminarParticipant/my-seminars');
    expect(apiGetMock).not.toHaveBeenCalledWith('/api/SeminarParticipant');
    expect(result.current.participants).toEqual([]);
    expect(result.current.backendAvailability).toBe('full');
  });

  it('Reviewer / Graduate Student call only /api/SeminarParticipant/my-seminars; Admin and unauthenticated sessions do not call the BE', async () => {
    for (const roleName of ['Reviewer', 'Graduate Student'] as const) {
      authState.user = {
        id: 1,
        roleId: 0,
        roleName,
        isActive: true,
      };
      apiGetMock.mockReset();
      apiGetMock.mockResolvedValue({ data: [] });
      const { result } = renderHook(() => useSeminarParticipants(1));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(apiGetMock).toHaveBeenCalledWith('/api/SeminarParticipant/my-seminars');
      expect(apiGetMock).not.toHaveBeenCalledWith('/api/SeminarParticipant');
      expect(result.current.backendAvailability).toBe('full');
    }

    authState.user = {
      id: 1,
      roleId: 2,
      roleName: 'Admin',
      isActive: true,
    };
    apiGetMock.mockReset();
    const adminResult = renderHook(() => useSeminarParticipants(1));
    await waitFor(() => expect(adminResult.result.current.isLoading).toBe(false));
    expect(apiGetMock).not.toHaveBeenCalled();

    authState.user = null;
    apiGetMock.mockReset();
    const unauthenticatedResult = renderHook(() => useSeminarParticipants(1));
    await waitFor(() => expect(unauthenticatedResult.result.current.isLoading).toBe(false));
    expect(apiGetMock).not.toHaveBeenCalled();
  });
});