import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { UserRole } from '../types/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Semantic seminar status — canonical set for the UI.
// The BE stores this as a free-form string. Normalize via `mapSeminarStatus()`.
// ─────────────────────────────────────────────────────────────────────────────
export type SeminarUiStatus = 'UPCOMING' | 'IN PROGRESS' | 'COMPLETED' | 'DRAFT';

// ─────────────────────────────────────────────────────────────────────────────
// Role-aware access predicates.
//
// These helpers are the FE-side authorization layer for the seminar surface.
// They DO NOT bypass the BE: every write goes through the documented Swagger
// contract (`POST/PUT/DELETE /api/Seminar/{id}`), and the BE enforces its own
// authorization server-side. The predicates exist so the UI:
//   • hides mutating affordances from non-Lecturer roles
//   • shows read-only cards for invitees (Researcher / Reviewer / Graduate
//     Student) when the BE exposes them to a seminar
//   • flags the Lecturer as the only role that can `create`, `update`, and
//     `delete` a seminar row, and as the only role that can send reminders
//     and view the full feedback table
//
// Researcher / Reviewer / Graduate Student read-only access is granted ONLY
// for seminars where the BE's `GET /api/Seminar` / `GET /api/SeminarParticipant`
// payload surfaces them as a participant. If the BE restricts the read to
// organizer-only, the FE will simply render an empty list — it will not
// synthesize access.
// ─────────────────────────────────────────────────────────────────────────────

/** Roles that may create / update / delete seminars and send reminders. */
export const SEMINAR_MUTATOR_ROLES: readonly UserRole[] = ['Lecturer'] as const;

/** Roles that may view the seminar list (read-only). Includes the mutator. */
export const SEMINAR_VIEWER_ROLES: readonly UserRole[] = [
  'Lecturer',
  'Graduate Student',
  'Researcher',
  'Reviewer',
] as const;

/**
 * Returns true when `role` may create / update / delete seminars and
 * trigger reminders.
 */
export const canMutateSeminar = (role: UserRole | string | null | undefined): boolean => {
  if (!role) return false;
  return (SEMINAR_MUTATOR_ROLES as readonly string[]).includes(role);
};

/**
 * Returns true when `role` may view the seminar list. Read-only viewers
 * still see the same `GET /api/Seminar` payload the BE exposes — the FE
 * never fabricates seminars.
 */
export const canViewSeminar = (role: UserRole | string | null | undefined): boolean => {
  if (!role) return false;
  return (SEMINAR_VIEWER_ROLES as readonly string[]).includes(role);
};

/**
 * Ownership predicate for a seminar row. Returns true ONLY when the current
 * user is a Lecturer AND the BE-supplied `organizerId` matches
 * `currentUserId`. Used to decide whether the UI exposes the Feedback &
 * Grading modal (which contains participant evaluations and reminder
 * controls) to the current viewer.
 *
 * `currentUserId === null` is intentionally treated as "ownership
 * unverifiable" and returns `false` — the UI must NOT assume ownership
 * when the BE has not yet populated the JWT subject claim (see BE-S2).
 */
export const ownsSeminar = (
  seminar: Pick<Seminar, 'organizerId'>,
  currentUserId: number | null | undefined,
  role: UserRole | string | null | undefined,
): boolean => {
  if (!canMutateSeminar(role)) return false;
  if (currentUserId == null) return false;
  if (seminar.organizerId == null) return false;
  return seminar.organizerId === currentUserId;
};

/**
 * Filter a seminar list for callers that already have participant rows. The
 * production hooks prefer the live participant-scoped endpoints and use this
 * helper only when joining an independently fetched list.
 */
export const filterSeminarsForViewer = (
  seminars: Seminar[],
  participants: SeminarParticipant[],
  currentUserId: number | null | undefined,
  role: UserRole | string | null | undefined,
): Seminar[] => {
  if (canMutateSeminar(role)) return seminars;
  if (!canViewSeminar(role)) return [];
  if (currentUserId == null) return [];
  const invitedSeminarIds = new Set<number>();
  for (const p of participants) {
    if (p.userId === currentUserId && p.seminarId != null) {
      invitedSeminarIds.add(p.seminarId);
    }
  }
  if (invitedSeminarIds.size === 0) {
    return [];
  }
  return seminars.filter((s) => invitedSeminarIds.has(s.seminarId));
};

