import api from './axios';
import {
  medalService,
  type Medal,
  type UserMedal,
} from './medal.service';
import { userService } from './user.service';
import { invalidateFlairCache } from '../hooks/useAuthorFlair';

export type MedalCategoryKey = 'research' | 'mentorship' | 'seminars' | 'community';

export interface PredefinedCategory {
  key: MedalCategoryKey;
  labelEn: string;
  labelVi: string;
  iconName: string;
}

export const MEDAL_CATEGORIES: PredefinedCategory[] = [
  {
    key: 'research',
    labelEn: 'Research & Publications',
    labelVi: 'Nghiên cứu & Bài báo',
    iconName: 'BookOpen',
  },
  {
    key: 'mentorship',
    labelEn: 'Teaching & Mentorship',
    labelVi: 'Giảng dạy & Đào tạo',
    iconName: 'GraduationCap',
  },
  {
    key: 'seminars',
    labelEn: 'Seminar Activities',
    labelVi: 'Hoạt động Seminar',
    iconName: 'Users',
  },
  {
    key: 'community',
    labelEn: 'Community Engagement',
    labelVi: 'Tương tác Cộng đồng',
    iconName: 'MessageSquare',
  },
];

/**
 * Categorizes a Medal into one of 4 academic groups based on its code / metric.
 */
export function getMedalCategory(medal: Medal): MedalCategoryKey {
  const code = (medal.code || '').toUpperCase();
  const metric = (medal.criteriaMetric || '').toLowerCase();

  if (code.includes('COMMUNITY') || metric.includes('community')) {
    return 'community';
  }
  if (code.includes('SEMINAR_PARTICIPANT') || metric.includes('attended_seminar')) {
    return 'seminars';
  }
  if (
    code.includes('MASTER_MENTOR') ||
    code.includes('ACADEMIC_HOST') ||
    code.includes('HOST') ||
    code.includes('SEMINAR_HOST') ||
    metric.includes('guided_group') ||
    metric.includes('hosted_seminar')
  ) {
    return 'mentorship';
  }
  return 'research';
}

/**
 * Checks if a medal is compatible with a given target role.
 */
export function isMedalCompatibleWithRole(medal: Medal, role?: string | null): boolean {
  if (!role || role === 'All' || role === 'ALL' || role === '') return true;
  if (!medal.roles || medal.roles.length === 0) return true;
  if (medal.roles.includes('All')) return true;

  const normalizedTarget = role.trim().toLowerCase();
  return medal.roles.some((r) => r.trim().toLowerCase() === normalizedTarget);
}

export interface MedalGrantInput {
  userId: number;
  medalCode: string;
  forceUnlocked?: boolean;
  awardedReason?: string;
}

export interface MedalRecipientInfo {
  userMedalId: number;
  userId: number;
  fullName: string;
  email: string;
  roleName: string;
  avatarUrl?: string | null;
  unlockedAt: string | null;
  currentProgress: number;
  criteriaThreshold: number;
  progressPercentage: number;
  isUnlocked: boolean;
  awardedByAdminId?: number | null;
  awardedReason?: string | null;
}

export interface MedalAnalyticsStats {
  totalMedals: number;
  totalUnlockedAwards: number;
  usersWithMedalsCount: number;
  topMedal: { medal: Medal; recipientCount: number } | null;
  recipientsByMedalCode: Record<string, MedalRecipientInfo[]>;
}

// In-memory cache for analytics to prevent spamming backend requests
let analyticsCache: {
  stats: MedalAnalyticsStats;
  cachedAt: number;
} | null = null;

const CACHE_TTL_MS = 60 * 1000; // 1 minute

