import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { TABLE_PAGINATION_TESTID } from '../../utils/tableConstants';
import styles from './TablePagination.module.css';

export interface TablePaginationProps {
  page: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  totalItems: number;
  isRefreshing?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPage: (page: number) => void;
  // Optional explicit label override (used by Researcher grid)
  itemLabel?: string;
}

// Compute the numbered page list — collapses to a window of 5 with ellipses
// when the dataset has more than 7 pages.
function buildPageList(page: number, totalPages: number): Array<number | '…'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const list: Array<number | '…'> = [1];
  const windowStart = Math.max(2, page - 1);
  const windowEnd = Math.min(totalPages - 1, page + 1);
  if (windowStart > 2) list.push('…');
  for (let p = windowStart; p <= windowEnd; p += 1) list.push(p);
  if (windowEnd < totalPages - 1) list.push('…');
  list.push(totalPages);
  return list;
}

export const TablePagination = ({
  page,
  totalPages,
  startIndex,
  endIndex,
  totalItems,
  isRefreshing = false,
  onPrev,
  onNext,
  onPage,
  itemLabel = 'items',
}: TablePaginationProps) => {
  if (totalItems === 0) {
    // No data — leave the toolbar alone; caller renders its own empty state.
    return null;
  }
  const pages = buildPageList(page, totalPages);
  return (
    <div
      className={styles.pagination}
      data-testid={TABLE_PAGINATION_TESTID}
      role="navigation"
      aria-label="Pagination"
    >
      <span className={styles.paginationInfo}>
        Showing <strong>{startIndex}</strong>–<strong>{endIndex}</strong> of{' '}
        <strong>{totalItems}</strong> {itemLabel}
      </span>
      <div className={styles.paginationControls}>
        <button
          type="button"
          className={styles.paginationBtn}
          onClick={onPrev}
          disabled={page <= 1}
          aria-label="Previous page"
          data-testid="table-pagination-prev"
        >
          <ChevronLeft size={14} />
          Previous
        </button>
        {pages.map((p, idx) =>
          p === '…' ? (
            <span
              key={`ellipsis-${idx}`}
              className={styles.paginationEllipsis}
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`${styles.paginationBtn} ${
                p === page ? styles.paginationBtnActive : ''
              }`}
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Page ${p}`}
              data-testid={`table-pagination-page-${p}`}
              disabled={isRefreshing}
            >
              {p === page && isRefreshing ? (
                <Loader2 size={12} className={styles.paginationSpinner} />
              ) : null}
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className={styles.paginationBtn}
          onClick={onNext}
          disabled={page >= totalPages}
          aria-label="Next page"
          data-testid="table-pagination-next"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default TablePagination;
