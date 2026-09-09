import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { UserRole } from '../types/auth';
import {
  type FeedbackQuestion,
  type FeedbackAnswer,
  DEFAULT_GENERAL_QUESTIONS,
  parseSeminarQuestions,
  getCachedSeminarQuestions,
  setCachedSeminarQuestions,
} from '../types/seminarFeedback';
import { parseApiDateTimeAsUtc } from '../utils/datetime';

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

/** Roles that may create / update / delete seminars, configure the feedback
 * form, and trigger feedback reminders. Ticket §4 widens ownership to
 * Researcher alongside Lecturer. */
export const SEMINAR_MUTATOR_ROLES: readonly UserRole[] = ['Lecturer', 'Researcher'] as const;

/**
 * Roles that may view their personal seminar surface (invitations +
 * seminars they organize).
 *
 * Per ticket §4, Admin does NOT own seminars; Admin keeps per-seminar
 * access through the dedicated feedback endpoints
 * (`GET /api/Seminar/{id}/feedback`, `GET|...|/feedback-form`) but is
 * intentionally excluded from the bulk listing so the Admin console does
 * not become another entrypoint for the global organizer list.
 */
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
 *
 * Roles per ticket §4:
 *   • Lecturer  — owns all seminars globally (no filter).
 *   • Researcher — owns the seminars they organize PLUS the ones they are
 *     invited to (matches the participant-scoped `useSeminars` path).
 *   • Reviewer / Graduate Student — read-only, sees seminars they are
 *     invited to.
 *   • Anything else — returns [] (no seminar access).
 */
