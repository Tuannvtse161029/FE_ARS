// Re-exports for hooks barrel
export { useFetch } from './useFetch';
export { useApiCall } from './useApiCall';
export { useMajorFields, useSubFields } from './useMajorFields';
export { useReviewerProfiles, useReviewerAvailability } from './useReviewerProfiles';
export { useFollowers, useFollowReviewer, useFollowCounts } from './useFollowers';
// useFollow — Agent 34: forum follow / unfollow hook with optimistic UI
// updates, self-follow guard, and auth-transition-driven refetch.
export { useFollow } from './useFollow';
export { useNotifications, useMarkNotificationRead } from './useNotifications';
export type { UseNotificationsResult } from './useNotifications';
export { useUserRoles, useAssignRole } from './useUserRoles';
export { useCommentVotes, useVoteOnComment } from './useCommentVotes';
export { useForumPosts, useCreateForumPost } from './useForumPosts';
export { useForumComments, useForumCommentMutations } from './useForumComments';
export { useImageUpload } from './useImageUpload';
export { useAdminGuard } from './useAdminGuard';
export { useVerifiedGuard } from './useVerifiedGuard';
export { usePermissions } from './usePermissions';
// Lecturer ↔ Graduate Student workflow hooks (Agent 2 / GradStudent):
export { usePhasedReports } from './usePhasedReports';
export { useSubmitPhasedReport } from './useSubmitPhasedReport';
export { useStudentGroups } from './useStudentGroups';
export { useGuidanceProjects } from './useGuidanceProjects';
export { useResearchTopics } from './useResearchTopics';
export { useResearchGroups } from './useResearchGroups';
export { useEvaluatePhasedReport } from './useEvaluatePhasedReport';
export { useLearningMaterials } from './useLearningMaterials';
// useLecturerProfile — opt-in real-name lookup hook for Lecturer detail
// panels. Added in Phase C (Lead, lead-phase-c-contract.md S-8). Internally
// calls userService.getById and caches per id.
export { useLecturerProfile } from './useLecturerProfile';
// Agent 15 — Table pagination helper.
export { usePagination } from './usePagination';
export type { UsePaginationResult } from './usePagination';
