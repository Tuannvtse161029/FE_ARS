import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  PhasedReportCreateRequest as StrictPhasedReportCreateRequest,
  PhasedReportUpdateRequest as StrictPhasedReportUpdateRequest,
  TopicMilestonesCreateRequest,
  PhasedReportSubmitRequest as WirePhasedReportSubmitRequest,
  PhasedReportEvaluationRequest,
} from '../types/researchWorkflowDtos';
import type { GroupMember } from './groupMember.service';

const PHASED_REPORT_ENDPOINTS = {
  GET_ALL: API_ENDPOINTS.RESEARCH_WORKFLOW.PHASED_REPORT.GET_ALL,
  GET_BY_ID: API_ENDPOINTS.RESEARCH_WORKFLOW.PHASED_REPORT.GET_BY_ID,
  CREATE: API_ENDPOINTS.RESEARCH_WORKFLOW.PHASED_REPORT.CREATE,
  UPDATE: API_ENDPOINTS.RESEARCH_WORKFLOW.PHASED_REPORT.UPDATE,
  DELETE: (id: number) => API_ENDPOINTS.RESEARCH_WORKFLOW.PHASED_REPORT.UPDATE(id),
  TOPIC_MILESTONES: API_ENDPOINTS.RESEARCH_WORKFLOW.PHASED_REPORT.TOPIC_MILESTONES,
  BY_TOPIC: (topicId: number) => API_ENDPOINTS.RESEARCH_WORKFLOW.PHASED_REPORT.BY_TOPIC(topicId),
  MEMBERS_BY_TOPIC: (topicId: number) => API_ENDPOINTS.RESEARCH_WORKFLOW.PHASED_REPORT.MEMBERS_BY_TOPIC(topicId),
  SUBMIT: API_ENDPOINTS.RESEARCH_WORKFLOW.PHASED_REPORT.SUBMIT,
  EVALUATE: (id: number) => API_ENDPOINTS.RESEARCH_WORKFLOW.PHASED_REPORT.EVALUATE(id),
} as const;

// Status enums per contract §3 — the BE stores these as a free-form string,
// the FE normalises to the canonical labels.
export type PhasedReportStatus =
  | 'WAITING'
  | 'SUBMITTED'
  | 'EVALUATED'
  | 'REJECTED'
  | 'Pending'
  | 'OnTime'
  | 'Overdue'
  | 'Passed';

export const PHASED_REPORT_STATUSES: readonly PhasedReportStatus[] = [
  'WAITING',
  'SUBMITTED',
  'EVALUATED',
  'REJECTED',
] as const;

const PHASED_REPORT_TRANSITIONS: Record<
  PhasedReportStatus,
  readonly PhasedReportStatus[]
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
): boolean => Boolean(PHASED_REPORT_TRANSITIONS[from]?.includes(to));

// Defensive status normaliser — the BE returns a free-form string so we map
// the obvious synonyms to the canonical labels and pass through unknowns.
export const normalizePhasedReportStatus = (
  raw: string | null | undefined,
): PhasedReportStatus => {
  if (!raw) return 'WAITING';
  const v = raw.toLowerCase().trim();
  if (v === 'waiting' || v === 'pending' || v === 'awaiting') return 'WAITING';
  if (v === 'ontime' || v === 'on_time' || v === 'on time') return 'OnTime';
  if (v === 'overdue' || v === 'late') return 'Overdue';
  if (v === 'passed' || v === 'pass') return 'Passed';
  if (v === 'submitted' || v === 'pending_review' || v === 'submitted_for_review') {
    return 'SUBMITTED';
  }
  if (
    v === 'evaluated' ||
    v === 'approved' ||
    v === 'graded' ||
    v === 'complete'
  ) {
    return 'EVALUATED';
  }
  if (v === 'rejected' || v === 'denied' || v === 'declined') return 'REJECTED';
  return 'WAITING';
};

