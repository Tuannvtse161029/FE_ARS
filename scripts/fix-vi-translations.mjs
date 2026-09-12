// One-off fix script to translate VI dictionary entries that are still in English.
// Run with: node scripts/fix-vi-translations.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const viPath = path.join(root, 'src/i18n/dictionaries/vi.ts');
const enPath = path.join(root, 'src/i18n/dictionaries/en.ts');

// Map of VI keys to their new Vietnamese translation.
// Keys use single-quote-escaped strings (the dictionaries are .ts files).
const viFixes = {
  // ── Generic pagination / labels ─────────────────────────────────────
  'common.nextPage': 'Trang tiếp',
  'admin.roleRequests.table.orcid': 'Mã ORCID',
  'orcid.brandAria': 'Mã ORCID',
  'admin.dashboard.metric.revenue': 'Doanh thu',
  'admin.annualFees.pagination.page': 'Trang {page}',
  'admin.annualFees.form.namePlace': 'Phí hàng năm của nhà nghiên cứu',
  'admin.orcid.person.id': 'Mã ORCID',
  'verify.otpSuccess.onFile': 'trong hệ thống',
  'verify.otpSuccess.lede2':
    'đã được xác minh. Đang đưa bạn quay lại trang đăng nhập để bạn có thể truy cập tài khoản sau khi quản trị viên xét duyệt.',
  'verify.otp.lede1': 'Chúng tôi đã gửi mã gồm 6 chữ số đến',
  'verify.otp.yourEmail': 'địa chỉ email của bạn',
  'verify.otp.lede2': 'Nhập mã bên dưới để hoàn tất đăng ký.',
  'verify.otp.resendSuccess': 'Một mã mới gồm 6 chữ số đã được gửi đến email của bạn.',
  'verify.otp.emailLabel': 'Email đã đăng ký',
  'verify.otp.legend': 'Mã sáu chữ số',
  'verify.otp.devSkipCopy2': 'cờ hiệu đang là',
  'verify.otp.devSkipCopy3':
    'trong bản dựng này. Bạn có thể hoàn tất đăng ký mà không cần nhập OTP. Bản chính thức sẽ yêu cầu mã.',
  'verify.otp.resendBtn': 'Gửi lại mã',

  // ── Student phase report ────────────────────────────────────────────
  'student.phaseReport.signInPrompt':
    'Vui lòng đăng nhập để xem và nộp báo cáo nghiên cứu.',
  'student.phaseReport.statusOnTime': 'Đúng hạn',
  'student.phaseReport.breadcrumbWorkspace': 'Không gian cộng tác',
  'student.phaseReport.subtitle':
    'Theo dõi các giai đoạn nghiên cứu của nhóm và nộp báo cáo đúng hạn. Giảng viên sẽ xem xét và phản hồi trực tiếp.',
  'student.phaseReport.leaderTitleIsLeader': 'Bạn là trưởng nhóm',
  'student.phaseReport.leaderTextIsLeader':
    'Bạn có thể nộp báo cáo cho giai đoạn 1 đến 5. Mỗi báo cáo sẽ được gửi đến giảng viên để xét duyệt.',
  'student.phaseReport.leaderTextNotLeaderWithMember':
    '{name} chịu trách nhiệm nộp báo cáo. Liên hệ họ hoặc giảng viên nếu cần thay đổi trưởng nhóm.',
  'student.phaseReport.leaderTextNotLeaderNoMember':
    'Yêu cầu giảng viên chỉ định một trưởng nhóm trước khi nhóm có thể nộp báo cáo mốc.',
  'student.phaseReport.unassignedTopic': 'Đề tài chưa được phân công',
  'student.phaseReport.infoGroup': 'Nhóm nghiên cứu',
  'student.phaseReport.infoDeadline': 'Hạn chót dự án',
  'student.phaseReport.noDeadline': 'Chưa đặt hạn chót',
  'student.phaseReport.milestonesTitle': 'Các mốc báo cáo giai đoạn',
  'student.phaseReport.milestonesEmpty':
    'Giảng viên của bạn chưa cấu hình mốc giai đoạn nào cho đề tài này. Hãy yêu cầu họ thiết lập mốc để nhóm bắt đầu nộp báo cáo.',
  'student.phaseReport.submittedAt': 'Đã nộp lúc',
  'student.phaseReport.submittedFile': 'Tệp báo cáo đã nộp:',
  'student.phaseReport.viewPdf': 'Xem PDF',
  'student.phaseReport.phaseComplete': 'Hoàn thành giai đoạn',

  // ── Landing page ────────────────────────────────────────────────────
  'landing.boundary1': 'Chỉ nghiên cứu công khai đã được phê duyệt mới hiển thị trong danh mục.',
  'landing.boundary3':
    'Nhận xét phản biện riêng tư, điểm số và ghi chú hành chính chỉ nằm trong không gian làm việc được ủy quyền.',
  'landing.faq1Q': 'ARS là gì?',
  'landing.faq1A':
    'Academic Research System (ARS) là nền tảng học thuật theo vai trò phục vụ khám phá nghiên cứu, nộp và phản biện bài báo, tổ chức hội thảo, hợp tác và không gian làm việc học thuật.',
  'landing.faq2Q': 'Ai quyết định việc nghiên cứu được xuất bản?',
  'landing.faq2A':
    'Quản trị viên đưa ra quyết định xuất bản cuối cùng. Người phản biện cung cấp khuyến nghị như một phần của quy trình đó.',
  'landing.faq3Q': 'Điều gì trở nên công khai?',
  'landing.faq3A':
    'Chỉ những nghiên cứu vừa được phê duyệt vừa công khai mới thuộc về danh mục nghiên cứu. Nội dung phản biện nội bộ không công khai.',
  'landing.flowResearcherAction': 'Nộp bài báo lên ARS để xét duyệt.',
  'landing.flowResearcherNote': 'không thể tự chọn người phản biện',
  'landing.flowAdminScreenAction': 'Sàng lọc bài nộp và chỉ định người phản biện phù hợp.',
  'landing.flowReviewerAction': 'Đánh giá bài báo và đưa ra khuyến nghị.',
  'landing.flowReviewerNote': 'khuyến nghị, không xuất bản',
  'landing.flowAdminDecideAction': 'Đưa ra quyết định xuất bản cuối cùng.',
  'landing.skipToContent': 'Chuyển đến nội dung chính',
  'landing.brandAria': 'Trang chủ Academic Research Sharing',
  'landing.brandName': 'Academic Research Sharing',
  'landing.navAria': 'Điều hướng trang chủ',
  'landing.navWorkflow': 'Quy trình biên tập',
  'landing.navBoundaries': 'Quyền truy cập công khai',
  'landing.dossierTitle': 'Hồ sơ biên tập ARS',
  'landing.dossierHeading': 'Xuất bản là một quy trình có quản trị.',
  'landing.dossierBody':
    'ARS tách biệt trách nhiệm biên tập khỏi khuyến nghị học thuật, để đường đi đến khám phá công khai luôn có thể kiểm toán được.',
  'landing.dossierResearcherBody': 'Nộp bài và theo dõi quá trình.',
  'landing.dossierReviewerBody': 'Đánh giá và khuyến nghị.',
  'landing.dossierAdminBody': 'Kiểm soát quyết định cuối cùng.',
  'landing.statementAria': 'Mục đích của ARS',
  'landing.statementKicker': 'Nền tảng',
  'landing.statementTitle': 'Nghiên cứu xứng đáng hơn một nơi chỉ để tải lên.',
  'landing.statementBody':
    'ARS gói gọn khám phá nghiên cứu, nộp và phản biện bài báo, hội thảo, hợp tác và không gian làm việc theo vai trò vào một môi trường học thuật duy nhất. Danh mục công khai của nó chỉ dành cho những nghiên cứu đã hoàn tất quy trình biên tập.',
  'landing.workflowKicker': 'Hồ sơ biên tập',
  'landing.workflowHeading': '{count} giai đoạn. Trách nhiệm rõ ràng ở từng bước.',
  'landing.flowAria': 'Sơ đồ luồng quyết định xuất bản',
  'landing.flowKicker': 'Thẩm quyền quyết định',
  'landing.boundariesKicker': 'Quyền truy cập công khai, được xác định rõ ràng',
  'landing.boundariesHeading':
    'Danh mục chỉ hiển thị công trình công khai đã được phê duyệt, không phải công việc riêng tư đằng sau nó.',
  'landing.workspacesHeading': 'Một nền tảng chung với trách nhiệm rõ ràng cho từng vai trò.',
  'landing.faqKicker': 'Đọc trước khi bắt đầu',
  'landing.faqHeading': 'Bối cảnh thiết yếu cho nền tảng ARS.',
  'landing.footerNavAria': 'Điều hướng chân trang',
  'landing.workspace.noAccount': 'Chưa có tài khoản?',

  // ── Login ───────────────────────────────────────────────────────────
  'login.roleSelection.continueAs': 'Tiếp tục với vai trò',
  'login.googleError':
    'Đăng nhập Google thất bại. Vui lòng thử lại hoặc dùng tùy chọn email & mật khẩu.',
  'login.hidePassword': 'Ẩn mật khẩu',
  'login.showPassword': 'Hiện mật khẩu',
  'login.roleHint':
    'Bạn có nhiều vai trò? Chọn vai trò tại đây. Bạn có thể đăng xuất và chuyển vai trò bất cứ lúc nào.',
  'login.signInAsRole': 'Đăng nhập với vai trò',
  'login.optional': 'tùy chọn',
  'login.autoDetectRole': 'Tự động nhận vai trò (mặc định)',

  // ── Register ────────────────────────────────────────────────────────
  'register.dropzone.removeLabel': 'aria-label="Xóa PDF đã tải lên"',
  'register.dropzone.uploading': 'Đang tải lên... {progress}%',
  'register.policy.privacy1.title': '1. Thông tin chúng tôi thu thập',
  'register.policy.privacy1.desc':
    'Khi bạn đăng ký và sử dụng Academic Research Sharing (ARS), chúng tôi thu thập các loại thông tin sau:',
  'register.policy.privacy1.l2.strong': 'Thông tin học thuật:',
  'register.policy.privacy1.l3.strong': 'Tài liệu xác minh:',
  'register.policy.privacy1.l3.text':
    'Hồ sơ học thuật dạng PDF, giấy chứng nhận sinh viên, hoặc bằng chứng bổ nhiệm giảng viên được tải lên để xác minh danh tính.',
  'register.policy.privacy2.title': '2. Cách chúng tôi sử dụng dữ liệu của bạn',
  'register.policy.privacy2.desc': 'Dữ liệu của bạn chỉ được sử dụng cho các mục đích nền tảng sau:',
  'register.policy.privacy2.l1':
    'Xác minh tính xác thực học thuật và phê duyệt các vai trò kinh doanh được yêu cầu.',
  'register.policy.privacy2.l2':
    'Hỗ trợ phân công phản biện mù dựa trên chuyên môn học thuật đã được xác minh.',
  'register.policy.privacy2.l3':
    'Gửi thông báo quan trọng liên quan đến phản biện bài báo, đánh giá mốc và cập nhật tài khoản.',
  'register.policy.privacy2.l4':
    'Bảo vệ tài sản nghiên cứu học thuật và ngăn chặn các bài nộp gian lận.',
  'register.policy.privacy3.title': '3. Lưu trữ & Bảo mật tài liệu',
  'register.policy.privacy3.desc':
    'Tất cả các PDF xác minh và bản thảo nhạy cảm được tải lên được lưu trữ trong bộ nhớ đám mây được mã hóa (Firebase Cloud Storage & Azure Secure Blobs). Chỉ có Quản trị viên Nền tảng đã xác minh mới có quyền truy cập hạn chế để kiểm tra các bằng chứng xác minh trong quá trình xét duyệt tài khoản.',
  'register.policy.terms1.title': '1. Liêm chính & Đạo đức học thuật',
  'register.policy.terms1.desc':
    'Bằng việc tạo tài khoản trên ARS, bạn đồng ý tuân thủ các chuẩn mực đạo đức khoa học quốc tế:',
  'register.policy.terms1.l1':
    'Mọi nghiên cứu, báo cáo đánh giá và tài liệu hội thảo được nộp phải là nguyên bản và không đạo văn.',
  'register.policy.terms1.l2':
    'Việc giả mạo danh xưng, bằng cấp học thuật hoặc danh tính ORCID là cơ sở để chấm dứt tài khoản ngay lập tức.',
  'register.policy.terms2.title': '2. Vai trò & Trách nhiệm trên nền tảng',
  'register.policy.terms2.l1.text':
    'Chịu trách nhiệm về tính chính xác của siêu dữ liệu, tính toàn vẹn trích dẫn và việc phân phối bản in trước có đạo đức.',
  'register.policy.terms2.l2.text':
    'Bị ràng buộc bởi tính bảo mật nghiêm ngặt. Nội dung bản thảo không được chia sẻ, sao chép hoặc sử dụng trước khi xuất bản chính thức.',
  'register.policy.terms2.l3.text':
    'Có nghĩa vụ duy trì các báo cáo mốc, nhật ký giám sát và tài liệu hội thảo chính xác.',
  'register.policy.terms4.title': '4. Chấm dứt & Cập nhật chính sách',
  'register.policy.terms4.desc':
    'ARS bảo lưu quyền đình chỉ hoặc chấm dứt các tài khoản vi phạm bảo mật phản biện, đăng nội dung lạm dụng hoặc vi phạm tiêu chuẩn nghiên cứu học thuật.',
  'register.policy.agree': 'Tôi hiểu và đồng ý',
  'register.samplePdf.title': 'Tài liệu xác minh PDF mẫu',
  'register.samplePdf.watermark': 'TÀI LIỆU XÁC MINH MẪU',
  'register.samplePdf.orcidId': 'Mã ORCID',
  'register.samplePdf.metrics': 'Chỉ số học thuật',
  'register.samplePdf.recordReviewer': 'Hồ sơ dịch vụ phản biện',
  'register.samplePdf.recordLecturer': 'Hồ sơ giảng dạy & chương trình',
  'register.samplePdf.recordGraduate': 'Hồ sơ học thuật & nghiên cứu',
  'register.samplePdf.recordResearcher': 'Hồ sơ xuất bản',
  'register.samplePdf.backBtn': 'Đã hiểu, quay lại đăng ký',
  'register.passwordPlaceholder': 'Tạo mật khẩu',

  // ── Reset password ──────────────────────────────────────────────────
  'reset.errorSend': 'Không thể gửi mã đặt lại. Vui lòng thử lại.',
  'reset.sentCode': 'Chúng tôi đã gửi mã đến',
  'reset.successMessage': 'Đặt lại mật khẩu thành công! Đang chuyển hướng đến đăng nhập...',
  'reset.errorReset': 'Không thể đặt lại mật khẩu. Vui lòng thử lại.',
  'reset.subtitleNewPassword':
    'Đặt mật khẩu mới cho tài khoản của bạn. Hãy đảm bảo nó có ít nhất 8 ký tự.',
  'reset.newPasswordPlaceholder': 'Nhập mật khẩu mới',
  'reset.passwordHint':
    'Mật khẩu phải có ít nhất 8 ký tự, bao gồm một chữ cái viết hoa và một chữ số.',
  'reset.confirmPasswordPlaceholder': 'Nhập lại mật khẩu mới',
  'reset.resetButton': 'Đặt lại mật khẩu',
  'reset.reenterCode': 'Nhập lại mã',
  'reset.errorInvalidCode': 'Mã không hợp lệ. Vui lòng thử lại.',
  'reset.errorResendCode': 'Không thể gửi lại mã. Vui lòng thử lại.',
  'reset.checkEmail': 'Kiểm tra email của bạn',
  'reset.sentCodeTo': 'Chúng tôi đã gửi mã xác minh gồm 6 chữ số đến',
  'reset.enterCodeBelow': 'Nhập mã bên dưới để tiếp tục.',
  'reset.verificationCodeLabel': 'Mã xác minh',
  'reset.didNotReceive': 'Chưa nhận được mã?',

  // ── Admin dashboard + researcher detail ─────────────────────────────
  'admin.dashboard.revenue': 'Doanh thu',
  'home.catalog.pagination.nextAria': 'Trang tiếp theo của danh mục',
  'researcher.detail.identifiers.openAlex': 'Mã OpenAlex',
  'researcher.form.openalex.attribution': 'qua OpenAlex',
  'researcher.form.openalex.label.workId': 'Mã công trình',

  // ── Reviewer criterion + lecturer pagination ────────────────────────
  'reviewer.detail.criterion.anchor': '{value} — {label}',
  'lecturer.groupDetail.inviteNextPage': 'Tiếp theo',
  'lecturer.groupDetail.invitePageIndicator': 'Trang {page} / {total}',
  'lecturer.materials.shared.gapBanner.field':
    'SharedMaterial.learningMaterialId, trạng thái enum, hạn sử dụng',

  // ── Admin medals + accounts + profile chip ──────────────────────────
  'admin.medals.recipients.typeManual': 'Quản trị viên trao',
  'admin.accounts.modal.viewProfile.orcid': 'Mã ORCID',
  'admin.accounts.modal.viewProfile.emailVerifiedShort': 'Email đã xác minh',
  'profile.publicView.gradStudent.chip': 'HỌC VIÊN CAO HỌC',

  // ── Auth helpers ────────────────────────────────────────────────────
  'auth.noAccount': 'Chưa có tài khoản?',
};

