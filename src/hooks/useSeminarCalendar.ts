// useSeminarCalendar — data-fetching hook for the SeminarCalendar widget.
//
// Fetches two sets of seminars for the calendar:
//   - Hosting: seminars the current user organizes (organizerId === currentUserId)
//   - Joining: seminars the current user is invited to / has accepted
//
// Both sets are derived from the same underlying API calls that SeminarWorkspace
// uses, but split by role so the calendar can color-code them distinctly.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  seminarService,
  seminarParticipantService,
  filterSeminarsForViewer,
  type Seminar,
  type SeminarParticipant,
  canMutateSeminar,
  canViewSeminar,
} from '../services/seminar.service';
import { useAuthStore } from '../store';

// ─────────────────────────────────────────────────────────────────────────────
// Enriched shape for the calendar
// ─────────────────────────────────────────────────────────────────────────────

export interface EnrichedSeminar extends Seminar {
  /** 'hosting' when the current user is the seminar organizer;
   *  'joining' when they are an invited / accepted participant. */
  calendarRole: 'hosting' | 'joining';
}

export interface UseSeminarCalendarResult {
  /** Seminars the current user organizes. */
  hostingSeminars: EnrichedSeminar[];
  /** Seminars the current user is invited to / has accepted. */
  joiningSeminars: EnrichedSeminar[];
  /** All seminars combined (both hosting and joining). */
  allSeminars: EnrichedSeminar[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

type UserRole = import('../types/auth').UserRole;

function getCurrentRole(
  role: ReturnType<typeof useAuthStore.getState>['effectiveRole'],
  user: ReturnType<typeof useAuthStore.getState>['user'],
): UserRole | null {
  const roleName = user?.roleName;
  const candidate = (role ?? roleName ?? null) as UserRole | null | 'Guest';
  if (!candidate || candidate === 'Guest') return null;
  return candidate;
}

function getCurrentUserId(
  user: ReturnType<typeof useAuthStore.getState>['user'],
): number | null {
  const rawId = user?.id;
  const num = Number(rawId);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useSeminarCalendar(): UseSeminarCalendarResult {
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [participants, setParticipants] = useState<SeminarParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentRole = useAuthStore((s) =>
    getCurrentRole(s.effectiveRole, s.user),
  );
  const currentUserId = useAuthStore((s) => getCurrentUserId(s.user));

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!currentRole || !canViewSeminar(currentRole)) {
        setSeminars([]);
        setParticipants([]);
        return;
      }

      let rawSeminars: Seminar[];
      let participantsData: SeminarParticipant[];

      if (canMutateSeminar(currentRole)) {
        try {
          const [seminarsResult, participantsResult] = await Promise.all([
            seminarService.getAll(),
            seminarParticipantService.getAll(),
          ]);
          rawSeminars = seminarsResult;
          participantsData = participantsResult;
        } catch {
          // Fall back to participant-scoped reads.
          const [invitations, myParticipants] = await Promise.all([
            seminarService.getMyInvitations(),
            seminarParticipantService.getMySeminars(),
          ]);
          rawSeminars = invitations;
          participantsData = myParticipants;
        }
      } else {
        const [invitations, myParticipants] = await Promise.all([
          seminarService.getMyInvitations(),
          seminarParticipantService.getMySeminars(),
        ]);
        rawSeminars = invitations;
        participantsData = myParticipants;
      }

      const filtered = filterSeminarsForViewer(
        rawSeminars,
        participantsData,
        currentUserId,
        currentRole,
      );
      setSeminars(filtered);
      setParticipants(participantsData);
    } catch (err: unknown) {
      setSeminars([]);
      setParticipants([]);
      setError(
        err instanceof Error ? err.message : 'Unable to load seminars for the calendar.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentRole, currentUserId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // ── Split into hosting vs joining ────────────────────────────────────────

  const { hostingSeminars, joiningSeminars } = useMemo(() => {
    const hosting: EnrichedSeminar[] = [];
    const joining: EnrichedSeminar[] = [];

    for (const sem of seminars) {
      const isHost =
        currentUserId != null &&
        sem.organizerId != null &&
        sem.organizerId === currentUserId;

      if (isHost) {
        hosting.push({ ...sem, calendarRole: 'hosting' });
      } else {
        // The user is a participant (invited / accepted).
        // Determine their invitation status from the participant record.
        const participantRecord = participants.find(
          (p) =>
            p.seminarId === sem.seminarId &&
            p.userId === currentUserId,
        );
        // Include if the user has any non-declined invitation status.
        const status = participantRecord?.invitationStatus?.toUpperCase() ?? '';
        const isActiveParticipant =
          status === 'ACCEPTED' ||
          status === 'PENDING' ||
          status === 'INVITED' ||
          status === 'SUBMITTED';

        if (isActiveParticipant) {
          joining.push({ ...sem, calendarRole: 'joining' });
        }
      }
    }

    return { hostingSeminars: hosting, joiningSeminars: joining };
  }, [seminars, participants, currentUserId]);

  return {
    hostingSeminars,
    joiningSeminars,
    allSeminars: [...hostingSeminars, ...joiningSeminars],
    isLoading,
    error,
    refetch: fetchAll,
  };
}
