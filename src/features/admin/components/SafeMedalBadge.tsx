/**
 * SafeMedalBadge — renders medal artwork using lucide-react vector icons
 * or a safe image fallback.
 *
 * Extracted from src/pages/Admin/AdminMedals.tsx
 *
 * Tier visual hierarchy (Paper Day "Crown Jewels" system, all token-driven):
 *   Bronze   — single copper ring, 48% icon scale, subtle warm halo
 *   Silver   — silver ring with inner bevel, 52% icon scale, cool halo
 *   Gold     — double gold ring (outer + inner), 56% icon scale, rich halo
 *   Platinum — triple iridescent ring, 60% icon scale, dramatic outer aura
 *
 * Every badge carries a Roman-numeral corner indicator (I / II / III / IV)
 * so the tier is unmistakable even at a glance from across the page.
 */
import { useState, useEffect } from 'react';
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
  ScrollText,
  Library,
  NotebookPen,
  NotebookText,
  BookMarked,
  TestTube2,
  Dna,
  Brain,
  CircuitBoard,
  Cpu,
  Telescope,
  Satellite,
  Sigma,
  PiSquare,
  ChartBar,
  ChartLine,
  ChartPie,
  TrendingUp,
  MessagesSquare,
  MessageSquareQuote,
  Users,
  UserCheck,
  Briefcase,
  Handshake,
  HandHeart,
  HeartHandshake,
  Mail,
  MailCheck,
  Scroll,
  FileBadge,
  IdCard,
  KeyRound,
  BadgeCheck,
  BadgeDollarSign,
  Wallet,
  PiggyBank,
  Coins,
  CircleDollarSign,
  Hourglass,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Bell,
  BellRing,
  Megaphone,
  Radio,
  Podcast,
  Video,
  Camera,
  Hash,
  Tags,
  Tag,
  Filter,
  FilterX,
  CheckCheck,
  ThumbsUp,
  ThumbsDown,
  Info,
  AlertTriangle,
  CircleCheck,
  CircleX,
  CircleDot,
  CircleSlash,
  Flag,
  FlagTriangleRight,
  Anchor,
  Footprints,
  Map,
  Mountain,
  MountainSnow,
  Leaf,
  Trees,
  TreePine,
  Sun,
  Moon,
  Cloud,
  CloudCog,
  Sparkle,
  Wand2,
  Wrench,
  Settings,
  SearchCode,
  ScanSearch,
  ScanLine,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  KeySquare,
  type LucideIcon,
} from 'lucide-react';
import { type MedalTier } from '../../../services/medal.service';

