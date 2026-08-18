// Page-size constants and labels for ARS FE tables.
//
// All business-data tables display EXACTLY 10 records per page by default.
// Researcher reviewer-card grids display 9 cards per page (3 × 3).
// These constants are shared by every table page and the reusable
// <Pagination /> + <TableToolbar /> components.

export const DEFAULT_PAGE_SIZE = 10;
export const REVIEWER_GRID_PAGE_SIZE = 9;

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export const TABLE_TOOLBAR_TESTID = 'table-toolbar';
export const TABLE_PAGINATION_TESTID = 'table-pagination';
export const TABLE_SEARCH_INPUT_TESTID = 'table-search-input';
export const TABLE_REFRESH_BTN_TESTID = 'table-refresh-btn';
export const TABLE_EMPTY_TESTID = 'table-empty';
export const TABLE_LOADING_TESTID = 'table-loading';
export const TABLE_ERROR_TESTID = 'table-error';
