/**
 * useSeminarParticipations — fetch + state for the Seminar Participations
 * page (Reviewer / Graduate Student / Researcher-as-attendee / Lecturer).
 *
 * Implementation joins the two live BE endpoints used by the existing
 * workspace:
 *
 *   • `GET /api/Seminar/my-invitations` (seminarService.getMyInvitations)
 *   • `GET /api/SeminarParticipant/my-seminars`
 *     (seminarParticipantService.getMySeminars)
 *
 * The two are joined on `seminarId` so the row carries the participant
 * payload (`seminarParticipantId`, `feedbackJson`, `feedbackSubmittedAt`)
 * alongside the seminar payload (title / startTime / onlineLink). All
 * seminar timestamps are routed through `parseApiDateTimeAsUtc` per
 * the **Seminar Date/Time Handling** rule — never `new Date(raw)` —
 * so display + status comparison match what the lecturer picked.
 *
 * The accept / decline mutations wrap the
 * `seminarParticipantService.{acceptInvitation,declineInvitation}` PUT
 * wrappers (ticket §1 q1a). Both optimistically refetch the list so
 * the table flips `PENDING` → `INVITED` or `DECLINED` immediately.
 *
 * No mock fallback; if BE returns [] the table renders the canonical
 * EmptyState.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  seminarService,
  seminarParticipantService,
  mapParticipantStatus,
  type ParticipantUiStatus,
  type Seminar,
  type SeminarParticipant,
} from '../services/seminar.service';
import { parseApiDateTimeAsUtc } from '../utils/datetime';

/**
 * Display row joining a `Seminar` with its participant-specific fields
 * (status / feedbackJson / seminarParticipantId). The `effectiveStatus`
 * field is derived from `endTime` per `deriveEffectiveStatus` so the
 * UI never gets stuck on a stale "Upcoming" for a finished seminar.
 */
export interface ParticipationRow {
  seminarId: number;
  /** Raw title from BE (`SeminarInvitationResponse.title`). */
  title: string;
  /** First 140 chars of `content` for the table description cell. */
  detail: string;
  /** ISO 8601 from the BE. Parsed via `parseApiDateTimeAsUtc` for display. */
  startTime: string;
  endTime: string | null;
  /** Nullable — the BE returns null when Google Meet generation is not wired. */
  onlineLink: string | null;
  organizerName: string | null;
  /** Seminar organizer's user id (mirrors `Seminar.organizerId`). Used by
   *  the notification fan-out after accept / decline / schedule changes. */
  organizerId: number | null;
  /** Canonical UI invitation status (PENDING / INVITED / SUBMITTED / DECLINED). */
  invitationStatus: ParticipantUiStatus;
  /** Raw status string from the BE for debugging / round-tripping. */
  invitationStatusRaw: string | null;
  /**
   * True when the participant has actually submitted feedback. Per ticket
   * §19 this is derived from `feedbackSubmittedAt != null ||
   * feedbackJson != null` rather than from `invitationStatus === 'SUBMITTED'`
   * because the BE can lag the dynamic feedback answer write.
   */
  participantSubmitted: boolean;
  /** Raw JSON string for the participant's dynamic feedback answers. */
  feedbackJson: string | null;
  /** SeminarParticipantId — used for accept / decline PUT. Null when the
   * BE has not yet wired the participant row (e.g. the row came back from
   * `/my-invitations` but the join did not find a matching
   * SeminarParticipant record). */
  seminarParticipantId: number | null;
}

