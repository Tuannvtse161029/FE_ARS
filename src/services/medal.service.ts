import api from './axios';

export type MedalTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export type RoleTarget = 'All' | 'Researcher' | 'Lecturer' | 'Reviewer' | 'Graduate Student';

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
  imageUrl: string; // Dynamic URL for image, can be replaced anytime
  criteriaMetric: string;
  criteriaThreshold: number;
  criteriaUnit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

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
  criteriaUnit: string;
  isActive?: boolean;
}

export interface MedalUpdateInput extends Partial<MedalCreateInput> {
  id: string;
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
    imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'orcid_connected',
    criteriaThreshold: 1,
    criteriaUnit: 'tài khoản',
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
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'orcid_verified_papers',
    criteriaThreshold: 1,
    criteriaUnit: 'bài báo',
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
    imageUrl: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'orcid_verified_papers',
    criteriaThreshold: 3,
    criteriaUnit: 'công trình',
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
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'published_papers',
    criteriaThreshold: 1,
    criteriaUnit: 'bài báo',
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
    imageUrl: 'https://images.unsplash.com/photo-1532012164546-f432f2e37b73?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'published_papers',
    criteriaThreshold: 5,
    criteriaUnit: 'bài báo',
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
    imageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'published_papers',
    criteriaThreshold: 10,
    criteriaUnit: 'bài báo',
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
    imageUrl: 'https://images.unsplash.com/photo-1507842229451-7f01be7f7396?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'published_papers',
    criteriaThreshold: 20,
    criteriaUnit: 'bài báo',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },

  // 3. Academic Host (Researcher & Lecturer)
  {
    id: 'medal-host-1',
    code: 'ACADEMIC_HOST_BRONZE',
    title: 'Academic Host (Bronze)',
    titleVi: 'Chủ trì Hội thảo (Cấp 1 - Khởi đầu)',
    description: 'Successfully hosted 1 academic seminar on the platform.',
    descriptionVi: 'Tổ chức thành công 1 buổi Seminar học thuật trên hệ thống.',
    roles: ['Researcher', 'Lecturer'],
    tier: 'Bronze',
    stageLevel: 1,
    imageUrl: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'hosted_seminars',
    criteriaThreshold: 1,
    criteriaUnit: 'buổi seminar',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-host-2',
    code: 'ACADEMIC_HOST_SILVER',
    title: 'Academic Host (Silver)',
    titleVi: 'Chủ trì Hội thảo (Cấp 2 - Bạc)',
    description: 'Successfully hosted 3 or more academic seminars on the platform.',
    descriptionVi: 'Tổ chức thành công từ 3 buổi Seminar học thuật trở lên trên hệ thống.',
    roles: ['Researcher', 'Lecturer'],
    tier: 'Silver',
    stageLevel: 2,
    imageUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'hosted_seminars',
    criteriaThreshold: 3,
    criteriaUnit: 'buổi seminar',
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
    imageUrl: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'hosted_seminars',
    criteriaThreshold: 5,
    criteriaUnit: 'buổi seminar',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },

  // 4. Master Mentor (Lecturer)
  {
    id: 'medal-mentor-1',
    code: 'MASTER_MENTOR_BRONZE',
    title: 'Master Mentor (Bronze)',
    titleVi: 'Người hướng dẫn tận tâm (Cấp 1 - Khởi đầu)',
    description: 'Guided 1 student research group through 100% of their milestone phases.',
    descriptionVi: 'Hướng dẫn 1 nhóm sinh viên hoàn thành 100% các Phase báo cáo tiến độ.',
    roles: ['Lecturer'],
    tier: 'Bronze',
    stageLevel: 1,
    imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'guided_groups_completed',
    criteriaThreshold: 1,
    criteriaUnit: 'nhóm nghiên cứu',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-mentor-2',
    code: 'MASTER_MENTOR_SILVER',
    title: 'Master Mentor (Silver)',
    titleVi: 'Người hướng dẫn tận tâm (Cấp 2 - Bạc)',
    description: 'Guided at least 3 student research groups through 100% of milestone phases.',
    descriptionVi: 'Hướng dẫn ít nhất 3 nhóm sinh viên hoàn thành 100% các Phase báo cáo tiến độ.',
    roles: ['Lecturer'],
    tier: 'Silver',
    stageLevel: 2,
    imageUrl: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'guided_groups_completed',
    criteriaThreshold: 3,
    criteriaUnit: 'nhóm nghiên cứu',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-mentor-3',
    code: 'MASTER_MENTOR_GOLD',
    title: 'Master Mentor (Gold)',
    titleVi: 'Người hướng dẫn tận tâm (Cấp 3 - Vàng)',
    description: 'Guided at least 5 student research groups successfully to defense.',
    descriptionVi: 'Hướng dẫn từ 5 nhóm sinh viên hoàn thành 100% các giai đoạn đạt chuẩn.',
    roles: ['Lecturer'],
    tier: 'Gold',
    stageLevel: 3,
    imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'guided_groups_completed',
    criteriaThreshold: 5,
    criteriaUnit: 'nhóm nghiên cứu',
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
    imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'completed_reviews',
    criteriaThreshold: 5,
    criteriaUnit: 'bài báo',
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
    imageUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'completed_reviews',
    criteriaThreshold: 10,
    criteriaUnit: 'bài báo',
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
    imageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'completed_reviews',
    criteriaThreshold: 25,
    criteriaUnit: 'bài báo',
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
    imageUrl: 'https://images.unsplash.com/photo-1505664194779-8beaceb93744?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'completed_reviews',
    criteriaThreshold: 50,
    criteriaUnit: 'bài báo',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },

  // 6. Seminar Participant (Graduate Student)
  {
    id: 'medal-student-seminar-1',
    code: 'SEMINAR_PARTICIPANT_BRONZE',
    title: 'Seminar Participant (Bronze)',
    titleVi: 'Người tham dự tích cực (Cấp 1 - Khởi đầu)',
    description: 'Actively participated in 1 academic seminar and submitted feedback.',
    descriptionVi: 'Tham gia và gửi phản hồi đóng góp ý kiến cho 1 buổi seminar học thuật.',
    roles: ['Graduate Student'],
    tier: 'Bronze',
    stageLevel: 1,
    imageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'attended_seminars',
    criteriaThreshold: 1,
    criteriaUnit: 'buổi seminar',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-student-seminar-2',
    code: 'SEMINAR_PARTICIPANT_SILVER',
    title: 'Seminar Participant (Silver)',
    titleVi: 'Người tham dự tích cực (Cấp 2 - Bạc)',
    description: 'Actively participated in 3 academic seminars and submitted quality feedback.',
    descriptionVi: 'Tích cực tham gia các buổi seminar học thuật và gửi phản hồi đóng góp ý kiến (3 buổi).',
    roles: ['Graduate Student'],
    tier: 'Silver',
    stageLevel: 2,
    imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'attended_seminars',
    criteriaThreshold: 3,
    criteriaUnit: 'buổi seminar',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-student-seminar-3',
    code: 'SEMINAR_PARTICIPANT_GOLD',
    title: 'Seminar Participant (Gold)',
    titleVi: 'Người tham dự tích cực (Cấp 3 - Vàng)',
    description: 'Actively participated in 5 academic seminars across research domains.',
    descriptionVi: 'Tham gia và gửi phản hồi tích cực cho 5 buổi seminar khoa học.',
    roles: ['Graduate Student'],
    tier: 'Gold',
    stageLevel: 3,
    imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'attended_seminars',
    criteriaThreshold: 5,
    criteriaUnit: 'buổi seminar',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },

  // 7. Flawless Progress (Graduate Student)
  {
    id: 'medal-flawless-1',
    code: 'FLAWLESS_PROGRESS_BRONZE',
    title: 'Flawless Progress (Bronze)',
    titleVi: 'Tiến độ hoàn hảo (Cấp 1 - Khởi đầu)',
    description: 'Completed Phase 1 on time without any report rejection.',
    descriptionVi: 'Nhóm hoàn thành Phase 1 đúng thời hạn và đạt chuẩn không bị từ chối.',
    roles: ['Graduate Student'],
    tier: 'Bronze',
    stageLevel: 1,
    imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'flawless_phases',
    criteriaThreshold: 1,
    criteriaUnit: 'phase',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-flawless-2',
    code: 'FLAWLESS_PROGRESS_SILVER',
    title: 'Flawless Progress (Silver)',
    titleVi: 'Tiến độ hoàn hảo (Cấp 2 - Nửa chặng đường)',
    description: 'Completed 3 consecutive phases on time without extension or rejection.',
    descriptionVi: 'Nhóm hoàn thành từ 3 Phase liên tiếp đúng hạn và đạt Pass ngay lần đầu.',
    roles: ['Graduate Student'],
    tier: 'Silver',
    stageLevel: 2,
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'flawless_phases',
    criteriaThreshold: 3,
    criteriaUnit: 'phase',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'medal-flawless-3',
    code: 'FLAWLESS_PROGRESS_GOLD',
    title: 'Flawless Progress (Gold)',
    titleVi: 'Tiến độ hoàn hảo (Cấp 3 - Vàng Toàn diện)',
    description: 'Group completed all research milestone phases without delays or rejections.',
    descriptionVi: 'Nhóm hoàn thành toàn bộ các giai đoạn mà không lần nào bị trễ hạn hoặc bị từ chối.',
    roles: ['Graduate Student'],
    tier: 'Gold',
    stageLevel: 3,
    imageUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&auto=format&fit=crop&q=80',
    criteriaMetric: 'flawless_phases',
    criteriaThreshold: 100, // 100% of topic phases
    criteriaUnit: '% giai đoạn',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
];

