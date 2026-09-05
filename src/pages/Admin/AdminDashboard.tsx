/**
 * AdminDashboard — operational landing page for the Admin role.
 *
 * The dashboard deliberately leads with live work that needs an Admin's
 * attention. It retains the existing summary and role-request APIs, but does
 * not present charts or unsupported operational counts as decision evidence.
 *
 * Layout priority (Phase B — Admin priority refactor):
 *   1. Action queues  — Verification, Editorial, Reviewer, Publication
 *   2. Live snapshot  — Platform counts (members, papers)
 *   3. Analytics      — Time-series charts with labeled period/currency/units
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckSquare, FileText as PapersIcon, FileCheck, UserCheck, Users as UsersIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';
import { useI18n, useLocale } from '../../i18n/I18nContext';
import { adminService } from '../../services/admin.service';
import type {
  AnalyticsMetric,
  AnalyticsRange,
  AnalyticsSummary,
  AnalyticsTimeSeries,
} from '../../types/admin';
import { ROUTES } from '../../routes/paths';
import { MetricCard } from '../../components/workspace/MetricCard';
import styles from './AdminDashboard.module.css';

const DASHBOARD_UNAVAILABLE = 'admin.dashboard.dataUnavailable';
const ROLE_ACCENT = 'var(--ars-admin)';

/** Actionable queue definitions — links to filtered Admin views */
interface QueueCard {
  key: string;
  icon: React.ReactNode;
  labelKey: string;
  descriptionKey: string;
  href: string;
}

const QUEUE_CARDS: QueueCard[] = [
  {
    key: 'verification',
    icon: <UserCheck size={20} />,
    labelKey: 'admin.dashboard.queue.verification.label',
    descriptionKey: 'admin.dashboard.queue.verification.desc',
    href: `${ROUTES.ADMIN_ROLE_REQUESTS}?status=PENDING`,
  },
  {
    key: 'editorial',
    icon: <FileCheck size={20} />,
    labelKey: 'admin.dashboard.queue.editorial.label',
    descriptionKey: 'admin.dashboard.queue.editorial.desc',
    href: ROUTES.ADMIN_PAPER_SUBMISSIONS,
  },
  {
    key: 'reviewer',
    icon: <CheckSquare size={20} />,
    labelKey: 'admin.dashboard.queue.reviewer.label',
    descriptionKey: 'admin.dashboard.queue.reviewer.desc',
    href: ROUTES.ADMIN_REVIEWER_ASSIGNMENTS,
  },
  {
    key: 'publication',
    icon: <PapersIcon size={20} />,
    labelKey: 'admin.dashboard.queue.publication.label',
    descriptionKey: 'admin.dashboard.queue.publication.desc',
    href: ROUTES.ADMIN_PUBLISHED_PAPERS,
  },
];

const ANALYTICS_RANGES = ['daily', 'weekly', 'monthly', 'yearly'] as const;

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  daily: 'admin.dashboard.range.daily',
  weekly: 'admin.dashboard.range.weekly',
  monthly: 'admin.dashboard.range.monthly',
  yearly: 'admin.dashboard.range.yearly',
};

const METRIC_TITLES: Record<AnalyticsMetric, string> = {
  user_registrations: 'admin.dashboard.metric.user_registrations',
  revenue: 'admin.dashboard.metric.revenue',
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);

const formatRevenue = (value: number) => `${formatNumber(value)} VND`;

const formatChartDate = (value: string, locale: string = 'en') => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  // Respect the active UI locale so an English page never surfaces a
  // Vietnamese date formatter. Defaults to 'en' so the dashboard doesn't
  // depend on i18n wiring for first paint.
  const tag = locale === 'vi' ? 'vi-VN' : 'en-US';
  return date.toLocaleDateString(tag, { day: '2-digit', month: 'short' });
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

