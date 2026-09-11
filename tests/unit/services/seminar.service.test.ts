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
import api from '../../../src/services/axios';
import {
  seminarService,
  seminarParticipantService,
  mapSeminarStatus,
  mapParticipantStatus,
  isValidMeetLink,
  mapSeminarToCard,
  mapSeminarToCardWithParticipants,
  deriveEffectiveStatus,
  hasSubmittedFeedback,
  parseAiFeedback,
  SEMINAR_STATUS_OVERRIDES_KEY,
  getSeminarStatusOverrides,
  setSeminarStatusOverride,
  clearSeminarStatusOverride,
  type SeminarCreateRequest,
} from '../../../src/services/seminar.service';

vi.mock('../../../src/services/axios', () => ({
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

  // BTR — INACTIVE / Suspend lifecycle. The owner can flip a seminar
  // from Upcoming to Inactive via the new Suspend button; the mapper
  // must recognise any BE-serialised synonym so future BE renames do
  // not break the FE.
  it('maps "Inactive" / "Suspended" / "Suspend" to INACTIVE (case + whitespace tolerant)', () => {
    expect(mapSeminarStatus('Inactive')).toBe('INACTIVE');
    expect(mapSeminarStatus('inactive')).toBe('INACTIVE');
    expect(mapSeminarStatus('INACTIVE')).toBe('INACTIVE');
    expect(mapSeminarStatus(' Suspended ')).toBe('INACTIVE');
    expect(mapSeminarStatus('Suspended')).toBe('INACTIVE');
    expect(mapSeminarStatus('suspended')).toBe('INACTIVE');
    expect(mapSeminarStatus('Suspend')).toBe('INACTIVE');
    expect(mapSeminarStatus('suspend')).toBe('INACTIVE');
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

  // BTR — INACTIVE lifecycle. An owner-suspended seminar must NEVER
  // auto-promote to COMPLETED just because its endTime has passed —
  // the user explicitly asked to take it offline, so it stays in the
  // Inactive tab.
  it("returns 'INACTIVE' unchanged regardless of endTime (owner-suspended seminars never auto-complete)", () => {
    expect(deriveEffectiveStatus('Inactive', pastEndTime)).toBe('INACTIVE');
    expect(deriveEffectiveStatus('Inactive', futureEndTime)).toBe('INACTIVE');
    expect(deriveEffectiveStatus('Suspended', pastEndTime)).toBe('INACTIVE');
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

// ── Ticket contract — hasSubmittedFeedback & parseAiFeedback (ticket §19, §32)

describe('hasSubmittedFeedback (ticket §19)', () => {
  it('returns false when participant is null or empty', () => {
    expect(hasSubmittedFeedback(null)).toBe(false);
    expect(hasSubmittedFeedback(undefined)).toBe(false);
    expect(hasSubmittedFeedback({})).toBe(false);
  });

  it('returns true when feedbackSubmittedAt is set, even if feedbackJson is missing', () => {
    expect(
      hasSubmittedFeedback({ feedbackSubmittedAt: '2026-09-01T10:00:00Z' }),
    ).toBe(true);
  });

  it('returns true when feedbackJson is a non-empty string', () => {
    expect(
      hasSubmittedFeedback({
        feedbackJson: '[{"questionId":"q1","type":"rating","rating":5}]',
      }),
    ).toBe(true);
  });

  it('returns false when feedbackJson is null or whitespace', () => {
    expect(hasSubmittedFeedback({ feedbackJson: null })).toBe(false);
    expect(hasSubmittedFeedback({ feedbackJson: '' })).toBe(false);
    expect(hasSubmittedFeedback({ feedbackJson: '   ' })).toBe(false);
  });
});

describe('parseAiFeedback (ticket §32)', () => {
  const goodJson = JSON.stringify({
    overallAssessment: 'Overall good.',
    commonStrengths: ['Clear', 'Concise'],
    areasForImprovement: ['Pacing'],
    commonSuggestions: ['Send slides'],
    conflictingFeedback: [],
    recommendedActions: ['Add Q&A'],
  });

  it('returns null for null / empty / invalid JSON', () => {
    expect(parseAiFeedback(null)).toBeNull();
    expect(parseAiFeedback('')).toBeNull();
    expect(parseAiFeedback('not-json')).toBeNull();
    expect(parseAiFeedback('{}')).toBeNull();
  });

  it('returns null when overallAssessment is missing or wrong type', () => {
    expect(parseAiFeedback(JSON.stringify({}))).toBeNull();
    expect(
      parseAiFeedback(JSON.stringify({ overallAssessment: 123 })),
    ).toBeNull();
  });

  it('parses a well-formed AI feedback summary, filtering non-string entries', () => {
    const parsed = parseAiFeedback(
      JSON.stringify({
        overallAssessment: 'Mixed.',
        commonStrengths: ['A', null, 1, 'B'],
        areasForImprovement: ['C'],
        commonSuggestions: [],
        conflictingFeedback: ['Some disagreement'],
        recommendedActions: ['Add slides', 'Longer Q&A'],
      }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.overallAssessment).toBe('Mixed.');
    expect(parsed?.commonStrengths).toEqual(['A', 'B']);
    expect(parsed?.commonSuggestions).toEqual([]);
  });
});

describe('seminarService — ticket canonical endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getPaged calls /api/Seminar/paged with pageNumber/pageSize (ticket §8)', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        items: [mockSeminar],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 10,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
      },
    });
    const page = await seminarService.getPaged(1, 10);
    expect(mockedApi.get).toHaveBeenCalledWith('/api/Seminar/paged', {
      params: { pageNumber: 1, pageSize: 10 },
    });
    expect(page.items).toHaveLength(1);
    expect(page.totalCount).toBe(1);
  });

  it('getPaged returns an empty paged result when BE returns null (ticket §8)', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: null });
    const page = await seminarService.getPaged(2, 25);
    expect(page.items).toEqual([]);
    expect(page.totalCount).toBe(0);
    expect(page.pageNumber).toBe(2);
    expect(page.pageSize).toBe(25);
  });

  it('submitDynamicFeedback sends canonical { answers } only (ticket §16)', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        seminarId: 5,
        seminarParticipantId: 11,
        feedbackSubmittedAt: '2026-09-09T10:00:00Z',
      },
    });
    await seminarService.submitDynamicFeedback(5, [
      {
        questionId: 'q1',
        orderIndex: 0,
        type: 'rating',
        rating: 5,
      },
      {
        questionId: 'q2',
        orderIndex: 1,
        type: 'text',
        text: 'Great session!',
      },
    ]);
    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    expect(mockedApi.post).toHaveBeenCalledWith('/api/Seminar/5/feedback', {
      answers: [
        {
          questionId: 'q1',
          orderIndex: 0,
          type: 'rating',
          rating: 5,
        },
        {
          questionId: 'q2',
          orderIndex: 1,
          type: 'text',
          text: 'Great session!',
        },
      ],
    });
  });

  it('saveFeedbackQuestions sends the array directly via PUT (ticket §14)', async () => {
    mockedApi.put.mockResolvedValueOnce({ data: undefined });
    const questions = [
      { id: 'q1', orderIndex: 0, type: 'rating', questionText: 'Rate', isRequired: true, maxStar: 5 },
    ];
    await seminarService.saveFeedbackQuestions(7, questions);
    expect(mockedApi.put).toHaveBeenCalledWith(
      '/api/Seminar/7/feedback-form',
      [
        { id: 'q1', orderIndex: 0, type: 'rating', questionText: 'Rate', isRequired: true, maxStar: 5 },
      ],
    );
  });
});

