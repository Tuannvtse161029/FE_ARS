// Centralized data-fetching hooks for the Seminar workspace.
//
// Single source of truth for all seminar data. Pages MUST NOT call the raw
// `seminarService` methods directly — go through these hooks so the list stays
// synchronized (e.g. a successful create/delete/refetch updates all listeners).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  seminarService,
  seminarParticipantService,
  type Seminar,
  type SeminarParticipant,
  type SeminarCreateRequest,
  type SeminarUpdateRequest,
  type SeminarCard,
  mapSeminarToCardWithParticipants,
  canMutateSeminar,
  canViewSeminar,
  filterSeminarsForViewer,
} from '../services/seminar.service';
import { useAuthStore } from '../store';
import type { UserRole } from '../types/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Backend availability states for the seminar surface.
//
// Privacy contract: Lecturer management uses the global organizer endpoints;
// other viewers use the live participant-scoped endpoints. No viewer path
// requests global participant rows.
// ─────────────────────────────────────────────────────────────────────────────
export type SeminarBackendAvailability = 'full';

/**
 * Returns the BE-availability state for the seminar surface. All route-guarded
 * business roles have a documented read path in the live API; null is kept
 * full here because the hook makes no request until authentication hydrates.
 */
export const getSeminarBackendAvailability = (
  role: UserRole | null
): SeminarBackendAvailability => {
  void role;
  return 'full';
};

// ─────────────────────────────────────────────────────────────────────────────
// useSeminars — fetch + map all seminars with live participant counts
// ─────────────────────────────────────────────────────────────────────────────

