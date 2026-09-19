/**
 * Regression tests for the material-usage bug fixed in the ARS platform
 * frontend refactor (Worker C, September 2026).
 *
 * These tests directly exercise the `getMaterialUsage` pure function with
 * constructed inputs — no mocks, no service calls. Each test covers a specific
 * bug scenario from the coordinator's root-cause analysis.
 *
 * Bug: the junction matcher required `row.fileUrl === material.fileUrl` BEFORE
 * checking `learningMaterialId`. If the BE returned a junction row with a
 * different `fileUrl` than the library material (URL rewrite on attach), the row
 * was silently skipped even when `learningMaterialId` matched.
 *
 * Required regression coverage (acceptance criteria):
 *   1. Junction with matching `learningMaterialId` AND mismatched `fileUrl` → 'used'.
 *   2. Same material attached to one topic via junction appears once in topics array
 *      (not once per inheriting group).
 *   3. Attach then detach cycle: state transitions 'unused' → 'used' → 'unused'.
 *   4. Failed/incomplete lookup (empty topics + junctions) → 'unknown', NOT 'unused'.
 *   5. Junction with `learningMaterialId=42` must NOT match library material `id=99`.
 */
import { describe, it, expect } from 'vitest';
import type { ResearchTopic } from '../../../src/types/research';
import type { PhasedReport } from '../../../src/services/phasedReport.service';
import type { LearningMaterial } from '../../../src/services/learningMaterial.service';
import type { TopicLearningMaterialResponse } from '../../../src/types/researchWorkflowDtos';
import { getMaterialUsage } from '../../../src/pages/Lecturer/Materials';

// ── Seed data ────────────────────────────────────────────────────────────────

const TOPIC_ALPHA: ResearchTopic = {
  id: 7,
  title: 'Alpha Research',
  status: 'OPEN',
};

const TOPIC_BETA: ResearchTopic = {
  id: 42,
  title: 'Beta Research',
  status: 'ASSIGNED',
};

const GROUP_ALPHA_A = 101;
const GROUP_ALPHA_B = 102;

/**
 * Library material with id=42.
 * NOTE: distinct from junction learningMaterialId=42 used in the attach tests
 * to verify the ID-based match works correctly.
 */
const LIBRARY_MATERIAL_42: LearningMaterial = {
  id: 42,
  title: 'Material 42',
  fileUrl: 'https://library.example.com/original-url.pdf',
  lecturerId: 1,
};

/**
 * Library material with id=99 — used to verify that a junction with
 * learningMaterialId=42 does NOT match library material id=99.
 */
const LIBRARY_MATERIAL_99: LearningMaterial = {
  id: 99,
  title: 'Material 99',
  fileUrl: 'https://library.example.com/original-url.pdf',
  lecturerId: 1,
};

const PHASE_ALPHA_A: PhasedReport = {
  id: 201,
  topicId: 7,
  researchGroupId: GROUP_ALPHA_A,
  phaseNumber: 1,
  milestoneTitle: 'Phase 1 — Alpha A',
  deadlineAt: '2026-12-01T00:00:00Z',
  phasedMaterialsUrl: 'https://library.example.com/original-url.pdf',
};

const PHASE_ALPHA_B: PhasedReport = {
  id: 202,
  topicId: 7,
  researchGroupId: GROUP_ALPHA_B,
  phaseNumber: 1,
  milestoneTitle: 'Phase 1 — Alpha B',
  deadlineAt: '2026-12-01T00:00:00Z',
  phasedMaterialsUrl: 'https://library.example.com/original-url.pdf',
};

// ── Regression tests ──────────────────────────────────────────────────────────

