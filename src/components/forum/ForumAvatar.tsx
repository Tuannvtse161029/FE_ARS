// ForumAvatar — small wrapper around `<AvatarVisual>` for Forum surfaces
// (post bylines + comment bylines). Centralises the "image-or-initials"
// rendering so every forum byline looks identical.
//
// Why this component exists:
//
//   The Forum post byline and every comment byline render the same kind
//   of element — a small circle showing either the user's avatar image
//   or, when no avatar is set / the User-table fetch failed, the user's
//   initials in a coloured circle. Without a shared component the two
//   call sites (ForumPostCard + CommentSection) drift in styling and in
//   how they fall back to initials. This component owns both:
//
//     - Resolving the avatar URL via `useUserAvatar(userId)` (which
//       fetches `/api/User/{id}` and returns `User.avatarUrl`). The
//       hook's module-scoped cache means 20 forum cards for the same
//       author share one network call.
//     - Optionally chaining a wire-provided `wireAvatarUrl` fallback
//       (the BE's `post.authorAvatar` / `comment.authorAvatar` field)
//       when the User fetch resolves to null. This means a viewer who
//       has never logged in (no User fetch possible) still sees the BE
//       avatar; once they sign in the User fetch takes over and
//       reflects the latest save.
//     - Falling back to coloured initials in a circle when neither
//       source has an avatar.
//
// The user explicitly asked for User.avatarUrl to take priority over
// the wire-provided value because the wire value is sourced from the
// Profile table on the BE and is therefore stale (see
// `useUserAvatar` header for the full bug writeup).

import { AvatarVisual } from '../profile/AvatarVisual';
import { useUserAvatar } from '../../hooks/useUserAvatar';
import { initialsFromName } from '../../pages/Forum/forum.utils';
import styles from './ForumAvatar.module.css';

export interface ForumAvatarProps {
  /**
   * Backend user id. When null / non-positive the component renders the
   * initials fallback only (no fetch, no avatar image).
   */
  userId: number | null | undefined;
  /**
   * Display name used to derive the initials fallback. Should be the
   * same string rendered in the byline (`post.fullName`,
   * `comment.fullName`, etc.).
   */
  displayName: string;
  /**
   * Optional wire-provided avatar URL (the BE's
   * `post.authorAvatar` / `comment.authorAvatar` field). Used only
   * when the User fetch resolves to null. The User fetch is the
   * authoritative source — the wire value is the legacy fallback
   * for unauthenticated viewers or BE schema drift.
   */
  wireAvatarUrl?: string | null;
  /** Size in pixels. Default 32 (matches the existing CSS circle). */
  size?: number;
  /** Optional extra className — applied to the wrapping `<span>`. */
  className?: string;
  /**
   * Optional click handler. When provided the avatar becomes a
   * `<button>` so keyboard / screen-reader users can trigger it
   * (used by the post author byline which navigates to /profile).
   */
  onClick?: () => void;
  /**
   * Title / aria-label for the click target. Required when `onClick`
   * is set (matches the existing ForumPostCard a11y pattern).
   */
  title?: string;
  ariaLabel?: string;
}

export const ForumAvatar = ({
  userId,
  displayName,
  wireAvatarUrl,
  size = 32,
  className,
  onClick,
  title,
  ariaLabel,
}: ForumAvatarProps) => {
  const { avatarUrl } = useUserAvatar(
    typeof userId === 'number' ? userId : null,
  );

  // Priority:
  //   1. User.avatarUrl (fetched fresh — the user just changed their
  //      avatar so this is the up-to-date value).
  //   2. The BE's wire-provided `authorAvatar` (may be stale, sourced
  //      from the Profile table; kept as a graceful fallback for
  //      unauthenticated viewers).
  //   3. Initials in a coloured circle.
  const resolvedAvatarUrl = avatarUrl ?? wireAvatarUrl ?? null;
  const initials = initialsFromName(displayName);
  const paletteIndex =
    typeof userId === 'number'
      ? userId % 8
      : Math.abs(hashString(displayName)) % 8;

  const inner = (
    <AvatarVisual
      url={resolvedAvatarUrl}
      initials={initials}
      size={size}
      alt={ariaLabel}
    />
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`${styles.avatar} ${className ?? ''}`}
        onClick={onClick}
        title={title}
        aria-label={ariaLabel ?? title}
        data-palette={String(paletteIndex)}
        style={{ width: size, height: size }}
      >
        {inner}
      </button>
    );
  }
  return (
    <span
      className={`${styles.avatar} ${className ?? ''}`}
      data-palette={String(paletteIndex)}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      style={{ width: size, height: size }}
    >
      {inner}
    </span>
  );
};

// Tiny stable string hash for the palette index when we have no
// userId. Keeps the same name in the same palette slot across
// re-renders, so the coloured circle doesn't flash on every render.
const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
};

export default ForumAvatar;