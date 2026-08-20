// Small helpers shared between the Forum page and the extracted
// ForumPostCard component. Kept in a single file so both call sites see
// the exact same constants (avatar palette, initials parser, time
// formatter). No state, no React, no side effects.

export const PALETTE = [
  '#eff6ff',
  '#f0fdf4',
  '#fef9c3',
  '#fdf4ff',
  '#fff7ed',
  '#ecfeff',
  '#f5f3ff',
  '#fef2f2',
] as const;

export const initialsFromName = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const formatRelativeTime = (iso?: string): string => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};
