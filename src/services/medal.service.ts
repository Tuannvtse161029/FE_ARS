import api from './axios';

export type MedalTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export type RoleTarget = 'All' | 'Researcher' | 'Lecturer' | 'Reviewer' | 'Graduate Student';

export type MedalCriteriaUnit =
  | 'papers'
  | 'seminars'
  | 'student_groups'
  | 'reviews'
  | 'account'
  | 'publications'
  | 'phases'
  | 'times'
  | 'verifications';

export const MEDAL_CRITERIA_UNITS: MedalCriteriaUnit[] = [
  'papers', 'seminars', 'student_groups', 'reviews',
  'account', 'publications', 'phases', 'times', 'verifications',
];

export const CRITERIA_UNIT_LABEL: Record<MedalCriteriaUnit, { en: string; vi: string }> = {
  papers:         { en: 'papers',          vi: 'bài báo' },
  seminars:       { en: 'seminars',        vi: 'buổi seminar' },
  student_groups: { en: 'student groups',  vi: 'nhóm sinh viên' },
  reviews:        { en: 'reviews',         vi: 'lượt review' },
  account:        { en: 'account',         vi: 'tài khoản' },
  publications:   { en: 'publications',    vi: 'công trình' },
  phases:         { en: 'phases',          vi: 'giai đoạn' },
  times:          { en: 'times',           vi: 'lần' },
  verifications:  { en: 'verifications',   vi: 'lần xác minh' },
};

export const criteriaUnitLabel = (unit: string, locale: 'en' | 'vi'): string => {
  const known = CRITERIA_UNIT_LABEL[unit as MedalCriteriaUnit];
  if (known) return known[locale];
  return unit || (locale === 'en' ? 'times' : 'lần');
};

