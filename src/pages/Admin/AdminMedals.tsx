import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Medal as MedalIcon,
  Award,
  Trophy,
  Crown,
  BookOpen,
  Mic,
  GraduationCap,
  ClipboardCheck,
  Sparkles,
  ShieldCheck,
  Star,
  Gem,
  Flame,
  Zap,
  Compass,
  Target,
  FileText,
  Bookmark,
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

export const LUCIDE_ICONS_MAP: Record<
  string,
  React.ComponentType<any>
> = {
  Medal: MedalIcon,
  Award: Award,
  Trophy: Trophy,
  Crown: Crown,
  BookOpen: BookOpen,
  Mic: Mic,
  GraduationCap: GraduationCap,
  ClipboardCheck: ClipboardCheck,
  Sparkles: Sparkles,
  ShieldCheck: ShieldCheck,
  Star: Star,
  Gem: Gem,
  Flame: Flame,
  Zap: Zap,
  Compass: Compass,
  Target: Target,
  FileText: FileText,
  Bookmark: Bookmark,
};

export const LUCIDE_ICONS_LIST = [
  { name: 'Medal', labelVi: 'Huy chương', labelEn: 'Medal' },
  { name: 'Award', labelVi: 'Giải thưởng', labelEn: 'Award' },
  { name: 'Trophy', labelVi: 'Cúp vinh danh', labelEn: 'Trophy' },
  { name: 'Crown', labelVi: 'Vương miện', labelEn: 'Crown' },
  { name: 'BookOpen', labelVi: 'Sách / Tác giả', labelEn: 'Book / Author' },
  { name: 'Mic', labelVi: 'Micro / Hội thảo', labelEn: 'Mic / Seminar' },
  { name: 'GraduationCap', labelVi: 'Mũ tốt nghiệp / Mentor', labelEn: 'Mentor' },
  { name: 'ClipboardCheck', labelVi: 'Phản biện / Đánh giá', labelEn: 'Reviewer' },
  { name: 'Sparkles', labelVi: 'Tiến độ hoàn hảo', labelEn: 'Flawless' },
  { name: 'ShieldCheck', labelVi: 'Khiên bảo vệ / ORCID', labelEn: 'ORCID' },
  { name: 'Star', labelVi: 'Ngôi sao học thuật', labelEn: 'Star' },
  { name: 'Gem', labelVi: 'Kim cương', labelEn: 'Diamond' },
  { name: 'Flame', labelVi: 'Năng suất cao', labelEn: 'Flame' },
  { name: 'Zap', labelVi: 'Đột phá', labelEn: 'Breakthrough' },
  { name: 'Compass', labelVi: 'Định hướng', labelEn: 'Compass' },
  { name: 'Target', labelVi: 'Mục tiêu', labelEn: 'Target' },
  { name: 'FileText', labelVi: 'Bài báo', labelEn: 'Paper' },
  { name: 'Bookmark', labelVi: 'Dấu ấn', labelEn: 'Bookmark' },
];

const TIER_METALLIC_STYLES: Record<
  MedalTier,
  { bg: string; border: string; iconColor: string; glow: string }
> = {
  Bronze: {
    bg: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
    border: '#cd7f32',
    iconColor: '#92400e',
    glow: '0 0 10px rgba(205, 127, 50, 0.4)',
  },
  Silver: {
    bg: 'linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%)',
    border: '#94a3b8',
    iconColor: '#334155',
    glow: '0 0 10px rgba(148, 163, 184, 0.45)',
  },
  Gold: {
    bg: 'linear-gradient(135deg, #fef9c3 0%, #fde047 100%)',
    border: '#eab308',
    iconColor: '#854d0e',
    glow: '0 0 12px rgba(234, 179, 8, 0.5)',
  },
  Platinum: {
    bg: 'linear-gradient(135deg, #e0f2fe 0%, #7dd3fc 100%)',
    border: '#38bdf8',
    iconColor: '#0369a1',
    glow: '0 0 14px rgba(56, 189, 248, 0.55)',
  },
};

/**
 * Resolves the appropriate Lucide icon name from medal code / metric / imageUrl
 */
