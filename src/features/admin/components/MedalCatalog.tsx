/**
 * MedalCatalog — medal list state management and catalog UI
 *
 * Extracted from src/pages/Admin/AdminMedals.tsx
 * Contains: medal loading, filtering, view mode, stats
 */
import { useState, useMemo } from 'react';
import {
  Medal as MedalIcon,
  Award,
  Trophy,
  Gem,
  Sparkles,
  HelpCircle,
  Edit2,
  Trash2,
  Search,
  LayoutGrid,
  Table,
  CheckCircle2,
  Image as ImageIcon,
  type LucideIcon,
} from 'lucide-react';
import {
  medalService,
  type Medal,
  type MedalTier,
  type RoleTarget,
  type MedalFamilyGroup,
  criteriaUnitLabel,
  type MedalCriteriaUnit,
  groupMedalsByFamily,
} from '../../../services/medal.service';
import { useI18n } from '../../../i18n/I18nContext';
import { EmptyState } from '../../../components/EmptyState';
import { Button } from '../../../components/Button/Button';
import {
  SafeMedalBadge,
} from './SafeMedalBadge';
import styles from './MedalCatalog.module.css';

export interface MedalCatalogProps {
  medals: Medal[];
  isLoading: boolean;
  onRefetch: () => Promise<void>;
  onOpenQuickImage: (medal: Medal) => void;
  onOpenEdit: (medal: Medal) => void;
  onDelete: (medal: Medal) => void;
  onToggleStatus: (medal: Medal) => Promise<void>;
  showNotification: (message: string, type?: 'success' | 'error') => void;
  locale: string;
}

const TIER_ICON_FOR_PILL: Record<MedalTier, LucideIcon> = {
  Bronze: Award,
  Silver: MedalIcon,
  Gold: Trophy,
  Platinum: Gem,
};

const TIER_LABEL_KEY: Record<MedalTier, string> = {
  Bronze: 'admin.medals.tier.bronze',
  Silver: 'admin.medals.tier.silver',
  Gold: 'admin.medals.tier.gold',
  Platinum: 'admin.medals.tier.platinum',
};

