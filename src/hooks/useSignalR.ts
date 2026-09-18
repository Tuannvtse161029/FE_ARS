import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { signalrService } from '../services/signalr.service';
import { storage } from '../utils/storage';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { inferNotificationKind } from '../utils/notificationRouteMap';

export interface UseSignalROptions {
  /** Optional custom handler for incoming ReceiveNotification events */
  onNotification?: (data: unknown) => void;
  /** Optional custom handler for incoming PaperStatusUpdated events */
  onPaperStatusUpdated?: (data: unknown) => void;
  /** Whether to automatically connect on mount if authenticated (default: true) */
  autoConnect?: boolean;
}

/**
 * React hook to manage SignalR connection lifecycle and real-time event listeners.
 *
 * Features:
 * - Automatically starts connection when authenticated with valid token
 * - Guards against duplicate connections across re-renders
 * - Listens to `ReceiveNotification` and displays a floating Toast via `sonner`
 * - Listens to `PaperStatusUpdated` and dispatches updates
 * - Automatically cleans up listeners and disconnects on unmount or logout
 */
export function useSignalR(options: UseSignalROptions = {}): {
  connectionState: ReturnType<typeof signalrService.getState>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const { isAuthenticated, user } = useAuth();
  const { t } = useI18n();
  const { onNotification, onPaperStatusUpdated, autoConnect = true } = options;

  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  const onPaperStatusUpdatedRef = useRef(onPaperStatusUpdated);
  onPaperStatusUpdatedRef.current = onPaperStatusUpdated;

  useEffect(() => {
    if (!autoConnect) return;

    const token = storage.getToken();
    const hasAuth = Boolean(token && (isAuthenticated || Boolean(user?.userId)));

    if (!hasAuth) {
      void signalrService.stop();
      return;
    }

    // Connect to SignalR hub
    void signalrService.start().catch((err) => {
      if (import.meta.env.DEV) {
        console.warn('[useSignalR] Failed to start connection:', err);
      }
    });

    // Event listener: ReceiveNotification
    const unsubNotification = signalrService.onReceiveNotification((data: unknown) => {
      try {
        let message = '';
        if (typeof data === 'string') {
          message = data;
        } else if (data && typeof data === 'object' && 'message' in data) {
          message = String((data as { message: unknown }).message ?? '');
        }

        const kind = inferNotificationKind(message);
        const title = resolveNotificationTitle(kind, t);

        // Display floating toast notification at corner
        toast.info(title, {
          description: message || t('notif.newMessage', 'You have a new notification.'),
          duration: 5000,
        });
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[useSignalR] Error presenting notification toast:', err);
        }
      }

      onNotificationRef.current?.(data);
    });

    // Event listener: PaperStatusUpdated
    const unsubPaperStatus = signalrService.onPaperStatusUpdated((data: unknown) => {
      onPaperStatusUpdatedRef.current?.(data);
    });

    return () => {
      unsubNotification();
      unsubPaperStatus();
    };
  }, [autoConnect, isAuthenticated, user, t]);

  return {
    connectionState: signalrService.getState(),
    start: () => signalrService.start(),
    stop: () => signalrService.stop(),
  };
}

/**
 * Helper to map notification kind to localized title heading.
 */
function resolveNotificationTitle(
  kind: ReturnType<typeof inferNotificationKind>,
  t: (key: string, fallback?: string) => string,
): string {
  switch (kind) {
    case 'paper-status-changed':
      return t('notif.paperStatusUpdated', 'Paper status updated');
    case 'review-request-accepted':
      return t('notif.reviewRequestAccepted', 'Review request accepted');
    case 'review-request-rejected':
      return t('notif.reviewRequestRejected', 'Review request rejected');
    case 'review-request-started':
      return t('notif.reviewStarted', 'Review started');
    case 'review-request-completed':
      return t('notif.reviewCompleted', 'Review completed');
    case 'paper-needs-revision':
      return t('notif.paperNeedsRevision', 'Paper needs revision');
    case 'paper-authorship-verified':
      return t('notif.paperAuthorshipVerified', 'Authorship confirmed');
    case 'paper-authorship-rejected':
      return t('notif.paperAuthorshipRejected', 'Authorship rejected');
    case 'review-result-available':
      return t('notif.reviewResultAvailable', 'Review result available');
    case 'new-review-request':
      return t('notif.newReviewRequest', 'New review request');
    case 'review-request-cancelled':
      return t('notif.reviewRequestCancelled', 'Review request cancelled');
    case 'review-deadline-reminder':
      return t('notif.reviewDeadlineReminder', 'Review deadline reminder');
    case 'student-report-submitted':
      return t('notif.reportSubmitted', 'Report submitted');
    case 'student-report-resubmitted':
      return t('notif.reportResubmitted', 'Report resubmitted');
    case 'student-topic-requested':
      return t('notif.topicRequested', 'Topic requested');
    case 'seminar-participant-response':
      return t('notif.seminarResponse', 'Seminar participant response');
    case 'seminar-feedback-available':
      return t('notif.seminarFeedback', 'Seminar feedback available');
    case 'group-membership-response':
      return t('notif.membershipResponse', 'Group membership response');
    case 'seminar-invitation':
      return t('notif.seminarInvitation', 'Seminar invitation');
    case 'seminar-schedule-update':
      return t('notif.seminarSchedule', 'Seminar schedule update');
    case 'added-to-research-group':
      return t('notif.addedToGroup', 'Added to research group');
    case 'topic-assigned':
      return t('notif.topicAssigned', 'Topic assigned');
    case 'group-invitation':
      return t('notif.groupInvitation', 'Group invitation');
    case 'milestone-opened':
      return t('notif.milestoneOpened', 'Milestone opened');
    case 'learning-material-available':
      return t('notif.materialAvailable', 'Learning material available');
    case 'learning-material-unshared':
      return t('notif.materialUnshared', 'Learning material unshared');
    case 'report-evaluated':
      return t('notif.reportEvaluated', 'Report evaluated');
    case 'report-rejected':
      return t('notif.reportRejected', 'Report rejected');
    case 'role-request-submitted':
      return t('notif.roleRequestSubmitted', 'Role request submitted');
    case 'violation-report-submitted':
      return t('notif.violationReportSubmitted', 'Violation report submitted');
    case 'account-management-event':
      return t('notif.accountManagement', 'Account management event');
    case 'role-request-accepted':
      return t('notif.roleRequestAccepted', 'Role request accepted');
    case 'role-request-rejected':
      return t('notif.roleRequestRejected', 'Role request rejected');
    case 'account-status-changed':
      return t('notif.accountStatusChanged', 'Account status changed');
    case 'group-join-accepted':
      return t('notif.groupJoinAccepted', 'Group join accepted');
    case 'group-join-rejected':
      return t('notif.groupJoinRejected', 'Group join rejected');
    case 'group-member-accepted':
      return t('notif.groupMemberAccepted', 'Group member accepted');
    case 'topic-completed':
      return t('notif.topicCompleted', 'Topic completed');
    default:
      return t('notif.title', 'Notification');
  }
}

export default useSignalR;
