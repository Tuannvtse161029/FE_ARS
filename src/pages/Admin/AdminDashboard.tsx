/**
 * AdminDashboard — operational landing page for the Admin role.
 *
 * The dashboard deliberately leads with live work that needs an Admin's
 * attention. It retains the existing summary and role-request APIs, but does
 * not present charts or unsupported operational counts as decision evidence.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileText as PapersIcon, Users as UsersIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { adminService } from '../../services/admin.service';
import type {
  AnalyticsMetric,
  AnalyticsRange,
  AnalyticsSummary,
  AnalyticsTimeSeries,
} from '../../types/admin';
import { MetricCard } from '../../components/workspace/MetricCard';
import styles from './AdminDashboard.module.css';

const DASHBOARD_UNAVAILABLE = 'Data unavailable. Please retry.';
const ROLE_ACCENT = 'var(--ars-admin)';

const ANALYTICS_RANGES = ['daily', 'weekly', 'monthly', 'yearly'] as const;

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const METRIC_TITLES: Record<AnalyticsMetric, string> = {
  user_registrations: 'Member growth',
  revenue: 'Revenue',
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);

const formatRevenue = (value: number) => `${formatNumber(value)} VND`;

const formatChartDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' });
};

const isRequestCancelled = (error: unknown) =>
  (error as { name?: string; code?: string })?.name === 'CanceledError' ||
  (error as { code?: string })?.code === 'ERR_CANCELED';

const logDiag = (label: string, error: unknown) => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[AdminDashboard] ${label}:`, error);
  }
};

const WidgetErrorState = ({ message, onRetry, testId }: {
  message: string;
  onRetry: () => void;
  testId: string;
}) => (
  <div className={styles.widgetError} role="alert" data-testid={testId}>
    <AlertTriangle size={16} aria-hidden="true" />
    <span>{message}</span>
    <button type="button" onClick={onRetry}>Retry</button>
  </div>
);

interface AnalyticsChartProps {
  metric: AnalyticsMetric;
  range: AnalyticsRange;
  series: AnalyticsTimeSeries | null;
  loading: boolean;
  error: string | null;
  onRangeChange: (range: AnalyticsRange) => void;
  onRetry: () => void;
}

const AnalyticsChart = ({
  metric,
  range,
  series,
  loading,
  error,
  onRangeChange,
  onRetry,
}: AnalyticsChartProps) => {
  const title = `${METRIC_TITLES[metric]} - ${RANGE_LABELS[range].toLowerCase()}`;
  const points = series?.points ?? [];
  const valueFormatter = metric === 'revenue' ? formatRevenue : formatNumber;

  return (
    <section className={styles.chartSection} aria-labelledby={`${metric}-chart-title`}>
      <div className={styles.chartHeader}>
        <div>
          <p className={styles.chartEyebrow}>Live analytics</p>
          <h2 id={`${metric}-chart-title`}>{title}</h2>
        </div>
        <div className={styles.rangeSelector} aria-label={`${METRIC_TITLES[metric]} time range`}>
          {ANALYTICS_RANGES.map((option) => (
            <button
              key={option}
              type="button"
              className={range === option ? styles.rangeButtonActive : styles.rangeButton}
              aria-pressed={range === option}
              onClick={() => onRangeChange(option)}
            >
              {RANGE_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <WidgetErrorState message={error} onRetry={onRetry} testId={`${metric}-chart-error`} />
      ) : loading ? (
        <div className={styles.chartLoading} role="status">Loading {METRIC_TITLES[metric].toLowerCase()} data...</div>
      ) : points.length === 0 ? (
        <div className={styles.chartEmpty}>No analytics data available yet.</div>
      ) : (
        <div className={styles.chartFrame}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 12, right: 8, bottom: 2, left: 0 }}>
              <title>{title}</title>
              <CartesianGrid stroke="var(--ars-network)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatChartDate}
                tick={{ fill: 'var(--ars-ink-muted)', fontSize: 11 }}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={{ stroke: 'var(--ars-node)' }}
              />
              <YAxis
                tickFormatter={(value: number) => metric === 'revenue'
                  ? new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
                  : formatNumber(value)}
                tick={{ fill: 'var(--ars-ink-muted)', fontSize: 11 }}
                width={metric === 'revenue' ? 56 : 38}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                labelFormatter={(value) => formatChartDate(String(value))}
                formatter={(value) => valueFormatter(Number(value))}
                contentStyle={{
                  background: 'var(--ars-paper-card)',
                  border: '1px solid var(--ars-node)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--ars-ink)',
                  fontSize: 'var(--font-size-sm)',
                }}
              />
              <Bar
                dataKey="value"
                name={METRIC_TITLES[metric]}
                fill={metric === 'revenue' ? 'var(--ars-admin)' : 'var(--ars-blue-action)'}
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};

export const AdminDashboard = () => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [registrations, setRegistrations] = useState<AnalyticsTimeSeries | null>(null);
  const [revenue, setRevenue] = useState<AnalyticsTimeSeries | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('monthly');
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const loadSummary = useCallback(async (signal: AbortSignal) => {
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const data = await adminService.getAnalyticsSummary(signal);
      if (!signal.aborted) setSummary(data);
    } catch (error) {
      if (signal.aborted || isRequestCancelled(error)) return;
      logDiag('summary failed', error);
      setSummaryError(DASHBOARD_UNAVAILABLE);
    } finally {
      if (!signal.aborted) setLoadingSummary(false);
    }
  }, []);

  const loadAnalytics = useCallback(async (range: AnalyticsRange, signal: AbortSignal) => {
    setLoadingAnalytics(true);
    setAnalyticsError(null);
    try {
      const [registrationData, revenueData] = await Promise.all([
        adminService.getAnalyticsTimeseries(range, 'user_registrations', signal),
        adminService.getAnalyticsTimeseries(range, 'revenue', signal),
      ]);
      if (!signal.aborted) {
        setRegistrations(registrationData);
        setRevenue(revenueData);
      }
    } catch (error) {
      if (signal.aborted || isRequestCancelled(error)) return;
      logDiag('analytics failed', error);
      setAnalyticsError(DASHBOARD_UNAVAILABLE);
    } finally {
      if (!signal.aborted) setLoadingAnalytics(false);
    }
  }, []);

  const loadAll = useCallback(async (range = analyticsRange) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;
    await Promise.allSettled([
      loadSummary(controller.signal),
      loadAnalytics(range, controller.signal),
    ]);
    if (requestId !== requestIdRef.current) return;
  }, [analyticsRange, loadAnalytics, loadSummary]);

  const handleAnalyticsRangeChange = (range: AnalyticsRange) => {
    if (range === analyticsRange) return;
    setAnalyticsRange(range);
  };

  useEffect(() => {
    void loadAll();
    return () => abortRef.current?.abort();
  }, [loadAll]);

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <section className={styles.snapshotSection} aria-labelledby="platform-snapshot-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionEyebrow}>Live snapshot</p>
              <h2 id="platform-snapshot-title">Platform records</h2>
            </div>
          </div>
          {summaryError ? (
            <WidgetErrorState message={summaryError} onRetry={() => void loadAll()} testId="summary-error" />
          ) : (
            <div className={styles.metricGrid}>
              <MetricCard label="Registered members" value={loadingSummary || summary === null ? '—' : formatNumber(summary.totalMembers)} annotation="Current total from analytics" icon={<UsersIcon size={16} />} accent={ROLE_ACCENT} />
              <MetricCard label="Published papers" value={loadingSummary || summary === null ? '—' : formatNumber(summary.totalPapers)} annotation="Current published-paper total" icon={<PapersIcon size={16} />} accent={ROLE_ACCENT} />
            </div>
          )}
        </section>

        <section className={styles.analyticsSection} aria-label="Platform analytics">
          <AnalyticsChart
            metric="user_registrations"
            range={analyticsRange}
            series={registrations}
            loading={loadingAnalytics}
            error={analyticsError}
            onRangeChange={handleAnalyticsRangeChange}
            onRetry={() => void loadAll()}
          />
          <AnalyticsChart
            metric="revenue"
            range={analyticsRange}
            series={revenue}
            loading={loadingAnalytics}
            error={analyticsError}
            onRangeChange={handleAnalyticsRangeChange}
            onRetry={() => void loadAll()}
          />
        </section>

      </div>
    </div>
  );
};

export default AdminDashboard;
