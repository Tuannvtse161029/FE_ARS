// usePhasedReports — read-side hook for the Graduate Student workspace.
// Loads the list of PhasedReports for a given researchGroupId via
// `listReportsForGroup` (which already normalizes the unknown BE shape).
// Returns loading / error / data / refetch plus a `latestByStatus` helper
// for the workspace table.

import { useCallback, useEffect, useState } from 'react';
import {
  listReportsForGroup,
  type SubmittedPhasedReport,
} from '../services/phasedReport.service';
import type { PhasedReportStatus } from '../types/research';

export interface UsePhasedReportsState {
  reports: SubmittedPhasedReport[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  latestByStatus: (status: PhasedReportStatus) => SubmittedPhasedReport | null;
}

export function usePhasedReports(
  researchGroupId: number | null,
): UsePhasedReportsState {
  const [reports, setReports] = useState<SubmittedPhasedReport[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(researchGroupId !== null);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (researchGroupId === null) {
      setReports([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await listReportsForGroup(researchGroupId);
      setReports(data);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to load reports');
      setError(e);
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, [researchGroupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const latestByStatus = useCallback(
    (status: PhasedReportStatus): SubmittedPhasedReport | null => {
      const matches = reports
        .filter((r) => r.status === status)
        .sort((a, b) => {
          const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          return bTime - aTime;
        });
      return matches[0] ?? null;
    },
    [reports],
  );

  return {
    reports,
    isLoading,
    error,
    refetch: load,
    latestByStatus,
  };
}

export default usePhasedReports;