// ── BE-SEMINAR-ENDTIME-01 — nullable endTime

describe('SeminarCreateRequest — nullable endTime (BE-SEMINAR-ENDTIME-01)', () => {
  /**
   * The current BE contract requires endTime on POST, but the BE team is
   * shipping a fix (BE-SEMINAR-ENDTIME-01) to make it nullable. The FE
   * types it as `string | null` in anticipation. These tests assert that
   * the create() call passes a payload with `endTime: null` through to
   * axios without throwing a type error and without modifying the payload.
   */
  beforeEach(() => { vi.clearAllMocks(); });

  it('create() accepts a payload with endTime: null (type compile guard)', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { seminarId: 99, startTime: '2026-09-20T02:00:00Z', endTime: null } });
    // This assertion exists to prove the TypeScript type `endTime: string | null`
    // compiles and does not reject a null value at the call site.
    const payload: SeminarCreateRequest = {
      startTime: '2026-09-20T02:00:00Z',
      endTime: null,
      content: 'Test seminar',
    };
    const result = await seminarService.create(payload);
    expect(result.seminarId).toBe(99);
    expect(result.endTime).toBeNull();
    expect(mockedApi.post).toHaveBeenCalledWith('/api/Seminar', {
      startTime: '2026-09-20T02:00:00Z',
      endTime: null,
      content: 'Test seminar',
    });
  });

  it('create() still accepts endTime as a string (backward compat)', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { seminarId: 77, startTime: '2026-09-20T02:00:00Z', endTime: '2026-09-20T03:00:00Z' } });
    const payload: SeminarCreateRequest = {
      startTime: '2026-09-20T02:00:00Z',
      endTime: '2026-09-20T03:00:00Z',
      content: 'Test seminar with end',
    };
    const result = await seminarService.create(payload);
    expect(result.seminarId).toBe(77);
    expect(mockedApi.post).toHaveBeenCalledWith('/api/Seminar', {
      startTime: '2026-09-20T02:00:00Z',
      endTime: '2026-09-20T03:00:00Z',
      content: 'Test seminar with end',
    });
  });
});

