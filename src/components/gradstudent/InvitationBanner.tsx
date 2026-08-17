import { CheckCircle2, Clock, Mail, X, XCircle } from 'lucide-react';
import styles from './InvitationBanner.module.css';

export type InvitationStatus = 'pending' | 'expired' | 'accepted' | 'declined';

export interface InvitationPreview {
  id: string;
  lecturerName: string;
  groupName: string;
  topicTitle?: string;
  sentAt?: string;
  /**
   * Lifecycle state of the invitation. Defaults to `'pending'` so existing
   * callers (Dashboard passes a placeholder object) keep the Accept/Decline
   * affordance. When the BE ships `/api/GroupInvitation` the dashboard will
   * be able to distinguish stale invitations (expired / accepted / declined)
   * and render them as a banner-without-buttons per lead-phase-c-contract.md
   * G7(b).
   */
  status?: InvitationStatus;
}

export interface InvitationBannerProps {
  invitation: InvitationPreview | null;
  onDismiss?: () => void;
  onAccept?: (invitation: InvitationPreview) => void;
  onDecline?: (invitation: InvitationPreview) => void;
}

const STATUS_LABEL: Record<InvitationStatus, string> = {
  pending: 'Pending — awaiting your response',
  expired: 'Expired',
  accepted: 'Accepted',
  declined: 'Declined',
};

const isActionable = (status: InvitationStatus | undefined): boolean =>
  status === undefined || status === 'pending';

// Read-only banner. Per docs/local-only/research-workflow-contract.md §2,
// /api/GroupInvitation is missing from Swagger — the Accept / Decline
// buttons intentionally do NOT issue a network request. We surface the
// disclaimer inline so the gap is obvious to the student.
export function InvitationBanner({
  invitation,
  onDismiss,
  onAccept,
  onDecline,
}: InvitationBannerProps): JSX.Element | null {
  if (!invitation) return null;

  const status: InvitationStatus = invitation.status ?? 'pending';
  const actionable = isActionable(status);

  return (
    <aside role="status" className={styles.banner}>
      <div className={styles.left}>
        <span className={styles.iconCircle} aria-hidden>
          <Mail size={18} />
        </span>
        <div className={styles.text}>
          <h4 className={styles.title}>New group invitation</h4>
          <p className={styles.subtitle}>
            <strong>{invitation.lecturerName}</strong> invited you to join{' '}
            <strong>&ldquo;{invitation.groupName}&rdquo;</strong>
            {invitation.topicTitle ? (
              <>
                {' '}on the topic{' '}
                <strong>&ldquo;{invitation.topicTitle}&rdquo;</strong>
              </>
            ) : null}
            {invitation.sentAt ? (
              <>
                {' '}— sent{' '}
                {new Date(invitation.sentAt).toLocaleDateString('en-US', {
                  dateStyle: 'medium',
                })}
              </>
            ) : null}
          </p>
          {!actionable ? (
            <p
              className={styles.statusPill}
              data-status={status}
              aria-label={`Invitation status: ${STATUS_LABEL[status]}`}
            >
              {status === 'accepted' || status === 'expired' ? (
                <CheckCircle2 size={12} aria-hidden />
              ) : (
                <XCircle size={12} aria-hidden />
              )}
              <span>{STATUS_LABEL[status]}</span>
            </p>
          ) : (
            <p className={styles.disclaimer}>
              Invitations are advisory until the BE endpoint is available.
              Accepting or declining below records your choice locally — it does
              not yet notify the lecturer.
            </p>
          )}
        </div>
      </div>
      <div className={styles.actions}>
        {actionable ? (
          <>
            <button
              type="button"
              className={styles.acceptBtn}
              onClick={() => onAccept?.(invitation)}
              aria-label="Accept invitation"
            >
              Accept
            </button>
            <button
              type="button"
              className={styles.declineBtn}
              onClick={() => onDecline?.(invitation)}
              aria-label="Decline invitation"
            >
              Decline
            </button>
          </>
        ) : (
          <span className={styles.readOnlyHint} aria-hidden>
            <Clock size={12} />
            <span>Read-only</span>
          </span>
        )}
        {onDismiss ? (
          <button
            type="button"
            className={styles.dismissBtn}
            onClick={onDismiss}
            aria-label="Dismiss invitation banner"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
    </aside>
  );
}

export default InvitationBanner;