export const resolveMedalIconName = (medal: {
  code?: string;
  imageUrl?: string;
  criteriaMetric?: string;
}): string => {
  if (medal.imageUrl && medal.imageUrl.startsWith('lucide:')) {
    const raw = medal.imageUrl.replace('lucide:', '').trim();
    if (LUCIDE_ICONS_MAP[raw]) return raw;
  }
  const code = (medal.code || '').toUpperCase();
  const metric = (medal.criteriaMetric || '').toLowerCase();

  if (code.includes('ORCID') || metric.includes('orcid')) return 'ShieldCheck';
  if (code.includes('PROLIFIC') || metric.includes('paper')) return 'BookOpen';
  if (code.includes('HOST') || metric.includes('host') || metric.includes('seminar')) return 'Mic';
  if (code.includes('MENTOR') || metric.includes('guided') || metric.includes('group')) return 'GraduationCap';
  if (code.includes('REVIEW') || metric.includes('review')) return 'ClipboardCheck';
  if (code.includes('PARTICIPANT') || metric.includes('attended')) return 'Award';
  if (code.includes('FLAWLESS') || metric.includes('flawless')) return 'Sparkles';

  return 'Medal';
};

/**
 * Renders a medal badge artwork using lucide-react vector icons or safe image fallback.
 * Guaranteed 0 CORB loops, 0 network errors.
 */
