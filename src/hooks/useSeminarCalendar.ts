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
  //
  // Only mutator roles (Lecturer, Researcher) ever populate the hosting
  // bucket. Reviewer / Graduate Student / Admin never organise seminars,
  // so even if a legacy record still has `organizerId === currentUserId`
  // it must NOT surface as "hosting" for them — they only ever join.
  const canHost = canMutateSeminar(currentRole);

  const { hostingSeminars, joiningSeminars } = useMemo(() => {
    const hosting: EnrichedSeminar[] = [];
    const joining: EnrichedSeminar[] = [];

    for (const sem of seminars) {
      const isHost =
        canHost &&
        currentUserId != null &&
        sem.organizerId != null &&
        sem.organizerId === currentUserId;

      if (isHost) {
        hosting.push({ ...sem, calendarRole: 'hosting' });
      } else {
        // The user is a participant (invited / accepted).
        // Determine their invitation status from the participant record.
        //
        // Bug fix (Sep 2026): when the non-Lecturer fetch path is taken,
        // `seminarParticipantService.getMySeminars()` returns rows that
        // are scoped to the current user by construction — but the
        // service normaliser does not copy `userId` onto the result, so
        // a strict `p.userId === currentUserId` predicate filters out
        // every seminar and the joining bucket silently empties. We now
        // accept EITHER (a) a strict userId match (Lecturer path with
        // `getAll()`) OR (b) any participant record that carries the
        // seminar id when no userId is present (the `getMySeminars`
        // path). Decremented status filter still gates `DECLINED`.
        const participantRecord = participants.find(
          (p) => {
            if (p.seminarId !== sem.seminarId) return false;
            if (p.userId == null) return true; // my-seminars path
            return p.userId === currentUserId;
          },
        );
        const status = participantRecord?.invitationStatus?.toUpperCase() ?? '';
        const isActiveParticipant =
          status === 'ACCEPTED' ||
          status === 'PENDING' ||
          status === 'INVITED' ||
          status === 'SUBMITTED'; // Bug fix (Sep 2026): Graduate Student who already
        // submitted feedback still needs the seminar visible on the calendar.
        // Without this, an invited seminar the student accepted but already
        // gave feedback for disappears from the month/week/day views even
        // though the ParticipationTable still shows it under "Completed".

        if (isActiveParticipant) {
          joining.push({ ...sem, calendarRole: 'joining' });
        }
      }
    }

    return { hostingSeminars: hosting, joiningSeminars: joining };
  }, [seminars, participants, currentUserId, canHost]);

  return {
    hostingSeminars,
    joiningSeminars,
    allSeminars: [...hostingSeminars, ...joiningSeminars],
    isLoading,
    error,
    refetch: fetchAll,
  };
}
