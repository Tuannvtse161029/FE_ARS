export type Locale = 'vi' | 'en';

export const DEFAULT_LOCALE: Locale = 'en';
export const SUPPORTED_LOCALES: readonly Locale[] = ['vi', 'en'] as const;

export const LOCALE_LABELS: Record<Locale, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  vi: '🇻🇳',
  en: '🇬🇧',
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' &&
  (SUPPORTED_LOCALES as readonly string[]).includes(value);

// The Dictionary type lives in `./dictionaries/types.ts`. Importers
// should use `import type { Dictionary } from './dictionaries/types'`
// (or just use `Record<string, string>` inline). Re-exporting here
// preserves the pre-splitting API for any caller that still imports it
// from this module.
import type { Dictionary } from './dictionaries/types';
export type { Dictionary };
/**
 * Resolve a translation for the given locale. If the requested locale has
 * no explicit value for the key, we fall back to English. If English also
 * has nothing, we return the key itself so the UI never silently renders
 * `undefined`.
 *
 * `params` optionally interpolates `{key}` placeholders in the resolved
 * string — useful for count-bearing messages such as
 * `"Used by: {topics} topic(s), {phases} phase(s)"`. Missing keys are
 * left untouched so a malformed template never throws.
 *
 * Pluralization: tokens ending in `{s}` (e.g. `{count} group{s}`) are
 * handled by inspecting the `{count}` parameter. If the count is exactly
 * 1, the trailing `{s}` is stripped (yielding `1 group`); otherwise the
 * `s` is kept (`2 groups`). When `{count}` is absent the fallback is to
 * keep `{s}` literal so existing string templates render unchanged.
 */
export const translate = (
  locale: Locale,
  key: string,
  fallback?: string,
  params?: Record<string, string | number>,
  // `dictionaries` is the in-memory cache the I18nContext loaded via
  // `loadDictionary()`. We accept it as a parameter (instead of importing
  // a constant from this module) so the chunk graph stays clean: callers
  // only pull in the locale chunks they actually display. The provider
  // passes the active locale's dictionary AND the English fallback so we
  // can resolve a key without ever importing the dictionary constants.
  dictionaries?: Partial<Record<Locale, Dictionary>>,
): string => {
  let raw: string | undefined;
  if (locale === 'vi') {
    raw = dictionaries?.vi?.[key];
  }
  if (!raw) raw = dictionaries?.en?.[key];
  if (!raw) raw = fallback;
  if (!raw) return key;
  if (!params) return raw;

  // Pre-compute whether any count-shaped parameter is exactly 1 so we can
  // collapse `{s}` placeholders in count-bearing templates. We accept
  // either an explicit `count` parameter or any numeric parameter with
  // name ending in `Count` so plural forms work consistently.
  const countParam = (() => {
    const direct = params.count;
    if (typeof direct === 'number') return direct;
    for (const [name, value] of Object.entries(params)) {
      if (typeof value === 'number' && /count$/i.test(name)) return value;
    }
    return null;
  })();
  const isSingular = countParam === 1;
  const processed = raw.replace(/\{(\w+)\}/g, (match, name: string) => {
    const v = params[name];
    if (name === 's') {
      // Pluralization marker — strip when the count is exactly 1.
      return isSingular ? '' : 's';
    }
    return v === undefined || v === null ? match : String(v);
  });
  return processed;
};
