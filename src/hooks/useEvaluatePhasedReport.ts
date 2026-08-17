import { useCallback, useState } from 'react';
import {
  evaluatePhasedReport,
  rejectPhasedReport,
  type LecturerEvaluationRequest,
  type PhasedReport,
} from '../services/phasedReport.service';

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