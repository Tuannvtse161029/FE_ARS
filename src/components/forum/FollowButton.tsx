import { memo, useMemo } from 'react';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import styles from './FollowButton.module.css';
import { useFollow } from '../../hooks/useFollow';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { readStoredUser, type StoredUserShape } from '../../utils/storedUser';

export interface FollowButtonProps {
  /** The user that the viewer would follow / unfollow when clicking the button. */
  authorId: number;
  /** Optional size variant. `sm` matches the post-card author row. */
  size?: 'sm' | 'md';
  /** Optional className passthrough for layout-level positioning. */
  className?: string;
}

// FollowButton — pill-shaped toggle shown next to a post author. Renders:
//
//   - "Follow"   (outlined, blue) when the viewer is NOT following them
//   - "Following"(filled,   blue) when the viewer IS following them
//   - Spinner / disabled          during the API request
//   - Disabled (grayed)          when the viewer cannot follow
//                                (unauthenticated, unverified, self)
//
// The component is memoised so re-rendering the parent (e.g. comment
// expansion) doesn't refire the hook's internal state.
export const FollowButton = memo(function FollowButton({
  authorId,
  size = 'sm',
  className,
}: FollowButtonProps) {
  const { isAuthenticated, user } = useAuth();
  const { isVerified } = usePermissions();
  const { isFollowing, toggleFollow, isMutating } = useFollow();

  // The viewer's id — read from the auth context first, then the
  // persisted blob (so the disabled state resolves on the first render
  // before Zustand has rehydrated). This is purely for the disabled UI;
  // the hook itself owns the actual follow / unfollow calls.
  // The default StoredUserShape doesn't include `id`; widen it locally so
  // we can read the viewer's id from the persisted blob (the disabled UI
  // resolves on the first render before Zustand has rehydrated).
  const stored = readStoredUser<StoredUserShape & { id?: number }>();
  const currentUserId = user?.userId ?? stored?.id ?? null;

  const following = isFollowing(authorId);
  const isSelf = currentUserId != null && currentUserId === authorId;
  const disabled = !isAuthenticated || !isVerified || isSelf || isMutating;

  const tooltip = !isAuthenticated
    ? 'Sign in to follow authors'
    : !isVerified
      ? 'Account pending verification'
      : isSelf
        ? 'You cannot follow yourself'
        : following
          ? 'Unfollow this author'
          : 'Follow this author';

  const handleClick = async () => {
    if (disabled) return;
    await toggleFollow(authorId);
  };

  const classNames = useMemo(
    () =>
      [
        styles.button,
        size === 'md' ? styles.sizeMd : styles.sizeSm,
        following ? styles.following : styles.follow,
        disabled ? styles.disabled : '',
        className,
      ]
        .filter(Boolean)
        .join(' '),
    [size, following, disabled, className],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={following}
      aria-label={following ? 'Unfollow author' : 'Follow author'}
      title={tooltip}
      className={classNames}
    >
      {isMutating ? (
        <Loader2 size={size === 'md' ? 16 : 14} className={styles.spinner} />
      ) : following ? (
        <UserCheck size={size === 'md' ? 16 : 14} />
      ) : (
        <UserPlus size={size === 'md' ? 16 : 14} />
      )}
      <span className={styles.label}>
        {following ? 'Following' : 'Follow'}
      </span>
    </button>
  );
});

export default FollowButton;