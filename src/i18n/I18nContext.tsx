import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isLocale,
  translate,
  type Dictionary,
  type Locale,
} from './translations';

const LOCALE_STORAGE_KEY = 'ars_lang';
const HTML_LANG_ATTRIBUTE = 'lang';

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
  t: (
    key: string,
    fallback?: string,
    params?: Record<string, string | number>,
  ) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const readStoredLocale = (): Locale => {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(raw)) return raw;
  } catch {
    /* ignore — fall back to default */
  }
  return DEFAULT_LOCALE;
};

const persistLocale = (locale: Locale): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore — quota / privacy mode */
  }
};

const applyDocumentLocale = (locale: Locale): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(HTML_LANG_ATTRIBUTE, locale);
};

/**
 * Lazy loaders for each locale's dictionary chunk.
 *
 * Every locale ships its own Vite chunk (one per file under
 * `./dictionaries/<locale>.ts`). We use dynamic `import()` so only the
 * active locale is fetched on cold load — switching locales later
 * triggers an extra request on demand. The provider keeps both the
 * active and English dictionaries in memory at all times so a missing
 * key can fall back to English without an extra round trip.
 *
 * The English dictionary is preloaded at module load: it's the
 * application default and the universal fallback, so keeping it warm
 * eliminates a flash of untranslated keys on first paint.
 */
const localeLoaders: Record<Locale, () => Promise<Dictionary>> = {
  // Pre-bundled import: Vite includes this in the entry chunk so the
  // default locale is available before the provider mounts. This costs
  // ~139 KB of bundle — see vite.config.ts note on translations chunking.
  en: () => import('./dictionaries/en').then((m) => m.dictionary),
  // Lazy locale: only fetched when the user picks Vietnamese (or the
  // persisted preference is `vi`). The chunk is ~157 KB raw / ~30 KB gzip.
  vi: () => import('./dictionaries/vi').then((m) => m.dictionary),
};

// In-flight dedupe so two simultaneous `loadDictionary(locale)` calls
// (e.g. switching locales very fast) share the same promise.
const inFlight: Partial<Record<Locale, Promise<Dictionary>>> = {};

/**
 * Load a locale's dictionary. Subsequent calls return the same cached
 * dictionary. Errors surface to the caller — the provider falls back to
 * an empty dictionary so the UI never crashes on a missing chunk.
 */
export const loadDictionary = async (locale: Locale): Promise<Dictionary> => {
  if (inFlight[locale]) return inFlight[locale]!;
  const promise = localeLoaders[locale]()
    .then((dict) => dict ?? {})
    .catch((err: unknown) => {
      console.warn(`Failed to load ${locale} dictionary:`, err);
      return {};
    });
  inFlight[locale] = promise;
  return promise;
};

// Kick off the English dictionary load as early as possible. Because this
// module is imported by every eager entry point (App.tsx → AuthProvider
// → MainLayout → NotificationCenter → LanguageToggle → I18nProvider),
// Vite sees the dynamic `import()` for `./dictionaries/en` and ensures
// the chunk is fetched in parallel with the initial page render. We do
// NOT block the provider on it — the React render uses the empty cache
// until the dictionary resolves, then re-renders.
void loadDictionary('en');

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());
  // Per-locale dictionary cache. We always keep English in here so the
  // `translate()` fallback path never blocks on a missing chunk. The
  // active locale's dictionary is loaded on mount and on locale change.
  const [dictionaries, setDictionaries] = useState<
    Partial<Record<Locale, Dictionary>>
  >({});

  // Load the active locale on mount and whenever it changes. We do NOT
  // unload the previous locale — that keeps the cost of a toggle the
  // same as the first selection (a single chunk fetch).
  useEffect(() => {
    let cancelled = false;
    void loadDictionary(locale).then((dict) => {
      if (cancelled) return;
      setDictionaries((prev) => ({ ...prev, [locale]: dict }));
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Always preload English as a fallback. If English IS the active
  // locale this is a no-op (already cached); otherwise it warms the
  // fallback so missing keys never render `undefined` on first paint.
  useEffect(() => {
    if (locale === 'en') return;
    let cancelled = false;
    void loadDictionary('en').then((dict) => {
      if (cancelled) return;
      setDictionaries((prev) => ({ ...prev, en: dict }));
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    applyDocumentLocale(locale);
    persistLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((current) => {
      const idx = SUPPORTED_LOCALES.indexOf(current);
      const nextIdx = idx === -1 ? 0 : (idx + 1) % SUPPORTED_LOCALES.length;
      const next = SUPPORTED_LOCALES[nextIdx] ?? DEFAULT_LOCALE;
      return next;
    });
  }, []);

  const t = useCallback(
    (
      key: string,
      fallback?: string,
      params?: Record<string, string | number>,
    ) => translate(locale, key, fallback, params, dictionaries),
    [locale, dictionaries],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Fallback for components mounted outside the provider (e.g. tests).
  // We use an empty dictionary cache so the translator still returns the
  // fallback (or key) without ever crashing. The fallback object must be
  // stable across renders — components that depend on `t` (and via
  // useCallback, on the returned value) would otherwise re-render
  // infinitely when no provider wraps them.
  return FALLBACK_I18N;
};

/**
 * Stable fallback value for `useI18n()` when no `<I18nProvider>` is mounted.
 * Hoisted to module scope so returning it does NOT allocate a new object
 * reference on every render — see the `useI18n` comment above for the
 * re-render-infinite-loop this prevents.
 */
const FALLBACK_T = (
  key: string,
  fallback?: string,
  params?: Record<string, string | number>,
) => translate(DEFAULT_LOCALE, key, fallback, params, {});

const FALLBACK_I18N: I18nContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  toggleLocale: () => {},
  t: FALLBACK_T,
};

/**
 * Convenience hook that just exposes the `t` translator. Most components
 * only need to look up strings — they don't need to read the locale or
 * switch it. This keeps call-sites compact.
 */
export const useT = (): I18nContextValue['t'] => useI18n().t;

/** Convenience hook returning the active locale label. */
export const useLocale = (): Locale => {
  const ctx = useContext(I18nContext);
  return ctx?.locale ?? DEFAULT_LOCALE;
};