const TIER_NUMERAL: Record<string, string> = {
  Bronze: 'I',
  Silver: 'II',
  Gold: 'III',
  Platinum: 'IV',
};

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
  ScrollText: ScrollText,
  Library: Library,
  NotebookPen: NotebookPen,
  NotebookText: NotebookText,
  BookMarked: BookMarked,
  TestTube2: TestTube2,
  Dna: Dna,
  Brain: Brain,
  CircuitBoard: CircuitBoard,
  Cpu: Cpu,
  Telescope: Telescope,
  Satellite: Satellite,
  Sigma: Sigma,
  PiSquare: PiSquare,
  ChartBar: ChartBar,
  ChartLine: ChartLine,
  ChartPie: ChartPie,
  TrendingUp: TrendingUp,
  MessagesSquare: MessagesSquare,
  MessageSquareQuote: MessageSquareQuote,
  Users: Users,
  UserCheck: UserCheck,
  Briefcase: Briefcase,
  Handshake: Handshake,
  HandHeart: HandHeart,
  HeartHandshake: HeartHandshake,
  Mail: Mail,
  MailCheck: MailCheck,
  Scroll: Scroll,
  FileBadge: FileBadge,
  IdCard: IdCard,
  KeyRound: KeyRound,
  BadgeCheck: BadgeCheck,
  BadgeDollarSign: BadgeDollarSign,
  Wallet: Wallet,
  PiggyBank: PiggyBank,
  Coins: Coins,
  CircleDollarSign: CircleDollarSign,
  Hourglass: Hourglass,
  CalendarCheck: CalendarCheck,
  CalendarClock: CalendarClock,
  CalendarDays: CalendarDays,
  Bell: Bell,
  BellRing: BellRing,
  Megaphone: Megaphone,
  Radio: Radio,
  Podcast: Podcast,
  Video: Video,
  Camera: Camera,
  Hash: Hash,
  Tags: Tags,
  Tag: Tag,
  Filter: Filter,
  FilterX: FilterX,
  CheckCheck: CheckCheck,
  ThumbsUp: ThumbsUp,
  ThumbsDown: ThumbsDown,
  Info: Info,
  AlertTriangle: AlertTriangle,
  CircleCheck: CircleCheck,
  CircleX: CircleX,
  CircleDot: CircleDot,
  CircleSlash: CircleSlash,
  Flag: Flag,
  FlagTriangleRight: FlagTriangleRight,
  Anchor: Anchor,
  Footprints: Footprints,
  Map: Map,
  Mountain: Mountain,
  MountainSnow: MountainSnow,
  Leaf: Leaf,
  Trees: Trees,
  TreePine: TreePine,
  Sun: Sun,
  Moon: Moon,
  Cloud: Cloud,
  CloudCog: CloudCog,
  Sparkle: Sparkle,
  Wand2: Wand2,
  Wrench: Wrench,
  Settings: Settings,
  SearchCode: SearchCode,
  ScanSearch: ScanSearch,
  ScanLine: ScanLine,
  Eye: Eye,
  EyeOff: EyeOff,
  Lock: Lock,
  Unlock: Unlock,
  KeySquare: KeySquare,
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
  { name: 'ScrollText', labelVi: 'Cuộn giấy / Luận văn', labelEn: 'Scroll / Thesis' },
  { name: 'Library', labelVi: 'Thư viện / Tài liệu', labelEn: 'Library' },
  { name: 'NotebookPen', labelVi: 'Sổ tay ghi chép', labelEn: 'Notebook' },
  { name: 'NotebookText', labelVi: 'Sổ tay học thuật', labelEn: 'Notebook Notes' },
  { name: 'BookMarked', labelVi: 'Sách đánh dấu', labelEn: 'Bookmarked' },
  { name: 'Scroll', labelVi: 'Văn bản cổ', labelEn: 'Manuscript' },
  { name: 'FileBadge', labelVi: 'Chứng nhận / Bằng cấp', labelEn: 'Certificate' },
  { name: 'TestTube2', labelVi: 'Ống nghiệm nhỏ', labelEn: 'Test Tube' },
  { name: 'Dna', labelVi: 'ADN / Sinh học', labelEn: 'DNA / Biology' },
  { name: 'Brain', labelVi: 'Não / Khoa học thần kinh', labelEn: 'Brain' },
  { name: 'CircuitBoard', labelVi: 'Mạch điện tử', labelEn: 'Circuit' },
  { name: 'Cpu', labelVi: 'Vi xử lý / Khoa học máy tính', labelEn: 'CPU' },
  { name: 'Telescope', labelVi: 'Kính thiên văn / Vũ trụ', labelEn: 'Telescope' },
  { name: 'Satellite', labelVi: 'Vệ tinh / Khám phá', labelEn: 'Satellite' },
  { name: 'Sigma', labelVi: 'Tổng / Toán học', labelEn: 'Sigma / Math' },
  { name: 'PiSquare', labelVi: 'Pi / Hằng số', labelEn: 'Pi / Math' },
  { name: 'ChartBar', labelVi: 'Biểu đồ cột', labelEn: 'Bar Chart' },
  { name: 'ChartLine', labelVi: 'Biểu đồ đường', labelEn: 'Line Chart' },
  { name: 'ChartPie', labelVi: 'Biểu đồ tròn', labelEn: 'Pie Chart' },
  { name: 'TrendingUp', labelVi: 'Xu hướng tăng', labelEn: 'Trending Up' },
  { name: 'MessagesSquare', labelVi: 'Hội thoại / Diễn đàn', labelEn: 'Forum' },
  { name: 'MessageSquareQuote', labelVi: 'Phản hồi trích dẫn', labelEn: 'Quoted Reply' },
  { name: 'Users', labelVi: 'Cộng đồng / Nhóm', labelEn: 'Community' },
  { name: 'UserCheck', labelVi: 'Xác minh danh tính', labelEn: 'Verified User' },
  { name: 'Briefcase', labelVi: 'Hồ sơ / Sự nghiệp', labelEn: 'Career' },
  { name: 'Handshake', labelVi: 'Hợp tác', labelEn: 'Collaboration' },
  { name: 'HandHeart', labelVi: 'Tình nguyện / Tấm lòng', labelEn: 'Volunteer' },
  { name: 'HeartHandshake', labelVi: 'Hỗ trợ cộng đồng', labelEn: 'Support' },
  { name: 'Mail', labelVi: 'Thư / Liên hệ', labelEn: 'Mail' },
  { name: 'MailCheck', labelVi: 'Thư xác nhận', labelEn: 'Verified Mail' },
  { name: 'IdCard', labelVi: 'Thẻ nhà nghiên cứu', labelEn: 'ID Card' },
  { name: 'KeyRound', labelVi: 'Chìa khóa / Quyền truy cập', labelEn: 'Key' },
  { name: 'KeySquare', labelVi: 'Khóa học thuật', labelEn: 'Key Square' },
  { name: 'BadgeCheck', labelVi: 'Huy hiệu đã xác minh', labelEn: 'Verified Badge' },
  { name: 'BadgeDollarSign', labelVi: 'Huy hiệu tài trợ', labelEn: 'Funded Badge' },
  { name: 'Wallet', labelVi: 'Ví tiền', labelEn: 'Wallet' },
  { name: 'PiggyBank', labelVi: 'Heo tiết kiệm / Quỹ', labelEn: 'Savings' },
  { name: 'Coins', labelVi: 'Xu / Điểm thưởng', labelEn: 'Coins' },
  { name: 'CircleDollarSign', labelVi: 'Thù lao / Tài trợ', labelEn: 'Stipend' },
  { name: 'Hourglass', labelVi: 'Đồng hồ cát / Kiên nhẫn', labelEn: 'Patience' },
  { name: 'CalendarCheck', labelVi: 'Lịch trình hoàn thành', labelEn: 'Calendar Done' },
  { name: 'CalendarClock', labelVi: 'Lịch đúng hạn', labelEn: 'On Time' },
  { name: 'CalendarDays', labelVi: 'Lịch sự kiện', labelEn: 'Events' },
  { name: 'Bell', labelVi: 'Chuông / Thông báo', labelEn: 'Notification' },
  { name: 'BellRing', labelVi: 'Chuông báo động', labelEn: 'Alert' },
  { name: 'Megaphone', labelVi: 'Loa phát thanh / Công bố', labelEn: 'Announcement' },
  { name: 'Radio', labelVi: 'Đài phát thanh', labelEn: 'Radio' },
  { name: 'Podcast', labelVi: 'Podcast / Âm thanh', labelEn: 'Podcast' },
  { name: 'Video', labelVi: 'Video / Hội thảo trực tuyến', labelEn: 'Video' },
  { name: 'Camera', labelVi: 'Máy ảnh / Trình bày', labelEn: 'Camera' },
  { name: 'Hash', labelVi: 'Hashtag / Từ khóa', labelEn: 'Hashtag' },
  { name: 'Tags', labelVi: 'Nhiều thẻ / Chủ đề', labelEn: 'Tags' },
  { name: 'Tag', labelVi: 'Thẻ đơn', labelEn: 'Tag' },
  { name: 'Filter', labelVi: 'Bộ lọc', labelEn: 'Filter' },
  { name: 'FilterX', labelVi: 'Xóa bộ lọc', labelEn: 'Clear Filter' },
  { name: 'CheckCheck', labelVi: 'Kiểm tra kép', labelEn: 'Double Check' },
  { name: 'ThumbsUp', labelVi: 'Đánh giá cao', labelEn: 'Upvote' },
  { name: 'ThumbsDown', labelVi: 'Đánh giá thấp', labelEn: 'Downvote' },
  { name: 'Info', labelVi: 'Thông tin', labelEn: 'Info' },
  { name: 'AlertTriangle', labelVi: 'Cảnh báo', labelEn: 'Warning' },
  { name: 'CircleCheck', labelVi: 'Hoàn thành', labelEn: 'Complete' },
  { name: 'CircleX', labelVi: 'Từ chối', labelEn: 'Rejected' },
  { name: 'CircleDot', labelVi: 'Đang tiến hành', labelEn: 'In Progress' },
  { name: 'CircleSlash', labelVi: 'Bỏ qua', labelEn: 'Skipped' },
  { name: 'Flag', labelVi: 'Cờ / Đánh dấu', labelEn: 'Flag' },
  { name: 'FlagTriangleRight', labelVi: 'Cờ phát hiện', labelEn: 'Flagged' },
  { name: 'Anchor', labelVi: 'Mỏ neo / Ổn định', labelEn: 'Anchor' },
  { name: 'Footprints', labelVi: 'Dấu chân / Hành trình', labelEn: 'Journey' },
  { name: 'Map', labelVi: 'Bản đồ / Định vị', labelEn: 'Map' },
  { name: 'Mountain', labelVi: 'Đỉnh cao / Chinh phục', labelEn: 'Summit' },
  { name: 'MountainSnow', labelVi: 'Đỉnh tuyết / Vượt trội', labelEn: 'Peak' },
  { name: 'Leaf', labelVi: 'Lá / Phát triển', labelEn: 'Growth' },
  { name: 'Trees', labelVi: 'Cây / Rừng tri thức', labelEn: 'Knowledge Forest' },
  { name: 'TreePine', labelVi: 'Cây thông / Bền vững', labelEn: 'Endurance' },
  { name: 'Sun', labelVi: 'Mặt trời / Rực rỡ', labelEn: 'Brilliance' },
  { name: 'Moon', labelVi: 'Mặt trăng / Ban đêm', labelEn: 'Moon' },
  { name: 'Cloud', labelVi: 'Đám mây / Lưu trữ', labelEn: 'Cloud' },
  { name: 'CloudCog', labelVi: 'Đám mây cấu hình', labelEn: 'Cloud Config' },
  { name: 'Sparkle', labelVi: 'Lấp lánh / Khám phá', labelEn: 'Sparkle' },
  { name: 'Wand2', labelVi: 'Đũa thần / Phép thuật', labelEn: 'Magic' },
  { name: 'Wrench', labelVi: 'Cờ-lê / Xây dựng', labelEn: 'Builder' },
  { name: 'Settings', labelVi: 'Cài đặt / Cấu hình', labelEn: 'Settings' },
  { name: 'SearchCode', labelVi: 'Tìm mã / Phân tích', labelEn: 'Search Code' },
  { name: 'ScanSearch', labelVi: 'Quét tìm kiếm', labelEn: 'Scan Search' },
  { name: 'ScanLine', labelVi: 'Quét dòng', labelEn: 'Scan Line' },
  { name: 'Eye', labelVi: 'Mắt / Quan sát', labelEn: 'Observer' },
  { name: 'EyeOff', labelVi: 'Ẩn danh / Riêng tư', labelEn: 'Private' },
  { name: 'Lock', labelVi: 'Khóa / Bảo mật', labelEn: 'Locked' },
  { name: 'Unlock', labelVi: 'Mở khóa', labelEn: 'Unlocked' },
];

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
  if (code.includes('HOST') || metric.includes('host')) return 'Mic';
  if (code.includes('PARTICIPANT') || metric.includes('attended')) return 'Headphones';
  if (code.includes('REVIEW') || metric.includes('review')) return 'ClipboardCheck';
  if (code.includes('MENTOR') || metric.includes('guided') || metric.includes('group')) return 'GraduationCap';
  if (code.includes('PROLIFIC') || metric.includes('paper') || metric.includes('published')) return 'BookOpen';
  if (code.includes('FLAWLESS') || metric.includes('flawless')) return 'Sparkles';

  return 'Medal';
};

