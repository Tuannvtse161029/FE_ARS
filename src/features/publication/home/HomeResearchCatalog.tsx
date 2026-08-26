import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import { PublicationDemoBanner } from '../components/PublicationDemoBanner';
import shared from '../components/PublicationShared.module.css';
import type { CatalogQuery, PublicationPaper } from '../types/publication';
import styles from './HomeResearchCatalog.module.css';

const PAGE_SIZE = 8;

const publicReviewerName = (paper: PublicationPaper): string | null =>
  paper.reviewerIdentityPublic ? paper.reviewer?.reviewerName ?? null : null;

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
  const topicOptions = useMemo(() => Array.from(new Set(papers.flatMap((paper) => paper.topics))).sort(), [papers]);
  const updateQuery = (patch: Partial<CatalogQuery>) => setQuery((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));

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
          <input aria-label="Search published research" value={query.query ?? ''} onChange={(event) => updateQuery({ query: event.target.value })} placeholder="Search title, author, DOI, institution, or topic" />
        </label>
        <label className={styles.filter}><SlidersHorizontal size={16} /><span>Topic</span><select aria-label="Filter by topic" value={query.topic ?? ''} onChange={(event) => updateQuery({ topic: event.target.value || undefined })}><option value="">All topics</option>{topicOptions.map((topic) => <option key={topic} value={topic}>{topic}</option>)}</select></label>
        <label className={styles.filter}><span>Sort</span><select aria-label="Catalog sort" value={query.sort} onChange={(event) => updateQuery({ sort: event.target.value as CatalogQuery['sort'] })}><option value="PUBLISHED_DESC">Newest published</option><option value="PUBLISHED_ASC">Oldest published</option><option value="TITLE_ASC">Title A-Z</option></select></label>
      </div>
      {loading ? <div className={shared.loading} role="status">Loading published research...</div> : error ? <div className={shared.error} role="alert">{error}</div> : papers.length === 0 ? <div className={shared.empty}>No published papers match the current catalog filters.</div> : <div className={styles.results}>{papers.map((paper) => <article className={styles.paper} key={paper.id} data-testid="public-paper-card"><div className={styles.paperMeta}><span>{paper.paperType}</span><span>Published {paper.publishedAt?.slice(0, 10)}</span></div><h2>{paper.title}</h2><p className={styles.authors}>{paper.authors.sort((a, b) => a.order - b.order).map((author) => author.name).join(', ')}</p><p className={styles.institutions}>{paper.institutions.map((institution) => institution.name).join(' · ')}</p><p className={styles.abstract}>{paper.abstract}</p><div className={styles.tags}>{paper.topics.map((topic) => <span key={topic}>{topic}</span>)}</div><dl className={styles.details}><div><dt>Identifier</dt><dd>{paper.doi ?? paper.externalIdentifier ?? paper.openAlexId ?? 'Not supplied'}</dd></div><div><dt>Field</dt><dd>{[paper.domain, paper.field, paper.subfield].filter(Boolean).join(' / ') || 'Not classified'}</dd></div>{publicReviewerName(paper) && <div><dt>Reviewed by</dt><dd>{publicReviewerName(paper)}</dd></div>}</dl></article>)}</div>}
      <footer className={styles.pagination}><span>{total} published papers</span><div><button aria-label="Previous catalog page" className={shared.buttonSecondary} disabled={query.page <= 1} onClick={() => updateQuery({ page: query.page - 1 })}><ChevronLeft size={16} /></button><span>Page {query.page} of {totalPages}</span><button aria-label="Next catalog page" className={shared.buttonSecondary} disabled={query.page >= totalPages} onClick={() => updateQuery({ page: query.page + 1 })}><ChevronRight size={16} /></button></div></footer>
    </section>
  );
};

export default HomeResearchCatalog;
