// Premium Package preview configuration.
//
// UI-only fixture for the user-facing `/premium-packages` page. The backend
// does NOT implement Premium subscriptions yet, so the page must render static
// preview content keyed by role. There is no checkout, no billing, no plan
// persistence, no API call, no entitlement — this file is the single source of
// truth for the preview copy.
//
// Every AI feature description uses "AI-assisted" / "assists" wording. The page
// never claims AI evaluates, grades, or submits on the user's behalf.

export type PremiumPreviewRole =
  | 'Researcher'
  | 'Reviewer'
  | 'Lecturer'
  | 'Graduate Student';

export interface PremiumPreviewFeature {
  id: string;
  title: string;
  description: string;
}

export interface PremiumPreviewConfig {
  heading: string;
  description: string;
  features: PremiumPreviewFeature[];
}

const RESEARCHER_FEATURES: PremiumPreviewFeature[] = [
  {
    id: 'r-quality',
    title: 'AI-assisted manuscript quality insights',
    description:
      'Assists you with surface-level readability and structure observations on draft manuscripts you submit for review.',
  },
  {
    id: 'r-matching',
    title: 'Advanced reviewer matching',
    description:
      'Assists you with broader reviewer recommendations based on topic overlap, prior coverage, and response history.',
  },
  {
    id: 'r-storage',
    title: 'Expanded manuscript storage',
    description:
      'Assists you with retaining more historical manuscript versions and review snapshots on the platform.',
  },
  {
    id: 'r-tracking',
    title: 'Long-horizon review tracking',
    description:
      'Assists you with tracking review timelines, follow-ups, and revision history across active papers.',
  },
];

const REVIEWER_FEATURES: PremiumPreviewFeature[] = [
  {
    id: 'rv-organization',
    title: 'AI-assisted review organization',
    description:
      'Assists you with grouping incoming review requests by topic, urgency, and overlap with prior commitments.',
  },
  {
    id: 'rv-scorecard',
    title: 'Scorecard insight summaries',
    description:
      'Assists you with summarizing patterns in your past evaluations so you can keep your feedback consistent.',
  },
  {
    id: 'rv-earnings',
    title: 'Earnings analytics',
    description:
      'Assists you with visualizing wallet earnings trends across completed reviews, invitations, and bonuses.',
  },
  {
    id: 'rv-history',
    title: 'Expanded review history',
    description:
      'Assists you with retaining a longer archive of past evaluations and reviewer notes on the platform.',
  },
];

const LECTURER_FEATURES: PremiumPreviewFeature[] = [
  {
    id: 'l-milestone',
    title: 'AI-assisted milestone feedback',
    description:
      'Assists you with drafting neutral feedback prompts for graduate students based on the current milestone definition.',
  },
  {
    id: 'l-group',
    title: 'Group analytics',
    description:
      'Assists you with summarizing progress, submission cadence, and overdue tasks across the research groups you supervise.',
  },
  {
    id: 'l-storage',
    title: 'Expanded learning-material storage',
    description:
      'Assists you with retaining longer-lived learning materials and references shared with your supervised groups.',
  },
  {
    id: 'l-reports',
    title: 'Aggregated evaluation reports',
    description:
      'Assists you with rolling up phased-report feedback across students so cohort-level trends are easier to spot.',
  },
];

const STUDENT_FEATURES: PremiumPreviewFeature[] = [
  {
    id: 's-planning',
    title: 'AI-assisted research planning',
    description:
      'Assists you with outlining a phased plan based on the milestone template your lecturer has configured.',
  },
  {
    id: 's-writing',
    title: 'Writing & structure suggestions',
    description:
      'Assists you with surface-level observations on report structure, section ordering, and citation coverage.',
  },
  {
    id: 's-history',
    title: 'Expanded report history',
    description:
      'Assists you with retaining more historical report submissions and feedback revisions on the platform.',
  },
  {
    id: 's-feedback',
    title: 'Feedback digest',
    description:
      'Assists you with summarizing recurring lecturer feedback so you can address repeated notes before the next submission.',
  },
];

// Safe fallback for any role that is not part of the four covered roles.
// The fallback is intentionally generic so that no user — including Admin — sees
// fabricated role-specific copy.
const GENERIC_PREMIUM_FEATURES: PremiumPreviewFeature[] = [
  {
    id: 'g-storage',
    title: 'Expanded platform storage',
    description:
      'Assists you with retaining a longer archive of platform artifacts on your account.',
  },
  {
    id: 'g-dashboard',
    title: 'Insight summaries',
    description:
      'Assists you with surfacing summary views of your recent platform activity.',
  },
  {
    id: 'g-history',
    title: 'Longer activity history',
    description:
      'Assists you with keeping more of your historical activity visible in your account.',
  },
];

export const GENERIC_PREMIUM_CONFIG: PremiumPreviewConfig = {
  heading: 'Premium Preview',
  description: 'Explore planned Premium capabilities.',
  features: GENERIC_PREMIUM_FEATURES,
};

export const PREMIUM_PREVIEW_CONFIG: Record<
  PremiumPreviewRole,
  PremiumPreviewConfig
> = {
  Researcher: {
    heading: 'Premium for Researchers',
    description:
      'Planned Premium capabilities aimed at researchers who submit manuscripts, track reviews, and collaborate across long submission cycles.',
    features: RESEARCHER_FEATURES,
  },
  Reviewer: {
    heading: 'Premium for Reviewers',
    description:
      'Planned Premium capabilities aimed at reviewers who organize their queue, capture consistent feedback, and track earnings.',
    features: REVIEWER_FEATURES,
  },
  Lecturer: {
    heading: 'Premium for Lecturers',
    description:
      'Planned Premium capabilities aimed at lecturers who supervise research groups and evaluate phased report submissions.',
    features: LECTURER_FEATURES,
  },
  'Graduate Student': {
    heading: 'Premium for Graduate Students',
    description:
      'Planned Premium capabilities aimed at graduate students who plan their milestones, draft reports, and act on lecturer feedback.',
    features: STUDENT_FEATURES,
  },
};

export const FREE_TIER_FEATURES: PremiumPreviewFeature[] = [
  {
    id: 'f-forum',
    title: 'Forum access',
    description: 'Read and post in the research community forum.',
  },
  {
    id: 'f-papers',
    title: 'Browse & publish papers',
    description: 'Discover and submit manuscripts using the standard reviewer flow.',
  },
  {
    id: 'f-reviews',
    title: 'Standard review participation',
    description: 'Receive review invitations through the default matching flow.',
  },
  {
    id: 'f-groups',
    title: 'Research group participation',
    description: 'Join and contribute to research groups you have been invited to.',
  },
  {
    id: 'f-wallet',
    title: 'Wallet & withdrawals',
    description: 'Receive review earnings and submit withdrawal requests.',
  },
  {
    id: 'f-storage',
    title: 'Standard storage',
    description: 'Retain a baseline archive of your platform artifacts.',
  },
];

export const resolvePremiumPreviewConfig = (
  role: string | null | undefined,
): PremiumPreviewConfig => {
  if (
    role === 'Researcher' ||
    role === 'Reviewer' ||
    role === 'Lecturer' ||
    role === 'Graduate Student'
  ) {
    return PREMIUM_PREVIEW_CONFIG[role];
  }
  return GENERIC_PREMIUM_CONFIG;
};