export interface Medal {
  id: string;
  code: string;
  title: string;
  titleVi: string;
  description: string;
  descriptionVi: string;
  roles: RoleTarget[];
  tier: MedalTier;
  stageLevel: number;
  /**
   * Shared icon for the whole metric family. Conventions:
   *   - `lucide:IconName`  → renders a Lucide icon (default)
   *   - `https://…`        → renders a remote image
   *   - `/assets/badges/…` → renders a bundled asset (see assets/badges/index.ts)
   *
   * IMPORTANT: the icon belongs to the metric FAMILY (all tiers of the
   * same achievement), not to a single tier. Tier only changes the
   * color of the frame (Bronze/Silver/Gold/Platinum).
   */
  imageUrl: string;
  criteriaMetric: string;
  criteriaThreshold: number;
  criteriaUnit: MedalCriteriaUnit;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Derives the metric-family key from a medal code by stripping the trailing
 * tier suffix. Examples:
 *   ORCID_VERIFIED_BRONZE  →  ORCID_VERIFIED
 *   PROLIFIC_AUTHOR_GOLD   →  PROLIFIC_AUTHOR
 *   FLAWLESS_PROGRESS_GOLD →  FLAWLESS_PROGRESS
 *   REVIEW_MILESTONE_IV    →  REVIEW_MILESTONE
 *
 * The function is forgiving: codes that don't include a recognised tier
 * suffix fall back to the whole code so families still group correctly.
 */
export const deriveMetricFamily = (code: string): string => {
  if (!code) return '';
  return code
    .replace(/_(BRONZE|SILVER|GOLD|PLATINUM)$/i, '')
    .replace(/_(I|II|III|IV|V|VI|VII|VIII|IX|X)$/i, '')
    .toUpperCase();
};

/**
 * Derives a canonical, human-readable family label from the family code.
 * Used in the Admin UI when grouping tier variants under one card.
 */
export const metricFamilyLabel = (code: string): string => {
  const family = deriveMetricFamily(code);
  if (!family) return 'Achievement';
  return family
    .toLowerCase()
    .replace(/_+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export interface MedalCreateInput {
  title: string;
  titleVi: string;
  description: string;
  descriptionVi: string;
  roles: RoleTarget[];
  tier: MedalTier;
  stageLevel: number;
  imageUrl: string;
  criteriaMetric: string;
  criteriaThreshold: number;
  criteriaUnit: MedalCriteriaUnit;
  isActive?: boolean;
}

export interface MedalUpdateInput extends Partial<MedalCreateInput> {
  id: string;
}

export interface UserMedal {
  medal: Medal;
  currentProgress: number;
  isUnlocked: boolean;
  progressPercentage: number;
  unlockedAt: string | null;
}

const STORAGE_KEY = 'ars_platform_medals_v1';

export const INITIAL_MEDALS: Medal[] = [
  // 1. ORCID Verified Scholar (All 4 roles)
  {
    id: 'medal-orcid-1',
    code: 'ORCID_VERIFIED_BRONZE',
    title: 'ORCID Verified Scholar (Bronze)',
    titleVi: 'Học giả xác thực ORCID (Cấp 1 - Đồng)',
    description: 'Successfully connected and verified an international ORCID iD.',
    descriptionVi: 'Đã liên kết và xác minh định danh khoa học quốc tế ORCID iD thành công.',
    roles: ['Researcher', 'Lecturer', 'Reviewer', 'Graduate Student'],
    tier: 'Bronze',
    stageLevel: 1,
    imageUrl: 'lucide:ShieldCheck',
    criteriaMetric: 'orcid_connected',
    criteriaThreshold: 1,
    criteriaUnit: 'account',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-orcid-2',
    code: 'ORCID_VERIFIED_SILVER',
    title: 'ORCID Verified Scholar (Silver)',
    titleVi: 'Học giả xác thực ORCID (Cấp 2 - Bạc)',
    description: 'Verified authorship through ORCID for at least 1 academic paper.',
    descriptionVi: 'Xác thực quyền tác giả qua ORCID cho ít nhất 1 bài báo nghiên cứu.',
    roles: ['Researcher', 'Lecturer', 'Reviewer', 'Graduate Student'],
    tier: 'Silver',
    stageLevel: 2,
    imageUrl: 'lucide:ShieldCheck',
    criteriaMetric: 'orcid_verified_papers',
    criteriaThreshold: 1,
    criteriaUnit: 'papers',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-orcid-3',
    code: 'ORCID_VERIFIED_GOLD',
    title: 'ORCID Verified Scholar (Gold)',
    titleVi: 'Học giả xác thực ORCID (Cấp 3 - Vàng)',
    description: 'Full public ORCID profile with 3 or more verified scholarly publications.',
    descriptionVi: 'Hồ sơ ORCID hoàn chỉnh, đồng bộ từ 3 công trình nghiên cứu chính thức trở lên.',
    roles: ['Researcher', 'Lecturer', 'Reviewer', 'Graduate Student'],
    tier: 'Gold',
    stageLevel: 3,
    imageUrl: 'lucide:ShieldCheck',
    criteriaMetric: 'orcid_verified_papers',
    criteriaThreshold: 3,
    criteriaUnit: 'publications',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },

  // 2. Prolific Author (Researcher)
  {
    id: 'medal-prolific-1',
    code: 'PROLIFIC_AUTHOR_BRONZE',
    title: 'Prolific Author (Bronze)',
    titleVi: 'Tác giả năng suất (Cấp 1 - Khởi đầu)',
    description: 'First research paper published on the ARS platform.',
    descriptionVi: 'Xuất bản thành công bài báo khoa học đầu tiên trên hệ thống.',
    roles: ['Researcher'],
    tier: 'Bronze',
    stageLevel: 1,
    imageUrl: 'lucide:BookOpen',
    criteriaMetric: 'published_papers',
    criteriaThreshold: 1,
    criteriaUnit: 'papers',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-prolific-2',
    code: 'PROLIFIC_AUTHOR_SILVER',
    title: 'Prolific Author (Silver)',
    titleVi: 'Tác giả năng suất (Cấp 2 - Bạc)',
    description: 'Has 5 or more research papers screened and published by Admin.',
    descriptionVi: 'Có từ 5 bài báo trở lên được Admin phê duyệt và xuất bản.',
    roles: ['Researcher'],
    tier: 'Silver',
    stageLevel: 2,
    imageUrl: 'lucide:BookOpen',
    criteriaMetric: 'published_papers',
    criteriaThreshold: 5,
    criteriaUnit: 'papers',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-prolific-3',
    code: 'PROLIFIC_AUTHOR_GOLD',
    title: 'Prolific Author (Gold)',
    titleVi: 'Tác giả năng suất (Cấp 3 - Vàng)',
    description: 'Has 10 or more approved research papers in the catalog.',
    descriptionVi: 'Có từ 10 bài báo trở lên được xuất bản trong kho nghiên cứu.',
    roles: ['Researcher'],
    tier: 'Gold',
    stageLevel: 3,
    imageUrl: 'lucide:BookOpen',
    criteriaMetric: 'published_papers',
    criteriaThreshold: 10,
    criteriaUnit: 'papers',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-prolific-4',
    code: 'PROLIFIC_AUTHOR_PLATINUM',
    title: 'Prolific Author (Platinum)',
    titleVi: 'Tác giả năng suất (Cấp 4 - Bạch Kim)',
    description: 'Has 20 or more research publications, establishing top-tier research presence.',
    descriptionVi: 'Đạt từ 20 bài báo xuất bản, xác lập vị thế nghiên cứu xuất sắc.',
    roles: ['Researcher'],
    tier: 'Platinum',
    stageLevel: 4,
    imageUrl: 'lucide:BookOpen',
    criteriaMetric: 'published_papers',
    criteriaThreshold: 20,
    criteriaUnit: 'papers',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },

  // 3. Academic Host (Researcher & Lecturer)
  {
    id: 'medal-host-1',
    code: 'ACADEMIC_HOST_BRONZE',
    title: 'Academic Host (Bronze)',
    titleVi: 'Chủ trì Hội thảo (Cấp 1 - Đồng)',
    description: 'Successfully organized and hosted 1 academic seminar on the platform.',
    descriptionVi: 'Tổ chức thành công 1 buổi Seminar học thuật trên hệ thống.',
    roles: ['Researcher', 'Lecturer'],
    tier: 'Bronze',
    stageLevel: 1,
    imageUrl: 'lucide:Mic',
    criteriaMetric: 'hosted_seminars',
    criteriaThreshold: 1,
    criteriaUnit: 'seminars',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-host-2',
    code: 'ACADEMIC_HOST_SILVER',
    title: 'Academic Host (Silver)',
    titleVi: 'Chủ trì Hội thảo (Cấp 2 - Bạc)',
    description: 'Successfully organized and hosted 3 or more academic seminars on the platform.',
    descriptionVi: 'Tổ chức thành công từ 3 buổi Seminar học thuật trở lên trên hệ thống.',
    roles: ['Researcher', 'Lecturer'],
    tier: 'Silver',
    stageLevel: 2,
    imageUrl: 'lucide:Mic',
    criteriaMetric: 'hosted_seminars',
    criteriaThreshold: 3,
    criteriaUnit: 'seminars',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-host-3',
    code: 'ACADEMIC_HOST_GOLD',
    title: 'Academic Host (Gold)',
    titleVi: 'Chủ trì Hội thảo (Cấp 3 - Vàng)',
    description: 'Successfully hosted 5 or more academic seminars with high engagement.',
    descriptionVi: 'Tổ chức thành công từ 5 buổi Seminar học thuật với điểm đánh giá cao.',
    roles: ['Researcher', 'Lecturer'],
    tier: 'Gold',
    stageLevel: 3,
    imageUrl: 'lucide:Mic',
    criteriaMetric: 'hosted_seminars',
    criteriaThreshold: 5,
    criteriaUnit: 'seminars',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-host-4',
    code: 'ACADEMIC_HOST_PLATINUM',
    title: 'Academic Host (Platinum)',
    titleVi: 'Chủ trì Hội thảo (Cấp 4 - Bạch Kim)',
    description: 'Successfully hosted 10 or more academic seminars on the platform.',
    descriptionVi: 'Tổ chức thành công từ 10 buổi Seminar học thuật uy tín trên hệ thống.',
    roles: ['Researcher', 'Lecturer'],
    tier: 'Platinum',
    stageLevel: 4,
    imageUrl: 'lucide:Mic',
    criteriaMetric: 'hosted_seminars',
    criteriaThreshold: 10,
    criteriaUnit: 'seminars',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },

  // 4. Master Mentor (Lecturer)
  {
    id: 'medal-mentor-1',
    code: 'MASTER_MENTOR_BRONZE',
    title: 'Master Mentor (Bronze)',
    titleVi: 'Người hướng dẫn tận tâm (Cấp 1 - Đồng)',
    description: 'Mentored 1 student research group completing 100% of topic phases.',
    descriptionVi: 'Hướng dẫn 1 nhóm sinh viên hoàn thành 100% các Phase báo cáo tiến độ.',
    roles: ['Lecturer'],
    tier: 'Bronze',
    stageLevel: 1,
    imageUrl: 'lucide:GraduationCap',
    criteriaMetric: 'guided_groups_completed',
    criteriaThreshold: 1,
    criteriaUnit: 'student_groups',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-mentor-2',
    code: 'MASTER_MENTOR_SILVER',
    title: 'Master Mentor (Silver)',
    titleVi: 'Người hướng dẫn tận tâm (Cấp 2 - Bạc)',
    description: 'Mentored at least 3 student groups completing 100% of progress report phases.',
    descriptionVi: 'Hướng dẫn ít nhất 3 nhóm sinh viên hoàn thành 100% các Phase báo cáo tiến độ.',
    roles: ['Lecturer'],
    tier: 'Silver',
    stageLevel: 2,
    imageUrl: 'lucide:GraduationCap',
    criteriaMetric: 'guided_groups_completed',
    criteriaThreshold: 3,
    criteriaUnit: 'student_groups',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-mentor-3',
    code: 'MASTER_MENTOR_GOLD',
    title: 'Master Mentor (Gold)',
    titleVi: 'Người hướng dẫn tận tâm (Cấp 3 - Vàng)',
    description: 'Mentored 5 student groups successfully reaching defense and final review.',
    descriptionVi: 'Hướng dẫn 5 nhóm sinh viên hoàn thành xuất sắc toàn bộ giai đoạn đề tài.',
    roles: ['Lecturer'],
    tier: 'Gold',
    stageLevel: 3,
    imageUrl: 'lucide:GraduationCap',
    criteriaMetric: 'guided_groups_completed',
    criteriaThreshold: 5,
    criteriaUnit: 'student_groups',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-mentor-4',
    code: 'MASTER_MENTOR_PLATINUM',
    title: 'Master Mentor (Platinum)',
    titleVi: 'Người hướng dẫn tận tâm (Cấp 4 - Bạch Kim)',
    description: 'Mentored 10 or more student groups successfully completing research topics.',
    descriptionVi: 'Hướng dẫn thành công từ 10 nhóm sinh viên bảo vệ thành công đề tài.',
    roles: ['Lecturer'],
    tier: 'Platinum',
    stageLevel: 4,
    imageUrl: 'lucide:GraduationCap',
    criteriaMetric: 'guided_groups_completed',
    criteriaThreshold: 10,
    criteriaUnit: 'student_groups',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },

  // 5. Review Milestone (Reviewer)
  {
    id: 'medal-review-1',
    code: 'REVIEW_MILESTONE_I',
    title: 'Review Milestone I (Bronze)',
    titleVi: 'Cột mốc thẩm định I (Cấp 1 - 5 Bài)',
    description: 'Completed comprehensive evaluation for 5 scientific manuscripts.',
    descriptionVi: 'Hoàn thành đánh giá và thẩm định 5 bài báo khoa học.',
    roles: ['Reviewer'],
    tier: 'Bronze',
    stageLevel: 1,
    imageUrl: 'lucide:ClipboardCheck',
    criteriaMetric: 'completed_reviews',
    criteriaThreshold: 5,
    criteriaUnit: 'papers',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-review-2',
    code: 'REVIEW_MILESTONE_II',
    title: 'Review Milestone II (Silver)',
    titleVi: 'Cột mốc thẩm định II (Cấp 2 - 10 Bài)',
    description: 'Completed comprehensive evaluation for 10 scientific manuscripts.',
    descriptionVi: 'Hoàn thành đánh giá và thẩm định 10 bài báo khoa học.',
    roles: ['Reviewer'],
    tier: 'Silver',
    stageLevel: 2,
    imageUrl: 'lucide:ClipboardCheck',
    criteriaMetric: 'completed_reviews',
    criteriaThreshold: 10,
    criteriaUnit: 'papers',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-review-3',
    code: 'REVIEW_MILESTONE_III',
    title: 'Review Milestone III (Gold)',
    titleVi: 'Cột mốc thẩm định III (Cấp 3 - 25 Bài)',
    description: 'Completed comprehensive evaluation for 25 scientific manuscripts.',
    descriptionVi: 'Hoàn thành đánh giá và thẩm định 25 bài báo khoa học.',
    roles: ['Reviewer'],
    tier: 'Gold',
    stageLevel: 3,
    imageUrl: 'lucide:ClipboardCheck',
    criteriaMetric: 'completed_reviews',
    criteriaThreshold: 25,
    criteriaUnit: 'papers',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-review-4',
    code: 'REVIEW_MILESTONE_IV',
    title: 'Review Milestone IV (Platinum)',
    titleVi: 'Cột mốc thẩm định IV (Cấp 4 - 50 Bài)',
    description: 'Completed comprehensive evaluation for 50 scientific manuscripts.',
    descriptionVi: 'Hoàn thành đánh giá và thẩm định 50 bài báo khoa học.',
    roles: ['Reviewer'],
    tier: 'Platinum',
    stageLevel: 4,
    imageUrl: 'lucide:ClipboardCheck',
    criteriaMetric: 'completed_reviews',
    criteriaThreshold: 50,
    criteriaUnit: 'papers',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },

  // 6. Seminar Participant (Graduate Student)
  {
    id: 'medal-student-seminar-1',
    code: 'SEMINAR_PARTICIPANT_BRONZE',
    title: 'Seminar Participant (Bronze)',
    titleVi: 'Học viên hội thảo (Cấp 1 - Đồng)',
    description: 'Actively participated in 1 academic seminar and submitted feedback.',
    descriptionVi: 'Tham gia đầy đủ 1 buổi Seminar học thuật và nộp đánh giá phản hồi.',
    roles: ['Graduate Student'],
    tier: 'Bronze',
    stageLevel: 1,
    imageUrl: 'lucide:Headphones',
    criteriaMetric: 'attended_seminars',
    criteriaThreshold: 1,
    criteriaUnit: 'seminars',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-student-seminar-2',
    code: 'SEMINAR_PARTICIPANT_SILVER',
    title: 'Seminar Participant (Silver)',
    titleVi: 'Học viên hội thảo (Cấp 2 - Bạc)',
    description: 'Actively participated in 3 academic seminars and submitted feedback.',
    descriptionVi: 'Tham gia đầy đủ 3 buổi Seminar học thuật và nộp phản hồi chất lượng.',
    roles: ['Graduate Student'],
    tier: 'Silver',
    stageLevel: 2,
    imageUrl: 'lucide:Headphones',
    criteriaMetric: 'attended_seminars',
    criteriaThreshold: 3,
    criteriaUnit: 'seminars',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-student-seminar-3',
    code: 'SEMINAR_PARTICIPANT_GOLD',
    title: 'Seminar Participant (Gold)',
    titleVi: 'Học viên hội thảo (Cấp 3 - Vàng)',
    description: 'Actively participated in 5 academic seminars.',
    descriptionVi: 'Tham gia đầy đủ từ 5 buổi Seminar học thuật trên hệ thống.',
    roles: ['Graduate Student'],
    tier: 'Gold',
    stageLevel: 3,
    imageUrl: 'lucide:Headphones',
    criteriaMetric: 'attended_seminars',
    criteriaThreshold: 5,
    criteriaUnit: 'seminars',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-student-seminar-4',
    code: 'SEMINAR_PARTICIPANT_PLATINUM',
    title: 'Seminar Participant (Platinum)',
    titleVi: 'Học viên hội thảo (Cấp 4 - Bạch Kim)',
    description: 'Actively participated in 10 academic seminars.',
    descriptionVi: 'Tham gia đầy đủ từ 10 buổi Seminar học thuật trên hệ thống.',
    roles: ['Graduate Student'],
    tier: 'Platinum',
    stageLevel: 4,
    imageUrl: 'lucide:Headphones',
    criteriaMetric: 'attended_seminars',
    criteriaThreshold: 10,
    criteriaUnit: 'seminars',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },

  // 7. Flawless Progress (Graduate Student)
  {
    id: 'medal-flawless-1',
    code: 'FLAWLESS_PROGRESS_BRONZE',
    title: 'Flawless Progress (Bronze)',
    titleVi: 'Tiến độ hoàn hảo (Cấp 1 - Đồng)',
    description: 'Submitted Phase 1 on time without any rejection or revision required.',
    descriptionVi: 'Hoàn thành nộp Phase 1 đúng thời hạn, không bị từ chối/yêu cầu sửa.',
    roles: ['Graduate Student'],
    tier: 'Bronze',
    stageLevel: 1,
    imageUrl: 'lucide:Sparkles',
    criteriaMetric: 'flawless_phases',
    criteriaThreshold: 1,
    criteriaUnit: 'phases',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-flawless-2',
    code: 'FLAWLESS_PROGRESS_SILVER',
    title: 'Flawless Progress (Silver)',
    titleVi: 'Tiến độ hoàn hảo (Cấp 2 - Bạc)',
    description: 'Completed 3 consecutive phases on time without extensions or rejections.',
    descriptionVi: 'Hoàn thành 3 giai đoạn liên tiếp đúng hạn, không cần gia hạn hay bị từ chối.',
    roles: ['Graduate Student'],
    tier: 'Silver',
    stageLevel: 2,
    imageUrl: 'lucide:Sparkles',
    criteriaMetric: 'flawless_phases',
    criteriaThreshold: 3,
    criteriaUnit: 'phases',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-flawless-3',
    code: 'FLAWLESS_PROGRESS_GOLD',
    title: 'Flawless Progress (Gold)',
    titleVi: 'Tiến độ hoàn hảo (Cấp 3 - Vàng)',
    description: 'Completed 100% of all topic phases on time with zero rejections.',
    descriptionVi: 'Hoàn thành 100% các phase đề tài đúng hạn, bảo vệ thành công tuyệt đối.',
    roles: ['Graduate Student'],
    tier: 'Gold',
    stageLevel: 3,
    imageUrl: 'lucide:Sparkles',
    criteriaMetric: 'flawless_phases',
    criteriaThreshold: 5,
    criteriaUnit: 'phases',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
];

function loadLocalMedals(): Medal[] {
  if (typeof window === 'undefined') return INITIAL_MEDALS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeMedalFamilies(parsed as Medal[]);
      }
    }
  } catch {
    // ignore
  }
  return INITIAL_MEDALS;
}

function saveLocalMedals(medals: Medal[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(medals));
  } catch {
    // storage fallback
  }
}

