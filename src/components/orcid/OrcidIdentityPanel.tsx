import { useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { startAccountOrcidLink } from '../../services/orcid.service';
import { Button } from '../Button';
import { useOrcidIdentity } from '../../hooks/useOrcidIdentity';
import { OrcidBrandLogo } from './OrcidBrandLogo';
import styles from './OrcidIdentityPanel.module.css';

interface OrcidIdentityPanelProps {
  required?: boolean;
  onStatusChange?: (linked: boolean, orcidId: string | null) => void;
}

/**
 * Presents only backend-confirmed linkage. Connecting and disconnecting are
 * intentionally unavailable until the backend defines their redirect/result and
 * unlink contracts. This avoids handling OAuth codes in React or asserting a
 * local connection state.
 *
 * Visual identity: ORCID is a third-party identity provider. The panel uses
 * the official ORCID brand green (#A6CE39) and renders the ORCID iD logo
 * alongside every action so users immediately understand which service they
 * are being asked to connect to.
 */
export const OrcidIdentityPanel = ({ required = false, onStatusChange }: OrcidIdentityPanelProps) => {
  const { status, isLoading, error, refetch } = useOrcidIdentity();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const linked = status?.isConnected === true && status.isVerified === true && Boolean(status.orcidId);

  const notify = async () => {
    const next = await refetch();
    onStatusChange?.(
      next?.isConnected === true && next.isVerified === true && Boolean(next.orcidId),
      next?.orcidId ?? null,
    );
  };

  const startConnection = async () => {
    setConnectError(null);
    setIsConnecting(true);
    try {
      await startAccountOrcidLink();
    } catch (cause: unknown) {
      setConnectError(cause instanceof Error ? cause.message : 'Unable to start ORCID connection. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  if (isLoading && !status) {
    return (
      <section className={styles.panel} aria-label="ORCID identity">
        <div className={styles.loadingRow}>
          <OrcidBrandLogo size={24} ariaLabel="ORCID iD" />
          <p role="status">Checking ORCID connection…</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`${styles.panel} ${linked ? styles.panelLinked : styles.panelUnlinked}`}
      aria-label="ORCID identity"
      data-testid="orcid-identity-panel"
    >
      <div className={styles.heading}>
        <div className={styles.headingLeft}>
          <OrcidBrandLogo
            size={32}
            ariaLabel="ORCID iD"
            className={styles.brandLogo}
          />
          <div>
            <h2 className={styles.headingTitle}>ORCID iD</h2>
            <p className={styles.headingSubtitle}>
              {required
                ? 'A verified ORCID iD is required for Reviewer requests.'
                : 'An ORCID iD is optional for this role.'}
            </p>
          </div>
        </div>
        <span
          className={linked ? styles.verified : styles.unlinked}
          data-testid="orcid-link-status"
        >
          {linked ? 'Verified' : 'Not connected'}
        </span>
      </div>

      {linked ? (
        <div className={styles.record}>
          <span className={styles.orcidId}>{status?.orcidId}</span>
          <a
            href={`https://orcid.org/${encodeURIComponent(status?.orcidId ?? '')}`}
            target="_blank"
            rel="noreferrer"
            className={styles.recordLink}
          >
            View public record <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      ) : (
        <p className={styles.detail}>
          ORCID is a third-party identity provider used by researchers worldwide.
          Click <strong>Connect ORCID iD</strong> below — we will redirect you to
          the official ORCID site to authorize this connection. ARS never collects
          ORCID credentials or stores provider tokens in this browser.
        </p>
      )}

      {error ? <p className={styles.error} role="alert">{error.message}</p> : null}
      {connectError ? <p className={styles.error} role="alert">{connectError}</p> : null}

      <div className={styles.actions}>
        {!linked ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            leftIcon={<OrcidBrandLogo size={18} ariaLabel="ORCID iD" />}
            onClick={() => void startConnection()}
            isLoading={isConnecting}
            disabled={isLoading}
            className={styles.connectButton}
            data-testid="orcid-connect-button"
          >
            Connect ORCID iD
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<RefreshCw size={14} />}
          onClick={() => void notify()}
          isLoading={isLoading}
        >
          Refresh status
        </Button>
        {linked ? (
          <span className={styles.contractNotice}>
            Disconnect is unavailable because no backend unlink endpoint is documented.
          </span>
        ) : null}
      </div>
    </section>
  );
};

export default OrcidIdentityPanel;