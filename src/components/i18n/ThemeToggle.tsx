import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useThemeToggle } from '../../hooks/useThemeToggle';
import { useT } from '../../i18n/I18nContext';
import styles from './ThemeToggle.module.css';

/**
 * Compact theme toggle that lives next to the language toggle in the
 * header. Displays a Sun icon for light mode and a Moon icon for dark mode.
 * The active theme is stored in localStorage and applied to the root element.
 */
export const ThemeToggle = () => {
  const { theme, toggleTheme } = useThemeToggle();
  const t = useT();
  const [isDark, setIsDark] = useState(false);

  // Sync local state with theme
  useEffect(() => {
    setIsDark(theme === 'archive-dusk');
  }, [theme]);

  const handleToggle = () => {
    toggleTheme();
  };

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={`${styles.trigger} ${isDark ? styles.dark : styles.light}`}
        onClick={handleToggle}
        aria-label={t('header.themeToggle')}
        title={t('header.themeToggle')}
        data-testid="theme-toggle"
      >
        {isDark ? (
          <Moon size={18} aria-hidden="true" className={styles.iconMoon} />
        ) : (
          <Sun size={18} aria-hidden="true" className={styles.iconSun} />
        )}
      </button>
    </div>
  );
};
