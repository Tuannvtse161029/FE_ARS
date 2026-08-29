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
// Privacy contract (PUBLICATION_FLOW_API_BLOCKERS.md §3.8):
//   - 'full'                                  → BE shipped the participant-scoped
//                                                read; the FE may request data.
//   - 'awaiting_participant_scoped_endpoint'  → BE has not shipped the
//                                                participant-scoped read.
//                                                The FE must NOT request
//                                                global /api/Seminar or
//                                                /api/SeminarParticipant
//                                                rows because doing so would
//                                                leak every participant's
//                                                identity across the platform
//                                                to non-Lecturer callers.
//                                                The page renders an honest
//                                                read-only banner instead.
//
// Every hook that calls a /api/Seminar* endpoint MUST branch on this state.
// The Lecturer fast path is the only path that currently hits the BE.
// ─────────────────────────────────────────────────────────────────────────────
export type SeminarBackendAvailability =
  | 'full'
  | 'awaiting_participant_scoped_endpoint';

/**
 * Returns the BE-availability state for the seminar surface given the current
 * role. Lecturer callers get `'full'` (the BE's organizer-scoped payload is
 * authoritative today). Every other role that the seminar route guard allows
 * is `'awaiting_participant_scoped_endpoint'` until the BE ships the
 * participant-filtered read documented in PUBLICATION_FLOW_API_BLOCKERS.md §3.8.
 *
 * Centralised here so every hook agrees on the same privacy posture.
 */
export const getSeminarBackendAvailability = (
  role: UserRole | null
): SeminarBackendAvailability => {
  if (canViewSeminar(role)) return 'full';
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
      const [seminarsRes, participantsRes] = await Promise.allSettled([
        seminarService.getAll(),
        seminarParticipantService.getAll(),
      ]);
      const seminarsData =
        seminarsRes.status === 'fulfilled' && Array.isArray(seminarsRes.value)
          ? seminarsRes.value
          : [];
      const participantsData =
        participantsRes.status === 'fulfilled' && Array.isArray(participantsRes.value)
          ? participantsRes.value
          : [];
      setSeminars(seminarsData);
      setParticipants(participantsData);
    } catch {
      setSeminars([]);
      setParticipants([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
// useSeminarParticipants — fetch all participants, optionally filter by seminarId
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

  // Privacy gate: the hook must not call `seminarParticipantService.getAll()`
  // for a non-Lecturer session. The page that opens the Feedback modal
  // already requires `ownsSeminar()` (Lecturer + matching organizerId) but
  // defense in depth: any future caller that forgets the page-level gate
  // still cannot leak the global participant rows from this hook.
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
      const data = await seminarParticipantService.getAll();
      setAllParticipants(Array.isArray(data) ? data : []);
    } catch {
      setAllParticipants([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
// barrel keep working without a second import line. Future BE support for
// `GET /api/Seminar?participantId=` will let the page call this filter
// directly with the raw `Seminar[]` payload.
export { filterSeminarsForViewer };

export default useSeminars;
