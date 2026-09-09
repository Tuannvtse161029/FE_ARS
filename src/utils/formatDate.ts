const LOCALE_STORAGE_KEY = 'ars_lang';

/**
 * Read the active UI locale from localStorage. We can't use the React
 * `useLocale()` hook here (this file is outside the component tree) so we
 * peek at the same storage key the I18nProvider writes to. Falls back to
 * `en` when nothing is stored yet — that matches I18nProvider's
 * `DEFAULT_LOCALE`.
 *
 * Exported as `resolveActiveLocale()` so date formatters can stay in sync
 * with the rest of the app even when the user toggles languages without
 * re-rendering the page.
 */
export const resolveActiveLocale = (): 'vi' | 'en' => {
  if (typeof window === 'undefined') return 'en';
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw === 'vi' || raw === 'en') return raw;
  } catch {
    /* ignore — privacy mode / SSR */
  }
  return 'en';
};

/** Map an app locale code (`vi` / `en`) to a BCP-47 tag `Intl` accepts. */
export const toIntlLocaleTag = (locale: 'vi' | 'en' = resolveActiveLocale()): string =>
  locale === 'en' ? 'en-US' : 'vi-VN';

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

/**
 * Format a date in long form (e.g. "August 18, 2026" / "18 tháng 8, 2026").
 *
 * The `locale` argument accepts the short app codes (`en` / `vi`) — it's
 * translated to the proper BCP-47 tag before reaching `Intl`. When omitted
 * we read the active UI locale from storage so the date matches whatever
 * language the user picked, instead of always rendering in Vietnamese.
 */
export const formatDate = (
  dateString: string,
  locale: 'vi' | 'en' = resolveActiveLocale(),
): string => {
  const date = parseUtcDate(dateString);
  return new Intl.DateTimeFormat(toIntlLocaleTag(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

/**
 * Format a date and time (e.g. "Aug 18, 2026, 14:00" / "18 thg 8, 2026, 14:00").
 * Same locale-resolution contract as `formatDate`.
 */
export const formatDateTime = (
  dateString: string,
  locale: 'vi' | 'en' = resolveActiveLocale(),
): string => {
  const date = parseUtcDate(dateString);
  return new Intl.DateTimeFormat(toIntlLocaleTag(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/**
 * Format a date and time, swapping the locale and relative-token strings
 * to match the active UI language. When the user is on English the
 * relative tokens read like English ("5 minutes ago", "Yesterday at 14:00"),
 * and on Vietnamese they fall back to their canonical English form
 * because the relative grammar is broadly understood — the date itself is
 * still formatted through `Intl` with the correct locale tag.
 */
export const formatRelativeTime = (
  dateString?: string | null,
  locale: 'vi' | 'en' = resolveActiveLocale(),
): string => {
  if (!dateString) return '';
  const date = parseUtcDate(dateString);
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

  const tag = toIntlLocaleTag(locale);

  if (diffInSeconds < 45) {
    return locale === 'en' ? 'just now' : 'vừa xong';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return locale === 'en'
      ? `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`
      : `${diffInMinutes} phút trước`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return locale === 'en'
      ? `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`
      : `${diffInHours} giờ trước`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    const timeStr = date.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' });
    return locale === 'en'
      ? `Yesterday at ${timeStr}`
      : `Hôm qua lúc ${timeStr}`;
  }
  if (diffInDays < 7) {
    return locale === 'en'
      ? `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`
      : `${diffInDays} ngày trước`;
  }

  return date.toLocaleDateString(tag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default formatDate;
