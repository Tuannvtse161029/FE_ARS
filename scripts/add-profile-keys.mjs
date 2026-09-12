// Add new dictionary keys for hardcoded strings being fixed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const viPath = path.join(root, 'src/i18n/dictionaries/vi.ts');
const enPath = path.join(root, 'src/i18n/dictionaries/en.ts');

// New keys to add (key -> { en, vi })
const additions = {
  // AuthLayout
  'authLayout.mastheadLabel': {
    en: 'ARS — Academic Research Sharing',
    vi: 'ARS — Academic Research Sharing',
  },
  'authLayout.heading': {
    en: 'Where research is read, written, and reviewed.',
    vi: 'Nơi nghiên cứu được đọc, viết và phản biện.',
  },
  'authLayout.caption': {
    en: 'A working desk for researchers, reviewers, lecturers, and graduate students.',
    vi: 'Một không gian làm việc cho nhà nghiên cứu, người phản biện, giảng viên và học viên cao học.',
  },
  'authLayout.fields': {
    en: 'Science · Humanities · Engineering · Medicine',
    vi: 'Khoa học · Nhân văn · Kỹ thuật · Y học',
  },

  // ORCID identity panel
  'orcid.panel.loading': { en: 'Checking ORCID connection…', vi: 'Đang kiểm tra kết nối ORCID…' },
  'orcid.panel.heading': { en: 'ORCID identity', vi: 'Danh tính ORCID' },
  'orcid.panel.linkedBadge': { en: 'Verified', vi: 'Đã xác minh' },
  'orcid.panel.unlinkedBadge': { en: 'Not connected', vi: 'Chưa kết nối' },
  'orcid.panel.requiredHint': { en: 'A verified ORCID iD is required for Reviewer requests.', vi: 'Mã ORCID đã xác minh là bắt buộc cho yêu cầu Người phản biện.' },
  'orcid.panel.optionalHint': { en: 'An ORCID iD is optional for this role.', vi: 'Mã ORCID là tùy chọn cho vai trò này.' },
  'orcid.panel.detailBody': {
    en: 'ORCID is a third-party identity provider used by researchers worldwide. Click <strong>Connect ORCID iD</strong> below — we will redirect you to the official ORCID site to authorize this connection. ARS never collects ORCID credentials or stores provider tokens in this browser.',
    vi: 'ORCID là nhà cung cấp danh tính bên thứ ba được các nhà nghiên cứu trên toàn thế giới sử dụng. Nhấp <strong>Kết nối ORCID iD</strong> bên dưới — chúng tôi sẽ chuyển hướng bạn đến trang ORCID chính thức để ủy quyền kết nối này. ARS không bao giờ thu thập thông tin đăng nhập ORCID hoặc lưu trữ token của nhà cung cấp trong trình duyệt này.',
  },
  'orcid.panel.viewPublicRecord': { en: 'View public record', vi: 'Xem hồ sơ công khai' },
  'orcid.panel.connectButton': { en: 'Connect ORCID iD', vi: 'Kết nối ORCID iD' },
  'orcid.panel.refreshButton': { en: 'Refresh status', vi: 'Làm mới trạng thái' },
  'orcid.panel.unlinkUnavailable': {
    en: 'Disconnect is unavailable because no backend unlink endpoint is documented.',
    vi: 'Không thể ngắt kết nối vì backend chưa cung cấp endpoint hủy liên kết.',
  },
  'orcid.panel.connectError': {
    en: 'Unable to start ORCID connection. Please try again.',
    vi: 'Không thể bắt đầu kết nối ORCID. Vui lòng thử lại.',
  },

  // Profile page (the role-specific eyebrow, title, subtitle that came from ROLE_PROFILE_META)
  'profile.eyebrow.researcher': { en: 'RESEARCHER WORKSPACE', vi: 'KHÔNG GIAN NGHIÊN CỨU SINH' },
  'profile.title.researcher': { en: 'Researcher Profile', vi: 'Hồ sơ Nhà nghiên cứu' },
  'profile.subtitle.researcher': {
    en: 'Public profile shown to reviewers, researchers, and students who discover your work.',
    vi: 'Hồ sơ công khai hiển thị cho người phản biện, nhà nghiên cứu và sinh viên khi họ khám phá công trình của bạn.',
  },
  'profile.eyebrow.reviewer': { en: 'REVIEWER WORKSPACE', vi: 'KHÔNG GIAN NGƯỜI PHẢN BIỆN' },
  'profile.title.reviewer': { en: 'Reviewer Profile', vi: 'Hồ sơ Người phản biện' },
  'profile.subtitle.reviewer': {
    en: 'Identity surface visible to researchers when you accept or decline review invitations.',
    vi: 'Bề mặt danh tính hiển thị cho nhà nghiên cứu khi bạn chấp nhận hoặc từ chối lời mời phản biện.',
  },
  'profile.eyebrow.lecturer': { en: 'LECTURER WORKSPACE', vi: 'KHÔNG GIAN GIẢNG VIÊN' },
  'profile.title.lecturer': { en: 'Lecturer Profile', vi: 'Hồ sơ Giảng viên' },
  'profile.subtitle.lecturer': {
    en: 'Profile visible to students in your research groups and to admin moderation surfaces.',
    vi: 'Hồ sơ hiển thị cho sinh viên trong các nhóm nghiên cứu của bạn và cho giao diện kiểm duyệt của quản trị viên.',
  },
  'profile.eyebrow.graduateStudent': { en: 'GRADUATE STUDENT WORKSPACE', vi: 'KHÔNG GIAN HỌC VIÊN CAO HỌC' },
  'profile.title.graduateStudent': { en: 'Graduate Student Profile', vi: 'Hồ sơ Học viên cao học' },
  'profile.subtitle.graduateStudent': {
    en: 'Profile visible to your research group, supervisor, and academic moderators.',
    vi: 'Hồ sơ hiển thị cho nhóm nghiên cứu, người giám sát và người kiểm duyệt học thuật của bạn.',
  },
  'profile.eyebrow.admin': { en: 'ADMIN WORKSPACE', vi: 'KHÔNG GIAN QUẢN TRỊ' },
  'profile.title.admin': { en: 'Admin Profile', vi: 'Hồ sơ Quản trị viên' },
  'profile.subtitle.admin': {
    en: 'Administrative identity surface visible across the platform.',
    vi: 'Bề mặt danh tính hành chính hiển thị trên toàn nền tảng.',
  },
  'profile.eyebrow.publicShowcase': { en: 'Professional Showcase', vi: 'Hồ sơ học thuật công khai' },
  'profile.title.publicDescription': {
    en: 'Public academic presence with the profile details this member has chosen to share.',
    vi: 'Sự hiện diện học thuật công khai với các chi tiết hồ sơ mà thành viên này chọn chia sẻ.',
  },
  'profile.view.yourProfile': { en: 'Your profile', vi: 'Hồ sơ của bạn' },
  'profile.view.publicBreadcrumbSuffix': { en: "'s Profile", vi: "'s Hồ sơ" },

  // Profile view (form labels and field labels)
  'profile.view.title': { en: 'Profile details', vi: 'Chi tiết hồ sơ' },
  'profile.view.subtitle': {
    en: 'The information other users see across the ARS platform.',
    vi: 'Thông tin mà người dùng khác thấy trên toàn nền tảng ARS.',
  },
  'profile.view.emptyHint': {
    en: 'You haven\u2019t filled out your profile yet — use "Edit profile" to get started.',
    vi: 'Bạn chưa điền hồ sơ — hãy dùng "Chỉnh sửa hồ sơ" để bắt đầu.',
  },
  'profile.view.notSet': { en: 'Not set', vi: 'Chưa thiết lập' },
  'profile.view.dash': { en: '—', vi: '—' },
  'profile.view.avatarInitials': { en: 'Avatar initials', vi: 'Chữ cái đại diện' },
  'profile.view.fullName': { en: 'Full name', vi: 'Họ và tên' },
  'profile.view.academicTitle': { en: 'Academic title', vi: 'Học hàm / học vị' },
  'profile.view.institution': { en: 'Institution', vi: 'Cơ quan' },
  'profile.view.phone': { en: 'Phone number', vi: 'Số điện thoại' },
  'profile.view.dob': { en: 'Date of birth', vi: 'Ngày sinh' },
  'profile.view.gender': { en: 'Gender', vi: 'Giới tính' },
  'profile.view.address': { en: 'Address', vi: 'Địa chỉ' },
  'profile.view.bio': { en: 'Bio', vi: 'Tiểu sử' },
  'profile.view.bioEmpty': { en: 'No bio yet.', vi: 'Chưa có tiểu sử.' },
  'profile.view.keywords': { en: 'Research interest keywords', vi: 'Từ khóa lĩnh vực nghiên cứu' },
  'profile.view.keywordsEmpty': { en: 'No keywords yet.', vi: 'Chưa có từ khóa.' },
  'profile.view.metricsTitle': { en: 'Academic & Research Metrics', vi: 'Chỉ số học thuật & nghiên cứu' },
  'profile.view.hIndex': { en: 'H-Index', vi: 'Chỉ số H' },
  'profile.view.citations': { en: 'Citations', vi: 'Trích dẫn' },
  'profile.view.publications': { en: 'Publications', vi: 'Xuất bản' },
  'profile.view.researchField': { en: 'Research Field', vi: 'Lĩnh vực nghiên cứu' },
  'profile.view.lastUpdated': { en: 'Last updated', vi: 'Cập nhật lần cuối' },

  // Profile edit form
  'profile.edit.title': { en: 'Edit your profile', vi: 'Chỉnh sửa hồ sơ' },
  'profile.edit.subtitle': {
    en: 'Update the fields below. Only the fields you change are sent to the server.',
    vi: 'Cập nhật các trường bên dưới. Chỉ các trường bạn thay đổi được gửi đến máy chủ.',
  },
  'profile.edit.requiredTag': { en: '(required)', vi: '(bắt buộc)' },
  'profile.edit.avatarInitialsExample': { en: 'e.g. ND', vi: 'ví dụ: ND' },
  'profile.edit.institutionPlaceholder': { en: '+84 …', vi: '+84 …' },
  'profile.edit.keywordPlaceholder': { en: 'Type a keyword and press Enter', vi: 'Nhập từ khóa và nhấn Enter' },
  'profile.edit.keywordAdd': { en: 'Add', vi: 'Thêm' },
  'profile.edit.keywordsEmpty': {
    en: 'No keywords yet. Add a few to help researchers find your work.',
    vi: 'Chưa có từ khóa. Hãy thêm vài từ để giúp nhà nghiên cứu tìm thấy công trình của bạn.',
  },
  'profile.edit.removeKeywordAria': { en: 'Remove keyword {keyword}', vi: 'Xóa từ khóa {keyword}' },
  'profile.edit.formActionsHint.invalid': { en: 'Fix the highlighted fields to continue.', vi: 'Sửa các trường được đánh dấu để tiếp tục.' },
  'profile.edit.formActionsHint.unsaved': { en: 'Unsaved changes.', vi: 'Có thay đổi chưa lưu.' },
  'profile.edit.formActionsHint.unchanged': { en: 'No changes to save.', vi: 'Không có thay đổi để lưu.' },
  'profile.edit.cancel': { en: 'Cancel', vi: 'Hủy' },
  'profile.edit.save': { en: 'Save changes', vi: 'Lưu thay đổi' },

  // Profile other
  'profile.profileUpdated': { en: 'Profile updated', vi: 'Đã cập nhật hồ sơ' },
  'profile.profileUpdatedMessage': {
    en: 'Your academic profile is saved. Other users will see the updated details on your next interaction.',
    vi: 'Hồ sơ học thuật của bạn đã được lưu. Người dùng khác sẽ thấy các chi tiết đã cập nhật ở lần tương tác sau.',
  },
  'profile.saveErrorTitle': { en: "We couldn't save your changes", vi: 'Chúng tôi không thể lưu thay đổi của bạn' },
  'profile.refreshErrorTitle': { en: 'Refresh failed', vi: 'Làm mới thất bại' },
  'profile.refreshErrorMessage': { en: 'Showing the last cached profile. {message}', vi: 'Đang hiển thị hồ sơ đã lưu gần nhất. {message}' },
  'profile.authRequired.eyebrow': { en: 'Authentication required', vi: 'Yêu cầu xác thực' },
  'profile.authRequired.title': { en: 'Sign in to view your profile', vi: 'Đăng nhập để xem hồ sơ' },
  'profile.authRequired.description': {
    en: 'Your academic profile is private and only available once you have signed in. Please return to the sign-in page and authenticate to continue.',
    vi: 'Hồ sơ học thuật của bạn là riêng tư và chỉ khả dụng sau khi bạn đăng nhập. Vui lòng quay lại trang đăng nhập để xác thực và tiếp tục.',
  },
  'profile.unavailable.title': { en: 'Profile unavailable', vi: 'Hồ sơ không khả dụng' },
  'profile.unavailable.description': { en: 'Authenticate to continue.', vi: 'Vui lòng xác thực để tiếp tục.' },
  'profile.breadcrumbHome': { en: 'Home', vi: 'Trang chủ' },
  'profile.breadcrumbActive': { en: 'Profile', vi: 'Hồ sơ' },
  'profile.breadcrumbOwnSettings': { en: 'Profile & Account Settings', vi: 'Hồ sơ & Cài đặt tài khoản' },
  'profile.eyebrow': { en: 'Profile', vi: 'Hồ sơ' },
  'profile.loadingDescription': {
    en: 'Fetching the latest profile information from the ARS platform.',
    vi: 'Đang tải thông tin hồ sơ mới nhất từ nền tảng ARS.',
  },
  'profile.loadErrorTitle': { en: "Couldn't load profile", vi: 'Không thể tải hồ sơ' },
  'profile.retry': { en: 'Retry', vi: 'Thử lại' },
  'profile.roleBadgeMember': { en: 'Member', vi: 'Thành viên' },
  'profile.emptyBadge': { en: 'Profile not yet configured', vi: 'Hồ sơ chưa được thiết lập' },
  'profile.viewFollowersTitle': { en: 'View your followers', vi: 'Xem những người theo dõi bạn' },
  'profile.viewFollowingTitle': { en: 'View people you follow', vi: 'Xem những người bạn theo dõi' },
  'profile.followers': { en: 'Followers', vi: 'Người theo dõi' },
  'profile.following': { en: 'Following', vi: 'Đang theo dõi' },
  'profile.follow': { en: '+ Follow', vi: '+ Theo dõi' },
  'profile.followingBadge': { en: 'Following', vi: 'Đang theo dõi' },
  'profile.editButton': { en: 'Edit profile', vi: 'Chỉnh sửa hồ sơ' },
  'profile.refresh': { en: 'Refresh', vi: 'Làm mới' },
  'profile.refreshing': { en: 'Refreshing…', vi: 'Đang làm mới…' },
  'profile.requestPending': { en: 'Role request pending', vi: 'Yêu cầu vai trò đang chờ' },
  'profile.requestRole': { en: 'Request additional role', vi: 'Yêu cầu thêm vai trò' },
  'profile.requestRoleSuccess': {
    en: 'Your request to add role has been submitted and is pending administrator review.',
    vi: 'Yêu cầu thêm vai trò của bạn đã được gửi và đang chờ quản trị viên xét duyệt.',
  },
  'profile.validation.fullNameTooLong': { en: 'Please keep your full name under {max} characters.', vi: 'Vui lòng giữ họ và tên dưới {max} ký tự.' },
  'profile.validation.academicTitleTooLong': { en: 'Please keep the title under {max} characters.', vi: 'Vui lòng giữ học hàm dưới {max} ký tự.' },
  'profile.validation.phoneTooLong': { en: 'Please keep the phone number under {max} characters.', vi: 'Vui lòng giữ số điện thoại dưới {max} ký tự.' },
  'profile.validation.phoneFormat': { en: 'Use digits, spaces, dashes, parentheses, or a leading +.', vi: 'Sử dụng chữ số, dấu cách, dấu gạch ngang, dấu ngoặc đơn hoặc bắt đầu bằng +.' },
  'profile.validation.institutionTooLong': { en: 'Please keep the institution under {max} characters.', vi: 'Vui lòng giữ tên cơ quan dưới {max} ký tự.' },
  'profile.validation.bioTooLong': { en: 'Please keep the bio under {max} characters.', vi: 'Vui lòng giữ tiểu sử dưới {max} ký tự.' },
  'profile.validation.addressTooLong': { en: 'Please keep the address under {max} characters.', vi: 'Vui lòng giữ địa chỉ dưới {max} ký tự.' },
  'profile.validation.keywordsTooMany': { en: 'Please keep at most {max} keywords.', vi: 'Vui lòng giữ tối đa {max} từ khóa.' },
  'profile.validation.keywordTooLong': { en: 'Each keyword must be under {max} characters.', vi: 'Mỗi từ khóa phải dưới {max} ký tự.' },
  'profile.validation.avatarInitialsInvalid': { en: 'Up to 4 letters or digits, please.', vi: 'Tối đa 4 chữ cái hoặc chữ số.' },

  // Account contact strip (the dl > dt > dd pairs)
  'profile.accountContact.email': { en: 'Email', vi: 'Email' },
  'profile.accountContact.phone': { en: 'Phone', vi: 'Điện thoại' },
  'profile.accountContact.address': { en: 'Address', vi: 'Địa chỉ' },
  'profile.accountContact.dob': { en: 'Date of birth', vi: 'Ngày sinh' },
  'profile.accountContact.gender': { en: 'Gender', vi: 'Giới tính' },
  'profile.edit.institutionLabel': { en: 'Institution / University', vi: 'Cơ quan / Trường đại học' },
  'profile.edit.bioLabel': { en: 'Biography', vi: 'Tiểu sử' },
  'profile.edit.phonePlaceholder': { en: '+84 …', vi: '+84 …' },
};

