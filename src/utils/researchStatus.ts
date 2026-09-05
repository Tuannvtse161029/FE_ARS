// Status enums and transition tables — single source of truth.
// Source of truth: docs/local-only/research-workflow-contract.md §3.
//
// Agent 2 (GradStudent) ONLY uses PhasedReportStatus transitions; the
// GuidanceProject and ResearchTopic transition tables are exported for
// Agent 1 and the dashboard to share.

import type {
  GuidanceProjectStatus,
  PhasedReportStatus,
  ResearchTopicStatus,
} from '../types/research';

// ---------- GuidanceProject ----------

const GUIDANCE_PROJECT_TRANSITIONS: Record<
  GuidanceProjectStatus,
  ReadonlyArray<GuidanceProjectStatus>
> = {
  PROPOSED: ['ONGOING', 'CANCELLED'],
  ONGOING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const canTransitionGuidanceProject = (
  from: GuidanceProjectStatus,
  to: GuidanceProjectStatus,
): boolean => GUIDANCE_PROJECT_TRANSITIONS[from].includes(to);

// ---------- ResearchTopic ----------
//
// Topic lifecycle (see research-workflow-contract.md §3):
//   OPEN     → ASSIGNED, COMPLETED
//   ASSIGNED → COMPLETED
//   COMPLETED → (terminal)
//
// CLOSED was previously a fourth state used to retire a topic without
// completing it. It is being removed: a topic that wraps up without a
// successful run now transitions to COMPLETED (which is treated as the
// archival terminal). `OPEN → CLOSED` and `ASSIGNED → CLOSED` are no longer
// allowed from the lecturer surface — close actions now go via the
// "Mark Completed" affordance.

const RESEARCH_TOPIC_TRANSITIONS: Record<
  ResearchTopicStatus,
  ReadonlyArray<ResearchTopicStatus>
> = {
  OPEN: ['ASSIGNED', 'COMPLETED'],
  ASSIGNED: ['COMPLETED'],
  COMPLETED: [],
};

export const canTransitionResearchTopic = (
  from: ResearchTopicStatus,
  to: ResearchTopicStatus,
): boolean => RESEARCH_TOPIC_TRANSITIONS[from].includes(to);

// ---------- PhasedReport ----------

const PHASED_REPORT_TRANSITIONS: Record<
  PhasedReportStatus,
  ReadonlyArray<PhasedReportStatus>
> = {
  WAITING: ['SUBMITTED'],
  SUBMITTED: ['EVALUATED', 'REJECTED'],
  EVALUATED: [],
  REJECTED: ['SUBMITTED'],
  Pending: ['OnTime', 'Overdue'],
  OnTime: ['Passed', 'REJECTED'],
  Overdue: ['Passed', 'REJECTED'],
  Passed: [],
};

export const canTransitionPhasedReport = (
  from: PhasedReportStatus,
  to: PhasedReportStatus,
): boolean => PHASED_REPORT_TRANSITIONS[from].includes(to);

// Defensive normalization — the BE stores status as a free-form string
// (Swagger contract §1) so anything unknown is coerced to WAITING (the safe
// default for a fresh milestone).
export const normalizePhasedReportStatus = (
  raw: string | null | undefined,
): PhasedReportStatus => {
  if (!raw) return 'WAITING';
  const v = raw.toUpperCase().trim();
  if (v === 'WAITING') return 'WAITING';
  if (v === 'SUBMITTED') return 'SUBMITTED';
  if (v === 'EVALUATED' || v === 'APPROVED' || v === 'REVIEWED') return 'EVALUATED';
  if (v === 'REJECTED') return 'REJECTED';
  return 'WAITING';
};

export const normalizeGuidanceProjectStatus = (
  raw: string | null | undefined,
): GuidanceProjectStatus => {
  if (!raw) return 'PROPOSED';
  const v = raw.toUpperCase().trim();
  if (v === 'PROPOSED') return 'PROPOSED';
  if (v === 'ONGOING') return 'ONGOING';
  if (v === 'COMPLETED' || v === 'DONE') return 'COMPLETED';
  if (v === 'CANCELLED' || v === 'CANCELED') return 'CANCELLED';
  return 'PROPOSED';
};

export const normalizeResearchTopicStatus = (
  raw: string | null | undefined,
): ResearchTopicStatus => {
  if (!raw) return 'OPEN';
  const v = raw.toUpperCase().trim();
  if (v === 'OPEN') return 'OPEN';
  if (v === 'ASSIGNED') return 'ASSIGNED';
  if (v === 'COMPLETED' || v === 'DONE') return 'COMPLETED';
  // CLOSED is no longer a canonical status — legacy BE records that ship
  // a CLOSED value are coerced to OPEN so the lecturer can re-assign or
  // mark them completed through the supported transitions.
  return 'OPEN';
};

// ---------- PhasedReport counts ----------
//
// Pure helper for both Lecturer (GroupDetail) and Graduate Student (workspace /
// dashboard) surfaces — counts submitted reports by status so each side can
// render a milestone summary card. Defensively normalises free-form BE strings
// via `normalizePhasedReportStatus` so the counts are stable even if the BE
// emits an unrecognised variant.
//
// Added in Phase C (Lead, lead-phase-c-contract.md S-2).
export interface PhasedReportCounts {
  waiting: number;
  submitted: number;
  rejected: number;
  evaluated: number;
}

export const countPhasedReportsByStatus = (
  reports: ReadonlyArray<{ status?: string | null }>,
): PhasedReportCounts => {
  const counts: PhasedReportCounts = {
    waiting: 0,
    submitted: 0,
    rejected: 0,
    evaluated: 0,
  };
  for (const report of reports) {
    // Map BE timeliness states (Pending / OnTime / Overdue / Passed) onto
    // the four submission/review buckets. Without this mapping, a report
    // with a timeliness status slipped out of every bucket — so a group
    // with 9 reports showed 8 in the milestone summary (audit BTR-XXX).
    // The BE currently surfaces both state tracks in the same `status`
    // column, so the mapping must be exhaustive.
    const raw = (report?.status ?? '').toString().trim();
    if (raw === 'Pending') counts.waiting += 1;
    else if (raw === 'OnTime') counts.submitted += 1;
    else if (raw === 'Overdue') counts.rejected += 1;
    else if (raw === 'Passed') counts.evaluated += 1;
    else {
      const normalized = normalizePhasedReportStatus(raw);
      if (normalized === 'WAITING') counts.waiting += 1;
      else if (normalized === 'SUBMITTED') counts.submitted += 1;
      else if (normalized === 'REJECTED') counts.rejected += 1;
      else if (normalized === 'EVALUATED') counts.evaluated += 1;
      // Unknown values fall through to WAITING so the totals still sum
      // to `reports.length` — no row silently disappears.
      else counts.waiting += 1;
    }
  }
  return counts;
};