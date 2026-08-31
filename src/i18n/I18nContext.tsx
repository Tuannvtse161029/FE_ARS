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
  type Locale,
} from './translations';

const LOCALE_STORAGE_KEY = 'ars_lang';
const HTML_LANG_ATTRIBUTE = 'lang';

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, fallback?: string) => string;
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

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

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
    (key: string, fallback?: string) => translate(locale, key, fallback),
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside an <I18nProvider>.');
  }
  return ctx;
};

/**
 * Convenience hook that just exposes the `t` translator. Most components
 * only need to look up strings — they don't need to read the locale or
 * switch it. This keeps call-sites compact.
 */
export const useT = (): I18nContextValue['t'] => useI18n().t;

/** Convenience hook returning the active locale label. */
export const useLocale = (): Locale => useI18n().locale;
