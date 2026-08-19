/**
 * seminar.service.ts tests.
 *
 * Covers:
 *   GET  /api/Seminar, POST /api/Seminar, PUT /api/Seminar/{id}, DELETE /api/Seminar/{id}
 *   GET  /api/SeminarParticipant, POST /api/SeminarParticipant, etc.
 *   mapSeminarStatus(), mapParticipantStatus(), isValidMeetLink()
 *   mapSeminarToCard() (1-arg), mapSeminarToCardWithParticipants() (2-arg)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../../services/axios';
import {
  seminarService,
  seminarParticipantService,
  mapSeminarStatus,
  mapParticipantStatus,
  isValidMeetLink,
  mapSeminarToCard,
  mapSeminarToCardWithParticipants,
  deriveEffectiveStatus,
} from '../../services/seminar.service';

vi.mock('../../services/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

// Minimal raw Seminar row as returned by the BE
const mockSeminar = {
  seminarId: 5,
  organizerId: null,
  content: 'Deep dive into modular backend routing networks.',
  startTime: '2026-09-01T10:00:00Z',
  endTime: '2026-09-01T11:00:00Z',
  onlineLink: null,
  maxParticipants: null,
  isReminderSent: false,
  status: 'Upcoming',
  createdAt: '2026-08-01T00:00:00Z',
};

const mockParticipant = {
  seminarParticipantId: 11,
  seminarId: 5,
  userId: 42,
  invitationStatus: 'Invited',
  participantEvaluation: null,
};

describe('seminarService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getAll', () => {
    it('GET /api/Seminar and returns array', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [mockSeminar] });
      const list = await seminarService.getAll();
      expect(mockedApi.get).toHaveBeenCalledWith('/api/Seminar');
      expect(list).toHaveLength(1);
    });

    it('returns empty array when BE returns null', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: null });
      const list = await seminarService.getAll();
      expect(list).toEqual([]);
    });
  });

  describe('getById', () => {
    it('GET /api/Seminar/{id}', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: mockSeminar });
      const row = await seminarService.getById(5);
      expect(mockedApi.get).toHaveBeenCalledWith('/api/Seminar/5');
      expect(row.seminarId).toBe(5);
    });
  });

  describe('create', () => {
    it('POST /api/Seminar with payload', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: { ...mockSeminar, seminarId: 99 } });
      const payload = { startTime: '2026-09-01T10:00:00Z', endTime: '2026-09-01T11:00:00Z' };
      const created = await seminarService.create(payload);
      expect(mockedApi.post).toHaveBeenCalledWith('/api/Seminar', payload);
      expect(created.seminarId).toBe(99);
    });
  });

  describe('update', () => {
    it('PUT /api/Seminar/{id} with payload', async () => {
      mockedApi.put.mockResolvedValueOnce({ data: { ...mockSeminar, isReminderSent: true } });
      const updated = await seminarService.update(5, { isReminderSent: true });
      expect(mockedApi.put).toHaveBeenCalledWith('/api/Seminar/5', { isReminderSent: true });
      expect(updated.isReminderSent).toBe(true);
    });
  });

  describe('delete', () => {
    it('DELETE /api/Seminar/{id}', async () => {
      mockedApi.delete.mockResolvedValueOnce({ data: undefined });
      await seminarService.delete(5);
      expect(mockedApi.delete).toHaveBeenCalledWith('/api/Seminar/5');
    });
  });
});

describe('seminarParticipantService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getAll', () => {
    it('GET /api/SeminarParticipant', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [mockParticipant] });
      const list = await seminarParticipantService.getAll();
      expect(mockedApi.get).toHaveBeenCalledWith('/api/SeminarParticipant');
      expect(list).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('POST /api/SeminarParticipant', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: mockParticipant });
      await seminarParticipantService.create({ seminarId: 5, userId: 42 });
      expect(mockedApi.post).toHaveBeenCalledWith('/api/SeminarParticipant', { seminarId: 5, userId: 42 });
    });
  });

  describe('update', () => {
    it('PUT /api/SeminarParticipant/{id}', async () => {
      mockedApi.put.mockResolvedValueOnce({ data: { ...mockParticipant, invitationStatus: 'Submitted' } });
      const updated = await seminarParticipantService.update(11, { invitationStatus: 'Submitted' });
      expect(mockedApi.put).toHaveBeenCalledWith('/api/SeminarParticipant/11', { invitationStatus: 'Submitted' });
      expect(updated.invitationStatus).toBe('Submitted');
    });
  });
});

describe('mapSeminarStatus', () => {
  it('maps "Upcoming" (case-insensitive) to UPCOMING', () => {
    expect(mapSeminarStatus('Upcoming')).toBe('UPCOMING');
    expect(mapSeminarStatus('upcoming')).toBe('UPCOMING');
    expect(mapSeminarStatus('UPCOMING')).toBe('UPCOMING');
  });

  it('maps "Completed"/"Complete"/"Done" to COMPLETED', () => {
    expect(mapSeminarStatus('Completed')).toBe('COMPLETED');
    expect(mapSeminarStatus('complete')).toBe('COMPLETED');
    expect(mapSeminarStatus('Done')).toBe('COMPLETED');
  });

  it('maps "InProgress"/"In Progress"/"Live" to IN PROGRESS', () => {
    expect(mapSeminarStatus('InProgress')).toBe('IN PROGRESS');
    expect(mapSeminarStatus('In Progress')).toBe('IN PROGRESS');
    expect(mapSeminarStatus('Live')).toBe('IN PROGRESS');
  });

  it('maps "Draft" to DRAFT', () => {
    expect(mapSeminarStatus('Draft')).toBe('DRAFT');
  });

  it('treats unknown values as UPCOMING', () => {
    expect(mapSeminarStatus('unknown')).toBe('UPCOMING');
    expect(mapSeminarStatus('')).toBe('UPCOMING');
    expect(mapSeminarStatus(null)).toBe('UPCOMING');
    expect(mapSeminarStatus(undefined)).toBe('UPCOMING');
  });
});

describe('mapParticipantStatus', () => {
  it('maps "Submitted"/"Complete" to SUBMITTED', () => {
    expect(mapParticipantStatus('Submitted')).toBe('SUBMITTED');
    expect(mapParticipantStatus('complete')).toBe('SUBMITTED');
  });

  it('maps "Invited"/"Accepted"/"Confirmed" to INVITED', () => {
    expect(mapParticipantStatus('Invited')).toBe('INVITED');
    expect(mapParticipantStatus('accepted')).toBe('INVITED');
  });

  it('maps "Declined"/"Rejected" to DECLINED', () => {
    expect(mapParticipantStatus('Declined')).toBe('DECLINED');
    expect(mapParticipantStatus('rejected')).toBe('DECLINED');
  });

  it('defaults to PENDING for unknown values', () => {
    expect(mapParticipantStatus('anything')).toBe('PENDING');
    expect(mapParticipantStatus('')).toBe('PENDING');
    expect(mapParticipantStatus(null)).toBe('PENDING');
  });
});

describe('isValidMeetLink', () => {
  it('returns true for valid HTTPS Google Meet URLs', () => {
    expect(isValidMeetLink('https://meet.google.com/abc-defg-hij')).toBe(true);
  });

  it('returns false for null/undefined/empty', () => {
    expect(isValidMeetLink(null)).toBe(false);
    expect(isValidMeetLink(undefined)).toBe(false);
    expect(isValidMeetLink('')).toBe(false);
  });

  it('returns false for non-Meet URLs', () => {
    expect(isValidMeetLink('https://zoom.us/j/12345')).toBe(false);
    expect(isValidMeetLink('http://meet.google.com/abc')).toBe(false);
  });
});

describe('mapSeminarToCard (1-arg)', () => {
  it('derives title from content first line', () => {
    const card = mapSeminarToCard({
      ...mockSeminar,
      content: 'Cloud Architecture Patterns\nSession 2: Scalability',
    });
    expect(card.title).toBe('Cloud Architecture Patterns');
  });

  it('falls back to seminarId when no content', () => {
    const card = mapSeminarToCard({ ...mockSeminar, content: null });
    expect(card.title).toBe('Seminar #5');
  });

  it('initializes participant stats to 0', () => {
    const card = mapSeminarToCard(mockSeminar);
    expect(card.participantCount).toBe(0);
    expect(card.feedbackSubmitted).toBe(0);
    expect(card.feedbackTotal).toBe(0);
  });

  it('normalizes status to UPCOMING', () => {
    const card = mapSeminarToCard(mockSeminar);
    expect(card.status).toBe('UPCOMING');
  });

  it('returns null onlineLink as empty string', () => {
    const card = mapSeminarToCard(mockSeminar);
    expect(card.onlineLink).toBe('');
  });
});

describe('mapSeminarToCardWithParticipants (2-arg)', () => {
  it('counts participants for matching seminarId', () => {
    const card = mapSeminarToCardWithParticipants(mockSeminar, [
      { seminarId: 5, userId: 1, invitationStatus: 'Submitted' },
      { seminarId: 5, userId: 2, invitationStatus: 'Invited' },
      { seminarId: 99, userId: 3, invitationStatus: 'Submitted' }, // other seminar
    ]);
    expect(card.participantCount).toBe(2);
    expect(card.feedbackSubmitted).toBe(1);
    expect(card.feedbackTotal).toBe(2);
  });

  it('handles empty participant list', () => {
    const card = mapSeminarToCardWithParticipants(mockSeminar, []);
    expect(card.participantCount).toBe(0);
    expect(card.feedbackSubmitted).toBe(0);
  });
});

describe('deriveEffectiveStatus', () => {
  // Freeze "now" so tests are deterministic regardless of when they run.
  const NOW = new Date('2026-08-19T12:00:00Z').getTime();
  const pastEndTime = '2026-08-01T10:00:00Z';   // endTime is in the past
  const futureEndTime = '2026-09-01T10:00:00Z';  // endTime is in the future

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'COMPLETED' when raw status is 'Upcoming' but endTime is in the past", () => {
    expect(deriveEffectiveStatus('Upcoming', pastEndTime)).toBe('COMPLETED');
  });

  it("returns 'UPCOMING' when raw status is 'Upcoming' and endTime is in the future", () => {
    expect(deriveEffectiveStatus('Upcoming', futureEndTime)).toBe('UPCOMING');
  });

  it("returns 'COMPLETED' when raw status is already 'Completed' (any endTime)", () => {
    expect(deriveEffectiveStatus('Completed', pastEndTime)).toBe('COMPLETED');
    expect(deriveEffectiveStatus('Completed', futureEndTime)).toBe('COMPLETED');
  });

  it("returns 'COMPLETED' when raw status is null/undefined but endTime is in the past", () => {
    expect(deriveEffectiveStatus(null, pastEndTime)).toBe('COMPLETED');
    expect(deriveEffectiveStatus(undefined, pastEndTime)).toBe('COMPLETED');
  });

  it("returns 'DRAFT' unchanged regardless of endTime", () => {
    expect(deriveEffectiveStatus('Draft', pastEndTime)).toBe('DRAFT');
    expect(deriveEffectiveStatus('Draft', futureEndTime)).toBe('DRAFT');
  });

  it("returns 'IN PROGRESS' unchanged when endTime is still in the future", () => {
    expect(deriveEffectiveStatus('InProgress', futureEndTime)).toBe('IN PROGRESS');
  });

  it('falls back to mapped status when endTime is null or invalid', () => {
    expect(deriveEffectiveStatus('Upcoming', null)).toBe('UPCOMING');
    expect(deriveEffectiveStatus('Upcoming', undefined)).toBe('UPCOMING');
    expect(deriveEffectiveStatus('Upcoming', 'not-a-date')).toBe('UPCOMING');
  });
});
