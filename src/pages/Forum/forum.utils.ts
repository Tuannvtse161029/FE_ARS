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

export { formatRelativeTime, parseUtcDate } from '../../utils/formatDate';
