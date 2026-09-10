import { useState, useEffect, useRef, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  UploadCloud,
  Lock,
  Unlock,
  Sparkles,
  Award,
  Trophy,
  GraduationCap,
  BookOpen,
  Mic,
  Headphones,
  ClipboardCheck,
  ShieldCheck,
  Users,
  Flame,
  Star,
  FileText,
  Check,
} from 'lucide-react';
import {
  type Medal,
  type MedalTier,
  type RoleTarget,
  type MedalCreateInput,
  MEDAL_CRITERIA_UNITS,
  criteriaUnitLabel,
  type MedalCriteriaUnit,
  PREDEFINED_METRICS,
  getAutoUnitForMetric,
} from '../../../services/medal.service';
import { useFirebaseFileUpload } from '../../../hooks/useFirebaseFileUpload';
import { useI18n } from '../../../i18n/I18nContext';
import { Button } from '../../../components/Button/Button';
import {
  SafeMedalBadge,
  resolveMedalIconName,
} from './SafeMedalBadge';
import { LucideIconPicker } from './LucideIconPicker';
import styles from './TierEditor.module.css';

const TIER_OPTIONS: MedalTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];
const ALL_ROLES: RoleTarget[] = [
  'Researcher',
  'Lecturer',
  'Reviewer',
  'Graduate Student',
];

const TIER_LABEL_KEY: Record<MedalTier, string> = {
  Bronze: 'admin.medals.tier.bronze',
  Silver: 'admin.medals.tier.silver',
  Gold: 'admin.medals.tier.gold',
  Platinum: 'admin.medals.tier.platinum',
};

const ACADEMIC_ICON_PRESETS = [
  { name: 'BookOpen', label: 'Bài báo', icon: BookOpen },
  { name: 'GraduationCap', label: 'Giảng dạy', icon: GraduationCap },
  { name: 'Award', label: 'Vinh danh', icon: Award },
  { name: 'Trophy', label: 'Thành tựu', icon: Trophy },
  { name: 'Mic', label: 'Diễn thuyết', icon: Mic },
  { name: 'Headphones', label: 'Tham dự', icon: Headphones },
  { name: 'ClipboardCheck', label: 'Thẩm định', icon: ClipboardCheck },
  { name: 'ShieldCheck', label: 'Xác thực', icon: ShieldCheck },
  { name: 'Sparkles', label: 'Xuất sắc', icon: Sparkles },
  { name: 'Users', label: 'Cộng đồng', icon: Users },
  { name: 'Flame', label: 'Tương tác', icon: Flame },
  { name: 'FileText', label: 'Đề tài', icon: FileText },
  { name: 'Star', label: 'Ngôi sao', icon: Star },
];

export interface MedalConditionPreset {
  tier: MedalTier;
  stageLevel: number;
  threshold: number;
  unit?: MedalCriteriaUnit;
  metric?: string;
  titleVi: string;
  titleEn: string;
  descriptionVi: string;
  descriptionEn: string;
}

export interface MedalCategoryCatalogItem {
  id: string;
  nameVi: string;
  nameEn: string;
  metric: string;
  unit: MedalCriteriaUnit;
  defaultIcon: string;
  roles: RoleTarget[];
  conditions: MedalConditionPreset[];
}