/**
 * Ensures every medal in the same metric family shares the same `imageUrl`.
 *
 * Background: icons belong to the ACHIEVEMENT (metric family), not to a
 * single tier. If the Admin previously changed icons on individual tier
 * variants and they drifted apart, this helper re-syncs them to the icon
 * of the lowest-stage medal in the family — which is treated as canonical.
 *
 * Returns the input list as a new array (no in-place mutation of the
 * caller's reference).
 */
export function normalizeMedalFamilies(medals: Medal[]): Medal[] {
  if (!Array.isArray(medals) || medals.length === 0) return medals;

  const familyIcons = new Map<string, string>();
  // Pass 1: for each family, pick the canonical icon from the lowest-stage medal.
  for (const m of medals) {
    const family = deriveMetricFamily(m.code);
    if (!family) continue;
    if (!familyIcons.has(family)) {
      familyIcons.set(family, m.imageUrl || 'lucide:Medal');
    }
  }
  // Pass 2: rewrite every medal's imageUrl to the family icon.
  return medals.map((m) => {
    const family = deriveMetricFamily(m.code);
    const canonical = familyIcons.get(family);
    if (canonical && m.imageUrl !== canonical) {
      return { ...m, imageUrl: canonical };
    }
    return m;
  });
}

export interface MedalFamilyGroup {
  /** Family key derived from code prefix, e.g. "ORCID_VERIFIED". */
  family: string;
  /** Human-readable family label, e.g. "Orcid Verified". */
  label: string;
  /** Shared icon URL across all tiers in the family. */
  imageUrl: string;
  /** Stage 1 medal (typically Bronze) — used as canonical for the family. */
  primary: Medal;
  /** Every tier variant, sorted by stageLevel ascending. */
  tiers: Medal[];
  /** Roles aggregated across the family (deduped). */
  roles: RoleTarget[];
  /** True if every tier is active. */
  allActive: boolean;
}

