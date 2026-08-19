import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Users as UsersIcon, FileText as PapersIcon } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { adminService } from '../../services/admin.service';
import type {
  AnalyticsSummary,
  AnalyticsTimeSeries,
  AnalyticsRange,
  AnalyticsMetric,
  RoleRequest,
} from '../../types/admin';
import styles from './AdminDashboard.module.css';

type Range = AnalyticsRange;
type Metric = AnalyticsMetric;

const RANGES: Range[] = ['daily', 'weekly', 'monthly', 'yearly'];
const RANGE_LABEL: Record<Range, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

// Surface-level messages: NEVER leak raw axios messages to admins.
const DASHBOARD_UNAVAILABLE = 'Data unavailable. Please retry.';
// Recent role-requests widget uses the role-requests-specific copy so the
// dashboard widget text matches the dedicated RoleRequests page.
const RECENT_REQUESTS_UNAVAILABLE =
  'Role requests could not be loaded. The Admin API contract may have changed.';

const formatNumber = (n: number) =>
  new Intl.NumberFormat('vi-VN').format(n);

const formatRevenue = (n: number) =>
  new Intl.NumberFormat('vi-VN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n) + ' VND';

const formatDate = (iso: string) => {
  if (iso.length === 7) return iso; // YYYY-MM (monthly)
  if (iso.length === 4) return iso; // YYYY (yearly)
  return iso.slice(5); // YYYY-MM-DD -> MM-DD
};

// DEV-only diagnostic — keeps the technical detail out of the UI.
const logDiag = (label: string, err: unknown) => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[AdminDashboard] ${label}:`, err);
  }
};

const MetricCard = ({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
}) => (
  <div className={styles.metricCard}>
    <div className={styles.metricIcon}>{icon}</div>
    <div className={styles.metricBody}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
      {hint && <span className={styles.metricHint}>{hint}</span>}
    </div>
  </div>
);

const WidgetErrorState = ({
  message,
  onRetry,
  testId,
}: {
  message: string;
  onRetry: () => void;
  testId: string;
}) => (
  <div
    className={styles.widgetError}
    role="alert"
    data-testid={testId}
  >
    <AlertTriangle size={16} />
    <span>{message}</span>
    <button type="button" className={styles.retryBtn} onClick={onRetry}>
      Retry
    </button>
  </div>
);

const ChartCard = ({
  title,
  metric,
  series,
  loading,
  error,
  onRetry,
}: {
  title: string;
  metric: Metric;
  series: AnalyticsTimeSeries | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) => (
  <div className={styles.chartSection}>
    <div className={styles.chartHeader}>
      <span className={styles.chartTitle}>{title}</span>
    </div>
    {error ? (
      <WidgetErrorState
        message={error}
        onRetry={onRetry}
        testId={`chart-error-${metric}`}
      />
    ) : loading || !series ? (
      <div className={styles.chartSkeleton} role="status">
        Loading chart data…
      </div>
    ) : (
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={series.points}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => formatDate(d)}
              tick={{ fontSize: 10, fill: '#64748b' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) =>
                metric === 'revenue' ? formatRevenue(v) : formatNumber(v)
              }
              tick={{ fontSize: 10, fill: '#64748b' }}
              width={70}
            />
            <Tooltip
              formatter={(value) =>
                metric === 'revenue'
                  ? [new Intl.NumberFormat('vi-VN').format(Number(value)) + ' VND', title]
                  : [formatNumber(Number(value)), title]
              }
              contentStyle={{ fontSize: '0.78rem', borderRadius: 6 }}
            />
            <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

interface AdminDashboardProps {
  onSelectRoleRequest?: (request: RoleRequest) => void;
}

export const AdminDashboard = ({ onSelectRoleRequest }: AdminDashboardProps) => {
  // Each widget owns its loading + error flag. A failure in one widget must
  // NOT leave the others loading forever or convert them to fake `0` values.
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [registrations, setRegistrations] = useState<AnalyticsTimeSeries | null>(null);
  const [registrationsError, setRegistrationsError] = useState<string | null>(null);
  const [loadingRegistrations, setLoadingRegistrations] = useState(true);

  const [revenue, setRevenue] = useState<AnalyticsTimeSeries | null>(null);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [loadingRevenue, setLoadingRevenue] = useState(true);

  const [recentRequests, setRecentRequests] = useState<RoleRequest[]>([]);
  const [recentRequestsError, setRecentRequestsError] = useState<string | null>(null);
  const [loadingRecentRequests, setLoadingRecentRequests] = useState(true);

  const [range, setRange] = useState<Range>('monthly');

  // Stale-response guard: only the latest request id may commit results.
  const requestIdRef = useRef(0);
  // Track the in-flight load so unmount/period-changes can cancel via AbortController.
  const abortRef = useRef<AbortController | null>(null);

  const loadSummary = useCallback(async (signal: AbortSignal) => {
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const data = await adminService.getAnalyticsSummary(signal);
      if (!signal.aborted) setSummary(data);
    } catch (err) {
      logDiag('summary failed', err);
      if (!signal.aborted) setSummaryError(DASHBOARD_UNAVAILABLE);
    } finally {
      if (!signal.aborted) setLoadingSummary(false);
    }
  }, []);

  const loadSeries = useCallback(
    async (metric: Metric, signal: AbortSignal) => {
      const isRevenue = metric === 'revenue';
      if (isRevenue) {
        setLoadingRevenue(true);
        setRevenueError(null);
      } else {
        setLoadingRegistrations(true);
        setRegistrationsError(null);
      }
      try {
        const data = await adminService.getAnalyticsTimeseries(range, metric, signal);
        if (signal.aborted) return;
        if (isRevenue) setRevenue(data);
        else setRegistrations(data);
      } catch (err) {
        logDiag(`timeseries(${metric}) failed`, err);
        if (signal.aborted) return;
        if (isRevenue) setRevenueError(DASHBOARD_UNAVAILABLE);
        else setRegistrationsError(DASHBOARD_UNAVAILABLE);
      } finally {
        if (signal.aborted) return;
        if (isRevenue) setLoadingRevenue(false);
        else setLoadingRegistrations(false);
      }
    },
    [range],
  );

  const loadRecentRequests = useCallback(async (signal: AbortSignal) => {
    setLoadingRecentRequests(true);
    setRecentRequestsError(null);
    try {
      const data = await adminService.getRoleRequests(signal);
      if (!signal.aborted) setRecentRequests(data.slice(0, 5));
    } catch (err) {
      logDiag('recent role requests failed', err);
      if (!signal.aborted) {
        setRecentRequests([]);
        setRecentRequestsError(RECENT_REQUESTS_UNAVAILABLE);
      }
    } finally {
      if (!signal.aborted) setLoadingRecentRequests(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    // Cancel any in-flight load and start a fresh one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    // Bump the request id guard as a belt-and-braces fallback in case
    // AbortController isn't honored by an upstream mock.
    const myRequestId = ++requestIdRef.current;

    // Fire all four independently with their own loading flags so a
    // rejection in one does NOT block the others from settling.
    await Promise.allSettled([
      loadSummary(signal),
      loadSeries('user_registrations', signal),
      loadSeries('revenue', signal),
      loadRecentRequests(signal),
    ]);
    // If a newer load started, do nothing — the new load owns the state.
    if (myRequestId !== requestIdRef.current) return;
  }, [loadRecentRequests, loadSeries, loadSummary]);

  // Initial mount: load every widget once. We deliberately omit `loadAll`
  // from the deps because `loadSeries` is range-dependent and would change
  // identity on every period change, causing a full summary + recent-requests
  // refetch. The range-specific effect below owns series refetches.
  useEffect(() => {
    void loadAll();
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Period pills only re-trigger the period-dependent data. Summary and
  // recent-requests don't depend on `range`, so they aren't refetched.
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const myRequestId = ++requestIdRef.current;
    void Promise.allSettled([
      loadSeries('user_registrations', controller.signal),
      loadSeries('revenue', controller.signal),
    ]).then(() => {
      if (myRequestId !== requestIdRef.current) return;
    });
  }, [range, loadSeries]);

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        Home &gt; <span className={styles.activeBreadcrumb}>Admin Dashboard</span>
      </div>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Admin Dashboard</h1>
          <p className={styles.pageSubtitle}>
            System-wide metrics, role requests, and revenue at a glance.
          </p>
        </div>
        <div className={styles.rangePills}>
          {RANGES.map((r) => (
            <button
              key={r}
              className={`${styles.rangePill} ${range === r ? styles.rangePillActive : ''}`}
              onClick={() => setRange(r)}
              type="button"
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.metricRow}>
        {summaryError ? (
          <WidgetErrorState
            message={summaryError}
            onRetry={() => void loadAll()}
            testId="summary-error"
          />
        ) : (
          <>
            <MetricCard
              icon={<UsersIcon size={22} />}
              label="Total Members"
              value={loadingSummary || summary === null ? '—' : formatNumber(summary.totalMembers)}
              hint={loadingSummary ? 'Loading…' : 'Cumulative registered users'}
            />
            <MetricCard
              icon={<PapersIcon size={22} />}
              label="Scientific Papers"
              value={loadingSummary || summary === null ? '—' : formatNumber(summary.totalPapers)}
              hint={loadingSummary ? 'Loading…' : 'Across all majors & sub-fields'}
            />
          </>
        )}
      </div>

      <ChartCard
        title="User Newly Register"
        metric="user_registrations"
        series={registrations}
        loading={loadingRegistrations}
        error={registrationsError}
        onRetry={() => void loadAll()}
      />

      <ChartCard
        title="Revenue"
        metric="revenue"
        series={revenue}
        loading={loadingRevenue}
        error={revenueError}
        onRetry={() => void loadAll()}
      />

      <div className={styles.recentSection}>
        <span className={styles.sectionTitle}>Recent Role Requests</span>
        {recentRequestsError ? (
          <WidgetErrorState
            message={recentRequestsError}
            onRetry={() => void loadAll()}
            testId="recent-requests-error"
          />
        ) : loadingRecentRequests && recentRequests.length === 0 ? (
          <div className={styles.emptyState}>Loading role requests…</div>
        ) : recentRequests.length === 0 ? (
          <div className={styles.emptyState}>No role requests yet.</div>
        ) : (
          <table className={styles.recentTable}>
            <thead>
              <tr>
                <th>User</th>
                <th>Roles</th>
                <th>Submitted</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recentRequests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className={styles.userCell}>
                      <span className={styles.userName}>{r.userName}</span>
                      <span className={styles.userEmail}>{r.email}</span>
                    </div>
                  </td>
                  <td>{r.requestedAdditionalRoles?.join(', ') || 'Unavailable'}</td>
                  <td>{new Date(r.submissionDate).toLocaleDateString('vi-VN')}</td>
                  <td>
                    <span className={`${styles.statusPill} ${styles[`status${r.status}`]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className={styles.viewDetailsBtn}
                      onClick={() => onSelectRoleRequest?.(r)}
                      type="button"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
