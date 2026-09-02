import { hasValidOrcidChecksum, normalizeOrcid } from '../../services/orcid.service';
import { OrcidBrandLogo } from '../orcid/OrcidBrandLogo';
import styles from './OrcidIdentityMarker.module.css';

interface OrcidIdentityMarkerProps {
  orcidId?: string | null;
  isOrcidVerified?: boolean | null;
  /** Renders the full wordmark when true, the circular badge when false. Default false. */
  useWordmark?: boolean;
}

/**
 * Shows the verified ORCID iD badge inline next to a user's name or card.
 * Only renders when the backend has confirmed the ORCID linkage.
 *
 * Visual: renders the ORCID circular "iD" badge (or wordmark when `useWordmark`).
 * Links to the public ORCID record.
 */
export const OrcidIdentityMarker = ({
  orcidId,
  isOrcidVerified,
  useWordmark = false,
}: OrcidIdentityMarkerProps) => {
  const canonicalId = normalizeOrcid(orcidId ?? '');
  if (isOrcidVerified !== true || !canonicalId || !hasValidOrcidChecksum(canonicalId)) return null;

  return (
    <a
      className={styles.marker}
      href={`https://orcid.org/${canonicalId}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`ORCID iD: ${canonicalId}`}
      title={`ORCID iD: ${canonicalId}`}
      data-testid="orcid-identity-marker"
    >
      <OrcidBrandLogo
        variant={useWordmark ? 'wordmark' : 'id'}
        size={useWordmark ? 22 : 16}
        ariaLabel={`ORCID iD: ${canonicalId}`}
        className={styles.logo}
      />
      <span className={styles.srOnly}>ORCID iD connected</span>
    </a>
  );
};