import { Fingerprint } from 'lucide-react';
import { hasValidOrcidChecksum, normalizeOrcid } from '../../services/orcid.service';
import styles from './OrcidIdentityMarker.module.css';

interface OrcidIdentityMarkerProps {
  orcidId?: string | null;
  isOrcidVerified?: boolean | null;
}

/** Shows a public ORCID link only when the backend confirms linkage. */
export const OrcidIdentityMarker = ({ orcidId, isOrcidVerified }: OrcidIdentityMarkerProps) => {
  const canonicalId = normalizeOrcid(orcidId ?? '');
  if (isOrcidVerified !== true || !canonicalId || !hasValidOrcidChecksum(canonicalId)) return null;

  return (
    <a
      className={styles.marker}
      href={`https://orcid.org/${canonicalId}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="ORCID iD connected"
      title="ORCID iD connected"
      data-testid="orcid-identity-marker"
    >
      <Fingerprint size={13} aria-hidden="true" />
      <span className={styles.srOnly}>ORCID iD connected</span>
    </a>
  );
};
