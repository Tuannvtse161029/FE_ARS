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
  it("returns 'full' for Lecturer (the only role with a BE-authorized read today)", () => {
    expect(getSeminarBackendAvailability('Lecturer')).toBe('full');
  });

  it("returns 'awaiting_participant_scoped_endpoint' for every non-Lecturer role", () => {
    expect(getSeminarBackendAvailability('Researcher')).toBe('awaiting_participant_scoped_endpoint');
    expect(getSeminarBackendAvailability('Reviewer')).toBe('awaiting_participant_scoped_endpoint');
    expect(getSeminarBackendAvailability('Graduate Student')).toBe('awaiting_participant_scoped_endpoint');
    expect(getSeminarBackendAvailability('Admin')).toBe('awaiting_participant_scoped_endpoint');
  });

  it("returns 'awaiting_participant_scoped_endpoint' for null / Guest / unknown roles", () => {
    expect(getSeminarBackendAvailability(null)).toBe('awaiting_participant_scoped_endpoint');
    expect(getSeminarBackendAvailability('Guest')).toBe('awaiting_participant_scoped_endpoint');
    expect(getSeminarBackendAvailability(undefined)).toBe('awaiting_participant_scoped_endpoint');
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

  it('Researcher: NEVER calls /api/SeminarParticipant (privacy leak prevention)', async () => {
    authState.user = {
      id: 7,
      roleId: 1,
      roleName: 'Researcher',
      isActive: true,
    };
    apiGetMock.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useSeminars());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(result.current.seminars).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.backendAvailability).toBe('awaiting_participant_scoped_endpoint');
  });

  it('Reviewer: NEVER calls /api/SeminarParticipant (privacy leak prevention)', async () => {
    authState.user = {
      id: 9,
      roleId: 3,
      roleName: 'Reviewer',
      isActive: true,
    };
    apiGetMock.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useSeminars());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(result.current.seminars).toEqual([]);
    expect(result.current.backendAvailability).toBe('awaiting_participant_scoped_endpoint');
  });

  it('Graduate Student: NEVER calls /api/Seminar or /api/SeminarParticipant (privacy leak prevention)', async () => {
    authState.user = {
      id: 11,
      roleId: 5,
      roleName: 'Graduate Student',
      isActive: true,
    };
    apiGetMock.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useSeminars());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(result.current.seminars).toEqual([]);
    expect(result.current.backendAvailability).toBe('awaiting_participant_scoped_endpoint');
  });

  it('Unauthenticated: NEVER calls the BE', async () => {
    authState.user = null;
    authState.effectiveRole = null;

    const { result } = renderHook(() => useSeminars());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(result.current.backendAvailability).toBe('awaiting_participant_scoped_endpoint');
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
    expect(result.current.backendAvailability).toBe('awaiting_participant_scoped_endpoint');
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
    expect(result.current.backendAvailability).toBe('awaiting_participant_scoped_endpoint');
  });

  it('refetch() for a non-Lecturer session remains a no-op (no network call)', async () => {
    authState.user = {
      id: 7,
      roleId: 1,
      roleName: 'Researcher',
      isActive: true,
    };
    apiGetMock.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useSeminars());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGetMock).not.toHaveBeenCalled();

    // Trigger refetch — must remain a no-op for non-Lecturer.
    await result.current.refetch();
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(result.current.seminars).toEqual([]);
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

  it('Researcher: NEVER calls /api/SeminarParticipant (defense in depth)', async () => {
    authState.user = {
      id: 7,
      roleId: 1,
      roleName: 'Researcher',
      isActive: true,
    };
    apiGetMock.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useSeminarParticipants(1));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(result.current.participants).toEqual([]);
    expect(result.current.backendAvailability).toBe('awaiting_participant_scoped_endpoint');
  });

  it('Reviewer / Graduate Student / Admin / Unauthenticated: NEVER call the BE', async () => {
    for (const roleName of ['Reviewer', 'Graduate Student', 'Admin'] as const) {
      authState.user = {
        id: 1,
        roleId: 0,
        roleName,
        isActive: true,
      };
      apiGetMock.mockReset();
      const { result } = renderHook(() => useSeminarParticipants(1));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(apiGetMock).not.toHaveBeenCalled();
      expect(result.current.backendAvailability).toBe('awaiting_participant_scoped_endpoint');
    }

    authState.user = null;
    apiGetMock.mockReset();
    const { result } = renderHook(() => useSeminarParticipants(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(result.current.backendAvailability).toBe('awaiting_participant_scoped_endpoint');
  });
});