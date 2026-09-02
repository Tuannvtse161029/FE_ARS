/**
 * ProfileForumSection — shows up to 3 forum posts authored by the profile's
 * user, with a "View all" link to the Forum page (full list of their posts
 * lives behind the My Posts filter on the Forum page itself).
 *
 * Data source: profileExtrasService.fetchUserForumPosts, which uses the
 * existing /api/ForumPost endpoint and filters client-side by authorId.
 */

import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import type { ProfileForumPostPreview } from '../../services/profileExtras.service';
import { formatRelativeTime } from '../../utils/formatDate';
import { ProfileExtrasSection } from './ProfileExtrasSection';
import styles from './ProfileExtrasSection.module.css';

export interface ProfileForumSectionProps {
  posts: ProfileForumPostPreview[];
  isLoading: boolean;
  error: string | null;
  isOwner: boolean;
}

const VIEWER_COPY = 'Recent posts shared in the ARS Forum.';
const OWNER_COPY = 'Your recent Forum activity.';

export const ProfileForumSection = ({
  posts,
  isLoading,
  error,
  isOwner,
}: ProfileForumSectionProps) => {
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
          <MessageSquare size={20} className={styles.extrasEmptyIcon} aria-hidden="true" />
          <p className={styles.extrasEmptyTitle}>Couldn’t load forum posts</p>
          <p>{error}</p>
        </div>
      );
    }

    if (posts.length === 0) {
      return (
        <div className={styles.extrasEmpty} role="status">
          <MessageSquare size={20} className={styles.extrasEmptyIcon} aria-hidden="true" />
          <p className={styles.extrasEmptyTitle}>
            {isOwner ? 'No forum posts yet' : 'No forum posts yet'}
          </p>
          <p>
            {isOwner
              ? 'Posts you publish on the Forum will appear here.'
              : 'This member hasn’t posted on the Forum yet.'}
          </p>
        </div>
      );
    }

    return (
      <ul className={styles.itemList} data-testid="profile-forum-list">
        {posts.map((post) => (
          <li key={post.id}>
            <button
              type="button"
              className={styles.item}
              onClick={() => navigate(`/forum?post=${post.id}`)}
              aria-label={`Open forum post: ${post.title}`}
            >
              <div className={styles.itemHead}>
                <h3 className={styles.itemTitle}>{post.title}</h3>
                {post.createdAt ? (
                  <span className={styles.itemMeta}>
                    {formatRelativeTime(post.createdAt)}
                  </span>
                ) : null}
              </div>
              {post.tags.length > 0 ? (
                <div className={styles.itemTags}>
                  {post.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className={styles.itemTag}>
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className={styles.itemMeta}>
                <span>{post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'}</span>
                <span className={styles.metaDot} aria-hidden="true">·</span>
                <span>
                  {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
                </span>
                {post.category ? (
                  <>
                    <span className={styles.metaDot} aria-hidden="true">·</span>
                    <span>{post.category}</span>
                  </>
                ) : null}
              </div>
            </button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <ProfileExtrasSection
      title="Forum posts"
      subtitle={isOwner ? OWNER_COPY : VIEWER_COPY}
      viewAllHref="/forum"
      data-testid="profile-forum-section"
    >
      {renderBody()}
    </ProfileExtrasSection>
  );
};

export default ProfileForumSection;