import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  Clock,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  Server,
  X,
} from 'lucide-react';
import {
  lookupOrcid,
  normalizeOrcid,
  OrcidCheckFeatureDisabledError,
  type OrcidLookupResponse,
  type OrcidPersonMetadata,
} from '../../services/orcid.service';
import styles from './OrcidCheckModal.module.css';

// ── ORCID "O" SVG logo (official mark, no credentials needed) ────────────────
const ORCID_LOGO_SVG = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 256 256"
    aria-hidden="true"
    focusable="false"
    className={styles.orcidLogo}
  >
    {/* Dark green circle background */}
    <circle cx="128" cy="128" r="128" fill="#A6CE39" />
    {/* White "O" letterform */}
    <text
      x="128"
      y="158"
      textAnchor="middle"
      fontFamily="serif"
      fontSize="140"
      fontWeight="bold"
      fill="#fff"
    >
      iD
    </text>
  </svg>
);

// ── Sub-components ─────────────────────────────────────────────────────────────

interface LoadingViewProps {
  orcidId: string;
}
const LoadingView = ({ orcidId }: LoadingViewProps) => (
  <div className={styles.loadingState} role="status" aria-live="polite">
    <Loader2 size={32} className={styles.spinner} aria-hidden="true" />
    <span>Looking up ORCID iD <strong>{orcidId}</strong>…</span>
  </div>
);

interface NotFoundViewProps {
  orcidId: string;
  onRetry: () => void;
  disabled: boolean;
}
const NotFoundView = ({ orcidId, onRetry, disabled }: NotFoundViewProps) => (
  <div className={styles.errorState} role="alert">
    <AlertCircle size={36} className={styles.errorIcon} aria-hidden="true" />
    <p className={styles.errorTitle}>No record found</p>
    <p className={styles.errorMessage}>
      No public ORCID record was found for <strong>{orcidId}</strong>.
      The iD may be incorrect, or the record may be set to private.
    </p>
    <div className={styles.errorAction}>
      <button
        className={styles.btnRetry}
        onClick={onRetry}
        type="button"
        disabled={disabled}
        data-testid="orcid-check-retry"
      >
        <RefreshCw size={14} aria-hidden="true" />
        Try again
      </button>
    </div>
  </div>
);

interface RateLimitViewProps {
  retryAfterSeconds?: number;
  onRetry: () => void;
  disabled: boolean;
}
const RateLimitView = ({ retryAfterSeconds, onRetry, disabled }: RateLimitViewProps) => (
  <div className={styles.errorState} role="alert">
    <Clock size={36} className={styles.errorIcon} aria-hidden="true" style={{ color: '#d97706' }} />
    <p className={styles.errorTitle}>Rate limit reached</p>
    <p className={styles.errorMessage}>
      The ORCID API rate limit has been reached.
      {retryAfterSeconds
        ? ` Please wait about ${retryAfterSeconds} seconds before trying again.`
        : ' Please wait a moment before trying again.'}
    </p>
    <div className={styles.errorAction}>
      <button
        className={styles.btnRetry}
        onClick={onRetry}
        type="button"
        disabled={disabled}
        data-testid="orcid-check-retry"
      >
        <RefreshCw size={14} aria-hidden="true" />
        Retry
      </button>
    </div>
  </div>
);

interface ApiErrorViewProps {
  statusCode: number;
  orcidId: string;
  onRetry: () => void;
  disabled: boolean;
}
const ApiErrorView = ({ statusCode, orcidId, onRetry, disabled }: ApiErrorViewProps) => (
  <div className={styles.errorState} role="alert">
    <Server size={36} className={styles.errorIcon} aria-hidden="true" />
    <p className={styles.errorTitle}>Lookup failed</p>
    <p className={styles.errorMessage}>
      The ORCID lookup service returned an unexpected error ({statusCode}) for iD{' '}
      <strong>{orcidId}</strong>. This may be a temporary service issue.
    </p>
    <div className={styles.errorAction}>
      <button
        className={styles.btnRetry}
        onClick={onRetry}
        type="button"
        disabled={disabled}
        data-testid="orcid-check-retry"
      >
        <RefreshCw size={14} aria-hidden="true" />
        Try again
      </button>
    </div>
  </div>
);

interface WorkItemProps {
  work: { title: string; year?: number; type?: string; doi?: string; openalexUrl?: string };
  index: number;
}
const WorkItem = ({ work, index }: WorkItemProps) => (
  <li className={styles.workItem} data-testid={`orcid-work-item-${index}`}>
    <p className={styles.workItemTitle}>{work.title}</p>
    <div className={styles.workItemMeta}>
      {work.year && (
        <span className={styles.workMetaChip}>{work.year}</span>
      )}
      {work.type && (
        <span className={styles.workMetaChip}>{work.type}</span>
      )}
      {work.doi && (
        <a
          href={`https://doi.org/${work.doi}`}
          target="_blank"
          rel="noreferrer noopener"
          className={styles.workLink}
          data-testid={`orcid-work-doi-${index}`}
        >
          DOI
        </a>
      )}
      {work.openalexUrl && (
        <a
          href={work.openalexUrl}
          target="_blank"
          rel="noreferrer noopener"
          className={styles.workLink}
          data-testid={`orcid-work-openalex-${index}`}
        >
          OpenAlex
        </a>
      )}
    </div>
  </li>
);

