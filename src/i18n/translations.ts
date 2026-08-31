// Vietnamese (default) and English translation table.
//
// Keys are dot-namespaced by surface area so future contributors can find
// the correct bundle quickly (e.g. `landing.heroTitle`, `forum.toolbarNew`).
//
// Vietnamese (vi) is the default for the platform because the team is based
// in Vietnam. English (en) is the fallback for any UI string that has not
// been translated yet, so a half-localized page still reads sensibly.

export type Locale = 'vi' | 'en';

export const DEFAULT_LOCALE: Locale = 'vi';
export const SUPPORTED_LOCALES: readonly Locale[] = ['vi', 'en'] as const;

export const LOCALE_LABELS: Record<Locale, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  vi: '🇻🇳',
  en: '🇬🇧',
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' &&
  (SUPPORTED_LOCALES as readonly string[]).includes(value);

export type Dictionary = Record<string, string>;

export const dictionaries: Record<Locale, Dictionary> = {
  vi: {
    // ── App shell
    'app.brand': 'ARS',
    'app.tagline': 'Hệ thống Học thuật Nghiên cứu',
    'app.systemName': 'Nền tảng ARS',

    // ── Header & nav
    'nav.home': 'Trang chủ',
    'nav.dashboard': 'Bảng điều khiển',
    'nav.forum': 'Diễn đàn',
    'nav.papers': 'Bài báo',
    'nav.seminars': 'Hội thảo',
    'nav.groups': 'Nhóm',
    'nav.assignments': 'Nhiệm vụ',
    'nav.publication': 'Xuất bản',
    'nav.adminDashboard': 'Bảng điều khiển quản trị',
    'nav.roleRequests': 'Yêu cầu vai trò',
    'nav.accounts': 'Tài khoản',
    'nav.transactions': 'Giao dịch',
    'nav.reports': 'Báo cáo',
    'nav.packages': 'Gói dịch vụ',
    'nav.auditLogs': 'Nhật ký kiểm tra',
    'nav.annualFees': 'Phí hằng năm',
    'nav.contentReports': 'Báo cáo nội dung',
    'nav.profile': 'Hồ sơ',
    'nav.signOut': 'Đăng xuất',
    'nav.signIn': 'Đăng nhập',
    'nav.signUp': 'Đăng ký',
    'nav.expandNav': 'Mở rộng thanh điều hướng',
    'nav.collapseNav': 'Thu gọn thanh điều hướng',

    // ── Theme & language toggles
    'header.themeToLight': 'Chuyển sang giao diện sáng',
    'header.themeToDark': 'Chuyển sang giao diện tối',
    'header.themeLightTitle': 'Chuyển sang Sáng',
    'header.themeDarkTitle': 'Chuyển sang Tối',
    'header.language': 'Ngôn ngữ',
    'header.languageToggle': 'Đổi ngôn ngữ',
    'header.languageMenu': 'Chọn ngôn ngữ',

    // ── Notifications
    'notif.title': 'Thông báo',
    'notif.empty': 'Không có thông báo mới',
    'notif.markAllRead': 'Đánh dấu đã đọc tất cả',

    // ── Profile dropdown
    'profile.view': 'Xem hồ sơ',
    'profile.settings': 'Cài đặt',
    'profile.signOut': 'Đăng xuất',

    // ── Availability toggle (Reviewer)
    'availability.available': 'Sẵn sàng',
    'availability.unavailable': 'Không sẵn sàng',
    'availability.turnOff': 'Tắt trạng thái sẵn sàng',
    'availability.turnOn': 'Bật trạng thái sẵn sàng',

    // ── Landing page
    'landing.metaTitle': 'ARS — Hệ thống Học thuật Nghiên cứu',
    'landing.heroBadge': 'Được tin cậy bởi các nhà nghiên cứu Việt Nam',
    'landing.heroTitle': 'Nơi các nhà nghiên cứu Việt Nam chia sẻ, đánh giá và cùng nhau phát triển khoa học.',
    'landing.heroSubtitle':
      'Khám phá công trình nghiên cứu, tham gia phản biện có cấu trúc, tổ chức hội thảo học thuật và hợp tác theo vai trò — tất cả trong một nền tảng an toàn.',
    'landing.ctaPrimary': 'Bắt đầu miễn phí',
    'landing.ctaSecondary': 'Xem hội thảo',
    'landing.heroStat1Label': 'Bài báo đã xuất bản',
    'landing.heroStat2Label': 'Nhà nghiên cứu đang hoạt động',
    'landing.heroStat3Label': 'Hội thảo đã tổ chức',
    'landing.featuresTitle': 'Mọi thứ nhóm nghiên cứu của bạn cần',
    'landing.featuresSubtitle':
      'Các công cụ có cấu trúc cho phát hiện, đánh giá và hợp tác nghiên cứu — không cần ghép nối nhiều ứng dụng.',
    'landing.feature1Title': 'Khám phá có cấu trúc',
    'landing.feature1Body':
      'Duyệt bài báo theo lĩnh vực, nhóm tác giả và xu hướng. Lưu vào danh sách theo dõi để không bỏ lỡ cập nhật nào.',
    'landing.feature2Title': 'Phản biện đáng tin cậy',
    'landing.feature2Body':
      'Quy trình đánh giá có cấu trúc cho phép phản hồi rõ ràng, lịch sử phiên bản minh bạch và quyết định xuất bản có thể kiểm tra.',
    'landing.feature3Title': 'Hội thảo học thuật',
    'landing.feature3Body':
      'Tạo và quản lý hội thảo, gửi lời mời Google Meet và theo dõi phản hồi của người tham dự — tất cả trong một nơi.',
    'landing.feature4Title': 'Cộng tác theo vai trò',
    'landing.feature4Body':
      'Không gian làm việc riêng cho Giảng viên, Nghiên cứu sinh, Người phản biện và Quản trị viên với quyền hạn rõ ràng.',
    'landing.workflowTitle': 'Quy trình nghiên cứu, xuyên suốt',
    'landing.workflowSubtitle':
      'Từ phát hiện đến xuất bản — mỗi bước đều được kết nối và theo dõi được.',
    'landing.workflowStep1Title': 'Khám phá',
    'landing.workflowStep1Body':
      'Tìm kiếm công trình theo chủ đề, lĩnh vực hoặc từ khoá — không bỏ lỡ bài báo quan trọng.',
    'landing.workflowStep2Title': 'Đánh giá',
    'landing.workflowStep2Body':
      'Phản biện có cấu trúc giúp phản hồi rõ ràng và lịch sử sửa đổi minh bạch.',
    'landing.workflowStep3Title': 'Hợp tác',
    'landing.workflowStep3Body':
      'Mời đồng tác giả, lên lịch hội thảo và thu thập phản hồi trong cùng một không gian.',
    'landing.workflowStep4Title': 'Xuất bản',
    'landing.workflowStep4Body':
      'Xuất bản bài báo với DOI, truyền thông và nhúng trích dẫn — một nền tảng, đầy đủ vòng đời.',
    'landing.testimonialQuote':
      'ARS giúp nhóm nghiên cứu của chúng tôi rút ngắn một nửa thời gian phản biện — phản hồi rõ ràng, không còn email rời rạc.',
    'landing.testimonialName': 'TS. Nguyễn Minh Anh',
    'landing.testimonialRole': 'Trưởng nhóm nghiên cứu, ĐHCN',
    'landing.ctaTitle': 'Sẵn sàng đưa nghiên cứu của bạn lên tầm cao mới?',
    'landing.ctaBody':
      'Tham gia cùng hàng trăm nhà nghiên cứu Việt Nam đang sử dụng ARS để hợp tác, đánh giá và xuất bản.',
    'landing.ctaButton': 'Tạo tài khoản miễn phí',
    'landing.footerAbout': 'Về ARS',
    'landing.footerAboutBody':
      'ARS là nền tảng học thuật tin cậy cho nghiên cứu, phản biện và hợp tác — được xây dựng cho cộng đồng nghiên cứu Việt Nam.',
    'landing.footerProduct': 'Sản phẩm',
    'landing.footerProductForums': 'Diễn đàn',
    'landing.footerProductPapers': 'Bài báo',
    'landing.footerProductSeminars': 'Hội thảo',
    'landing.footerProductGroups': 'Nhóm',
    'landing.footerResources': 'Tài nguyên',
    'landing.footerResourcesDocs': 'Tài liệu',
    'landing.footerResourcesSupport': 'Hỗ trợ',
    'landing.footerResourcesLegal': 'Pháp lý',
    'landing.footerCopy': '© 2026 ARS. Đã đăng ký bản quyền.',

    // ── Auth — common
    'auth.welcomeBack': 'Chào mừng trở lại',
    'auth.welcomeContinue': 'Tiếp tục đăng nhập để truy cập không gian nghiên cứu của bạn.',
    'auth.createAccount': 'Tạo tài khoản',
    'auth.createAccountBody':
      'Tạo tài khoản để bắt đầu khám phá, phản biện và hợp tác nghiên cứu.',
    'auth.fullName': 'Họ và tên',
    'auth.fullNamePlaceholder': 'Nhập họ và tên',
    'auth.email': 'Email',
    'auth.emailPlaceholder': 'you@university.edu.vn',
    'auth.password': 'Mật khẩu',
    'auth.passwordPlaceholder': 'Ít nhất 8 ký tự',
    'auth.confirmPassword': 'Xác nhận mật khẩu',
    'auth.rememberMe': 'Ghi nhớ đăng nhập',
    'auth.forgotPassword': 'Quên mật khẩu?',
    'auth.signInButton': 'Đăng nhập',
    'auth.signUpButton': 'Đăng ký',
    'auth.signingIn': 'Đang đăng nhập…',
    'auth.signingUp': 'Đang đăng ký…',
    'auth.noAccount': 'Chưa có tài khoản?',
    'auth.haveAccount': 'Đã có tài khoản?',
    'auth.signInHere': 'Đăng nhập tại đây',
    'auth.signUpHere': 'Đăng ký tại đây',
    'auth.or': 'hoặc',
    'auth.continueWithGoogle': 'Tiếp tục với Google',
    'auth.signInWithGoogle': 'Đăng nhập bằng Google',
    'auth.signUpWithGoogle': 'Đăng ký bằng Google',

    // ── Reset password
    'reset.title': 'Đặt lại mật khẩu',
    'reset.subtitle': 'Nhập email của bạn — chúng tôi sẽ gửi mã xác minh để đặt lại mật khẩu.',
    'reset.stepEmail': 'Email',
    'reset.stepVerify': 'Mã xác minh',
    'reset.stepNewPassword': 'Mật khẩu mới',
    'reset.sendButton': 'Gửi mã xác minh',
    'reset.sendingButton': 'Đang gửi…',
    'reset.verifyButton': 'Xác minh',
    'reset.verifyingButton': 'Đang xác minh…',
    'reset.newPasswordButton': 'Đặt mật khẩu mới',
    'reset.updatingButton': 'Đang cập nhật…',
    'reset.backToLogin': 'Quay lại đăng nhập',

    // ── Email verification landing
    'verify.title': 'Xác minh email',
    'verify.successTitle': 'Email đã được xác minh',
    'verify.successBody':
      'Cảm ơn bạn — tài khoản của bạn đã được kích hoạt. Bạn có thể đăng nhập ngay bây giờ.',
    'verify.goToLogin': 'Đi đến trang đăng nhập',
    'verify.failedTitle': 'Xác minh không thành công',
    'verify.failedBody':
      'Liên kết xác minh đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu liên kết mới.',
    'verify.requestNew': 'Yêu cầu liên kết mới',

    // ── Footer — legal
    'legal.terms': 'Điều khoản dịch vụ',
    'legal.privacy': 'Chính sách bảo mật',
    'legal.cookies': 'Chính sách cookie',
    'legal.contact': 'Liên hệ',

    // ── Errors / common
    'common.required': 'Bắt buộc',
    'common.cancel': 'Huỷ',
    'common.save': 'Lưu',
    'common.search': 'Tìm kiếm',
    'common.loading': 'Đang tải…',
    'common.retry': 'Thử lại',
    'common.previous': 'Trước',
    'common.next': 'Tiếp',
    'common.page': 'Trang',
    'common.of': 'của',
  },

  en: {
    // English (fallback) — keys here mirror the Vietnamese map but only
    // contain entries whose wording differs. Anything not listed simply
    // falls back to the raw key path via useT().
  },
};

/**
 * Resolve a translation for the given locale. If the requested locale has
 * no explicit value for the key, we fall back to English. If English also
 * has nothing, we return the key itself so the UI never silently renders
 * `undefined`.
 */
export const translate = (
  locale: Locale,
  key: string,
  fallback?: string,
): string => {
  if (locale === 'vi') {
    const direct = dictionaries.vi[key];
    if (direct) return direct;
  }
  const english = dictionaries.en[key];
  if (english) return english;
  const provided = fallback;
  if (provided) return provided;
  return key;
};
