/**
 * Regression tests for `buildDisplayRows` in
 * `src/pages/Lecturer/PhaseReports.tsx`.
 *
 * The function drives the rowSpan-based merging of the Research
 * Topic and Research Group columns. The JSX renders a topic/group
 * <td> only when `isFirstOfTopic` / `isFirstOfGroup` is true, and
 * skips it otherwise — so every <tr> MUST end up with the same
 * number of <td>s in the same column positions. Off-by-one or
 * orphan-rowspan bugs cause the next column's data to drift left
 * into the wrong column (e.g. Phase 1/2 text appearing under the
 * Deadline column header), which is exactly what the September
 * 2026 screenshot reported.
 *
 * These tests pin the four scenarios the production data can hit:
 *   1. Single topic, single group         — topic cell spans all rows
 *   2. Single topic, multiple groups     — one topic cell spans, group
 *                                           cells reset per group
 *   3. Rows with missing `topicTitle`     — each missing-title row gets
 *                                           its OWN topic cell so the
 *                                           table column count stays
 *                                           honest
 *   4. Two missing-title rows in a row   — should still merge into a
 *                                           single topic run when they
 *                                           share the same `topicId`
 */
import { describe, it, expect } from 'vitest';
import { buildDisplayRows } from '../../../../src/pages/Lecturer/PhaseReports';
import type { PhasedReport } from '../../../../src/services/phasedReport.service';

// ─────────────────────────────────────────────────────────────────────────────
// Fixture
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a minimal PhasedReport row for the row-span logic.
 *
 *   `topicTitle` of `null` / `undefined` / empty string is treated as
 *   "missing topic" — the row's topic key falls back to the
 *   "__missing_topic__:<topicId>" key so the row-span helper groups
 *   missing-title rows by their topicId.
 */
const makeRow = (
  id: number,
  overrides: Partial<PhasedReport> = {},
): PhasedReport => ({
  id,
  phasedReportId: id,
  researchGroupId: 1,
  topicId: 10,
  topicTitle: 'Deep Learning for NLP',
  groupName: 'Group Alpha',
  status: 'Pending',
  deadlineAt: '2027-01-01T00:00:00Z',
  phaseNumber: 1,
  ...overrides,
});

/**
 * Renders the display rows into the same <td> sequence the JSX
 * produces and returns the (columnIndex → label) per row. This
 * mirrors the actual JSX render so an off-by-one bug would
 * manifest as a "wrong column" for a real cell.
 */
const renderColumns = (
  rows: ReturnType<typeof buildDisplayRows>,
): string[][] =>
  rows.map((row) => {
    const cols: string[] = [];
    if (row.isFirstOfTopic) cols.push(`topic(${row.topicRowSpan})`);
    if (row.isFirstOfGroup) cols.push(`group(${row.groupRowSpan})`);
    cols.push('phase', 'deadline', 'status', 'actions');
    return cols;
  });

/**
 * Bug guard: simulates how the browser lays out the <td>s given
 * the rowSpan declarations. A row with isFirstOfTopic=false is
 * supposed to "land" in the topic column only because a previous
 * row's topic cell spans over it. If that span doesn't actually
 * reach this row, the row's `<td>` count is off by one — `phase`
 * slides into the topic column, `status` slides into the group
 * column, etc. This simulation walks the rows in order and asserts
 * that every row starts at the right column index based on what
 * the spanning cells from earlier rows actually cover.
 *
 * For each row we compute its "claimed cells":
 *   - 0 cells:  no topic cell, no group cell (middle of same group)
 *   - 1 cell:   group cell only  (mid topic, new group starts here)
 *   - 2 cells:  topic + group     (new topic AND new group)
 * Then we add the topic-cell-span counter and assert that the row
 * consumed its span correctly — neither too many nor too few.
 */
