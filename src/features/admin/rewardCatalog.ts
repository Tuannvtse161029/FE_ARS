/**
 * Reward catalog — single source of truth for which rewards exist on the
 * platform and which role each one applies to.
 *
 * The BE `/api/UserReward` contract today only stores `name`, `description`,
 * `rewardMonths`, and `status`. It does NOT carry a `role` field, so the FE
 * owns the mapping from canonical reward slug → role + human-readable
 * display copy. New reward slugs only need to be added here to appear in
 * the admin table; the BE row is treated as the live source for months
 * and active/inactive state.
 *
 * Why a catalog rather than inferring from the slug?
 *  - The slug `researcher-published-paper` doesn't tell admins that this
 *    applies to the Researcher role — they'd need a glossary. The catalog
 *    surfaces "Researcher" in a dedicated column without inventing fields
 *    the BE doesn't ship.
 *  - When the BE eventually adds a `role` column or another reward slug,
 *    admins can change the slug here without touching the API contract.
 *  - Display name and description are i18n keys so they translate cleanly
 *    to Vietnamese while keeping the BE wire format (English slug) stable.
 *
 * Why we normalize slugs:
 *  - The legacy BE state can contain cosmetic variations of the same
 *    reward name ("Research Publication Reward", "research_publication_reward",
 *    "RESEARCH PUBLICATION REWARD") typed in by different admins over
 *    time. The admin table should collapse all of those into the single
 *    canonical catalog row.
 */
import type { UserReward } from '../../types/userReward';

/** Roles currently eligible for platform rewards. */
export type RewardRole =
  | 'Researcher'
  | 'Reviewer'
  | 'Lecturer'
  | 'GraduateStudent';

interface CatalogEntry {
  /** Canonical slug stored in /api/UserReward.name */
  slug: string;
  /** Target role — drives the Role column in the admin table */
  role: RewardRole;
  /** Localized display name shown in the Name column */
  displayKey: string;
  /**
   * Localized description shown in the Description column.
   * Should give an admin enough context to understand what triggers the
   * reward and which role gets it.
   */
  descriptionKey: string;
}

/**
 * The ordered list of rewards the admin can manage. Adding a new entry
 * here is enough to expose it on the User Rewards tab; the BE row is
 * still the authoritative source for months and active/inactive state.
 *
 * The `slug` here is the human-readable key we expect to find (or that
 * the admin would naturally type). The catalog `slug` is also what we
 * send to the BE when the admin hits "Configure" for a row that doesn't
 * have a wire-format row yet, so admins see consistent identity across
 * FE and BE.
 */
export const REWARD_CATALOG: readonly CatalogEntry[] = [
  {
    slug: 'Research Publication Reward',
    role: 'Researcher',
    displayKey: 'admin.userRewards.researchPublication.displayName',
    descriptionKey: 'admin.userRewards.researchPublication.description',
  },
] as const;

/**
 * Normalize a reward name/slug so that cosmetic variations
 * ("Research Publication Reward", "research_publication_reward",
 * "research-publication-reward", "RESEARCH PUBLICATION REWARD")
 * collapse into a single bucket. We strip whitespace, punctuation,
 * and case before comparison so admins who typed the name slightly
 * differently don't end up with multiple catalog rows.
 */
export const normalizeRewardKey = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');

const CATALOG_NORM_BY_KEY = new Map<string, CatalogEntry>(
  REWARD_CATALOG.map((entry) => [normalizeRewardKey(entry.slug), entry]),
);

/**
 * Resolve a slug to its catalog entry using normalized matching. Falls
 * back to a derived entry for any unknown slug so custom rewards the
 * admin created outside the catalog still render instead of crashing
 * the page.
 */
export const lookupRewardCatalog = (slug: string): CatalogEntry => {
  const known = CATALOG_NORM_BY_KEY.get(normalizeRewardKey(slug));
  if (known) return known;
  return {
    slug,
    role: 'Researcher',
    displayKey: '',
    descriptionKey: '',
  };
};

/**
 * View model consumed by the admin table — one row per catalog reward,
 * with the live BE reward (if any) merged on top. Cosmetic variations
 * of the same slug in the BE all collapse into the single canonical row.
 */
export interface RewardViewRow {
  /** Stable dedupe key (normalized reward name) */
  key: string;
  /** Slug used for mutations (PUT / PATCH / DELETE). The first BE row's
   *  actual `name` so the wire format matches what the BE stored. */
  slug: string;
  /** Catalog-derived role — never null */
  role: RewardRole;
  /** Catalog-derived i18n keys (admin renders the localized value) */
  displayKey: string;
  descriptionKey: string;
  /** Authoritative BE row; null when no row exists yet for this slug */
  reward: UserReward | null;
}

/**
 * Build view rows from the paged BE list. The catalog drives ordering
 * and guarantees the canonical Researcher row always appears, even if
 * the BE has zero rows yet. BE rows that don't match a catalog entry
 * (custom rewards) get their own bucket below.
 */
export const buildRewardView = (rewards: UserReward[]): RewardViewRow[] => {
  // Collapse BE rows by normalized key, keeping the first row we see
  // as the authoritative wire slug for mutations.
  const collapsed = new Map<string, UserReward>();
  rewards.forEach((reward) => {
    const slug = (reward.name ?? '').trim();
    if (!slug) return;
    const key = normalizeRewardKey(slug);
    if (!collapsed.has(key)) collapsed.set(key, reward);
  });

  const result: RewardViewRow[] = [];
  const used = new Set<string>();

  // 1) Catalog entries first so the canonical Researcher reward always
  //    sits at the top of the table.
  REWARD_CATALOG.forEach((entry) => {
    const key = normalizeRewardKey(entry.slug);
    const reward = collapsed.get(key) ?? null;
    result.push({
      key,
      slug: reward?.name ?? entry.slug,
      role: entry.role,
      displayKey: entry.displayKey,
      descriptionKey: entry.descriptionKey,
      reward,
    });
    used.add(key);
  });

  // 2) Custom rewards the admin added outside the catalog — collapsed
  //    by normalized key so two cosmetic dupes become one row.
  collapsed.forEach((reward, key) => {
    if (used.has(key)) return;
    const entry = lookupRewardCatalog(reward.name ?? key);
    result.push({
      key,
      slug: reward.name,
      role: entry.role,
      displayKey: entry.displayKey,
      descriptionKey: entry.descriptionKey,
      reward,
    });
  });

  return result;
};
