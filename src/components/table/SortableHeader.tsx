// SortableHeader — clickable table column header that drives a
// useTableSort hook. Renders an aria-sort attribute and an icon
// chevron that reflects the current sort direction.
//
// Status columns can additionally surface an inline filter dropdown
// (controlled via `filterOptions` + `activeFilter` + `onFilterChange`).
// The dropdown sits next to the sort chevron and filters the table to
// only rows whose value matches the selected option. "All" clears it.
//
// Usage — sortable + filterable:
//   const sort = useTableSort<...>(...);
//   <SortableHeader
//     column="status"
//     label="Status"
//     cycleSort={sort.cycleSort}
//     ariaSortFor={sort.ariaSortFor}
//     filterOptions={[
//       { value: 'ALL', label: 'All statuses' },
//       { value: 'PENDING', label: 'Pending' },
//       { value: 'COMPLETED', label: 'Completed' },
//     ]}
//     activeFilter={statusFilter}
//     onFilterChange={setStatusFilter}
//   />
//
// Usage — sortable only (default):
//   <SortableHeader
//     column="name"
//     label="Name"
//     cycleSort={sort.cycleSort}
//     ariaSortFor={sort.ariaSortFor}
//   />

import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import type { CSSProperties, MouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import styles from './SortableHeader.module.css';

export interface SortableHeaderFilterOption {
  value: string;
  label: string;
}

export interface SortableHeaderProps<K extends string> {
  column: K;
  label: string;
  cycleSort: (column: K) => void;
  ariaSortFor: (column: K) => 'ascending' | 'descending' | 'none' | undefined;
  /**
   * Right-align the header content. Use for numeric columns or action
   * columns that should hug the right edge of the table.
   */
  align?: 'left' | 'right' | 'center';
  /** Optional className passthrough for table-specific styling. */
  className?: string;
  /**
   * Optional inline filter dropdown. Pass the list of available values
   * (including an "ALL" / "All" entry that clears the filter) to enable.
   */
  filterOptions?: ReadonlyArray<SortableHeaderFilterOption>;
  /** The currently selected filter value. Pass `null` or `'ALL'` for no filter. */
  activeFilter?: string | null;
  /** Called when the user picks a filter option. */
  onFilterChange?: (next: string) => void;
}

export function SortableHeader<K extends string>({
  column,
  label,
  cycleSort,
  ariaSortFor,
  align = 'left',
  className,
  filterOptions,
  activeFilter,
  onFilterChange,
}: SortableHeaderProps<K>) {
  const ariaSort = ariaSortFor(column);
  const isActive = ariaSort !== undefined;
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);

  // Close the dropdown on outside-click or Escape.
  useEffect(() => {
    if (!filterOpen) return undefined;
    const handleClick = (event: globalThis.MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !filterRef.current) return;
      if (!filterRef.current.contains(target)) {
        setFilterOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [filterOpen]);

  const onSortClick = (e: MouseEvent<HTMLButtonElement>) => {
    // Don't sort when the click originates from the filter dropdown —
    // the dropdown owns its own click handlers.
    if (
      filterRef.current &&
      e.target instanceof Node &&
      filterRef.current.contains(e.target)
    ) {
      return;
    }
    e.preventDefault();
    cycleSort(column);
  };

  const filterActive =
    typeof activeFilter === 'string' && activeFilter !== 'ALL' && activeFilter.length > 0;

  const style: CSSProperties = {};
  if (align === 'right') {
    style.justifyContent = 'flex-end';
  } else if (align === 'center') {
    style.justifyContent = 'center';
  }

  return (
    <div
      className={`${styles.wrapper} ${
        align === 'right'
          ? styles.wrapperRight
          : align === 'center'
          ? styles.wrapperCenter
          : ''
      } ${className ?? ''}`}
      style={style}
    >
      <button
        type="button"
        className={`${styles.button} ${isActive ? styles.active : ''}`}
        onClick={onSortClick}
        data-testid={`sort-header-${column}`}
        aria-sort={ariaSort ?? 'none'}
      >
        <span className={styles.label}>{label}</span>
        <span className={styles.icon} aria-hidden="true">
          {!isActive || ariaSort === 'ascending' ? (
            <ChevronUp
              size={11}
              className={ariaSort === 'ascending' ? styles.iconActive : styles.iconDim}
            />
          ) : (
            <ChevronDown
              size={11}
              className={ariaSort === 'descending' ? styles.iconActive : styles.iconDim}
            />
          )}
        </span>
      </button>

      {filterOptions && filterOptions.length > 0 && onFilterChange ? (
        <div
          ref={filterRef}
          className={`${styles.filterWrap} ${filterActive ? styles.filterWrapActive : ''}`}
          data-testid={`status-filter-${column}`}
        >
          <button
            type="button"
            className={`${styles.filterToggle} ${filterActive ? styles.filterToggleActive : ''}`}
            onClick={() => setFilterOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={filterOpen}
            aria-label={`Filter ${label}`}
            title={
              filterActive
                ? `Filtering by ${activeFilter} — click to change`
                : `Filter ${label}`
            }
          >
            <Filter size={11} aria-hidden />
          </button>
          {filterActive ? (
            <button
              type="button"
              className={styles.filterClear}
              onClick={() => onFilterChange('ALL')}
              aria-label="Clear filter"
              title="Clear filter"
            >
              <X size={10} aria-hidden />
            </button>
          ) : null}
          {filterOpen ? (
            <div className={styles.filterMenu} role="listbox">
              {filterOptions.map((opt) => {
                const selected = (activeFilter ?? 'ALL') === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`${styles.filterOption} ${selected ? styles.filterOptionActive : ''}`}
                    onClick={() => {
                      onFilterChange(opt.value);
                      setFilterOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default SortableHeader;