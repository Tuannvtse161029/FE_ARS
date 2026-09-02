/**
 * ProfilePublicationsSection — shows up to 3 published papers authored by
 * the profile's user, with a "View all" link to the research catalog
 * filtered by author id (when supported) or the catalog root.
 *
 * Data source: profileExtrasService.fetchUserPublications, which uses the
 * existing /api/Paper endpoint and filters client-side by authorId.
 */

import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import type { ProfilePublicationPreview } from '../../services/profileExtras.service';
import { formatRelativeTime } from '../../utils/formatDate';
import { ProfileExtrasSection } from './ProfileExtrasSection';
import styles from './ProfileExtrasSection.module.css';

export interface ProfilePublicationsSectionProps {
  publications: ProfilePublicationPreview[];
  /** True while the service call is in flight. */
  isLoading: boolean;
  /** Error message from the service call (or null). */
  error: string | null;
  /** True when the viewer is the owner of this profile. */
  isOwner: boolean;
}

const VIEWER_COPY = 'Research catalog entries authored by this member.';
const OWNER_COPY = 'Your published papers on the ARS research catalog.';

export const ProfilePublicationsSection = ({
  publications,
  isLoading,
  error,
  isOwner,
}: ProfilePublicationsSectionProps) => {
  const navigate = useNavigate();

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className={styles.skeleton} aria-hidden="true">
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.extrasEmpty} role="status">
          <BookOpen size={20} className={styles.extrasEmptyIcon} aria-hidden="true" />
          <p className={styles.extrasEmptyTitle}>Couldn’t load publications</p>
          <p>{error}</p>
        </div>
      );
    }

    if (publications.length === 0) {
      return (
        <div className={styles.extrasEmpty} role="status">
          <BookOpen size={20} className={styles.extrasEmptyIcon} aria-hidden="true" />
          <p className={styles.extrasEmptyTitle}>
            {isOwner ? 'No publications yet' : 'No publications yet'}
          </p>
          <p>
            {isOwner
              ? 'Papers you publish will appear here once they pass editorial review.'
              : 'This member hasn’t published a paper yet.'}
          </p>
        </div>
      );
    }

    return (
      <ul className={styles.itemList} data-testid="profile-publications-list">
        {publications.map((paper) => (
          <li key={paper.id}>
            <button
              type="button"
              className={styles.item}
              onClick={() => navigate(`/papers/${paper.id}`)}
              aria-label={`Open ${paper.title}`}
            >
              <div className={styles.itemHead}>
                <h3 className={styles.itemTitle}>{paper.title}</h3>
                {paper.publishedAt ? (
                  <span className={styles.itemMeta}>
                    {formatRelativeTime(paper.publishedAt)}
                  </span>
                ) : null}
              </div>
              {paper.abstract ? (
                <p className={styles.itemAbstract}>{paper.abstract}</p>
              ) : null}
              {paper.doi ? (
                <div className={styles.itemMeta}>
                  <span>DOI</span>
                  <span className={styles.metaDot} aria-hidden="true">·</span>
                  <span>{paper.doi}</span>
                </div>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <ProfileExtrasSection
      title="Published papers"
      subtitle={isOwner ? OWNER_COPY : VIEWER_COPY}
      viewAllHref="/home"
      data-testid="profile-publications-section"
    >
      {renderBody()}
    </ProfileExtrasSection>
  );
};

export default ProfilePublicationsSection;