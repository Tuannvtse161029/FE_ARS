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
  { label: 'Học giả ORCID', url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=160&auto=format&fit=crop&q=80' },
  { label: 'Tác giả sách', url: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=160&auto=format&fit=crop&q=80' },
  { label: 'Hội thảo / Mic', url: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=160&auto=format&fit=crop&q=80' },
  { label: 'Cố vấn / Mentor', url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=160&auto=format&fit=crop&q=80' },
  { label: 'Phản biện / Review', url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=160&auto=format&fit=crop&q=80' },
  { label: 'Tiến độ hoàn hảo', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=160&auto=format&fit=crop&q=80' },
];

export const AdminMedals: React.FC = () => {
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

  // Load Medals
  const loadMedals = async () => {
    setIsLoading(true);
    try {
      const data = await medalService.getAll();
      setMedals(data);
    } catch (err) {
      console.error('Failed to load medals:', err);
      showNotification('Không thể tải danh sách huy hiệu', 'error');
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
      showNotification(
        `Đã cập nhật hình ảnh huy hiệu "${targetMedal.titleVi}" thành công!`
      );
      setActiveModal(null);
      setTargetMedal(null);
      loadMedals();
    } catch (err) {
      console.error(err);
      showNotification('Lỗi khi cập nhật ảnh huy hiệu', 'error');
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
        showNotification('Tải ảnh lên Firebase thành công!');
      }
    } catch (err) {
      console.error(err);
      showNotification('Không thể tải ảnh lên Firebase', 'error');
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
    setFormImageUrl(
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=160&auto=format&fit=crop&q=80'
    );
    setFormCriteriaMetric('');
    setFormCriteriaThreshold(1);
    setFormCriteriaUnit('lần');
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
      showNotification('Vui lòng nhập tên huy hiệu', 'error');
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
      criteriaUnit: formCriteriaUnit.trim() || 'lần',
      isActive: formIsActive,
    };

    try {
      if (activeModal === 'create') {
        await medalService.create(payload);
        showNotification('Tạo huy hiệu mới thành công!');
      } else if (activeModal === 'edit' && targetMedal) {
        await medalService.update(targetMedal.id, payload);
        showNotification(`Đã cập nhật huy hiệu "${payload.titleVi}"!`);
      }
      setActiveModal(null);
      setTargetMedal(null);
      loadMedals();
    } catch (err) {
      console.error(err);
      showNotification('Lỗi khi lưu thông tin huy hiệu', 'error');
    }
  };

  // Toggle active status directly
  const handleToggleStatus = async (medal: Medal) => {
    try {
      await medalService.update(medal.id, { isActive: !medal.isActive });
      showNotification(
        `Đã ${!medal.isActive ? 'kích hoạt' : 'tạm dừng'} huy hiệu "${medal.titleVi}"`
      );
      loadMedals();
    } catch (err) {
      console.error(err);
      showNotification('Lỗi khi thay đổi trạng thái', 'error');
    }
  };

  // Handle Delete Medal
  const handleDeleteConfirm = async () => {
    if (!targetMedal) return;
    try {
      await medalService.delete(targetMedal.id);
      showNotification(`Đã xóa huy hiệu "${targetMedal.titleVi}"!`);
      setActiveModal(null);
      setTargetMedal(null);
      loadMedals();
    } catch (err) {
      console.error(err);
      showNotification('Lỗi khi xóa huy hiệu', 'error');
    }
  };

  // Handle Reset to Default Medals
  const handleResetDefaults = async () => {
    try {
      await medalService.resetToDefaults();
      showNotification('Đã khôi phục toàn bộ danh sách 26 huy hiệu mặc định!');
      setActiveModal(null);
      loadMedals();
    } catch (err) {
      console.error(err);
      showNotification('Lỗi khi khôi phục dữ liệu gốc', 'error');
    }
  };

  // Render role badges
  const renderRoleBadges = (roles: RoleTarget[]) => {
    if (roles.includes('All') || roles.length >= 4) {
      return (
        <span className={`${styles.roleTag} ${styles.roleTagAll}`}>
          Tất cả 4 vai trò
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
          return (
            <span key={role} className={`${styles.roleTag} ${roleClass}`}>
              {role === 'Graduate Student' ? 'Học viên' : role}
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
    if (tier === 'Silver') {
      tierClass = styles.tierBadgeSilver;
      icon = '🥈';
    } else if (tier === 'Gold') {
      tierClass = styles.tierBadgeGold;
      icon = '🥇';
    } else if (tier === 'Platinum') {
      tierClass = styles.tierBadgePlatinum;
      icon = '💎';
    }
    return (
      <span className={`${styles.tierBadge} ${tierClass}`}>
        <span>{icon}</span>
        <span>
          {tier} (Cấp {stageLevel})
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
        title="Quản lý Huy hiệu & Danh hiệu (Medals & Badges)"
        description="Hệ thống vinh danh học thuật dành cho Researcher, Lecturer, Reviewer & Graduate Student. Hỗ trợ tùy biến và cập nhật ảnh huy hiệu bất kỳ lúc nào."
        actions={
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.btnAction}
              onClick={() => setActiveModal('reset')}
              title="Khôi phục danh sách chuẩn 26 huy hiệu"
            >
              <RotateCcw size={15} />
              <span>Khôi phục mẫu chuẩn</span>
            </button>
            <Button
              variant="primary"
              leftIcon={<Plus size={16} />}
              onClick={handleOpenCreate}
            >
              Thêm Huy hiệu mới
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
            <span className={styles.statLabel}>Tổng số Huy hiệu</span>
            <span className={styles.statValue}>{stats.total}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#16a34a' }}>
            <CheckCircle2 size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Đang kích hoạt</span>
            <span className={styles.statValue}>{stats.active}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#eab308' }}>
            <Award size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Cấp Đồng / Bạc</span>
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
            <span className={styles.statLabel}>Cấp Vàng / Bạch Kim</span>
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
              placeholder="Tìm theo tên, mã hoặc chỉ số..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Role Filter */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="Researcher">Researcher (Nhà nghiên cứu)</option>
            <option value="Lecturer">Lecturer (Giảng viên)</option>
            <option value="Reviewer">Reviewer (Người phản biện)</option>
            <option value="Graduate Student">Graduate Student (Học viên)</option>
          </select>

          {/* Tier Filter */}
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">Tất cả thứ hạng</option>
            <option value="Bronze">🥉 Đồng (Bronze)</option>
            <option value="Silver">🥈 Bạc (Silver)</option>
            <option value="Gold">🥇 Vàng (Gold)</option>
            <option value="Platinum">💎 Bạch Kim (Platinum)</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Đã tắt</option>
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
            title="Dạng lưới thẻ (Card Grid)"
          >
            <LayoutGrid size={16} />
            <span>Thẻ</span>
          </button>
          <button
            type="button"
            className={`${styles.viewToggleBtn} ${
              viewMode === 'table' ? styles.viewToggleBtnActive : ''
            }`}
            onClick={() => setViewMode('table')}
            title="Dạng bảng chi tiết (Table)"
          >
            <Table size={16} />
            <span>Bảng</span>
          </button>
        </div>
      </div>

      {/* Main Content: Loading / Empty / Data */}
      {isLoading ? (
        <div className={styles.emptyStateContainer}>
          <MedalIcon size={40} className="animate-spin text-blue-500" />
          <p>Đang tải danh sách huy hiệu...</p>
        </div>
      ) : filteredMedals.length === 0 ? (
        <EmptyState
          icon={<MedalIcon size={32} />}
          title="Không tìm thấy huy hiệu nào"
          description="Thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc phía trên."
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
              Xóa bộ lọc
            </Button>
          }
        />
      ) : viewMode === 'grid' ? (
        /* CARD GRID VIEW */
        <div className={styles.cardsGrid}>
          {filteredMedals.map((medal) => (
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
                  {medal.isActive ? 'Hoạt động' : 'Tắt'}
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
                    title="Bấm để thay đổi hình ảnh huy hiệu này"
                  >
                    {medal.imageUrl ? (
                      <img
                        src={medal.imageUrl}
                        alt={medal.titleVi}
                        className={styles.cardImage}
                        onError={(e) => {
                          // Fallback on broken link
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=160&auto=format&fit=crop&q=80';
                        }}
                      />
                    ) : (
                      <span className={styles.medalThumbFallback}>🏅</span>
                    )}
                    <div className={styles.quickOverlay}>
                      <ImageIcon size={16} />
                    </div>
                  </div>

                  <div className={styles.cardTitleArea}>
                    <span className={styles.cardTitleVi}>{medal.titleVi}</span>
                    <span className={styles.cardTitleEn}>{medal.title}</span>
                    <span className={styles.cardCodeBadge}>{medal.code}</span>
                  </div>
                </div>

                {renderRoleBadges(medal.roles)}

                <p className={styles.cardDesc}>{medal.descriptionVi}</p>

                {/* Criteria Box */}
                <div className={styles.criteriaBox}>
                  <div className={styles.criteriaBoxHeader}>
                    <HelpCircle size={14} color="#0284c7" />
                    <span>Điều kiện đạt huy hiệu:</span>
                  </div>
                  <div>
                    Yêu cầu:{' '}
                    <span className={styles.criteriaBoxMetric}>
                      {medal.criteriaMetric} &ge; {medal.criteriaThreshold}{' '}
                      {medal.criteriaUnit}
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
                  title="Thay đổi ảnh đại diện của huy hiệu"
                >
                  <ImageIcon size={14} />
                  <span>Đổi ảnh</span>
                </button>

                <div className={styles.cardActionsRight}>
                  <button
                    type="button"
                    className={styles.btnAction}
                    onClick={() => handleToggleStatus(medal)}
                    title={
                      medal.isActive ? 'Tạm dừng huy hiệu' : 'Kích hoạt huy hiệu'
                    }
                  >
                    {medal.isActive ? 'Tắt' : 'Bật'}
                  </button>
                  <button
                    type="button"
                    className={styles.btnAction}
                    onClick={() => handleOpenEdit(medal)}
                    title="Chỉnh sửa thông tin chi tiết"
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
                    title="Xóa huy hiệu"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className={styles.tableCard}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Huy hiệu</th>
                  <th>Tên & Mã</th>
                  <th>Vai trò áp dụng</th>
                  <th>Cấp bậc (Tier)</th>
                  <th>Điều kiện đạt</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredMedals.map((medal) => (
                  <tr key={medal.id}>
                    <td>
                      <div className={styles.medalImageCell}>
                        <div
                          className={`${styles.medalThumbWrapper} ${getTierClass(
                            medal.tier
                          )}`}
                        >
                          {medal.imageUrl ? (
                            <img
                              src={medal.imageUrl}
                              alt={medal.titleVi}
                              className={styles.medalThumb}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=160&auto=format&fit=crop&q=80';
                              }}
                            />
                          ) : (
                            <span className={styles.medalThumbFallback}>
                              🏅
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className={styles.changeImageQuickBtn}
                          onClick={() => handleOpenQuickImage(medal)}
                          title="Thay đổi ảnh của huy hiệu này"
                        >
                          Đổi ảnh
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className={styles.medalTitleInfo}>
                        <span className={styles.medalNameVi}>
                          {medal.titleVi}
                        </span>
                        <span className={styles.medalNameEn}>{medal.title}</span>
                        <span className={styles.cardCodeBadge}>
                          {medal.code}
                        </span>
                      </div>
                    </td>
                    <td>{renderRoleBadges(medal.roles)}</td>
                    <td>{renderTierBadge(medal.tier, medal.stageLevel)}</td>
                    <td>
                      <span className={styles.criteriaText}>
                        &ge; {medal.criteriaThreshold} {medal.criteriaUnit} (
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
                        {medal.isActive ? 'Hoạt động' : 'Tắt'}
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
                          {medal.isActive ? 'Tắt' : 'Bật'}
                        </button>
                        <button
                          type="button"
                          className={styles.btnAction}
                          onClick={() => handleOpenEdit(medal)}
                        >
                          <Edit2 size={14} />
                          <span>Sửa</span>
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
                ))}
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
                  Cập nhật ảnh Huy hiệu: {targetMedal.titleVi}
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
                  <img
                    src={
                      quickImageUrl ||
                      'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=160&auto=format&fit=crop&q=80'
                    }
                    alt="Preview"
                    className={styles.imageHeroImg}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=160&auto=format&fit=crop&q=80';
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    color: '#64748b',
                    fontWeight: 500,
                  }}
                >
                  Xem trước ảnh huy hiệu ({targetMedal.tier})
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
                  <span>Tải ảnh từ máy tính (Firebase)</span>
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
                  <span>Dán đường dẫn ảnh (URL)</span>
                </button>
              </div>

              {quickImageTab === 'upload' ? (
                <div>
                  <input
                    type="file"
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
                        ? 'Đang tải lên Firebase...'
                        : 'Bấm vào đây để chọn file ảnh mới'}
                    </p>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Hỗ trợ: PNG, JPG, WEBP, SVG (tối đa 10MB)
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
                  <label className={styles.formLabel}>
                    Đường dẫn ảnh trực tuyến (Image URL):
                  </label>
                  <input
                    type="url"
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
                  Hoặc chọn mẫu ảnh gợi ý nhanh:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {PRESET_SAMPLE_IMAGES.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className={styles.btnAction}
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => setQuickImageUrl(preset.url)}
                    >
                      {preset.label}
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
                Hủy bỏ
              </button>
              <Button
                variant="primary"
                onClick={handleSaveQuickImage}
                disabled={!quickImageUrl.trim() || isUploading}
              >
                Lưu hình ảnh mới
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
                  ? 'Thêm Huy hiệu vinh danh mới'
                  : `Chỉnh sửa Huy hiệu: ${targetMedal?.titleVi}`}
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
                    <img
                      src={
                        formImageUrl ||
                        'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=160&auto=format&fit=crop&q=80'
                      }
                      alt="Preview"
                      className={styles.imagePreviewLarge}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=160&auto=format&fit=crop&q=80';
                      }}
                    />
                  </div>
                  <div className={styles.imageUploadControls}>
                    <label className={styles.formLabel}>
                      Hình ảnh huy hiệu (URL hoặc tải file lên):
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="url"
                        placeholder="https://... URL ảnh"
                        value={formImageUrl}
                        onChange={(e) => setFormImageUrl(e.target.value)}
                        className={styles.formInput}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="file"
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
                        title="Tải ảnh trực tiếp lên Firebase"
                      >
                        <UploadCloud size={16} />
                        <span>{isUploading ? 'Đang tải...' : 'Upload'}</span>
                      </button>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Ảnh sẽ hiển thị dạng khung tròn với viền ánh kim theo cấp bậc.
                    </span>
                  </div>
                </div>

                {/* Title VI & EN */}
                <div className={styles.formGridTwo}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Tên Huy hiệu (Tiếng Việt) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="vd: Học giả xác thực ORCID (Cấp 1 - Đồng)"
                      value={formTitleVi}
                      onChange={(e) => setFormTitleVi(e.target.value)}
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Tên Huy hiệu (English)
                    </label>
                    <input
                      type="text"
                      placeholder="vd: ORCID Verified Scholar (Bronze)"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                {/* Description VI & EN */}
                <div className={styles.formGridTwo}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Mô tả điều kiện (Tiếng Việt)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="vd: Đã liên kết và xác minh định danh khoa học quốc tế ORCID iD thành công."
                      value={formDescriptionVi}
                      onChange={(e) => setFormDescriptionVi(e.target.value)}
                      className={styles.formTextarea}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Mô tả điều kiện (English)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="vd: Successfully connected and verified an international ORCID iD."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className={styles.formTextarea}
                    />
                  </div>
                </div>

                {/* Tier & Stage Level */}
                <div className={styles.formGridTwo}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Cấp bậc xếp hạng (Tier) *
                    </label>
                    <select
                      value={formTier}
                      onChange={(e) =>
                        setFormTier(e.target.value as MedalTier)
                      }
                      className={styles.formSelect}
                    >
                      {TIER_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t === 'Bronze'
                            ? '🥉 Đồng (Bronze)'
                            : t === 'Silver'
                            ? '🥈 Bạc (Silver)'
                            : t === 'Gold'
                            ? '🥇 Vàng (Gold)'
                            : '💎 Bạch Kim (Platinum)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Cấp độ tiến trình (Stage Level)
                    </label>
                    <input
                      type="number"
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
                    Vai trò áp dụng huy hiệu:
                  </label>
                  <div className={styles.checkboxRoleGroup}>
                    {ALL_ROLES.map((role) => {
                      const isChecked = formRoles.includes(role);
                      return (
                        <label key={role} className={styles.checkboxRoleItem}>
                          <input
                            type="checkbox"
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
                          <span>{role}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Metric, Threshold, Unit */}
                <div className={styles.formGridTwo}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Mã chỉ số tự động (Metric Code) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="vd: orcid_connected, published_papers, hosted_seminars..."
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
                      <label className={styles.formLabel}>Ngưỡng đạt &ge;</label>
                      <input
                        type="number"
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
                      <label className={styles.formLabel}>Đơn vị tính</label>
                      <input
                        type="text"
                        placeholder="vd: bài báo, hội thảo..."
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
                    Kích hoạt huy hiệu này ngay lập tức cho người dùng
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnAction}
                  onClick={() => setActiveModal(null)}
                >
                  Hủy bỏ
                </button>
                <Button variant="primary" type="submit">
                  {activeModal === 'create' ? 'Tạo Huy hiệu' : 'Lưu thay đổi'}
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
                Xác nhận xóa Huy hiệu
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
                Bạn có chắc chắn muốn xóa huy hiệu{' '}
                <strong>"{targetMedal.titleVi}"</strong> không?
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                Hành động này sẽ xóa huy hiệu khỏi danh mục của hệ thống.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnAction}
                onClick={() => setActiveModal(null)}
              >
                Hủy
              </button>
              <Button
                variant="danger"
                onClick={handleDeleteConfirm}
              >
                Xác nhận xóa
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
              <h3 className={styles.modalTitle}>Khôi phục mẫu chuẩn</h3>
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
                Khôi phục lại toàn bộ <strong>26 huy hiệu chuẩn</strong> cho 4
                vai trò (ORCID Scholar, Prolific Author, Academic Host, Master
                Mentor, Review Milestone, Seminar Participant, Flawless Progress).
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                Các thay đổi tùy chỉnh trước đó sẽ được đặt lại về mặc định ban
                đầu.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnAction}
                onClick={() => setActiveModal(null)}
              >
                Hủy
              </button>
              <Button variant="primary" onClick={handleResetDefaults}>
                Khôi phục danh sách
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMedals;
