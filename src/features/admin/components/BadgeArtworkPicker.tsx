/**
 * BadgeArtworkPicker — admin-facing tile grid that lets a medal admin pick a
 * curated achievement artwork from `BADGE_ARTWORK_REGISTRY`. The chosen
 * entry is converted to the canonical `/assets/badges/<key>.svg` URL and
 * written back into `medal.imageUrl` via the existing `medalService.update`
 * path — no backend change required.
 *
 * The picker groups entries by their `category` field (orcid / published /
 * seminar / mentoring / review / flawless / community / general) so admins
 * are not confronted with one long list of 20+ tiles. Grouping is locale-
 * driven via `useI18n` so the labels stay aligned with the rest of the
 * medal admin UI.
 */
import { useMemo, useState } from 'react';
import { GalleryThumbnails, Search, X } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import {
  BADGE_ARTWORK_LIST,
  artworkKeyToImageUrl,
  type BadgeArtworkEntry,
} from '../../../assets/badges';
import styles from './BadgeArtworkPicker.module.css';

export interface BadgeArtworkPickerProps {
  /** Current imageUrl — used to highlight the already-picked artwork. */
  value: string;
  /** Called when the admin picks an artwork. Receives `/assets/badges/<key>.svg`. */
  onChange: (next: string) => void;
  /** Optional id for the search input. Useful for `aria-controls`. */
  id?: string;
  /** Optional grid id (defaults to `${id}Grid`). */
  gridId?: string;
}

const PREFIX = '/assets/badges/';

const stripPrefix = (raw: string): string => {
  if (!raw) return '';
  if (!raw.startsWith(PREFIX)) return '';
  return raw.replace(PREFIX, '').replace(/\.[^.]+$/, '');
};

const CATEGORY_ORDER: NonNullable<BadgeArtworkEntry['category']>[] = [
  'orcid',
  'published',
  'seminar',
  'mentoring',
  'review',
  'flawless',
  'community',
  'general',
];

const CATEGORY_LABEL_KEY: Record<
  NonNullable<BadgeArtworkEntry['category']>,
  string
> = {
  orcid: 'admin.medals.library.category.orcid',
  published: 'admin.medals.library.category.published',
  seminar: 'admin.medals.library.category.seminar',
  mentoring: 'admin.medals.library.category.mentoring',
  review: 'admin.medals.library.category.review',
  flawless: 'admin.medals.library.category.flawless',
  community: 'admin.medals.library.category.community',
  general: 'admin.medals.library.category.general',
};

const CATEGORY_FALLBACKS: Record<
  NonNullable<BadgeArtworkEntry['category']>,
  { en: string; vi: string }
> = {
  orcid: { en: 'ORCID / verification', vi: 'ORCID / Xác minh' },
  published: { en: 'Published paper', vi: 'Bài đã xuất bản' },
  seminar: { en: 'Seminar / events', vi: 'Hội thảo / Sự kiện' },
  mentoring: { en: 'Mentoring / guidance', vi: 'Hướng dẫn / Mentor' },
  review: { en: 'Peer review', vi: 'Phản biện' },
  flawless: { en: 'Flawless progress', vi: 'Tiến độ hoàn hảo' },
  community: { en: 'Community / global', vi: 'Cộng đồng / Toàn cầu' },
  general: { en: 'General', vi: 'Chung' },
};

export const BadgeArtworkPicker = ({
  value,
  onChange,
  id = 'badgeArtworkPickerSearch',
  gridId,
}: BadgeArtworkPickerProps) => {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState<string>('');

  const searchPlaceholder = t(
    'admin.medals.library.searchPlaceholder',
    locale === 'vi' ? 'Tìm trong thư viện...' : 'Search library...',
  );
  const searchAriaLabel = t(
    'admin.medals.library.searchAria',
    locale === 'vi' ? 'Tìm biểu tượng trong thư viện' : 'Search library',
  );
  const clearAriaLabel = t(
    'admin.medals.library.clearAria',
    locale === 'vi' ? 'Xóa tìm kiếm' : 'Clear search',
  );
  const emptyTemplate = t(
    'admin.medals.library.empty',
    locale === 'vi'
      ? 'Không có hình nào khớp "{query}"'
      : 'No artwork matches "{query}"',
  );
  const gridLabel = t(
    'admin.medals.library.gridAria',
    locale === 'vi' ? 'Thư viện biểu tượng ARS' : 'ARS badge library',
  );

  const selectedKey = stripPrefix(value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BADGE_ARTWORK_LIST;
    return BADGE_ARTWORK_LIST.filter((entry) => {
      const haystack =
        `${entry.key} ${entry.label ?? ''} ${entry.labelVi ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  const grouped = useMemo(() => {
    const buckets = new Map<
      NonNullable<BadgeArtworkEntry['category']>,
      BadgeArtworkEntry[]
    >();
    for (const entry of filtered) {
      const cat = entry.category ?? 'general';
      const list = buckets.get(cat) ?? [];
      list.push(entry);
      buckets.set(cat, list);
    }
    // Preserve canonical category order; drop buckets with no entries.
    return CATEGORY_ORDER.filter((cat) => (buckets.get(cat)?.length ?? 0) > 0).map(
      (cat) => ({
        category: cat,
        entries: (buckets.get(cat) ?? []).slice().sort((a, b) =>
          a.key.localeCompare(b.key),
        ),
      }),
    );
  }, [filtered]);

  const isEmpty = grouped.length === 0;

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
          : `${filtered.length} ${locale === 'vi' ? 'hình' : 'artworks'}`}
      </span>

      {isEmpty ? (
        <div className={styles.emptyState} role="status">
          <GalleryThumbnails size={20} aria-hidden="true" />
          <span>{emptyTemplate.replace('{query}', query)}</span>
        </div>
      ) : (
        <div
          id={gridId ?? `${id}Grid`}
          className={styles.root}
          role="listbox"
          aria-label={gridLabel}
        >
          {grouped.map((group) => {
            const fallback = CATEGORY_FALLBACKS[group.category];
            const headerLabel = t(
              CATEGORY_LABEL_KEY[group.category],
              locale === 'vi' ? fallback.vi : fallback.en,
            );
            return (
              <section
                key={group.category}
                className={styles.group}
                aria-label={headerLabel}
              >
                <header className={styles.groupHeader}>
                  <span className={styles.groupHeaderText}>{headerLabel}</span>
                </header>
                <div className={styles.grid}>
                  {group.entries.map((entry) => {
                    const isSelected = selectedKey === entry.key;
                    return (
                      <button
                        key={entry.key}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        aria-label={entry.label ?? entry.key}
                        title={entry.label ?? entry.key}
                        className={`${styles.tile} ${
                          isSelected ? styles.tileActive : ''
                        }`}
                        onClick={() => onChange(artworkKeyToImageUrl(entry.key))}
                      >
                        <span className={styles.tileArtFrame}>
                          <img
                            src={entry.src}
                            alt=""
                            loading="lazy"
                            className={styles.tileArt}
                          />
                        </span>
                        <span className={styles.tileCaption}>
                          {locale === 'vi'
                            ? entry.labelVi ?? entry.label ?? entry.key
                            : entry.label ?? entry.key}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BadgeArtworkPicker;