// ─────────────────────────────────────────────────────────────────────────────
// Participant invitation status — canonical set for the UI.
// The BE stores this as a free-form string. Normalize via `mapParticipantStatus()`.
// ─────────────────────────────────────────────────────────────────────────────
export type ParticipantUiStatus = 'PENDING' | 'INVITED' | 'SUBMITTED' | 'DECLINED';

// ─────────────────────────────────────────────────────────────────────────────
// Raw BE response shapes (Swagger: no schema defined for GET responses).
// Fields are optional so a partial BE payload never crashes the page.
// ─────────────────────────────────────────────────────────────────────────────

/** Mirror of `GET /api/Seminar` + `GET /api/Seminar/{id}` row.
 * Swagger declares "200 OK" with no schema — fields are inferred from the live
 * response. `title` is a FE-only convenience not returned by the BE.
 *
 * NOTE — `organizerId` is nullable. The BE may return null when the JWT
 * claim is not yet wired. See Backend Team Request BE-S2.
 * NOTE — `onlineLink` is nullable. The BE may return null when Google Meet
 * generation is not yet wired. See Backend Team Request BE-S1.
 * NOTE — `aiSummary` is NOT in the GET response per Swagger. It is only
 * returned by `POST /api/Seminar/{id}/summarize-audio`. We include it here
 * defensively so a future BE change can populate it without a FE bump.
 */
export interface Seminar {
  seminarId: number;
  organizerId?: number | null;
  /** FE-only convenience — derived from `content` when absent.
   * The BE has no separate `title` field. */
  title?: string;
  content?: string | null;
  startTime: string;   // ISO 8601
  endTime: string;     // ISO 8601
  onlineLink?: string | null;
  maxParticipants?: number | null;
  isReminderSent?: boolean | null;
  status?: string | null;  // free-form BE status
  createdAt?: string;
  updatedAt?: string;
  /** Defensive: may be present in a future BE response. */
  aiSummary?: string | null;
  reminderEnabled?: boolean;
  reminderSentAt?: string | null;
  feedback?: string | null;
  participants?: SeminarParticipant[] | null;
  organizerName?: string | null;
  invitationStatus?: string | null;
  participantEvaluation?: string | null;
  rating?: number | null;
}

/** Response returned by the participant-scoped seminar endpoints. */
export interface SeminarInvitationResponse {
  seminarId: number;
  seminarParticipantId?: number | null;
  title?: string | null;
  startTime: string;
  endTime: string;
  onlineLink?: string | null;
  organizerName?: string | null;
  invitationStatus?: string | null;
  participantEvaluation?: string | null;
  rating?: number | null;
}

/** Mirror of `POST /api/Seminar` / `PUT /api/Seminar/{id}` request body.
 * All fields are nullable except `startTime` / `endTime`.
 * `organizerId` is filled server-side from the JWT in production.
 */
export interface SeminarCreateRequest {
  startTime: string;   // required
  endTime: string;     // required
  content: string;
  onlineLink?: string | null;
  maxParticipants?: number | null;
  isReminderSent?: boolean | null;
  status?: string | null;
  guestEmails?: string[] | null;
  reminderEnabled?: boolean | null;
}

export type SeminarUpdateRequest = Partial<SeminarCreateRequest>;

// ─────────────────────────────────────────────────────────────────────────────
// Participant shapes
// ─────────────────────────────────────────────────────────────────────────────

/** Mirror of `GET /api/SeminarParticipant` row.
 * Swagger declares "200 OK" with no schema. `userId` may be null for
 * email-only invitations pending user resolution.
 */