export const filterSeminarsForViewer = (
  seminars: Seminar[],
  participants: SeminarParticipant[],
  currentUserId: number | null | undefined,
  role: UserRole | string | null | undefined,
): Seminar[] => {
  if (!role || !canViewSeminar(role)) return [];
  if (role === 'Lecturer') return seminars;

  // Build the set of seminarIds where the current user is a participant.
  const invitedSeminarIds = new Set<number>();
  if (currentUserId != null) {
    for (const p of participants) {
      if (p.userId === currentUserId && p.seminarId != null) {
        invitedSeminarIds.add(p.seminarId);
      }
    }
  }

  // Researcher also owns the seminars they organize.
  if (role === 'Researcher' && currentUserId != null) {
    const organizedIds = new Set<number>();
    for (const s of seminars) {
      if (s.organizerId === currentUserId) organizedIds.add(s.seminarId);
    }
    const allowed = new Set<number>([...organizedIds, ...invitedSeminarIds]);
    if (allowed.size === 0) return [];
    return seminars.filter((s) => allowed.has(s.seminarId));
  }

  // Reviewer / Graduate Student: participant-scoped only.
  if (currentUserId == null) return [];
  if (invitedSeminarIds.size === 0) return [];
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

/**
 * Mirror of `GET /api/Seminar` + `GET /api/Seminar/{id}` row (ticket §6).
 *
 * NOTE — `organizerId` is nullable. The BE may return null when the JWT
 * claim is not yet wired.
 * NOTE — `onlineLink` is nullable. The BE may return null when Google Meet
 * generation is not yet wired.
 * NOTE — `aiSummary` is nulled intentionally by the BE in list responses
 * (ticket §7). Use `GET /api/Seminar/{id}` to fetch the full AI summary
 * alongside the rest of the seminar state.
 * NOTE — `feedback` is the JSON-stringified dynamic feedback form config;
 * `feedbackJson` is the JSON-stringified AI aggregate of participant text
 * feedback (ticket §2). They are completely different fields.
 */
export interface Seminar {
  seminarId: number;
  organizerId?: number | null;
  /** FE-only convenience — derived from `content` when absent.
   * The BE has no separate `title` field. */
  title?: string;
  content?: string | null;
  startTime: string;   // ISO 8601
  /**
   * ISO 8601 end time. Currently REQUIRED on POST, but the BE ticket
   * `BE_SEMINAR_NULLABLE_ENDTIME.md` will make this nullable. Once that
   * ships, a `null` endTime means "the seminar is still open-ended;
   * the lecturer will end it explicitly." FE consumers must use
   * `effectiveStatus` (not raw endTime) for tab filtering.
   */
  endTime: string | null;
  onlineLink?: string | null;
  maxParticipants?: number | null;
  /** LEGACY — see ticket §10:
   *   • on CREATE  — enables reminder scheduling at creation time
   *   • on UPDATE  — triggers an immediate SendFeedbackRemindersAsync call
   *     (NOT just a flag). Use `reminderEnabled` for the new event-reminder
   *     scheduling. */
  isReminderSent?: boolean | null;
  status?: string | null;  // free-form BE status
  createdAt?: string;
  updatedAt?: string;
  /** AI summary of the seminar audio/video file.
   * Null in `GET /api/Seminar` (list) responses — only `GET /api/Seminar/{id}`
   * (and `POST /api/Seminar/{id}/summarize-audio`) populate it. */
  aiSummary?: string | null;
  reminderEnabled?: boolean;
  reminderSentAt?: string | null;
  /** Dynamic feedback form config stored as JSON (ticket §3.1, §6). */
  feedback?: string | null;
  /** AI aggregate feedback summary stored as JSON (ticket §3.1, §6).
   * Distinct from `feedback` (form config) and `aiSummary` (audio summary). */
  feedbackJson?: string | null;
  /** When the AI feedback summary was generated. */
  aiFeedbackGeneratedAt?: string | null;
  participants?: SeminarParticipant[] | null;
  organizerName?: string | null;
  invitationStatus?: string | null;
  participantEvaluation?: string | null;
  rating?: number | null;
  subFieldId?: number | null;
  subFieldName?: string | null;
}

/** Response returned by the participant-scoped seminar endpoints. */
export interface SeminarInvitationResponse {
  seminarId: number;
  seminarParticipantId?: number | null;
  title?: string | null;
  startTime: string;
  endTime: string | null;
  onlineLink?: string | null;
  organizerName?: string | null;
  invitationStatus?: string | null;
  participantEvaluation?: string | null;
  rating?: number | null;
  subFieldId?: number | null;
  subFieldName?: string | null;
}

/** Mirror of `GET /api/Seminar/suggested-invitees` item */
export interface SuggestedInviteeDto {
  userId: number;
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  roles?: string[] | null;
  subFieldId?: number | null;
  subFieldName?: string | null;
  orcidId?: string | null;
  hindex?: number | null;
  publicationCount?: number | null;
}

/**
 * Mirror of `POST /api/Seminar` / `PUT /api/Seminar/{id}` request body.
 *
 * Field-nullability status (ticket §9 / §10):
 *   • `startTime`     — REQUIRED (BE rejects without it).
 *   • `endTime`       — REQUIRED on the BE today, but will become nullable
 *                       once BE ships the "Mark as Completed" endpoint
 *                       (see tickets/backend/BE_SEMINAR_NULLABLE_ENDTIME.md).
 *                       The FE types it as `string | null` so the moment
 *                       that BE change lands, callers can omit the field
 *                       without a type rewrite.
 *   • `organizerId`   — filled server-side from the JWT in production.
 *
 * Until then, the FE passes `startTime + SEMINAR_PLACEHOLDER_DURATION_MS`
 * as a visible placeholder. See §55.5 of the FE ticket.
 */
export interface SeminarCreateRequest {
  startTime: string;            // required
  endTime: string | null;       // required today, nullable post-BE-fix
  content: string;
  onlineLink?: string | null;
  maxParticipants?: number | null;
  isReminderSent?: boolean | null;
  status?: string | null;
  guestEmails?: string[] | null;
  reminderEnabled?: boolean | null;
  subFieldId?: number | null;
}

export type SeminarUpdateRequest = Partial<SeminarCreateRequest>;

/** Generic paged wrapper returned by `GET /api/Seminar/paged` (ticket §8). */
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

/**
 * Canonical alias for a participant row that the BE returns in
 * `GET /api/Seminar/{id}` and `GET /api/Seminar/{id}/feedback` (ticket §12).
 * Kept as a type alias of `SeminarParticipant` so existing code keeps
 * compiling while the canonical ticket vocabulary is now first-class.
 */
export type SeminarParticipantResponse = SeminarParticipant;

// ─────────────────────────────────────────────────────────────────────────────
// Participant shapes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirror of a participant row returned by the canonical Seminar Detail
 * (`GET /api/Seminar/{id}`, ticket §12) and the owner-only raw feedback
 * list (`GET /api/Seminar/{id}/feedback`).
 *
 * The dynamic answers live in `feedbackJson` (raw JSON string). The legacy
 * `feedback` field (typed `unknown` here) is returned as a structured object
 * only and is NOT the source of truth for the dynamic-feedback surface —
 * never render answers from `feedback` directly (ticket §41, §50).
 */
export interface SeminarParticipant {
  seminarParticipantId?: number;
  seminarId?: number | null;
  userId?: number | null;
  invitationStatus?: string | null;
  /** SOURCE OF TRUTH for this participant's dynamic answers (ticket §12). */
  feedbackJson?: string | null;
  /** First-submission timestamp; null until participant submits (ticket §18). */
  feedbackSubmittedAt?: string | null;
  /** Last-submission timestamp; updated on every edit (ticket §18). */
  feedbackUpdatedAt?: string | null;
  /** Legacy structured object — only kept for compatibility. Render via
   * `parseParticipantAnswers(row.feedbackJson)`, never via this field. */
  feedback?: unknown;
  participantEvaluation?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // Joined fields (if BE adds them):
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
// Structured feedback model — replaces the legacy star rating + free-text
// `participantEvaluation` field. See tickets/frontend/ticket.md for the
// full contract. The FE never sends `rating` or `averageScore`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structured participant feedback. At least one of the four fields must be
 * non-empty for the form to submit; an all-empty object is invalid.
 */
export interface SeminarFeedbackContent {
  overallComment?: string;
  strengths: string[];
  improvements: string[];
  suggestions: string[];
}

/** Body of POST /api/Seminar/{id}/feedback. */
export interface SeminarFeedbackRequest {
  feedback: SeminarFeedbackContent;
}

/** Response from POST /api/Seminar/{id}/feedback. */
export interface SeminarFeedbackResponse {
  seminarId: number;
  seminarParticipantId: number;
  userId?: number | null;
  feedback: SeminarFeedbackContent;
  feedbackSubmittedAt: string;
  feedbackUpdatedAt?: string | null;
  invitationStatus?: string;
  message?: string;
  // Legacy compatibility only — do not display in new UI.
  participantEvaluation?: string | null;
}

/**
 * Item in the owner-only raw feedback list (`GET /api/Seminar/{id}/feedback`,
 * ticket §21). Each row is a participant on the seminar plus their
 * submission state. The dynamic answers live in `feedbackJson` (parse via
 * `parseParticipantAnswers(row.feedbackJson)`) — never render from the
 * legacy `feedback` or `participantEvaluation` fields (ticket §21, §41, §50).
 */
export interface SeminarParticipantFeedback {
  seminarParticipantId: number;
  seminarId?: number | null;
  userId?: number | null;
  userFullName?: string | null;
  userEmail?: string | null;
  invitedEmail?: string | null;
  invitationStatus?: string | null;
  /** SOURCE OF TRUTH for this participant's dynamic answers (ticket §12). */
  feedbackJson?: string | null;
  feedbackSubmittedAt?: string | null;
  feedbackUpdatedAt?: string | null;
  invitationSentAt?: string | null;
  eventReminderSentAt?: string | null;
  feedbackReminderSentAt?: string | null;
  /** Legacy structured fields — kept only for compatibility (ticket §41). */
  feedback?: unknown;
  participantEvaluation?: string | null;
}

/** Response of GET /api/Seminar/{id}/feedback (owner only). */
export type SeminarFeedbackListResponse = SeminarParticipantFeedback[];

/**
 * True if the participant has actually submitted dynamic feedback (ticket
 * §19). USE THIS instead of `invitationStatus === 'SUBMITTED'` to render
 * "Đã đánh giá" / "Feedback submitted" UI.
 */
export const hasSubmittedFeedback = (
  participant?: Pick<SeminarParticipant, 'feedbackJson' | 'feedbackSubmittedAt'> | null,
): boolean => {
  if (!participant) return false;
  if (participant.feedbackSubmittedAt) return true;
  if (participant.feedbackJson && participant.feedbackJson.trim().length > 0) {
    return true;
  }
  return false;
};

/** Owner-only completion metrics from GET /api/Seminar/{id}/stats. */
export interface SeminarStats {
  seminarId: number;
  totalInvited: number;
  submitted: number;
  pending: number;
  declined: number;
  completionPercentage: number;
}

/** Response of POST /api/Seminar/{id}/reminders/send. */
export interface SeminarReminderResponse {
  seminarId: number;
  eligible: number;
  sent: number;
  skipped: number;
  failedEmails: string[];
}

/** Owner-only AI-aggregated feedback summary. */
export interface SeminarFeedbackAiContent {
  overallAssessment: string;
  commonStrengths: string[];
  areasForImprovement: string[];
  commonSuggestions: string[];
  conflictingFeedback: string[];
  recommendedActions: string[];
}

/** Response of POST /api/Seminar/{id}/summarize-feedback. */
export interface SeminarFeedbackAiSummary {
  seminarId: number;
  feedbackCount: number;
  feedback: SeminarFeedbackAiContent;
  generatedAt: string;
}

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

  /**
   * @deprecated The canonical submit/edit endpoint is
   * `POST /api/Seminar/{id}/feedback` with the dynamic feedback answer
   * array (see `submitDynamicFeedback`). This legacy payload — the
   * structured `{ overallComment, strengths, improvements, suggestions }`
   * shape — is no longer the dynamic-feedback surface (ticket §13-16, §41).
   * Kept here only for back-compat with old callers; new code must NOT
   * use it. The BE 4xxs any non-`{ answers }` POST.
   */
  submitFeedback: async (
    seminarId: number,
    payload: SeminarFeedbackRequest,
  ): Promise<SeminarFeedbackResponse> => {
    const response = await api.post<SeminarFeedbackResponse>(
      API_ENDPOINTS.SEMINAR.FEEDBACK(seminarId),
      payload,
    );
    return response.data;
  },

  /**
   * Save the dynamic feedback form configured by the host (Lecturer or
   * Researcher). Stored in `Seminars.feedback` (NVARCHAR(MAX) JSON).
   *
   * Per ticket §14 the canonical request body is the questions array
   * directly. The legacy `{ questions, feedback }` wrapper is still
   * accepted by the BE — we send the array directly so the FE/BE contract
   * stays simple.
   */
  saveFeedbackQuestions: async (
    seminarId: number,
    questions: FeedbackQuestion[],
  ): Promise<void> => {
    const normalizedQuestions = questions.map((q, idx) => ({
      ...q,
      orderIndex: idx,
    }));
    setCachedSeminarQuestions(seminarId, normalizedQuestions);
    await api.put(
      API_ENDPOINTS.SEMINAR.FEEDBACK_FORM(seminarId),
      normalizedQuestions,
    );
  },

  /**
   * Fetch dynamic feedback questions for a seminar. The canonical source
   * is `GET /api/Seminar/{id}/feedback-form`, which returns
   * `{ seminarId, feedback, questions: SeminarFeedbackQuestion[], message }`
   * (ticket §13.1). When `questions` is populated we use it directly; when
   * only the raw `feedback` string is present we parse it as a fallback.
   */
  getFeedbackQuestions: async (
    seminarId: number,
  ): Promise<FeedbackQuestion[]> => {
    try {
      const formResp = await api.get<{
        seminarId?: number;
        feedback?: string | null;
        questions?: FeedbackQuestion[] | null;
      }>(API_ENDPOINTS.SEMINAR.FEEDBACK_FORM(seminarId));
      if (formResp.data) {
        if (Array.isArray(formResp.data.questions) && formResp.data.questions.length > 0) {
          setCachedSeminarQuestions(seminarId, formResp.data.questions);
          return formResp.data.questions;
        }
        if (formResp.data.feedback) {
          const parsed = parseSeminarQuestions(formResp.data.feedback);
          if (parsed.length > 0) {
            setCachedSeminarQuestions(seminarId, parsed);
            return parsed;
          }
        }
      }
    } catch {
      // ignore — try fallback below
    }

    try {
      const response = await api.get<Seminar>(API_ENDPOINTS.SEMINAR.GET_BY_ID(seminarId));
      if (response.data && response.data.feedback) {
        const parsed = parseSeminarQuestions(response.data.feedback);
        if (parsed.length > 0) {
          setCachedSeminarQuestions(seminarId, parsed);
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    const cached = getCachedSeminarQuestions(seminarId);
    if (cached && cached.length > 0) {
      return cached;
    }

    return [...DEFAULT_GENERAL_QUESTIONS];
  },

  /**
   * Submit / edit dynamic feedback answers from a participant (ticket §16).
   *
   * Canonical request body per ticket:
   * ```json
   * { "answers": [
   *     { "questionId": "q-rating", "type": "rating", "rating": 5 },
   *     { "questionId": "q-improve", "type": "text", "text": "..." }
   *   ] }
   * ```
   *
   * The BE normalizes `orderIndex` against the actual form config, ignores
   * any extra fields, and validates that every questionId exists in the
   * seminar's feedback form (ticket §17).
   *
   * Stores in `SeminarParticipants.FeedbackJson` (NVARCHAR(MAX) JSON).
   */
  submitDynamicFeedback: async (
    seminarId: number,
    answers: FeedbackAnswer[],
  ): Promise<unknown> => {
    const payload = { answers };
    // Primary canonical endpoint.
    const response = await api.post(
      API_ENDPOINTS.SEMINAR.FEEDBACK(seminarId),
      payload,
    );
    return response.data;
  },

  /**
   * Owner-only — returns raw participant feedback for the seminar.
   * Returns [] when BE responds 200 with an empty body or no items.
   */
  getFeedbackList: async (
    seminarId: number,
  ): Promise<SeminarFeedbackListResponse> => {
    const response = await api.get<SeminarFeedbackListResponse | null>(
      API_ENDPOINTS.SEMINAR.GET_FEEDBACK(seminarId),
    );
    if (!response.data) return [];
    return Array.isArray(response.data) ? response.data : [];
  },

  /**
   * Owner-only — completion metrics (totalInvited / submitted / pending /
   * declined / completionPercentage). Returns null on failure so callers can
   * render an honest unavailable state.
   */
  getStats: async (seminarId: number): Promise<SeminarStats | null> => {
    try {
      const response = await api.get<SeminarStats>(
        API_ENDPOINTS.SEMINAR.STATS(seminarId),
      );
      return response.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Owner-only — sends feedback reminder to participants who have not yet
   * submitted and have not been reminded.
   */
  sendFeedbackReminders: async (
    seminarId: number,
  ): Promise<SeminarReminderResponse> => {
    const response = await api.post<SeminarReminderResponse>(
      API_ENDPOINTS.SEMINAR.SEND_REMINDERS(seminarId),
    );
    return response.data;
  },

  /**
   * Owner-only — generate (or regenerate) AI feedback summary. The BE
   * overwrites the previous summary on every call (ticket §28-31).
   */
  summarizeFeedback: async (
    seminarId: number,
  ): Promise<SeminarFeedbackAiSummary> => {
    const response = await api.post<SeminarFeedbackAiSummary>(
      API_ENDPOINTS.SEMINAR.SUMMARIZE_FEEDBACK(seminarId),
    );
    return response.data;
  },

  /**
   * Paged owner list of seminars (ticket §8). Returns a `PagedResult`
   * wrapper plus the raw `Seminar[]` is also accessible via
   * `getAll()`. Backed by `GET /api/Seminar/paged`.
   */
  getPaged: async (
    pageNumber: number,
    pageSize: number,
  ): Promise<PagedResult<Seminar>> => {
    const response = await api.get<PagedResult<Seminar>>(
      API_ENDPOINTS.SEMINAR.PAGED,
      { params: { pageNumber, pageSize } },
    );
    if (!response.data) {
      return {
        items: [],
        totalCount: 0,
        pageNumber,
        pageSize,
        totalPages: 0,
        hasPrevious: false,
        hasNext: false,
      };
    }
    return {
      ...response.data,
      items: Array.isArray(response.data.items) ? response.data.items : [],
    };
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
      status:
        row.endTime &&
        (parseApiDateTimeAsUtc(row.endTime)?.getTime() ?? Number.POSITIVE_INFINITY) <
          Date.now()
          ? 'Completed'
          : 'Upcoming',
    }));
  },

  getSuggestedInvitees: async (subFieldId?: number | null): Promise<SuggestedInviteeDto[]> => {
    const response = await api.get<SuggestedInviteeDto[]>(API_ENDPOINTS.SEMINAR.SUGGESTED_INVITEES, {
      params: subFieldId ? { subFieldId } : undefined,
    });
    return Array.isArray(response.data) ? response.data : [];
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
      // NOTE: dynamic FeedbackJson is NOT exposed by `GET /my-seminars`
      // per ticket §20. To prefill edit-flow answers, fetch the full
      // Seminar Detail (`GET /api/Seminar/{id}`) and read the matching
      // participant's `feedbackJson` from there.
      feedbackJson: undefined,
      feedbackSubmittedAt: undefined,
      feedbackUpdatedAt: undefined,
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

  // Parse the BE's `endTime` as UTC. The ASP.NET backend is documented to
  // return ISO 8601 timestamps, but its serializer sometimes strips the
  // `Z` (or `±HH:MM`) suffix when the underlying `DateTime.Kind` is
  // `Unspecified` — e.g. it returns `"2026-09-09T17:50:00"` instead of
  // `"2026-09-09T17:50:00Z"`. Without the `Z`, plain `new Date(...)` is
  // interpreted as the browser's LOCAL time, which causes a freshly-
  // created seminar to be tagged COMPLETED immediately in UTC+7 (and
  // similar) timezones. `parseApiDateTimeAsUtc` re-adds the `Z` when it's
  // missing so the timestamp is unambiguous.
  const endMs = parseApiDateTimeAsUtc(endTime)?.getTime();
  if (endMs == null || Number.isNaN(endMs)) return mapped;

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
 * Google Meet (free account) hard cap on simultaneous participants.
 * Used to render capacity indicators on the seminar list and create form.
 */
export const GOOGLE_MEET_FREE_PARTICIPANT_CAP = 100;

/**
 * Parse the `Seminar.feedback` JSON string (returned by GET /api/Seminar/{id})
 * into a typed AI summary object. Returns null when the value is empty or
 * unparseable — UI must never render raw JSON.
 */
export const parseAiFeedback = (
  value?: string | null,
): SeminarFeedbackAiContent | null => {
  if (!value || typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as Partial<SeminarFeedbackAiContent>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.overallAssessment !== 'string') return null;
    return {
      overallAssessment: parsed.overallAssessment,
      commonStrengths: Array.isArray(parsed.commonStrengths)
        ? parsed.commonStrengths.filter((x): x is string => typeof x === 'string')
        : [],
      areasForImprovement: Array.isArray(parsed.areasForImprovement)
        ? parsed.areasForImprovement.filter((x): x is string => typeof x === 'string')
        : [],
      commonSuggestions: Array.isArray(parsed.commonSuggestions)
        ? parsed.commonSuggestions.filter((x): x is string => typeof x === 'string')
        : [],
      conflictingFeedback: Array.isArray(parsed.conflictingFeedback)
        ? parsed.conflictingFeedback.filter((x): x is string => typeof x === 'string')
        : [],
      recommendedActions: Array.isArray(parsed.recommendedActions)
        ? parsed.recommendedActions.filter((x): x is string => typeof x === 'string')
        : [],
    };
  } catch {
    return null;
  }
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
  /**
   * ISO 8601 end time. Nullable after the BE ships the
   * "Mark as Completed" endpoint — a `null` here means the seminar
   * is still open-ended (see BE_SEMINAR_NULLABLE_ENDTIME.md).
   */
  endTime: string | null;
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
  feedback?: string | null;
  /** Academic subfield the seminar is scoped to (from SeminarCreateRequest.subFieldId). */
  subFieldId?: number | null;
  subFieldName?: string | null;
  /** Joined participant rows. May be null when the BE does not expose them. */
  participants?: SeminarParticipant[] | null;
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
    feedback: s.feedback ?? null,
    subFieldId: s.subFieldId ?? null,
    subFieldName: s.subFieldName ?? null,
    participantCount: 0,
    feedbackSubmitted: 0,
    feedbackTotal: 0,
    participants: null,
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
    participants: seminarParticipants,
  };
};

export default seminarService;
