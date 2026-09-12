import { useCallback, useState } from 'react';
import {
  evaluatePhasedReport,
  rejectPhasedReport,
  type LecturerEvaluationRequest,
  type PhasedReport,
} from '../services/phasedReport.service';
import api from '../services/axios';
import { API_ENDPOINTS } from '../utils/constants';
import { notificationService } from '../services/notification.service';

type EvaluateAction = 'approve' | 'reject';

interface UseEvaluatePhasedReportState {
  isLoading: boolean;
  error: Error | null;
  result: PhasedReport | null;
}

interface UseEvaluatePhasedReportReturn extends UseEvaluatePhasedReportState {
  submit: (
    action: EvaluateAction,
    payload: LecturerEvaluationRequest,
  ) => Promise<PhasedReport | null>;
  reset: () => void;
}

// Wraps `evaluatePhasedReport` / `rejectPhasedReport` so the
// EvaluateReportModal can call one function with an "approve" / "reject" intent
// instead of branching on the action type. Defensive: surfaces the BE error
// message verbatim when the PUT fails.
export const useEvaluatePhasedReport = (
  reportId: number | null,
): UseEvaluatePhasedReportReturn => {
  const [state, setState] = useState<UseEvaluatePhasedReportState>({
    isLoading: false,
    error: null,
    result: null,
  });

  const submit = useCallback(
    async (
      action: EvaluateAction,
      payload: LecturerEvaluationRequest,
    ): Promise<PhasedReport | null> => {
      if (reportId === null) {
        const e = new Error('No report selected for evaluation.');
        setState({ isLoading: false, error: e, result: null });
        return null;
      }
      setState({ isLoading: true, error: null, result: null });
      try {
        const updated =
          action === 'approve'
            ? await evaluatePhasedReport(reportId, payload)
            : await rejectPhasedReport(reportId, payload);
        setState({ isLoading: false, error: null, result: updated });
        // Defensive FE notification — fire a `[Student] report evaluated`
        // (approve) or `[Student] report rejected` (reject) notification
        // to the student owner of this report. Best-effort: failures
        // never block the primary action.
        try {
          const groupMemberId = updated?.groupMemberId;
          if (typeof groupMemberId === 'number' && groupMemberId > 0) {
            const memberResp = await api.get(
              API_ENDPOINTS.RESEARCH_WORKFLOW.GROUP_MEMBER.GET_BY_ID(groupMemberId),
            );
            const member = (memberResp.data ?? {}) as {
              studentId?: number | null;
            };
            if (
              typeof member.studentId === 'number' &&
              member.studentId > 0
            ) {
              const title =
                updated?.milestoneTitle?.trim() ||
                updated?.topicTitle?.trim() ||
                `Phase ${updated?.phaseNumber ?? ''}`.trim() ||
                `Report #${reportId}`;
              const feedbackSuffix =
                payload.lecturerDescription?.trim() ||
                payload.finalOutcomeEvaluation?.trim() ||
                '';
              const message = action === 'approve'
                ? `[Student] report evaluated: "${title}" đã được giảng viên phê duyệt.`
                : `[Student] report rejected: "${title}" đã bị giảng viên từ chối${feedbackSuffix ? ` — ${feedbackSuffix}` : ''}.`;
              try {
                await notificationService.create({
                  userId: member.studentId,
                  message,
                });
              } catch (notifyErr) {
                console.warn('Failed to send phased-report evaluation notification:', notifyErr);
              }
            }
          }
        } catch (notifyFanoutErr) {
          console.warn('Failed to fan out phased-report evaluation notification:', notifyFanoutErr);
        }
        return updated;
      } catch (err) {
        const e =
          err instanceof Error
            ? err
            : new Error('Failed to submit evaluation. Please try again.');
        setState({ isLoading: false, error: e, result: null });
        return null;
      }
    },
    [reportId],
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, result: null });
  }, []);

  return { ...state, submit, reset };
};

export default useEvaluatePhasedReport;