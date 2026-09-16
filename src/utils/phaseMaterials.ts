/**
 * PhaseMaterials helper — derives the materials a Research Group's
 * student workspace should display from the group's `PhasedReport` rows.
 *
 * Why this lives here (and not inlined into StudentResearchGroups):
 * -----------------------------------------------------------------
 * The Graduate Student workspace ("Research Group" tab) used to render
 * materials by calling `useLearningMaterials({ lecturerId })`, which
 * returns **every** material the lecturer has in their global Learning
 * Material library. That is the wrong workflow for two reasons:
 *
 *   1. **Wrong scope.** Students should not be able to see materials
 *      the lecturer hasn't explicitly attached to their group's
 *      research-topic phases. The whole point of "Manage phase" is to
 *      let the lecturer scope materials to a specific milestone.
 *   2. **Wrong filter.** Even after a topic-id filter, the lecturer's
 *      library is global, not phase-bound — so the FE was inferring
 *      the assignment client-side from `subFieldId`, which is not the
 *      BE's source of truth.
 *
 * The correct BE contract is:
 *   • The lecturer attaches a material to a phase via
 *     `PUT /api/PhasedReport/{id}` with `phasedMaterialsUrl`.
 *   • The student view reads `GET /api/PhasedReport/group/{groupId}`
 *     and consumes `PhasedReport.phasedMaterialsUrl` per row.
 *
 * The Lecturer GroupDetail (the lecturer-side mirror of this workspace)
 * still uses the global `useLearningMaterials` because the lecturer
 * owns those materials and needs to see them all when configuring
 * phases. That view is unaffected by this change.
 *
 * This module is pure: no React, no service imports, no mocks — safe to
 * use in pages, hooks and unit tests.
 */

import type { SubmittedPhasedReport } from '../services/phasedReport.service';

/**
 * One phase-material entry derived from a PhasedReport row.
 *
 * `phaseNumber` is the canonical ordering key (matches the BE column
 * that the lecturer populates via the milestone editor). `milestoneTitle`
 * is shown to students as the phase label; `materialUrl` is the URL the
 * lecturer attached.
 */
export interface PhaseMaterialEntry {
  phaseNumber: number;
  milestoneTitle: string;
  materialUrl: string;
  /** Echo of the originating `PhasedReport.id` for stable React keys. */
  phasedReportId: number;
}

/** Placeholder used when the BE omits a phase label. */
const DEFAULT_MILESTONE_LABEL = 'Untitled phase';

/**
 * Extract the materials a Research Group's student workspace should show,
 * one entry per PhasedReport row that has a non-empty `phasedMaterialsUrl`.
 *
 * Behaviour:
 *   • Rows without a URL are dropped — no lecturer attachment = no entry.
 *   • Rows without a `phaseNumber` are dropped — they cannot be ordered.
 *   • Output is sorted ascending by `phaseNumber` so the workspace shows
 *     materials in the same order the milestones are presented in the
 *     milestone-progress table.
 *   • Duplicate phaseNumber rows are all kept — a future BE migration may
 *     support multiple attachments per phase, and the consumer should be
 *     able to render them. Deduplication, if needed, is a UX choice the
 *     call-site should make deliberately.
 */
export const derivePhaseMaterialsForGroup = (
  reports: ReadonlyArray<SubmittedPhasedReport>,
): PhaseMaterialEntry[] => {
  const out: PhaseMaterialEntry[] = [];
  for (const r of reports) {
    if (typeof r.phaseNumber !== 'number') continue;
    const url = typeof r.phasedMaterialsUrl === 'string' ? r.phasedMaterialsUrl.trim() : '';
    if (!url) continue;
    out.push({
      phaseNumber: r.phaseNumber,
      milestoneTitle:
        (typeof r.milestoneTitle === 'string' && r.milestoneTitle.trim())
          ? r.milestoneTitle
          : DEFAULT_MILESTONE_LABEL,
      materialUrl: url,
      phasedReportId: r.id,
    });
  }
  out.sort((a, b) => a.phaseNumber - b.phaseNumber);
  return out;
};
