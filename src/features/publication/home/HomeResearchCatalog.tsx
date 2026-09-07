import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Inbox, Search } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import type { CatalogQuery, PublicationPaper } from '../types/publication';
import { PublishedPaperCard } from './PublishedPaperCard';
import { WorkspaceHeader } from '../../../components/workspace/WorkspaceHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { SkeletonRow } from '../../../components/SkeletonRow';
import { Button } from '../../../components/Button/Button';
import { publicReviewerName } from '../types/publication';
import { PublicationDemoBanner } from '../components/PublicationDemoBanner';
import { useListShortcuts } from '../../../hooks/useListShortcuts';
import { useFieldTaxonomy } from '../../../hooks/useFieldTaxonomy';
import { useLocale, useT } from '../../../i18n/I18nContext';
import styles from './HomeResearchCatalog.module.css';

const PAGE_SIZE = 8;
const HOMEPAGE_ACCENT = 'var(--ars-blue)';

/**
 * Authenticated research catalog.
 *
 * Surfaces only papers that satisfy the public catalog predicate
 * (`status === 'PUBLISHED' && visibility === 'PUBLIC'`).
 *
 * Filter taxonomy (BE-validated):
 *   - "Major field" → "Subfield" (the BE MajorField → SubField hierarchy)
 *     is the only taxonomy filter wired end-to-end. The Paper BE response
 *     exposes `subFieldId` (per docs/local-only/erd-schema-reference.md
 *     and `Paper` in src/services/paper.service.ts) and the MajorField /
 *     SubField tree is loaded from `GET /api/MajorField`. Filtering by
 *     subFieldId happens client-side via `matchesCatalogQuery`.
 *   - "Domain" and "Field" filters were removed: the Paper BE response has
 *     no `domain` or `field` fields. The previous `toPublicationPaper()`
 *     adapter shimmed those from localStorage, which is empty for catalog
 *     papers loaded via the public endpoint — so the filter dropdowns were
 *     rendered but had no effect. Re-introduce them only when the BE
 *     starts returning these fields on Paper responses.
 *   - "Topic" filter was removed: `toPublicationPaper()` hardcoded
 *     `topics: []` for every paper, so the topic dropdown was always empty
 *     and matching always returned true. Re-introduce it once the BE
 *     returns a topics[] array.
 *   - "Sort" offers publication date and title ordering. The default is
 *     "Newest published" so the freshest research surfaces first.
 *   - Search matches title, abstract, DOI, authors, institutions, topics,
 *     and keywords (case-insensitive substring) via the adapter.
 */