export interface SeminarParticipant {
  seminarParticipantId?: number;
  seminarId?: number | null;
  userId?: number | null;
  invitationStatus?: string | null;
  participantEvaluation?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // Joined fields (if BE ever adds them):
  userFullName?: string | null;
  userEmail?: string | null;
  invitedEmail?: string | null;
  invitationSentAt?: string | null;
  eventReminderSentAt?: string | null;
  feedbackReminderSentAt?: string | null;
}

export interface SeminarParticipantCreateRequest {
  seminarId?: number | null;
  userId?: number | null;
  invitationStatus?: string | null;
  participantEvaluation?: string | null;
}

export type SeminarParticipantUpdateRequest = Partial<SeminarParticipantCreateRequest>;

// ─────────────────────────────────────────────────────────────────────────────
// AI Audio Summary
// ─────────────────────────────────────────────────────────────────────────────

/** Response from `POST /api/Seminar/{id}/summarize-audio`.
 * This is the ONLY endpoint that returns `aiSummary`.
 * `aiSummary` is NOT in the GET /api/Seminar response per Swagger.
 */
export interface SeminarAudioSummaryResponse {
  seminarId: number;
  aiSummary: string | null;
  updatedAt: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export const seminarService = {
  getAll: async (): Promise<Seminar[]> => {
    const response = await api.get<Seminar[]>(API_ENDPOINTS.SEMINAR.GET_ALL);
    return Array.isArray(response.data) ? response.data : [];
  },

  getById: async (id: number): Promise<Seminar> => {
    const response = await api.get<Seminar>(API_ENDPOINTS.SEMINAR.GET_BY_ID(id));
    return response.data;
  },

  create: async (payload: SeminarCreateRequest): Promise<Seminar> => {
    const response = await api.post<Seminar>(API_ENDPOINTS.SEMINAR.CREATE, payload);
    return response.data;
  },

  update: async (id: number, payload: SeminarUpdateRequest): Promise<Seminar> => {
    const response = await api.put<Seminar>(API_ENDPOINTS.SEMINAR.UPDATE(id), payload);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.SEMINAR.DELETE(id));
  },

  invite: async (id: number, emails: string[]): Promise<unknown> => {
    const response = await api.post(API_ENDPOINTS.SEMINAR.INVITE(id), { emails });
    return response.data;
  },

  submitFeedback: async (
    seminarId: number,
    payload: {
      rating?: number | null;
      participantEvaluation?: string | null;
      invitationStatus?: string | null;
    }
  ): Promise<unknown> => {
    const response = await api.post(
      API_ENDPOINTS.SEMINAR.FEEDBACK(seminarId),
      payload
    );
    return response.data;
  },

  getMyInvitations: async (): Promise<Seminar[]> => {
    const response = await api.get<SeminarInvitationResponse[]>(
      API_ENDPOINTS.SEMINAR.MY_INVITATIONS
    );
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.map((row) => ({
      seminarId: row.seminarId,
      title: row.title ?? undefined,
      content: row.title ?? null,
      startTime: row.startTime,
      endTime: row.endTime,
      onlineLink: row.onlineLink ?? null,
      organizerName: row.organizerName ?? null,
      invitationStatus: row.invitationStatus ?? null,
      participantEvaluation: row.participantEvaluation ?? null,
      rating: row.rating ?? null,
      status: row.endTime && new Date(row.endTime).getTime() < Date.now() ? 'Completed' : 'Upcoming',
    }));
  },
};