export interface UseSeminarsResult {
  seminars: SeminarCard[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  backendAvailability: SeminarBackendAvailability;
}

export function useSeminars(): UseSeminarsResult {
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [participants, setParticipants] = useState<SeminarParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentRole = useAuthStore((s) => {
    const u = s.user;
    const er = s.effectiveRole;
    const candidate = (er ?? u?.roleName ?? null) as UserRole | null | 'Guest';
    if (!candidate || candidate === 'Guest') return null;
    return candidate;
  });

  const backendAvailability = useMemo<SeminarBackendAvailability>(
    () => getSeminarBackendAvailability(currentRole),
    [currentRole]
  );

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!currentRole || !canViewSeminar(currentRole)) {
        setSeminars([]);
        setParticipants([]);
        return;
      }
      if (canMutateSeminar(currentRole)) {
        const [rawSeminars, participantsData] = await Promise.all([
          seminarService.getAll(),
          seminarParticipantService.getAll(),
        ]);
        setSeminars(rawSeminars);
        setParticipants(participantsData);
      } else {
        const [rawInvitations, participantsData] = await Promise.all([
          seminarService.getMyInvitations(),
          seminarParticipantService.getMySeminars(),
        ]);
        setSeminars(rawInvitations);
        setParticipants(participantsData);
      }
    } catch (err: unknown) {
      setSeminars([]);
      setParticipants([]);
      setError(err instanceof Error ? err.message : 'Unable to load seminars.');
    } finally {
      setIsLoading(false);
    }
  }, [currentRole]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const cards: SeminarCard[] = seminars.map((s) =>
    mapSeminarToCardWithParticipants(s, participants)
  );

  return {
    seminars: cards,
    isLoading,
    error,
    refetch: fetchAll,
    backendAvailability,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useCreateSeminar — POST + optimistic refetch
// ─────────────────────────────────────────────────────────────────────────────

export interface UseCreateSeminarResult {
  createSeminar: (payload: SeminarCreateRequest) => Promise<Seminar>;
  isCreating: boolean;
  createError: string | null;
}

export function useCreateSeminar(
  onSuccess?: (seminar: Seminar) => void,
  refetch?: () => Promise<void>
): UseCreateSeminarResult {
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const createSeminar = useCallback(
    async (payload: SeminarCreateRequest): Promise<Seminar> => {
      const state = useAuthStore.getState();
      const role = state.effectiveRole ?? state.user?.roleName;
      if (role !== 'Lecturer' && role !== 'Researcher') {
        const msg = 'Only Lecturers and Researchers are permitted to create academic seminars.';
        setCreateError(msg);
        throw new Error(msg);
      }

      setIsCreating(true);
      setCreateError(null);
      try {
        const created = await seminarService.create(payload);
        if (created && created.seminarId && payload.guestEmails && payload.guestEmails.length > 0) {
          try {
            await seminarService.invite(created.seminarId, payload.guestEmails);
          } catch (invErr) {
            console.warn('[useCreateSeminar] Seminar created but invite batch failed:', invErr);
          }
        }
        void refetch?.();
        onSuccess?.(created);
        return created;
      } catch (err) {
        const msg =
          (err as { message?: string })?.message ?? 'Failed to create seminar.';
        setCreateError(msg);
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [onSuccess, refetch]
  );

  return { createSeminar, isCreating, createError };
}

// ─────────────────────────────────────────────────────────────────────────────
// useUpdateSeminar — PUT + optimistic refetch
// ─────────────────────────────────────────────────────────────────────────────

export interface UseUpdateSeminarResult {
  updateSeminar: (id: number, payload: SeminarUpdateRequest) => Promise<Seminar>;
  isUpdating: boolean;
  updateError: string | null;
}

export function useUpdateSeminar(
  onSuccess?: (seminar: Seminar) => void,
  refetch?: () => Promise<void>
): UseUpdateSeminarResult {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const updateSeminar = useCallback(
    async (id: number, payload: SeminarUpdateRequest): Promise<Seminar> => {
      setIsUpdating(true);
      setUpdateError(null);
      try {
        const updated = await seminarService.update(id, payload);
        void refetch?.();
        onSuccess?.(updated);
        return updated;
      } catch (err) {
        const msg =
          (err as { message?: string })?.message ?? 'Failed to update seminar.';
        setUpdateError(msg);
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [onSuccess, refetch]
  );

  return { updateSeminar, isUpdating, updateError };
}

// ─────────────────────────────────────────────────────────────────────────────
// useDeleteSeminar — DELETE + optimistic refetch
// ─────────────────────────────────────────────────────────────────────────────

export interface UseDeleteSeminarResult {
  deleteSeminar: (id: number) => Promise<void>;
  isDeleting: boolean;
  deleteError: string | null;
}

export function useDeleteSeminar(
  onSuccess?: (id: number) => void,
  refetch?: () => Promise<void>
): UseDeleteSeminarResult {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteSeminar = useCallback(
    async (id: number): Promise<void> => {
      setIsDeleting(true);
      setDeleteError(null);
      try {
        await seminarService.delete(id);
        void refetch?.();
        onSuccess?.(id);
      } catch (err) {
        const msg =
          (err as { message?: string })?.message ?? 'Failed to delete seminar.';
        setDeleteError(msg);
        throw err;
      } finally {
        setIsDeleting(false);
      }
    },
    [onSuccess, refetch]
  );

  return { deleteSeminar, isDeleting, deleteError };
}

// ─────────────────────────────────────────────────────────────────────────────
// useSendReminder — PUT with isReminderSent=true + refetch
// ─────────────────────────────────────────────────────────────────────────────

export interface UseSendReminderResult {
  sendReminder: (id: number) => Promise<void>;
  isSending: boolean;
  sendError: string | null;
}

export function useSendReminder(
  onSuccess?: (id: number) => void,
  refetch?: () => Promise<void>
): UseSendReminderResult {
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const sendReminder = useCallback(
    async (id: number): Promise<void> => {
      setIsSending(true);
      setSendError(null);
      try {
        await seminarService.update(id, { isReminderSent: true });
        void refetch?.();
        onSuccess?.(id);
      } catch (err) {
        const msg =
          (err as { message?: string })?.message ?? 'Failed to send reminder.';
        setSendError(msg);
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [onSuccess, refetch]
  );

  return { sendReminder, isSending, sendError };
}

// ─────────────────────────────────────────────────────────────────────────────
// useSeminarParticipants — fetch participants from the role-scoped endpoint,
// optionally filtered by seminarId.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseSeminarParticipantsResult {
  participants: SeminarParticipant[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Privacy-preserving BE-availability flag. See §3.8. */
  backendAvailability: SeminarBackendAvailability;
}

export function useSeminarParticipants(seminarId?: number): UseSeminarParticipantsResult {
  const [allParticipants, setAllParticipants] = useState<SeminarParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Privacy gate: non-Lecturer sessions use the participant-scoped endpoint;
  // only Lecturers may request the global organizer participant list.
  const currentRole = useAuthStore((s) => {
    const u = s.user;
    const er = s.effectiveRole;
    const candidate = (er ?? u?.roleName ?? null) as UserRole | null | 'Guest';
    if (!candidate || candidate === 'Guest') return null;
    return candidate;
  });

  const backendAvailability = useMemo<SeminarBackendAvailability>(
    () => getSeminarBackendAvailability(currentRole),
    [currentRole]
  );

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!currentRole || !canViewSeminar(currentRole)) {
        setAllParticipants([]);
        return;
      }
      const data = canMutateSeminar(currentRole)
        ? await seminarParticipantService.getAll()
        : await seminarParticipantService.getMySeminars();
      setAllParticipants(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setAllParticipants([]);
      setError(err instanceof Error ? err.message : 'Unable to load seminar participants.');
    } finally {
      setIsLoading(false);
    }
  }, [currentRole]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const participants = seminarId != null
    ? allParticipants.filter((p) => p.seminarId === seminarId)
    : allParticipants;

  return { participants, isLoading, error, refetch, backendAvailability };
}

// ─────────────────────────────────────────────────────────────────────────────
// useSeminarRoleContext — surfaces the current role + ownership capabilities
// derived from the auth store. Pages consume this instead of importing the
// helpers directly so the role flags stay consistent across the surface.
//
//   currentRole          — BusinessRole from the auth store (or null)
//   currentUserId        — id from the auth store user blob (or null)
//   canModify            — true when the role can mutate (create / update /
//                          delete / send reminder / open feedback modal)
//   canView              — true when the role can see the list (read-only or
//                          mutator). Read-only viewers still see only the
//                          seminars the BE surfaces to them.
//   isReadOnlyForViewer  — convenience alias for `canView && !canModify`
//   backendAvailability  — privacy-preserving BE-availability state. See §3.8.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseSeminarRoleContextResult {
  currentRole: UserRole | null;
  currentUserId: number | null;
  canModify: boolean;
  canView: boolean;
  isReadOnlyForViewer: boolean;
  backendAvailability: SeminarBackendAvailability;
}

export function useSeminarRoleContext(): UseSeminarRoleContextResult {
  const user = useAuthStore((s) => s.user);
  const effectiveRole = useAuthStore((s) => s.effectiveRole);

  // Prefer the BE-derived effectiveRole when present (Agent 39 contract),
  // fall back to the persisted roleName. `Guest` and null are treated as
  // "no business role" — the page renders the standard unauthorized state.
  const currentRole = useMemo<UserRole | null>(() => {
    const candidate = (effectiveRole ?? user?.roleName ?? null) as UserRole | null | 'Guest';
    if (!candidate || candidate === 'Guest') return null;
    return candidate;
  }, [effectiveRole, user?.roleName]);

  const currentUserId = useMemo<number | null>(() => {
    const id = user?.id;
    if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) return null;
    return id;
  }, [user?.id]);

  const canModify = canMutateSeminar(currentRole);
  const canView = canViewSeminar(currentRole);
  const backendAvailability = getSeminarBackendAvailability(currentRole);

  return {
    currentRole,
    currentUserId,
    canModify,
    canView,
    isReadOnlyForViewer: canView && !canModify,
    backendAvailability,
  };
}

// Re-export the filter helper so existing callers that consume it from this
// barrel keep working without a second import line.
export { filterSeminarsForViewer };

export default useSeminars;
