import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

// Mirrors GET /api/Seminar response shape:
// The Swagger spec only declares the GET as "200: OK" with no schema, so we
// model the obvious columns. Fields fall back to null when the BE omits them.
// Real rows are expected to expose at minimum: seminarId, startTime, endTime,
// content, onlineLink, status, organizerId, createdAt, updatedAt.
//
// NOTE — `title` is a FE-only convenience derived from `content`. The BE
// stores the full seminar brief in `content` and does not split out a title.
// If a future BE field is added, prefer it and drop the derivation.
export interface Seminar {
  seminarId: number;
  organizerId?: number | null;
  title: string;
  content?: string | null;
  startTime: string; // ISO date-time
  endTime: string;
  onlineLink?: string | null;
  maxParticipants?: number | null;
  isReminderSent?: boolean | null;
  status?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SeminarCreateRequest {
  organizerId?: number | null;
  startTime: string;
  endTime: string;
  content?: string | null;
  onlineLink?: string | null;
  maxParticipants?: number | null;
  isReminderSent?: boolean | null;
  status?: string | null;
}

export interface SeminarUpdateRequest extends Partial<SeminarCreateRequest> {}

// Per-invitation payload posted to /api/SeminarParticipant once a seminar exists.
export interface SeminarParticipantCreateRequest {
  seminarId?: number | null;
  userId?: number | null;
  invitationStatus?: string | null;
  participantEvaluation?: string | null;
}

export const seminarService = {
  getAll: async (): Promise<Seminar[]> => {
    const response = await api.get<Seminar[]>(API_ENDPOINTS.SEMINAR.GET_ALL);
    return response.data;
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
};

// Convenience for inviting a guest user after the seminar is created.
// The FE currently captures email addresses rather than userIds, so the page
// resolves each email to a userId before calling this. Posting the bare email
// here is a graceful fallback while the BE decides on the contract.
export const seminarParticipantService = {
  create: async (payload: SeminarParticipantCreateRequest): Promise<void> => {
    await api.post(API_ENDPOINTS.SEMINAR_PARTICIPANT.CREATE, payload);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.SEMINAR_PARTICIPANT.DELETE(id));
  },
};

// Map raw Seminar rows into the FE-domain SeminarCard shape.
// The page keeps id/time/avatars local; this helper centralises the shape
// decision so the page stays declarative.
export interface SeminarCard {
  seminarId: number;
  title: string;
  content: string;
  startTime: string;
  endTime: string;
  onlineLink: string;
  status: 'UPCOMING' | 'IN PROGRESS' | 'COMPLETED' | 'DRAFT';
  maxParticipants: number | null;
  isNew?: boolean;
}

// Best-effort mapping from BE status → UI status. The current BE stores the
// status as a free-form string. We normalize to the four cases the UI uses;
// anything unknown is treated as UPCOMING.
export const mapSeminarStatus = (raw: string | null | undefined): SeminarCard['status'] => {
  if (!raw) return 'UPCOMING';
  const v = raw.toLowerCase().trim();
  if (v === 'completed' || v === 'complete' || v === 'done') return 'COMPLETED';
  if (v === 'inprogress' || v === 'in progress' || v === 'in-progress' || v === 'live') {
    return 'IN PROGRESS';
  }
  if (v === 'draft') return 'DRAFT';
  return 'UPCOMING';
};

export const mapSeminarToCard = (s: Seminar): SeminarCard => ({
  seminarId: s.seminarId,
  title: s.title || (s.content ? s.content.split('\n')[0].slice(0, 80) : `Seminar #${s.seminarId}`),
  content: s.content ?? '',
  startTime: s.startTime,
  endTime: s.endTime,
  onlineLink: s.onlineLink ?? '',
  status: mapSeminarStatus(s.status),
  maxParticipants: s.maxParticipants ?? null,
});

export default seminarService;