export const seminarParticipantService = {
  getAll: async (): Promise<SeminarParticipant[]> => {
    const response = await api.get<SeminarParticipant[]>(
      API_ENDPOINTS.SEMINAR_PARTICIPANT.GET_ALL
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  getMySeminars: async (): Promise<SeminarParticipant[]> => {
    const response = await api.get<SeminarInvitationResponse[]>(
      API_ENDPOINTS.SEMINAR_PARTICIPANT.MY_SEMINARS,
    );
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.map((row) => ({
      seminarParticipantId: row.seminarParticipantId ?? undefined,
      seminarId: row.seminarId,
      invitationStatus: row.invitationStatus ?? null,
      participantEvaluation: row.participantEvaluation ?? null,
      createdAt: undefined,
      updatedAt: undefined,
    }));
  },

  getById: async (id: number): Promise<SeminarParticipant> => {
    const response = await api.get<SeminarParticipant>(
      API_ENDPOINTS.SEMINAR_PARTICIPANT.GET_BY_ID(id)
    );
    return response.data;
  },

  create: async (payload: SeminarParticipantCreateRequest): Promise<SeminarParticipant> => {
    const response = await api.post<SeminarParticipant>(
      API_ENDPOINTS.SEMINAR_PARTICIPANT.CREATE,
      payload
    );
    return response.data;
  },

  update: async (
    id: number,
    payload: SeminarParticipantUpdateRequest
  ): Promise<SeminarParticipant> => {
    const response = await api.put<SeminarParticipant>(
      API_ENDPOINTS.SEMINAR_PARTICIPANT.UPDATE(id),
      payload
    );
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.SEMINAR_PARTICIPANT.DELETE(id));
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Effective seminar status — derived FE-side for UI display.
//
// The BE may return status: "Upcoming" for a seminar whose endTime has already
// passed. Rather than hiding such seminars from the "Completed" tab, we derive
// `effectiveStatus` here so the UI can surface them correctly.
//
// NOTE: We do NOT write this value back to the database. Authoritative lifecycle
// persistence (BE-S5) remains a backend-owned requirement.
// ─────────────────────────────────────────────────────────────────────────────

export type EffectiveSeminarStatus = 'UPCOMING' | 'IN PROGRESS' | 'COMPLETED' | 'DRAFT';

/**
 * Derive the effective seminar status for UI display.
 *
 * When the raw BE status is "Upcoming" (or equivalent) but the seminar's endTime
 * is in the past, the seminar is treated as COMPLETED for tab-display purposes.
 * This fixes the BE-S5 gap without requiring a DB write.
 *
 * Rules:
 *   - If raw status is COMPLETED/DRAFT → use raw status
 *   - If raw status is UPCOMING/IN_PROGRESS → check endTime
 *   - endTime < now  →  COMPLETED
 *   - endTime >= now →  use raw status
 */
export const deriveEffectiveStatus = (
  rawStatus: string | null | undefined,
  endTime: string | null | undefined,
): EffectiveSeminarStatus => {
  const mapped = mapSeminarStatus(rawStatus);

  if (mapped === 'COMPLETED' || mapped === 'DRAFT') return mapped;
  if (!endTime) return mapped;

  const endMs = new Date(endTime).getTime();
  if (Number.isNaN(endMs)) return mapped;

  if (endMs < Date.now()) return 'COMPLETED';
  return mapped;
};

// ─────────────────────────────────────────────────────────────────────────────
// Semantic mappers
// ─────────────────────────────────────────────────────────────────────────────

/** Normalize raw BE seminar status → UI canonical status.
 * Anything unknown (including empty) is treated as UPCOMING.
 * 'Upcoming' maps to UPCOMING (case-insensitive).
 * 'Completed'/'Complete'/'Done' maps to COMPLETED.
 * 'InProgress'/'In Progress'/'In-Progress'/'Live' maps to IN PROGRESS.
 * 'Draft' maps to DRAFT.
 */
export const mapSeminarStatus = (raw: string | null | undefined): SeminarUiStatus => {
  if (!raw) return 'UPCOMING';
  const v = raw.toLowerCase().trim();
  if (v === 'completed' || v === 'complete' || v === 'done') return 'COMPLETED';
  if (v === 'inprogress' || v === 'in progress' || v === 'in-progress' || v === 'live') {
    return 'IN PROGRESS';
  }
  if (v === 'draft') return 'DRAFT';
  return 'UPCOMING';
};

/** Normalize raw BE participant invitation status → UI canonical status.
 * Defaults to 'PENDING' for unknown or empty values.
 */
export const mapParticipantStatus = (
  raw: string | null | undefined
): ParticipantUiStatus => {
  if (!raw) return 'PENDING';
  const v = raw.toLowerCase().trim();
  if (v === 'submitted' || v === 'complete' || v === 'completed') return 'SUBMITTED';
  if (v === 'invited' || v === 'accepted' || v === 'confirmed') return 'INVITED';
  if (v === 'declined' || v === 'rejected') return 'DECLINED';
  return 'PENDING';
};

/** Returns true when `onlineLink` is a valid HTTPS Google Meet URL.
 * Used to decide whether to show the "Join Google Meet" button.
 */
export const isValidMeetLink = (link: string | null | undefined): boolean => {
  if (!link) return false;
  return link.startsWith('https://meet.google.com/');
};

/**
 * Filter participants by seminarId (client-side join since BE has no filter param).
 */
export const filterParticipantsBySeminarId = (
  participants: SeminarParticipant[],
  seminarId: number
): SeminarParticipant[] =>
  participants.filter((p) => p.seminarId === seminarId);

// ─────────────────────────────────────────────────────────────────────────────
// SeminarCard — enriched UI shape for list rendering.
// Kept here for backward compatibility with existing callers that invoke
// `mapSeminarToCard(s)` with a single argument. New code should use
// `useSeminars()` which enriches cards with participant counts server-side.
// ─────────────────────────────────────────────────────────────────────────────

export interface SeminarCard {
  seminarId: number;
  /** FE convenience — `content` first line up to 80 chars. BE has no title field. */
  title: string;
  content: string;
  startTime: string;
  endTime: string;
  /** Empty string when BE returns null. Check with `isValidMeetLink()`. */
  onlineLink: string;
  /** Raw normalized status from `mapSeminarStatus()`. */
  status: SeminarUiStatus;
  /** Effective status accounting for endTime. Use this for tab filtering. */
  effectiveStatus: EffectiveSeminarStatus;
  organizerId: number | null;
  isReminderSent: boolean;
  maxParticipants: number | null;
  aiSummary: string | null;
  /** Zero for the single-arg overload — enriched by `useSeminars()`. */
  participantCount: number;
  /** Zero for the single-arg overload — enriched by `useSeminars()`. */
  feedbackSubmitted: number;
  /** Zero for the single-arg overload — enriched by `useSeminars()`. */
  feedbackTotal: number;
  /** Transient UI flag — set to true after a successful create so the page
   *  can render a "NEW" badge. Not persisted or sent to the BE. */
  isNew?: boolean;
}

/**
 * Derive a SeminarCard from a raw BE Seminar row.
 * Participant stats default to 0 — use the 2-arg overload or `useSeminars()`
 * to get enriched cards with real participant counts.
 */
export const mapSeminarToCard = (s: Seminar): SeminarCard => {
  const title =
    s.title ??
    (s.content ? s.content.split('\n')[0].slice(0, 80) : `Seminar #${s.seminarId}`);
  return {
    seminarId: s.seminarId,
    title,
    content: s.content ?? '',
    startTime: s.startTime,
    endTime: s.endTime,
    onlineLink: s.onlineLink ?? '',
    status: mapSeminarStatus(s.status),
    effectiveStatus: deriveEffectiveStatus(s.status, s.endTime),
    organizerId: s.organizerId ?? null,
    isReminderSent: s.isReminderSent ?? false,
    maxParticipants: s.maxParticipants ?? null,
    aiSummary: s.aiSummary ?? null,
    participantCount: 0,
    feedbackSubmitted: 0,
    feedbackTotal: 0,
  };
};

/** 2-arg overload: derive a SeminarCard with real participant counts from the list. */
export const mapSeminarToCardWithParticipants = (
  s: Seminar,
  participants: SeminarParticipant[]
): SeminarCard => {
  const card = mapSeminarToCard(s);
  const seminarParticipants = participants.filter((p) => p.seminarId === s.seminarId);
  const feedbackSubmitted = seminarParticipants.filter(
    (p) => mapParticipantStatus(p.invitationStatus) === 'SUBMITTED'
  ).length;
  return {
    ...card,
    participantCount: seminarParticipants.length,
    feedbackSubmitted,
    feedbackTotal: seminarParticipants.length,
  };
};

export default seminarService;
