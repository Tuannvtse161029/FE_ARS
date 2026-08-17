/**
 * Unit tests for src/utils/researchStatus.ts — transition guard tables
 * mirrored from docs/local-only/research-workflow-contract.md §3.
 *
 * This file is the single source of truth that pages and modals lean on
 * for both UI gating and "is this transition legal?" answers. Any
 * regression here breaks the lecturer review and graduate resubmit flows.
 */
import { describe, it, expect } from 'vitest';
import {
  canTransitionGuidanceProject,
  canTransitionResearchTopic,
  canTransitionPhasedReport,
  normalizePhasedReportStatus,
  normalizeGuidanceProjectStatus,
  normalizeResearchTopicStatus,
} from '../../utils/researchStatus';

describe('researchStatus — transition guards', () => {
  describe('canTransitionGuidanceProject', () => {
    it('allows PROPOSED → ONGOING', () => {
      expect(canTransitionGuidanceProject('PROPOSED', 'ONGOING')).toBe(true);
    });
    it('allows PROPOSED → CANCELLED', () => {
      expect(canTransitionGuidanceProject('PROPOSED', 'CANCELLED')).toBe(true);
    });
    it('forbids PROPOSED → COMPLETED', () => {
      expect(canTransitionGuidanceProject('PROPOSED', 'COMPLETED')).toBe(false);
    });
    it('allows ONGOING → COMPLETED', () => {
      expect(canTransitionGuidanceProject('ONGOING', 'COMPLETED')).toBe(true);
    });
    it('allows ONGOING → CANCELLED', () => {
      expect(canTransitionGuidanceProject('ONGOING', 'CANCELLED')).toBe(true);
    });
    it('forbids COMPLETED → anything (terminal)', () => {
      expect(canTransitionGuidanceProject('COMPLETED', 'ONGOING')).toBe(false);
      expect(canTransitionGuidanceProject('COMPLETED', 'CANCELLED')).toBe(false);
    });
    it('forbids CANCELLED → anything (terminal)', () => {
      expect(canTransitionGuidanceProject('CANCELLED', 'ONGOING')).toBe(false);
      expect(canTransitionGuidanceProject('CANCELLED', 'COMPLETED')).toBe(false);
    });
  });

  describe('canTransitionResearchTopic', () => {
    it('allows OPEN → ASSIGNED', () => {
      expect(canTransitionResearchTopic('OPEN', 'ASSIGNED')).toBe(true);
    });
    it('allows OPEN → CLOSED', () => {
      expect(canTransitionResearchTopic('OPEN', 'CLOSED')).toBe(true);
    });
    it('forbids OPEN → COMPLETED', () => {
      expect(canTransitionResearchTopic('OPEN', 'COMPLETED')).toBe(false);
    });
    it('allows ASSIGNED → COMPLETED', () => {
      expect(canTransitionResearchTopic('ASSIGNED', 'COMPLETED')).toBe(true);
    });
    it('allows ASSIGNED → CLOSED', () => {
      expect(canTransitionResearchTopic('ASSIGNED', 'CLOSED')).toBe(true);
    });
    it('forbids COMPLETED → anything (terminal)', () => {
      expect(canTransitionResearchTopic('COMPLETED', 'OPEN')).toBe(false);
      expect(canTransitionResearchTopic('COMPLETED', 'ASSIGNED')).toBe(false);
    });
    it('forbids CLOSED → anything (terminal)', () => {
      expect(canTransitionResearchTopic('CLOSED', 'OPEN')).toBe(false);
      expect(canTransitionResearchTopic('CLOSED', 'ASSIGNED')).toBe(false);
    });
  });

  describe('canTransitionPhasedReport', () => {
    it('allows WAITING → SUBMITTED', () => {
      expect(canTransitionPhasedReport('WAITING', 'SUBMITTED')).toBe(true);
    });
    it('forbids WAITING → EVALUATED (must go through SUBMITTED first)', () => {
      expect(canTransitionPhasedReport('WAITING', 'EVALUATED')).toBe(false);
    });
    it('allows SUBMITTED → EVALUATED', () => {
      expect(canTransitionPhasedReport('SUBMITTED', 'EVALUATED')).toBe(true);
    });
    it('allows SUBMITTED → REJECTED', () => {
      expect(canTransitionPhasedReport('SUBMITTED', 'REJECTED')).toBe(true);
    });
    it('forbids EVALUATED → anything (terminal)', () => {
      expect(canTransitionPhasedReport('EVALUATED', 'REJECTED')).toBe(false);
      expect(canTransitionPhasedReport('EVALUATED', 'SUBMITTED')).toBe(false);
    });
    it('allows REJECTED → SUBMITTED (resubmit path)', () => {
      expect(canTransitionPhasedReport('REJECTED', 'SUBMITTED')).toBe(true);
    });
    it('forbids REJECTED → EVALUATED (skip-submitted is illegal)', () => {
      expect(canTransitionPhasedReport('REJECTED', 'EVALUATED')).toBe(false);
    });
  });
});

