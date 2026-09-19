/**
 * Unit tests for the `getMaterialUsage` helper exported from Materials.tsx.
 *
 * These tests assert the single-authoritative filtering rules:
 *
 *   TC-1 — orphan junction row: a junction row whose `topicId` does NOT resolve
 *           in `topics` must be dropped by BOTH the chip count and the modal
 *           list. Neither the chip nor the dialog must count it.
 *
 *   TC-2 — valid junction row: a junction row whose `topicId` DOES resolve in
 *           `topics` must appear in BOTH the chip count and the modal list.
 *
 *   TC-3 — loading state: while `crossRefLoading` is true the chip must show
 *           "Checking…" (not a count) and the modal must render a skeleton.
 *
 *   TC-4 — error state: when the cross-reference fetch fails (`crossRefError`)
 *           the chip must NOT show "Not used" — it must show "Details unavailable".
 *           The modal must NOT show the "Nothing links" empty state — it must
 *           show an error state with a Retry button.
 *
 * For the modal rendering tests see MaterialUsageModal.unit.test.tsx.
 */
import { describe, it, expect } from 'vitest';
import type { ResearchTopic } from '../../../../src/types/research';
import type { PhasedReport } from '../../../../src/services/phasedReport.service';
import type { LearningMaterial } from '../../../../src/services/learningMaterial.service';
import type { TopicLearningMaterialResponse } from '../../../../src/types/researchWorkflowDtos';
import { getMaterialUsage } from '../../../../src/pages/Lecturer/Materials';

// ── Shared seed data ──────────────────────────────────────────────────────────

const TOPIC_A: ResearchTopic = {
  id: 1,
  title: 'Topic Alpha',
  status: 'OPEN',
};

const TOPIC_B: ResearchTopic = {
  id: 2,
  title: 'Topic Beta',
  status: 'CLOSED',
};

const PHASE_1: PhasedReport = {
  topicId: 1,
  researchGroupId: 10,
  phaseNumber: 1,
  milestoneTitle: 'Phase 1',
  deadlineAt: '2026-12-31T00:00:00Z',
  phasedMaterialsUrl: 'https://example.com/material.pdf',
};

const MATERIAL: LearningMaterial = {
  id: 100,
  title: 'Test Material',
  fileUrl: 'https://example.com/material.pdf',
  lecturerId: 7,
  materialsUrl: 'https://example.com/material.pdf', // explicit so topics without materialsUrl match
};