export const MEDAL_CRITERIA_CATALOG: MedalCategoryCatalogItem[] = [
  {
    id: 'PROLIFIC_AUTHOR',
    nameVi: 'Tác giả năng suất (Bài báo nghiên cứu)',
    nameEn: 'Prolific Author (Research Papers)',
    metric: 'published_papers',
    unit: 'papers',
    defaultIcon: 'lucide:BookOpen',
    roles: ['Researcher'],
    conditions: [
      {
        tier: 'Bronze',
        stageLevel: 1,
        threshold: 1,
        titleVi: 'Tác giả năng suất (Cấp 1 - Khởi đầu)',
        titleEn: 'Prolific Author (Bronze)',
        descriptionVi: 'Xuất bản thành công bài báo khoa học đầu tiên trên hệ thống.',
        descriptionEn: 'First research paper published on the ARS platform.',
      },
      {
        tier: 'Silver',
        stageLevel: 2,
        threshold: 5,
        titleVi: 'Tác giả năng suất (Cấp 2 - Bạc)',
        titleEn: 'Prolific Author (Silver)',
        descriptionVi: 'Có từ 5 bài báo trở lên được Admin phê duyệt và xuất bản.',
        descriptionEn: 'Has 5 or more research papers approved and published.',
      },
      {
        tier: 'Gold',
        stageLevel: 3,
        threshold: 10,
        titleVi: 'Tác giả năng suất (Cấp 3 - Vàng)',
        titleEn: 'Prolific Author (Gold)',
        descriptionVi: 'Có từ 10 bài báo trở lên được xuất bản trong kho nghiên cứu.',
        descriptionEn: 'Has 10 or more approved research papers in the catalog.',
      },
      {
        tier: 'Platinum',
        stageLevel: 4,
        threshold: 25,
        titleVi: 'Tác giả năng suất (Cấp 4 - Bạch kim)',
        titleEn: 'Prolific Author (Platinum)',
        descriptionVi: 'Đạt từ 25 bài báo khoa học chất lượng cao được xuất bản.',
        descriptionEn: 'Has 25 or more high-impact published research papers.',
      },
    ],
  },
  {
    id: 'ACADEMIC_HOST',
    nameVi: 'Chủ trì Hội thảo (Hội thảo học thuật)',
    nameEn: 'Academic Host (Academic Seminars)',
    metric: 'hosted_seminars',
    unit: 'seminars',
    defaultIcon: 'lucide:Mic',
    roles: ['Lecturer', 'Researcher'],
    conditions: [
      {
        tier: 'Bronze',
        stageLevel: 1,
        threshold: 1,
        titleVi: 'Chủ trì Hội thảo (Cấp 1 - Đồng)',
        titleEn: 'Academic Host (Bronze)',
        descriptionVi: 'Tổ chức thành công buổi Seminar học thuật đầu tiên trên hệ thống.',
        descriptionEn: 'Successfully hosted first academic seminar on the platform.',
      },
      {
        tier: 'Silver',
        stageLevel: 2,
        threshold: 3,
        titleVi: 'Chủ trì Hội thảo (Cấp 2 - Bạc)',
        titleEn: 'Academic Host (Silver)',
        descriptionVi: 'Tổ chức thành công từ 3 buổi Seminar học thuật chất lượng.',
        descriptionEn: 'Successfully hosted 3 or more academic seminars.',
      },
      {
        tier: 'Gold',
        stageLevel: 3,
        threshold: 5,
        titleVi: 'Chủ trì Hội thảo (Cấp 3 - Vàng)',
        titleEn: 'Academic Host (Gold)',
        descriptionVi: 'Tổ chức thành công từ 5 buổi Seminar học thuật trên hệ thống.',
        descriptionEn: 'Successfully hosted 5 or more academic seminars.',
      },
      {
        tier: 'Platinum',
        stageLevel: 4,
        threshold: 10,
        titleVi: 'Chủ trì Hội thảo (Cấp 4 - Bạch kim)',
        titleEn: 'Academic Host (Platinum)',
        descriptionVi: 'Tổ chức thành công từ 10 buổi Seminar học thuật quy mô lớn.',
        descriptionEn: 'Successfully hosted 10 or more major academic seminars.',
      },
    ],
  },
  {
    id: 'MASTER_MENTOR',
    nameVi: 'Người hướng dẫn tận tâm (Đồ án & Nhóm SV)',
    nameEn: 'Master Mentor (Student Research Groups)',
    metric: 'guided_groups_completed',
    unit: 'student_groups',
    defaultIcon: 'lucide:GraduationCap',
    roles: ['Lecturer'],
    conditions: [
      {
        tier: 'Bronze',
        stageLevel: 1,
        threshold: 1,
        titleVi: 'Người hướng dẫn tận tâm (Cấp 1 - Đồng)',
        titleEn: 'Master Mentor (Bronze)',
        descriptionVi: 'Hướng dẫn ít nhất 1 nhóm sinh viên hoàn thành 100% các Phase báo cáo.',
        descriptionEn: 'Mentored at least 1 student group completing all progress phases.',
      },
      {
        tier: 'Silver',
        stageLevel: 2,
        threshold: 3,
        titleVi: 'Người hướng dẫn tận tâm (Cấp 2 - Bạc)',
        titleEn: 'Master Mentor (Silver)',
        descriptionVi: 'Hướng dẫn ít nhất 3 nhóm sinh viên hoàn thành 100% các Phase báo cáo.',
        descriptionEn: 'Mentored at least 3 student groups completing all progress phases.',
      },
      {
        tier: 'Gold',
        stageLevel: 3,
        threshold: 5,
        titleVi: 'Người hướng dẫn tận tâm (Cấp 3 - Vàng)',
        titleEn: 'Master Mentor (Gold)',
        descriptionVi: 'Hướng dẫn ít nhất 5 nhóm sinh viên hoàn thành bảo vệ xuất sắc.',
        descriptionEn: 'Mentored at least 5 student groups successfully defending their work.',
      },
      {
        tier: 'Platinum',
        stageLevel: 4,
        threshold: 10,
        titleVi: 'Người hướng dẫn tận tâm (Cấp 4 - Bạch kim)',
        titleEn: 'Master Mentor (Platinum)',
        descriptionVi: 'Cố vấn xuất sắc cho từ 10 nhóm sinh viên hoàn thành đề tài.',
        descriptionEn: 'Distinguished mentor for 10 or more completed student research groups.',
      },
    ],
  },
  {
    id: 'REVIEW_MILESTONE',
    nameVi: 'Cột mốc Thẩm định (Bình duyệt bài báo)',
    nameEn: 'Review Milestone (Peer Reviews)',
    metric: 'completed_reviews',
    unit: 'reviews',
    defaultIcon: 'lucide:ClipboardCheck',
    roles: ['Reviewer'],
    conditions: [
      {
        tier: 'Bronze',
        stageLevel: 1,
        threshold: 5,
        titleVi: 'Cột mốc Thẩm định (Cấp 1 - Đồng)',
        titleEn: 'Review Milestone I (Bronze)',
        descriptionVi: 'Hoàn thành đánh giá & phản biện 5 bài báo khoa học.',
        descriptionEn: 'Completed peer-review for 5 academic manuscripts.',
      },
      {
        tier: 'Silver',
        stageLevel: 2,
        threshold: 10,
        titleVi: 'Cột mốc Thẩm định (Cấp 2 - Bạc)',
        titleEn: 'Review Milestone II (Silver)',
        descriptionVi: 'Hoàn thành đánh giá & phản biện 10 bài báo khoa học.',
        descriptionEn: 'Completed peer-review for 10 academic manuscripts.',
      },
      {
        tier: 'Gold',
        stageLevel: 3,
        threshold: 25,
        titleVi: 'Cột mốc Thẩm định (Cấp 3 - Vàng)',
        titleEn: 'Review Milestone III (Gold)',
        descriptionVi: 'Hoàn thành đánh giá & phản biện 25 bài báo khoa học.',
        descriptionEn: 'Completed peer-review for 25 academic manuscripts.',
      },
      {
        tier: 'Platinum',
        stageLevel: 4,
        threshold: 50,
        titleVi: 'Cột mốc Thẩm định (Cấp 4 - Bạch kim)',
        titleEn: 'Review Milestone IV (Platinum)',
        descriptionVi: 'Hoàn thành thẩm định chuyên sâu 50 bài báo khoa học.',
        descriptionEn: 'Senior reviewer with 50 or more completed academic evaluations.',
      },
    ],
  },
  {
    id: 'ORCID_VERIFIED',
    nameVi: 'Học giả Xác thực ORCID (Định danh Quốc tế)',
    nameEn: 'ORCID Verified Scholar (International ID)',
    metric: 'orcid_connected',
    unit: 'account',
    defaultIcon: 'lucide:ShieldCheck',
    roles: ['Researcher', 'Lecturer', 'Reviewer', 'Graduate Student'],
    conditions: [
      {
        tier: 'Bronze',
        stageLevel: 1,
        threshold: 1,
        titleVi: 'Học giả xác thực ORCID (Cấp 1 - Đồng)',
        titleEn: 'ORCID Verified Scholar (Bronze)',
        descriptionVi: 'Đã liên kết và xác minh định danh khoa học quốc tế ORCID iD thành công.',
        descriptionEn: 'Successfully connected and verified an international ORCID iD.',
      },
      {
        tier: 'Silver',
        stageLevel: 2,
        threshold: 1,
        unit: 'papers',
        metric: 'orcid_verified_papers',
        titleVi: 'Học giả xác thực ORCID (Cấp 2 - Bạc)',
        titleEn: 'ORCID Verified Scholar (Silver)',
        descriptionVi: 'Xác thực quyền tác giả qua ORCID cho ít nhất 1 bài báo nghiên cứu.',
        descriptionEn: 'Verified authorship through ORCID for at least 1 academic paper.',
      },
      {
        tier: 'Gold',
        stageLevel: 3,
        threshold: 3,
        unit: 'publications',
        metric: 'orcid_verified_papers',
        titleVi: 'Học giả xác thực ORCID (Cấp 3 - Vàng)',
        titleEn: 'ORCID Verified Scholar (Gold)',
        descriptionVi: 'Hồ sơ ORCID hoàn chỉnh, đồng bộ từ 3 công trình nghiên cứu chính thức trở lên.',
        descriptionEn: 'Full public ORCID profile with 3 or more verified scholarly publications.',
      },
    ],
  },
  {
    id: 'SEMINAR_PARTICIPANT',
    nameVi: 'Người tham dự tích cực (Hội thảo & Phản hồi)',
    nameEn: 'Seminar Participant (Seminars & Feedback)',
    metric: 'attended_seminars',
    unit: 'seminars',
    defaultIcon: 'lucide:Headphones',
    roles: ['Graduate Student', 'Researcher', 'Lecturer'],
    conditions: [
      {
        tier: 'Bronze',
        stageLevel: 1,
        threshold: 3,
        titleVi: 'Người tham dự tích cực (Cấp 1 - Đồng)',
        titleEn: 'Seminar Participant (Bronze)',
        descriptionVi: 'Tích cực tham gia các buổi seminar học thuật và gửi phản hồi đóng góp ý kiến (3 buổi).',
        descriptionEn: 'Actively attended 3 seminars and submitted constructive feedback.',
      },
      {
        tier: 'Silver',
        stageLevel: 2,
        threshold: 5,
        titleVi: 'Người tham dự tích cực (Cấp 2 - Bạc)',
        titleEn: 'Seminar Participant (Silver)',
        descriptionVi: 'Tích cực tham gia các buổi seminar học thuật và gửi phản hồi đóng góp ý kiến (5 buổi).',
        descriptionEn: 'Actively attended 5 seminars and submitted constructive feedback.',
      },
      {
        tier: 'Gold',
        stageLevel: 3,
        threshold: 10,
        titleVi: 'Người tham dự tích cực (Cấp 3 - Vàng)',
        titleEn: 'Seminar Participant (Gold)',
        descriptionVi: 'Tham dự và đóng góp ý kiến phản hồi sâu sắc tại 10 buổi seminar học thuật.',
        descriptionEn: 'Active participant with feedback submitted across 10 academic seminars.',
      },
    ],
  },
  {
    id: 'FLAWLESS_PROGRESS',
    nameVi: 'Tiến độ hoàn hảo (Giai đoạn Đồ án)',
    nameEn: 'Flawless Progress (Milestone Phases)',
    metric: 'flawless_phases',
    unit: 'phases',
    defaultIcon: 'lucide:Sparkles',
    roles: ['Graduate Student'],
    conditions: [
      {
        tier: 'Bronze',
        stageLevel: 1,
        threshold: 1,
        titleVi: 'Tiến độ hoàn hảo (Cấp 1 - Đồng)',
        titleEn: 'Flawless Progress (Bronze)',
        descriptionVi: 'Nhóm hoàn thành giai đoạn đầu tiên mà không bị trễ hạn hoặc bị từ chối.',
        descriptionEn: 'Group completed the first phase on time without rejection.',
      },
      {
        tier: 'Silver',
        stageLevel: 2,
        threshold: 3,
        titleVi: 'Tiến độ hoàn hảo (Cấp 2 - Bạc)',
        titleEn: 'Flawless Progress (Silver)',
        descriptionVi: 'Nhóm hoàn thành 3 giai đoạn liên tiếp đúng hạn và không bị từ chối.',
        descriptionEn: 'Group completed 3 consecutive phases on time without any rejection.',
      },
      {
        tier: 'Gold',
        stageLevel: 3,
        threshold: 5,
        titleVi: 'Tiến độ hoàn hảo (Cấp 3 - Vàng)',
        titleEn: 'Flawless Progress (Gold)',
        descriptionVi: 'Nhóm hoàn thành toàn bộ các giai đoạn mà không lần nào bị trễ hạn hoặc bị từ chối.',
        descriptionEn: 'Flawless group completing all milestone phases on time without any rejection.',
      },
    ],
  },
  {
    id: 'COMMUNITY_ENGAGEMENT',
    nameVi: 'Đóng góp cộng đồng (Tương tác & Chia sẻ)',
    nameEn: 'Community Engagement (Discussions & Reach)',
    metric: 'community_engagement',
    unit: 'times',
    defaultIcon: 'lucide:Users',
    roles: ['Researcher', 'Lecturer', 'Reviewer', 'Graduate Student'],
    conditions: [
      {
        tier: 'Bronze',
        stageLevel: 1,
        threshold: 10,
        titleVi: 'Đóng góp cộng đồng (Cấp 1 - Đồng)',
        titleEn: 'Community Engagement (Bronze)',
        descriptionVi: 'Đạt từ 10 lượt thảo luận & tương tác học thuật trên cộng đồng.',
        descriptionEn: 'Reached 10 constructive community interactions.',
      },
      {
        tier: 'Silver',
        stageLevel: 2,
        threshold: 30,
        titleVi: 'Đóng góp cộng đồng (Cấp 2 - Bạc)',
        titleEn: 'Community Engagement (Silver)',
        descriptionVi: 'Đạt từ 30 lượt thảo luận & đóng góp câu trả lời được đánh giá hữu ích.',
        descriptionEn: 'Reached 30 helpful community discussions and contributions.',
      },
      {
        tier: 'Gold',
        stageLevel: 3,
        threshold: 100,
        titleVi: 'Đóng góp cộng đồng (Cấp 3 - Vàng)',
        titleEn: 'Community Engagement (Gold)',
        descriptionVi: 'Đạt từ 100 lượt tương tác học thuật tích cực trên diễn đàn cộng đồng.',
        descriptionEn: 'Outstanding academic contributor with 100+ community interactions.',
      },
    ],
  },
  {
    id: 'CUSTOM',
    nameVi: '✨ Điều kiện tùy chỉnh khác (Custom Rule)',
    nameEn: '✨ Custom Criteria Rule',
    metric: '',
    unit: 'times',
    defaultIcon: 'lucide:Medal',
    roles: ['Researcher', 'Lecturer', 'Reviewer', 'Graduate Student'],
    conditions: [],
  },
];

