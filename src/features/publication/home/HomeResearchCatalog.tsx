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
import { useLocale } from '../../../i18n/I18nContext';
import styles from './HomeResearchCatalog.module.css';

const PAGE_SIZE = 8;
const HOMEPAGE_ACCENT = 'var(--ars-blue)';

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
  const locale = useLocale();
  const copy = (en: string, vi: string): string => (locale === 'en' ? en : vi);

  const sortOptions: Array<{ value: NonNullable<CatalogQuery['sort']>; label: string }> = [
    { value: 'PUBLISHED_DESC', label: copy('Newest published', 'Mới xuất bản nhất') },
    { value: 'PUBLISHED_ASC', label: copy('Oldest published', 'Xuất bản cũ nhất') },
    { value: 'TITLE_ASC', label: copy('Title A-Z', 'Tiêu đề A-Z') },
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
        marker={copy('01 / PUBLIC CATALOG', '01 / DANH MỤC CÔNG KHAI')}
        title={copy('Research catalog', 'Danh mục nghiên cứu')}
        subtitle={copy('Discover ARS publications across authors, institutions, topics, and research domains.', 'Khám phá các công trình nghiên cứu ARS theo tác giả, viện nghiên cứu, chủ đề và lĩnh vực.')}
        annotation={copy('An OpenAlex-style research discovery surface. Every paper has passed editorial review and is publicly visible.', 'Không gian khám phá nghiên cứu. Mọi bài báo đều đã qua xét duyệt biên tập và hiển thị công khai.')}
        accent={HOMEPAGE_ACCENT}
      />

      {isDemo && <PublicationDemoBanner />}

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={18} aria-hidden="true" />
          <input
            id="public-catalog-search-input"
            aria-label={copy('Search published research', 'Tìm kiếm nghiên cứu đã xuất bản')}
            value={query.query ?? ''}
            onChange={(event) => updateQuery({ query: event.target.value })}
            placeholder={copy('Search title, author, DOI, institution, topic, or keyword', 'Tìm kiếm tiêu đề, tác giả, DOI, viện nghiên cứu, chủ đề hoặc từ khóa')}
          />
        </label>
        <label className={styles.filter}>
          <SlidersHorizontal size={14} aria-hidden="true" />
          <span>{copy('Topic', 'Chủ đề')}</span>
          <select
            aria-label={copy('Filter by topic', 'Lọc theo chủ đề')}
            value={query.topic ?? ''}
            onChange={(event) => updateQuery({ topic: event.target.value || undefined })}
          >
            <option value="">{copy('All topics', 'Tất cả chủ đề')}</option>
            {topicOptions.map((topic) => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>
        </label>
        <label className={styles.filter}>
          <span>{copy('Domain', 'Lĩnh vực')}</span>
          <select
            aria-label={copy('Filter by domain', 'Lọc theo lĩnh vực')}
            value={query.domain ?? ''}
            onChange={(event) => updateQuery({ domain: event.target.value || undefined })}
          >
            <option value="">{copy('All domains', 'Tất cả lĩnh vực')}</option>
            {domainOptions.map((domain) => (
              <option key={domain} value={domain}>{domain}</option>
            ))}
          </select>
        </label>
        <label className={styles.filter}>
          <span>{copy('Field', 'Ngành')}</span>
          <select
            aria-label={copy('Filter by field', 'Lọc theo ngành')}
            value={query.field ?? ''}
            onChange={(event) => updateQuery({ field: event.target.value || undefined })}
          >
            <option value="">{copy('All fields', 'Tất cả ngành')}</option>
            {fieldOptions.map((field) => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
        </label>
        <label className={styles.filter}>
          <span>{copy('Sort', 'Sắp xếp')}</span>
          <select
            aria-label={copy('Catalog sort', 'Sắp xếp danh mục')}
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
            ? copy('Loading published research…', 'Đang tải danh mục nghiên cứu…')
            : `${total.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')} ${copy(total === 1 ? 'published paper' : 'published papers', 'bài báo đã xuất bản')}`}
        </span>
        {!loading && (query.query || query.topic || query.domain || query.field) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateQuery({ query: undefined, topic: undefined, domain: undefined, field: undefined })}
          >
            {copy('Clear filters', 'Xóa bộ lọc')}
          </Button>
        ) : null}
      </div>

      {loading ? (
        <SkeletonRow count={6} withHeader />
      ) : error ? (
        <ErrorBanner
          tone="error"
          title={copy('Could not load catalog', 'Không thể tải danh mục')}
          message={error}
        />
      ) : papers.length === 0 ? (
        <EmptyState
          icon={<Inbox size={20} aria-hidden />}
          title={query.query || query.topic || query.domain || query.field
            ? copy('No published papers match the current catalog filters', 'Không có bài báo nào khớp với bộ lọc hiện tại')
            : copy('The public catalog is empty', 'Danh mục công khai đang trống')}
          description={
            query.query || query.topic || query.domain || query.field
              ? copy('Adjust your filters, clear the search, or change the sort to see every published paper.', 'Hãy điều chỉnh bộ lọc, xóa tìm kiếm hoặc thay đổi thứ tự sắp xếp.')
              : copy('Published papers will appear here once Admin completes the editorial workflow.', 'Bài báo xuất bản sẽ xuất hiện tại đây sau khi hoàn tất quy trình biên tập.')
          }
          action={
            (query.query || query.topic || query.domain || query.field) ? (
              <Button
                variant="outline"
                size="md"
                onClick={() => updateQuery({ query: undefined, topic: undefined, domain: undefined, field: undefined })}
              >
                {copy('Clear filters', 'Xóa bộ lọc')}
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
          <strong>{total.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')}</strong> {copy(total === 1 ? 'published paper' : 'published papers', 'bài báo đã xuất bản')}
        </span>
        <div className={styles.paginationControls}>
          <Button
            variant="outline"
            size="sm"
            disabled={query.page <= 1}
            onClick={() => updateQuery({ page: query.page - 1 })}
            aria-label={copy('Previous catalog page', 'Trang trước')}
          >
            <ChevronLeft size={14} aria-hidden />
            {copy('Previous', 'Trước')}
          </Button>
          <span className={styles.paginationMeta} aria-live="polite">
            {`${copy('Page', 'Trang')} ${query.page} / ${totalPages}`}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={query.page >= totalPages}
            onClick={() => updateQuery({ page: query.page + 1 })}
            aria-label={copy('Next catalog page', 'Trang sau')}
          >
            {copy('Next', 'Sau')}
            <ChevronRight size={14} aria-hidden />
          </Button>
        </div>
      </footer>
    </section>
  );
};

export default HomeResearchCatalog;