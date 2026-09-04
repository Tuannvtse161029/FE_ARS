import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Medal as MedalIcon,
  Award,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Image as ImageIcon,
  UploadCloud,
  RotateCcw,
  LayoutGrid,
  Table,
  HelpCircle,
  X,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  medalService,
  type Medal,
  type MedalTier,
  type RoleTarget,
  type MedalCreateInput,
} from '../../services/medal.service';
import { useFirebaseFileUpload } from '../../hooks/useFirebaseFileUpload';
import { useI18n } from '../../i18n/I18nContext';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState';
import styles from './AdminMedals.module.css';

const TIER_OPTIONS: MedalTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];
const ALL_ROLES: RoleTarget[] = [
  'Researcher',
  'Lecturer',
  'Reviewer',
  'Graduate Student',
];

const PRESET_SAMPLE_IMAGES = [
  {
    labelEn: 'ORCID Scholar',
    labelVi: 'Học giả ORCID',
    url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=160&auto=format&fit=crop&q=80',
  },
  {
    labelEn: 'Book Author',
    labelVi: 'Tác giả sách',
    url: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=160&auto=format&fit=crop&q=80',
  },
  {
    labelEn: 'Seminar Host',
    labelVi: 'Hội thảo / Mic',
    url: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=160&auto=format&fit=crop&q=80',
  },
  {
    labelEn: 'Master Mentor',
    labelVi: 'Cố vấn / Mentor',
    url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=160&auto=format&fit=crop&q=80',
  },
  {
    labelEn: 'Peer Review',
    labelVi: 'Phản biện / Review',
    url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=160&auto=format&fit=crop&q=80',
  },
  {
    labelEn: 'Flawless Progress',
    labelVi: 'Tiến độ hoàn hảo',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=160&auto=format&fit=crop&q=80',
  },
];

const TIER_GRADIENTS: Record<MedalTier, { bg: string; border: string; iconColor: string }> = {
  Bronze: { bg: 'linear-gradient(135deg, #fef3c7, #fed7aa)', border: '#d97706', iconColor: '#b45309' },
  Silver: { bg: 'linear-gradient(135deg, #f1f5f9, #cbd5e1)', border: '#94a3b8', iconColor: '#475569' },
  Gold: { bg: 'linear-gradient(135deg, #fef9c3, #fde047)', border: '#eab308', iconColor: '#a16207' },
  Platinum: { bg: 'linear-gradient(135deg, #e0f2fe, #7dd3fc)', border: '#38bdf8', iconColor: '#0284c7' },
};

/**
 * Robust image component that prevents any infinite onError retry loop.
 * If image fails to load (or is blocked by CORB/ad-blocker), it cleanly renders a vector medal badge.
 */
const SafeMedalImage: React.FC<{
  src?: string;
  alt: string;
  tier: MedalTier;
  className?: string;
  size?: number;
}> = ({ src, alt, tier, className, size }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const style = TIER_GRADIENTS[tier] || TIER_GRADIENTS.Bronze;

  if (!src || failed) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: style.bg,
          borderRadius: '50%',
          width: size ? `${size}px` : '100%',
          height: size ? `${size}px` : '100%',
          userSelect: 'none',
        }}
        title={alt}
      >
        <MedalIcon size={size ? size * 0.5 : 26} color={style.iconColor} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={(e) => {
        // Stop infinite retry loops immediately
        e.currentTarget.onerror = null;
        setFailed(true);
      }}
    />
  );
};