describe('researchStatus — defensive normalizers', () => {
  describe('normalizePhasedReportStatus', () => {
    it('returns WAITING for null / undefined / empty', () => {
      expect(normalizePhasedReportStatus(null)).toBe('WAITING');
      expect(normalizePhasedReportStatus(undefined)).toBe('WAITING');
      expect(normalizePhasedReportStatus('')).toBe('WAITING');
    });
    it('passes through canonical WAITING', () => {
      expect(normalizePhasedReportStatus('WAITING')).toBe('WAITING');
    });
    it('passes through canonical SUBMITTED', () => {
      expect(normalizePhasedReportStatus('SUBMITTED')).toBe('SUBMITTED');
    });
    it('maps APPROVED / REVIEWED → EVALUATED', () => {
      expect(normalizePhasedReportStatus('APPROVED')).toBe('EVALUATED');
      expect(normalizePhasedReportStatus('REVIEWED')).toBe('EVALUATED');
    });
    it('maps REJECTED → REJECTED', () => {
      expect(normalizePhasedReportStatus('REJECTED')).toBe('REJECTED');
    });
    it('maps unknown to WAITING (safe default)', () => {
      expect(normalizePhasedReportStatus('something-new')).toBe('WAITING');
    });
    it('handles mixed case + whitespace', () => {
      expect(normalizePhasedReportStatus('  submitted  ')).toBe('SUBMITTED');
    });
  });

  describe('normalizeGuidanceProjectStatus', () => {
    it('returns PROPOSED for null / undefined / empty', () => {
      expect(normalizeGuidanceProjectStatus(null)).toBe('PROPOSED');
      expect(normalizeGuidanceProjectStatus(undefined)).toBe('PROPOSED');
    });
    it('maps DONE → COMPLETED', () => {
      expect(normalizeGuidanceProjectStatus('DONE')).toBe('COMPLETED');
    });
    it('maps CANCELED (one L) → CANCELLED', () => {
      expect(normalizeGuidanceProjectStatus('CANCELED')).toBe('CANCELLED');
    });
    it('passes through canonical CANCELLED', () => {
      expect(normalizeGuidanceProjectStatus('CANCELLED')).toBe('CANCELLED');
    });
    it('maps unknown to PROPOSED', () => {
      expect(normalizeGuidanceProjectStatus('what-is-this')).toBe('PROPOSED');
    });
  });

  describe('normalizeResearchTopicStatus', () => {
    it('returns OPEN for null / undefined / empty', () => {
      expect(normalizeResearchTopicStatus(null)).toBe('OPEN');
      expect(normalizeResearchTopicStatus(undefined)).toBe('OPEN');
    });
    it('maps DONE → COMPLETED', () => {
      expect(normalizeResearchTopicStatus('DONE')).toBe('COMPLETED');
    });
    it('passes through CLOSED', () => {
      expect(normalizeResearchTopicStatus('CLOSED')).toBe('CLOSED');
    });
    it('maps unknown to OPEN', () => {
      expect(normalizeResearchTopicStatus('???')).toBe('OPEN');
    });
  });
});