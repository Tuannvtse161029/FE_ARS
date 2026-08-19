// Centralized data-fetching hooks for the Seminar workspace.
//
// Single source of truth for all seminar data. Pages MUST NOT call the raw
// `seminarService` methods directly — go through these hooks so the list stays
// synchronized (e.g. a successful create/delete/refetch updates all listeners).

import { useCallback, useEffect, useState } from 'react';
import {
  seminarService,
  seminarParticipantService,
  type Seminar,
  type SeminarParticipant,
  type SeminarCreateRequest,
  type SeminarUpdateRequest,
  type SeminarCard,
  mapSeminarToCardWithParticipants,
} from '../services/seminar.service';

// ─────────────────────────────────────────────────────────────────────────────
// useSeminars — fetch + map all seminars with live participant counts
// ─────────────────────────────────────────────────────────────────────────────

export interface UseSeminarsResult {
  seminars: SeminarCard[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSeminars(): UseSeminarsResult {
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [participants, setParticipants] = useState<SeminarParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fire both requests in parallel — neither depends on the other.
      const [seminarsData, participantsData] = await Promise.all([
        seminarService.getAll(),
        seminarParticipantService.getAll(),
      ]);
      setSeminars(Array.isArray(seminarsData) ? seminarsData : []);
      setParticipants(Array.isArray(participantsData) ? participantsData : []);
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ?? 'Failed to load seminars.';
      setError(msg);
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
}

export function useSeminarParticipants(seminarId?: number): UseSeminarParticipantsResult {
  const [allParticipants, setAllParticipants] = useState<SeminarParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await seminarParticipantService.getAll();
      setAllParticipants(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ?? 'Failed to load participants.';
      setError(msg);
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

  return { participants, isLoading, error, refetch };
}

export default useSeminars;