// Map of EN keys (16 missing entries that only exist in VI).
const enAdditions = {
  'notif.errorLoad': 'Unable to load notifications',
  'notif.caughtUp': "You're all caught up",
  'landing.workspace.noAccount': "Don't have an account?",
  'student.phaseReport.infoNoGroup':
    "You haven't joined any research group yet. When a Lecturer adds you to a group, you'll be able to submit phase reports.",
  'forum.report.reasonPlaceholder':
    'Describe why you are reporting this content (at least 10 characters)…',
  'forum.report.errorTitle': 'Could not submit report',
  'reset.didNotReceive': "Didn't receive the code?",
  'admin.policies.description':
    'Edit the platform legal texts — Privacy Policy and Terms of Service.',
  'admin.policies.refreshing': 'Refreshing…',
  'admin.policies.loading': 'Loading policies from Firebase…',
  'admin.policies.neverUpdated':
    'Never saved — showing the default content.',
  'admin.policies.modal.notSavedYet':
    'No saved version in Firebase yet — the first save will create v1.',
  'admin.policies.modal.saving': 'Saving…',
  'admin.contentReports.modal.descDeleteSuspend':
    'Delete the offending content and suspend the author’s account for 14 days. Both actions will be recorded.',
  'auth.noAccount': "Don't have an account?",
  'reviewer.detail.final.privateCommentsPlaceholder':
    'Summarize the manuscript’s contribution, key concerns, revision requests, and supporting evidence.',
};