const MATERIAL_NO_ID: LearningMaterial = {
  title: 'Test Material (no id)',
  fileUrl: 'https://example.com/material.pdf',
  lecturerId: 7,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getMaterialUsage', () => {
  describe('TC-1: orphan junction row (topicId does NOT resolve)', () => {
    /**
     * Junction row points to topicId=99 which does not exist in `topics`.
     * The helper must NOT count it — both the chip and the dialog must agree.
     */
    it('drops junction rows whose topicId is not in the topics collection', () => {
      const orphanJunction: TopicLearningMaterialResponse = {
        topicId: 99,          // ← orphan: no topic in `topics` has this id
        learningMaterialId: 100,
        fileUrl: 'https://example.com/material.pdf',
      };

      const result = getMaterialUsage(MATERIAL, {
        topics: [TOPIC_A, TOPIC_B],
        phases: [PHASE_1],
        topicMaterialJunctions: [orphanJunction],
      });

      expect(result.topics).toHaveLength(0);
      expect(result.phases).toHaveLength(1); // phase still matches by URL
    });

    /**
     * Same orphan row, but material has no numeric id (so fallback by URL is used).
     * The orphan must still be dropped.
     */
    it('drops orphan junction rows even when material has no numeric id', () => {
      const orphanJunction: TopicLearningMaterialResponse = {
        topicId: 99,
        learningMaterialId: undefined,
        fileUrl: 'https://example.com/material.pdf',
      };

      const result = getMaterialUsage(MATERIAL_NO_ID, {
        topics: [TOPIC_A],
        phases: [],
        topicMaterialJunctions: [orphanJunction],
      });

      expect(result.topics).toHaveLength(0);
    });

    /**
     * Mix of orphan + valid rows. Only the valid one must appear.
     */
    it('only counts the valid row when a mix of orphan and valid rows exists', () => {
      const orphanJunction: TopicLearningMaterialResponse = {
        topicId: 999,
        learningMaterialId: 100,
        fileUrl: 'https://example.com/material.pdf',
      };
      const validJunction: TopicLearningMaterialResponse = {
        topicId: 1,            // ← resolves to TOPIC_A
        learningMaterialId: 100,
        fileUrl: 'https://example.com/material.pdf',
      };

      const result = getMaterialUsage(MATERIAL, {
        topics: [TOPIC_A, TOPIC_B],
        phases: [],
        topicMaterialJunctions: [orphanJunction, validJunction],
      });

      expect(result.topics).toHaveLength(1);
      expect(result.topics[0].id).toBe(1);
    });
  });

  describe('TC-2: valid junction row (topicId DOES resolve)', () => {
    /**
     * A junction row whose topicId resolves in `topics` must appear in both
     * the chip count and the modal list.
     */
    it('includes a junction row when its topicId resolves in the topics collection', () => {
      const validJunction: TopicLearningMaterialResponse = {
        topicId: 1,
        learningMaterialId: 100,
        fileUrl: 'https://example.com/material.pdf',
      };

      const result = getMaterialUsage(MATERIAL, {
        topics: [TOPIC_A, TOPIC_B],
        phases: [],
        topicMaterialJunctions: [validJunction],
      });

      expect(result.topics).toHaveLength(1);
      expect(result.topics[0].id).toBe(1);
    });

    /**
     * Dedup: the same topic must not appear twice even if both legacy URL
     * match and junction match would surface it.
     */
    it('dedupes topics — same topic cannot appear twice', () => {
      const topicWithUrl: ResearchTopic = {
        ...TOPIC_A,
        materialsUrl: 'https://example.com/material.pdf', // legacy link
      };
      const junctionRow: TopicLearningMaterialResponse = {
        topicId: 1,            // same topic via junction
        learningMaterialId: 100,
        fileUrl: 'https://example.com/material.pdf',
      };

      const result = getMaterialUsage(MATERIAL, {
        topics: [topicWithUrl],
        phases: [],
        topicMaterialJunctions: [junctionRow],
      });

      expect(result.topics).toHaveLength(1);
    });

    /**
     * When both sides expose numeric IDs, require them to match to avoid
     * counting a row attached to a sibling material sharing the same URL.
     */
    it('requires learningMaterialId match when both sides expose a numeric id', () => {
      const siblingMaterialId = 999;
      const rowForSibling: TopicLearningMaterialResponse = {
        topicId: 1,
        learningMaterialId: siblingMaterialId, // ← different material
        fileUrl: 'https://example.com/material.pdf',
      };

      const result = getMaterialUsage(MATERIAL, {
        topics: [TOPIC_A],
        phases: [],
        topicMaterialJunctions: [rowForSibling],
      });

      expect(result.topics).toHaveLength(0);
    });

    /**
     * Fallback by URL when material has no numeric id: junction rows with
     * matching fileUrl must be included.
     */
    it('falls back to URL-only match when material has no numeric id', () => {
      const junctionRow: TopicLearningMaterialResponse = {
        topicId: 1,
        learningMaterialId: undefined,
        fileUrl: 'https://example.com/material.pdf',
      };

      const result = getMaterialUsage(MATERIAL_NO_ID, {
        topics: [TOPIC_A],
        phases: [],
        topicMaterialJunctions: [junctionRow],
      });

      expect(result.topics).toHaveLength(1);
      expect(result.topics[0].id).toBe(1);
    });

    /**
     * Phase matching by URL must not include the same (topicId, groupId,
     * phaseNumber) tuple twice.
     */
    it('dedupes phases by (topicId, groupId, phaseNumber)', () => {
      const phase1: PhasedReport = {
        ...PHASE_1,
        topicId: 1,
        researchGroupId: 10,
        phaseNumber: 1,
      };
      const phase1Duplicate: PhasedReport = {
        ...PHASE_1,
        topicId: 1,
        researchGroupId: 10,
        phaseNumber: 1,
      };

      const result = getMaterialUsage(MATERIAL, {
        topics: [],
        phases: [phase1, phase1Duplicate],
        topicMaterialJunctions: [],
      });

      expect(result.phases).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('returns empty arrays when material has no fileUrl', () => {
      const result = getMaterialUsage({ ...MATERIAL, fileUrl: '' }, {
        topics: [TOPIC_A],
        phases: [PHASE_1],
        topicMaterialJunctions: [],
      });
      expect(result.topics).toHaveLength(0);
      expect(result.phases).toHaveLength(0);
    });

    it('returns empty arrays when topics and phases are empty', () => {
      const result = getMaterialUsage(MATERIAL, {
        topics: [],
        phases: [],
        topicMaterialJunctions: [],
      });
      expect(result.topics).toHaveLength(0);
      expect(result.phases).toHaveLength(0);
    });

    it('hasOPEN topic status detectable from the returned topics array', () => {
      // The helper returns topics; callers check (t.status ?? '').toUpperCase() === 'OPEN'.
      // We verify the returned topics include the OPEN topic so the caller can
      // derive hasOpenTopic without the helper needing to expose it directly.
      // Topics must have materialsUrl set so they match MATERIAL's URL via the
      // legacy single-URL path.
      const openTopic: ResearchTopic = { ...TOPIC_A, status: 'OPEN', materialsUrl: MATERIAL.fileUrl };
      const closedTopic: ResearchTopic = { ...TOPIC_B, status: 'CLOSED', materialsUrl: MATERIAL.fileUrl };
      const result = getMaterialUsage(MATERIAL, {
        topics: [openTopic, closedTopic],
        phases: [],
        topicMaterialJunctions: [],
      });
      // Both topics match via legacy URL match, so both are returned
      expect(result.topics).toHaveLength(2);
      // Caller can detect OPEN by: (t.status ?? '').toUpperCase() === 'OPEN'
      const openTopicInResult = result.topics.find((t) => (t.status ?? '').toUpperCase() === 'OPEN');
      expect(openTopicInResult).toBeDefined();
      expect(openTopicInResult!.id).toBe(1);
    });

    it('drops junction rows with missing topicId', () => {
      const rowNoTopicId: TopicLearningMaterialResponse = {
        learningMaterialId: 100,
        fileUrl: 'https://example.com/material.pdf',
      };
      const result = getMaterialUsage(MATERIAL, {
        topics: [TOPIC_A],
        phases: [],
        topicMaterialJunctions: [rowNoTopicId],
      });
      expect(result.topics).toHaveLength(0);
    });
  });
});
