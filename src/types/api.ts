export interface ApiResponse<T> {
  data?: T;
  message?: string;
  status: number;
  success: boolean;
}

export interface PaginationParams {
  pageNumber: number;
  pageSize: number;
}

export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface ApiError {
  message: string;
  statusCode?: number;
  errors?: Record<string, string[]>;
}

export interface AxiosErrorResponse {
  message: string;
  errors?: Record<string, string[]>;
}
