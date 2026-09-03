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
import { useI18n } from '../../i18n/I18nContext';
import { OpenAlexBrandLogo } from '../../components/openalex/OpenAlexBrandLogo';
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
const LoadingView = ({ orcidId }: LoadingViewProps) => {
  const { t } = useI18n();
  return (
    <div className={styles.loadingState} role="status" aria-live="polite">
      <Loader2 size={32} className={styles.spinner} aria-hidden="true" />
      <span>{t('admin.orcid.loading').replace('{id}', orcidId)}</span>
    </div>
  );
};

interface NotFoundViewProps {
  orcidId: string;
  onRetry: () => void;
  disabled: boolean;
}
const NotFoundView = ({ orcidId, onRetry, disabled }: NotFoundViewProps) => {
  const { t } = useI18n();
  return (
    <div className={styles.errorState} role="alert">
      <AlertCircle size={36} className={styles.errorIcon} aria-hidden="true" />
      <p className={styles.errorTitle}>{t('admin.orcid.notFoundTitle')}</p>
      <p className={styles.errorMessage}>
        {t('admin.orcid.notFoundMessage').replace('{id}', orcidId)}
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
          {t('admin.orcid.tryAgain')}
        </button>
      </div>
    </div>
  );
};

interface RateLimitViewProps {
  retryAfterSeconds?: number;
  onRetry: () => void;
  disabled: boolean;
}
const RateLimitView = ({ retryAfterSeconds, onRetry, disabled }: RateLimitViewProps) => {
  const { t } = useI18n();
  return (
    <div className={styles.errorState} role="alert">
      <Clock size={36} className={styles.warningIcon} aria-hidden="true" />
      <p className={styles.errorTitle}>{t('admin.orcid.rateLimitTitle')}</p>
      <p className={styles.errorMessage}>
        {retryAfterSeconds
          ? t('admin.orcid.rateLimitMessage').replace('{seconds}', String(retryAfterSeconds))
          : t('admin.orcid.rateLimitMessageFallback')}
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
          {t('admin.orcid.retry')}
        </button>
      </div>
    </div>
  );
};

interface ApiErrorViewProps {
  statusCode: number;
  orcidId: string;
  onRetry: () => void;
  disabled: boolean;
}
const ApiErrorView = ({ statusCode, orcidId, onRetry, disabled }: ApiErrorViewProps) => {
  const { t } = useI18n();
  return (
    <div className={styles.errorState} role="alert">
      <Server size={36} className={styles.errorIcon} aria-hidden="true" />
      <p className={styles.errorTitle}>{t('admin.orcid.lookupFailedTitle')}</p>
      <p className={styles.errorMessage}>
        {t('admin.orcid.lookupFailedMessage').replace('{code}', String(statusCode)).replace('{id}', orcidId)}
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
          {t('admin.orcid.tryAgain')}
        </button>
      </div>
    </div>
  );
};

interface WorkItemProps {
  work: { title: string; year?: number; type?: string; doi?: string; openalexUrl?: string };
  index: number;
}
const WorkItem = ({ work, index }: WorkItemProps) => {
  const { t } = useI18n();
  return (
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
            className={styles.workLinkOpenAlex}
            data-testid={`orcid-work-openalex-${index}`}
          >
            <OpenAlexBrandLogo variant="mark" ariaLabel="OpenAlex" />
            <span>{t('admin.orcid.openAlex')}</span>
          </a>
        )}
      </div>
    </li>
  );
};

interface SuccessViewProps {
  meta: OrcidPersonMetadata;
  orcidId: string;
}
const SuccessView = ({ meta, orcidId }: SuccessViewProps) => {
  const { t } = useI18n();
  const displayName =
    meta.displayName ??
    ([meta.givenNames, meta.familyName].filter(Boolean).join(' ') || orcidId);

  return (
    <div className={styles.successState} data-testid="orcid-check-success">
      {/* Person card */}
      <div className={styles.personCard}>
        {/* Full name */}
        <div className={styles.personCardFull}>
          <span className={styles.personCardLabel}>{t('admin.orcid.person.name')}</span>
          <span className={styles.personCardValue}>{displayName}</span>
        </div>

        {/* ORCID iD */}
        <div className={styles.personCardFull}>
          <span className={styles.personCardLabel}>{t('admin.orcid.person.id')}</span>
          <span className={styles.personCardValueMono}>{meta.orcid}</span>
        </div>

        {/* Country */}
        {meta.country && (
          <div className={styles.personCardItem}>
            <span className={styles.personCardLabel}>{t('admin.orcid.person.country')}</span>
            <span className={styles.personCardValue}>{meta.country}</span>
          </div>
        )}

        {/* Affiliations */}
        {meta.affiliations.length > 0 && (
          <div className={styles.personCardItem}>
            <span className={styles.personCardLabel}>{t('admin.orcid.person.affiliation')}</span>
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
            {t('admin.orcid.person.viewOnOrcid')}
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
            {t('admin.orcid.notice.incomplete')}
          </p>
        </div>
      )}

      {/* Works */}
      <section className={styles.worksSection} aria-labelledby="orcid-works-heading">
        <h3 id="orcid-works-heading" className={styles.worksSectionTitle}>
          {t('admin.orcid.works.title')}
        </h3>
        {meta.works.length > 0 ? (
          <ul className={styles.worksList} data-testid="orcid-works-list">
            {meta.works.map((work, i) => (
              <WorkItem key={i} work={work} index={i} />
            ))}
          </ul>
        ) : (
          <p className={styles.noWorks} data-testid="orcid-no-works">
            {t('admin.orcid.works.noWorks')}
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
  const { t } = useI18n();
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
        <strong>{t('admin.orcid.disclosure.important')}</strong> {t('admin.orcid.disclosure.text')}
      </p>
    </div>
  );
};

interface UnavailableViewProps {
  onClose: () => void;
}
const UnavailableView = ({ onClose }: UnavailableViewProps) => {
  const { t } = useI18n();
  return (
    <div
      className={styles.unavailableState}
      role="status"
      aria-live="polite"
      data-testid="orcid-check-unavailable"
    >
      <ArrowRightLeft size={40} className={styles.unavailableIcon} aria-hidden="true" />
      <p className={styles.unavailableTitle}>
        {t('admin.orcid.unavailable.title')}
      </p>
      <p className={styles.unavailableMessage}>
        {t('admin.orcid.unavailable.message')}
      </p>
      <aside
        className={styles.backendRequest}
        aria-label="Backend team request"
        data-testid="orcid-backend-request"
      >
        <p className={styles.backendRequestTitle}>{t('admin.orcid.unavailable.backendTitle')}</p>
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
        {t('common.close')}
      </button>
    </div>
  );
};

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
  const { t } = useI18n();
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
    [user.roleRequestId],
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
                {t('admin.orcid.title')}
              </h2>
              <p className={styles.subtitle}>
                {t('admin.orcid.subtitle').replace('{name}', user.fullName ?? user.email).replace('{id}', String(user.id))}
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            className={styles.iconButton}
            onClick={onClose}
            type="button"
            aria-label={t('admin.orcid.close')}
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
              <span className={styles.orcidIdLabel}>{t('admin.orcid.person.id')}</span>
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
              {t('common.close')}
            </button>
          </footer>
        )}
      </section>
    </div>
  );
};

export default OrcidCheckModal;