/**
 * Group medals by their metric family (code prefix). Returns the families
 * in stable order: alphabetical by family key.
 */
export function groupMedalsByFamily(medals: Medal[]): MedalFamilyGroup[] {
  if (!Array.isArray(medals) || medals.length === 0) return [];

  const buckets = new Map<string, Medal[]>();
  for (const m of medals) {
    const family = deriveMetricFamily(m.code);
    if (!family) continue;
    if (!buckets.has(family)) buckets.set(family, []);
    buckets.get(family)!.push(m);
  }

  const families: MedalFamilyGroup[] = [];
  for (const [family, list] of buckets.entries()) {
    const sorted = [...list].sort(
      (a, b) => (a.stageLevel ?? 0) - (b.stageLevel ?? 0),
    );
    const primary = sorted[0];
    const rolesSet = new Set<RoleTarget>();
    for (const m of sorted) {
      for (const r of m.roles ?? []) rolesSet.add(r);
    }
    families.push({
      family,
      label: metricFamilyLabel(family),
      imageUrl: primary?.imageUrl ?? 'lucide:Medal',
      primary,
      tiers: sorted,
      roles: Array.from(rolesSet),
      allActive: sorted.every((m) => m.isActive),
    });
  }

  return families.sort((a, b) => a.family.localeCompare(b.family));
}