export const SafeMedalBadge: React.FC<{
  imageUrl?: string;
  code?: string;
  criteriaMetric?: string;
  tier: MedalTier;
  size?: number;
  className?: string;
  alt?: string;
}> = ({ imageUrl, code, criteriaMetric, tier, size = 72, className, alt }) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [imageUrl]);

  const tierKey = tier.toLowerCase();
  const iconName = resolveMedalIconName({ code, imageUrl, criteriaMetric });
  const IconComponent = LUCIDE_ICONS_MAP[iconName] || MedalIcon;
  const numeral = TIER_NUMERAL[tier] ?? 'I';

  const iconScaleRaw = getComputedStyle(document.documentElement)
    .getPropertyValue(`--tier-${tierKey}-icon-scale`)
    .trim();
  const iconScale = parseFloat(iconScaleRaw) || 0.52;
  const iconSize = Math.round(size * iconScale);

  const isCustomHttpImage =
    imageUrl &&
    !imageUrl.startsWith('lucide:') &&
    (imageUrl.startsWith('http://') ||
      imageUrl.startsWith('https://') ||
      imageUrl.startsWith('data:') ||
      imageUrl.startsWith('blob:'));

  if (isCustomHttpImage && !imgFailed) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          position: 'relative',
          width: `${size}px`,
          height: `${size}px`,
          flexShrink: 0,
        }}
      >
        <img
          src={imageUrl}
          alt={alt || 'Medal artwork'}
          loading="lazy"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            objectFit: 'cover',
            border: `2px solid var(--tier-${tierKey}-border)`,
            boxShadow: `var(--tier-${tierKey}-halo)`,
          }}
          onError={(e) => {
            e.currentTarget.onerror = null;
            setImgFailed(true);
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            minWidth: `${Math.round(size * 0.28)}px`,
            height: `${Math.round(size * 0.28)}px`,
            padding: '0 4px',
            borderRadius: '999px',
            background: `var(--tier-${tierKey}-numeral-bg)`,
            color: `var(--tier-${tierKey}-numeral-fg)`,
            fontFamily: 'var(--font-family-serif, Georgia, serif)',
            fontWeight: 700,
            fontSize: `${Math.round(size * 0.16)}px`,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.18)',
            border: '1.5px solid var(--surface-raised, #fff)',
            letterSpacing: '0.02em',
          }}
        >
          {numeral}
        </span>
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
        userSelect: 'none',
      }}
      title={alt || iconName}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `3px solid var(--tier-${tierKey}-ring-outer)`,
          boxShadow: `var(--tier-${tierKey}-halo)`,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '4px',
          borderRadius: '50%',
          border: `2px solid var(--tier-${tierKey}-ring-inner, transparent)`,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '7px',
          borderRadius: '50%',
          background: `var(--tier-${tierKey}-bg)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconComponent
          size={iconSize}
          color={`var(--tier-${tierKey}-icon)`}
          strokeWidth={1.6}
        />
      </span>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-3px',
          right: '-3px',
          minWidth: `${Math.round(size * 0.3)}px`,
          height: `${Math.round(size * 0.3)}px`,
          padding: '0 5px',
          borderRadius: '999px',
          background: `var(--tier-${tierKey}-numeral-bg)`,
          color: `var(--tier-${tierKey}-numeral-fg)`,
          fontFamily: 'var(--font-family-serif, Georgia, serif)',
          fontWeight: 700,
          fontSize: `${Math.max(10, Math.round(size * 0.18))}px`,
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.22)',
          border: '1.5px solid var(--surface-raised, #ffffff)',
          letterSpacing: '0.02em',
        }}
      >
        {numeral}
      </span>
    </span>
  );
};

export default SafeMedalBadge;
