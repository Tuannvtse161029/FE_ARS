// Re-exports for hooks barrel
export { useFetch } from './useFetch';
export { useApiCall } from './useApiCall';
export { usePapers } from './usePapers';
export { useMajorFields, useSubFields } from './useMajorFields';
export { useWallet } from './useWallet';
export { useReviewerProfiles, useReviewerAvailability } from './useReviewerProfiles';
export { useFollowers, useFollowReviewer } from './useFollowers';
export { useNotifications, useMarkNotificationRead } from './useNotifications';
export { useUserRoles, useAssignRole } from './useUserRoles';
export { useCommentVotes, useVoteOnComment } from './useCommentVotes';
export { useCreatePaymentLink, useCancelPayment } from './useCreatePaymentLink';
export { useReceiptUpload } from './useReceiptUpload';
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