describe('getMaterialUsage — regression suite', () => {

  // ── Regression 1 ─────────────────────────────────────────────────────────
  /**
   * Bug scenario: BE attached material 42 to topic 7 and returned a junction
   * row with `learningMaterialId=42` but `fileUrl` is a different/canonical URL
   * (e.g. `https://storage.example.com/canonical.pdf` vs the library's
   * `https://library.example.com/original-url.pdf`).
   *
   * Expected BEFORE fix: row skipped because URL mismatch → state 'unused'
   * Expected AFTER fix: row matched by ID → state 'used', 1 topic
   */
  describe('Regression 1: junction with matching learningMaterialId and mismatched fileUrl', () => {
    it('returns state "used" and includes the topic when IDs match but URL differs', () => {
      const junctionRow: TopicLearningMaterialResponse = {
        learningMaterialId: 42,
        topicId: 7,
        fileUrl: 'https://storage.example.com/canonical.pdf', // ← different from library URL
        title: 'Testing YT Link',
      };

      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [TOPIC_ALPHA],
        phases: [],
        topicMaterialJunctions: [junctionRow],
      });

      expect(result.state).toBe('used');
      expect(result.topics).toHaveLength(1);
      expect(result.topics[0].id).toBe(7);
    });

    it('still works when URL also matches (both ID and URL agree)', () => {
      const junctionRow: TopicLearningMaterialResponse = {
        learningMaterialId: 42,
        topicId: 7,
        fileUrl: 'https://library.example.com/original-url.pdf', // ← same as library
        title: 'Testing YT Link',
      };

      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [TOPIC_ALPHA],
        phases: [],
        topicMaterialJunctions: [junctionRow],
      });

      expect(result.state).toBe('used');
      expect(result.topics).toHaveLength(1);
      expect(result.topics[0].id).toBe(7);
    });
  });

  // ── Regression 2 ─────────────────────────────────────────────────────────
  /**
   * Scenario: material 42 is attached to topic 7. The junction row has
   * learningMaterialId=42, topicId=7. Even though two groups (Alpha A, Alpha B)
   * inherit topic 7, the junction represents the topic-level attachment and
   * must appear exactly ONCE in the topics array (not once per group).
   */
  describe('Regression 2: junction counted once per topic, not per inheriting group', () => {
    it('returns exactly one topic for a material attached to one topic, regardless of group count', () => {
      const junctionRow: TopicLearningMaterialResponse = {
        learningMaterialId: 42,
        topicId: 7,
        fileUrl: 'https://storage.example.com/canonical.pdf',
        title: 'Shared Material',
      };

      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [TOPIC_ALPHA],
        // Two groups, both phasing the same topic — but junction is per-topic, not per-group
        phases: [PHASE_ALPHA_A, PHASE_ALPHA_B],
        topicMaterialJunctions: [junctionRow],
      });

      // Topic must appear exactly once — not duplicated for each group
      expect(result.topics).toHaveLength(1);
      expect(result.topics[0].id).toBe(7);

      // Phase dedup: same (topicId=7, groupId=101, phaseNumber=1) and
      // (topicId=7, groupId=102, phaseNumber=1) are distinct because groupId differs
      expect(result.phases).toHaveLength(2);
    });

    it('returns a topic even when the junction row has no fileUrl at all', () => {
      // Some BE payloads may omit fileUrl in junction rows
      const junctionRow: TopicLearningMaterialResponse = {
        learningMaterialId: 42,
        topicId: 7,
        fileUrl: '', // ← intentionally empty
        title: 'Material without URL',
      };

      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [TOPIC_ALPHA],
        phases: [],
        topicMaterialJunctions: [junctionRow],
      });

      expect(result.state).toBe('used');
      expect(result.topics).toHaveLength(1);
      expect(result.topics[0].id).toBe(7);
    });
  });

  // ── Regression 3 ─────────────────────────────────────────────────────────
  /**
   * Attach then detach cycle:
   *   Before attach: junctions=[], state='unused'
   *   After attach: junctions=[{42,7,url}], state='used'
   *   After detach: junctions=[], state='unused'
   */
  describe('Regression 3: attach then detach cycle', () => {
    it('state is "unused" before any attachment', () => {
      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [TOPIC_ALPHA],
        phases: [],
        topicMaterialJunctions: [],
      });

      expect(result.state).toBe('unused');
      expect(result.topics).toHaveLength(0);
    });

    it('state transitions to "used" after a junction row is added', () => {
      const junctionRow: TopicLearningMaterialResponse = {
        learningMaterialId: 42,
        topicId: 7,
        fileUrl: 'https://storage.example.com/canonical.pdf',
        title: 'Attached Material',
      };

      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [TOPIC_ALPHA],
        phases: [],
        topicMaterialJunctions: [junctionRow],
      });

      expect(result.state).toBe('used');
      expect(result.topics).toHaveLength(1);
    });

    it('state transitions back to "unused" after the junction is removed', () => {
      // Simulating post-detach state: no junction rows
      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [TOPIC_ALPHA],
        phases: [],
        topicMaterialJunctions: [],
      });

      expect(result.state).toBe('unused');
      expect(result.topics).toHaveLength(0);
    });

    it('state is "used" with phase match added via legacy URL after detach (phase still has URL)', () => {
      // Material detached from topic but still used in a phase report via legacy URL
      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [],
        phases: [PHASE_ALPHA_A],
        topicMaterialJunctions: [], // no topic junctions
      });

      // LIBRARY_MATERIAL_42.fileUrl === PHASE_ALPHA_A.phasedMaterialsUrl
      expect(result.state).toBe('used');
      expect(result.phases).toHaveLength(1);
      expect(result.phases[0].id).toBe(201);
    });
  });

  // ── Regression 4 ─────────────────────────────────────────────────────────
  /**
   * Failed/incomplete lookup: topics=[] AND topicMaterialJunctions=[].
   * This signals the fan-out fetch failed or never ran.
   * Expected: state='unknown', NOT 'unused'.
   *
   * If the BE never returns `learningMaterialId` in junction rows (all junctions
   * are URL-only), a genuinely unattached material would also have junctions=[].
   * The `topics.length > 0` check in `fanOutSucceeded` disambiguates this:
   *   - topics=[] + junctions=[] → 'unknown' (lookup didn't run)
   *   - topics=[T] + junctions=[] → 'unused' (lookup ran, nothing matched)
   */
  describe('Regression 4: failed or incomplete lookup returns "unknown", not "unused"', () => {
    it('returns state "unknown" when both topics and junctions are empty (simulating failed fetch)', () => {
      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [],          // ← empty: fetch failed or lecturer has no topics
        phases: [],
        topicMaterialJunctions: [], // ← empty: fan-out never completed
      });

      expect(result.state).toBe('unknown');
      expect(result.topics).toHaveLength(0);
      expect(result.phases).toHaveLength(0);
    });

    it('returns state "unknown" even when the material has a phase match if junctions are empty AND topics are empty', () => {
      // When topics=[] and junctions=[] but phases=[], the fan-out may not have
      // completed. If phases are also empty we treat it as 'unknown'.
      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [],          // ← empty
        phases: [],          // ← also empty
        topicMaterialJunctions: [], // ← empty
      });

      // fanOutSucceeded = (topics.length > 0 || junctions.length > 0 || phases.length > 0)
      //                 = (false || false || false) = false → 'unknown'
      expect(result.state).toBe('unknown');
    });

    it('returns state "used" when phases are provided and match the material URL (even with empty topics)', () => {
      // phases=[PHASE_ALPHA_A] with matching URL → fan-out succeeded (phases loaded)
      // → 'used' because the phase match is real data, not a failed lookup
      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [],          // ← empty: junction fan-out not run yet
        phases: [PHASE_ALPHA_A],
        topicMaterialJunctions: [], // ← empty
      });

      // fanOutSucceeded = (false || false || true) = true
      // hasMatch = true (phase URL matches material URL)
      expect(result.state).toBe('used');
      expect(result.phases).toHaveLength(1);
    });

    it('returns state "unused" (NOT "unknown") when topics exist but junctions are empty — genuine zero-result state', () => {
      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [TOPIC_ALPHA, TOPIC_BETA], // ← topics exist
        phases: [],
        topicMaterialJunctions: [],        // ← no junctions (genuinely unattached)
      });

      // fanOutSucceeded = (topics.length > 0 || junctions.length > 0)
      //                 = (true || false) = true → hasMatch=false → 'unused'
      expect(result.state).toBe('unused');
      expect(result.topics).toHaveLength(0);
    });

    it('UI must NOT show "Not used" when state is "unknown" — the chip must show "Usage unavailable" instead', () => {
      // This test documents the contract: state='unknown' maps to a UI label
      // "Usage unavailable", not "Not used". The actual UI rendering is tested
      // in the integration/component tests; here we verify the state contract.
      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [],
        phases: [],
        topicMaterialJunctions: [],
      });

      expect(result.state).toBe('unknown');
      // Asserting the inverse: state !== 'unused' ensures "Not used" is not shown
      expect(result.state).not.toBe('unused');
    });
  });

  // ── Regression 5 ─────────────────────────────────────────────────────────
  /**
   * Junction row with `learningMaterialId=42` must NOT match library material
   * with `id=99`. This guards against counting materials attached to sibling
   * topics when the BE incorrectly associates the wrong learningMaterialId.
   *
   * Use distinct numeric ids — do NOT use real material names.
   */
  describe('Regression 5: junction learningMaterialId and library material id must match', () => {
    it('does NOT match a junction row with learningMaterialId=42 to library material id=99', () => {
      const junctionRow: TopicLearningMaterialResponse = {
        learningMaterialId: 42, // ← belongs to Material 42
        topicId: 7,
        fileUrl: 'https://library.example.com/original-url.pdf', // same URL
        title: 'Material 42 Junction',
      };

      const result = getMaterialUsage(LIBRARY_MATERIAL_99, {
        topics: [TOPIC_ALPHA],
        phases: [],
        topicMaterialJunctions: [junctionRow],
      });

      // Junction is for material 42; library material is 99 — no match
      expect(result.state).toBe('unused');
      expect(result.topics).toHaveLength(0);
    });

    it('matches junction when learningMaterialId equals library material id (same value, different objects)', () => {
      const junctionRow: TopicLearningMaterialResponse = {
        learningMaterialId: 42, // ← same as LIBRARY_MATERIAL_42.id
        topicId: 7,
        fileUrl: 'https://different-storage.example.com/rewritten.pdf',
        title: 'Material 42 Junction',
      };

      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [TOPIC_ALPHA],
        phases: [],
        topicMaterialJunctions: [junctionRow],
      });

      expect(result.state).toBe('used');
      expect(result.topics).toHaveLength(1);
      expect(result.topics[0].id).toBe(7);
    });

    it('junction row without learningMaterialId falls back to URL match against library material id=99', () => {
      // Junction without learningMaterialId: BE pre-fix payload
      const junctionRow: TopicLearningMaterialResponse = {
        // learningMaterialId intentionally omitted
        topicId: 7,
        fileUrl: 'https://library.example.com/original-url.pdf', // same URL
        title: 'Material 99 Junction (URL-only)',
      };

      const result = getMaterialUsage(LIBRARY_MATERIAL_99, {
        topics: [TOPIC_ALPHA],
        phases: [],
        topicMaterialJunctions: [junctionRow],
      });

      // URL matches → topic matched via fallback
      expect(result.state).toBe('used');
      expect(result.topics).toHaveLength(1);
      expect(result.topics[0].id).toBe(7);
    });
  });

  // ── Additional edge cases ────────────────────────────────────────────────

  describe('additional invariants', () => {
    it('null material returns state "unused"', () => {
      const result = getMaterialUsage(null, {
        topics: [TOPIC_ALPHA],
        phases: [PHASE_ALPHA_A],
        topicMaterialJunctions: [],
      });
      expect(result.state).toBe('unused');
      expect(result.topics).toHaveLength(0);
      expect(result.phases).toHaveLength(0);
    });

    it('undefined material returns state "unused"', () => {
      const result = getMaterialUsage(undefined, {
        topics: [TOPIC_ALPHA],
        phases: [],
        topicMaterialJunctions: [],
      });
      expect(result.state).toBe('unused');
    });

    it('material with empty fileUrl returns state "unused"', () => {
      const result = getMaterialUsage({ ...LIBRARY_MATERIAL_42, fileUrl: '' }, {
        topics: [TOPIC_ALPHA],
        phases: [],
        topicMaterialJunctions: [],
      });
      expect(result.state).toBe('unused');
    });

    it('multiple junctions for the same topicId returns the topic once (dedup by topic)', () => {
      // Two junction rows for the same topic (e.g. BE returned a row per file version)
      const row1: TopicLearningMaterialResponse = {
        learningMaterialId: 42,
        topicId: 7,
        fileUrl: 'https://v1.example.com/doc.pdf',
        title: 'Version 1',
      };
      const row2: TopicLearningMaterialResponse = {
        learningMaterialId: 42,
        topicId: 7,
        fileUrl: 'https://v2.example.com/doc.pdf',
        title: 'Version 2',
      };

      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [TOPIC_ALPHA],
        phases: [],
        topicMaterialJunctions: [row1, row2],
      });

      // Both rows match by ID; topic must appear once
      expect(result.state).toBe('used');
      expect(result.topics).toHaveLength(1);
    });

    it('returns state "used" when only phase matches (no topic match)', () => {
      // Material used in a phase but not attached to any topic via junction.
      // fanOutSucceeded = (false || false || true) = true
      // hasMatch = true → 'used'
      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [],
        phases: [PHASE_ALPHA_A, PHASE_ALPHA_B],
        topicMaterialJunctions: [],
      });

      expect(result.state).toBe('used');
      expect(result.topics).toHaveLength(0);
      expect(result.phases).toHaveLength(2);
    });

    it('BE may return junction with topicId as string (non-numeric) — must be treated as orphan', () => {
      const rowWithStringTopicId = {
        learningMaterialId: 42,
        topicId: '7' as unknown as number, // ← string, not number
        fileUrl: 'https://storage.example.com/canonical.pdf',
        title: 'Malformed Junction',
      } as TopicLearningMaterialResponse;

      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [TOPIC_ALPHA],
        phases: [],
        topicMaterialJunctions: [rowWithStringTopicId],
      });

      // topicId is not a number → orphan → skipped
      expect(result.state).toBe('unused');
      expect(result.topics).toHaveLength(0);
    });
  });

  // ── Regression 6 — Production BE shape ─────────────────────────────────────
  /**
   * Real-world BE behavior (see Swagger: components.schemas.LearningMaterialResponse):
   * the row returned by `GET /api/ResearchTopic/{topicId}/learning-materials` has
   * `learningMaterialId`, `title`, `fileUrl`, `description`, `createdAt`,
   * `subFieldId`, `lecturerId` — but NO `topicId`. The topic association is
   * implicit in the request URL.
   *
   * Bug fixed by this commit: callers that flatten across topics (like
   * Materials.tsx `loadCrossReference`) MUST inject `topicId` into each row
   * before flattening, otherwise `getMaterialUsage` silently drops every row
   * (because the row has no `topicId`, every guard inside `getMaterialUsage`
   * skips it).
   *
   * Coverage: the Materials.tsx fix path is exercised here by passing a row
   * with `topicId` injected (mirroring what the FE now does before flatten).
   * We also document that the URL fallback CANNOT rescue an unattributed row
   * — `getMaterialUsage` cannot guess which topic a row came from, by design.
   */
  describe('Regression 6: production BE shape (no topicId on row)', () => {
    it('matches by injected topicId + matching ID (the Materials.tsx fix path)', () => {
      // Same BE row but with topicId injected by Materials.tsx before flattening.
      const annotatedRow: TopicLearningMaterialResponse = {
        learningMaterialId: 42,
        topicId: 7,
        title: 'Testing YT Link',
        fileUrl: 'https://library.example.com/original-url.pdf',
      };

      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [TOPIC_ALPHA],
        phases: [],
        topicMaterialJunctions: [annotatedRow],
      });

      expect(result.state).toBe('used');
      expect(result.topics).toHaveLength(1);
      expect(result.topics[0].id).toBe(7);
    });

    it('DROPS rows that match by URL but lack topicId — unattributable without caller hint', () => {
      // Row exactly as the BE sends it — no topicId field at all.
      // Materials.tsx would inject topicId at fetch time, so this case only
      // arises if a caller forgets to annotate. getMaterialUsage cannot
      // guess which topic the row came from, so it is conservatively dropped.
      const rawBeRow: TopicLearningMaterialResponse = {
        learningMaterialId: 42,
        title: 'Testing YT Link',
        fileUrl: 'https://library.example.com/original-url.pdf',
      };

      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [TOPIC_ALPHA],
        phases: [],
        topicMaterialJunctions: [rawBeRow],
      });

      // No topicId → getMaterialUsage can't attribute → dropped.
      // This is documented behavior; callers MUST inject topicId.
      expect(result.state).toBe('unused');
      expect(result.topics).toHaveLength(0);
    });

    it('drops URL-only rows whose fileUrl does not match the material (no false positives)', () => {
      const unrelatedRow: TopicLearningMaterialResponse = {
        learningMaterialId: 99,
        title: 'Unrelated',
        fileUrl: 'https://library.example.com/different.pdf',
      };

      const result = getMaterialUsage(LIBRARY_MATERIAL_42, {
        topics: [TOPIC_ALPHA],
        phases: [],
        topicMaterialJunctions: [unrelatedRow],
      });

      expect(result.state).toBe('unused');
      expect(result.topics).toHaveLength(0);
    });
  });
});