interface SuccessViewProps {
  meta: OrcidPersonMetadata;
  orcidId: string;
}
const SuccessView = ({ meta, orcidId }: SuccessViewProps) => {
  const displayName =
    meta.displayName ??
    ([meta.givenNames, meta.familyName].filter(Boolean).join(' ') || orcidId);

  return (
    <div className={styles.successState} data-testid="orcid-check-success">
      {/* Person card */}
      <div className={styles.personCard}>
        {/* Full name */}
        <div className={styles.personCardFull}>
          <span className={styles.personCardLabel}>Name</span>
          <span className={styles.personCardValue}>{displayName}</span>
        </div>

        {/* ORCID iD */}
        <div className={styles.personCardFull}>
          <span className={styles.personCardLabel}>ORCID iD</span>
          <span className={styles.personCardValueMono}>{meta.orcid}</span>
        </div>

        {/* Country */}
        {meta.country && (
          <div className={styles.personCardItem}>
            <span className={styles.personCardLabel}>Country</span>
            <span className={styles.personCardValue}>{meta.country}</span>
          </div>
        )}

        {/* Affiliations */}
        {meta.affiliations.length > 0 && (
          <div className={styles.personCardItem}>
            <span className={styles.personCardLabel}>Affiliation</span>
            <span className={styles.personCardValue}>
              {meta.affiliations.join(', ')}
            </span>
          </div>
        )}

        {/* ORCID profile link */}
        <div className={styles.personCardFull}>
          <a
            href={meta.orcidUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={styles.orcidLink}
            data-testid="orcid-profile-link"
          >
            <ExternalLink size={13} aria-hidden="true" />
            View on ORCID.org
          </a>
        </div>
      </div>

      {/* Incomplete / unverified notice */}
      {meta.isIncomplete && (
        <div
          className={styles.disclosure}
          role="note"
          data-testid="orcid-incomplete-notice"
        >
          <Info size={16} className={styles.disclosureIcon} aria-hidden="true" />
          <p className={styles.disclosureText}>
            This ORCID record appears incomplete (name, affiliation, or email is
            not publicly visible). Public metadata does not verify ownership of
            the account on this platform.
          </p>
        </div>
      )}

      {/* Works */}
      <section className={styles.worksSection} aria-labelledby="orcid-works-heading">
        <h3 id="orcid-works-heading" className={styles.worksSectionTitle}>
          Recent Works
        </h3>
        {meta.works.length > 0 ? (
          <ul className={styles.worksList} data-testid="orcid-works-list">
            {meta.works.map((work, i) => (
              <WorkItem key={i} work={work} index={i} />
            ))}
          </ul>
        ) : (
          <p className={styles.noWorks} data-testid="orcid-no-works">
            No public works found for this record.
          </p>
        )}
      </section>
    </div>
  );
};

interface DisclosureProps {
  visible: boolean;
}
const DisclosureBlock = ({ visible }: DisclosureProps) => {
  if (!visible) return null;
  return (
    <div
      className={styles.disclosure}
      role="note"
      aria-label="Important notice"
      data-testid="orcid-disclosure"
    >
      <Info size={16} className={styles.disclosureIcon} aria-hidden="true" />
      <p className={styles.disclosureText}>
        <strong>Important:</strong> Public ORCID metadata is informational only.
        Matching the name on this record to the applicant does not prove they own
        the ORCID iD. A determined bad actor can create an ORCID record with any
        name. ORCID data must be considered alongside other verification evidence
        (PDF proof document, institutional affiliation, etc.) when making
        approval decisions.
      </p>
    </div>
  );
};

interface UnavailableViewProps {
  onClose: () => void;
}
const UnavailableView = ({ onClose }: UnavailableViewProps) => (
  <div
    className={styles.unavailableState}
    role="status"
    aria-live="polite"
    data-testid="orcid-check-unavailable"
  >
    <ArrowRightLeft size={40} className={styles.unavailableIcon} aria-hidden="true" />
    <p className={styles.unavailableTitle}>
      ORCID Check needs a role request ID
    </p>
    <p className={styles.unavailableMessage}>
      The backend lookup is available, but this record does not include the
      role-request identifier required to correlate the verified ORCID.
    </p>
    <aside
      className={styles.backendRequest}
      aria-label="Backend team request"
      data-testid="orcid-backend-request"
    >
      <p className={styles.backendRequestTitle}>Backend Team Request</p>
      <ol className={styles.backendRequestList}>
        <li>
          Expose <code>roleRequestId</code> on the Admin role-request response,
          or allow the lookup endpoint to resolve it from a user ID.
        </li>
        <li>
          Keep provider calls server-side and use the documented
          <code>POST /api/Admin/orcid-lookup</code> contract.
        </li>
        <li>
          Return the documented <code>OrcidLookupResponse</code> payload.
        </li>
        <li>
          Track the remaining frontend/BE correlation work in{' '}
          <code>tickets/backend/BE_ADMIN_ORCID_ROLE_REQUEST_ID_TICKET.md</code>.
        </li>
      </ol>
    </aside>
    <button
      className={`${styles.button} ${styles.secondaryButton}`}
      onClick={onClose}
      type="button"
      data-testid="orcid-check-unavailable-close"
    >
      Close
    </button>
  </div>
);

// ── Modal ──────────────────────────────────────────────────────────────────────

export interface OrcidCheckModalProps {
  /** User object from the Role Requests row */
  user: { id: number; roleRequestId?: number | null; fullName?: string | null; email: string; orcidId?: string | null };
  /** Whether the modal is open */
  open: boolean;
  /** Called when the modal should close */
  onClose: () => void;
}

type ModalState =
  | 'idle'
  | 'loading'
  | 'success'
  | 'not_found'
  | 'rate_limited'
  | 'api_error'
  | 'unavailable';

export const OrcidCheckModal = ({ user, open, onClose }: OrcidCheckModalProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  const [state, setState] = useState<ModalState>('idle');
  const [meta, setMeta] = useState<OrcidPersonMetadata | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [lookupId, setLookupId] = useState('');

  // ── Keyboard / focus management ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // ── Reset on open ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setState('idle');
    setMeta(null);
    setError(null);

    const orcid = normalizeOrcid(user.orcidId ?? '');
    if (!orcid) {
      setState('unavailable');
    } else {
      setLookupId(orcid);
      // Auto-trigger lookup when modal opens
      void performLookup(orcid);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Lookup ──────────────────────────────────────────────────────────────────
  const performLookup = useCallback(
    async (orcid: string) => {
      setState('loading');
      setMeta(null);
      setError(null);

      try {
        const response: OrcidLookupResponse = await lookupOrcid(orcid, user.roleRequestId ?? undefined);

        if (response.status === 'success') {
          setMeta(response.meta);
          setState('success');
        } else if (response.status === 'not_found') {
          setState('not_found');
        } else if (response.status === 'rate_limited') {
          setState('rate_limited');
        } else if (response.status === 'api_error') {
          setState('api_error');
        } else {
          setState('api_error');
        }
      } catch (err) {
        if (err instanceof OrcidCheckFeatureDisabledError) {
          setState('unavailable');
        } else {
          setState('api_error');
          setError({
            title: 'Unexpected error',
            message:
              err instanceof Error
                ? err.message
                : 'An unknown error occurred during the ORCID lookup.',
          });
        }
      }
    },
    [],
  );

  const handleRetry = useCallback(() => {
    if (lookupId) void performLookup(lookupId);
  }, [lookupId, performLookup]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="orcid-check-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className={styles.modal}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            {ORCID_LOGO_SVG}
            <div>
              <h2 id="orcid-check-title" className={styles.title}>
                ORCID Check
              </h2>
              <p className={styles.subtitle}>
                {user.fullName ?? user.email} &mdash; User #{user.id}
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            className={styles.iconButton}
            onClick={onClose}
            type="button"
            aria-label="Close ORCID check"
            data-testid="orcid-check-close"
          >
            <X size={18} />
          </button>
        </header>

        {/* Body */}
        <div className={styles.body}>
          {/* ORCID ID display (shown when we have a valid ID) */}
          {lookupId && (
            <div className={styles.orcidIdRow}>
              <span className={styles.orcidIdLabel}>ORCID iD</span>
              <span className={styles.orcidIdValue}>{lookupId}</span>
            </div>
          )}

          {/* Disclosure notice (shown in loading, success, failure states) */}
          <DisclosureBlock
            visible={
              state !== 'idle' &&
              state !== 'unavailable'
            }
          />

          {/* State renderer */}
          {state === 'idle' && null}

          {state === 'unavailable' && <UnavailableView onClose={onClose} />}

          {state === 'loading' && <LoadingView orcidId={lookupId} />}

          {state === 'success' && meta && (
            <SuccessView meta={meta} orcidId={lookupId} />
          )}

          {state === 'not_found' && (
            <NotFoundView
              orcidId={lookupId}
              onRetry={handleRetry}
              disabled={false}
            />
          )}

          {state === 'rate_limited' && (
            <RateLimitView
              onRetry={handleRetry}
              disabled={false}
            />
          )}

          {state === 'api_error' && (
            <ApiErrorView
              statusCode={(error as { statusCode?: number })?.statusCode ?? 0}
              orcidId={lookupId}
              onRetry={handleRetry}
              disabled={false}
            />
          )}
        </div>

        {/* Footer */}
        {(state === 'idle' || state === 'loading') && (
          <footer className={styles.footer}>
            <button
              className={`${styles.button} ${styles.secondaryButton}`}
              onClick={onClose}
              type="button"
              disabled={state === 'loading'}
              data-testid="orcid-check-close-footer"
            >
              Close
            </button>
          </footer>
        )}
      </section>
    </div>
  );
};

export default OrcidCheckModal;