// Apply VI replacements
let viRaw = fs.readFileSync(viPath, 'utf8');
let enRaw = fs.readFileSync(enPath, 'utf8');

const escapeForSingleQuoted = (s) =>
  // Escape backslash first, then single quote, then newlines/CR
  s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');

let viReplacedCount = 0;
let viNotFound = [];
for (const [key, value] of Object.entries(viFixes)) {
  const escaped = escapeForSingleQuoted(value);
  // Match `key: '...'` allowing internal escapes and newlines
  const pattern = new RegExp(
    `('${key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}':\\s*)'(?:[^'\\\\\\n]|\\\\.)*'`,
    's',
  );
  if (pattern.test(viRaw)) {
    viRaw = viRaw.replace(pattern, `$1'${escaped}'`);
    viReplacedCount++;
  } else {
    viNotFound.push(key);
  }
}

let enAddedCount = 0;
let enNotFound = [];
for (const [key, value] of Object.entries(enAdditions)) {
  const escaped = escapeForSingleQuoted(value);
  // Skip if EN already has the key
  const hasPattern = new RegExp(
    `'${key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}':`,
  );
  if (hasPattern.test(enRaw)) {
    enNotFound.push(`ALREADY-HAS: ${key}`);
    continue;
  }
  // Find the closing brace of `export const dictionary` and insert before
  // it as a new entry.
  const newEntry = `    '${key}': '${escaped}',\n`;
  // Insert just before the LAST `};` in the file
  const lastSemicolon = enRaw.lastIndexOf('};');
  if (lastSemicolon === -1) {
    enNotFound.push(`NO-CLOSING: ${key}`);
    continue;
  }
  enRaw = enRaw.slice(0, lastSemicolon) + newEntry + enRaw.slice(lastSemicolon);
  enAddedCount++;
}

fs.writeFileSync(viPath, viRaw);
fs.writeFileSync(enPath, enRaw);

console.log(`VI replacements applied: ${viReplacedCount} / ${Object.keys(viFixes).length}`);
if (viNotFound.length > 0) {
  console.log('VI keys NOT found in dictionary:');
  viNotFound.forEach((k) => console.log('  -', k));
}
console.log(`EN additions applied: ${enAddedCount} / ${Object.keys(enAdditions).length}`);
if (enNotFound.length > 0) {
  console.log('EN additions NOT applied:');
  enNotFound.forEach((k) => console.log('  -', k));
}
