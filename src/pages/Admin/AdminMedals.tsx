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
  FlaskConical,
  Atom,
  Microscope,
  Rocket,
  Beaker,
  Lightbulb,
  Puzzle,
  Layers,
  Network,
  GitBranch,
  Binary,
  Calculator,
  Globe2,
  Languages,
  Presentation,
  Headphones,
  Quote,
  PenTool,
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
  type LucideIcon,
} from 'lucide-react';
import {
  medalService,
  type Medal,
  type MedalTier,
  type RoleTarget,
  type MedalCreateInput,
  type MedalFamilyGroup,
  MEDAL_CRITERIA_UNITS,
  criteriaUnitLabel,
  type MedalCriteriaUnit,
  groupMedalsByFamily,
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

export const LUCIDE_ICONS_MAP: Record<string, LucideIcon> = {
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
  FlaskConical: FlaskConical,
  Atom: Atom,
  Microscope: Microscope,
  Rocket: Rocket,
  Beaker: Beaker,
  Lightbulb: Lightbulb,
  Puzzle: Puzzle,
  Layers: Layers,
  Network: Network,
  GitBranch: GitBranch,
  Binary: Binary,
  Calculator: Calculator,
  Globe2: Globe2,
  Languages: Languages,
  Presentation: Presentation,
  Headphones: Headphones,
  Quote: Quote,
  PenTool: PenTool,
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
  { name: 'FlaskConical', labelVi: 'Ống nghiệm / Thí nghiệm', labelEn: 'Lab / Experiment' },
  { name: 'Atom', labelVi: 'Nguyên tử / Vật lý', labelEn: 'Atom / Physics' },
  { name: 'Microscope', labelVi: 'Kính hiển vi', labelEn: 'Microscope' },
  { name: 'Rocket', labelVi: 'Tên lửa / Khởi nghiệp', labelEn: 'Rocket / Launch' },
  { name: 'Beaker', labelVi: 'Cốc thí nghiệm', labelEn: 'Beaker' },
  { name: 'Lightbulb', labelVi: 'Bóng đèn / Ý tưởng', labelEn: 'Lightbulb / Idea' },
  { name: 'Puzzle', labelVi: 'Ghép hình / Mô-đun', labelEn: 'Puzzle / Module' },
  { name: 'Layers', labelVi: 'Lớp / Tầng', labelEn: 'Layers' },
  { name: 'Network', labelVi: 'Mạng lưới', labelEn: 'Network' },
  { name: 'GitBranch', labelVi: 'Nhánh / Phiên bản', labelEn: 'Branch / Version' },
  { name: 'Binary', labelVi: 'Nhị phận / Số học', labelEn: 'Binary / Numeric' },
  { name: 'Calculator', labelVi: 'Máy tính / Tính toán', labelEn: 'Calculator' },
  { name: 'Globe2', labelVi: 'Địa cầu / Quốc tế', labelEn: 'Globe / Global' },
  { name: 'Languages', labelVi: 'Ngôn ngữ / Dịch thuật', labelEn: 'Languages' },
  { name: 'Presentation', labelVi: 'Thuyết trình', labelEn: 'Presentation' },
  { name: 'Headphones', labelVi: 'Tai nghe / Nghiên cứu', labelEn: 'Headphones' },
  { name: 'Quote', labelVi: 'Trích dẫn học thuật', labelEn: 'Academic Quote' },
  { name: 'PenTool', labelVi: 'Bút / Sáng tạo', labelEn: 'Pen / Creative' },
];

/**
 * Resolves the appropriate Lucide icon name from medal code / metric / imageUrl
 *
 * NOTE: this is only used when a medal has no explicit `imageUrl` stored
 * yet. Once `imageUrl` is set (either via the data model or the Admin
 * picker), the stored value always wins.
 *
 * Order matters — more specific keywords come BEFORE more general ones so
 * the resolver doesn't pick the wrong icon. The previous version put the
 * `HOST`/seminar keyword above `PARTICIPANT`, so `SEMINAR_PARTICIPANT`
 * medals were given the `Mic` icon instead of `Headphones`. Fixed below.
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

  // 1. Most specific — ORCID identity verification
  if (code.includes('ORCID') || metric.includes('orcid')) return 'ShieldCheck';

  // 2. Hosting a seminar (Lecturer/Researcher)
  if (code.includes('HOST') || metric.includes('host')) return 'Mic';

  // 3. Participating in seminars (Graduate Student — listening)
  if (code.includes('PARTICIPANT') || metric.includes('attended')) return 'Headphones';

  // 4. Reviewing papers (Reviewer)
  if (code.includes('REVIEW') || metric.includes('review')) return 'ClipboardCheck';

  // 5. Mentoring student groups (Lecturer)
  if (code.includes('MENTOR') || metric.includes('guided') || metric.includes('group')) return 'GraduationCap';

  // 6. Publishing papers (Researcher) — checked AFTER host/mentor so the
  //    more specific role-based icons win.
  if (code.includes('PROLIFIC') || metric.includes('paper') || metric.includes('published')) return 'BookOpen';

  // 7. Flawless submissions (Graduate Student)
  if (code.includes('FLAWLESS') || metric.includes('flawless')) return 'Sparkles';

  return 'Medal';
};

/**
 * Renders a medal badge artwork using lucide-react vector icons or safe image fallback.
 * Tier colors are resolved from CSS variables defined in src/styles/ars-tokens.css.
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

  const tierKey = tier.toLowerCase();
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
          border: `2px solid var(--tier-${tierKey}-border)`,
          boxShadow: `var(--tier-${tierKey}-glow)`,
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
        background: `var(--tier-${tierKey}-bg)`,
        border: `2px solid var(--tier-${tierKey}-border)`,
        boxShadow: `var(--tier-${tierKey}-glow)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        userSelect: 'none',
      }}
      title={alt || iconName}
    >
      <IconComponent
        size={size * 0.52}
        color={`var(--tier-${tierKey}-icon)`}
      />
    </div>
  );
};

export const AdminMedals: React.FC = () => {
  const { t, locale } = useI18n();
  // Tiny shim so legacy call sites still resolve bilingual text without throwing.
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

  // Inline validation for the title fields
  const [titleError, setTitleError] = useState<string>('');

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
  const [formCriteriaUnit, setFormCriteriaUnit] =
    useState<MedalCriteriaUnit>('times');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  // Toast / Banner alert
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (
    message: string,
    type: 'success' | 'error' = 'success'
  ) => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Load Medals from backend
  const loadMedals = async () => {
    setIsLoading(true);
    try {
      const data = await medalService.getAll();
      setMedals(data);
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        t('admin.medals.error.loadFailed', 'Không thể tải danh sách huy hiệu');
      showNotification(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMedals();
  }, []);

  // Filtered medals (used by the table view and stats)
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

  /**
   * Family-grouped view used by the card grid. Each family is rendered as
   * ONE card, with the icon shown ONCE (shared across all tier variants).
   * Tier variants are listed inside the card with their criteria
   * thresholds so the Admin can still see/edit each tier individually.
   */
  const familyGroups = useMemo<MedalFamilyGroup[]>(() => {
    // Group the already-filtered medals so search/role/tier/status filters
    // apply to the family view too. A family is kept if AT LEAST ONE of its
    // tiers passes the filters.
    return groupMedalsByFamily(filteredMedals);
  }, [filteredMedals]);

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

  // Handle Quick Image / Icon Modal Open — operates on a METRIC FAMILY,
  // not a single medal. The icon belongs to the achievement (family), so
  // changing it once updates every tier variant in one shot.
  const handleOpenQuickImage = (medal: Medal) => {
    setTargetMedal(medal);
    setQuickImageUrl(medal.imageUrl || 'lucide:' + resolveMedalIconName(medal));
    setQuickImageTab(medal.imageUrl && medal.imageUrl.startsWith('http') ? 'url' : 'lucide');
    resetUpload();
    setActiveModal('quickImage');
  };

  // Handle Quick Image / Icon Save — applies the new icon to EVERY medal
  // in the metric family so all 4 tiers stay visually consistent (only the
  // colour frame differs across tiers).
  const handleSaveQuickImage = async () => {
    if (!targetMedal) return;
    const newImageUrl = quickImageUrl.trim() || 'lucide:Medal';
    try {
      const familyTiers = medals.filter(
        (m) =>
          deriveFamilyKeyLocal(m.code) ===
          deriveFamilyKeyLocal(targetMedal.code),
      );
      // Single-tier edge case: fall back to a single update.
      if (familyTiers.length <= 1) {
        await medalService.update(targetMedal.id, { imageUrl: newImageUrl });
      } else {
        await medalService.updateMedalFamilyIcon(
          deriveFamilyKeyLocal(targetMedal.code),
          newImageUrl,
        );
      }
      const medalName =
        locale === 'en' ? targetMedal.title : targetMedal.titleVi;
      showNotification(
        t(
          'admin.medals.success.imageUpdated',
          `Đã cập nhật biểu tượng cho "${medalName}" — áp dụng cho mọi cấp bậc (tier) của huy hiệu này!`
        )
      );
      setActiveModal(null);
      setTargetMedal(null);
      loadMedals();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        t('admin.medals.error.saveFailed', 'Lỗi khi lưu thông tin huy hiệu');
      showNotification(msg, 'error');
    }
  };

  // Local helper — strips tier suffix to derive the metric family key.
  // Mirrors the same logic in medal.service.ts. Kept local to avoid an
  // extra import ceremony in this already-large file.
  const deriveFamilyKeyLocal = (code: string): string => {
    if (!code) return '';
    return code
      .replace(/_(BRONZE|SILVER|GOLD|PLATINUM)$/i, '')
      .replace(/_(I|II|III|IV|V|VI|VII|VIII|IX|X)$/i, '')
      .toUpperCase();
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
        showNotification(
          t(
            'admin.medals.success.uploaded',
            'Tải ảnh lên Firebase thành công!'
          )
        );
      }
    } catch {
      showNotification(
        t('admin.medals.error.uploadFailed', 'Không thể tải ảnh lên Firebase'),
        'error'
      );
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
    setFormCriteriaUnit('times');
    setFormIsActive(true);
    setTitleError('');
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
    setTitleError('');
    resetUpload();
    setActiveModal('edit');
  };

  // Handle Save (Create / Edit)
  const handleSaveMedalForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitleVi.trim() && !formTitle.trim()) {
      setTitleError(
        t('admin.medals.error.titleRequired', 'Vui lòng nhập tên huy hiệu')
      );
      showNotification(
        t('admin.medals.error.titleRequired', 'Vui lòng nhập tên huy hiệu'),
        'error'
      );
      return;
    }
    setTitleError('');

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
      criteriaUnit: formCriteriaUnit,
      isActive: formIsActive,
    };

    try {
      if (activeModal === 'create') {
        await medalService.create(payload);
        showNotification(
          t('admin.medals.success.created', 'Tạo huy hiệu mới thành công!')
        );
      } else if (activeModal === 'edit' && targetMedal) {
        await medalService.update(targetMedal.id, payload);
        const name = locale === 'en' ? payload.title : payload.titleVi;
        showNotification(
          t(
            'admin.medals.success.updated',
            `Đã cập nhật huy hiệu "${name}" thành công!`
          )
        );
      }
      setActiveModal(null);
      setTargetMedal(null);
      loadMedals();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        t('admin.medals.error.saveFailed', 'Lỗi khi lưu thông tin huy hiệu');
      showNotification(msg, 'error');
    }
  };

  // Toggle active status directly
  const handleToggleStatus = async (medal: Medal) => {
    try {
      await medalService.update(medal.id, { isActive: !medal.isActive });
      const name = locale === 'en' ? medal.title : medal.titleVi;
      const action = !medal.isActive
        ? t('admin.medals.action.turnOn', 'Bật').toLowerCase()
        : t('admin.medals.action.turnOff', 'Tắt').toLowerCase();
      showNotification(
        t(
          'admin.medals.success.statusChanged',
          `Đã ${action} huy hiệu "${name}".`
        )
      );
      loadMedals();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        t('admin.medals.error.statusChange', 'Lỗi khi thay đổi trạng thái');
      showNotification(msg, 'error');
    }
  };

  // Handle Delete Medal
  const handleDeleteConfirm = async () => {
    if (!targetMedal) return;
    try {
      await medalService.delete(targetMedal.id);
      const name = locale === 'en' ? targetMedal.title : targetMedal.titleVi;
      showNotification(
        t('admin.medals.success.deleted', `Đã xóa huy hiệu "${name}"!`)
      );
      setActiveModal(null);
      setTargetMedal(null);
      loadMedals();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        t('admin.medals.error.deleteFailed', 'Lỗi khi xóa huy hiệu');
      showNotification(msg, 'error');
    }
  };

  // Handle Reset to Default Medals
  const handleResetDefaults = async () => {
    try {
      await medalService.resetToDefaults();
      showNotification(
        t(
          'admin.medals.success.reset',
          'Đã khôi phục toàn bộ 26 huy hiệu mặc định!'
        )
      );
      setActiveModal(null);
      loadMedals();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        t('admin.medals.error.resetFailed', 'Lỗi khi khôi phục dữ liệu gốc');
      showNotification(msg, 'error');
    }
  };

  // Render role badges
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

  // Tier icon mapping for the pill badge
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

  // Render Tier badge
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
    criteriaUnitLabel(unit, locale);

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
              notification.type === 'success'
                ? 'var(--status-success-text, #065f46)'
                : 'var(--status-danger-text, #991b1b)',
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
        eyebrow={t('admin.medals.eyebrow', 'QUẢN TRỊ · VINH DANH')}
        title={t(
          'admin.medals.title',
          'Huy hiệu & Danh hiệu Học thuật'
        )}
        description={t(
          'admin.medals.description',
          'Hệ thống vinh danh học thuật dành cho Nhà nghiên cứu, Giảng viên, Người phản biện & Học viên. Tùy biến biểu tượng từ thư viện Lucide hoặc tải lên ảnh riêng.'
        )}
        actions={
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.btnAction}
              onClick={() => setActiveModal('reset')}
              title={t(
                'admin.medals.reset',
                'Khôi phục mẫu chuẩn'
              )}
            >
              <RotateCcw size={15} />
              <span>{t('admin.medals.reset', 'Khôi phục mẫu chuẩn')}</span>
            </button>
            <Button
              variant="primary"
              leftIcon={<Plus size={16} />}
              onClick={handleOpenCreate}
            >
              {t('admin.medals.add', 'Thêm huy hiệu mới')}
            </Button>
          </div>
        }
      />

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
          {/* Search */}
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

          {/* Role Filter */}
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

          {/* Tier Filter */}
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

          {/* Status Filter */}
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

        {/* View Mode Toggle */}
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

      {/* Main Content: Loading / Empty / Data */}
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
        /* CARD GRID VIEW — Family-grouped.
           Each card represents ONE metric family (achievement). The icon
           is shown ONCE because it's shared by every tier variant. Tier
           variants are listed underneath with their threshold and a
           per-tier edit pencil. Changing the icon here updates all tiers
           in the family at once. */
        <div className={styles.cardsGrid}>
          {familyGroups.map((family) => {
            const primary = family.primary;
            const familyDisplayTitle =
              locale === 'en'
                ? primary.title || primary.titleVi
                : primary.titleVi || primary.title;
            const familyDisplayDescription =
              locale === 'en'
                ? primary.description || primary.descriptionVi
                : primary.descriptionVi || primary.description;

            // Use the lowest-stage medal's code as the canonical family code.
            const familyCode = family.primary.code
              .replace(/_(BRONZE|SILVER|GOLD|PLATINUM)$/i, '')
              .replace(/_(I|II|III|IV|V|VI|VII|VIII|IX|X)$/i, '');

            return (
              <div key={family.family} className={styles.medalCard}>
                {/* Top tier-strip — gradient bar based on the highest tier */}
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
                    {/* Family icon — click to change. Updates ALL tiers. */}
                    <div
                      style={{ cursor: 'pointer', position: 'relative' }}
                      onClick={() => handleOpenQuickImage(primary)}
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
                        size={64}
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

                  {/* Family-level notice: icon shared across tiers */}
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

                  {/* Tier ladder — each tier in its own row with criteria + actions */}
                  <div className={styles.tierLadder}>
                    <div className={styles.tierLadderHeader}>
                      {copy('Tiers & criteria', 'Các cấp bậc & điều kiện')}
                    </div>
                    {family.tiers.map((tier) => (
                      <div
                        key={tier.id}
                        className={styles.tierLadderRow}
                      >
                        <div className={styles.tierLadderLeft}>
                          <SafeMedalBadge
                            imageUrl={family.imageUrl}
                            code={tier.code}
                            criteriaMetric={tier.criteriaMetric}
                            tier={tier.tier}
                            size={32}
                            alt={tier.titleVi}
                          />
                          <div className={styles.tierLadderInfo}>
                            <span className={styles.tierLadderName}>
                              {locale === 'en'
                                ? tier.title
                                : tier.titleVi}
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
                            onClick={() => handleToggleStatus(tier)}
                            title={
                              tier.isActive
                                ? t(
                                    'admin.medals.action.turnOff',
                                    'Tắt'
                                  )
                                : t(
                                    'admin.medals.action.turnOn',
                                    'Bật'
                                  )
                            }
                          >
                            {tier.isActive
                              ? t(
                                  'admin.medals.action.turnOff',
                                  'Tắt'
                                )
                              : t(
                                  'admin.medals.action.turnOn',
                                  'Bật'
                                )}
                          </button>
                          <button
                            type="button"
                            className={styles.btnAction}
                            onClick={() => handleOpenEdit(tier)}
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
                            onClick={() => {
                              setTargetMedal(tier);
                              setActiveModal('delete');
                            }}
                            title={copy(
                              'Delete this tier',
                              'Xóa cấp này'
                            )}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Footer Actions — operate on the WHOLE family */}
                <div className={styles.cardFooter}>
                  <button
                    type="button"
                    className={`${styles.btnAction} ${styles.btnChangeImgDirect}`}
                    onClick={() => handleOpenQuickImage(primary)}
                    title={t(
                      'admin.medals.action.changeIcon',
                      'Đổi biểu tượng (cả 4 cấp)'
                    )}
                  >
                    <ImageIcon size={14} />
                    <span>
                      {t(
                        'admin.medals.action.changeIconFamily',
                        'Đổi biểu tượng'
                      )}
                    </span>
                  </button>

                  <div className={styles.cardActionsRight}>
                    <button
                      type="button"
                      className={styles.btnAction}
                      onClick={() => {
                        // Toggle ALL tiers in the family
                        const targetActive = !family.allActive;
                        Promise.all(
                          family.tiers.map((tier) =>
                            tier.isActive === targetActive
                              ? Promise.resolve()
                              : medalService.update(tier.id, {
                                  isActive: targetActive,
                                }),
                          ),
                        )
                          .then(() => {
                            showNotification(
                              t(
                                'admin.medals.success.statusChanged',
                                `Đã ${targetActive ? 'bật' : 'tắt'} toàn bộ cấp của "${familyDisplayTitle}".`
                              )
                            );
                            loadMedals();
                          })
                          .catch(() => {
                            showNotification(
                              t(
                                'admin.medals.error.statusChange',
                                'Lỗi khi thay đổi trạng thái'
                              ),
                              'error'
                            );
                          });
                      }}
                      title={
                        family.allActive
                          ? copy(
                              'Disable all tiers',
                              'Tắt tất cả cấp'
                            )
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
                      onClick={() => handleOpenEdit(primary)}
                      title={t(
                        'admin.medals.action.editFamily',
                        'Sửa huy hiệu'
                      )}
                    >
                      <Edit2 size={14} />
                      <span>
                        {t('admin.medals.action.edit', 'Sửa')}
                      </span>
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
                    locale === 'en'
                      ? medal.title || medal.titleVi
                      : medal.titleVi || medal.title;
                  const secondaryTitle =
                    locale === 'en' ? medal.titleVi : medal.title;

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
                            title={t(
                              'admin.medals.action.changeIcon',
                              'Đổi biểu tượng'
                            )}
                          >
                            {t(
                              'admin.medals.action.changeIcon',
                              'Đổi biểu tượng'
                            )}
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
                            onClick={() => handleToggleStatus(medal)}
                          >
                            {medal.isActive
                              ? t('admin.medals.action.turnOff', 'Tắt')
                              : t('admin.medals.action.turnOn', 'Bật')}
                          </button>
                          <button
                            type="button"
                            className={styles.btnAction}
                            onClick={() => handleOpenEdit(medal)}
                          >
                            <Edit2 size={14} />
                            <span>
                              {t('admin.medals.action.edit', 'Sửa')}
                            </span>
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
                    `Family Icon: ${
                      locale === 'en'
                        ? targetMedal.title
                        : targetMedal.titleVi
                    }`,
                    `Biểu tượng huy hiệu: ${
                      locale === 'en'
                        ? targetMedal.title
                        : targetMedal.titleVi
                    }`
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

            <div
              style={{
                padding: '12px 24px',
                background: '#eff6ff',
                borderBottom: '1px solid #dbeafe',
                fontSize: '0.8125rem',
                color: '#1e40af',
                fontWeight: 500,
              }}
            >
              <HelpCircle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              {copy(
                'This icon is shared by every tier (Bronze, Silver, Gold, Platinum) of this achievement. Only the frame colour changes per tier.',
                'Biểu tượng này dùng chung cho mọi cấp (Đồng, Bạc, Vàng, Bạch Kim). Chỉ màu khung đổi theo cấp.'
              )}
            </div>

            <div className={styles.modalBody}>
              {/* Preview — shows ALL 4 tiers side-by-side so the Admin can
                  verify the icon stays the same and only the frame colour
                  changes across Bronze / Silver / Gold / Platinum. */}
              <div className={styles.imagePreviewHero}>
                <div className={styles.tierPreviewRow}>
                  {(['Bronze', 'Silver', 'Gold', 'Platinum'] as MedalTier[]).map(
                    (tier) => (
                      <div key={tier} className={styles.tierPreviewCell}>
                        <SafeMedalBadge
                          imageUrl={quickImageUrl}
                          code={targetMedal.code}
                          criteriaMetric={targetMedal.criteriaMetric}
                          tier={tier}
                          size={64}
                          alt={`${tier} preview`}
                        />
                        <span className={styles.tierPreviewLabel}>
                          {t(
                            `admin.medals.tier.${tier.toLowerCase()}`,
                            tier
                          )}
                        </span>
                      </div>
                    ),
                  )}
                </div>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--ink-muted, #64748b)',
                    fontWeight: 500,
                    textAlign: 'center',
                  }}
                >
                  {t(
                    'admin.medals.quick.previewFamily',
                    'Xem trước — cùng một biểu tượng cho cả 4 cấp bậc (chỉ khác màu khung).'
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
                  <span>
                    {t(
                      'admin.medals.quick.tab.lucide',
                      'Biểu tượng Lucide'
                    )}
                  </span>
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
                  <span>
                    {t('admin.medals.quick.tab.upload', 'Tải file ảnh')}
                  </span>
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
                  <span>
                    {t('admin.medals.quick.tab.url', 'Link ảnh')}
                  </span>
                </button>
              </div>

              {/* Tab 1: Lucide Icons Grid */}
              {quickImageTab === 'lucide' && (
                <div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--ink-muted, #64748b)',
                      display: 'block',
                      marginBottom: '8px',
                    }}
                  >
                    {copy(
                      'Select an icon from the lucide-react library:',
                      'Chọn biểu tượng chuẩn từ thư viện lucide-react:'
                    )}
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
                          <IconComp
                            size={24}
                            color={isSelected ? '#1d4ed8' : '#475569'}
                          />
                          <span>
                            {locale === 'en' ? item.labelEn : item.labelVi}
                          </span>
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
                        ? copy(
                            'Uploading to Firebase Storage...',
                            'Đang tải lên Firebase...'
                          )
                        : copy(
                            'Click here to select a custom image file',
                            'Bấm vào đây để chọn file ảnh riêng'
                          )}
                    </p>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {t(
                        'admin.medals.quick.uploadHint',
                        'Hỗ trợ: PNG, JPG, WEBP, SVG (tối đa 10MB)'
                      )}
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
                  <label
                    htmlFor="quickImageUrlInput"
                    className={styles.formLabel}
                  >
                    {copy(
                      'Online Image URL:',
                      'Đường dẫn ảnh trực tuyến (Image URL):'
                    )}
                  </label>
                  <input
                    type="url"
                    id="quickImageUrlInput"
                    name="quickImageUrlInput"
                    placeholder={t(
                      'admin.medals.quick.urlPlaceholder',
                      'https://example.com/badge.png'
                    )}
                    value={
                      quickImageUrl.startsWith('lucide:') ? '' : quickImageUrl
                    }
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
                {t('admin.medals.modal.cancel', 'Hủy bỏ')}
              </button>
              <Button
                variant="primary"
                onClick={handleSaveQuickImage}
                disabled={!quickImageUrl.trim() || isUploading}
              >
                {t('admin.medals.modal.save', 'Lưu thay đổi')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE OR EDIT FULL MODAL — 3 sections: Identity / Naming / Rules */}
      {(activeModal === 'create' || activeModal === 'edit') && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {activeModal === 'create'
                  ? t(
                      'admin.medals.modal.createTitle',
                      'Thêm huy hiệu vinh danh mới'
                    )
                  : t('admin.medals.modal.editTitle', 'Chỉnh sửa huy hiệu')}
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
                {/* ── Section 1: Identity ─────────────────────── */}
                <div className={styles.formGroup}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-muted, #64748b)',
                    }}
                  >
                    {t('admin.medals.modal.identity', 'Nhận diện')}
                  </span>
                </div>
                <div className={styles.imageSectionCard}>
                  <SafeMedalBadge
                    imageUrl={formImageUrl}
                    tier={formTier}
                    size={80}
                    alt="Preview"
                  />
                  <div className={styles.imageUploadControls}>
                    <label
                      htmlFor="formImageUrlInput"
                      className={styles.formLabel}
                    >
                      {t(
                        'admin.medals.modal.artworkUrl',
                        'Biểu tượng / Hình ảnh (Mã Lucide hoặc URL)'
                      )}
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
                        title={copy(
                          'Upload image to Firebase',
                          'Tải ảnh lên Firebase'
                        )}
                      >
                        <UploadCloud size={16} />
                        <span>
                          {isUploading
                            ? copy('Uploading...', 'Đang tải...')
                            : copy('Upload', 'Upload')}
                        </span>
                      </button>
                    </div>

                    {/* Always-visible Lucide icon picker (36 entries) */}
                    <div className={styles.iconPickerGrid}>
                      {LUCIDE_ICONS_LIST.map((item) => {
                        const IconComp =
                          LUCIDE_ICONS_MAP[item.name] || MedalIcon;
                        const isChosen =
                          formImageUrl === `lucide:${item.name}`;
                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() =>
                              setFormImageUrl(`lucide:${item.name}`)
                            }
                            className={`${styles.iconPickerItem} ${
                              isChosen ? styles.iconPickerItemActive : ''
                            }`}
                            title={item.name}
                          >
                            <IconComp
                              size={20}
                              color={isChosen ? '#1d4ed8' : '#475569'}
                            />
                            <span>
                              {locale === 'en'
                                ? item.labelEn
                                : item.labelVi}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── Section 2: Naming ───────────────────────── */}
                <div className={styles.formGroup}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-muted, #64748b)',
                    }}
                  >
                    {t('admin.medals.modal.naming', 'Đặt tên')}
                  </span>
                </div>
                <div className={styles.formGridTwo}>
                  <div className={styles.formGroup}>
                    <label
                      htmlFor="formTitleViInput"
                      className={styles.formLabel}
                    >
                      {t(
                        'admin.medals.modal.titleVi',
                        'Tên huy hiệu (Tiếng Việt) *'
                      )}
                    </label>
                    <input
                      type="text"
                      id="formTitleViInput"
                      name="formTitleViInput"
                      required
                      placeholder="vd: Học giả xác thực ORCID (Cấp 1 - Đồng)"
                      value={formTitleVi}
                      onChange={(e) => {
                        setFormTitleVi(e.target.value);
                        if (titleError) setTitleError('');
                      }}
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label
                      htmlFor="formTitleEnInput"
                      className={styles.formLabel}
                    >
                      {t(
                        'admin.medals.modal.titleEn',
                        'Tên huy hiệu (English)'
                      )}
                    </label>
                    <input
                      type="text"
                      id="formTitleEnInput"
                      name="formTitleEnInput"
                      required
                      placeholder="e.g.: ORCID Verified Scholar (Bronze)"
                      value={formTitle}
                      onChange={(e) => {
                        setFormTitle(e.target.value);
                        if (titleError) setTitleError('');
                      }}
                      className={styles.formInput}
                    />
                  </div>
                </div>
                {titleError && (
                  <div
                    style={{
                      color: 'var(--status-danger-text, #b91c1c)',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      marginTop: '-4px',
                    }}
                    role="alert"
                  >
                    {titleError}
                  </div>
                )}

                <div className={styles.formGridTwo}>
                  <div className={styles.formGroup}>
                    <label
                      htmlFor="formDescViInput"
                      className={styles.formLabel}
                    >
                      {t(
                        'admin.medals.modal.descVi',
                        'Mô tả điều kiện (Tiếng Việt)'
                      )}
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
                    <label
                      htmlFor="formDescEnInput"
                      className={styles.formLabel}
                    >
                      {t(
                        'admin.medals.modal.descEn',
                        'Mô tả điều kiện (English)'
                      )}
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

                {/* ── Section 3: Rules ───────────────────────── */}
                <div className={styles.formGroup}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-muted, #64748b)',
                    }}
                  >
                    {t('admin.medals.modal.rules', 'Quy tắc')}
                  </span>
                </div>
                <div className={styles.formGridTwo}>
                  <div className={styles.formGroup}>
                    <label
                      htmlFor="formTierSelect"
                      className={styles.formLabel}
                    >
                      {t('admin.medals.modal.tier', 'Cấp bậc xếp hạng (Tier) *')}
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
                      {TIER_OPTIONS.map((tier) => {
                        const tierLabel = t(TIER_LABEL_KEY[tier], tier);
                        return (
                          <option key={tier} value={tier}>
                            {`${tier} — ${tierLabel}`}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label
                      htmlFor="formStageLevelInput"
                      className={styles.formLabel}
                    >
                      {t(
                        'admin.medals.modal.stageLevel',
                        'Cấp độ tiến trình (Stage Level)'
                      )}
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

                {/* Metric / Threshold / Unit row */}
                <div className={styles.formGridTwo}>
                  <div className={styles.formGroup}>
                    <label
                      htmlFor="formCriteriaMetricInput"
                      className={styles.formLabel}
                    >
                      {t(
                        'admin.medals.modal.metric',
                        'Mã chỉ số tự động (Metric Code) *'
                      )}
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
                      <label
                        htmlFor="formCriteriaThresholdInput"
                        className={styles.formLabel}
                      >
                        {t('admin.medals.modal.threshold', 'Ngưỡng đạt >=')}
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
                      <label
                        htmlFor="formCriteriaUnitSelect"
                        className={styles.formLabel}
                      >
                        {t('admin.medals.modal.unit', 'Đơn vị tính')}
                      </label>
                      <select
                        id="formCriteriaUnitSelect"
                        name="formCriteriaUnitSelect"
                        value={formCriteriaUnit}
                        onChange={(e) =>
                          setFormCriteriaUnit(
                            e.target.value as MedalCriteriaUnit
                          )
                        }
                        className={styles.formSelect}
                      >
                        {MEDAL_CRITERIA_UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {criteriaUnitLabel(unit, locale)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Roles Targeted */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {t('admin.medals.modal.roles', 'Vai trò áp dụng huy hiệu')}
                  </label>
                  <div className={styles.checkboxRoleGroup}>
                    {ALL_ROLES.map((role) => {
                      const isChecked = formRoles.includes(role);
                      let label: string = role;
                      if (role === 'Researcher')
                        label = t(
                          'admin.medals.role.researcher',
                          'Nhà nghiên cứu'
                        );
                      else if (role === 'Lecturer')
                        label = t(
                          'admin.medals.role.lecturer',
                          'Giảng viên'
                        );
                      else if (role === 'Reviewer')
                        label = t(
                          'admin.medals.role.reviewer',
                          'Người phản biện'
                        );
                      else if (role === 'Graduate Student')
                        label = t(
                          'admin.medals.role.student',
                          'Học viên'
                        );
                      const inputId = `roleCheck_${role.replace(/\s+/g, '_')}`;
                      return (
                        <label
                          key={role}
                          htmlFor={inputId}
                          className={styles.checkboxRoleItem}
                        >
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

                {/* Active switch */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginTop: '4px',
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
                    {t(
                      'admin.medals.modal.active',
                      'Kích hoạt huy hiệu này ngay cho người dùng'
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
                  {t('admin.medals.modal.cancel', 'Hủy bỏ')}
                </button>
                <Button variant="primary" type="submit">
                  {t('admin.medals.modal.save', 'Lưu thay đổi')}
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
              <h3
                className={styles.modalTitle}
                style={{ color: 'var(--status-danger-text, #dc2626)' }}
              >
                {t(
                  'admin.medals.modal.deleteTitle',
                  'Xác nhận xóa huy hiệu'
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
            <div className={styles.modalBody}>
              <p style={{ fontSize: '0.9375rem', color: '#334155' }}>
                {t(
                  'admin.medals.modal.deleteBody',
                  'Bạn có chắc chắn muốn xóa huy hiệu này? Hành động không thể hoàn tác.'
                )}
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--ink-muted, #64748b)',
                }}
              >
                {locale === 'en' ? targetMedal.title : targetMedal.titleVi}
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnAction}
                onClick={() => setActiveModal(null)}
              >
                {t('admin.medals.modal.cancel', 'Hủy bỏ')}
              </button>
              <Button variant="danger" onClick={handleDeleteConfirm}>
                {t('admin.medals.modal.deleteConfirm', 'Xác nhận xóa')}
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
              <h3 className={styles.modalTitle}>
                {t(
                  'admin.medals.modal.resetTitle',
                  'Khôi phục huy hiệu mặc định'
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
            <div className={styles.modalBody}>
              <p style={{ fontSize: '0.9375rem', color: '#334155' }}>
                {t(
                  'admin.medals.modal.resetBody',
                  'Khôi phục toàn bộ 26 huy hiệu học thuật tiêu chuẩn cho 4 vai trò trên cơ sở dữ liệu.'
                )}
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--ink-muted, #64748b)',
                }}
              >
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
                {t('admin.medals.modal.cancel', 'Hủy bỏ')}
              </button>
              <Button variant="primary" onClick={handleResetDefaults}>
                {t(
                  'admin.medals.modal.resetConfirm',
                  'Khôi phục danh mục'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMedals;