import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import { PublicationDemoBanner } from '../components/PublicationDemoBanner';
import shared from '../components/PublicationShared.module.css';
import type { CatalogQuery, PublicationPaper } from '../types/publication';
import { PublishedPaperCard } from './PublishedPaperCard';
import styles from './HomeResearchCatalog.module.css';

const PAGE_SIZE = 8;

const publicReviewerName = (paper: PublicationPaper): string | null =>
  paper.reviewerIdentityPublic ? paper.reviewer?.reviewerName ?? null : null;

const SORT_OPTIONS: Array<{ value: NonNullable<CatalogQuery['sort']>; label: string }> = [
  { value: 'PUBLISHED_DESC', label: 'Newest published' },
  { value: 'PUBLISHED_ASC', label: 'Oldest published' },
  { value: 'TITLE_ASC', label: 'Title A-Z' },
];

/**
 * Authenticated research catalog.
 *
 * Surfaces only papers that satisfy the public catalog predicate
 * (`status === 'PUBLISHED' && visibility === 'PUBLIC'`). The BE must apply
 * the same predicate server-side when the demo adapter is replaced —
 * see `docs/PUBLICATION_FLOW_API_BLOCKERS.md` §3.1.
 */
export const HomeResearchCatalog = () => {
  const [query, setQuery] = useState<CatalogQuery>({ page: 1, pageSize: PAGE_SIZE, sort: 'PUBLISHED_DESC' });
  const [papers, setPapers] = useState<PublicationPaper[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    publicationAdapter.getPublicCatalog(query)
      .then((result) => {
        if (!active) return;
        setPapers(result.items);
        setTotal(result.totalCount);
      })
      .catch(() => active && setError('The research catalog could not be loaded.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const topicOptions = useMemo(
    () => Array.from(new Set(papers.flatMap((paper) => paper.topics))).sort(),
    [papers],
  );
  const domainOptions = useMemo(
    () => Array.from(new Set(papers.map((paper) => paper.domain).filter((value): value is string => Boolean(value)))).sort(),
    [papers],
  );
  const fieldOptions = useMemo(
    () => Array.from(new Set(papers.map((paper) => paper.field).filter((value): value is string => Boolean(value)))).sort(),
    [papers],
  );

  const updateQuery = (patch: Partial<CatalogQuery>) =>
    setQuery((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));

  return (
    <section className={`${shared.page} ${styles.catalog}`}>
      <header className={shared.header}>
        <div>
          <h1>Research Catalog</h1>
          <p>Discover ARS publications across authors, institutions, topics, and research domains.</p>
        </div>
      </header>
      <PublicationDemoBanner />
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Search published research"
            value={query.query ?? ''}
            onChange={(event) => updateQuery({ query: event.target.value })}
            placeholder="Search title, author, DOI, institution, topic, or keyword"
          />
        </label>
        <label className={styles.filter}>
          <SlidersHorizontal size={16} aria-hidden="true" />
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

      {loading ? (
        <div className={shared.loading} role="status">Loading published research...</div>
      ) : error ? (
        <div className={shared.error} role="alert">{error}</div>
      ) : papers.length === 0 ? (
        <div className={shared.empty}>No published papers match the current catalog filters.</div>
      ) : (
        <div className={styles.results} data-testid="public-paper-results">
          {papers.map((paper) => (
            <PublishedPaperCard
              key={paper.id}
              paper={paper}
              publicReviewerName={publicReviewerName(paper)}
            />
          ))}
        </div>
      )}

      <footer className={styles.pagination}>
        <span>{total} published papers</span>
        <div>
          <button
            aria-label="Previous catalog page"
            className={shared.buttonSecondary}
            disabled={query.page <= 1}
            onClick={() => updateQuery({ page: query.page - 1 })}
          >
            <ChevronLeft size={16} />
          </button>
          <span>Page {query.page} of {totalPages}</span>
          <button
            aria-label="Next catalog page"
            className={shared.buttonSecondary}
            disabled={query.page >= totalPages}
            onClick={() => updateQuery({ page: query.page + 1 })}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </footer>
    </section>
  );
};

export default HomeResearchCatalog;