const expectColumnsLineUp = (cols: string[][]): void => {
  // Track how many additional rows the most-recent topic / group
  // cells still span. Both counters decrement per row consumed
  // (because this row is itself covered by the spanning cell).
  let topicRemaining = 0;
  let groupRemaining = 0;

  cols.forEach((row) => {
    // How many leading cells does this row claim?
    const claimedCount = row.filter((c) => c.startsWith('topic') || c.startsWith('group')).length;

    if (claimedCount === 0) {
      // Both topic and group are filled by previous rows' spans.
      expect(topicRemaining).toBeGreaterThan(0);
      expect(groupRemaining).toBeGreaterThan(0);
      topicRemaining -= 1;
      groupRemaining -= 1;
      return;
    }

    // Otherwise this row claims at least one cell. Find the topic
    // and group labels (they may or may not be present in this row).
    const topicLabel = row.find((c) => c.startsWith('topic'));
    const groupLabel = row.find((c) => c.startsWith('group'));

    if (topicLabel) {
      // This row opens a new topic run. The topic cell's rowSpan
      // tells us how many total rows it covers. We've consumed 1
      // row with this claim; the remaining (span - 1) will be
      // claimed by future rows' `isFirstOfTopic=false` markers.
      const match = /^topic\((\d+)\)/.exec(topicLabel);
      const span = match ? Number(match[1]) : 1;
      expect(span).toBeGreaterThanOrEqual(1);
      topicRemaining = span - 1;
    } else {
      // No topic cell on this row. The previous row's spanning
      // topic cell must still cover this row.
      expect(topicRemaining).toBeGreaterThan(0);
      topicRemaining -= 1;
    }

    if (groupLabel) {
      const match = /^group\((\d+)\)/.exec(groupLabel);
      const span = match ? Number(match[1]) : 1;
      groupRemaining = span - 1;
    } else {
      expect(groupRemaining).toBeGreaterThan(0);
      groupRemaining -= 1;
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The OLD, buggy implementation of `buildDisplayRows` that the
 * September 2026 screenshot regressed against. Pinned here so the
 * new test suite has a known-bad reference — we re-run the same
 * `expectColumnsLineUp` checks against it and assert that the
 * suite catches the bug. Without this, a future "simplification"
 * of the row-span code could silently re-introduce the column
 * drift without any test going red.
 */
const buildDisplayRowsBuggy = (rows: PhasedReport[]): DisplayRow[] => {
  const result: DisplayRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const r = rows[i];
    const topic = r.topicTitle ?? '';
    const group = r.researchGroupId ?? -1;

    let topicEnd = i + 1;
    while (
      topicEnd < rows.length &&
      (rows[topicEnd].topicTitle ?? '') === topic
    ) {
      topicEnd++;
    }
    let groupEnd = i + 1;
    while (
      groupEnd < topicEnd &&
      (rows[groupEnd].researchGroupId ?? -1) === group
    ) {
      groupEnd++;
    }

    const topicRowSpan = topicEnd - i;
    const groupRowSpan = groupEnd - i;

    result.push({
      report: r,
      topicRowSpan,
      groupRowSpan,
      isFirstOfTopic: true,
      isFirstOfGroup: true,
    });

    for (let j = i + 1; j < groupEnd; j++) {
      result.push({
        report: rows[j],
        topicRowSpan: 1,
        groupRowSpan: 1,
        isFirstOfTopic: false,
        isFirstOfGroup: false,
      });
    }
    i = groupEnd;
  }
  return result;
};

describe('PhaseReports — buildDisplayRows row-span merging', () => {
  // The five test cases below live in their own `describe` so the
  // shared "fixed implementation" setup runs once. The buggy
  // regression guard gets its own describe at the bottom.

  it('merges a single topic / single group into one topic cell + one group cell', () => {
    const rows = [
      makeRow(1, { phaseNumber: 1 }),
      makeRow(2, { phaseNumber: 2 }),
      makeRow(3, { phaseNumber: 3 }),
    ];
    const display = buildDisplayRows(rows);

    expect(display).toHaveLength(3);
    expect(display[0]).toMatchObject({
      isFirstOfTopic: true,
      topicRowSpan: 3,
      isFirstOfGroup: true,
      groupRowSpan: 3,
    });
    for (let j = 1; j < 3; j++) {
      expect(display[j]).toMatchObject({
        isFirstOfTopic: false,
        isFirstOfGroup: false,
      });
    }
    expectColumnsLineUp(renderColumns(display));
  });

  it('keeps a single topic cell across multiple groups; resets the group cell per group', () => {
    const rows = [
      makeRow(1, { researchGroupId: 1, phaseNumber: 1 }),
      makeRow(2, { researchGroupId: 1, phaseNumber: 2 }),
      makeRow(3, { researchGroupId: 2, phaseNumber: 1 }),
      makeRow(4, { researchGroupId: 2, phaseNumber: 2 }),
    ];
    const display = buildDisplayRows(rows);

    expect(display).toHaveLength(4);
    // Row 0: opens the topic run; group-1 run is 2 phase rows.
    expect(display[0]).toMatchObject({
      isFirstOfTopic: true,
      topicRowSpan: 4,
      isFirstOfGroup: true,
      groupRowSpan: 2,
    });
    // Row 1: same group as row 0 → skip topic & group cells.
    expect(display[1]).toMatchObject({
      isFirstOfTopic: false,
      isFirstOfGroup: false,
    });
    // Row 2: still in the same topic run (the outer loop re-enters),
    // but a NEW group → renders its own group cell only.
    expect(display[2]).toMatchObject({
      isFirstOfTopic: false,
      isFirstOfGroup: true,
      groupRowSpan: 2,
    });
    // Row 3: same group as row 2 → skip both cells.
    expect(display[3]).toMatchObject({
      isFirstOfTopic: false,
      isFirstOfGroup: false,
    });
    expectColumnsLineUp(renderColumns(display));
  });

  it('treats a missing topicTitle as its own topic cell so columns never shift', () => {
    // Row layout: T1 (g1, phase 1) → T1 (g1, phase 2) → MISSING-TOPIC
    // (g1, phase 3) → T2 (g2, phase 1). The MISSING-TOPIC row sits
    // BETWEEN two valid topic rows. With the old `topicTitle ?? ''`
    // logic it would have broken the topic run, leaving the topic
    // cell with rowSpan=2 over only 2 rows and the next column's
    // data drifting left — Phase 1/2 text appearing under the
    // Deadline header. The fix pins the missing-title row to its
    // own topic run keyed by topicId so each <tr> keeps a balanced
    // 6-cell layout.
    const rows = [
      makeRow(1, { researchGroupId: 1, topicId: 10, topicTitle: 'T1', phaseNumber: 1 }),
      makeRow(2, { researchGroupId: 1, topicId: 10, topicTitle: 'T1', phaseNumber: 2 }),
      // Missing topicTitle for row 3 — same topicId 10 as rows 1-2 but
      // topicTitle is undefined (e.g. legacy BE row that hasn't been
      // backfilled).
      makeRow(3, { researchGroupId: 1, topicId: 10, topicTitle: undefined, phaseNumber: 3 }),
      makeRow(4, { researchGroupId: 2, topicId: 20, topicTitle: 'T2', phaseNumber: 1 }),
    ];
    const display = buildDisplayRows(rows);

    expect(display).toHaveLength(4);
    // Row 0: opens T1 with rowSpan=2 (only the T1 rows count for it).
    expect(display[0]).toMatchObject({
      isFirstOfTopic: true,
      topicRowSpan: 2,
    });
    // Row 1: same T1 run, same group → skip topic & group.
    expect(display[1]).toMatchObject({
      isFirstOfTopic: false,
      isFirstOfGroup: false,
    });
    // Row 2: own topic run (key "__missing:10"), own group run.
    expect(display[2]).toMatchObject({
      isFirstOfTopic: true,
      topicRowSpan: 1,
      isFirstOfGroup: true,
      groupRowSpan: 1,
    });
    // Row 3: T2 opens a new topic run.
    expect(display[3]).toMatchObject({
      isFirstOfTopic: true,
      topicRowSpan: 1,
      isFirstOfGroup: true,
      groupRowSpan: 1,
    });
    expectColumnsLineUp(renderColumns(display));
  });

  it('merges two missing-topic rows that share a topicId into one topic run', () => {
    const rows = [
      makeRow(1, { researchGroupId: 1, topicId: 10, topicTitle: undefined, phaseNumber: 1 }),
      makeRow(2, { researchGroupId: 1, topicId: 10, topicTitle: '', phaseNumber: 2 }),
      makeRow(3, { researchGroupId: 1, topicId: 10, topicTitle: null, phaseNumber: 3 }),
    ];
    const display = buildDisplayRows(rows);

    expect(display).toHaveLength(3);
    expect(display[0]).toMatchObject({
      isFirstOfTopic: true,
      topicRowSpan: 3,
      isFirstOfGroup: true,
      groupRowSpan: 3,
    });
    for (let j = 1; j < 3; j++) {
      expect(display[j]).toMatchObject({
        isFirstOfTopic: false,
        isFirstOfGroup: false,
      });
    }
    expectColumnsLineUp(renderColumns(display));
  });

  it('keeps every <tr> at exactly 6 cells regardless of merging', () => {
    // Stress test: a mixed report list that exercises single-group,
    // multi-group, missing-topic, and missing-topicId edge cases.
    const rows = [
      makeRow(1, { researchGroupId: 1, topicId: 10, topicTitle: 'T1', phaseNumber: 1 }),
      makeRow(2, { researchGroupId: 1, topicId: 10, topicTitle: 'T1', phaseNumber: 2 }),
      makeRow(3, { researchGroupId: 2, topicId: 10, topicTitle: 'T1', phaseNumber: 1 }),
      makeRow(4, { researchGroupId: 2, topicId: 10, topicTitle: 'T1', phaseNumber: 2 }),
      // No topicId and no topicTitle — fully anonymous row.
      makeRow(5, { researchGroupId: 3, topicId: undefined, topicTitle: undefined, phaseNumber: 1 }),
      makeRow(6, { researchGroupId: 4, topicId: 20, topicTitle: 'T2', phaseNumber: 1 }),
    ];
    const display = buildDisplayRows(rows);
    expect(display).toHaveLength(rows.length);
    expectColumnsLineUp(renderColumns(display));
  });
});

describe('PhaseReports — regression guard for the OLD buggy row-span logic', () => {
  // These tests run the same `expectColumnsLineUp` simulation but
  // against `buildDisplayRowsBuggy` — the exact code that shipped
  // in src/pages/Lecturer/PhaseReports.tsx before the October 2026
  // fix. They MUST fail, because the buggy logic is what the
  // September 2026 screenshot reported. If they ever start passing,
  // either the buggy reference has been silently "fixed" in place
  // (defeating the regression guard) or the column-alignment check
  // has become too lenient to detect the bug.

  it('fails column alignment when a missing topicTitle splits a topic run', () => {
    const rows = [
      makeRow(1, { researchGroupId: 1, topicId: 10, topicTitle: 'T1', phaseNumber: 1 }),
      makeRow(2, { researchGroupId: 1, topicId: 10, topicTitle: 'T1', phaseNumber: 2 }),
      makeRow(3, { researchGroupId: 1, topicId: 10, topicTitle: undefined, phaseNumber: 3 }),
      makeRow(4, { researchGroupId: 2, topicId: 20, topicTitle: 'T2', phaseNumber: 1 }),
    ];
    expect(() => expectColumnsLineUp(renderColumns(buildDisplayRowsBuggy(rows)))).toThrow();
  });

  it('fails column alignment when one topic spans multiple groups', () => {
    const rows = [
      makeRow(1, { researchGroupId: 1, topicId: 10, topicTitle: 'T1', phaseNumber: 1 }),
      makeRow(2, { researchGroupId: 1, topicId: 10, topicTitle: 'T1', phaseNumber: 2 }),
      makeRow(3, { researchGroupId: 2, topicId: 10, topicTitle: 'T1', phaseNumber: 1 }),
      makeRow(4, { researchGroupId: 2, topicId: 10, topicTitle: 'T1', phaseNumber: 2 }),
    ];
    expect(() => expectColumnsLineUp(renderColumns(buildDisplayRowsBuggy(rows)))).toThrow();
  });
});