// Apply to both files
function escapeForSingleQuoted(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
}

let vi = fs.readFileSync(viPath, 'utf8');
let en = fs.readFileSync(enPath, 'utf8');

let addedVi = 0, addedEn = 0;
const skippedVi = [], skippedEn = [];

for (const [key, { en: enVal, vi: viVal }] of Object.entries(additions)) {
  // VI
  const viPattern = new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':`);
  if (!viPattern.test(vi)) {
    const escaped = escapeForSingleQuoted(viVal);
    const lastSemi = vi.lastIndexOf('};');
    if (lastSemi !== -1) {
      vi = vi.slice(0, lastSemi) + `    '${key}': '${escaped}',\n` + vi.slice(lastSemi);
      addedVi++;
    } else {
      skippedVi.push(key);
    }
  } else {
    skippedVi.push(`EXISTS: ${key}`);
  }
  // EN
  const enPattern = new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':`);
  if (!enPattern.test(en)) {
    const escaped = escapeForSingleQuoted(enVal);
    const lastSemi = en.lastIndexOf('};');
    if (lastSemi !== -1) {
      en = en.slice(0, lastSemi) + `    '${key}': '${escaped}',\n` + en.slice(lastSemi);
      addedEn++;
    } else {
      skippedEn.push(key);
    }
  } else {
    skippedEn.push(`EXISTS: ${key}`);
  }
}

fs.writeFileSync(viPath, vi);
fs.writeFileSync(enPath, en);

console.log(`Added ${addedVi} VI entries, ${addedEn} EN entries`);
if (skippedVi.length > 0) console.log('VI skipped:', skippedVi.length, skippedVi.slice(0, 5));
if (skippedEn.length > 0) console.log('EN skipped:', skippedEn.length, skippedEn.slice(0, 5));