export const MedalCatalog: React.FC<MedalCatalogProps> = ({
  medals,
  isLoading,
  onRefetch,
  onOpenQuickImage,
  onOpenEdit,
  onDelete,
  onToggleStatus,
  showNotification,
  locale,
}) => {
  const { t } = useI18n();
  const copy = (en: string, vi: string): string => (locale === 'vi' ? vi : en);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filtered medals
  const filteredMedals = useMemo(() => {
    return medals.filter((medal) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle =
          medal.title.toLowerCase().includes(q) ||
          medal.titleVi.toLowerCase().includes(q);
        const matchCode = medal.code.toLowerCase().includes(q);
        const matchDesc =
          medal.description.toLowerCase().includes(q) ||
          medal.descriptionVi.toLowerCase().includes(q);
        const matchMetric = medal.criteriaMetric.toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchDesc && !matchMetric) {
          return false;
        }
      }

      if (selectedRole !== 'ALL') {
        const hasRole =
          medal.roles.includes('All') ||
          medal.roles.includes(selectedRole as RoleTarget);
        if (!hasRole) return false;
      }

      if (selectedTier !== 'ALL') {
        if (medal.tier !== selectedTier) return false;
      }

      if (selectedStatus === 'ACTIVE' && !medal.isActive) return false;
      if (selectedStatus === 'INACTIVE' && medal.isActive) return false;

      return true;
    });
  }, [medals, searchQuery, selectedRole, selectedTier, selectedStatus]);

  // Family-grouped view
  const familyGroups = useMemo<MedalFamilyGroup[]>(() => {
    return groupMedalsByFamily(filteredMedals);
  }, [filteredMedals]);

  // Statistics
  const stats = useMemo(() => {
    const total = medals.length;
    const active = medals.filter((m) => m.isActive).length;
    const bronze = medals.filter((m) => m.tier === 'Bronze').length;
    const silver = medals.filter((m) => m.tier === 'Silver').length;
    const gold = medals.filter((m) => m.tier === 'Gold').length;
    const platinum = medals.filter((m) => m.tier === 'Platinum').length;
    return { total, active, bronze, silver, gold, platinum };
  }, [medals]);

  // Helper: render role badges
  const renderRoleBadges = (roles: RoleTarget[]) => {
    if (roles.includes('All') || roles.length >= 4) {
      return (
        <span className={`${styles.roleTag} ${styles.roleTagAll}`}>
          {t('admin.medals.role.allRoles', 'Tất cả 4 vai trò')}
        </span>
      );
    }
    return (
      <div className={styles.rolesBadgeContainer}>
        {roles.map((role) => {
          let roleClass = styles.roleTagAll;
          if (role === 'Researcher') roleClass = styles.roleTagResearcher;
          if (role === 'Lecturer') roleClass = styles.roleTagLecturer;
          if (role === 'Reviewer') roleClass = styles.roleTagReviewer;
          if (role === 'Graduate Student') roleClass = styles.roleTagStudent;

          let label: string = role;
          if (role === 'Researcher')
            label = t('admin.medals.role.researcher', 'Nhà nghiên cứu');
          else if (role === 'Lecturer')
            label = t('admin.medals.role.lecturer', 'Giảng viên');
          else if (role === 'Reviewer')
            label = t('admin.medals.role.reviewer', 'Người phản biện');
          else if (role === 'Graduate Student')
            label = t('admin.medals.role.student', 'Học viên');

          return (
            <span key={role} className={`${styles.roleTag} ${roleClass}`}>
              {label}
            </span>
          );
        })}
      </div>
    );
  };

  // Helper: render tier badge
  const renderTierBadge = (tier: MedalTier, stageLevel: number) => {
    const TierIcon = TIER_ICON_FOR_PILL[tier];
    const tierLabel = t(TIER_LABEL_KEY[tier], tier);
    const tierPillClass = `tierBadge_${tier}` as const;
    return (
      <span
        className={`${styles.tierBadge} ${styles[tierPillClass]}`}
        style={{ color: `var(--tier-${tier.toLowerCase()}-icon)` }}
      >
        <TierIcon size={12} />
        <span>
          {tierLabel} ({t('admin.medals.tier.tierWord', 'Cấp')} {stageLevel})
        </span>
      </span>
    );
  };

  const getTierBarClass = (tier: MedalTier) => {
    if (tier === 'Silver') return styles.tierBarSilver;
    if (tier === 'Gold') return styles.tierBarGold;
    if (tier === 'Platinum') return styles.tierBarPlatinum;
    return styles.tierBarBronze;
  };

  const renderCriterionUnitText = (unit: MedalCriteriaUnit): string =>
    criteriaUnitLabel(unit, locale as 'vi' | 'en');

  return (
    <>
      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ color: 'var(--accent-primary, #2563eb)' }}
          >
            <MedalIcon size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>
              {t('admin.medals.stat.total', 'Tổng số huy hiệu')}
            </span>
            <span className={styles.statValue}>{stats.total}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ color: 'var(--status-success-text, #16a34a)' }}
          >
            <CheckCircle2 size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>
              {t('admin.medals.stat.active', 'Đang kích hoạt')}
            </span>
            <span className={styles.statValue}>{stats.active}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ color: 'var(--tier-bronze-icon, #eab308)' }}
          >
            <Award size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>
              {t('admin.medals.stat.bronzeSilver', 'Cấp Đồng / Bạc')}
            </span>
            <span className={styles.statValue}>
              {stats.bronze} / {stats.silver}
            </span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ color: 'var(--tier-platinum-icon, #0ea5e9)' }}
          >
            <Sparkles size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>
              {t('admin.medals.stat.goldPlatinum', 'Cấp Vàng / Bạch Kim')}
            </span>
            <span className={styles.statValue}>
              {stats.gold} / {stats.platinum}
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className={styles.toolbarCard}>
        <div className={styles.filtersGroup}>
          <div className={styles.searchInputWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              id="searchMedalsInput"
              name="searchMedalsInput"
              placeholder={t(
                'admin.medals.searchPlaceholder',
                'Tìm theo tên, mã hoặc chỉ số...'
              )}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <select
            id="roleFilterSelect"
            name="roleFilterSelect"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">
              {t('admin.medals.filter.allRoles', 'Tất cả vai trò')}
            </option>
            <option value="Researcher">
              {t('admin.medals.role.researcher', 'Nhà nghiên cứu')}
            </option>
            <option value="Lecturer">
              {t('admin.medals.role.lecturer', 'Giảng viên')}
            </option>
            <option value="Reviewer">
              {t('admin.medals.role.reviewer', 'Người phản biện')}
            </option>
            <option value="Graduate Student">
              {t('admin.medals.role.student', 'Học viên')}
            </option>
          </select>

          <select
            id="tierFilterSelect"
            name="tierFilterSelect"
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">
              {t('admin.medals.filter.allTiers', 'Tất cả thứ hạng')}
            </option>
            <option value="Bronze">
              {t('admin.medals.tier.bronze', 'Đồng')}
            </option>
            <option value="Silver">
              {t('admin.medals.tier.silver', 'Bạc')}
            </option>
            <option value="Gold">
              {t('admin.medals.tier.gold', 'Vàng')}
            </option>
            <option value="Platinum">
              {t('admin.medals.tier.platinum', 'Bạch Kim')}
            </option>
          </select>

          <select
            id="statusFilterSelect"
            name="statusFilterSelect"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">
              {t('admin.medals.filter.allStatuses', 'Tất cả trạng thái')}
            </option>
            <option value="ACTIVE">
              {t('admin.medals.status.active', 'Đang hoạt động')}
            </option>
            <option value="INACTIVE">
              {t('admin.medals.status.disabled', 'Đã tắt')}
            </option>
          </select>
        </div>

        <div className={styles.viewToggle}>
          <button
            type="button"
            className={`${styles.viewToggleBtn} ${
              viewMode === 'grid' ? styles.viewToggleBtnActive : ''
            }`}
            onClick={() => setViewMode('grid')}
            title={t('admin.medals.view.cards', 'Thẻ')}
          >
            <LayoutGrid size={16} />
            <span>{t('admin.medals.view.cards', 'Thẻ')}</span>
          </button>
          <button
            type="button"
            className={`${styles.viewToggleBtn} ${
              viewMode === 'table' ? styles.viewToggleBtnActive : ''
            }`}
            onClick={() => setViewMode('table')}
            title={t('admin.medals.view.table', 'Bảng')}
          >
            <Table size={16} />
            <span>{t('admin.medals.view.table', 'Bảng')}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className={styles.emptyStateContainer}>
          <MedalIcon size={40} className="animate-spin text-blue-500" />
          <p>
            {copy(
              'Loading medals list from backend...',
              'Đang tải danh sách huy hiệu từ hệ thống...'
            )}
          </p>
        </div>
      ) : filteredMedals.length === 0 ? (
        <EmptyState
          icon={<MedalIcon size={32} />}
          title={copy('No medals found', 'Không tìm thấy huy hiệu nào')}
          description={copy(
            'Try adjusting your search query or clear filters above.',
            'Thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc phía trên.'
          )}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setSelectedRole('ALL');
                setSelectedTier('ALL');
                setSelectedStatus('ALL');
              }}
            >
              {copy('Clear Filters', 'Xóa bộ lọc')}
            </Button>
          }
        />
      ) : viewMode === 'grid' ? (
        /* CARD GRID VIEW */
        <div className={styles.cardsGrid}>
          {familyGroups.map((family) => {
            const primary = family.primary;
            const familyDisplayTitle =
              locale === 'vi'
                ? primary.titleVi || primary.title
                : primary.title || primary.titleVi;
            const familyDisplayDescription =
              locale === 'vi'
                ? primary.descriptionVi || primary.description
                : primary.description || primary.descriptionVi;

            const familyCode = family.primary.code
              .replace(/_(BRONZE|SILVER|GOLD|PLATINUM)$/i, '')
              .replace(/_(I|II|III|IV|V|VI|VII|VIII|IX|X)$/i, '');

            return (
              <div key={family.family} className={styles.medalCard}>
                <div
                  className={`${styles.cardTierBar} ${getTierBarClass(
                    family.tiers[family.tiers.length - 1]?.tier ?? 'Bronze'
                  )}`}
                />
                <div className={styles.cardHeader}>
                  <span className={styles.familyCodeBadge}>{familyCode}</span>
                  <span
                    className={
                      family.allActive
                        ? styles.statusActive
                        : styles.statusInactive
                    }
                  >
                    {family.allActive
                      ? t(
                          'admin.medals.status.active',
                          'Đang hoạt động'
                        )
                      : t(
                          'admin.medals.status.partial',
                          'Một số cấp đang tắt'
                        )}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.cardTopRow}>
                    <div
                      style={{ cursor: 'pointer', position: 'relative' }}
                      onClick={() => onOpenQuickImage(primary)}
                      title={copy(
                        'Click to change the icon — applies to all 4 tiers of this achievement',
                        'Bấm để đổi biểu tượng — áp dụng cho cả 4 cấp bậc của huy hiệu này'
                      )}
                    >
                      <SafeMedalBadge
                        imageUrl={family.imageUrl}
                        code={primary.code}
                        criteriaMetric={primary.criteriaMetric}
                        tier="Gold"
                        size={88}
                        alt={familyDisplayTitle}
                      />
                    </div>

                    <div className={styles.cardTitleArea}>
                      <span className={styles.cardTitleVi}>
                        {familyDisplayTitle}
                      </span>
                      <span className={styles.cardTitleEn}>
                        {family.label}
                      </span>
                      <span className={styles.tierCountHint}>
                        {copy(
                          `${family.tiers.length} tier variants`,
                          `${family.tiers.length} cấp bậc`
                        )}
                      </span>
                    </div>
                  </div>

                  <div className={styles.familySharedHint}>
                    <HelpCircle size={12} />
                    <span>
                      {copy(
                        'Icon is shared across all tiers — tier only changes the colour frame.',
                        'Biểu tượng dùng chung cho mọi cấp — tier chỉ đổi màu khung.'
                      )}
                    </span>
                  </div>

                  {renderRoleBadges(family.roles)}

                  <p className={styles.cardDesc}>{familyDisplayDescription}</p>

                  <div className={styles.tierLadder}>
                    <div className={styles.tierLadderHeader}>
                      {copy('Tiers & criteria', 'Các cấp bậc & điều kiện')}
                    </div>
                    {family.tiers.map((tier) => (
                      <div key={tier.id} className={styles.tierLadderRow}>
                        <div className={styles.tierLadderLeft}>
                          <SafeMedalBadge
                            imageUrl={family.imageUrl}
                            code={tier.code}
                            criteriaMetric={tier.criteriaMetric}
                            tier={tier.tier}
                            size={44}
                            alt={tier.titleVi}
                          />
                          <div className={styles.tierLadderInfo}>
                            <span className={styles.tierLadderName}>
                              {locale === 'vi'
                                ? tier.titleVi
                                : tier.title}
                            </span>
                            <span className={styles.tierLadderCriteria}>
                              {tier.criteriaMetric} &ge;{' '}
                              {tier.criteriaThreshold}{' '}
                              {renderCriterionUnitText(tier.criteriaUnit)}
                            </span>
                          </div>
                        </div>
                        <div className={styles.tierLadderActions}>
                          <button
                            type="button"
                            className={styles.btnAction}
                            onClick={() => void onToggleStatus(tier)}
                            title={
                              tier.isActive
                                ? t('admin.medals.action.turnOff', 'Tắt')
                                : t('admin.medals.action.turnOn', 'Bật')
                            }
                          >
                            {tier.isActive
                              ? t('admin.medals.action.turnOff', 'Tắt')
                              : t('admin.medals.action.turnOn', 'Bật')}
                          </button>
                          <button
                            type="button"
                            className={styles.btnAction}
                            onClick={() => onOpenEdit(tier)}
                            title={t(
                              'admin.medals.action.editTier',
                              'Sửa cấp này'
                            )}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            className={`${styles.btnAction} ${styles.btnActionDanger}`}
                            onClick={() => onDelete(tier)}
                            title={copy('Delete this tier', 'Xóa cấp này')}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <button
                    type="button"
                    className={`${styles.btnAction} ${styles.btnChangeImgDirect}`}
                    onClick={() => onOpenQuickImage(primary)}
                    title={t(
                      'admin.medals.action.changeIcon',
                      'Đổi biểu tượng (cả 4 cấp)'
                    )}
                  >
                    <ImageIcon size={14} />
                    <span>
                      {t('admin.medals.action.changeIconFamily', 'Đổi biểu tượng')}
                    </span>
                  </button>

                  <div className={styles.cardActionsRight}>
                    <button
                      type="button"
                      className={styles.btnAction}
                      onClick={async () => {
                        const targetActive = !family.allActive;
                        try {
                          await Promise.all(
                            family.tiers.map((tier) =>
                              tier.isActive === targetActive
                                ? Promise.resolve()
                                : medalService.update(tier.id, {
                                    isActive: targetActive,
                                  }),
                            ),
                          );
                          showNotification(
                            t(
                              'admin.medals.success.statusChanged',
                              `Đã ${targetActive ? 'bật' : 'tắt'} toàn bộ cấp của "${familyDisplayTitle}".`
                            )
                          );
                          await onRefetch();
                        } catch {
                          showNotification(
                            t(
                              'admin.medals.error.statusChange',
                              'Lỗi khi thay đổi trạng thái'
                            ),
                            'error'
                          );
                        }
                      }}
                      title={
                        family.allActive
                          ? copy('Disable all tiers', 'Tắt tất cả cấp')
                          : copy('Enable all tiers', 'Bật tất cả cấp')
                      }
                    >
                      {family.allActive
                        ? t('admin.medals.action.turnOffAll', 'Tắt hết')
                        : t('admin.medals.action.turnOnAll', 'Bật hết')}
                    </button>
                    <button
                      type="button"
                      className={styles.btnAction}
                      onClick={() => onOpenEdit(primary)}
                      title={t('admin.medals.action.editFamily', 'Sửa huy hiệu')}
                    >
                      <Edit2 size={14} />
                      <span>{t('admin.medals.action.edit', 'Sửa')}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className={styles.tableCard}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>
                    {t('admin.medals.table.badge', 'Huy hiệu')}
                  </th>
                  <th>
                    {t('admin.medals.table.titleCode', 'Tên & Mã')}
                  </th>
                  <th>
                    {t('admin.medals.table.roles', 'Vai trò áp dụng')}
                  </th>
                  <th>
                    {t('admin.medals.table.tierLevel', 'Cấp bậc (Tier)')}
                  </th>
                  <th>
                    {t('admin.medals.table.criteria', 'Điều kiện đạt')}
                  </th>
                  <th>
                    {t('admin.medals.table.status', 'Trạng thái')}
                  </th>
                  <th style={{ textAlign: 'right' }}>
                    {t('admin.medals.table.actions', 'Thao tác')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMedals.map((medal) => {
                  const primaryTitle =
                    locale === 'vi'
                      ? medal.titleVi || medal.title
                      : medal.title || medal.titleVi;
                  const secondaryTitle =
                    locale === 'vi' ? medal.title : medal.titleVi;

                  return (
                    <tr key={medal.id}>
                      <td>
                        <div className={styles.medalImageCell}>
                          <SafeMedalBadge
                            imageUrl={medal.imageUrl}
                            code={medal.code}
                            criteriaMetric={medal.criteriaMetric}
                            tier={medal.tier}
                            size={56}
                            alt={primaryTitle}
                          />
                          <button
                            type="button"
                            className={styles.changeImageQuickBtn}
                            onClick={() => onOpenQuickImage(medal)}
                            title={t(
                              'admin.medals.action.changeIcon',
                              'Đổi biểu tượng'
                            )}
                          >
                            {t('admin.medals.action.changeIcon', 'Đổi biểu tượng')}
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className={styles.medalTitleInfo}>
                          <span className={styles.medalNameVi}>
                            {primaryTitle}
                          </span>
                          <span className={styles.medalNameEn}>{secondaryTitle}</span>
                          <span className={styles.cardCodeBadge}>
                            {medal.code}
                          </span>
                        </div>
                      </td>
                      <td>{renderRoleBadges(medal.roles)}</td>
                      <td>{renderTierBadge(medal.tier, medal.stageLevel)}</td>
                      <td>
                        <span className={styles.criteriaText}>
                          &ge; {medal.criteriaThreshold}{' '}
                          {renderCriterionUnitText(medal.criteriaUnit)} (
                          <code>{medal.criteriaMetric}</code>)
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            medal.isActive
                              ? styles.statusActive
                              : styles.statusInactive
                          }
                        >
                          {medal.isActive
                            ? t('admin.medals.status.active', 'Đang hoạt động')
                            : t('admin.medals.status.disabled', 'Đã tắt')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div
                          className={styles.actionButtons}
                          style={{ justifyContent: 'flex-end' }}
                        >
                          <button
                            type="button"
                            className={styles.btnAction}
                            onClick={() => void onToggleStatus(medal)}
                          >
                            {medal.isActive
                              ? t('admin.medals.action.turnOff', 'Tắt')
                              : t('admin.medals.action.turnOn', 'Bật')}
                          </button>
                          <button
                            type="button"
                            className={styles.btnAction}
                            onClick={() => onOpenEdit(medal)}
                          >
                            <Edit2 size={14} />
                            <span>
                              {t('admin.medals.action.edit', 'Sửa')}
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`${styles.btnAction} ${styles.btnActionDanger}`}
                            onClick={() => onDelete(medal)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
};

export default MedalCatalog;
