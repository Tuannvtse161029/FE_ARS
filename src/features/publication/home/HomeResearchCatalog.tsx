import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Inbox, Search, SlidersHorizontal } from 'lucide-react';
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
import styles from './HomeResearchCatalog.module.css';

const PAGE_SIZE = 8;
const HOMEPAGE_ACCENT = 'var(--ars-blue)';

const SORT_OPTIONS: Array<{ value: NonNullable<CatalogQuery['sort']>; label: string }> = [
  { value: 'PUBLISHED_DESC', label: 'Newest published' },
  { value: 'PUBLISHED_ASC', label: 'Oldest published' },
  { value: 'TITLE_ASC', label: 'Title A-Z' },
];

/**
 * Authenticated research catalog.
 *
 * Surfaces only papers that satisfy the public catalog predicate
 * (`status === 'PUBLISHED' && visibility === 'PUBLIC'`). The BE must
 * apply the same predicate server-side — see
 * `docs/PUBLICATION_FLOW_API_BLOCKERS.md` §3.1.
 *
 * Visual:
 *   - WorkspaceHeader at the top with the publication accent (ARS blue)
 *     and a hero-style marker. Mirrors the editorial research-discovery
 *     pattern from Semantic Scholar / OpenAlex.
 *   - Search + filter toolbar below the hero, then a grid of paper
 *     cards. Stats row summarises the visible result set so the page
 *     reads as a real catalog, not just a list.
 */
export const HomeResearchCatalog = () => {
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
      .catch(() => active && setError('The research catalog could not be loaded.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const topicOptions = useMemo(
    () => Array.from(new Set(papers.flatMap((paper) => paper.topics))).sort(),
    [papers],
  );
  const domainOptions = useMemo(
    () =>
      Array.from(
        new Set(papers.map((paper) => paper.domain).filter((value): value is string => Boolean(value))),
      ).sort(),
    [papers],
  );
  const fieldOptions = useMemo(
    () =>
      Array.from(
        new Set(papers.map((paper) => paper.field).filter((value): value is string => Boolean(value))),
      ).sort(),
    [papers],
  );

  const updateQuery = (patch: Partial<CatalogQuery>) =>
    setQuery((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));

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

  return (
    <section className={styles.catalog}>
      <WorkspaceHeader
        marker="01 / PUBLIC CATALOG"
        title="Research catalog"
        subtitle="Discover ARS publications across authors, institutions, topics, and research domains."
        annotation="An OpenAlex-style research discovery surface. Every paper has passed editorial review and is publicly visible."
        accent={HOMEPAGE_ACCENT}
      />

      {isDemo && <PublicationDemoBanner />}

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={18} aria-hidden="true" />
          <input
            id="public-catalog-search-input"
            aria-label="Search published research"
            value={query.query ?? ''}
            onChange={(event) => updateQuery({ query: event.target.value })}
            placeholder="Search title, author, DOI, institution, topic, or keyword"
          />
        </label>
        <label className={styles.filter}>
          <SlidersHorizontal size={14} aria-hidden="true" />
          <span>Topic</span>
          <select
            aria-label="Filter by topic"
            value={query.topic ?? ''}
            onChange={(event) => updateQuery({ topic: event.target.value || undefined })}
          >
            <option value="">All topics</option>
            {topicOptions.map((topic) => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>
        </label>
        <label className={styles.filter}>
          <span>Domain</span>
          <select
            aria-label="Filter by domain"
            value={query.domain ?? ''}
            onChange={(event) => updateQuery({ domain: event.target.value || undefined })}
          >
            <option value="">All domains</option>
            {domainOptions.map((domain) => (
              <option key={domain} value={domain}>{domain}</option>
            ))}
          </select>
        </label>
        <label className={styles.filter}>
          <span>Field</span>
          <select
            aria-label="Filter by field"
            value={query.field ?? ''}
            onChange={(event) => updateQuery({ field: event.target.value || undefined })}
          >
            <option value="">All fields</option>
            {fieldOptions.map((field) => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
        </label>
        <label className={styles.filter}>
          <span>Sort</span>
          <select
            aria-label="Catalog sort"
            value={query.sort}
            onChange={(event) => updateQuery({ sort: event.target.value as CatalogQuery['sort'] })}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.resultContext} aria-live="polite">
        <span>
          {loading
            ? 'Loading published research…'
            : `${total.toLocaleString('en-US')} published paper${total === 1 ? '' : 's'}`}
        </span>
        {!loading && (query.query || query.topic || query.domain || query.field) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateQuery({ query: undefined, topic: undefined, domain: undefined, field: undefined })}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      {loading ? (
        <SkeletonRow count={6} withHeader />
      ) : error ? (
        <ErrorBanner
          tone="error"
          title="Could not load catalog"
          message={error}
        />
      ) : papers.length === 0 ? (
        <EmptyState
          icon={<Inbox size={20} aria-hidden />}
          title={query.query || query.topic || query.domain || query.field
            ? 'No published papers match the current catalog filters'
            : 'The public catalog is empty'}
          description={
            query.query || query.topic || query.domain || query.field
              ? 'Adjust your filters, clear the search, or change the sort to see every published paper.'
              : 'Published papers will appear here once Admin completes the editorial workflow.'
          }
          action={
            (query.query || query.topic || query.domain || query.field) ? (
              <Button
                variant="outline"
                size="md"
                onClick={() => updateQuery({ query: undefined, topic: undefined, domain: undefined, field: undefined })}
              >
                Clear filters
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
          <strong>{total.toLocaleString('en-US')}</strong> published paper{total === 1 ? '' : 's'}
        </span>
        <div className={styles.paginationControls}>
          <Button
            variant="outline"
            size="sm"
            disabled={query.page <= 1}
            onClick={() => updateQuery({ page: query.page - 1 })}
            aria-label="Previous catalog page"
          >
            <ChevronLeft size={14} aria-hidden />
            Previous
          </Button>
          <span className={styles.paginationMeta} aria-live="polite">
            Page {query.page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={query.page >= totalPages}
            onClick={() => updateQuery({ page: query.page + 1 })}
            aria-label="Next catalog page"
          >
            Next
            <ChevronRight size={14} aria-hidden />
          </Button>
        </div>
      </footer>
    </section>
  );
};

export default HomeResearchCatalog;