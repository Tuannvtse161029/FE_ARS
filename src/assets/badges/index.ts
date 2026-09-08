/**
 * Custom badge artwork registry.
 *
 * The badge artwork pipeline supports three shapes of `medal.imageUrl`:
 *
 *   - `lucide:IconName`  — a built-in lucide-react icon (see
 *                          `src/features/admin/components/SafeMedalBadge.tsx`).
 *                          This is the legacy default and remains supported.
 *   - `https://…`        — a remote image (e.g. Firebase Cloud Storage URL).
 *   - `/assets/badges/<key>.<ext>` — a local artwork file bundled by Vite.
 *                                    When the URL matches this shape,
 *                                    `resolveBadgeArtwork` returns the
 *                                    matching registry entry so consumers
 *                                    can render the icon directly.
 *
 * The `library/` subfolder ships a curated set of flat-color achievement
 * SVGs (bespoke for ARS — see `library/LICENSES.md`). Admins can pick any
 * library entry from the "Choose from library" tab inside the
 * `ArtworkUpload` modal; selecting an entry writes
 * `/assets/badges/<key>.svg` back into `medal.imageUrl` via the existing
 * `medalService.update` path. No backend change is required.
 *
 * Adding new artwork:
 *   1. Drop the SVG (or PNG) into `src/assets/badges/library/`.
 *   2. Add a typed import below and register the entry in
 *      `BADGE_ARTWORK_REGISTRY`.
 *   3. Document the source + license in `library/LICENSES.md` so we keep
 *      attribution accurate for the credits page.
 *
 * The `lucide:IconName` convention remains the default for built-in medals
 * and does not need an entry here.
 */

import orcidBrand from './library/orcid-brand.svg';
import orcidShield from './library/orcid-shield.svg';
import publishedBook from './library/published-book.svg';
import paperScroll from './library/paper-scroll.svg';
import hostSeminarMic from './library/host-seminar-mic.svg';
import attendeeHeadphones from './library/attendee-headphones.svg';
import mentorGraduation from './library/mentor-graduation.svg';
import reviewerClipboard from './library/reviewer-clipboard.svg';
import flawlessTrophy from './library/flawless-trophy.svg';
import awardRibbon from './library/award-ribbon.svg';
import verifiedCertificate from './library/verified-certificate.svg';
import labFlask from './library/lab-flask.svg';
import insightBulb from './library/insight-bulb.svg';
import researchNetwork from './library/research-network.svg';
import globeAcademic from './library/globe-academic.svg';
import summitMountain from './library/summit-mountain.svg';
import streakFlame from './library/streak-flame.svg';
import breakthroughComet from './library/breakthrough-comet.svg';
import medalGold from './library/medal-gold.svg';
import medalSilver from './library/medal-silver.svg';
import medalBronze from './library/medal-bronze.svg';
import medalPlatinum from './library/medal-platinum.svg';

// ── Bold designs (illustrative, full-color, dramatic) ──────────────────────
// These artwork files are intentionally more elaborate than the flat-color
// library: each uses gradients, glow, ray bursts, and dynamic composition
// to give the medal tile a "premium" feel. The modal exposes them via a
// dedicated "Bold designs" tab so the existing flat library stays coherent.
import boldOrcid from './bold/orcid-banner.svg';
import boldPublished from './bold/published-hero.svg';
import boldHostSeminar from './bold/seminar-spotlight.svg';
import boldAttendee from './bold/attendee-headset.svg';
import boldMentor from './bold/mentor-constellation.svg';
import boldReviewer from './bold/reviewer-magnifier.svg';
import boldFlawless from './bold/flawless-podium.svg';
import boldStreak from './bold/streak-flame-wings.svg';
import boldSummit from './bold/summit-aurora.svg';
import boldAward from './bold/award-laurel.svg';
import boldDiploma from './bold/verified-diploma.svg';
import boldRocket from './bold/breakthrough-rocket.svg';
import boldInsight from './bold/insight-brain.svg';
import boldNexus from './bold/research-nexus.svg';
import boldGlobe from './bold/globe-orbits.svg';
import boldHandshake from './bold/community-handshake.svg';
import boldDiamond from './bold/diamond-trophy.svg';
import boldCalendarStreak from './bold/calendar-streak.svg';
import boldGalaxy from './bold/galaxy-medal.svg';
import boldPixelGrid from './bold/pixel-grid.svg';
import boldInfinity from './bold/infinity-loop.svg';
import boldHoloCube from './bold/holographic-cube.svg';

