/**
 * Tests for src/utils/phaseMaterials.ts — the helper that derives the
 * materials a Research Group's student workspace should display.
 *
 * Bug fixed by this module (Sep 2026): the Research Group workspace used
 * to call `useLearningMaterials({ lecturerId })` and return ALL materials
 * the lecturer had in their global library, regardless of whether any of
 * them were attached to the group's phase milestones. The correct BE
 * contract is `PhasedReport.phasedMaterialsUrl` — a per-phase URL the
 * lecturer sets via the "Manage phase" editor.
 *
 * These tests pin the new extraction so the regression cannot sneak
 * back in: rows without `phasedMaterialsUrl` must be DROPPED, not shown
 * from the global library as a fallback.
 */
import { describe, it, expect } from 'vitest';
import { derivePhaseMaterialsForGroup } from '../../../src/utils/phaseMaterials';
import type { SubmittedPhasedReport } from '../../../src/services/phasedReport.service';

const NOW = new Date('2026-09-16T12:00:00Z');

const makeReport = (
  overrides: Partial<SubmittedPhasedReport>,
): SubmittedPhasedReport => ({
  id: 1,
  researchGroupId: 7,
  status: 'PENDING' as SubmittedPhasedReport['status'],
  ...overrides,
});

describe('derivePhaseMaterialsForGroup', () => {
  it('returns [] for an empty report list (the Alex bug case: no attachments)', () => {
    const out = derivePhaseMaterialsForGroup([]);
    expect(out).toEqual([]);
  });

  it('drops rows that have no phasedMaterialsUrl (the workflow contract)', () => {
    const reports: SubmittedPhasedReport[] = [
      makeReport({
        id: 11,
        phaseNumber: 1,
        milestoneTitle: 'Literature review',
        phasedMaterialsUrl: null,
      }),
      makeReport({
        id: 12,
        phaseNumber: 2,
        milestoneTitle: 'Methodology',
        // explicitly undefined
        phasedMaterialsUrl: undefined,
      }),
    ];
    const out = derivePhaseMaterialsForGroup(reports);
    expect(out).toEqual([]);
  });

  it('drops rows that have an empty/whitespace phasedMaterialsUrl', () => {
    const reports: SubmittedPhasedReport[] = [
      makeReport({
        id: 11,
        phaseNumber: 1,
        milestoneTitle: 'Phase 1',
        phasedMaterialsUrl: '   ',
      }),
      makeReport({
        id: 12,
        phaseNumber: 2,
        milestoneTitle: 'Phase 2',
        phasedMaterialsUrl: '',
      }),
    ];
    const out = derivePhaseMaterialsForGroup(reports);
    expect(out).toEqual([]);
  });

  it('drops rows that have no phaseNumber (cannot be ordered)', () => {
    const reports: SubmittedPhasedReport[] = [
      makeReport({
        id: 11,
        // phaseNumber missing
        milestoneTitle: 'No number',
        phasedMaterialsUrl: 'https://example.com/file.pdf',
      }),
    ];
    const out = derivePhaseMaterialsForGroup(reports);
    expect(out).toEqual([]);
  });

  it('returns one entry per attached phase, ordered ascending by phaseNumber', () => {
    const reports: SubmittedPhasedReport[] = [
      makeReport({
        id: 30,
        phaseNumber: 3,
        milestoneTitle: 'Phase 3',
        phasedMaterialsUrl: 'https://example.com/phase-3.pdf',
      }),
      makeReport({
        id: 10,
        phaseNumber: 1,
        milestoneTitle: 'Phase 1',
        phasedMaterialsUrl: 'https://example.com/phase-1.pdf',
      }),
      makeReport({
        id: 20,
        phaseNumber: 2,
        milestoneTitle: 'Phase 2',
        phasedMaterialsUrl: 'https://example.com/phase-2.pdf',
      }),
    ];
    const out = derivePhaseMaterialsForGroup(reports);
    expect(out).toHaveLength(3);
    expect(out.map((m) => m.phaseNumber)).toEqual([1, 2, 3]);
    expect(out.map((m) => m.materialUrl)).toEqual([
      'https://example.com/phase-1.pdf',
      'https://example.com/phase-2.pdf',
      'https://example.com/phase-3.pdf',
    ]);
    expect(out.map((m) => m.phasedReportId)).toEqual([10, 20, 30]);
  });

  it('uses "Untitled phase" when the milestoneTitle is missing/blank', () => {
    const reports: SubmittedPhasedReport[] = [
      makeReport({
        id: 11,
        phaseNumber: 1,
        milestoneTitle: '',
        phasedMaterialsUrl: 'https://example.com/p1.pdf',
      }),
      makeReport({
        id: 12,
        phaseNumber: 2,
        milestoneTitle: '   ',
        phasedMaterialsUrl: 'https://example.com/p2.pdf',
      }),
    ];
    const out = derivePhaseMaterialsForGroup(reports);
    expect(out[0].milestoneTitle).toBe('Untitled phase');
    expect(out[1].milestoneTitle).toBe('Untitled phase');
  });

  it('trims whitespace from the URL before exposing it', () => {
    const reports: SubmittedPhasedReport[] = [
      makeReport({
        id: 11,
        phaseNumber: 1,
        milestoneTitle: 'Phase 1',
        phasedMaterialsUrl: '  https://example.com/file.pdf  ',
      }),
    ];
    const out = derivePhaseMaterialsForGroup(reports);
    expect(out).toHaveLength(1);
    expect(out[0].materialUrl).toBe('https://example.com/file.pdf');
  });

  it('mixed list: only attached rows surface, in phase order', () => {
    const reports: SubmittedPhasedReport[] = [
      // Attached — keep
      makeReport({
        id: 10,
        phaseNumber: 1,
        milestoneTitle: 'Phase 1',
        phasedMaterialsUrl: 'https://example.com/p1.pdf',
      }),
      // NOT attached — drop (this is the bug case: without a URL,
      // the row must NOT be replaced with a global library material)
      makeReport({
        id: 20,
        phaseNumber: 2,
        milestoneTitle: 'Phase 2',
        phasedMaterialsUrl: null,
      }),
      // Attached — keep
      makeReport({
        id: 30,
        phaseNumber: 3,
        milestoneTitle: 'Phase 3',
        phasedMaterialsUrl: 'https://example.com/p3.pdf',
      }),
    ];
    const out = derivePhaseMaterialsForGroup(reports);
    expect(out).toHaveLength(2);
    expect(out.map((m) => m.phasedReportId)).toEqual([10, 30]);
    expect(out.map((m) => m.phaseNumber)).toEqual([1, 3]);
  });

  it('keeps multiple attachments for the same phaseNumber (forward-compatible)', () => {
    const reports: SubmittedPhasedReport[] = [
      makeReport({
        id: 11,
        phaseNumber: 1,
        milestoneTitle: 'Phase 1',
        phasedMaterialsUrl: 'https://example.com/p1a.pdf',
      }),
      makeReport({
        id: 12,
        phaseNumber: 1,
        milestoneTitle: 'Phase 1',
        phasedMaterialsUrl: 'https://example.com/p1b.pdf',
      }),
    ];
    const out = derivePhaseMaterialsForGroup(reports);
    expect(out).toHaveLength(2);
    expect(out.map((m) => m.materialUrl)).toEqual([
      'https://example.com/p1a.pdf',
      'https://example.com/p1b.pdf',
    ]);
  });

  it('does not mutate the input array', () => {
    const reports: SubmittedPhasedReport[] = [
      makeReport({
        id: 30,
        phaseNumber: 3,
        milestoneTitle: 'Phase 3',
        phasedMaterialsUrl: 'https://example.com/p3.pdf',
      }),
      makeReport({
        id: 10,
        phaseNumber: 1,
        milestoneTitle: 'Phase 1',
        phasedMaterialsUrl: 'https://example.com/p1.pdf',
      }),
    ];
    const before = [...reports];
    derivePhaseMaterialsForGroup(reports);
    expect(reports).toEqual(before);
  });

  it('does NOT include unrelated fields from SubmittedPhasedReport (no leak)', () => {
    const reports: SubmittedPhasedReport[] = [
      makeReport({
        id: 11,
        phaseNumber: 1,
        milestoneTitle: 'Phase 1',
        phasedMaterialsUrl: 'https://example.com/p1.pdf',
        // These fields must not leak into the entry shape — the consumer
        // only needs (phaseNumber, milestoneTitle, materialUrl, phasedReportId).
        reportFileUrl: 'https://example.com/different-submission.pdf',
        capacityEvaluation: '...should-not-leak...',
        lectureFeedback: 9.5,
        submittedAt: NOW.toISOString(),
      }),
    ];
    const out = derivePhaseMaterialsForGroup(reports);
    expect(out[0]).toEqual({
      phaseNumber: 1,
      milestoneTitle: 'Phase 1',
      materialUrl: 'https://example.com/p1.pdf',
      phasedReportId: 11,
    });
  });
});
