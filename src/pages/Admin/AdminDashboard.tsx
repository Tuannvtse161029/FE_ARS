import { useCallback, useEffect, useState } from 'react';
import { Users as UsersIcon, FileText as PapersIcon } from 'lucide-react';
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

const ChartCard = ({
  title,
  metric,
  series,
  loading,
}: {
  title: string;
  metric: Metric;
  series: AnalyticsTimeSeries | null;
  loading: boolean;
}) => (
  <div className={styles.chartSection}>
    <div className={styles.chartHeader}>
      <span className={styles.chartTitle}>{title}</span>
    </div>
    {loading || !series ? (
      <div className={styles.chartSkeleton}>Loading chart data…</div>
    ) : (
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [registrations, setRegistrations] = useState<AnalyticsTimeSeries | null>(null);
  const [revenue, setRevenue] = useState<AnalyticsTimeSeries | null>(null);
  const [range, setRange] = useState<Range>('monthly');
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [recentRequests, setRecentRequests] = useState<RoleRequest[]>([]);

  const load = useCallback(async (current: Range) => {
    setLoadingSummary(true);
    setLoadingSeries(true);
    try {
      const [summaryData, regData, revData, roleData] = await Promise.all([
        adminService.getAnalyticsSummary(),
        adminService.getAnalyticsTimeseries(current, 'user_registrations'),
        adminService.getAnalyticsTimeseries(current, 'revenue'),
        adminService.getRoleRequests(),
      ]);
      setSummary(summaryData);
      setRegistrations(regData);
      setRevenue(revData);
      setRecentRequests(roleData.slice(0, 5));
    } finally {
      setLoadingSummary(false);
      setLoadingSeries(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);

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
        <MetricCard
          icon={<UsersIcon size={22} />}
          label="Total Members"
          value={loadingSummary ? '—' : formatNumber(summary?.totalMembers ?? 0)}
          hint={loadingSummary ? 'Loading…' : 'Cumulative registered users'}
        />
        <MetricCard
          icon={<PapersIcon size={22} />}
          label="Scientific Papers"
          value={loadingSummary ? '—' : formatNumber(summary?.totalPapers ?? 0)}
          hint={loadingSummary ? 'Loading…' : 'Across all majors & sub-fields'}
        />
      </div>

      <ChartCard
        title="User Newly Register"
        metric="user_registrations"
        series={registrations}
        loading={loadingSeries}
      />

      <ChartCard
        title="Revenue"
        metric="revenue"
        series={revenue}
        loading={loadingSeries}
      />

      <div className={styles.recentSection}>
        <span className={styles.sectionTitle}>Recent Role Requests</span>
        {recentRequests.length === 0 ? (
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
                  <td>{r.requestedRoles.join(', ')}</td>
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