describe('deriveEffectiveStatus — null endTime means open-ended (BE-SEMINAR-ENDTIME-01)', () => {
  const NOW = new Date('2026-09-20T12:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns raw status when endTime is null (open-ended seminar)", () => {
    expect(deriveEffectiveStatus('Upcoming', null)).toBe('UPCOMING');
    expect(deriveEffectiveStatus('InProgress', null)).toBe('IN PROGRESS');
    expect(deriveEffectiveStatus('Draft', null)).toBe('DRAFT');
  });

  it("returns COMPLETED when endTime is null but raw status is 'Completed'", () => {
    // Even with null endTime, an already-completed seminar stays completed.
    expect(deriveEffectiveStatus('Completed', null)).toBe('COMPLETED');
  });

  it('does NOT fall back to endTime when endTime is null', () => {
    // Confirms the function short-circuits on null endTime before any time comparison.
    expect(deriveEffectiveStatus('Upcoming', null)).toBe('UPCOMING');
  });
});

describe('Seminar status overrides (localStorage fallback for BE persistence gap)', () => {
  beforeEach(() => {
    window.localStorage.removeItem(SEMINAR_STATUS_OVERRIDES_KEY);
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.localStorage.removeItem(SEMINAR_STATUS_OVERRIDES_KEY);
  });

  it('reads empty overrides initially and allows setting and clearing overrides', () => {
    expect(getSeminarStatusOverrides()).toEqual({});

    setSeminarStatusOverride(47, 'Inactive');
    expect(getSeminarStatusOverrides()).toEqual({ 47: 'Inactive' });

    setSeminarStatusOverride(48, 'Upcoming');
    expect(getSeminarStatusOverrides()).toEqual({ 47: 'Inactive', 48: 'Upcoming' });

    clearSeminarStatusOverride(47);
    expect(getSeminarStatusOverrides()).toEqual({ 48: 'Upcoming' });
  });

  it('setStatus persists override and returns seminar with updated status', async () => {
    mockedApi.put.mockResolvedValueOnce({
      data: { seminarId: 47, status: 'Upcoming', content: 'Demo Seminar' },
    });

    const result = await seminarService.setStatus(47, 'Inactive');

    expect(mockedApi.put).toHaveBeenCalledWith('/api/Seminar/47', { status: 'Inactive' });
    expect(result.status).toBe('Inactive');
    expect(getSeminarStatusOverrides()[47]).toBe('Inactive');
  });

  it('mapSeminarToCard respects status override even when raw status is Upcoming', () => {
    setSeminarStatusOverride(47, 'Inactive');

    const card = mapSeminarToCard({
      seminarId: 47,
      status: 'Upcoming',
      startTime: '2026-09-20T10:00:00Z',
      endTime: '2026-09-20T11:00:00Z',
      content: 'Demo Seminar 47',
    });

    expect(card.status).toBe('INACTIVE');
    expect(card.effectiveStatus).toBe('INACTIVE');
  });

  it('delete clears status override for the seminar', async () => {
    setSeminarStatusOverride(47, 'Inactive');
    expect(getSeminarStatusOverrides()[47]).toBe('Inactive');

    mockedApi.delete.mockResolvedValueOnce({});
    await seminarService.delete(47);

    expect(getSeminarStatusOverrides()[47]).toBeUndefined();
  });
});