// ── Additional flat-color library entries (round 2) ──────────────────────
import anchor from './library/anchor.svg';
import chatBubble from './library/chat-bubble.svg';
import chessKnight from './library/chess-knight.svg';
import hourglass from './library/hourglass.svg';
import calendarDays from './library/calendar-days.svg';
import palette from './library/palette.svg';

export interface BadgeArtworkEntry {
  /** Stable key — referenced by name in medal.imageUrl fallback paths. */
  key: string;
  /** Vite asset URL for the artwork. Add new entries below as artwork is dropped in. */
  src: string;
  /** Optional accessible label for tooltip / a11y. */
  label?: string;
  /**
   * Optional i18n message id from `artworkLibrary.category.*` describing the
   * metric family this artwork fits best. Used by the picker to group
   * badges into "ORCID / Published / Seminar / …" sections. Falls back to
   * "general" when omitted.
   */
  category?:
    | 'orcid'
    | 'published'
    | 'seminar'
    | 'mentoring'
    | 'review'
    | 'flawless'
    | 'community'
    | 'general';
  /** Optional Vietnamese label so admins in `vi` locale see a localised caption. */
  labelVi?: string;
  /**
   * Visual style discriminator. `'library'` is the curated flat-color set;
   * `'bold'` is the illustrative / gradient-driven set used by the
   * dedicated "Bold designs" tab. When omitted the entry is treated as
   * library artwork for backwards compatibility.
   */
  style?: 'library' | 'bold';
}