export const SafeMedalBadge: React.FC<{
  imageUrl?: string;
  code?: string;
  criteriaMetric?: string;
  tier: MedalTier;
  size?: number;
  className?: string;
  alt?: string;
}> = ({ imageUrl, code, criteriaMetric, tier, size = 52, className, alt }) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [imageUrl]);

  const style = TIER_METALLIC_STYLES[tier] || TIER_METALLIC_STYLES.Bronze;
  const iconName = resolveMedalIconName({ code, imageUrl, criteriaMetric });
  const IconComponent = LUCIDE_ICONS_MAP[iconName] || MedalIcon;

  const isCustomHttpImage =
    imageUrl &&
    !imageUrl.startsWith('lucide:') &&
    (imageUrl.startsWith('http://') ||
      imageUrl.startsWith('https://') ||
      imageUrl.startsWith('data:') ||
      imageUrl.startsWith('blob:'));

  if (isCustomHttpImage && !imgFailed) {
    return (
      <img
        src={imageUrl}
        alt={alt || 'Medal artwork'}
        className={className}
        loading="lazy"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          objectFit: 'cover',
          border: `2px solid ${style.border}`,
          boxShadow: style.glow,
        }}
        onError={(e) => {
          e.currentTarget.onerror = null;
          setImgFailed(true);
        }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: style.bg,
        border: `2px solid ${style.border}`,
        boxShadow: style.glow,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        userSelect: 'none',
      }}
      title={alt || iconName}
    >
      <IconComponent size={size * 0.52} color={style.iconColor} />
    </div>
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

  // Quick icon/image change state
  const [quickImageUrl, setQuickImageUrl] = useState<string>('lucide:Medal');
  const [quickImageTab, setQuickImageTab] = useState<'lucide' | 'upload' | 'url'>('lucide');

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
  const [formImageUrl, setFormImageUrl] = useState('lucide:Medal');
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

  // Load Medals from backend
  const loadMedals = async () => {
    setIsLoading(true);
    try {
      const data = await medalService.getAll();
      setMedals(data);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || copy('Failed to load medals from backend', 'Không thể tải danh sách huy hiệu');
      showNotification(msg, 'error');
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

  // Handle Quick Image / Icon Modal Open
  const handleOpenQuickImage = (medal: Medal) => {
    setTargetMedal(medal);
    setQuickImageUrl(medal.imageUrl || 'lucide:' + resolveMedalIconName(medal));
    setQuickImageTab(medal.imageUrl && medal.imageUrl.startsWith('http') ? 'url' : 'lucide');
    resetUpload();
    setActiveModal('quickImage');
  };

  // Handle Quick Image / Icon Save
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
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || copy('Failed to update medal image', 'Lỗi khi cập nhật ảnh huy hiệu');
      showNotification(msg, 'error');
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
    } catch {
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
    setFormImageUrl('lucide:Medal');
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
    setFormImageUrl(medal.imageUrl || 'lucide:' + resolveMedalIconName(medal));
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
      imageUrl: formImageUrl.trim() || 'lucide:Medal',
      criteriaMetric: formCriteriaMetric.trim() || 'default_metric',
      criteriaThreshold: Number(formCriteriaThreshold) || 1,
      criteriaUnit: formCriteriaUnit.trim() || copy('times', 'lần'),
      isActive: formIsActive,
    };

    try {
      if (activeModal === 'create') {
        await medalService.create(payload);
        showNotification(copy('Created new academic medal successfully on backend!', 'Tạo huy hiệu mới thành công trên hệ thống!'));
      } else if (activeModal === 'edit' && targetMedal) {
        await medalService.update(targetMedal.id, payload);
        const name = locale === 'en' ? payload.title : payload.titleVi;
        showNotification(copy(`Updated medal "${name}" successfully!`, `Đã cập nhật huy hiệu "${name}" thành công!`));
      }
      setActiveModal(null);
      setTargetMedal(null);
      loadMedals();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || copy('Error saving medal information', 'Lỗi khi lưu thông tin huy hiệu');
      showNotification(msg, 'error');
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
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || copy('Failed to change status', 'Lỗi khi thay đổi trạng thái');
      showNotification(msg, 'error');
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
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || copy('Error deleting medal', 'Lỗi khi xóa huy hiệu');
      showNotification(msg, 'error');
    }
  };

  // Handle Reset to Default Medals
  const handleResetDefaults = async () => {
    try {
      await medalService.resetToDefaults();
      showNotification(
        copy(
          'Restored all 26 default academic medals successfully on backend!',
          'Đã khôi phục toàn bộ danh sách 26 huy hiệu mặc định trên hệ thống!'
        )
      );
      setActiveModal(null);
      loadMedals();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || copy('Failed to restore default medals', 'Lỗi khi khôi phục dữ liệu gốc');
      showNotification(msg, 'error');
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
          'Academic honors system for Researchers, Lecturers, Reviewers & Graduate Students. Support customizing artwork with Lucide Icons or custom images at any time.',
          'Hệ thống vinh danh học thuật dành cho Researcher, Lecturer, Reviewer & Graduate Student. Hỗ trợ tùy biến biểu tượng với thư viện Lucide Icons hoặc ảnh riêng bất kỳ lúc nào.'
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
          <p>{copy('Loading medals list from backend...', 'Đang tải danh sách huy hiệu từ hệ thống...')}</p>
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
                    {/* Medal Avatar using Lucide-react or custom safe image */}
                    <div
                      style={{ cursor: 'pointer', position: 'relative' }}
                      onClick={() => handleOpenQuickImage(medal)}
                      title={copy('Click to change icon or image for this badge', 'Bấm để đổi biểu tượng hoặc ảnh của huy hiệu này')}
                    >
                      <SafeMedalBadge
                        imageUrl={medal.imageUrl}
                        code={medal.code}
                        criteriaMetric={medal.criteriaMetric}
                        tier={medal.tier}
                        size={64}
                        alt={primaryTitle}
                      />
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
                    title={copy('Replace medal icon/artwork', 'Thay đổi biểu tượng/ảnh của huy hiệu')}
                  >
                    <ImageIcon size={14} />
                    <span>{copy('Change Icon', 'Đổi biểu tượng')}</span>
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
                          <SafeMedalBadge
                            imageUrl={medal.imageUrl}
                            code={medal.code}
                            criteriaMetric={medal.criteriaMetric}
                            tier={medal.tier}
                            size={44}
                            alt={primaryTitle}
                          />
                          <button
                            type="button"
                            className={styles.changeImageQuickBtn}
                            onClick={() => handleOpenQuickImage(medal)}
                            title={copy('Replace badge icon', 'Thay đổi biểu tượng của huy hiệu này')}
                          >
                            {copy('Change Icon', 'Đổi icon')}
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

      {/* QUICK CHANGE ICON / IMAGE MODAL */}
      {activeModal === 'quickImage' && targetMedal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '580px' }}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ImageIcon size={20} color="#2563eb" />
                <h3 className={styles.modalTitle}>
                  {copy(
                    `Update Badge Icon: ${locale === 'en' ? targetMedal.title : targetMedal.titleVi}`,
                    `Cập nhật Biểu tượng Huy hiệu: ${targetMedal.titleVi}`
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
              {/* Preview with Tier Frame */}
              <div className={styles.imagePreviewHero}>
                <SafeMedalBadge
                  imageUrl={quickImageUrl}
                  tier={targetMedal.tier}
                  size={92}
                  alt="Preview"
                />
                <span
                  style={{
                    fontSize: '0.8125rem',
                    color: '#64748b',
                    fontWeight: 500,
                  }}
                >
                  {copy(
                    `Live Preview Badge (${targetMedal.tier} Tier)`,
                    `Xem trước Huy hiệu (${targetMedal.tier})`
                  )}
                </span>
              </div>

              {/* Tabs: Lucide Icons (Default), Firebase Upload, URL */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  className={`${styles.btnAction} ${
                    quickImageTab === 'lucide' ? styles.btnActionPrimary : ''
                  }`}
                  onClick={() => setQuickImageTab('lucide')}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <MedalIcon size={16} />
                  <span>{copy('Lucide Icons Library', 'Biểu tượng Lucide')}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.btnAction} ${
                    quickImageTab === 'upload' ? styles.btnActionPrimary : ''
                  }`}
                  onClick={() => setQuickImageTab('upload')}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <UploadCloud size={16} />
                  <span>{copy('Upload Image', 'Tải file ảnh')}</span>
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
                  <span>{copy('Image URL', 'Link ảnh')}</span>
                </button>
              </div>

              {/* Tab 1: Lucide Icons Grid */}
              {quickImageTab === 'lucide' && (
                <div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#64748b',
                      display: 'block',
                      marginBottom: '8px',
                    }}
                  >
                    {copy('Select an icon from the lucide-react library:', 'Chọn biểu tượng chuẩn từ thư viện lucide-react:')}
                  </span>
                  <div className={styles.iconPickerGrid}>
                    {LUCIDE_ICONS_LIST.map((item) => {
                      const IconComp = LUCIDE_ICONS_MAP[item.name] || MedalIcon;
                      const isSelected = quickImageUrl === `lucide:${item.name}`;
                      return (
                        <button
                          key={item.name}
                          type="button"
                          className={`${styles.iconPickerItem} ${
                            isSelected ? styles.iconPickerItemActive : ''
                          }`}
                          onClick={() => setQuickImageUrl(`lucide:${item.name}`)}
                        >
                          <IconComp size={24} color={isSelected ? '#1d4ed8' : '#475569'} />
                          <span>{locale === 'en' ? item.labelEn : item.labelVi}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 2: Upload File */}
              {quickImageTab === 'upload' && (
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
                        : copy('Click here to select a custom image file', 'Bấm vào đây để chọn file ảnh riêng')}
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
              )}

              {/* Tab 3: Direct URL */}
              {quickImageTab === 'url' && (
                <div className={styles.formGroup}>
                  <label htmlFor="quickImageUrlInput" className={styles.formLabel}>
                    {copy('Online Image URL:', 'Đường dẫn ảnh trực tuyến (Image URL):')}
                  </label>
                  <input
                    type="url"
                    id="quickImageUrlInput"
                    name="quickImageUrlInput"
                    placeholder="https://example.com/badge.png"
                    value={quickImageUrl.startsWith('lucide:') ? '' : quickImageUrl}
                    onChange={(e) => setQuickImageUrl(e.target.value)}
                    className={styles.formInput}
                  />
                </div>
              )}
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
                {copy('Save Changes', 'Lưu biểu tượng mới')}
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
                {/* Artwork selection with Live Badge Preview */}
                <div className={styles.imageSectionCard}>
                  <SafeMedalBadge
                    imageUrl={formImageUrl}
                    tier={formTier}
                    size={72}
                    alt="Preview"
                  />
                  <div className={styles.imageUploadControls}>
                    <label htmlFor="formImageUrlInput" className={styles.formLabel}>
                      {copy('Badge Artwork (Lucide Icon code or image URL):', 'Biểu tượng / Hình ảnh (Mã Lucide Icon hoặc URL):')}
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        id="formImageUrlInput"
                        name="formImageUrlInput"
                        placeholder="vd: lucide:BookOpen hoặc https://..."
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
                        title={copy('Upload image to Firebase', 'Tải ảnh lên Firebase')}
                      >
                        <UploadCloud size={16} />
                        <span>{isUploading ? copy('Uploading...', 'Đang tải...') : copy('Upload', 'Upload')}</span>
                      </button>
                    </div>

                    {/* Quick select icons row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {['Medal', 'Award', 'Trophy', 'Crown', 'BookOpen', 'Mic', 'GraduationCap', 'ClipboardCheck', 'Sparkles', 'ShieldCheck'].map((ic) => {
                        const IconComponent = LUCIDE_ICONS_MAP[ic] || MedalIcon;
                        const isChosen = formImageUrl === `lucide:${ic}`;
                        return (
                          <button
                            key={ic}
                            type="button"
                            onClick={() => setFormImageUrl(`lucide:${ic}`)}
                            className={styles.btnAction}
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.75rem',
                              background: isChosen ? '#dbeafe' : '#ffffff',
                              borderColor: isChosen ? '#2563eb' : '#cbd5e1',
                              color: isChosen ? '#1d4ed8' : '#334155',
                            }}
                          >
                            <IconComponent size={14} />
                            <span>{ic}</span>
                          </button>
                        );
                      })}
                    </div>
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
                  'This action will permanently delete the medal from the backend database.',
                  'Hành động này sẽ xóa vĩnh viễn huy hiệu khỏi cơ sở dữ liệu hệ thống.'
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
                  'Restore all 26 standard academic medals for 4 roles (ORCID Scholar, Prolific Author, Academic Host, Master Mentor, Review Milestone, Seminar Participant, Flawless Progress) directly on backend database.',
                  'Khôi phục lại toàn bộ 26 huy hiệu chuẩn cho 4 vai trò (ORCID Scholar, Prolific Author, Academic Host, Master Mentor, Review Milestone, Seminar Participant, Flawless Progress) trực tiếp trên cơ sở dữ liệu.'
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