export const medalService = {
  async getAll(params?: {
    role?: string;
    tier?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<Medal[]> {
    try {
      const res = await api.get('/api/Medal', { params });
      if (Array.isArray(res.data) && res.data.length > 0) {
        const normalized = normalizeMedalFamilies(res.data);
        saveLocalMedals(normalized);
        return normalized;
      }
    } catch (err) {
      console.warn('Live /api/Medal fetch error, falling back:', err);
    }
    return loadLocalMedals();
  },

  async getById(id: string): Promise<Medal | null> {
    try {
      const res = await api.get('/api/Medal/' + id);
      if (res.data) return res.data;
    } catch {
      // fallback
    }
    const list = await this.getAll();
    return list.find((m) => m.id === id) ?? null;
  },

  async create(input: MedalCreateInput): Promise<Medal> {
    const trimmedUnit = input.criteriaUnit.trim() as MedalCriteriaUnit;
    const criteriaUnit: MedalCriteriaUnit = MEDAL_CRITERIA_UNITS.includes(trimmedUnit)
      ? trimmedUnit
      : 'times';

    const payload = {
      title: input.title.trim(),
      titleVi: input.titleVi.trim() || input.title.trim(),
      description: input.description.trim(),
      descriptionVi: input.descriptionVi.trim() || input.description.trim(),
      roles: input.roles.length > 0 ? input.roles : ['All'],
      tier: input.tier,
      stageLevel: Number(input.stageLevel) || 1,
      imageUrl: input.imageUrl?.trim() || 'lucide:Medal',
      criteriaMetric: input.criteriaMetric.trim(),
      criteriaThreshold: Number(input.criteriaThreshold) || 1,
      criteriaUnit,
      isActive: input.isActive ?? true,
    };

    const res = await api.post('/api/Medal', payload);
    if (res.data) {
      const current = loadLocalMedals();
      saveLocalMedals([res.data, ...current.filter((m) => m.id !== res.data.id)]);
      // If the new medal belongs to an existing family, sync the icon to
      // the family canonical icon (lowest-stage sibling).
      const created = res.data as Medal;
      const family = deriveMetricFamily(created.code);
      if (family) {
        const allNow = loadLocalMedals();
        const siblings = allNow.filter(
          (m) => deriveMetricFamily(m.code) === family,
        );
        const canonical =
          siblings
            .sort((a, b) => (a.stageLevel ?? 0) - (b.stageLevel ?? 0))[0]
            ?.imageUrl ?? created.imageUrl;
        if (
          canonical &&
          siblings.some((m) => m.imageUrl !== canonical)
        ) {
          await Promise.all(
            siblings.map((m) =>
              m.imageUrl !== canonical
                ? this.update(m.id, { imageUrl: canonical })
                : Promise.resolve(m),
            ),
          );
        }
      }
      return await this.getById(created.id) ?? created;
    }

    throw new Error('Failed to create medal: no data returned');
  },

  async update(id: string, input: Partial<MedalCreateInput>): Promise<Medal> {
    const existing = await this.getById(id);

    let criteriaUnit: MedalCriteriaUnit;
    if (input.criteriaUnit !== undefined) {
      const candidate = input.criteriaUnit.trim() as MedalCriteriaUnit;
      criteriaUnit = MEDAL_CRITERIA_UNITS.includes(candidate)
        ? candidate
        : ((existing?.criteriaUnit ?? 'times') as MedalCriteriaUnit);
    } else {
      criteriaUnit = (existing?.criteriaUnit ?? 'times') as MedalCriteriaUnit;
    }

    const merged: Omit<Medal, 'id' | 'code' | 'createdAt' | 'updatedAt'> = {
      title: input.title !== undefined ? input.title.trim() : (existing?.title ?? ''),
      titleVi: input.titleVi !== undefined ? input.titleVi.trim() : (existing?.titleVi ?? ''),
      description: input.description !== undefined ? input.description.trim() : (existing?.description ?? ''),
      descriptionVi: input.descriptionVi !== undefined ? input.descriptionVi.trim() : (existing?.descriptionVi ?? ''),
      roles: input.roles ?? existing?.roles ?? ['All'],
      tier: input.tier ?? existing?.tier ?? 'Bronze',
      stageLevel: input.stageLevel ?? existing?.stageLevel ?? 1,
      imageUrl: input.imageUrl !== undefined ? input.imageUrl.trim() : (existing?.imageUrl ?? 'lucide:Medal'),
      criteriaMetric: input.criteriaMetric !== undefined ? input.criteriaMetric.trim() : (existing?.criteriaMetric ?? 'default_metric'),
      criteriaThreshold: input.criteriaThreshold !== undefined ? Number(input.criteriaThreshold) : (existing?.criteriaThreshold ?? 1),
      criteriaUnit,
      isActive: input.isActive !== undefined ? input.isActive : (existing?.isActive ?? true),
    };

    const res = await api.put('/api/Medal/' + id, merged);
    const updated: Medal = res.data || {
      id,
      code: existing?.code || '',
      ...merged,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const current = loadLocalMedals();
    const idx = current.findIndex((m) => m.id === id);
    if (idx !== -1) {
      current[idx] = updated;
      saveLocalMedals(current);
    }
    return updated;
  },

  async delete(id: string): Promise<void> {
    await api.delete('/api/Medal/' + id);
    const current = loadLocalMedals();
    saveLocalMedals(current.filter((m) => m.id !== id));
  },

  /**
   * Update the icon for EVERY medal in a metric family.
   *
   * Icons belong to the family (the achievement itself), not to a single
   * tier — the tier only changes the colour frame. Calling this once keeps
   * every tier visually consistent with the same icon.
   */
  async updateMedalFamilyIcon(
    family: string,
    imageUrl: string,
  ): Promise<Medal[]> {
    const trimmed = imageUrl.trim();
    if (!family) {
      throw new Error('Family key is required');
    }
    const targetUrl = trimmed || 'lucide:Medal';

    // Read the current state from the API/local cache so we can target
    // exactly the medals in this family.
    const current = await this.getAll();
    const familyMedals = current.filter(
      (m) => deriveMetricFamily(m.code) === family.toUpperCase(),
    );
    if (familyMedals.length === 0) {
      throw new Error(`No medals found for family "${family}"`);
    }

    // Hit the per-id update endpoint for each medal in parallel. This is
    // the only safe option today because the BE doesn't expose a family
    // update endpoint yet.
    const updated = await Promise.all(
      familyMedals.map(async (m) => this.update(m.id, { imageUrl: targetUrl })),
    );
    return updated;
  },

  async resetToDefaults(): Promise<Medal[]> {
    const res = await api.post('/api/Medal/reset-defaults');
    if (Array.isArray(res.data) && res.data.length > 0) {
      saveLocalMedals(res.data);
      return res.data;
    }
    saveLocalMedals(INITIAL_MEDALS);
    return INITIAL_MEDALS;
  },

  async getMyMedals(): Promise<UserMedal[]> {
    try {
      const res = await api.get('/api/Medal/my-medals');
      if (Array.isArray(res.data)) {
        return res.data;
      }
    } catch (err) {
      console.warn('Failed to fetch user medals:', err);
    }
    return [];
  },

  async getUserMedals(userId: string | number): Promise<UserMedal[]> {
    try {
      const res = await api.get('/api/Medal/user/' + userId);
      if (Array.isArray(res.data)) {
        return res.data;
      }
    } catch (err) {
      console.warn(`Failed to fetch medals for user ${userId}:`, err);
    }
    return [];
  },
};