export const BADGE_ARTWORK_REGISTRY: Record<string, BadgeArtworkEntry> = {
  // ── ORCID / verification family ────────────────────────────────────────
  orcidShield: {
    key: 'orcidShield',
    src: orcidShield,
    label: 'ORCID shield (outline)',
    labelVi: 'Khiên ORCID (viền)',
    category: 'orcid',
  },
  orcidBrand: {
    key: 'orcidBrand',
    src: orcidBrand,
    label: 'ORCID iD brand mark',
    labelVi: 'Thương hiệu ORCID iD',
    category: 'orcid',
  },
  verifiedCertificate: {
    key: 'verifiedCertificate',
    src: verifiedCertificate,
    label: 'Verified certificate',
    labelVi: 'Chứng nhận đã xác minh',
    category: 'orcid',
  },

  // ── Published paper family ───────────────────────────────────────────
  publishedBook: {
    key: 'publishedBook',
    src: publishedBook,
    label: 'Open research book',
    labelVi: 'Sách nghiên cứu',
    category: 'published',
  },
  paperScroll: {
    key: 'paperScroll',
    src: paperScroll,
    label: 'Manuscript scroll',
    labelVi: 'Cuộn giấy luận văn',
    category: 'published',
  },
  labFlask: {
    key: 'labFlask',
    src: labFlask,
    label: 'Lab flask with bubbles',
    labelVi: 'Bình thí nghiệm',
    category: 'published',
  },
  insightBulb: {
    key: 'insightBulb',
    src: insightBulb,
    label: 'Insight lightbulb',
    labelVi: 'Bóng đèn ý tưởng',
    category: 'published',
  },

  // ── Seminar / hosted-event family ───────────────────────────────────
  hostSeminarMic: {
    key: 'hostSeminarMic',
    src: hostSeminarMic,
    label: 'Hosted seminar microphone',
    labelVi: 'Micro hội thảo',
    category: 'seminar',
  },
  attendeeHeadphones: {
    key: 'attendeeHeadphones',
    src: attendeeHeadphones,
    label: 'Attendee headphones',
    labelVi: 'Tai nghe tham dự',
    category: 'seminar',
  },
  researchNetwork: {
    key: 'researchNetwork',
    src: researchNetwork,
    label: 'Research network nodes',
    labelVi: 'Mạng lưới nghiên cứu',
    category: 'seminar',
  },

  // ── Mentoring / group guidance family ────────────────────────────────
  mentorGraduation: {
    key: 'mentorGraduation',
    src: mentorGraduation,
    label: 'Mentor graduation cap',
    labelVi: 'Mũ tốt nghiệp mentor',
    category: 'mentoring',
  },
  summitMountain: {
    key: 'summitMountain',
    src: summitMountain,
    label: 'Summit mountain flag',
    labelVi: 'Đỉnh núi chinh phục',
    category: 'mentoring',
  },

  // ── Review family ────────────────────────────────────────────────────
  reviewerClipboard: {
    key: 'reviewerClipboard',
    src: reviewerClipboard,
    label: 'Peer review clipboard',
    labelVi: 'Bảng phản biện',
    category: 'review',
  },
  awardRibbon: {
    key: 'awardRibbon',
    src: awardRibbon,
    label: 'Award citation ribbon',
    labelVi: 'Ruộng ghi công',
    category: 'review',
  },

  // ── Flawless / streak family ─────────────────────────────────────────
  flawlessTrophy: {
    key: 'flawlessTrophy',
    src: flawlessTrophy,
    label: 'Flawless trophy cup',
    labelVi: 'Cúp tiến độ hoàn hảo',
    category: 'flawless',
  },
  streakFlame: {
    key: 'streakFlame',
    src: streakFlame,
    label: 'Streak flame',
    labelVi: 'Ngọn lửa chuỗi ngày',
    category: 'flawless',
  },
  breakthroughComet: {
    key: 'breakthroughComet',
    src: breakthroughComet,
    label: 'Breakthrough comet',
    labelVi: 'Sao chổi đột phá',
    category: 'flawless',
  },

  // ── Community / global family ────────────────────────────────────────
  globeAcademic: {
    key: 'globeAcademic',
    src: globeAcademic,
    label: 'Global academic globe',
    labelVi: 'Địa cầu học thuật',
    category: 'community',
  },

  // ── Tier-agnostic classic medals (useable on any family) ─────────────
  medalGold: {
    key: 'medalGold',
    src: medalGold,
    label: 'Gold distinction medal',
    labelVi: 'Huy chương vàng',
    category: 'general',
  },
  medalSilver: {
    key: 'medalSilver',
    src: medalSilver,
    label: 'Silver distinction medal',
    labelVi: 'Huy chương bạc',
    category: 'general',
  },
  medalBronze: {
    key: 'medalBronze',
    src: medalBronze,
    label: 'Bronze distinction medal',
    labelVi: 'Huy chương đồng',
    category: 'general',
  },
  medalPlatinum: {
    key: 'medalPlatinum',
    src: medalPlatinum,
    label: 'Platinum distinction medal',
    labelVi: 'Huy chương bạch kim',
    category: 'general',
  },

  // ── Bold illustrative designs (gradients + glow + dramatic rays) ────
  // Every entry below uses `key: 'bold…'` so the bold picker can filter to
  // just this set without iterating style tags. They intentionally sit
  // alongside the flat library in the same registry so `resolveBadgeArtwork`
  // and the runtime renderer keep working without any branch logic.
  boldOrcidBanner: {
    key: 'boldOrcidBanner',
    src: boldOrcid,
    label: 'ORCID banner with starburst',
    labelVi: 'Khiên ORCID với tia sáng',
    category: 'orcid',
    style: 'bold',
  },
  boldPublishedHero: {
    key: 'boldPublishedHero',
    src: boldPublished,
    label: 'Published hero book',
    labelVi: 'Sách hero xuất bản',
    category: 'published',
    style: 'bold',
  },
  boldSeminarSpotlight: {
    key: 'boldSeminarSpotlight',
    src: boldHostSeminar,
    label: 'Seminar spotlight mic',
    labelVi: 'Micro sân khấu hội thảo',
    category: 'seminar',
    style: 'bold',
  },
  boldAttendeeHeadset: {
    key: 'boldAttendeeHeadset',
    src: boldAttendee,
    label: 'Attendee headset with equalizer',
    labelVi: 'Tai nghe cân bằng âm',
    category: 'seminar',
    style: 'bold',
  },
  boldMentorConstellation: {
    key: 'boldMentorConstellation',
    src: boldMentor,
    label: 'Mentor constellation cap',
    labelVi: 'Mentor liên kết sinh viên',
    category: 'mentoring',
    style: 'bold',
  },
  boldReviewerMagnifier: {
    key: 'boldReviewerMagnifier',
    src: boldReviewer,
    label: 'Reviewer magnifier stamp',
    labelVi: 'Phản biện kính lúp',
    category: 'review',
    style: 'bold',
  },
  boldFlawlessPodium: {
    key: 'boldFlawlessPodium',
    src: boldFlawless,
    label: 'Flawless podium trophy',
    labelVi: 'Cúp bục vinh danh',
    category: 'flawless',
    style: 'bold',
  },
  boldStreakWings: {
    key: 'boldStreakWings',
    src: boldStreak,
    label: 'Streak flame wings',
    labelVi: 'Cánh lửa chuỗi ngày',
    category: 'flawless',
    style: 'bold',
  },
  boldSummitAurora: {
    key: 'boldSummitAurora',
    src: boldSummit,
    label: 'Summit aurora peak',
    labelVi: 'Đỉnh cực quang',
    category: 'flawless',
    style: 'bold',
  },
  boldAwardLaurel: {
    key: 'boldAwardLaurel',
    src: boldAward,
    label: 'Laurel wreath award',
    labelVi: 'Vòng nguyệt quế vinh danh',
    category: 'review',
    style: 'bold',
  },
  boldDiploma: {
    key: 'boldDiploma',
    src: boldDiploma,
    label: 'Verified diploma with seal',
    labelVi: 'Bằng tốt nghiệp có con dấu',
    category: 'orcid',
    style: 'bold',
  },
  boldRocketLaunch: {
    key: 'boldRocketLaunch',
    src: boldRocket,
    label: 'Breakthrough rocket launch',
    labelVi: 'Tên lửa đột phá',
    category: 'published',
    style: 'bold',
  },
  boldInsightBrain: {
    key: 'boldInsightBrain',
    src: boldInsight,
    label: 'Insight brain lightbulb',
    labelVi: 'Bóng đèn bộ não',
    category: 'published',
    style: 'bold',
  },
  boldResearchNexus: {
    key: 'boldResearchNexus',
    src: boldNexus,
    label: 'Research nexus constellation',
    labelVi: 'Trung tâm nghiên cứu',
    category: 'mentoring',
    style: 'bold',
  },
  boldGlobeOrbits: {
    key: 'boldGlobeOrbits',
    src: boldGlobe,
    label: 'Globe with orbiting paths',
    labelVi: 'Địa cầu quỹ đạo',
    category: 'community',
    style: 'bold',
  },
  boldHandshake: {
    key: 'boldHandshake',
    src: boldHandshake,
    label: 'Community handshake unity',
    labelVi: 'Bắt tay cộng đồng',
    category: 'community',
    style: 'bold',
  },

  // ── Bold additions (round 2) ───────────────────────────────────────────
  boldDiamondTrophy: {
    key: 'boldDiamondTrophy',
    src: boldDiamond,
    label: 'Diamond-cut gem trophy',
    labelVi: 'Cúp kim cương',
    category: 'flawless',
    style: 'bold',
  },
  boldCalendarStreak: {
    key: 'boldCalendarStreak',
    src: boldCalendarStreak,
    label: 'Calendar streak with flame',
    labelVi: 'Chuỗi lịch với ngọn lửa',
    category: 'flawless',
    style: 'bold',
  },
  boldGalaxyMedal: {
    key: 'boldGalaxyMedal',
    src: boldGalaxy,
    label: 'Spiral galaxy medal',
    labelVi: 'Huy chương thiên hà',
    category: 'general',
    style: 'bold',
  },
  boldPixelGrid: {
    key: 'boldPixelGrid',
    src: boldPixelGrid,
    label: 'Digital pixel art grid',
    labelVi: 'Lưới pixel kỹ thuật số',
    category: 'general',
    style: 'bold',
  },
  boldInfinityLoop: {
    key: 'boldInfinityLoop',
    src: boldInfinity,
    label: 'Infinity mentoring loop',
    labelVi: 'Vòng vô tận mentor',
    category: 'mentoring',
    style: 'bold',
  },
  boldHoloCube: {
    key: 'boldHoloCube',
    src: boldHoloCube,
    label: 'Holographic cube',
    labelVi: 'Khối lập phương hologram',
    category: 'general',
    style: 'bold',
  },

  // ── Library additions (round 2) ────────────────────────────────────────
  anchor: {
    key: 'anchor',
    src: anchor,
    label: 'Community anchor',
    labelVi: 'Mỏ neo cộng đồng',
    category: 'community',
  },
  chatBubble: {
    key: 'chatBubble',
    src: chatBubble,
    label: 'Community chat bubble',
    labelVi: 'Bong bóng chat cộng đồng',
    category: 'community',
  },
  chessKnight: {
    key: 'chessKnight',
    src: chessKnight,
    label: 'Strategic chess knight',
    labelVi: 'Quân mã chiến lược',
    category: 'general',
  },
  hourglass: {
    key: 'hourglass',
    src: hourglass,
    label: 'Hourglass with sand',
    labelVi: 'Đồng hồ cát',
    category: 'flawless',
  },
  calendarDays: {
    key: 'calendarDays',
    src: calendarDays,
    label: 'Calendar with check marks',
    labelVi: 'Lịch đánh dấu',
    category: 'general',
  },
  palette: {
    key: 'palette',
    src: palette,
    label: 'Artist palette with brush',
    labelVi: 'Bảng màu họa sĩ',
    category: 'published',
  },
};

