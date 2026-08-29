/**
 * AdminDashboard — System Observatory
 * ARS Research Constellation — Admin Landing Page
 *
 * Workspace hero + metric cards + analytics charts + activity feed.
 * Recharts are used only when the API returns data; the surface degrades
 * to honest unavailable states on failure.
 */
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
import { WorkspaceHeader } from '../../components/workspace/WorkspaceHeader';
import { MetricCard } from '../../components/workspace/MetricCard';
import { ActivityFeed, type ActivityEntry } from '../../components/workspace/ActivityFeed';
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

const DASHBOARD_UNAVAILABLE = 'Data unavailable. Please retry.';

const formatNumber = (n: number) =>
  new Intl.NumberFormat('vi-VN').format(n);

const formatRevenue = (n: number) =>
  new Intl.NumberFormat('vi-VN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n) + ' VND';

const formatDate = (iso: string) => {
  if (iso.length === 7) return iso;
  if (iso.length === 4) return iso;
  return iso.slice(5);
};

const logDiag = (label: string, err: unknown) => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[AdminDashboard] ${label}:`, err);
  }
};

const ROLE_ACCENT = 'var(--ars-admin)';

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
    <AlertTriangle size={14} />
    <span>{message}</span>
    <button type="button" onClick={onRetry}>
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
  <div className={styles.chartCard}>
    <div className={styles.chartHeader}>
      <h3 className={styles.chartTitle}>{title}</h3>
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
              contentStyle={{ fontSize: '0.78rem', borderRadius: 4, border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="value" fill="#7c3aed" radius={[2, 2, 0, 0]} />
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
  const [loadingRecentRequests, setLoadingRecentRequests] = useState(true);

  const [range, setRange] = useState<Range>('monthly');

  const requestIdRef = useRef(0);
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
    try {
      const data = await adminService.getRoleRequests(signal);
      if (!signal.aborted) setRecentRequests(data.slice(0, 8));
    } catch (err) {
      logDiag('recent role requests failed', err);
      if (!signal.aborted) setRecentRequests([]);
    } finally {
      if (!signal.aborted) setLoadingRecentRequests(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    const myRequestId = ++requestIdRef.current;
    await Promise.allSettled([
      loadSummary(signal),
      loadSeries('user_registrations', signal),
      loadSeries('revenue', signal),
      loadRecentRequests(signal),
    ]);
    if (myRequestId !== requestIdRef.current) return;
  }, [loadRecentRequests, loadSeries, loadSummary]);

  useEffect(() => {
    void loadAll();
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Activity entries from role requests
  const requestActivity: ActivityEntry[] = recentRequests.map((r) => ({
    id: String(r.id),
    title: r.userName,
    meta: r.email,
    tag: (
      <span className={`${styles.statusTag} ${styles[`statusTag${r.status}`] ?? ''}`}>
        {r.status}
      </span>
    ),
    time: new Date(r.submissionDate).toLocaleDateString('vi-VN'),
    onClick: () => onSelectRoleRequest?.(r),
  }));

  return (
    <div className={styles.page}>
      {/* Workspace Header */}
      <WorkspaceHeader
        marker="01 / SYSTEM OBSERVATORY"
        title="Platform Dashboard"
        subtitle="System-wide metrics, role request queue, and platform health at a glance."
        accent={ROLE_ACCENT}
        annotation={`Analytics period: ${RANGE_LABEL[range]}`}
        actions={
          <div className={styles.rangePills} role="group" aria-label="Analytics time range">
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
        }
      />

      <div className={styles.content}>
        {/* ── Metric Row ─────────────────────────────── */}
        {summaryError ? (
          <div className={styles.metricGrid}>
            <WidgetErrorState
              message={summaryError}
              onRetry={() => void loadAll()}
              testId="summary-error"
            />
          </div>
        ) : (
          <div className={styles.metricGrid}>
            <MetricCard
              label="Total Members"
              value={
                loadingSummary || summary === null
                  ? '—'
                  : formatNumber(summary.totalMembers)
              }
              annotation="Cumulative registered users"
              icon={<UsersIcon size={16} />}
              accent={ROLE_ACCENT}
            />
            <MetricCard
              label="Scientific Papers"
              value={
                loadingSummary || summary === null
                  ? '—'
                  : formatNumber(summary.totalPapers)
              }
              annotation="Across all majors & sub-fields"
              icon={<PapersIcon size={16} />}
              accent={ROLE_ACCENT}
            />
          </div>
        )}

        {/* ── Charts Row ─────────────────────────────── */}
        <div className={styles.chartsRow}>
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
        </div>

        {/* ── Role Requests Activity Feed ─────────── */}
        <div className={styles.activitySection}>
          <ActivityFeed
            marker="02 / APPROVAL QUEUE"
            title="Recent Role Requests"
            entries={requestActivity}
            loading={loadingRecentRequests && recentRequests.length === 0}
            emptyMessage="No role requests yet."
          />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
