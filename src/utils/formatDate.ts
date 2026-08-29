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
    return 'Vừa xong';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} phút trước`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} giờ trước`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `Hôm qua lúc ${timeStr}`;
  }
  if (diffInDays < 7) {
    return `${diffInDays} ngày trước`;
  }

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default formatDate;
