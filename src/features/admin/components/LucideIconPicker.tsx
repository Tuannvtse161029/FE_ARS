/**
 * LucideIconPicker — searchable grid of lucide-react icons for the medal
 * artwork picker. Used by `TierEditor` (create / edit form) and
 * `ArtworkUpload` (quick-image modal). Supports live case-insensitive
 * filtering by icon display name, a fully accessible search input
 * (`role="searchbox"`, `aria-label`, preserved focus styles), and a
 * "no matches" empty state. Honors `prefers-reduced-motion`.
 */
import { useMemo, useState } from 'react';
import { Medal as MedalIcon, Search, X } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import {
  LUCIDE_ICONS_MAP,
  LUCIDE_ICONS_LIST,
} from './SafeMedalBadge';
import styles from './LucideIconPicker.module.css';

export interface LucideIconPickerProps {
  /** Current value in `lucide:IconName` form (or empty). */
  value: string;
  /** Called when the admin picks an icon. Receives the new `lucide:Name`. */
  onChange: (next: string) => void;
  /** Optional id for the search input. Useful for `aria-controls`. */
  id?: string;
  /** Optional grid id (defaults to `${id}Grid`). */
  gridId?: string;
  /** Optional aria-label override for the icon grid region. */
  gridAriaLabel?: string;
}

const PREFIX = 'lucide:';

const stripPrefix = (raw: string): string => {
  if (!raw) return '';
  return raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : raw;
};

export const LucideIconPicker: React.FC<LucideIconPickerProps> = ({
  value,
  onChange,
  id = 'lucideIconPickerSearch',
  gridId,
  gridAriaLabel,
}) => {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState<string>('');

  const searchPlaceholder = t(
    'admin.medals.iconPicker.searchPlaceholder',
    locale === 'vi' ? 'Tìm biểu tượng...' : 'Search icons...',
  );
  const searchAriaLabel = t(
    'admin.medals.iconPicker.searchAria',
    locale === 'vi' ? 'Tìm biểu tượng Lucide' : 'Search Lucide icons',
  );
  const clearAriaLabel = t(
    'admin.medals.iconPicker.clearAria',
    locale === 'vi' ? 'Xóa tìm kiếm' : 'Clear search',
  );
  const emptyTemplate = t(
    'admin.medals.iconPicker.empty',
    locale === 'vi'
      ? 'Không có biểu tượng nào khớp "{query}"'
      : 'No icons match "{query}"',
  );
  const gridLabel =
    gridAriaLabel ??
    t(
      'admin.medals.iconPicker.gridAria',
      locale === 'vi' ? 'Danh sách biểu tượng Lucide' : 'Lucide icon library',
    );

  const selectedName = stripPrefix(value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LUCIDE_ICONS_LIST;
    return LUCIDE_ICONS_LIST.filter((item) => {
      const haystack =
        `${item.name} ${item.labelEn} ${item.labelVi}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.searchRow}>
        <label htmlFor={id} className={styles.srOnly}>
          {searchAriaLabel}
        </label>
        <span className={styles.searchIconWrap} aria-hidden="true">
          <Search size={16} />
        </span>
        <input
          id={id}
          type="text"
          role="searchbox"
          aria-label={searchAriaLabel}
          aria-controls={gridId ?? `${id}Grid`}
          aria-describedby={`${id}Status`}
          autoComplete="off"
          spellCheck={false}
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={styles.searchInput}
        />
        {query && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => setQuery('')}
            aria-label={clearAriaLabel}
            title={clearAriaLabel}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <span
        id={`${id}Status`}
        className={styles.srOnly}
        aria-live="polite"
      >
        {filtered.length === 0
          ? emptyTemplate.replace('{query}', query)
          : `${filtered.length} ${locale === 'vi' ? 'biểu tượng' : 'icons'}`}
      </span>

      {filtered.length === 0 ? (
        <div className={styles.emptyState} role="status">
          <MedalIcon size={20} aria-hidden="true" />
          <span>{emptyTemplate.replace('{query}', query)}</span>
        </div>
      ) : (
        <div
          id={gridId ?? `${id}Grid`}
          className={styles.grid}
          role="listbox"
          aria-label={gridLabel}
        >
          {filtered.map((item) => {
            const IconComp = LUCIDE_ICONS_MAP[item.name] || MedalIcon;
            const isSelected = selectedName === item.name;
            return (
              <button
                key={item.name}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-label={item.name}
                title={item.name}
                className={`${styles.item} ${
                  isSelected ? styles.itemActive : ''
                }`}
                onClick={() => onChange(`${PREFIX}${item.name}`)}
              >
                <IconComp
                  size={24}
                  color={isSelected ? '#1d4ed8' : '#475569'}
                />
                <span>{locale === 'vi' ? item.labelVi : item.labelEn}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LucideIconPicker;