export const AdminMedals: React.FC = () => {
  const { locale } = useI18n();
  const copy = (en: string, vi: string): string => (locale === 'en' ? en : vi);

  const [medals, setMedals] = useState<Medal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals state
  const [activeModal, setActiveModal] = useState<
    'create' | 'edit' | 'quickImage' | 'delete' | 'reset' | null
  >(null);
  const [targetMedal, setTargetMedal] = useState<Medal | null>(null);

  // Quick image change state
  const [quickImageUrl, setQuickImageUrl] = useState<string>('');
  const [quickImageTab, setQuickImageTab] = useState<'upload' | 'url'>('upload');

  // Firebase upload hook
  const {
    uploadFile,
    progress: uploadProgress,
    isUploading,
    error: uploadError,
    resetUpload,
  } = useFirebaseFileUpload('medals/');

  // Form State for Create / Edit
  const [formTitle, setFormTitle] = useState('');
  const [formTitleVi, setFormTitleVi] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDescriptionVi, setFormDescriptionVi] = useState('');
  const [formRoles, setFormRoles] = useState<RoleTarget[]>([]);
  const [formTier, setFormTier] = useState<MedalTier>('Bronze');
  const [formStageLevel, setFormStageLevel] = useState<number>(1);
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formCriteriaMetric, setFormCriteriaMetric] = useState('');
  const [formCriteriaThreshold, setFormCriteriaThreshold] = useState<number>(1);
  const [formCriteriaUnit, setFormCriteriaUnit] = useState('lần');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  // Toast / Banner alert
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Format criteria unit based on locale
  const formatCriteriaUnit = (unit: string): string => {
    if (locale !== 'en') return unit;
    switch (unit?.toLowerCase()) {
      case 'bài báo':
        return 'papers';
      case 'hội thảo':
        return 'seminars';
      case 'nhóm':
      case 'nhóm sinh viên':
        return 'student groups';
      case 'lượt':
      case 'lượt review':
        return 'reviews';
      case 'tài khoản':
        return 'account';
      case 'công trình':
        return 'publications';
      case 'giai đoạn':
      case 'phase':
        return 'phases';
      case 'lần':
        return 'times';
      default:
        return unit || 'times';
    }
  };

  // Load Medals
  const loadMedals = async () => {
    setIsLoading(true);
    try {
      const data = await medalService.getAll();
      setMedals(data);
    } catch (err) {
      console.error('Failed to load medals:', err);
      showNotification(copy('Failed to load medals', 'Không thể tải danh sách huy hiệu'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMedals();
  }, []);

  // Filtered medals
  const filteredMedals = useMemo(() => {
    return medals.filter((medal) => {
      // Search
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

      // Role filter
      if (selectedRole !== 'ALL') {
        const hasRole =
          medal.roles.includes('All') ||
          medal.roles.includes(selectedRole as RoleTarget);
        if (!hasRole) return false;
      }

      // Tier filter
      if (selectedTier !== 'ALL') {
        if (medal.tier !== selectedTier) return false;
      }

      // Status filter
      if (selectedStatus === 'ACTIVE' && !medal.isActive) return false;
      if (selectedStatus === 'INACTIVE' && medal.isActive) return false;

      return true;
    });
  }, [medals, searchQuery, selectedRole, selectedTier, selectedStatus]);

  // Statistics counters
  const stats = useMemo(() => {
    const total = medals.length;
    const active = medals.filter((m) => m.isActive).length;
    const bronze = medals.filter((m) => m.tier === 'Bronze').length;
    const silver = medals.filter((m) => m.tier === 'Silver').length;
    const gold = medals.filter((m) => m.tier === 'Gold').length;
    const platinum = medals.filter((m) => m.tier === 'Platinum').length;
    return { total, active, bronze, silver, gold, platinum };
  }, [medals]);

  // Handle Quick Image Modal Open
  const handleOpenQuickImage = (medal: Medal) => {
    setTargetMedal(medal);
    setQuickImageUrl(medal.imageUrl || '');
    resetUpload();
    setActiveModal('quickImage');
  };

  // Handle Quick Image Save
  const handleSaveQuickImage = async () => {
    if (!targetMedal) return;
    try {
      await medalService.update(targetMedal.id, {
        imageUrl: quickImageUrl.trim(),
      });
      const medalName = locale === 'en' ? targetMedal.title : targetMedal.titleVi;
      showNotification(
        copy(
          `Updated badge artwork for "${medalName}" successfully!`,
          `Đã cập nhật hình ảnh huy hiệu "${medalName}" thành công!`
        )
      );
      setActiveModal(null);
      setTargetMedal(null);
      loadMedals();
    } catch (err) {
      console.error(err);
      showNotification(copy('Failed to update medal image', 'Lỗi khi cập nhật ảnh huy hiệu'), 'error');
    }
  };

  // Handle Image File Pick for Quick Modal
  const handlePickFileQuick = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const downloadUrl = await uploadFile(file);
      if (downloadUrl) {
        setQuickImageUrl(downloadUrl);
        showNotification(copy('Image uploaded to Firebase successfully!', 'Tải ảnh lên Firebase thành công!'));
      }
    } catch (err) {
      console.error(err);
      showNotification(copy('Failed to upload image to Firebase', 'Không thể tải ảnh lên Firebase'), 'error');
    }
  };

  // Handle Create Modal Open
  const handleOpenCreate = () => {
    setTargetMedal(null);
    setFormTitle('');
    setFormTitleVi('');
    setFormDescription('');
    setFormDescriptionVi('');
    setFormRoles(['Researcher', 'Lecturer', 'Reviewer', 'Graduate Student']);
    setFormTier('Bronze');
    setFormStageLevel(1);
    setFormImageUrl('');
    setFormCriteriaMetric('');
    setFormCriteriaThreshold(1);
    setFormCriteriaUnit(copy('times', 'lần'));
    setFormIsActive(true);
    resetUpload();
    setActiveModal('create');
  };

  // Handle Edit Modal Open
  const handleOpenEdit = (medal: Medal) => {
    setTargetMedal(medal);
    setFormTitle(medal.title);
    setFormTitleVi(medal.titleVi);
    setFormDescription(medal.description);
    setFormDescriptionVi(medal.descriptionVi);
    setFormRoles(medal.roles);
    setFormTier(medal.tier);
    setFormStageLevel(medal.stageLevel);
    setFormImageUrl(medal.imageUrl);
    setFormCriteriaMetric(medal.criteriaMetric);
    setFormCriteriaThreshold(medal.criteriaThreshold);
    setFormCriteriaUnit(medal.criteriaUnit);
    setFormIsActive(medal.isActive);
    resetUpload();
    setActiveModal('edit');
  };

  // Handle Save (Create / Edit)
  const handleSaveMedalForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitleVi.trim() && !formTitle.trim()) {
      showNotification(copy('Please enter a medal title', 'Vui lòng nhập tên huy hiệu'), 'error');
      return;
    }

    const payload: MedalCreateInput = {
      title: formTitle.trim() || formTitleVi.trim(),
      titleVi: formTitleVi.trim() || formTitle.trim(),
      description: formDescription.trim() || formDescriptionVi.trim(),
      descriptionVi: formDescriptionVi.trim() || formDescription.trim(),
      roles: formRoles.length > 0 ? formRoles : ['All'],
      tier: formTier,
      stageLevel: Number(formStageLevel) || 1,
      imageUrl: formImageUrl.trim(),
      criteriaMetric: formCriteriaMetric.trim() || 'default_metric',
      criteriaThreshold: Number(formCriteriaThreshold) || 1,
      criteriaUnit: formCriteriaUnit.trim() || copy('times', 'lần'),
      isActive: formIsActive,
    };

    try {
      if (activeModal === 'create') {
        await medalService.create(payload);
        showNotification(copy('Created new academic medal successfully!', 'Tạo huy hiệu mới thành công!'));
      } else if (activeModal === 'edit' && targetMedal) {
        await medalService.update(targetMedal.id, payload);
        const name = locale === 'en' ? payload.title : payload.titleVi;
        showNotification(copy(`Updated medal "${name}" successfully!`, `Đã cập nhật huy hiệu "${name}"!`));
      }
      setActiveModal(null);
      setTargetMedal(null);
      loadMedals();
    } catch (err) {
      console.error(err);
      showNotification(copy('Error saving medal information', 'Lỗi khi lưu thông tin huy hiệu'), 'error');
    }
  };

  // Toggle active status directly
  const handleToggleStatus = async (medal: Medal) => {
    try {
      await medalService.update(medal.id, { isActive: !medal.isActive });
      const name = locale === 'en' ? medal.title : medal.titleVi;
      showNotification(
        copy(
          `Medal "${name}" is now ${!medal.isActive ? 'active' : 'disabled'}.`,
          `Đã ${!medal.isActive ? 'kích hoạt' : 'tạm dừng'} huy hiệu "${name}".`
        )
      );
      loadMedals();
    } catch (err) {
      console.error(err);
      showNotification(copy('Failed to change status', 'Lỗi khi thay đổi trạng thái'), 'error');
    }
  };

  // Handle Delete Medal
  const handleDeleteConfirm = async () => {
    if (!targetMedal) return;
    try {
      await medalService.delete(targetMedal.id);
      const name = locale === 'en' ? targetMedal.title : targetMedal.titleVi;
      showNotification(copy(`Deleted medal "${name}"!`, `Đã xóa huy hiệu "${name}"!`));
      setActiveModal(null);
      setTargetMedal(null);
      loadMedals();
    } catch (err) {
      console.error(err);
      showNotification(copy('Error deleting medal', 'Lỗi khi xóa huy hiệu'), 'error');
    }
  };

  // Handle Reset to Default Medals
  const handleResetDefaults = async () => {
    try {
      await medalService.resetToDefaults();
      showNotification(
        copy(
          'Restored all 26 default academic medals successfully!',
          'Đã khôi phục toàn bộ danh sách 26 huy hiệu mặc định!'
        )
      );
      setActiveModal(null);
      loadMedals();
    } catch (err) {
      console.error(err);
      showNotification(copy('Failed to restore default medals', 'Lỗi khi khôi phục dữ liệu gốc'), 'error');
    }
  };

  // Render role badges
  const renderRoleBadges = (roles: RoleTarget[]) => {
    if (roles.includes('All') || roles.length >= 4) {
      return (
        <span className={`${styles.roleTag} ${styles.roleTagAll}`}>
          {copy('All 4 Roles', 'Tất cả 4 vai trò')}
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
          if (locale === 'vi') {
            if (role === 'Researcher') label = 'Nhà nghiên cứu';
            else if (role === 'Lecturer') label = 'Giảng viên';
            else if (role === 'Reviewer') label = 'Người phản biện';
            else if (role === 'Graduate Student') label = 'Học viên';
          } else {
            if (role === 'Graduate Student') label = 'Student';
          }

          return (
            <span key={role} className={`${styles.roleTag} ${roleClass}`}>
              {label}
            </span>
          );
        })}
      </div>
    );
  };

  // Render Tier badge
  const renderTierBadge = (tier: MedalTier, stageLevel: number) => {
    let tierClass = styles.tierBadgeBronze;
    let icon = '🥉';
    let tierLabel = copy('Bronze', 'Đồng');
    if (tier === 'Silver') {
      tierClass = styles.tierBadgeSilver;
      icon = '🥈';
      tierLabel = copy('Silver', 'Bạc');
    } else if (tier === 'Gold') {
      tierClass = styles.tierBadgeGold;
      icon = '🥇';
      tierLabel = copy('Gold', 'Vàng');
    } else if (tier === 'Platinum') {
      tierClass = styles.tierBadgePlatinum;
      icon = '💎';
      tierLabel = copy('Platinum', 'Bạch Kim');
    }
    return (
      <span className={`${styles.tierBadge} ${tierClass}`}>
        <span>{icon}</span>
        <span>
          {tierLabel} ({copy('Tier', 'Cấp')} {stageLevel})
        </span>
      </span>
    );
  };

  const getTierClass = (tier: MedalTier) => {
    if (tier === 'Silver') return styles.tierSilver;
    if (tier === 'Gold') return styles.tierGold;
    if (tier === 'Platinum') return styles.tierPlatinum;
    return styles.tierBronze;
  };

  const getTierBarClass = (tier: MedalTier) => {
    if (tier === 'Silver') return styles.tierBarSilver;
    if (tier === 'Gold') return styles.tierBarGold;
    if (tier === 'Platinum') return styles.tierBarPlatinum;
    return styles.tierBarBronze;
  };

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor:
              notification.type === 'success' ? '#065f46' : '#991b1b',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <XCircle size={18} />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title={copy('Academic Medals & Badges Management', 'Quản lý Huy hiệu & Danh hiệu (Medals & Badges)')}
        description={copy(
          'Academic honors system for Researchers, Lecturers, Reviewers & Graduate Students. Support customizing and updating badge artwork at any time.',
          'Hệ thống vinh danh học thuật dành cho Researcher, Lecturer, Reviewer & Graduate Student. Hỗ trợ tùy biến và cập nhật ảnh huy hiệu bất kỳ lúc nào.'
        )}
        actions={
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.btnAction}
              onClick={() => setActiveModal('reset')}
              title={copy('Restore default 26 medals', 'Khôi phục danh sách chuẩn 26 huy hiệu')}
            >
              <RotateCcw size={15} />
              <span>{copy('Reset to Defaults', 'Khôi phục mẫu chuẩn')}</span>
            </button>
            <Button
              variant="primary"
              leftIcon={<Plus size={16} />}
              onClick={handleOpenCreate}
            >
              {copy('Add New Medal', 'Thêm Huy hiệu mới')}
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#2563eb' }}>
            <MedalIcon size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>{copy('Total Medals', 'Tổng số Huy hiệu')}</span>
            <span className={styles.statValue}>{stats.total}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#16a34a' }}>
            <CheckCircle2 size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>{copy('Active Medals', 'Đang kích hoạt')}</span>
            <span className={styles.statValue}>{stats.active}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#eab308' }}>
            <Award size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>{copy('Bronze / Silver Tier', 'Cấp Đồng / Bạc')}</span>
            <span className={styles.statValue}>
              {stats.bronze} 🥉 / {stats.silver} 🥈
            </span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#0ea5e9' }}>
            <Sparkles size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>{copy('Gold / Platinum Tier', 'Cấp Vàng / Bạch Kim')}</span>
            <span className={styles.statValue}>
              {stats.gold} 🥇 / {stats.platinum} 💎
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className={styles.toolbarCard}>
        <div className={styles.filtersGroup}>
          {/* Search */}
          <div className={styles.searchInputWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              id="searchMedalsInput"
              name="searchMedalsInput"
              placeholder={copy('Search by title, code or metric...', 'Tìm theo tên, mã hoặc chỉ số...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Role Filter */}
          <select
            id="roleFilterSelect"
            name="roleFilterSelect"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">{copy('All Roles', 'Tất cả vai trò')}</option>
            <option value="Researcher">{copy('Researcher', 'Researcher (Nhà nghiên cứu)')}</option>
            <option value="Lecturer">{copy('Lecturer', 'Lecturer (Giảng viên)')}</option>
            <option value="Reviewer">{copy('Reviewer', 'Reviewer (Người phản biện)')}</option>
            <option value="Graduate Student">{copy('Graduate Student', 'Graduate Student (Học viên)')}</option>
          </select>

          {/* Tier Filter */}
          <select
            id="tierFilterSelect"
            name="tierFilterSelect"
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">{copy('All Tiers', 'Tất cả thứ hạng')}</option>
            <option value="Bronze">{copy('🥉 Bronze', '🥉 Đồng (Bronze)')}</option>
            <option value="Silver">{copy('🥈 Silver', '🥈 Bạc (Silver)')}</option>
            <option value="Gold">{copy('🥇 Gold', '🥇 Vàng (Gold)')}</option>
            <option value="Platinum">{copy('💎 Platinum', '💎 Bạch Kim (Platinum)')}</option>
          </select>

          {/* Status Filter */}
          <select
            id="statusFilterSelect"
            name="statusFilterSelect"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">{copy('All Statuses', 'Tất cả trạng thái')}</option>
            <option value="ACTIVE">{copy('Active', 'Đang hoạt động')}</option>
            <option value="INACTIVE">{copy('Disabled', 'Đã tắt')}</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className={styles.viewToggle}>
          <button
            type="button"
            className={`${styles.viewToggleBtn} ${
              viewMode === 'grid' ? styles.viewToggleBtnActive : ''
            }`}
            onClick={() => setViewMode('grid')}
            title={copy('Card Grid View', 'Dạng lưới thẻ (Card Grid)')}
          >
            <LayoutGrid size={16} />
            <span>{copy('Cards', 'Thẻ')}</span>
          </button>
          <button
            type="button"
            className={`${styles.viewToggleBtn} ${
              viewMode === 'table' ? styles.viewToggleBtnActive : ''
            }`}
            onClick={() => setViewMode('table')}
            title={copy('Detailed Table View', 'Dạng bảng chi tiết (Table)')}
          >
            <Table size={16} />
            <span>{copy('Table', 'Bảng')}</span>
          </button>
        </div>
      </div>

      {/* Main Content: Loading / Empty / Data */}
      {isLoading ? (
        <div className={styles.emptyStateContainer}>
          <MedalIcon size={40} className="animate-spin text-blue-500" />
          <p>{copy('Loading medals list...', 'Đang tải danh sách huy hiệu...')}</p>
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
          {filteredMedals.map((medal) => {
            const primaryTitle = locale === 'en' ? (medal.title || medal.titleVi) : (medal.titleVi || medal.title);
            const secondaryTitle = locale === 'en' ? medal.titleVi : medal.title;
            const description = locale === 'en' ? (medal.description || medal.descriptionVi) : (medal.descriptionVi || medal.description);

            return (
              <div key={medal.id} className={styles.medalCard}>
                <div
                  className={`${styles.cardTierBar} ${getTierBarClass(
                    medal.tier
                  )}`}
                />
                <div className={styles.cardHeader}>
                  {renderTierBadge(medal.tier, medal.stageLevel)}
                  <span
                    className={
                      medal.isActive
                        ? styles.statusActive
                        : styles.statusInactive
                    }
                  >
                    {medal.isActive ? copy('Active', 'Hoạt động') : copy('Disabled', 'Tắt')}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.cardTopRow}>
                    {/* Medal Image Avatar with hover quick-change overlay */}
                    <div
                      className={`${styles.cardImageWrapper} ${getTierClass(
                        medal.tier
                      )}`}
                      onClick={() => handleOpenQuickImage(medal)}
                      title={copy('Click to replace artwork for this badge', 'Bấm để thay đổi hình ảnh huy hiệu này')}
                    >
                      <SafeMedalImage
                        src={medal.imageUrl}
                        alt={primaryTitle}
                        tier={medal.tier}
                        className={styles.cardImage}
                      />
                      <div className={styles.quickOverlay}>
                        <ImageIcon size={16} />
                      </div>
                    </div>

                    <div className={styles.cardTitleArea}>
                      <span className={styles.cardTitleVi}>{primaryTitle}</span>
                      <span className={styles.cardTitleEn}>{secondaryTitle}</span>
                      <span className={styles.cardCodeBadge}>{medal.code}</span>
                    </div>
                  </div>

                  {renderRoleBadges(medal.roles)}

                  <p className={styles.cardDesc}>{description}</p>

                  {/* Criteria Box */}
                  <div className={styles.criteriaBox}>
                    <div className={styles.criteriaBoxHeader}>
                      <HelpCircle size={14} color="#0284c7" />
                      <span>{copy('Medal criteria:', 'Điều kiện đạt huy hiệu:')}</span>
                    </div>
                    <div>
                      {copy('Requirement:', 'Yêu cầu:')}{' '}
                      <span className={styles.criteriaBoxMetric}>
                        {medal.criteriaMetric} &ge; {medal.criteriaThreshold}{' '}
                        {formatCriteriaUnit(medal.criteriaUnit)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className={styles.cardFooter}>
                  <button
                    type="button"
                    className={`${styles.btnAction} ${styles.btnChangeImgDirect}`}
                    onClick={() => handleOpenQuickImage(medal)}
                    title={copy('Replace medal image', 'Thay đổi ảnh đại diện của huy hiệu')}
                  >
                    <ImageIcon size={14} />
                    <span>{copy('Change Image', 'Đổi ảnh')}</span>
                  </button>

                  <div className={styles.cardActionsRight}>
                    <button
                      type="button"
                      className={styles.btnAction}
                      onClick={() => handleToggleStatus(medal)}
                      title={
                        medal.isActive
                          ? copy('Disable this medal', 'Tạm dừng huy hiệu')
                          : copy('Enable this medal', 'Kích hoạt huy hiệu')
                      }
                    >
                      {medal.isActive ? copy('Turn Off', 'Tắt') : copy('Turn On', 'Bật')}
                    </button>
                    <button
                      type="button"
                      className={styles.btnAction}
                      onClick={() => handleOpenEdit(medal)}
                      title={copy('Edit medal details', 'Chỉnh sửa thông tin chi tiết')}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.btnAction} ${styles.btnActionDanger}`}
                      onClick={() => {
                        setTargetMedal(medal);
                        setActiveModal('delete');
                      }}
                      title={copy('Delete medal', 'Xóa huy hiệu')}
                    >
                      <Trash2 size={14} />
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
                  <th style={{ width: '80px' }}>{copy('Badge', 'Huy hiệu')}</th>
                  <th>{copy('Title & Code', 'Tên & Mã')}</th>
                  <th>{copy('Target Roles', 'Vai trò áp dụng')}</th>
                  <th>{copy('Tier & Level', 'Cấp bậc (Tier)')}</th>
                  <th>{copy('Criteria', 'Điều kiện đạt')}</th>
                  <th>{copy('Status', 'Trạng thái')}</th>
                  <th style={{ textAlign: 'right' }}>{copy('Actions', 'Thao tác')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredMedals.map((medal) => {
                  const primaryTitle = locale === 'en' ? (medal.title || medal.titleVi) : (medal.titleVi || medal.title);
                  const secondaryTitle = locale === 'en' ? medal.titleVi : medal.title;

                  return (
                    <tr key={medal.id}>
                      <td>
                        <div className={styles.medalImageCell}>
                          <div
                            className={`${styles.medalThumbWrapper} ${getTierClass(
                              medal.tier
                            )}`}
                          >
                            <SafeMedalImage
                              src={medal.imageUrl}
                              alt={primaryTitle}
                              tier={medal.tier}
                              className={styles.medalThumb}
                            />
                          </div>
                          <button
                            type="button"
                            className={styles.changeImageQuickBtn}
                            onClick={() => handleOpenQuickImage(medal)}
                            title={copy('Replace badge image', 'Thay đổi ảnh của huy hiệu này')}
                          >
                            {copy('Change Image', 'Đổi ảnh')}
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
                          &ge; {medal.criteriaThreshold} {formatCriteriaUnit(medal.criteriaUnit)} (
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
                          {medal.isActive ? copy('Active', 'Hoạt động') : copy('Disabled', 'Tắt')}
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
                            onClick={() => handleToggleStatus(medal)}
                          >
                            {medal.isActive ? copy('Turn Off', 'Tắt') : copy('Turn On', 'Bật')}
                          </button>
                          <button
                            type="button"
                            className={styles.btnAction}
                            onClick={() => handleOpenEdit(medal)}
                          >
                            <Edit2 size={14} />
                            <span>{copy('Edit', 'Sửa')}</span>
                          </button>
                          <button
                            type="button"
                            className={`${styles.btnAction} ${styles.btnActionDanger}`}
                            onClick={() => {
                              setTargetMedal(medal);
                              setActiveModal('delete');
                            }}
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

      {/* QUICK CHANGE IMAGE MODAL */}
      {activeModal === 'quickImage' && targetMedal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '540px' }}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ImageIcon size={20} color="#2563eb" />
                <h3 className={styles.modalTitle}>
                  {copy(
                    `Update Badge Image: ${locale === 'en' ? targetMedal.title : targetMedal.titleVi}`,
                    `Cập nhật ảnh Huy hiệu: ${targetMedal.titleVi}`
                  )}
                </h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.imagePreviewHero}>
                <div
                  className={`${styles.imageHeroFrame} ${getTierClass(
                    targetMedal.tier
                  )}`}
                >
                  <SafeMedalImage
                    src={quickImageUrl}
                    alt="Preview"
                    tier={targetMedal.tier}
                    className={styles.imageHeroImg}
                    size={100}
                  />
                </div>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    color: '#64748b',
                    fontWeight: 500,
                  }}
                >
                  {copy(
                    `Preview Badge artwork (${targetMedal.tier})`,
                    `Xem trước ảnh huy hiệu (${targetMedal.tier})`
                  )}
                </span>
              </div>

              {/* Toggle upload vs URL */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  className={`${styles.btnAction} ${
                    quickImageTab === 'upload' ? styles.btnActionPrimary : ''
                  }`}
                  onClick={() => setQuickImageTab('upload')}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <UploadCloud size={16} />
                  <span>{copy('Upload from device (Firebase)', 'Tải ảnh từ máy tính (Firebase)')}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.btnAction} ${
                    quickImageTab === 'url' ? styles.btnActionPrimary : ''
                  }`}
                  onClick={() => setQuickImageTab('url')}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <ExternalLink size={16} />
                  <span>{copy('Paste Image URL', 'Dán đường dẫn ảnh (URL)')}</span>
                </button>
              </div>

              {quickImageTab === 'upload' ? (
                <div>
                  <input
                    type="file"
                    id="quickUploadFileInput"
                    name="quickUploadFileInput"
                    ref={fileInputRef}
                    onChange={handlePickFileQuick}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    style={{ display: 'none' }}
                  />
                  <div
                    className={styles.uploadDropArea}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadCloud size={36} color="#3b82f6" />
                    <p style={{ fontWeight: 600, color: '#1e293b' }}>
                      {isUploading
                        ? copy('Uploading to Firebase Storage...', 'Đang tải lên Firebase...')
                        : copy('Click here to select a new image file', 'Bấm vào đây để chọn file ảnh mới')}
                    </p>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {copy('Supports: PNG, JPG, WEBP, SVG (max 10MB)', 'Hỗ trợ: PNG, JPG, WEBP, SVG (tối đa 10MB)')}
                    </span>
                    {isUploading && (
                      <div className={styles.progressBarWrapper}>
                        <div
                          className={styles.progressBarFill}
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {uploadError && (
                    <p style={{ color: '#dc2626', fontSize: '0.8125rem' }}>
                      {uploadError}
                    </p>
                  )}
                </div>
              ) : (
                <div className={styles.formGroup}>
                  <label htmlFor="quickImageUrlInput" className={styles.formLabel}>
                    {copy('Online Image URL:', 'Đường dẫn ảnh trực tuyến (Image URL):')}
                  </label>
                  <input
                    type="url"
                    id="quickImageUrlInput"
                    name="quickImageUrlInput"
                    placeholder="https://example.com/medal-badge.png"
                    value={quickImageUrl}
                    onChange={(e) => setQuickImageUrl(e.target.value)}
                    className={styles.formInput}
                  />
                </div>
              )}

              {/* Sample Presets */}
              <div style={{ marginTop: '8px' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#64748b',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  {copy('Or choose a suggested preset icon:', 'Hoặc chọn mẫu ảnh gợi ý nhanh:')}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {PRESET_SAMPLE_IMAGES.map((preset) => (
                    <button
                      key={preset.labelEn}
                      type="button"
                      className={styles.btnAction}
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => setQuickImageUrl(preset.url)}
                    >
                      {copy(preset.labelEn, preset.labelVi)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnAction}
                onClick={() => setActiveModal(null)}
              >
                {copy('Cancel', 'Hủy bỏ')}
              </button>
              <Button
                variant="primary"
                onClick={handleSaveQuickImage}
                disabled={!quickImageUrl.trim() || isUploading}
              >
                {copy('Save New Image', 'Lưu hình ảnh mới')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE OR EDIT FULL MODAL */}
      {(activeModal === 'create' || activeModal === 'edit') && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {activeModal === 'create'
                  ? copy('Create New Academic Medal', 'Thêm Huy hiệu vinh danh mới')
                  : copy(
                      `Edit Medal: ${locale === 'en' ? targetMedal?.title : targetMedal?.titleVi}`,
                      `Chỉnh sửa Huy hiệu: ${targetMedal?.titleVi}`
                    )}
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveMedalForm}>
              <div className={styles.modalBody}>
                {/* Image Picker Section with Instant Preview */}
                <div className={styles.imageSectionCard}>
                  <div
                    className={`${styles.imagePreviewLargeWrapper} ${getTierClass(
                      formTier
                    )}`}
                  >
                    <SafeMedalImage
                      src={formImageUrl}
                      alt="Preview"
                      tier={formTier}
                      className={styles.imagePreviewLarge}
                      size={74}
                    />
                  </div>
                  <div className={styles.imageUploadControls}>
                    <label htmlFor="formImageUrlInput" className={styles.formLabel}>
                      {copy('Badge artwork (URL or upload file):', 'Hình ảnh huy hiệu (URL hoặc tải file lên):')}
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="url"
                        id="formImageUrlInput"
                        name="formImageUrlInput"
                        placeholder="https://... URL"
                        value={formImageUrl}
                        onChange={(e) => setFormImageUrl(e.target.value)}
                        className={styles.formInput}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="file"
                        id="formImageFileInput"
                        name="formImageFileInput"
                        ref={modalFileInputRef}
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = await uploadFile(file);
                          if (url) setFormImageUrl(url);
                        }}
                      />
                      <button
                        type="button"
                        className={styles.btnAction}
                        onClick={() => modalFileInputRef.current?.click()}
                        title={copy('Upload image directly to Firebase', 'Tải ảnh trực tiếp lên Firebase')}
                      >
                        <UploadCloud size={16} />
                        <span>{isUploading ? copy('Uploading...', 'Đang tải...') : copy('Upload', 'Upload')}</span>
                      </button>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {copy(
                        'Badge displays as a circular frame with tier glow.',
                        'Ảnh sẽ hiển thị dạng khung tròn với viền ánh kim theo cấp bậc.'
                      )}
                    </span>
                  </div>
                </div>

                {/* Title VI & EN */}
                <div className={styles.formGridTwo}>
                  <div className={styles.formGroup}>
                    <label htmlFor="formTitleViInput" className={styles.formLabel}>
                      {copy('Medal Title (Vietnamese) *', 'Tên Huy hiệu (Tiếng Việt) *')}
                    </label>
                    <input
                      type="text"
                      id="formTitleViInput"
                      name="formTitleViInput"
                      required
                      placeholder="vd: Học giả xác thực ORCID (Cấp 1 - Đồng)"
                      value={formTitleVi}
                      onChange={(e) => setFormTitleVi(e.target.value)}
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="formTitleEnInput" className={styles.formLabel}>
                      {copy('Medal Title (English)', 'Tên Huy hiệu (English)')}
                    </label>
                    <input
                      type="text"
                      id="formTitleEnInput"
                      name="formTitleEnInput"
                      placeholder="e.g.: ORCID Verified Scholar (Bronze)"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                {/* Description VI & EN */}
                <div className={styles.formGridTwo}>
                  <div className={styles.formGroup}>
                    <label htmlFor="formDescViInput" className={styles.formLabel}>
                      {copy('Criteria Description (Vietnamese)', 'Mô tả điều kiện (Tiếng Việt)')}
                    </label>
                    <textarea
                      id="formDescViInput"
                      name="formDescViInput"
                      rows={2}
                      placeholder="vd: Đã liên kết và xác minh định danh khoa học quốc tế ORCID iD thành công."
                      value={formDescriptionVi}
                      onChange={(e) => setFormDescriptionVi(e.target.value)}
                      className={styles.formTextarea}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="formDescEnInput" className={styles.formLabel}>
                      {copy('Criteria Description (English)', 'Mô tả điều kiện (English)')}
                    </label>
                    <textarea
                      id="formDescEnInput"
                      name="formDescEnInput"
                      rows={2}
                      placeholder="e.g.: Successfully connected and verified an international ORCID iD."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className={styles.formTextarea}
                    />
                  </div>
                </div>

                {/* Tier & Stage Level */}
                <div className={styles.formGridTwo}>
                  <div className={styles.formGroup}>
                    <label htmlFor="formTierSelect" className={styles.formLabel}>
                      {copy('Tier *', 'Cấp bậc xếp hạng (Tier) *')}
                    </label>
                    <select
                      id="formTierSelect"
                      name="formTierSelect"
                      value={formTier}
                      onChange={(e) =>
                        setFormTier(e.target.value as MedalTier)
                      }
                      className={styles.formSelect}
                    >
                      {TIER_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t === 'Bronze'
                            ? copy('🥉 Bronze', '🥉 Đồng (Bronze)')
                            : t === 'Silver'
                            ? copy('🥈 Silver', '🥈 Bạc (Silver)')
                            : t === 'Gold'
                            ? copy('🥇 Gold', '🥇 Vàng (Gold)')
                            : copy('💎 Platinum', '💎 Bạch Kim (Platinum)')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="formStageLevelInput" className={styles.formLabel}>
                      {copy('Stage Level', 'Cấp độ tiến trình (Stage Level)')}
                    </label>
                    <input
                      type="number"
                      id="formStageLevelInput"
                      name="formStageLevelInput"
                      min={1}
                      max={10}
                      value={formStageLevel}
                      onChange={(e) =>
                        setFormStageLevel(parseInt(e.target.value, 10) || 1)
                      }
                      className={styles.formInput}
                    />
                  </div>
                </div>

                {/* Roles Targeted */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {copy('Applicable Roles:', 'Vai trò áp dụng huy hiệu:')}
                  </label>
                  <div className={styles.checkboxRoleGroup}>
                    {ALL_ROLES.map((role) => {
                      const isChecked = formRoles.includes(role);
                      let label: string = role;
                      if (locale === 'vi') {
                        if (role === 'Researcher') label = 'Nhà nghiên cứu (Researcher)';
                        else if (role === 'Lecturer') label = 'Giảng viên (Lecturer)';
                        else if (role === 'Reviewer') label = 'Người phản biện (Reviewer)';
                        else if (role === 'Graduate Student') label = 'Học viên (Graduate Student)';
                      }
                      const inputId = `roleCheck_${role.replace(/\s+/g, '_')}`;
                      return (
                        <label key={role} htmlFor={inputId} className={styles.checkboxRoleItem}>
                          <input
                            type="checkbox"
                            id={inputId}
                            name={inputId}
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormRoles([...formRoles, role]);
                              } else {
                                setFormRoles(
                                  formRoles.filter((r) => r !== role)
                                );
                              }
                            }}
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Metric, Threshold, Unit */}
                <div className={styles.formGridTwo}>
                  <div className={styles.formGroup}>
                    <label htmlFor="formCriteriaMetricInput" className={styles.formLabel}>
                      {copy('Metric Code *', 'Mã chỉ số tự động (Metric Code) *')}
                    </label>
                    <input
                      type="text"
                      id="formCriteriaMetricInput"
                      name="formCriteriaMetricInput"
                      required
                      placeholder="e.g.: orcid_connected, published_papers, hosted_seminars..."
                      value={formCriteriaMetric}
                      onChange={(e) => setFormCriteriaMetric(e.target.value)}
                      className={styles.formInput}
                    />
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                    }}
                  >
                    <div className={styles.formGroup}>
                      <label htmlFor="formCriteriaThresholdInput" className={styles.formLabel}>
                        {copy('Threshold >=', 'Ngưỡng đạt >=')}
                      </label>
                      <input
                        type="number"
                        id="formCriteriaThresholdInput"
                        name="formCriteriaThresholdInput"
                        min={1}
                        value={formCriteriaThreshold}
                        onChange={(e) =>
                          setFormCriteriaThreshold(
                            parseInt(e.target.value, 10) || 1
                          )
                        }
                        className={styles.formInput}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="formCriteriaUnitInput" className={styles.formLabel}>
                        {copy('Unit', 'Đơn vị tính')}
                      </label>
                      <input
                        type="text"
                        id="formCriteriaUnitInput"
                        name="formCriteriaUnitInput"
                        placeholder="e.g.: papers, seminars..."
                        value={formCriteriaUnit}
                        onChange={(e) => setFormCriteriaUnit(e.target.value)}
                        className={styles.formInput}
                      />
                    </div>
                  </div>
                </div>

                {/* Active switch */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginTop: '8px',
                  }}
                >
                  <input
                    type="checkbox"
                    id="isActiveSwitch"
                    name="isActiveSwitch"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label
                    htmlFor="isActiveSwitch"
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {copy(
                      'Activate this badge immediately for users',
                      'Kích hoạt huy hiệu này ngay lập tức cho người dùng'
                    )}
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnAction}
                  onClick={() => setActiveModal(null)}
                >
                  {copy('Cancel', 'Hủy bỏ')}
                </button>
                <Button variant="primary" type="submit">
                  {activeModal === 'create'
                    ? copy('Create Medal', 'Tạo Huy hiệu')
                    : copy('Save Changes', 'Lưu thay đổi')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {activeModal === 'delete' && targetMedal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '440px' }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle} style={{ color: '#dc2626' }}>
                {copy('Confirm Medal Deletion', 'Xác nhận xóa Huy hiệu')}
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: '0.9375rem', color: '#334155' }}>
                {copy(
                  `Are you sure you want to delete medal "${locale === 'en' ? targetMedal.title : targetMedal.titleVi}"?`,
                  `Bạn có chắc chắn muốn xóa huy hiệu "${targetMedal.titleVi}" không?`
                )}
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                {copy(
                  'This action will remove the medal from the system catalog.',
                  'Hành động này sẽ xóa huy hiệu khỏi danh mục của hệ thống.'
                )}
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnAction}
                onClick={() => setActiveModal(null)}
              >
                {copy('Cancel', 'Hủy')}
              </button>
              <Button
                variant="danger"
                onClick={handleDeleteConfirm}
              >
                {copy('Confirm Delete', 'Xác nhận xóa')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RESET CONFIRMATION MODAL */}
      {activeModal === 'reset' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '460px' }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{copy('Restore Default Medals', 'Khôi phục mẫu chuẩn')}</h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: '0.9375rem', color: '#334155' }}>
                {copy(
                  'Restore all 26 standard academic medals for 4 roles (ORCID Scholar, Prolific Author, Academic Host, Master Mentor, Review Milestone, Seminar Participant, Flawless Progress).',
                  'Khôi phục lại toàn bộ 26 huy hiệu chuẩn cho 4 vai trò (ORCID Scholar, Prolific Author, Academic Host, Master Mentor, Review Milestone, Seminar Participant, Flawless Progress).'
                )}
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                {copy(
                  'Any custom changes made previously will be reset to initial defaults.',
                  'Các thay đổi tùy chỉnh trước đó sẽ được đặt lại về mặc định ban đầu.'
                )}
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnAction}
                onClick={() => setActiveModal(null)}
              >
                {copy('Cancel', 'Hủy')}
              </button>
              <Button variant="primary" onClick={handleResetDefaults}>
                {copy('Restore Catalog', 'Khôi phục danh sách')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMedals;
