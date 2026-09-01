import { useCallback, useRef, useState } from 'react';
import { useShortcuts, type ShortcutSpec } from './useShortcuts';

/**
 * Focus a DOM element by id, then call an optional callback.
 * Used by the `f` shortcut to focus the toolbar search input.
 */
const focusById = (id: string, fallback?: () => void) => {
  const el = document.getElementById(id);
  if (el) {
    el.focus();
    // For <input type="search">, move cursor to end
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.setSelectionRange(el.value.length, el.value.length);
    }
    return;
  }
  fallback?.();
};

export interface UseListShortcutsOptions {
  /**
   * Total number of navigable items on the current page.
   * Used to clamp the selected index.
   */
  itemCount: number;
  /**
   * Called when Enter is pressed on a selected row.
   * Receives the 0-based selected index.
   */
  onOpen: (index: number) => void;
  /**
   * Optional. Called when `n` is pressed to create a new item.
   * If omitted, the `n` shortcut is not registered.
   */
  onNew?: () => void;
  /**
   * Optional. Called when `f` is pressed to focus the filter/search bar.
   * Defaults to focusing `document.getElementById('table-search-input')`.
   * Pass `() => {}` to suppress the shortcut entirely.
   */
  onFilterFocus?: (() => void) | null;
  /**
   * Optional id of the element to focus when `f` is pressed.
   * Defaults to `'table-search-input'` (TableToolbar's search input).
   */
  filterFocusId?: string;
  /**
   * Optional. If true, the selected index is reset to 0 whenever
   * `itemCount` drops below the current index (e.g. after filtering).
   */
  autoResetOnChange?: boolean;
}

/**
 * useListShortcuts — keyboard navigation for paginated tables and card grids.
 *
 * Registers j/k/Enter/n/f shortcuts and manages the selected row index.
 * Shortcuts are suppressed when focus is inside a text input or when a
 * modal is open (handled by useShortcuts' built-in guards).
 *
 * Design contract (Part 3 of the keyboard-shortcut rollout):
 *   - `j`  → move selection down one row
 *   - `k`  → move selection up one row
 *   - `Enter` → open / inspect the selected row
 *   - `n`  → open the "new item" form (optional, omit `onNew` to disable)
 *   - `f`  → focus the toolbar search/filter input
 *
 * Each page wires the returned `selectedIndex` to a visual highlight on the
 * target row or card element.
 *
 * Usage:
 * ```tsx
 * const { selectedIndex, shortcuts } = useListShortcuts({
 *   itemCount: pageItems.length,
 *   onOpen: (i) => navigateTo(pageItems[i].id),
 *   onNew: () => setShowCreate(true),
 * });
 * // ...
 * <tr className={selectedIndex === index ? styles.selectedRow : ''} />
 * ```
 */
export const useListShortcuts = ({
  itemCount,
  onOpen,
  onNew,
  onFilterFocus,
  filterFocusId = 'table-search-input',
  autoResetOnChange = true,
}: UseListShortcutsOptions) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Keep the latest itemCount in a ref so the move handlers don't need to
  // re-bind when the count changes.
  const itemCountRef = useRef(itemCount);
  itemCountRef.current = itemCount;

  // Clamp the index to the valid range.
  const clamp = useCallback((idx: number) => {
    const max = Math.max(0, itemCountRef.current - 1);
    return Math.max(0, Math.min(idx, max));
  }, []);

  const moveDown = useCallback(() => {
    setSelectedIndex((prev) => clamp(prev + 1));
  }, [clamp]);

  const moveUp = useCallback(() => {
    setSelectedIndex((prev) => clamp(prev - 1));
  }, [clamp]);

  // Default filter-focus: focus the TableToolbar search input by id.
  const handleFilterFocus = useCallback(() => {
    if (onFilterFocus === null) return;
    focusById(filterFocusId, onFilterFocus);
  }, [filterFocusId, onFilterFocus]);

  // Build the ShortcutSpec array — only includes `n` when `onNew` is provided
  // and only includes `f` when `onFilterFocus` is not explicitly `null`
  // (callers can pass `() => {}` to suppress the shortcut, or omit the prop
  // entirely to fall back to the default focus-by-id behaviour).
  const suppressFilter = onFilterFocus === null;
  const specs: ShortcutSpec[] = [
    {
      key: 'j',
      label: 'Next row',
      description: 'Move keyboard focus to the row below.',
      group: 'list',
      handler: moveDown,
    },
    {
      key: 'k',
      label: 'Previous row',
      description: 'Move keyboard focus to the row above.',
      group: 'list',
      handler: moveUp,
    },
    {
      key: 'Enter',
      label: 'Open item',
      description: 'Open or inspect the currently focused row.',
      group: 'list',
      handler: () => {
        const idx = Math.min(selectedIndex, Math.max(0, itemCountRef.current - 1));
        if (itemCountRef.current > 0) onOpen(idx);
      },
    },
    ...(!suppressFilter
      ? [
          {
            key: 'f' as const,
            label: 'Focus filter',
            description: 'Move focus to the search / filter bar.',
            group: 'list' as const,
            handler: handleFilterFocus,
          },
        ]
      : []),
    ...(onNew
      ? [
          {
            key: 'n' as const,
            label: 'New item',
            description: 'Open the create / new item form.',
            group: 'list' as const,
            handler: onNew,
          },
        ]
      : []),
  ];

  useShortcuts(specs);

  // Auto-reset selected index when itemCount shrinks below the current index.
  // This prevents a stale selection after the user applies a filter.
  const prevItemCountRef = useRef(itemCount);
  if (
    autoResetOnChange &&
    itemCount < prevItemCountRef.current &&
    selectedIndex >= itemCount
  ) {
    setSelectedIndex(Math.max(0, itemCount - 1));
  }
  prevItemCountRef.current = itemCount;

  return { selectedIndex, setSelectedIndex };
};

export default useListShortcuts;