function loadLocalMedals(): Medal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MEDALS));
      return INITIAL_MEDALS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_MEDALS;
  } catch {
    return INITIAL_MEDALS;
  }
}

function saveLocalMedals(medals: Medal[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(medals));
  } catch {
    // storage fallback
  }
}

export const medalService = {
  async getAll(): Promise<Medal[]> {
    try {
      const res = await api.get('/api/Medal');
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch {
      // Backend endpoint not ready yet; fallback to local persistence
    }
    return loadLocalMedals();
  },

  async getById(id: string): Promise<Medal | null> {
    const list = await this.getAll();
    return list.find((m) => m.id === id) ?? null;
  },

  async create(input: MedalCreateInput): Promise<Medal> {
    const newMedal: Medal = {
      id: 'medal-' + Date.now(),
      code: input.title.toUpperCase().replace(/\s+/g, '_') + '_' + input.tier.toUpperCase(),
      title: input.title.trim(),
      titleVi: input.titleVi.trim() || input.title.trim(),
      description: input.description.trim(),
      descriptionVi: input.descriptionVi.trim() || input.description.trim(),
      roles: input.roles.length > 0 ? input.roles : ['All'],
      tier: input.tier,
      stageLevel: input.stageLevel || 1,
      imageUrl: input.imageUrl.trim(),
      criteriaMetric: input.criteriaMetric.trim(),
      criteriaThreshold: Number(input.criteriaThreshold) || 1,
      criteriaUnit: input.criteriaUnit.trim() || 'lần',
      isActive: input.isActive ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const res = await api.post('/api/Medal', newMedal);
      if (res.data) return res.data;
    } catch {
      // Local fallback
    }

    const current = loadLocalMedals();
    const updated = [newMedal, ...current];
    saveLocalMedals(updated);
    return newMedal;
  },

  async update(id: string, input: Partial<MedalCreateInput>): Promise<Medal> {
    try {
      const res = await api.put('/api/Medal/' + id, input);
      if (res.data) return res.data;
    } catch {
      // Local fallback
    }

    const current = loadLocalMedals();
    const index = current.findIndex((m) => m.id === id);
    if (index === -1) {
      throw new Error('Medal not found');
    }

    const updatedMedal: Medal = {
      ...current[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };

    current[index] = updatedMedal;
    saveLocalMedals(current);
    return updatedMedal;
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete('/api/Medal/' + id);
    } catch {
      // Local fallback
    }

    const current = loadLocalMedals();
    const filtered = current.filter((m) => m.id !== id);
    saveLocalMedals(filtered);
  },

  async resetToDefaults(): Promise<Medal[]> {
    saveLocalMedals(INITIAL_MEDALS);
    return INITIAL_MEDALS;
  },
};
