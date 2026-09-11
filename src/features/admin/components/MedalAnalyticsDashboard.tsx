import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Award,
  Trophy,
  Users,
  BookOpen,
  GraduationCap,
  MessageSquare,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import {
  medalService,
  criteriaUnitLabel,
  type Medal,
  type MedalTier,
} from '../../../services/medal.service';
import {
  medalAnalyticsService,
  getMedalCategory,
  type MedalAnalyticsStats,
  type MedalCategoryKey,
} from '../../../services/medalAnalytics.service';
import { SafeMedalBadge } from './SafeMedalBadge';
import { MedalRecipientsModal } from './MedalRecipientsModal';
import { useI18n } from '../../../i18n/I18nContext';
import styles from './MedalAnalyticsDashboard.module.css';

export interface MedalAnalyticsDashboardProps {
  locale: string;
}

const CATEGORY_ICONS: Record<MedalCategoryKey, LucideIcon> = {
  research: BookOpen,
  mentorship: GraduationCap,
  seminars: Users,
  community: MessageSquare,
};

export const MedalAnalyticsDashboard: React.FC<MedalAnalyticsDashboardProps> = ({
  locale,
}) => {
  const { t } = useI18n();
  const copy = (en: string, vi: string): string => (locale === 'vi' ? vi : en);

  const [medals, setMedals] = useState<Medal[]>([]);
  const [stats, setStats] = useState<MedalAnalyticsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [selectedMedalForModal, setSelectedMedalForModal] = useState<Medal | null>(null);

  const loadData = useCallback(async (force = false) => {
    setIsLoading(true);
    try {
      const [allMedals, analyticsData] = await Promise.all([
        medalService.getAll(),
        medalAnalyticsService.getAnalytics(force),
      ]);
      setMedals(allMedals);
      setStats(analyticsData);
    } catch (err) {
      console.error('Failed to load medal analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filtered medals list
  const filteredMedals = useMemo(() => {
    return medals.filter((m) => {
      // Category filter
      if (categoryFilter !== 'ALL') {
        const cat = getMedalCategory(m);
        if (cat !== categoryFilter) return false;
      }
      // Tier filter
      if (tierFilter !== 'ALL' && m.tier !== tierFilter) {
        return false;
      }
      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        m.title.toLowerCase().includes(q) ||
        m.titleVi.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.criteriaMetric.toLowerCase().includes(q)
      );
    });
  }, [medals, categoryFilter, tierFilter, searchQuery]);

  const getTierBadgeStyle = (tier: MedalTier) => {
    switch (tier) {
      case 'Bronze':
        return { background: '#fbf0ea', color: '#c2410c', border: '1px solid #fed7aa' };
      case 'Silver':
        return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
      case 'Gold':
        return { background: '#fef9c3', color: '#a16207', border: '1px solid #fde047' };
      case 'Platinum':
        return { background: '#f3e8ff', color: '#7e22ce', border: '1px solid #e9d5ff' };
      default:
        return {};
    }
  };

  const getCategoryTitle = (key: MedalCategoryKey) => {
    switch (key) {
      case 'research':
        return t('admin.medals.category.research', 'Nghiên cứu & Bài báo');
      case 'mentorship':
        return t('admin.medals.category.mentorship', 'Giảng dạy & Đào tạo');
      case 'seminars':
        return t('admin.medals.category.seminars', 'Hoạt động Seminar');
      case 'community':
        return t('admin.medals.category.community', 'Tương tác Cộng đồng');
    }
  };

  return (
    <div className={styles.container}>
      {/* KPI Cards Row */}
      <div className={styles.kpiGrid}>
        {/* Total Medals */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>
            <Award size={24} color="#eab308" />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>
              {t('admin.medals.analytics.kpi.totalMedals', 'Tổng số huy hiệu')}
            </span>
            <span className={styles.kpiValue}>{stats?.totalMedals ?? medals.length}</span>
            <span className={styles.kpiSub}>
              {copy('Standard active catalog', 'Danh mục học thuật chuẩn')}
            </span>
          </div>
        </div>

        {/* Total Unlocked Awards */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>
            <CheckCircle2 size={24} color="#16a34a" />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>
              {t('admin.medals.analytics.kpi.totalAwards', 'Tổng lượt đã mở khóa')}
            </span>
            <span className={styles.kpiValue}>{stats?.totalUnlockedAwards ?? 0}</span>
            <span className={styles.kpiSub}>
              {copy('Awards across all users', 'Đã cấp cho toàn bộ tài khoản')}
            </span>
          </div>
        </div>

        {/* Users with Medals */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>
            <Users size={24} color="#0284c7" />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>
              {t('admin.medals.analytics.kpi.usersWithMedals', 'Người dùng đạt huy hiệu')}
            </span>
            <span className={styles.kpiValue}>{stats?.usersWithMedalsCount ?? 0}</span>
            <span className={styles.kpiSub}>
              {copy('Active medal achievers', 'Thành viên sở hữu ít nhất 1 huy hiệu')}
            </span>
          </div>
        </div>

        {/* Most Achieved Badge */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>
            <Trophy size={24} color="#ca8a04" />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>
              {t('admin.medals.analytics.kpi.topMedal', 'Huy hiệu phổ biến nhất')}
            </span>
            <span
              className={styles.kpiValue}
              style={{ fontSize: '1.125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {stats?.topMedal
                ? locale === 'vi'
                  ? stats.topMedal.medal.titleVi
                  : stats.topMedal.medal.title
                : '—'}
            </span>
            <span className={styles.kpiSub}>
              {stats?.topMedal
                ? `${stats.topMedal.recipientCount} ${copy('recipients', 'người sở hữu')}`
                : copy('No awards yet', 'Chưa có lượt cấp')}
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar: Search & Filters */}
      <div className={styles.toolbarCard}>
        <div className={styles.searchBox}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t(
              'admin.medals.searchPlaceholder',
              'Tìm theo tên, mã hoặc chỉ số...'
            )}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.filtersGroup}>
          <select
            className={styles.filterSelect}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">{copy('All categories', 'Tất cả chuyên mục')}</option>
            <option value="research">{t('admin.medals.category.research', 'Nghiên cứu & Bài báo')}</option>
            <option value="mentorship">{t('admin.medals.category.mentorship', 'Giảng dạy & Đào tạo')}</option>
            <option value="seminars">{t('admin.medals.category.seminars', 'Hoạt động Seminar')}</option>
            <option value="community">{t('admin.medals.category.community', 'Tương tác Cộng đồng')}</option>
          </select>

          <select
            className={styles.filterSelect}
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
          >
            <option value="ALL">{t('admin.medals.filter.allTiers', 'Tất cả thứ hạng')}</option>
            <option value="Bronze">{t('admin.medals.tier.bronze', 'Đồng')}</option>
            <option value="Silver">{t('admin.medals.tier.silver', 'Bạc')}</option>
            <option value="Gold">{t('admin.medals.tier.gold', 'Vàng')}</option>
            <option value="Platinum">{t('admin.medals.tier.platinum', 'Bạch Kim')}</option>
          </select>

          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => void loadData(true)}
            disabled={isLoading}
            title={copy('Refresh statistics', 'Làm mới thống kê')}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            <span>{copy('Refresh', 'Làm mới')}</span>
          </button>
        </div>
      </div>

      {/* Analytics Overview Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.medals.table.badge', 'Huy hiệu')}</th>
                <th>{t('admin.medals.analytics.table.category', 'Chuyên mục')}</th>
                <th>{t('admin.medals.table.tierLevel', 'Cấp bậc (Tier)')}</th>
                <th>{t('admin.medals.table.roles', 'Vai trò áp dụng')}</th>
                <th>{t('admin.medals.table.criteria', 'Điều kiện đạt')}</th>
                <th>{t('admin.medals.analytics.table.recipients', 'Người đã đạt')}</th>
                <th style={{ textAlign: 'right' }}>
                  {t('admin.medals.table.actions', 'Thao tác')}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className={styles.loadingSkeleton}>
                    {copy('Loading analytics data across all users...', 'Đang tổng hợp dữ liệu vinh danh từ hệ thống...')}
                  </td>
                </tr>
              ) : filteredMedals.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className={styles.emptyState}>
                      <Award size={36} color="#94a3b8" />
                      <p>{copy('No medals matching current filters', 'Không tìm thấy huy hiệu phù hợp với bộ lọc')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMedals.map((medal) => {
                  const recipients = stats?.recipientsByMedalCode[medal.code.toUpperCase()] || [];
                  const catKey = getMedalCategory(medal);
                  const CatIcon = CATEGORY_ICONS[catKey];
                  const hasRecipients = recipients.length > 0;

                  return (
                    <tr key={medal.id}>
                      {/* Badge info */}
                      <td>
                        <div className={styles.medalCell}>
                          <SafeMedalBadge
                            imageUrl={medal.imageUrl}
                            tier={medal.tier}
                            size={36}
                            alt=""
                          />
                          <div className={styles.medalMeta}>
                            <span className={styles.medalTitle}>
                              {locale === 'vi' ? medal.titleVi : medal.title}
                            </span>
                            <span className={styles.medalCode}>{medal.code}</span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td>
                        <span className={styles.categoryBadge}>
                          <CatIcon size={13} />
                          <span>{getCategoryTitle(catKey)}</span>
                        </span>
                      </td>

                      {/* Tier & Level */}
                      <td>
                        <span
                          className={styles.tierBadge}
                          style={getTierBadgeStyle(medal.tier)}
                        >
                          {medal.tier} ({copy('Level', 'Cấp')} {medal.stageLevel})
                        </span>
                      </td>

                      {/* Roles */}
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: '#475569' }}>
                          {medal.roles.join(', ')}
                        </span>
                      </td>

                      {/* Criteria */}
                      <td>
                        <div style={{ fontSize: '0.8125rem' }}>
                          <span style={{ fontWeight: 600 }}>&gt;= {medal.criteriaThreshold}</span>{' '}
                          <span style={{ color: '#64748b' }}>
                            {criteriaUnitLabel(medal.criteriaUnit, locale as 'vi' | 'en')}
                          </span>
                        </div>
                      </td>

                      {/* Recipients count */}
                      <td>
                        <span
                          className={`${styles.recipientsPill} ${
                            hasRecipients ? styles.recipientsPillActive : styles.recipientsPillZero
                          }`}
                        >
                          <Users size={13} />
                          <span>
                            {recipients.length} {copy('users', 'người')}
                          </span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => setSelectedMedalForModal(medal)}
                          title={copy('View list of users with this medal', 'Xem danh sách người dùng đạt huy hiệu')}
                        >
                          <Eye size={14} />
                          <span>
                            {t('admin.medals.analytics.table.viewRecipients', 'Xem danh sách ({count})', {
                              count: recipients.length,
                            })}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recipients Detail Modal */}
      {selectedMedalForModal && (
        <MedalRecipientsModal
          familyName={
            locale === 'vi'
              ? selectedMedalForModal.titleVi || selectedMedalForModal.title
              : selectedMedalForModal.title || selectedMedalForModal.titleVi
          }
          primaryMedal={selectedMedalForModal}
          recipients={stats?.recipientsByMedalCode[selectedMedalForModal.code.toUpperCase()] || []}
          onClose={() => setSelectedMedalForModal(null)}
          locale={locale}
        />
      )}
    </div>
  );
};

export default MedalAnalyticsDashboard;