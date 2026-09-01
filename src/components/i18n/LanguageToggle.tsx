import { useEffect, useRef, useState } from 'react';
import { Globe } from 'lucide-react';
import {
  LOCALE_FLAGS,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type Locale,
} from '../../i18n/translations';
import { useI18n } from '../../i18n/I18nContext';
import styles from './LanguageToggle.module.css';

type Props = {
  /** Optional className so the host layout can reserve spacing. */
  className?: string;
};

/**
 * Compact language picker that lives next to the theme toggle in the
 * header. Clicking the button opens a small dropdown listing every
 * supported locale. Selecting an entry switches the active locale
 * immediately and persists the choice through the I18n provider.
 */
export const LanguageToggle = ({ className }: Props) => {
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickAway = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickAway);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelect = (next: Locale) => {
    setLocale(next);
    setIsOpen(false);
  };

  return (
    <div
      ref={wrapperRef}
      className={`${styles.wrapper} ${className ?? ''}`.trim()}
    >
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('header.languageToggle')}
        title={t('header.language')}
        data-testid="language-toggle"
      >
        <Globe size={18} aria-hidden="true" />
        <span className={styles.code} aria-hidden="true">
          {LOCALE_FLAGS[locale]} {locale.toUpperCase()}
        </span>
      </button>
      {isOpen && (
        <ul
          role="listbox"
          aria-label={t('header.languageMenu')}
          className={styles.menu}
        >
          {SUPPORTED_LOCALES.map((entry) => (
            <li key={entry}>
              <button
                type="button"
                role="option"
                aria-selected={entry === locale}
                className={`${styles.option} ${entry === locale ? styles.optionActive : ''}`.trim()}
                onClick={() => handleSelect(entry)}
              >
                <span aria-hidden="true" className={styles.flag}>
                  {LOCALE_FLAGS[entry]}
                </span>
                <span className={styles.optionLabel}>{LOCALE_LABELS[entry]}</span>
                {entry === locale && (
                  <span className={styles.check} aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
