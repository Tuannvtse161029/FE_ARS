export const parseUtcDate = (dateString?: string | null): Date => {
  if (!dateString) return new Date();
  let normalized = dateString.trim();
  if (
    normalized.includes('T') &&
    !normalized.endsWith('Z') &&
    !/[+-]\d{2}:\d{2}$/.test(normalized) &&
    !/[+-]\d{4}$/.test(normalized)
  ) {
    normalized += 'Z';
  }
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? new Date(dateString) : d;
};

export const formatDate = (dateString: string, locale: string = 'vi-VN'): string => {
  const date = parseUtcDate(dateString);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

export const formatDateTime = (dateString: string, locale: string = 'vi-VN'): string => {
  const date = parseUtcDate(dateString);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatRelativeTime = (dateString?: string | null): string => {
  if (!dateString) return '';
  const date = parseUtcDate(dateString);
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffInSeconds < 45) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `Yesterday at ${timeStr}`;
  }
  if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }

  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default formatDate;
