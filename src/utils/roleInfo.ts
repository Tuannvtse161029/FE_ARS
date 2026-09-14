import {
  Award,
  BookOpen,
  GraduationCap,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { RequestableRole } from './registrationRoles';

/**
 * Per-role summary used by surfaces that need a short "what does this role
 * do on ARS" copy. Lives in this shared module so the
 * `RequestAdditionalRoleModal` and the `Register` page render the same
 * description — a single source of truth for product copy.
 *
 * The fields are intentionally bilingual (`descEn` / `descVi`) instead of
 * pulling through `i18n/dictionaries` because the dictionary type only
 * supports `Record<string, string>` flat keys, and these short paragraphs
 * are unlikely to need other locales in the near future.
 */
export interface RoleInfo {
  icon: LucideIcon;
  descEn: string;
  descVi: string;
  reqEn: string;
  reqVi: string;
}

export const ROLE_INFO: Record<RequestableRole, RoleInfo> = {
  Reviewer: {
    icon: Award,
    descEn:
      'Evaluate research submissions, conduct peer reviews, and verify academic standards.',
    descVi:
      'Đánh giá các bài báo nghiên cứu, thực hiện phản biện học thuật và thẩm định tiêu chuẩn.',
    reqEn:
      'Upload a PDF summarizing your academic background, areas of expertise, and peer review history.',
    reqVi:
      'Tải lên tài liệu PDF lý lịch học thuật, chuyên môn nghiên cứu hoặc kinh nghiệm phản biện.',
  },
  Lecturer: {
    icon: BookOpen,
    descEn:
      'Mentor student research groups, approve topic proposals, and curate learning materials.',
    descVi:
      'Hướng dẫn các nhóm sinh viên nghiên cứu, phê duyệt đề tài và quản lý tài liệu học tập.',
    reqEn:
      'Upload a PDF verifying your teaching credentials, affiliated faculty, and academic appointment.',
    reqVi:
      'Tải lên tài liệu PDF chứng minh vị trí giảng viên, khoa/trường công tác và chuyên môn giảng dạy.',
  },
  Researcher: {
    icon: ShieldCheck,
    descEn:
      'Author and submit scientific publications, host academic seminars, and link ORCID metrics.',
    descVi:
      'Tác giả và công bố các bài báo khoa học, tổ chức hội thảo và liên kết chỉ số ORCID.',
    reqEn:
      'Upload a PDF profile with your publications, citation record, and verified academic identity.',
    reqVi:
      'Tải lên PDF hồ sơ công bố khoa học, bài báo đã xuất bản hoặc trích dẫn nghiên cứu.',
  },
  'Graduate Student': {
    icon: GraduationCap,
    descEn:
      'Join student research groups, complete milestone reports, and collaborate on topics.',
    descVi:
      'Tham gia các nhóm nghiên cứu, hoàn thành báo cáo tiến độ các giai đoạn và bảo vệ đề tài.',
    reqEn:
      'Upload proof of current enrollment, academic transcript, or advisor recommendation letter.',
    reqVi:
      'Tải lên thẻ học viên / sinh viên, giấy xác nhận đào tạo hoặc thư giới thiệu của giảng viên hướng dẫn.',
  },
};

/** Pick the description string for the active locale. */
export const roleDescription = (
  role: RequestableRole,
  isVi: boolean,
): string => {
  const info = ROLE_INFO[role];
  if (!info) return '';
  return isVi ? info.descVi : info.descEn;
};

/** Pick the verification-requirement string for the active locale. */
export const roleVerificationRequirement = (
  role: RequestableRole,
  isVi: boolean,
): string => {
  const info = ROLE_INFO[role];
  if (!info) return '';
  return isVi ? info.reqVi : info.reqEn;
};

export default ROLE_INFO;
