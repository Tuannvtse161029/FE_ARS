import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TablePagination from '../../components/table/TablePagination';
import { TABLE_PAGINATION_TESTID } from '../../utils/tableConstants';

describe('<TablePagination />', () => {
  it('shows "Showing 1–10 of 37" header for a 37-item dataset on page 1', () => {
    const { container } = render(
      <TablePagination
        page={1}
        totalPages={4}
        startIndex={1}
        endIndex={10}
        totalItems={37}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onPage={vi.fn()}
      />,
    );
    expect(screen.getByText(/Showing/i)).toBeTruthy();
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('10');
    expect(container.textContent).toContain('37');
  });

  it('disables Previous on page 1', () => {
    render(
      <TablePagination
        page={1}
        totalPages={3}
        startIndex={1}
        endIndex={10}
        totalItems={30}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onPage={vi.fn()}
      />,
    );
    const prev = screen.getByTestId('table-pagination-prev') as HTMLButtonElement;
    const next = screen.getByTestId('table-pagination-next') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);
  });

  it('disables Next on final page', () => {
    render(
      <TablePagination
        page={3}
        totalPages={3}
        startIndex={21}
        endIndex={30}
        totalItems={30}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onPage={vi.fn()}
      />,
    );
    const prev = screen.getByTestId('table-pagination-prev') as HTMLButtonElement;
    const next = screen.getByTestId('table-pagination-next') as HTMLButtonElement;
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(true);
  });

  it('invokes onPage when a numbered page button is clicked', () => {
    const onPage = vi.fn();
    render(
      <TablePagination
        page={1}
        totalPages={3}
        startIndex={1}
        endIndex={10}
        totalItems={30}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onPage={onPage}
      />,
    );
    fireEvent.click(screen.getByTestId('table-pagination-page-2'));
    expect(onPage).toHaveBeenCalledWith(2);
  });

  it('renders nothing when the dataset is empty', () => {
    const { container } = render(
      <TablePagination
        page={1}
        totalPages={1}
        startIndex={0}
        endIndex={0}
        totalItems={0}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onPage={vi.fn()}
      />,
    );
    expect(container.querySelector(`[data-testid="${TABLE_PAGINATION_TESTID}"]`)).toBeNull();
  });
});
