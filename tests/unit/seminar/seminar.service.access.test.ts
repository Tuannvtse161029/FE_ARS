/**
 * Focused tests for the additive role-aware seminar access predicates.
 *
 * Scope (agent-researcher-seminar-access):
 *   - src/services/seminar.service.ts :: canMutateSeminar / canViewSeminar /
 *     ownsSeminar / filterSeminarsForViewer
 *
 * These tests pin the FE-side authorization shape so a future refactor that
 * widens the role allow list cannot silently grant Lecturer-only writes to
 * other roles. They DO NOT exercise the BE — the BE is the authority and
 * the existing /api/Seminar endpoints are documented in
 * PUBLICATION_FLOW_API_BLOCKERS.md §3.8.
 */
import { describe, it, expect } from 'vitest';
import {
  SEMINAR_MUTATOR_ROLES,
  SEMINAR_VIEWER_ROLES,
  canMutateSeminar,
  canViewSeminar,
  ownsSeminar,
  filterSeminarsForViewer,
  type Seminar,
  type SeminarParticipant,
} from '../../../src/services/seminar.service';

const baseSeminar: Seminar = {
  seminarId: 1,
  organizerId: 42,
  content: 'Cloud Routing Architectures',
  startTime: '2026-09-01T10:00:00Z',
  endTime: '2026-09-01T11:00:00Z',
  onlineLink: null,
  status: 'Upcoming',
};

const baseParticipant: SeminarParticipant = {
  seminarParticipantId: 11,
  seminarId: 1,
  userId: 42,
  invitationStatus: 'Invited',
};

describe('SEMINAR_MUTATOR_ROLES / SEMINAR_VIEWER_ROLES', () => {
  it('includes only Lecturer as a mutator', () => {
    expect(SEMINAR_MUTATOR_ROLES).toEqual(['Lecturer']);
  });

  it('includes Lecturer, Graduate Student, Researcher and Reviewer as viewers', () => {
    expect(SEMINAR_VIEWER_ROLES).toEqual([
      'Lecturer',
      'Graduate Student',
      'Researcher',
      'Reviewer',
    ]);
  });

  it('does NOT include Admin in either role set (Admin does not own seminars)', () => {
    expect(SEMINAR_MUTATOR_ROLES).not.toContain('Admin');
    expect(SEMINAR_VIEWER_ROLES).not.toContain('Admin');
  });
});

describe('canMutateSeminar', () => {
  it('returns true for Lecturer', () => {
    expect(canMutateSeminar('Lecturer')).toBe(true);
  });

  it('returns false for every non-Lecturer role', () => {
    expect(canMutateSeminar('Researcher')).toBe(false);
    expect(canMutateSeminar('Reviewer')).toBe(false);
    expect(canMutateSeminar('Graduate Student')).toBe(false);
    expect(canMutateSeminar('Admin')).toBe(false);
  });

  it('returns false for null / undefined / empty / unknown roles', () => {
    expect(canMutateSeminar(null)).toBe(false);
    expect(canMutateSeminar(undefined)).toBe(false);
    expect(canMutateSeminar('')).toBe(false);
    expect(canMutateSeminar('Guest')).toBe(false);
    expect(canMutateSeminar('SuperUser')).toBe(false);
  });
});

describe('canViewSeminar', () => {
  it('returns true for Lecturer', () => {
    expect(canViewSeminar('Lecturer')).toBe(true);
  });

  it('returns true for Graduate Student, Researcher, and Reviewer', () => {
    expect(canViewSeminar('Graduate Student')).toBe(true);
    expect(canViewSeminar('Researcher')).toBe(true);
    expect(canViewSeminar('Reviewer')).toBe(true);
  });

  it('returns false for Admin and Guest', () => {
    expect(canViewSeminar('Admin')).toBe(false);
    expect(canViewSeminar('Guest')).toBe(false);
    expect(canViewSeminar(null)).toBe(false);
    expect(canViewSeminar(undefined)).toBe(false);
    expect(canViewSeminar('')).toBe(false);
  });
});

