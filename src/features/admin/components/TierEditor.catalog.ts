/**
 * Medal Criteria Catalog — Shared catalog of preset achievement templates
 *
 * This file contains the predefined achievement criteria (templates) that
 * the admin can use when creating or editing medals. Extracted from the
 * TierEditor component to:
 *   1. Avoid circular imports (TierEditor ↔ TemplateSelector)
 *   2. Make the catalog data reusable across components
 *   3. Keep the TierEditor component focused on UI logic
 *
 * Each catalog item has a metric, unit, default icon, applicable roles,
 * and a list of tier-specific conditions with thresholds.
 */
import {
  type MedalTier,
  type RoleTarget,
  type MedalCriteriaUnit,
} from '../../../services/medal.service';

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
];