export interface TierEditorProps {
  mode: 'create' | 'edit';
  medal: Medal | null;
  onSave: (payload: MedalCreateInput) => Promise<void>;
  onClose: () => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
  locale: string;
}

export const TierEditor: React.FC<TierEditorProps> = ({
  mode,
  medal,
  onSave,
  onClose,
  showNotification,
  locale,
}) => {
  const { t } = useI18n();
  const copy = (en: string, vi: string): string => (locale === 'vi' ? vi : en);

  const {
    uploadFile,
    isUploading,
  } = useFirebaseFileUpload('medals/');

  const [formTitle, setFormTitle] = useState('');
  const [formTitleVi, setFormTitleVi] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDescriptionVi, setFormDescriptionVi] = useState('');
  const [formRoles, setFormRoles] = useState<RoleTarget[]>([]);
  const [formTier, setFormTier] = useState<MedalTier>('Bronze');
  const [previewTier, setPreviewTier] = useState<MedalTier>('Bronze');
  const [formStageLevel, setFormStageLevel] = useState<number>(1);
  const [formImageUrl, setFormImageUrl] = useState('lucide:Medal');
  const [formCriteriaMetric, setFormCriteriaMetric] = useState('');
  const [formCriteriaThreshold, setFormCriteriaThreshold] = useState<number>(1);
  const [formCriteriaUnit, setFormCriteriaUnit] = useState<MedalCriteriaUnit>('times');
  const [isUnitLocked, setIsUnitLocked] = useState<boolean>(true);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('PROLIFIC_AUTHOR');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [titleError, setTitleError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  const currentFamily = MEDAL_CRITERIA_CATALOG.find((c) => c.id === selectedFamilyId) || MEDAL_CRITERIA_CATALOG[0];

  const handleApplyCondition = (
    cond: MedalConditionPreset,
    cat: MedalCategoryCatalogItem
  ) => {
    setFormTier(cond.tier);
    setPreviewTier(cond.tier);
    setFormStageLevel(cond.stageLevel);
    setFormCriteriaThreshold(cond.threshold);

    const targetMetric = cond.metric || cat.metric;
    setFormCriteriaMetric(targetMetric);

    const targetUnit = cond.unit || cat.unit || getAutoUnitForMetric(targetMetric);
    setFormCriteriaUnit(targetUnit);
    setIsUnitLocked(true);

    setFormTitleVi(cond.titleVi);
    setFormTitle(cond.titleEn);
    setFormDescriptionVi(cond.descriptionVi);
    setFormDescription(cond.descriptionEn);

    if (cat.defaultIcon) {
      setFormImageUrl(cat.defaultIcon);
    }
    if (cat.roles && cat.roles.length > 0) {
      setFormRoles(cat.roles);
    }
    if (titleError) setTitleError('');
  };

  const handleSelectFamily = (famId: string) => {
    setSelectedFamilyId(famId);
    const fam = MEDAL_CRITERIA_CATALOG.find((c) => c.id === famId);
    if (fam && fam.conditions.length > 0) {
      const matchingCond = fam.conditions.find((c) => c.tier === formTier) || fam.conditions[0];
      handleApplyCondition(matchingCond, fam);
    } else if (famId === 'CUSTOM') {
      setIsUnitLocked(false);
    }
  };

  // Populate form when editing or initializing
  useEffect(() => {
    if (mode === 'edit' && medal) {
      setFormTitle(medal.title);
      setFormTitleVi(medal.titleVi);
      setFormDescription(medal.description);
      setFormDescriptionVi(medal.descriptionVi);
      setFormRoles(medal.roles);
      setFormTier(medal.tier);
      setPreviewTier(medal.tier);
      setFormStageLevel(medal.stageLevel);
      setFormImageUrl(medal.imageUrl || 'lucide:' + resolveMedalIconName(medal));
      setFormCriteriaMetric(medal.criteriaMetric);
      setFormCriteriaThreshold(medal.criteriaThreshold);
      setFormCriteriaUnit(medal.criteriaUnit);
      setFormIsActive(medal.isActive);

      const matchedCat = MEDAL_CRITERIA_CATALOG.find(
        (c) => c.metric === medal.criteriaMetric || (medal.code && medal.code.toUpperCase().includes(c.id))
      );
      setSelectedFamilyId(matchedCat ? matchedCat.id : 'CUSTOM');
    } else if (mode === 'create') {
      setSelectedFamilyId('PROLIFIC_AUTHOR');
      const defaultFam = MEDAL_CRITERIA_CATALOG[0];
      if (defaultFam && defaultFam.conditions.length > 0) {
        const firstCond = defaultFam.conditions[0];
        setFormTier(firstCond.tier);
        setPreviewTier(firstCond.tier);
        setFormStageLevel(firstCond.stageLevel);
        setFormCriteriaThreshold(firstCond.threshold);
        setFormCriteriaMetric(firstCond.metric || defaultFam.metric);
        setFormCriteriaUnit(firstCond.unit || defaultFam.unit);
        setFormTitleVi(firstCond.titleVi);
        setFormTitle(firstCond.titleEn);
        setFormDescriptionVi(firstCond.descriptionVi);
        setFormDescription(firstCond.descriptionEn);
        setFormRoles(defaultFam.roles);
        setFormImageUrl(defaultFam.defaultIcon);
      } else {
        setFormTitle('');
        setFormTitleVi('');
        setFormDescription('');
        setFormDescriptionVi('');
        setFormRoles(['Researcher']);
        setFormTier('Bronze');
        setPreviewTier('Bronze');
        setFormStageLevel(1);
        setFormImageUrl('lucide:BookOpen');
        setFormCriteriaMetric('published_papers');
        setFormCriteriaThreshold(1);
        setFormCriteriaUnit('papers');
      }
      setFormIsActive(true);
    }
    setIsUnitLocked(true);
    setTitleError('');
  }, [mode, medal]);

  // Handle metric change with auto-filled locked unit
  const handleMetricChange = (metricVal: string) => {
    setFormCriteriaMetric(metricVal);
    if (isUnitLocked) {
      const autoUnit = getAutoUnitForMetric(metricVal);
      setFormCriteriaUnit(autoUnit);
    }
  };

  const handleTierSelect = (tier: MedalTier) => {
    setFormTier(tier);
    setPreviewTier(tier);
    // If current family has a condition matching this tier, apply its template
    if (currentFamily && currentFamily.conditions.length > 0) {
      const matchingCond = currentFamily.conditions.find((c) => c.tier === tier);
      if (matchingCond) {
        handleApplyCondition(matchingCond, currentFamily);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
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
      frameShape: 'circle',
      criteriaMetric: formCriteriaMetric.trim() || 'default_metric',
      criteriaThreshold: Number(formCriteriaThreshold) || 1,
      criteriaUnit: formCriteriaUnit,
      isActive: formIsActive,
    };

    setIsSubmitting(true);
    try {
      await onSave(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="medal-editor-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 id="medal-editor-title" className={styles.modalTitle}>
            {mode === 'create'
              ? t('admin.medals.modal.createTitle', 'Thêm huy hiệu vinh danh mới')
              : t('admin.medals.modal.editTitle', 'Chỉnh sửa huy hiệu')}
          </h3>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {/* Section 1: Chọn Loại Huy hiệu & Danh sách Điều kiện theo List */}
            <div className={styles.conditionCatalogCard}>
              <div className={styles.conditionCatalogHeader}>
                <div className={styles.conditionCatalogTitleRow}>
                  <Sparkles size={16} color="#eab308" />
                  <span className={styles.conditionCatalogTitle}>
                    {t(
                      'admin.medals.modal.conditionCatalog',
                      '1. Danh sách Điều kiện & Nhóm Huy hiệu'
                    )}
                  </span>
                </div>
                <p className={styles.fieldHint}>
                  {t(
                    'admin.medals.modal.conditionCatalogHint',
                    'Chọn nhóm huy hiệu để xem danh sách điều kiện chi tiết. Bấm vào một điều kiện để tự động điền cấp bậc, ngưỡng đạt, đơn vị đã khóa và mô tả công khai.'
                  )}
                </p>
              </div>

              <div className={styles.categorySelectWrapper}>
                <label htmlFor="medalCategorySelect" className={styles.formLabel}>
                  {t('admin.medals.modal.categoryLabel', 'Nhóm chuyên mục & Loại huy hiệu')}
                </label>
                <select
                  id="medalCategorySelect"
                  value={selectedFamilyId}
                  onChange={(e) => handleSelectFamily(e.target.value)}
                  className={styles.formSelect}
                >
                  {MEDAL_CRITERIA_CATALOG.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {locale === 'vi' ? cat.nameVi : cat.nameEn} {cat.metric ? `(${cat.metric})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* DANH SÁCH CÁC ĐIỀU KIỆN CỦA MEDAL ĐÓ THEO LIST */}
              {currentFamily && currentFamily.conditions.length > 0 && (
                <div>
                  <div className={styles.conditionListHeader}>
                    <span>
                      {t('admin.medals.modal.conditionsListTitle', 'Danh sách các điều kiện của huy hiệu này')}:
                    </span>
                    <span className={styles.conditionListCount}>
                      {currentFamily.conditions.length} {copy('milestones', 'mốc điều kiện')}
                    </span>
                  </div>

                  <div className={styles.conditionList}>
                    {currentFamily.conditions.map((cond, idx) => {
                      const isSelected =
                        formTier === cond.tier &&
                        formCriteriaThreshold === cond.threshold &&
                        formCriteriaMetric === (cond.metric || currentFamily.metric);

                      return (
                        <div
                          key={`${cond.tier}-${cond.threshold}-${idx}`}
                          className={`${styles.conditionListItem} ${
                            isSelected ? styles.conditionListItemActive : ''
                          }`}
                          onClick={() => handleApplyCondition(cond, currentFamily)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className={styles.conditionItemLeft}>
                            <span
                              className={`${styles.tierPillBadge} ${
                                styles['tierPill' + cond.tier] || ''
                              }`}
                            >
                              {cond.tier} (Cấp {cond.stageLevel})
                            </span>
                            <div className={styles.conditionItemDetails}>
                              <div className={styles.conditionItemMainLine}>
                                <span className={styles.conditionThresholdText}>
                                  {t('admin.medals.modal.conditionPrefix', 'Điều kiện:')} ≥ {cond.threshold}{' '}
                                  {criteriaUnitLabel(
                                    cond.unit || currentFamily.unit,
                                    locale as 'vi' | 'en'
                                  )}
                                </span>
                                <span className={styles.conditionTitleText}>
                                  · {locale === 'vi' ? cond.titleVi : cond.titleEn}
                                </span>
                              </div>
                              <p className={styles.conditionDescText}>
                                {locale === 'vi' ? cond.descriptionVi : cond.descriptionEn}
                              </p>
                            </div>
                          </div>

                          <div className={styles.conditionItemRight}>
                            {isSelected ? (
                              <span className={styles.conditionActiveTag}>
                                <Check size={13} />
                                <span>{t('admin.medals.modal.selectedCondition', 'Đang chọn')}</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                className={styles.conditionChooseBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApplyCondition(cond, currentFamily);
                                }}
                              >
                                {t('admin.medals.modal.selectCondition', 'Chọn điều kiện này')}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Identity & Tier Preview */}
            <div className={styles.formGroup}>
              <span className={styles.sectionLabel}>
                {copy('2. Icon & Live Tier Frame Preview', '2. Biểu tượng học thuật & Khung xem trước')}
              </span>
            </div>
            <div className={styles.imageSectionCard}>
              <div className={styles.previewContainer}>
                <SafeMedalBadge
                  imageUrl={formImageUrl}
                  tier={previewTier}
                  size={104}
                  alt="Preview"
                />
                <div className={styles.tierPills} title={copy('Preview badge across tier frames', 'Xem trước viền khung theo từng Tier')}>
                  {TIER_OPTIONS.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      className={`${styles.tierPillBtn} ${previewTier === tier ? styles.tierPillBtnActive : ''}`}
                      onClick={() => setPreviewTier(tier)}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.imageUploadControls}>
                <label htmlFor="formImageUrlInput" className={styles.formLabel}>
                  {t('admin.medals.modal.artworkUrl', 'Biểu tượng / Hình ảnh (Mã Lucide hoặc URL)')}
                </label>
                <div className={styles.imageUrlRow}>
                  <input
                    type="text"
                    id="formImageUrlInput"
                    name="formImageUrlInput"
                    placeholder="vd: lucide:BookOpen hoặc https://..."
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    className={styles.formInput}
                  />
                  <input
                    type="file"
                    id="formImageFileInput"
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

                {/* Curated Academic Icon Shortcuts */}
                <div className={styles.quickIconsGroup}>
                  <span className={styles.quickIconsLabel}>
                    {copy('Curated Academic Icons:', 'Biểu tượng học thuật nhanh:')}
                  </span>
                  <div className={styles.quickIconsRow}>
                    {ACADEMIC_ICON_PRESETS.map((item) => {
                      const IconComp = item.icon;
                      const isSelected = formImageUrl === `lucide:${item.name}`;
                      return (
                        <button
                          key={item.name}
                          type="button"
                          className={`${styles.quickIconBtn} ${isSelected ? styles.quickIconBtnActive : ''}`}
                          onClick={() => setFormImageUrl(`lucide:${item.name}`)}
                          title={item.label}
                        >
                          <IconComp size={14} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.iconPickerGrid}>
                  <LucideIconPicker
                    value={formImageUrl}
                    onChange={setFormImageUrl}
                    id="tierEditorIconPickerSearch"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Naming & Public Meta Description */}
            <div className={styles.formGroup}>
              <span className={styles.sectionLabel}>
                {copy('3. Naming & Public Meta Description', '3. Đặt tên & Mô tả công khai')}
              </span>
            </div>
            <div className={styles.formGridTwo}>
              <div className={styles.formGroup}>
                <label htmlFor="formTitleViInput" className={styles.formLabel}>
                  {t('admin.medals.modal.titleVi', 'Tên huy hiệu (Tiếng Việt) *')}
                </label>
                <input
                  type="text"
                  id="formTitleViInput"
                  required
                  placeholder="vd: Tác giả năng suất (Cấp 1 - Khởi đầu)"
                  value={formTitleVi}
                  onChange={(e) => {
                    setFormTitleVi(e.target.value);
                    if (titleError) setTitleError('');
                  }}
                  className={`${styles.formInput} ${titleError ? styles.formInputError : ''}`}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="formTitleEnInput" className={styles.formLabel}>
                  {t('admin.medals.modal.titleEn', 'Tên huy hiệu (English)')}
                </label>
                <input
                  type="text"
                  id="formTitleEnInput"
                  placeholder="e.g.: Prolific Author (Bronze)"
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
              <div className={styles.errorText} role="alert">
                {titleError}
              </div>
            )}

            {/* Public Meta Description */}
            <div className={styles.formGridTwo}>
              <div className={styles.formGroup}>
                <label htmlFor="formDescViInput" className={styles.formLabel}>
                  {t('admin.medals.modal.descVi', 'Mô tả công khai (Tiếng Việt - Public Meta Description)')}
                </label>
                <textarea
                  id="formDescViInput"
                  rows={2}
                  placeholder="vd: Xuất bản thành công bài báo khoa học đầu tiên trên hệ thống."
                  value={formDescriptionVi}
                  onChange={(e) => setFormDescriptionVi(e.target.value)}
                  className={styles.formTextarea}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="formDescEnInput" className={styles.formLabel}>
                  {t('admin.medals.modal.descEn', 'Public Meta Description (English)')}
                </label>
                <textarea
                  id="formDescEnInput"
                  rows={2}
                  placeholder="e.g.: First research paper published on the ARS platform."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className={styles.formTextarea}
                />
              </div>
            </div>
            <p className={styles.fieldHint}>
              {t(
                'admin.medals.modal.descHint',
                'Mô tả công khai lý do và giá trị của huy hiệu để người dùng có động lực phấn đấu.'
              )}
            </p>

            {/* Section 4: Tier & Stage Level */}
            <div className={styles.formGroup}>
              <span className={styles.sectionLabel}>
                {copy('4. Tier & Activation Rules', '4. Cấp bậc & Quy tắc kích hoạt tự động')}
              </span>
            </div>
            <div className={styles.formGridTwo}>
              <div className={styles.formGroup}>
                <label htmlFor="formTierSelect" className={styles.formLabel}>
                  {t('admin.medals.modal.tier', 'Cấp bậc xếp hạng (Tier) *')}
                </label>
                <select
                  id="formTierSelect"
                  value={formTier}
                  onChange={(e) => handleTierSelect(e.target.value as MedalTier)}
                  className={styles.formSelect}
                >
                  {TIER_OPTIONS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier} — {t(TIER_LABEL_KEY[tier], tier)}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="formStageLevelInput" className={styles.formLabel}>
                  {t('admin.medals.modal.stageLevel', 'Cấp độ tiến trình (Stage Level)')}
                </label>
                <input
                  type="number"
                  id="formStageLevelInput"
                  min={1}
                  max={10}
                  value={formStageLevel}
                  onChange={(e) => setFormStageLevel(parseInt(e.target.value, 10) || 1)}
                  className={styles.formInput}
                />
              </div>
            </div>

            {/* Section 4: Activation Rules (Grouped Section) */}
            <div className={styles.activationRulesCard}>
              <div className={styles.activationRulesHeader}>
                <div>
                  <h4 className={styles.activationRulesTitle}>
                    {t('admin.medals.modal.activationRules', 'Quy tắc kích hoạt tự động (Activation Rules)')}
                  </h4>
                  <p className={styles.fieldHint}>
                    {t(
                      'admin.medals.modal.activationRulesHint',
                      'Cấu hình điều kiện để hệ thống tự động ghi nhận tiến trình và mở khóa huy hiệu.'
                    )}
                  </p>
                </div>
              </div>

              <div className={styles.formGridTwo}>
                <div className={styles.formGroup}>
                  <label htmlFor="formCriteriaMetricInput" className={styles.formLabel}>
                    {t('admin.medals.modal.metric', 'Mã chỉ số tự động (Metric Code) *')}
                  </label>
                  <input
                    type="text"
                    id="formCriteriaMetricInput"
                    list="predefinedMetricsList"
                    required
                    placeholder="vd: published_papers, hosted_seminars..."
                    value={formCriteriaMetric}
                    onChange={(e) => handleMetricChange(e.target.value)}
                    className={styles.formInput}
                  />
                  <datalist id="predefinedMetricsList">
                    {PREDEFINED_METRICS.map((pm) => (
                      <option
                        key={pm.metric}
                        value={pm.metric}
                        label={locale === 'vi' ? pm.labelVi : pm.labelEn}
                      />
                    ))}
                  </datalist>
                </div>

                <div className={styles.thresholdRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="formCriteriaThresholdInput" className={styles.formLabel}>
                      {t('admin.medals.modal.threshold', 'Ngưỡng đạt >=')}
                    </label>
                    <input
                      type="number"
                      id="formCriteriaThresholdInput"
                      min={1}
                      value={formCriteriaThreshold}
                      onChange={(e) => setFormCriteriaThreshold(parseInt(e.target.value, 10) || 1)}
                      className={styles.formInput}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label htmlFor="formCriteriaUnitSelect" className={styles.formLabel}>
                        {t('admin.medals.modal.unit', 'Đơn vị tính')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsUnitLocked(!isUnitLocked)}
                        className={styles.unitLockToggleBtn}
                        title={isUnitLocked ? copy('Click to unlock unit', 'Bấm để mở khóa đơn vị') : copy('Click to auto-lock unit', 'Bấm để khóa tự động theo chỉ số')}
                      >
                        {isUnitLocked ? <Lock size={12} className={styles.unitLockActiveIcon} /> : <Unlock size={12} />}
                        <span>{isUnitLocked ? copy('Locked', 'Đã khóa') : copy('Unlocked', 'Mở')}</span>
                      </button>
                    </div>

                    <div className={styles.unitSelectWrapper}>
                      <select
                        id="formCriteriaUnitSelect"
                        value={formCriteriaUnit}
                        disabled={isUnitLocked}
                        onChange={(e) => setFormCriteriaUnit(e.target.value as MedalCriteriaUnit)}
                        className={`${styles.formSelect} ${isUnitLocked ? styles.unitSelectLocked : ''}`}
                      >
                        {MEDAL_CRITERIA_UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {criteriaUnitLabel(unit, locale as 'vi' | 'en')}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {isUnitLocked && (
                <div className={styles.lockedUnitIndicator}>
                  <Lock size={12} />
                  <span>{t('admin.medals.modal.unitLockedHint', 'Đơn vị tính được khóa và tự động liên kết theo mã chỉ số đo lường.')}</span>
                </div>
              )}
            </div>

            {/* Section 5: Roles */}
            <div className={styles.formGroup}>
              <span className={styles.sectionLabel}>
                {copy('5. Applicable Roles', '5. Vai trò áp dụng huy hiệu')}
              </span>
              <div className={styles.checkboxRoleGroup}>
                {ALL_ROLES.map((role) => {
                  const isChecked = formRoles.includes(role);
                  let label: string = role;
                  if (role === 'Researcher') label = t('admin.medals.role.researcher', 'Nhà nghiên cứu');
                  else if (role === 'Lecturer') label = t('admin.medals.role.lecturer', 'Giảng viên');
                  else if (role === 'Reviewer') label = t('admin.medals.role.reviewer', 'Người phản biện');
                  else if (role === 'Graduate Student') label = t('admin.medals.role.student', 'Học viên');
                  const inputId = `roleCheck_${role.replace(/\s+/g, '_')}`;
                  return (
                    <label key={role} htmlFor={inputId} className={styles.checkboxRoleItem}>
                      <input
                        type="checkbox"
                        id={inputId}
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) setFormRoles([...formRoles, role]);
                          else setFormRoles(formRoles.filter((r) => r !== role));
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Active switch */}
            <div className={styles.activeSwitch}>
              <input
                type="checkbox"
                id="isActiveSwitch"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
              />
              <label htmlFor="isActiveSwitch">
                {t('admin.medals.modal.active', 'Kích hoạt huy hiệu này ngay cho người dùng')}
              </label>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnAction} onClick={onClose}>
              {t('admin.medals.modal.cancel', 'Hủy bỏ')}
            </button>
            <Button
              variant="primary"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span>{copy('Saving...', 'Đang lưu...')}</span>
              ) : (
                <span>{mode === 'create' ? t('admin.medals.action.create', 'Tạo huy hiệu') : t('admin.medals.action.save', 'Lưu thay đổi')}</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default TierEditor;