export const medalAnalyticsService = {
  /**
   * Fetch progress of a specific medal for a user.
   */
  async getUserProgressForMedal(
    userId: number | string,
    medalIdOrCode: string
  ): Promise<UserMedal | null> {
    try {
      const userMedals = await medalService.getUserMedals(userId);
      const target = (medalIdOrCode || '').toUpperCase();
      return (
        userMedals.find(
          (um) =>
            um.medal.id === medalIdOrCode ||
            um.medal.code.toUpperCase() === target
        ) ?? null
      );
    } catch (err) {
      console.warn(`Failed to get medal progress for user ${userId}:`, err);
      return null;
    }
  },

  /**
   * Manually grant or advance a medal for a user (Admin).
   */
  async grantMedal(input: MedalGrantInput): Promise<UserMedal> {
    const payload = {
      userId: Number(input.userId),
      medalCode: input.medalCode.trim(),
      forceUnlocked: Boolean(input.forceUnlocked),
      awardedReason: input.awardedReason?.trim() || 'Admin manual grant',
    };

    const res = await api.post('/api/Medal/grant', payload);
    invalidateFlairCache(input.userId);
    analyticsCache = null; // Invalidate analytics cache
    return res.data;
  },

  /**
   * Revoke a manually granted medal by userMedalId (Admin).
   */
  async revokeMedal(userMedalId: number | string, userId?: number): Promise<void> {
    await api.delete(`/api/Medal/grant/${userMedalId}`);
    if (userId) {
      invalidateFlairCache(userId);
    }
    analyticsCache = null;
  },

  /**
   * Fetches and aggregates medal analytics across users.
   */
  async getAnalytics(forceRefresh = false): Promise<MedalAnalyticsStats> {
    if (!forceRefresh && analyticsCache && Date.now() - analyticsCache.cachedAt < CACHE_TTL_MS) {
      return analyticsCache.stats;
    }

    const [allMedals, usersResult] = await Promise.all([
      medalService.getAll(),
      userService.getAllUsers(50),
    ]);

    const users = usersResult.items || [];
    const recipientsMap: Record<string, MedalRecipientInfo[]> = {};

    // Initialize recipients map for all medal codes
    for (const m of allMedals) {
      recipientsMap[m.code.toUpperCase()] = [];
    }

    const usersWithMedalsSet = new Set<number>();
    let totalUnlocked = 0;

    // Concurrently fetch user medals in small batches
    const BATCH_SIZE = 8;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (u) => {
          try {
            const userMedals = await medalService.getUserMedals(u.id);
            for (const um of userMedals) {
              if (um.isUnlocked) {
                const codeKey = (um.medal?.code || '').toUpperCase();
                if (!recipientsMap[codeKey]) {
                  recipientsMap[codeKey] = [];
                }

                recipientsMap[codeKey].push({
                  userMedalId: (um as any).id || 0,
                  userId: u.id,
                  fullName: u.fullName || `User #${u.id}`,
                  email: u.email || '',
                  roleName: u.roleName || (u as any).effectiveRole || 'User',
                  avatarUrl: u.avatarUrl,
                  unlockedAt: um.unlockedAt || null,
                  currentProgress: um.currentProgress ?? 1,
                  criteriaThreshold: (um as any).criteriaThreshold ?? um.medal?.criteriaThreshold ?? 1,
                  progressPercentage: um.progressPercentage ?? 100,
                  isUnlocked: true,
                  awardedByAdminId: (um as any).awardedByAdminId ?? null,
                  awardedReason: (um as any).awardedReason ?? null,
                });

                usersWithMedalsSet.add(u.id);
                totalUnlocked += 1;
              }
            }
          } catch {
            // Ignore single user fetch failures defensively
          }
        })
      );
    }

    // Identify top medal
    let topMedal: { medal: Medal; recipientCount: number } | null = null;
    let maxCount = -1;

    for (const m of allMedals) {
      const list = recipientsMap[m.code.toUpperCase()] || [];
      if (list.length > maxCount && list.length > 0) {
        maxCount = list.length;
        topMedal = { medal: m, recipientCount: list.length };
      }
    }

    const stats: MedalAnalyticsStats = {
      totalMedals: allMedals.length,
      totalUnlockedAwards: totalUnlocked,
      usersWithMedalsCount: usersWithMedalsSet.size,
      topMedal,
      recipientsByMedalCode: recipientsMap,
    };

    analyticsCache = {
      stats,
      cachedAt: Date.now(),
    };

    return stats;
  },

  /**
   * Invalidate local analytics cache
   */
  clearCache(): void {
    analyticsCache = null;
  },
};