import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TableToolbar from '../../components/table/TableToolbar';
import {
  TABLE_TOOLBAR_TESTID,
  TABLE_SEARCH_INPUT_TESTID,
  TABLE_REFRESH_BTN_TESTID,
} from '../../utils/tableConstants';

describe('<TableToolbar />', () => {
  it('calls onSearchChange when the input value changes', () => {
    const onSearchChange = vi.fn();
    render(
      <TableToolbar
        search=""
        onSearchChange={onSearchChange}
        onRefresh={vi.fn()}
        isRefreshing={false}
      />,
    );
    fireEvent.change(screen.getByTestId(TABLE_SEARCH_INPUT_TESTID), {
      target: { value: 'alice' },
    });
    expect(onSearchChange).toHaveBeenCalledWith('alice');
  });

  it('renders search + refresh control NEXT TO EACH OTHER', () => {
    render(
      <TableToolbar
        search=""
        onSearchChange={vi.fn()}
        onRefresh={vi.fn()}
        isRefreshing={false}
      />,
    );
    const toolbar = screen.getByTestId(TABLE_TOOLBAR_TESTID);
    const searchInput = screen.getByTestId(TABLE_SEARCH_INPUT_TESTID);
    const refreshBtn = screen.getByTestId(TABLE_REFRESH_BTN_TESTID);
    // Both controls must exist in the same toolbar element.
    expect(toolbar.contains(searchInput)).toBe(true);
    expect(toolbar.contains(refreshBtn)).toBe(true);
    // And they're adjacent — no extra separator between them.
    expect(
      (refreshBtn.compareDocumentPosition(searchInput) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
        0,
    ).toBe(false);
  });

  it('calls onRefresh when refresh is clicked and disables while refreshing', () => {
    const onRefresh = vi.fn();
    const { rerender } = render(
      <TableToolbar
        search=""
        onSearchChange={vi.fn()}
        onRefresh={onRefresh}
        isRefreshing={false}
      />,
    );
    const btn = screen.getByTestId(TABLE_REFRESH_BTN_TESTID) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    rerender(
      <TableToolbar
        search=""
        onSearchChange={vi.fn()}
        onRefresh={onRefresh}
        isRefreshing
      />,
    );
    expect(
      (screen.getByTestId(TABLE_REFRESH_BTN_TESTID) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
