/**
 * Per-test mock for phasedReport.service.
 *
 * Lets a test seed getAll / submit / evaluate responses and capture
 * call args without re-routing axios. Imported by both service-level and
 * integration-level tests in this folder.
 */
import { vi } from 'vitest';
import type {
  PhasedReport,
  SubmittedPhasedReport,
  PhasedReportSubmitRequest,
  PhasedReportResubmitRequest,
  LecturerEvaluationRequest,
} from '../../services/phasedReport.service';

export interface MockPhasedReportState {
  getAllMock: ReturnType<typeof vi.fn>;
  submitMock: ReturnType<typeof vi.fn>;
  resubmitMock: ReturnType<typeof vi.fn>;
  evaluateMock: ReturnType<typeof vi.fn>;
  rejectMock: ReturnType<typeof vi.fn>;
  listReportsForGroupMock: ReturnType<typeof vi.fn>;
}

export const buildPhasedReportServiceMock = (
  seed: Partial<{
    getAll: PhasedReport[];
    submit: SubmittedPhasedReport;
    resubmit: SubmittedPhasedReport;
    evaluate: PhasedReport;
    reject: PhasedReport;
    listForGroup: SubmittedPhasedReport[];
  }> = {},
): MockPhasedReportState & Record<string, unknown> => {
  const getAllMock = vi.fn(async () => seed.getAll ?? []);
  const submitMock = vi.fn(
    async (payload: PhasedReportSubmitRequest): Promise<SubmittedPhasedReport> => {
      if (seed.submit instanceof Promise) return seed.submit;
      return (
        seed.submit ?? {
          id: 100,
          researchGroupId: payload.researchGroupId,
          groupMemberId: payload.groupMemberId,
          reportFileUrl: payload.reportFileUrl,
          submittedAt: payload.submittedAt ?? new Date().toISOString(),
          status: 'SUBMITTED' as const,
        }
      );
    },
  );
  const resubmitMock = vi.fn(
    async (
      payload: PhasedReportResubmitRequest,
    ): Promise<SubmittedPhasedReport> => {
      if (seed.resubmit instanceof Promise) return seed.resubmit;
      return (
        seed.resubmit ?? {
          id: 200,
          researchGroupId: payload.researchGroupId,
          groupMemberId: payload.groupMemberId,
          reportFileUrl: payload.reportFileUrl,
          submittedAt: new Date().toISOString(),
          status: 'SUBMITTED' as const,
        }
      );
    },
  );
  const evaluateMock = vi.fn(
    async (
      id: number,
      payload: LecturerEvaluationRequest,
    ): Promise<PhasedReport> => {
      if (seed.evaluate instanceof Promise) return seed.evaluate;
      return (
        seed.evaluate ?? {
          id,
          researchGroupId: 7,
          status: 'EVALUATED',
          lectureFeedback: payload.lectureFeedback ?? null,
          finalOutcomeEvaluation: payload.finalOutcomeEvaluation,
        }
      );
    },
  );
  const rejectMock = vi.fn(
    async (
      id: number,
      payload: LecturerEvaluationRequest,
    ): Promise<PhasedReport> => {
      if (seed.reject instanceof Promise) return seed.reject;
      return (
        seed.reject ?? {
          id,
          researchGroupId: 7,
          status: 'REJECTED',
          lectureFeedback: payload.lectureFeedback ?? null,
          finalOutcomeEvaluation: payload.finalOutcomeEvaluation,
          capacityEvaluation: payload.rejectionReason ?? payload.finalOutcomeEvaluation,
        }
      );
    },
  );
  const listReportsForGroupMock = vi.fn(async () => seed.listForGroup ?? []);

  return {
    getAllMock,
    submitMock,
    resubmitMock,
    evaluateMock,
    rejectMock,
    listReportsForGroupMock,
    // Service module surface
    phasedReportService: {
      getAll: getAllMock,
      getById: vi.fn(),
      create: submitMock,
      update: vi.fn(),
      delete: vi.fn(),
    },
    submitPhasedReport: submitMock,
    resubmitPhasedReport: resubmitMock,
    evaluatePhasedReport: evaluateMock,
    rejectPhasedReport: rejectMock,
    listReportsForGroup: listReportsForGroupMock,
    filterPhasedReportsByGroupIds: (
      reports: readonly PhasedReport[],
      groupIds: readonly number[],
    ): PhasedReport[] => {
      const set = new Set(
        groupIds.filter((id): id is number => typeof id === 'number'),
      );
      return reports.filter((r) => {
        const gid = r.researchGroupId;
        return gid !== null && gid !== undefined && set.has(gid);
      });
    },
    filterPhasedReportsAwaitingReview: (
      reports: readonly PhasedReport[],
    ): PhasedReport[] =>
      reports.filter(
        (r) =>
          r.status === 'SUBMITTED' ||
          r.status === 'REJECTED' ||
          r.status === 'WAITING',
      ),
    normalizePhasedReportStatus: (raw: string | null | undefined) => {
      if (!raw) return 'WAITING';
      const v = raw.toLowerCase().trim();
      if (v === 'submitted') return 'SUBMITTED';
      if (v === 'rejected' || v === 'denied') return 'REJECTED';
      if (v === 'evaluated' || v === 'approved') return 'EVALUATED';
      return 'WAITING';
    },
  };
};