export const BADGE_ARTWORK_LIST: BadgeArtworkEntry[] = Object.values(
  BADGE_ARTWORK_REGISTRY,
);

/**
 * Subset of the registry that holds the bold / illustrative designs. The
 * Bold-artwork picker tab in the admin modal consumes this list directly,
 * keeping the "Curated ARS library" picker focused on flat-color work.
 *
 * Entries are kept in the same `BADGE_ARTWORK_REGISTRY` map so the runtime
 * renderer (`SafeMedalBadge`) and the migration story are unchanged — we
 * only partition *how the admin discovers them*.
 */
export const BADGE_BOLD_ARTWORK_LIST: BadgeArtworkEntry[] = Object.values(
  BADGE_ARTWORK_REGISTRY,
).filter((entry) => entry.style === 'bold');

export const resolveBadgeArtwork = (
  imageUrl: string | undefined | null,
): BadgeArtworkEntry | null => {
  if (!imageUrl) return null;
  // Only intercept paths that point into our local badges folder; leave
  // http(s)/data:/blob: untouched so SafeMedalBadge can render them.
  if (!imageUrl.startsWith('/assets/badges/')) return null;
  const key = imageUrl.replace('/assets/badges/', '').replace(/\.[^.]+$/, '');
  return BADGE_ARTWORK_REGISTRY[key] ?? null;
};

/**
 * Convert a registry key (e.g. `medalGold`) to the canonical image URL the
 * backend stores in `medal.imageUrl`. Admins use this when they pick an
 * artwork from the library — we save the resulting path so the BE round-trip
 * stays identical to the legacy `lucide:` and `https://…` shapes.
 */
export const artworkKeyToImageUrl = (key: string): string =>
  `/assets/badges/${key}.svg`;
