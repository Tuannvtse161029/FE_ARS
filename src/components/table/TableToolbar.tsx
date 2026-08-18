import { ReactNode } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import {
  TABLE_TOOLBAR_TESTID,
  TABLE_SEARCH_INPUT_TESTID,
  TABLE_REFRESH_BTN_TESTID,
} from '../../utils/tableConstants';
import styles from './TableToolbar.module.css';

export interface TableToolbarProps {
  search: string;
  onSearchChange: (next: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  searchPlaceholder?: string;
  refreshLabel?: string;
  // Right-side slot for additional filter <select>s the page wants to keep.
  filters?: ReactNode;
}

// Shared toolbar for every business-data table. The contract is:
//   - Search input (lucide `Search` icon, next to the refresh control)
//   - Refresh button (lucide `RefreshCw`, spins while inflight)
//   - Optional filter slot for page-specific <select>s
//
// Used by Admin / Lecturer / Researcher / Reviewer / Graduate Student table
// pages. Each caller binds `search` to controlled state and `onRefresh` to
// the page's `refetch()` (or local `load()`) helper.

export const TableToolbar = ({
  search,
  onSearchChange,
  onRefresh,
  isRefreshing,
  searchPlaceholder = 'Search…',
  refreshLabel = 'Refresh',
  filters,
}: TableToolbarProps) => (
  <div className={styles.toolbar} data-testid={TABLE_TOOLBAR_TESTID}>
    <label className={styles.searchField}>
      <span className={styles.searchIcon}>
        <Search size={14} aria-hidden />
      </span>
      <input
        type="search"
        className={styles.searchInput}
        value={search}
        placeholder={searchPlaceholder}
        onChange={(e) => onSearchChange(e.target.value)}
        data-testid={TABLE_SEARCH_INPUT_TESTID}
        aria-label="Search table"
      />
    </label>
    <div className={styles.toolbarFilters}>{filters}</div>
    <button
      type="button"
      className={styles.refreshBtn}
      onClick={onRefresh}
      disabled={isRefreshing}
      data-testid={TABLE_REFRESH_BTN_TESTID}
    >
      <RefreshCw
        size={13}
        className={isRefreshing ? styles.spinning : undefined}
        aria-hidden
      />
      {isRefreshing ? 'Refreshing…' : refreshLabel}
    </button>
  </div>
);

export default TableToolbar;