describe('ownsSeminar', () => {
  it('returns true when the Lecturer userId matches the organizerId', () => {
    expect(ownsSeminar(baseSeminar, 42, 'Lecturer')).toBe(true);
  });

  it('returns false when the Lecturer userId does NOT match the organizerId', () => {
    expect(ownsSeminar(baseSeminar, 99, 'Lecturer')).toBe(false);
  });

  it('returns false for any non-Lecturer role even when the userId matches', () => {
    expect(ownsSeminar(baseSeminar, 42, 'Researcher')).toBe(false);
    expect(ownsSeminar(baseSeminar, 42, 'Reviewer')).toBe(false);
    expect(ownsSeminar(baseSeminar, 42, 'Graduate Student')).toBe(false);
    expect(ownsSeminar(baseSeminar, 42, 'Admin')).toBe(false);
  });

  it('returns false when organizerId is null (BE has not populated it yet)', () => {
    expect(ownsSeminar({ ...baseSeminar, organizerId: null }, 42, 'Lecturer')).toBe(false);
  });

  it('returns false when currentUserId is null (pre-auth or Guest)', () => {
    expect(ownsSeminar(baseSeminar, null, 'Lecturer')).toBe(false);
    expect(ownsSeminar(baseSeminar, undefined, 'Lecturer')).toBe(false);
  });
});

describe('filterSeminarsForViewer', () => {
  const seminars: Seminar[] = [
    { ...baseSeminar, seminarId: 1, organizerId: 42 },
    { ...baseSeminar, seminarId: 2, organizerId: 99 },
    { ...baseSeminar, seminarId: 3, organizerId: 42 },
  ];

  const participants: SeminarParticipant[] = [
    { seminarParticipantId: 1, seminarId: 1, userId: 7, invitationStatus: 'Invited' },
    { seminarParticipantId: 2, seminarId: 3, userId: 7, invitationStatus: 'Invited' },
    { seminarParticipantId: 3, seminarId: 2, userId: 99, invitationStatus: 'Invited' },
  ];

  it('returns the full list unchanged for a Lecturer', () => {
    const filtered = filterSeminarsForViewer(seminars, participants, 42, 'Lecturer');
    expect(filtered).toEqual(seminars);
  });

  it('returns only seminars where the user is a participant for Researcher / Reviewer', () => {
    const filteredResearcher = filterSeminarsForViewer(seminars, participants, 7, 'Researcher');
    expect(filteredResearcher.map((s) => s.seminarId).sort()).toEqual([1, 3]);

    const filteredReviewer = filterSeminarsForViewer(seminars, participants, 7, 'Reviewer');
    expect(filteredReviewer.map((s) => s.seminarId).sort()).toEqual([1, 3]);

    const filteredGrad = filterSeminarsForViewer(seminars, participants, 7, 'Graduate Student');
    expect(filteredGrad.map((s) => s.seminarId).sort()).toEqual([1, 3]);
  });

  it('returns an empty list when the current user has no participant rows', () => {
    const filtered = filterSeminarsForViewer(seminars, participants, 12345, 'Researcher');
    expect(filtered).toEqual([]);
  });

  it('returns an empty list for disallowed roles (Admin / Guest)', () => {
    expect(filterSeminarsForViewer(seminars, participants, 42, 'Admin')).toEqual([]);
    expect(filterSeminarsForViewer(seminars, participants, 42, null)).toEqual([]);
    expect(filterSeminarsForViewer(seminars, participants, 42, undefined)).toEqual([]);
  });

  it('returns an empty list when currentUserId is null/undefined (no identity to filter by)', () => {
    expect(filterSeminarsForViewer(seminars, participants, null, 'Researcher')).toEqual([]);
    expect(filterSeminarsForViewer(seminars, participants, undefined, 'Reviewer')).toEqual([]);
  });

  it('does not mutate the input arrays', () => {
    const seminarsCopy = seminars.slice();
    const participantsCopy = participants.slice();
    filterSeminarsForViewer(seminarsCopy, participantsCopy, 7, 'Researcher');
    expect(seminarsCopy).toEqual(seminars);
    expect(participantsCopy).toEqual(participants);
  });

  it('ignores participant rows with a null userId or seminarId', () => {
    const noisyParticipants: SeminarParticipant[] = [
      ...participants,
      { seminarParticipantId: 90, seminarId: 1, userId: null, invitationStatus: 'Invited' },
      { seminarParticipantId: 91, seminarId: null, userId: 7, invitationStatus: 'Invited' },
    ];
    const filtered = filterSeminarsForViewer(seminars, noisyParticipants, 7, 'Researcher');
    expect(filtered.map((s) => s.seminarId).sort()).toEqual([1, 3]);
  });

  it('excludes other baseParticipant fixture rows but keeps the shape compatible', () => {
    // baseParticipant (seminarId=1, userId=42) is a different user from
    // userId=7. Confirm filter does not return seminar 1 because of a
    // cross-pollination between the fixtures.
    const filtered = filterSeminarsForViewer(seminars, [baseParticipant], 7, 'Researcher');
    expect(filtered).toEqual([]);
  });
});