const WidgetErrorState = ({ message, onRetry, testId, t }: {
  message: string;
  onRetry: () => void;
  testId: string;
  t: (k: string) => string;
}) => (
  <div className={styles.widgetError} role="alert" data-testid={testId}>
    <AlertTriangle size={16} aria-hidden="true" />
    <span>{t(message)}</span>
    <button type="button" onClick={onRetry}>{t('admin.dashboard.retry')}</button>
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
  t: (k: string) => string;
  locale: string;
}

const AnalyticsChart = ({
  metric,
  range,
  series,
  loading,
  error,
  onRangeChange,
  onRetry,
  t,
  locale,
}: AnalyticsChartProps) => {
  const title = `${t(METRIC_TITLES[metric])} - ${t(RANGE_LABELS[range]).toLowerCase()}`;
  const points = series?.points ?? [];
  const valueFormatter = metric === 'revenue' ? formatRevenue : formatNumber;
  // The unit shown on the Y-axis and in the chart subtitle. The chart
  // never infers this from the raw number — revenue always reads as
  // VND, registrations as count, so an Admin never has to guess the
  // magnitude.
  const axisUnit = metric === 'revenue' ? 'VND' : '';

  return (
    <section className={styles.chartSection} aria-labelledby={`${metric}-chart-title`}>
      <div className={styles.chartHeader}>
        <div>
          <p className={styles.chartEyebrow}>{t('admin.dashboard.liveAnalytics')}</p>
          <h2 id={`${metric}-chart-title`}>{title}</h2>
        </div>
        <div className={styles.rangeSelector} aria-label={`${t(METRIC_TITLES[metric])} time range`}>
          {ANALYTICS_RANGES.map((option) => (
            <button
              key={option}
              type="button"
              className={range === option ? styles.rangeButtonActive : styles.rangeButton}
              aria-pressed={range === option}
              onClick={() => onRangeChange(option)}
            >
              {t(RANGE_LABELS[option])}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <WidgetErrorState message={error} onRetry={onRetry} testId={`${metric}-chart-error`} t={t} />
      ) : loading ? (
        <div className={styles.chartLoading} role="status">{t('admin.dashboard.loadingPrefix')} {t(METRIC_TITLES[metric]).toLowerCase()}...</div>
      ) : points.length === 0 ? (
        <div className={styles.chartEmpty}>{t('admin.dashboard.emptyData')}</div>
      ) : (
        <div className={styles.chartFrame}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 12, right: 8, bottom: 2, left: 0 }}>
              <title>{title}</title>
              <CartesianGrid stroke="var(--ars-network)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatChartDate(value, locale)}
                tick={{ fill: 'var(--ars-ink-muted)', fontSize: 11 }}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={{ stroke: 'var(--ars-node)' }}
              />
              <YAxis
                tickFormatter={(value: number) => metric === 'revenue'
                  ? `${new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}${axisUnit ? ' ' + axisUnit : ''}`
                  : formatNumber(value)}
                tick={{ fill: 'var(--ars-ink-muted)', fontSize: 11 }}
                width={metric === 'revenue' ? 80 : 38}
                tickLine={false}
                axisLine={false}
                label={
                  axisUnit
                    ? {
                        value: axisUnit,
                        angle: -90,
                        position: 'insideLeft',
                        fill: 'var(--ars-ink-muted)',
                        fontSize: 10,
                        fontWeight: 600,
                      }
                    : undefined
                }
              />
              <Tooltip
                labelFormatter={(value) => formatChartDate(String(value), locale)}
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
                name={t(METRIC_TITLES[metric])}
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
  const { t } = useI18n();
  const locale = useLocale();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [publishedCount, setPublishedCount] = useState<number | null>(null);
  const [publishedError, setPublishedError] = useState<string | null>(null);
  const [loadingPublished, setLoadingPublished] = useState(true);
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

  /**
   * Loads the live number of papers with `status === 'Published'` from the
   * documented `/api/Paper?status=Published` filter. The dashboard used to
   * surface `AnalyticsSummary.totalPapers`, which is the system-wide paper
   * count and does not match the Published Papers tab (BE returned 31 vs the
   * tab showing 4). Pulling from the same source as the tab eliminates the
   * mismatch.
   */
  const loadPublishedCount = useCallback(async (signal: AbortSignal) => {
    setLoadingPublished(true);
    setPublishedError(null);
    try {
      const total = await adminService.getPublishedPapersTotal(signal);
      if (!signal.aborted) setPublishedCount(total);
    } catch (error) {
      if (signal.aborted || isRequestCancelled(error)) return;
      logDiag('published count failed', error);
      setPublishedError(DASHBOARD_UNAVAILABLE);
    } finally {
      if (!signal.aborted) setLoadingPublished(false);
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
      loadPublishedCount(controller.signal),
      loadAnalytics(range, controller.signal),
    ]);
    if (requestId !== requestIdRef.current) return;
  }, [analyticsRange, loadAnalytics, loadPublishedCount, loadSummary]);

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
        {/* ── 1. Action Queues ─────────────────────────────────── */}
        <section className={styles.snapshotSection} aria-labelledby="action-queues-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionEyebrow}>{t('admin.dashboard.queueEyebrow')}</p>
              <h2 id="action-queues-title">{t('admin.dashboard.queueTitle')}</h2>
            </div>
          </div>
          <div className={styles.metricGrid}>
            {QUEUE_CARDS.map((queue) => (
              <Link
                key={queue.key}
                to={queue.href}
                className={styles.queueCard}
                aria-label={t(queue.labelKey)}
              >
                <span className={styles.queueCardIcon} aria-hidden="true">
                  {queue.icon}
                </span>
                <span className={styles.queueCardContent}>
                  <span className={styles.queueCardLabel}>{t(queue.labelKey)}</span>
                  <span className={styles.queueCardDesc}>{t(queue.descriptionKey)}</span>
                </span>
                <ArrowRight size={16} className={styles.queueCardArrow} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        {/* ── 2. Live Snapshot ─────────────────────────────────── */}
        <section className={styles.snapshotSection} aria-labelledby="platform-snapshot-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionEyebrow}>{t('admin.dashboard.snapshotEyebrow')}</p>
              <h2 id="platform-snapshot-title">{t('admin.dashboard.snapshotTitle')}</h2>
            </div>
          </div>
          {summaryError ? (
            <WidgetErrorState message={summaryError} onRetry={() => void loadAll()} testId="summary-error" t={t} />
          ) : (
            <div className={styles.metricGrid}>
              <MetricCard label={t('admin.dashboard.registeredMembers')} value={loadingSummary || summary === null ? '—' : formatNumber(summary.totalMembers)} annotation={t('admin.dashboard.registeredMembersAnnotation')} icon={<UsersIcon size={16} />} accent={ROLE_ACCENT} />
              {publishedError ? (
                <WidgetErrorState message={publishedError} onRetry={() => void loadAll()} testId="published-count-error" t={t} />
              ) : (
                <MetricCard label={t('admin.dashboard.publishedPapers')} value={loadingPublished || publishedCount === null ? '—' : formatNumber(publishedCount)} annotation={t('admin.dashboard.publishedPapersAnnotation')} icon={<PapersIcon size={16} />} accent={ROLE_ACCENT} />
              )}
            </div>
          )}
        </section>

        {/* ── 3. Analytics ──────────────────────────────────────── */}
        <section className={styles.analyticsSection} aria-label={t('admin.dashboard.platformAnalytics')}>
          <AnalyticsChart
            metric="user_registrations"
            range={analyticsRange}
            series={registrations}
            loading={loadingAnalytics}
            error={analyticsError}
            onRangeChange={handleAnalyticsRangeChange}
            onRetry={() => void loadAll()}
            t={t}
            locale={locale}
          />
          <AnalyticsChart
            metric="revenue"
            range={analyticsRange}
            series={revenue}
            loading={loadingAnalytics}
            error={analyticsError}
            onRangeChange={handleAnalyticsRangeChange}
            onRetry={() => void loadAll()}
            t={t}
            locale={locale}
          />
        </section>

      </div>
    </div>
  );
};

export default AdminDashboard;