export interface UseSeminarParticipationsResult {
  /** All joined rows, sorted by startTime descending. */
  rows: ParticipationRow[];
  /** Convenience subset — rows that still need an accept/decline action. */
  invitations: ParticipationRow[];
  /** Convenience subset — rows that the user is attending (INVITED or SUBMITTED). */
  seminars: ParticipationRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const truncate = (value: string | null | undefined, max: number): string => {
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}…`;
};

const sortByStartDesc = (a: ParticipationRow, b: ParticipationRow): number => {
  const aMs = parseApiDateTimeAsUtc(a.startTime)?.getTime() ?? 0;
  const bMs = parseApiDateTimeAsUtc(b.startTime)?.getTime() ?? 0;
  return bMs - aMs;
};

export function useSeminarParticipations(): UseSeminarParticipationsResult {
  const [invitationsRaw, setInvitationsRaw] = useState<Seminar[]>([]);
  const [participantsRaw, setParticipantsRaw] = useState<SeminarParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [invitations, participants] = await Promise.all([
        seminarService.getMyInvitations(),
        seminarParticipantService.getMySeminars(),
      ]);
      setInvitationsRaw(Array.isArray(invitations) ? invitations : []);
      setParticipantsRaw(Array.isArray(participants) ? participants : []);
    } catch (err: unknown) {
      setInvitationsRaw([]);
      setParticipantsRaw([]);
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to load your seminar participations.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const rows = useMemo<ParticipationRow[]>(() => {
    // Build a fast lookup by seminarId for the participant rows.
    const participantBySeminar = new Map<number, SeminarParticipant>();
    for (const p of participantsRaw) {
      if (p.seminarId == null) continue;
      // If the BE returns multiple participant rows for the same seminar
      // (e.g. one per role), prefer the row with feedbackJson / a submitted
      // timestamp so the "View Feedback" affordance shows up correctly.
      const existing = participantBySeminar.get(p.seminarId);
      if (
        !existing ||
        (!existing.feedbackJson && p.feedbackJson) ||
        (!existing.feedbackSubmittedAt && p.feedbackSubmittedAt)
      ) {
        participantBySeminar.set(p.seminarId, p);
      }
    }

    const joined: ParticipationRow[] = invitationsRaw.map((sem) => {
      const participant = participantBySeminar.get(sem.seminarId) ?? null;
      const status = mapParticipantStatus(
        participant?.invitationStatus ?? sem.invitationStatus ?? null,
      );
      // `submitted` is computed from EITHER endpoint — the
      // participant-scoped `/my-seminars` payload OR the invitation-
      // scoped `/my-invitations` payload. The hook unions both because:
      //   • `/my-seminars` historically stripped feedback flags per
      //     ticket §20 (see `seminarService.getMySeminars`); the
      //     service still does, so `participant.feedbackSubmittedAt`
      //     is usually null.
      //   • `/my-invitations` keeps the flag (see `getMyInvitations`'s
      //     pass-through mapping), so `sem.feedbackSubmittedAt` is
      //     the authoritative source.
      // Without this union the table would mark already-submitted
      // participants as "not submitted" and surface the "Feedback
      // window closed" pill instead of "View feedback".
      const submitted =
        Boolean(participant?.feedbackSubmittedAt) ||
        Boolean(participant?.feedbackJson && participant.feedbackJson.trim().length > 0) ||
        Boolean(sem.feedbackSubmittedAt) ||
        Boolean(sem.feedbackJson && sem.feedbackJson.trim().length > 0);
      return {
        seminarId: sem.seminarId,
        title: sem.title ?? sem.content?.split('\n')[0]?.slice(0, 80) ?? `Seminar #${sem.seminarId}`,
        detail: truncate(sem.content ?? '', 140),
        startTime: sem.startTime,
        endTime: sem.endTime,
        onlineLink: sem.onlineLink ?? null,
        organizerName: sem.organizerName ?? null,
        organizerId: typeof sem.organizerId === 'number' ? sem.organizerId : null,
        invitationStatus: status,
        invitationStatusRaw: participant?.invitationStatus ?? sem.invitationStatus ?? null,
        participantSubmitted: submitted,
        feedbackJson: participant?.feedbackJson ?? null,
        seminarParticipantId: participant?.seminarParticipantId ?? null,
      };
    });

    return joined.sort(sortByStartDesc);
  }, [invitationsRaw, participantsRaw]);

  const invitations = useMemo<ParticipationRow[]>(
    () => rows.filter((r) => r.invitationStatus === 'PENDING'),
    [rows],
  );

  const seminars = useMemo<ParticipationRow[]>(
    () => rows.filter((r) => r.invitationStatus === 'INVITED' || r.invitationStatus === 'SUBMITTED'),
    [rows],
  );

  return {
    rows,
    invitations,
    seminars,
    isLoading,
    error,
    refetch: fetchAll,
  };
}

/**
 * Single-row accept / decline hooks. Both wrap the
 * `seminarParticipantService.{acceptInvitation,declineInvitation}` PUT
 * wrappers and call `onAfter` so the parent can refetch the participation
 * list. Errors are surfaced via the returned `error` string so the UI can
 * render an inline error banner.
 */

export interface UseAcceptInvitationResult {
  accept: (seminarParticipantId: number) => Promise<void>;
  isAccepting: boolean;
  error: string | null;
}

export function useAcceptInvitation(
  onAfter?: () => Promise<void> | void,
): UseAcceptInvitationResult {
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accept = useCallback(
    async (seminarParticipantId: number) => {
      setIsAccepting(true);
      setError(null);
      try {
        await seminarParticipantService.acceptInvitation(seminarParticipantId);
        await onAfter?.();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to accept the invitation.';
        setError(message);
        throw err;
      } finally {
        setIsAccepting(false);
      }
    },
    [onAfter],
  );
  return { accept, isAccepting, error };
}

export interface UseDeclineInvitationResult {
  decline: (seminarParticipantId: number) => Promise<void>;
  isDeclining: boolean;
  error: string | null;
}

export function useDeclineInvitation(
  onAfter?: () => Promise<void> | void,
): UseDeclineInvitationResult {
  const [isDeclining, setIsDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decline = useCallback(
    async (seminarParticipantId: number) => {
      setIsDeclining(true);
      setError(null);
      try {
        await seminarParticipantService.declineInvitation(seminarParticipantId);
        await onAfter?.();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to decline the invitation.';
        setError(message);
        throw err;
      } finally {
        setIsDeclining(false);
      }
    },
    [onAfter],
  );
  return { decline, isDeclining, error };
}

export default useSeminarParticipations;