export const HomeResearchCatalog = () => {
  const locale = useLocale();
  const t = useT();

  const sortOptions: Array<{ value: NonNullable<CatalogQuery['sort']>; label: string }> = [
    { value: 'PUBLISHED_DESC', label: t('home.catalog.sort.newest') },
    { value: 'PUBLISHED_ASC', label: t('home.catalog.sort.oldest') },
    { value: 'TITLE_ASC', label: t('home.catalog.sort.title') },
  ];

  const [query, setQuery] = useState<CatalogQuery>({
    page: 1,
    pageSize: PAGE_SIZE,
    sort: 'PUBLISHED_DESC',
  });
  const [papers, setPapers] = useState<PublicationPaper[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    publicationAdapter.getPublicCatalog(query)
      .then((result) => {
        if (!active) return;
        setPapers(result.items);
        setTotal(result.totalCount);
        setIsDemo(result.dataSource === 'demo');
      })
      .catch(() => active && setError(t('home.catalog.error.loadFailed')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query, t]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Taxonomy (MajorField → SubField) loaded from `GET /api/MajorField`. This
  // is the only taxonomy filter that has a matching field on the Paper BE
  // response (`subFieldId`).
  const { taxonomy, isLoading: isLoadingTaxonomy } = useFieldTaxonomy(
    papers.map((p) => ({ subFieldId: p.subFieldId ?? null })),
  );

  // When a MajorField is selected, show only its SubFields as "Subfield"
  // options. We use `majorFieldName` (not id) as the dropdown value so the
  // rendered label matches the visible text and stays human-readable when
  // serialized into the URL / future API query.
  const selectedMajorField = useMemo(
    () => taxonomy.majorFields.find((mf) => mf.name === query.majorField) ?? null,
    [taxonomy.majorFields, query.majorField],
  );

  const subfieldOptions = useMemo(
    () =>
      selectedMajorField?.subFields
        ?.filter((sf) => taxonomy.activeSubFieldIds.has(sf.id))
        .sort((a, b) => a.name.localeCompare(b.name)) ?? [],
    [selectedMajorField, taxonomy.activeSubFieldIds],
  );

  const updateQuery = (patch: Partial<CatalogQuery>) =>
    setQuery((current) => {
      const next = { ...current, ...patch, page: 1 };
      // When majorField changes, clear the dependent subFieldId pick.
      if (patch.majorField !== undefined && patch.majorField !== current.majorField) {
        next.subFieldId = undefined;
      }
      return next;
    });

  const clearFilters = () =>
    updateQuery({ query: undefined, majorField: undefined, subFieldId: undefined });

  // Part 4 — keyboard shortcuts for the public research catalog.
  // j/k walk the cards, Enter opens the focused paper's detail view
  // (window.open so it doesn't replace the catalog), f focuses search.
  const { selectedIndex } = useListShortcuts({
    itemCount: papers.length,
    onOpen: (index) => {
      const paper = papers[index];
      if (!paper?.id) return;
      window.open(`/papers/${paper.id}`, '_blank', 'noopener,noreferrer');
    },
    filterFocusId: 'public-catalog-search-input',
  });

  const hasActiveFilters = Boolean(
    query.query || query.majorField || query.subFieldId,
  );

  return (
    <section className={styles.catalog}>
      <WorkspaceHeader
        marker={t('home.catalog.marker')}
        title={t('home.catalog.title')}
        subtitle={t('home.catalog.subtitle')}
        accent={HOMEPAGE_ACCENT}
      />

      {isDemo && <PublicationDemoBanner />}

      <div className={styles.toolbar}>
        {/* Full-text search */}
        <label className={styles.search}>
          <Search size={18} aria-hidden="true" />
          <input
            id="public-catalog-search-input"
            aria-label={t('home.catalog.search.ariaLabel')}
            value={query.query ?? ''}
            onChange={(event) => updateQuery({ query: event.target.value })}
            placeholder={t('home.catalog.search.placeholder')}
          />
        </label>

        {/* Taxonomy: Major field — always shown. Lists only branches that
            have at least one published paper, so empty categories never
            appear. */}
        <label className={styles.filter}>
          <span>{t('home.catalog.filter.majorField')}</span>
          <select
            aria-label={t('home.catalog.filter.majorFieldAria')}
            value={query.majorField ?? ''}
            onChange={(event) =>
              updateQuery({ majorField: event.target.value || undefined })
            }
          >
            <option value="">{t('home.catalog.filter.allMajorFields')}</option>
            {isLoadingTaxonomy
              ? null
              : taxonomy.majorFields
                  .filter((mf) => taxonomy.activeMajorFieldIds.has(mf.id))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((mf) => (
                    <option key={mf.id} value={mf.name}>{mf.name}</option>
                  ))}
          </select>
        </label>

        {/* Taxonomy: Subfield — only shown when a major field is selected. */}
        {query.majorField ? (
          <label className={styles.filter}>
            <span>{t('home.catalog.filter.subfield')}</span>
            <select
              aria-label={t('home.catalog.filter.subfieldAria')}
              value={query.subFieldId != null ? String(query.subFieldId) : ''}
              onChange={(event) => {
                const val = event.target.value;
                updateQuery({ subFieldId: val ? Number(val) : undefined });
              }}
            >
              <option value="">{t('home.catalog.filter.allSubfields')}</option>
              {subfieldOptions.map((sf) => (
                <option key={sf.id} value={String(sf.id)}>{sf.name}</option>
              ))}
            </select>
          </label>
        ) : null}

        {/* Sort */}
        <label className={styles.filter}>
          <span>{t('home.catalog.sort.label')}</span>
          <select
            aria-label={t('home.catalog.sort.ariaLabel')}
            value={query.sort}
            onChange={(event) => updateQuery({ sort: event.target.value as CatalogQuery['sort'] })}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.resultContext} aria-live="polite">
        <span>
          {loading
            ? t('home.catalog.loading')
            : `${total.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')} ${total === 1 ? t('home.catalog.totalLabel_one') : t('home.catalog.totalLabel_other')}`}
        </span>
        {!loading && hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            {t('home.catalog.clearFilters')}
          </Button>
        ) : null}
      </div>

      {loading ? (
        <SkeletonRow count={6} withHeader />
      ) : error ? (
        <ErrorBanner
          tone="error"
          title={t('home.catalog.error.title')}
          message={error}
        />
      ) : papers.length === 0 ? (
        <EmptyState
          icon={<Inbox size={20} aria-hidden />}
          title={hasActiveFilters
            ? t('home.catalog.empty.titleNoResults')
            : t('home.catalog.empty.titleEmpty')}
          description={
            hasActiveFilters
              ? t('home.catalog.empty.descNoResults')
              : t('home.catalog.empty.descEmpty')
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="md" onClick={clearFilters}>
                {t('home.catalog.clearFilters')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={styles.results} data-testid="public-paper-results">
          {papers.map((paper, index) => (
            <div
              key={paper.id}
              className={selectedIndex === index ? styles.selectedCardWrap : undefined}
            >
              <PublishedPaperCard
                paper={paper}
                publicReviewerName={publicReviewerName(paper)}
              />
            </div>
          ))}
        </div>
      )}

      <footer className={styles.pagination}>
        <span className={styles.paginationCount}>
          <strong>{total.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')}</strong> {total === 1 ? t('home.catalog.totalLabel_one') : t('home.catalog.totalLabel_other')}
        </span>
        <div className={styles.paginationControls}>
          <Button
            variant="outline"
            size="sm"
            disabled={query.page <= 1}
            onClick={() => updateQuery({ page: query.page - 1 })}
            aria-label={t('home.catalog.pagination.prevAria')}
          >
            <ChevronLeft size={14} aria-hidden />
            {t('home.catalog.pagination.prevLabel')}
          </Button>
          <span className={styles.paginationMeta} aria-live="polite">
            {`${t('home.catalog.pagination.pageLabel')} ${query.page} / ${totalPages}`}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={query.page >= totalPages}
            onClick={() => updateQuery({ page: query.page + 1 })}
            aria-label={t('home.catalog.pagination.nextAria')}
          >
            {t('home.catalog.pagination.nextLabel')}
            <ChevronRight size={14} aria-hidden />
          </Button>
        </div>
      </footer>
    </section>
  );
};

export default HomeResearchCatalog;
