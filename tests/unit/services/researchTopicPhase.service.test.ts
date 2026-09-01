/**
 * Service-level tests for src/services/researchTopicPhase.service.ts.
 *
 * These cover the backend-only contract:
 *   - getByTopic returns ONLY PhasedReport-derived phases (no demo rows)
 *   - save rejects drafts that exceed the BE 5-phase limit
 *   - save forwards drafts 1..N verbatim to POST /api/PhasedReport/topic-milestones
 *   - validatePhaseDrafts refuses missing titles or overlapping dates
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { setTopicMilestonesMock, getByTopicMock } = vi.hoisted(() => ({
  setTopicMilestonesMock: vi.fn(),
  getByTopicMock: vi.fn(),
}));

vi.mock('../../../src/services/phasedReport.service', () => ({
  phasedReportService: {
    setTopicMilestones: setTopicMilestonesMock,
    getByTopic: getByTopicMock,
  },
}));

import {
  researchTopicPhaseService,
  validatePhaseDrafts,
  MAX_PHASES_PER_TOPIC,
} from '../../../src/services/researchTopicPhase.service';

describe('researchTopicPhaseService — backend-only contract', () => {
  beforeEach(() => {
    setTopicMilestonesMock.mockReset();
    getByTopicMock.mockReset();
  });

  it('returns ONLY PhasedReport-derived rows from getByTopic (no demo rows)', async () => {
    getByTopicMock.mockResolvedValueOnce([
      {
        phasedReportId: 10,
        topicId: 42,
        phaseNumber: 1,
        milestoneTitle: 'Phase 1 — Topic introduction',
        deadlineAt: '2026-12-01T00:00:00Z',
      },
      {
        phasedReportId: 11,
        topicId: 42,
        phaseNumber: 2,
        milestoneTitle: 'Phase 2 — Literature review',
        deadlineAt: '2027-01-15T00:00:00Z',
      },
    ]);
    const phases = await researchTopicPhaseService.getByTopic(42);
    expect(phases).toHaveLength(2);
    for (const phase of phases) {
      expect(phase.source).toBe('api');
      expect(phase.topicId).toBe(42);
    }
    expect(phases.map((p) => p.phaseNumber)).toEqual([1, 2]);
  });

  it('returns an empty array when the BE returns no milestone rows (truthful empty state)', async () => {
    getByTopicMock.mockResolvedValueOnce([]);
    const phases = await researchTopicPhaseService.getByTopic(99);
    expect(phases).toEqual([]);
  });

  it('save forwards each draft as phaseNumber 1..N to the BE endpoint', async () => {
    setTopicMilestonesMock.mockResolvedValueOnce([
      { phasedReportId: 1, topicId: 5, phaseNumber: 1, milestoneTitle: 'A', deadlineAt: '2026-09-01T00:00:00Z' },
      { phasedReportId: 2, topicId: 5, phaseNumber: 2, milestoneTitle: 'B', deadlineAt: '2026-10-01T00:00:00Z' },
    ]);
    await researchTopicPhaseService.save(
      5,
      [
        { title: 'A', requirements: '', assessmentCriteria: '', startAt: '', endAt: '2026-09-01T00:00:00Z' },
        { title: 'B', requirements: '', assessmentCriteria: '', startAt: '', endAt: '2026-10-01T00:00:00Z' },
      ],
      null,
    );
    expect(setTopicMilestonesMock).toHaveBeenCalledTimes(1);
    const payload = setTopicMilestonesMock.mock.calls[0][0];
    expect(payload.topicId).toBe(5);
    expect(payload.phases).toHaveLength(2);
    expect(payload.phases[0]).toMatchObject({ phaseNumber: 1, milestoneTitle: 'A' });
    expect(payload.phases[1]).toMatchObject({ phaseNumber: 2, milestoneTitle: 'B' });
  });

  it('save refuses to write when drafts exceed the BE 5-phase limit', async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      title: `Phase ${i + 1}`,
      requirements: '',
      assessmentCriteria: '',
      startAt: '',
      endAt: '2026-09-01T00:00:00Z',
    }));
    await expect(
      researchTopicPhaseService.save(1, six, null),
    ).rejects.toThrow(/5 phases/);
    expect(setTopicMilestonesMock).not.toHaveBeenCalled();
  });

  it('save reports usedDemo:false so the lecturer page cannot show a fake success path', async () => {
    setTopicMilestonesMock.mockResolvedValueOnce([
      { phasedReportId: 1, topicId: 5, phaseNumber: 1, milestoneTitle: 'A', deadlineAt: '2026-09-01T00:00:00Z' },
    ]);
    const result = await researchTopicPhaseService.save(
      5,
      [{ title: 'A', requirements: '', assessmentCriteria: '', startAt: '', endAt: '2026-09-01T00:00:00Z' }],
      null,
    );
    expect(result.usedDemo).toBe(false);
  });

  it('exposes MAX_PHASES_PER_TOPIC so the page can gate the Add Phase button', () => {
    expect(MAX_PHASES_PER_TOPIC).toBe(5);
  });
});

describe('validatePhaseDrafts', () => {
  it('rejects an empty draft list', () => {
    expect(validatePhaseDrafts([])).toMatch(/at least one phase/);
  });

  it('rejects a draft without a title', () => {
    expect(
      validatePhaseDrafts([
        { title: '   ', requirements: '', assessmentCriteria: '', startAt: '', endAt: '2026-09-01T00:00:00Z' },
      ]),
    ).toMatch(/Enter a title for Phase 1/);
  });

  it('rejects a phase whose end date is before its start date', () => {
    const result = validatePhaseDrafts([
      { title: 'A', requirements: '', assessmentCriteria: '', startAt: '2026-10-01T00:00:00Z', endAt: '2026-09-15T00:00:00Z' },
    ]);
    expect(result).toMatch(/must end after it starts/);
  });

  it('rejects a phase that overlaps a previous one (gaps are allowed)', () => {
    const result = validatePhaseDrafts([
      { title: 'A', requirements: '', assessmentCriteria: '', startAt: '', endAt: '2026-09-30T00:00:00Z' },
      { title: 'B', requirements: '', assessmentCriteria: '', startAt: '2026-09-15T00:00:00Z', endAt: '2026-10-15T00:00:00Z' },
    ]);
    expect(result).toMatch(/overlaps the previous phase/);
  });

  it('accepts a list of 5 well-formed drafts', () => {
    const drafts = Array.from({ length: 5 }, (_, i) => ({
      title: `Phase ${i + 1}`,
      requirements: '',
      assessmentCriteria: '',
      startAt: '',
      endAt: '2026-09-30T00:00:00Z',
    }));
    expect(validatePhaseDrafts(drafts)).toBeNull();
  });
});