// BE response shape — every property is optional/nullable per the Swagger
// PhasedReport schema.
export interface PhasedReport {
  id?: number;
  phasedReportId?: number;
  researchGroupId?: number | null;
  topicId?: number | null;
  topicTitle?: string | null;
  groupName?: string | null;
  groupMemberId?: number | null;
  studentName?: string | null;
  phaseNumber?: number | null;
  milestoneTitle?: string | null;
  deadlineAt?: string | null;
  reportFileUrl?: string | null;
  capacityEvaluation?: string | null;
  finalOutcomeEvaluation?: string | null;
  lectureFeedback?: number | null;
  lecturerDescription?: string | null;
  submittedAt?: string | null;
  isOverdue?: boolean | null;
  status?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const normalizePhasedReport = (raw: PhasedReport): PhasedReport => ({
  ...raw,
  id: raw.phasedReportId ?? raw.id ?? undefined,
  phasedReportId: raw.phasedReportId ?? raw.id ?? undefined,
  status: raw.status ? (['OnTime', 'Overdue', 'Passed', 'Pending', 'WAITING', 'SUBMITTED', 'EVALUATED', 'REJECTED'].includes(raw.status) ? raw.status : normalizePhasedReportStatus(raw.status)) : 'Pending',
});

const normalizePhasedReportList = (data: unknown): PhasedReport[] => {
  const raw = Array.isArray(data) ? (data as PhasedReport[]) : [];
  return raw.map(normalizePhasedReport);
};

// Raw CRUD (shared between both agents).
export const phasedReportService = {
  getAll: async (): Promise<PhasedReport[]> => {
    const response = await api.get<PhasedReport[]>(
      PHASED_REPORT_ENDPOINTS.GET_ALL,
    );
    return normalizePhasedReportList(response.data);
  },

  getById: async (id: number): Promise<PhasedReport> => {
    const response = await api.get<PhasedReport>(
      PHASED_REPORT_ENDPOINTS.GET_BY_ID(id),
    );
    return normalizePhasedReport(response.data);
  },

  create: async (
    payload: StrictPhasedReportCreateRequest,
  ): Promise<PhasedReport> => {
    const response = await api.post<PhasedReport>(
      PHASED_REPORT_ENDPOINTS.CREATE,
      payload,
    );
    return normalizePhasedReport(response.data);
  },

  update: async (
    id: number,
    payload: StrictPhasedReportUpdateRequest,
  ): Promise<PhasedReport> => {
    const response = await api.put<PhasedReport>(
      PHASED_REPORT_ENDPOINTS.UPDATE(id),
      payload,
    );
    return normalizePhasedReport(response.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(PHASED_REPORT_ENDPOINTS.DELETE(id));
  },

  setTopicMilestones: async (
    payload: TopicMilestonesCreateRequest,
  ): Promise<PhasedReport[]> => {
    const response = await api.post<PhasedReport[] | { message?: string; data?: PhasedReport[] }>(
      PHASED_REPORT_ENDPOINTS.TOPIC_MILESTONES,
      payload,
    );
    const list = Array.isArray(response.data)
      ? response.data
      : (response.data as { data?: PhasedReport[] }).data ?? [];
    return normalizePhasedReportList(list);
  },

  getByTopic: async (topicId: number): Promise<PhasedReport[]> => {
    try {
      const response = await api.get<PhasedReport[]>(
        PHASED_REPORT_ENDPOINTS.BY_TOPIC(topicId),
      );
      return normalizePhasedReportList(response.data);
    } catch {
      const fallback = await api.get<PhasedReport[]>(`/api/PhasedReport/by-topic/${topicId}`);
      return normalizePhasedReportList(fallback.data);
    }
  },

  getMembersByTopic: async (topicId: number): Promise<GroupMember[]> => {
    const response = await api.get<GroupMember[]>(
      PHASED_REPORT_ENDPOINTS.MEMBERS_BY_TOPIC(topicId),
    );
    const arr = Array.isArray(response.data) ? response.data : [];
    return arr.map((m) => ({
      ...m,
      id: m.groupMemberId ?? m.id,
      isLeader: Boolean(m.isLeader || m.leaderId),
    }));
  },

  submitLeaderReport: async (
    payload: WirePhasedReportSubmitRequest,
  ): Promise<PhasedReport> => {
    const response = await api.post<PhasedReport | { message?: string; data?: PhasedReport }>(
      PHASED_REPORT_ENDPOINTS.SUBMIT,
      payload,
    );
    const resData = (response.data as { data?: PhasedReport }).data ?? response.data;
    return normalizePhasedReport(resData as PhasedReport);
  },

  evaluateReport: async (
    phasedReportId: number,
    payload: PhasedReportEvaluationRequest,
  ): Promise<PhasedReport> => {
    const response = await api.put<PhasedReport | { message?: string; data?: PhasedReport }>(
      PHASED_REPORT_ENDPOINTS.EVALUATE(phasedReportId),
      payload,
    );
    const resData = (response.data as { data?: PhasedReport }).data ?? response.data;
    return normalizePhasedReport(resData as PhasedReport);
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Lecturer-owned helpers (Agent-1)
// ────────────────────────────────────────────────────────────────────────────

// Lecturer review payload. The BE lacks structured feedback columns per the
// gap ticket §E.5, so the FE embeds:
//   - numeric grade            → `lectureFeedback` (0..10)
//   - free-text feedback        → `finalOutcomeEvaluation`
//   - rejection reason (REJECTED only) → `capacityEvaluation` (until BE ships
//     a structured `FeedbackComment` column).
export interface LecturerEvaluationRequest {
  lectureFeedback?: number;
  finalOutcomeEvaluation: string;
  rejectionReason?: string;
  capacityEvaluation?: string;
  lecturerDescription?: string;
}

// Evaluate (approve) a report. Transitions SUBMITTED → EVALUATED / Passed.
export const evaluatePhasedReport = async (
  id: number,
  payload: LecturerEvaluationRequest,
): Promise<PhasedReport> => {
  try {
    return await phasedReportService.evaluateReport(id, {
      lecturerDescription: payload.lecturerDescription || payload.finalOutcomeEvaluation,
      lectureFeedback: payload.lectureFeedback ?? 9.0,
      capacityEvaluation: payload.capacityEvaluation || 'Tốt',
      finalOutcomeEvaluation: payload.finalOutcomeEvaluation,
      status: 'Passed',
    });
  } catch {
    const body: StrictPhasedReportUpdateRequest = {
      researchGroupId: null,
      groupMemberId: null,
      reportFileUrl: null,
      capacityEvaluation: payload.capacityEvaluation || null,
      finalOutcomeEvaluation: payload.finalOutcomeEvaluation,
      lectureFeedback: payload.lectureFeedback ?? null,
      submittedAt: null,
    };
    const wire = {
      ...body,
      status: 'EVALUATED',
    } as StrictPhasedReportUpdateRequest & { status: string };
    return phasedReportService.update(id, wire);
  }
};

// Reject a report. Transitions SUBMITTED → REJECTED / Rejected.
export const rejectPhasedReport = async (
  id: number,
  payload: LecturerEvaluationRequest,
): Promise<PhasedReport> => {
  const trimmedReason = (payload.rejectionReason ?? '').trim();
  const trimmedOutcome = payload.finalOutcomeEvaluation.trim();
  if (!trimmedReason && !trimmedOutcome) {
    throw new Error(
      'A rejection reason or feedback note is required when rejecting a report.',
    );
  }
  try {
    return await phasedReportService.evaluateReport(id, {
      lecturerDescription: payload.lecturerDescription || trimmedReason || trimmedOutcome,
      lectureFeedback: payload.lectureFeedback ?? null,
      capacityEvaluation: trimmedReason || trimmedOutcome,
      finalOutcomeEvaluation: trimmedOutcome,
      status: 'Rejected',
    });
  } catch {
    const body: StrictPhasedReportUpdateRequest = {
      researchGroupId: null,
      groupMemberId: null,
      reportFileUrl: null,
      capacityEvaluation: trimmedReason || trimmedOutcome,
      finalOutcomeEvaluation: trimmedOutcome,
      lectureFeedback: payload.lectureFeedback ?? null,
      submittedAt: null,
    };
    const wire = {
      ...body,
      status: 'REJECTED',
    } as StrictPhasedReportUpdateRequest & { status: string };
    return phasedReportService.update(id, wire);
  }
};

// Filter helper used by the Lecturer review console. We don't have a
// server-side `?lecturerId=` filter on PhasedReport (the column doesn't exist
// on the BE per the gap ticket §E.5), so the consumer does the join:
//   1. GET /api/ResearchGroup (filter by lecturerId client-side)
//   2. GET /api/PhasedReport (defensive list)
//   3. Keep reports whose `researchGroupId` is in the lecturer's group set
export const filterPhasedReportsByGroupIds = (
  reports: readonly PhasedReport[],
  groupIds: readonly number[],
): PhasedReport[] => {
  const set = new Set(groupIds.filter((id): id is number => typeof id === 'number'));
  return reports.filter((r) => {
    const gid = r.researchGroupId;
    return gid !== null && gid !== undefined && set.has(gid);
  });
};

// Narrow a list to the statuses the Lecturer review console shows by default.
// WAITING reports have no student submission yet, but we still surface them so
// the lecturer can pre-create a milestone row if they want to.
export const filterPhasedReportsAwaitingReview = (
  reports: readonly PhasedReport[],
): PhasedReport[] =>
  reports.filter(
    (r) => r.status === 'SUBMITTED' || r.status === 'REJECTED' || r.status === 'WAITING',
  );

// ────────────────────────────────────────────────────────────────────────────
// Graduate-Student-owned helpers (Agent-2)
// ────────────────────────────────────────────────────────────────────────────
//
// These functions share the file with the Lecturer-owned evaluate/reject
// helpers per the contract §8 "split by function name, not file". Agent 1
// does NOT edit this section; Agent 2 does NOT edit the section above.
// If a name collision appears, request a rename from the lead.

// Submission-owned request bodies. The BE contract is permissive (per
// docs/local-only/research-workflow-contract.md §1) so these accept the
// optional fields documented on StrictPhasedReportCreateRequest plus a
// `previousReportId` for resubmission lineage.
export interface PhasedReportSubmitRequest {
  phasedReportId?: number;
  topicId?: number;
  phaseNumber?: number;
  researchGroupId: number;
  groupMemberId?: number;
  reportFileUrl: string;
  submittedAt?: string;
}

export interface PhasedReportResubmitRequest extends PhasedReportSubmitRequest {
  previousReportId?: number;
}

// Strict type returned to the FE — narrows PhasedReport so callers don't
// have to deal with the nullable fields Agent 1's service tolerates.
export interface SubmittedPhasedReport {
  id: number;
  researchGroupId: number;
  groupMemberId?: number;
  reportFileUrl?: string;
  capacityEvaluation?: string;
  finalOutcomeEvaluation?: string;
  lectureFeedback?: number;
  submittedAt?: string;
  status: PhasedReportStatus;
  // Forward-compatible lineage pointer — populated by `resubmitPhasedReport`
  // when the BE echoes the structured `PreviousReportId` column back. Until
  // BE ships that column the sentinel-based detection in
  // `parsePhasedReportLineage` is the primary signal.
  previousReportId?: number;
}

const toStrict = (raw: PhasedReport): SubmittedPhasedReport => {
  const id = typeof raw.id === 'number' && raw.id > 0
    ? raw.id
    : typeof raw.phasedReportId === 'number' && raw.phasedReportId > 0
    ? raw.phasedReportId
    : 0;
  const researchGroupId =
    typeof raw.researchGroupId === 'number' && raw.researchGroupId > 0
      ? raw.researchGroupId
      : 0;
  if (id === 0 || researchGroupId === 0) {
    throw new Error(
      'PhasedReport: missing required id/researchGroupId in BE response',
    );
  }
  const status = normalizePhasedReportStatus(raw.status ?? null);
  const base: SubmittedPhasedReport = {
    id,
    researchGroupId,
    ...(typeof raw.groupMemberId === 'number'
      ? { groupMemberId: raw.groupMemberId }
      : {}),
    ...(typeof raw.reportFileUrl === 'string' && raw.reportFileUrl.length > 0
      ? { reportFileUrl: raw.reportFileUrl }
      : {}),
    ...(typeof raw.capacityEvaluation === 'string'
      ? { capacityEvaluation: raw.capacityEvaluation }
      : {}),
    ...(typeof raw.finalOutcomeEvaluation === 'string'
      ? { finalOutcomeEvaluation: raw.finalOutcomeEvaluation }
      : {}),
    ...(typeof raw.lectureFeedback === 'number'
      ? { lectureFeedback: raw.lectureFeedback }
      : {}),
    ...(typeof raw.submittedAt === 'string'
      ? { submittedAt: raw.submittedAt }
      : {}),
    status,
  };
  // BE echoes `previousReportId` (preferred over sentinel detection) when the
  // structured lineage column ships — see api-gap-ticket-for-be.md §E.5.1.
  // We accept either the camelCase or the snake_case variant.
  const rawPrev =
    (raw as { previousReportId?: unknown }).previousReportId ??
    (raw as { PreviousReportId?: unknown }).PreviousReportId;
  if (typeof rawPrev === 'number' && rawPrev > 0) {
    return { ...base, previousReportId: rawPrev };
  }
  return base;
};

export const listReportsForGroup = async (
  researchGroupId: number,
): Promise<SubmittedPhasedReport[]> => {
  try {
    const response = await api.get<unknown>(
      API_ENDPOINTS.RESEARCH_WORKFLOW.PHASED_REPORT.BY_GROUP(researchGroupId),
    );
    const arr = Array.isArray(response.data) ? (response.data as PhasedReport[]) : [];
    return arr.map(toStrict);
  } catch {
    const fallbackResponse = await api.get<unknown>(
      API_ENDPOINTS.RESEARCH_WORKFLOW.PHASED_REPORT.GET_ALL,
      { params: { researchGroupId } },
    );
    const arr = Array.isArray(fallbackResponse.data) ? (fallbackResponse.data as PhasedReport[]) : [];
    return arr.map(toStrict).filter((r) => r.researchGroupId === researchGroupId);
  }
};

// Sentinel used by `resubmitPhasedReport` to thread the lineage pointer
// through the existing `capacityEvaluation` BE column until BE ships the
// structured `PreviousReportId` column (api-gap-ticket-for-be.md §E.5.1).
// Format (no spaces around `:`) per lead-phase-c-contract.md G2(a):
//   __LINEAGE__:Resubmitted from report #<id>
export const PHASED_REPORT_LINEAGE_SENTINEL = '__LINEAGE__:';

export interface PhasedReportLineage {
  previousReportId: number | null;
  remainder: string;
}

/**
 * Parse the lineage sentinel from a `capacityEvaluation` blob. Detects the
 * `__LINEAGE__:` prefix and extracts `Resubmitted from report #N` into
 * `previousReportId`. Returns the remainder of the string (everything that
 * followed the parsed lineage pointer, or the original input if no prefix
 * was present) so callers can render the actual lecturer rejection reason
 * without showing the lineage as part of it.
 *
 * Backward-compatible: rows that pre-date the sentinel round-trip cleanly
 * with `previousReportId: null` and `remainder: <original raw>`.
 */
export const parsePhasedReportLineage = (
  raw: string | undefined,
): PhasedReportLineage => {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { previousReportId: null, remainder: '' };
  }
  if (!raw.startsWith(PHASED_REPORT_LINEAGE_SENTINEL)) {
    return { previousReportId: null, remainder: raw };
  }
  const body = raw.slice(PHASED_REPORT_LINEAGE_SENTINEL.length);
  const match = body.match(/^Resubmitted from report #(\d+)(?:[\s\u00A0]*(.*))?$/s);
  if (!match) {
    // Sentinel prefix present but body malformed — keep the raw string in
    // `remainder` so a human-readable warning can render without crashing.
    return { previousReportId: null, remainder: raw };
  }
  const id = Number(match[1]);
  const rest = typeof match[2] === 'string' ? match[2] : '';
  return {
    previousReportId: Number.isFinite(id) && id > 0 ? id : null,
    remainder: rest,
  };
};

// POST /api/PhasedReport/submit — fresh submission by Leader.
export const submitPhasedReport = async (
  payload: PhasedReportSubmitRequest,
): Promise<SubmittedPhasedReport> => {
  try {
    const leaderRes = await phasedReportService.submitLeaderReport({
      phasedReportId: payload.phasedReportId,
      topicId: payload.topicId,
      phaseNumber: payload.phaseNumber,
      researchGroupId: payload.researchGroupId,
      groupMemberId: payload.groupMemberId ?? 0,
      reportFileUrl: payload.reportFileUrl,
    });
    return toStrict(leaderRes);
  } catch {
    const baseBody: StrictPhasedReportCreateRequest = {
      researchGroupId: payload.researchGroupId,
      groupMemberId: typeof payload.groupMemberId === 'number' ? payload.groupMemberId : null,
      reportFileUrl: payload.reportFileUrl,
      capacityEvaluation: null,
      finalOutcomeEvaluation: null,
      lectureFeedback: null,
      submittedAt: payload.submittedAt ?? new Date().toISOString(),
    };
    const wire = {
      ...baseBody,
      status: 'SUBMITTED',
    } as StrictPhasedReportCreateRequest & { status: string };
    const response = await api.post<PhasedReport>(
      API_ENDPOINTS.RESEARCH_WORKFLOW.PHASED_REPORT.CREATE,
      wire,
    );
    return toStrict(response.data);
  }
};

// Resubmission of a previously REJECTED report. The BE has no dedicated
// resubmit endpoint; we POST a fresh row, threading `previousReportId` via
// a stable sentinel `__LINEAGE__:Resubmitted from report #N` written into
// `capacityEvaluation`. The sentinel is the primary signal that both sides
// (Lecturer EvaluateReportModal, Grad RejectionFeedbackBanner) detect via
// `parsePhasedReportLineage`. Until BE ships the structured
// `PreviousReportId` column (gap ticket §E.5.1) this round-trip is how
// lineage is preserved.
export const resubmitPhasedReport = async (
  payload: PhasedReportResubmitRequest,
): Promise<SubmittedPhasedReport> => {
  const baseBody: StrictPhasedReportCreateRequest = {
    researchGroupId: payload.researchGroupId,
    groupMemberId: typeof payload.groupMemberId === 'number' ? payload.groupMemberId : null,
    reportFileUrl: payload.reportFileUrl,
    capacityEvaluation:
      typeof payload.previousReportId === 'number'
        ? `__LINEAGE__:Resubmitted from report #${payload.previousReportId}`
        : null,
    finalOutcomeEvaluation: null,
    lectureFeedback: null,
    submittedAt: payload.submittedAt ?? new Date().toISOString(),
  };
  // When `previousReportId` is absent, strip `capacityEvaluation` entirely
  // so the wire body matches the prior service contract (no lineage pointer
  // sent). When present, keep it (the sentinel IS the lineage pointer).
  if (typeof payload.previousReportId !== 'number') {
    delete (baseBody as Partial<StrictPhasedReportCreateRequest>).capacityEvaluation;
  }
  const wire = {
    ...baseBody,
    status: 'SUBMITTED',
  } as StrictPhasedReportCreateRequest & { status: string };
  const response = await api.post<PhasedReport>(
    API_ENDPOINTS.RESEARCH_WORKFLOW.PHASED_REPORT.CREATE,
    wire,
  );
  return toStrict(response.data);
};

export default phasedReportService;
