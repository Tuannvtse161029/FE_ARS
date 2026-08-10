import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFetch } from '../../hooks/useFetch';
import api from '../../services/axios';
import type { ApiResponse } from '../../types/api';

// Mock the axios instance
vi.mock('../../services/axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('useFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // INITIAL STATE
  // ─────────────────────────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('should have correct initial values with immediate=true (default)', () => {
      mockedApi.get.mockResolvedValueOnce({
        data: { data: { id: 1 } } as ApiResponse<{ id: number }>,
      });

      const { result } = renderHook(() => useFetch<{ id: number }>('/api/test'));

      // Initial state when immediate=true
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should not be loading when immediate=false', () => {
      const { result } = renderHook(() =>
        useFetch<unknown>('/api/test', { immediate: false })
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(mockedApi.get).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SUCCESSFUL FETCH
  // ─────────────────────────────────────────────────────────────────────────────

  describe('successful fetch', () => {
    it('should fetch and return data', async () => {
      const mockData = { id: 1, name: 'Test User' };
      mockedApi.get.mockResolvedValueOnce({
        data: { data: mockData } as ApiResponse<typeof mockData>,
      });

      const { result } = renderHook(() => useFetch<typeof mockData>('/api/test'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();
      expect(mockedApi.get).toHaveBeenCalledWith('/api/test');
    });

    it('should fetch with correct response structure', async () => {
      interface User {
        id: number;
        name: string;
        email: string;
      }

      const mockUser: User = {
        id: 42,
        name: 'John Doe',
        email: 'john@example.com',
      };

      mockedApi.get.mockResolvedValueOnce({
        data: { data: mockUser } as ApiResponse<User>,
      });

      const { result } = renderHook(() => useFetch<User>('/api/users/42'));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.data).toEqual(mockUser);
      expect(result.current.data?.id).toBe(42);
      expect(result.current.data?.name).toBe('John Doe');
      expect(result.current.data?.email).toBe('john@example.com');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH ERROR
  // ─────────────────────────────────────────────────────────────────────────────

  describe('fetch error', () => {
    it('should handle fetch failure with Error object', async () => {
      const errorMessage = 'Network request failed';
      mockedApi.get.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useFetch<unknown>('/api/test'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe(errorMessage);
      expect(result.current.data).toBeNull();
    });

    it('should handle non-Error rejection', async () => {
      mockedApi.get.mockRejectedValueOnce('String error');

      const { result } = renderHook(() => useFetch<unknown>('/api/test'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('An error occurred');
    });

    it('should handle null/undefined rejection', async () => {
      mockedApi.get.mockRejectedValueOnce(null);

      const { result } = renderHook(() => useFetch<unknown>('/api/test'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('An error occurred');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CALLBACKS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('callbacks', () => {
    it('should call onSuccess with data on success', async () => {
      const mockData = { id: 1, value: 'success' };
      const onSuccess = vi.fn();

      mockedApi.get.mockResolvedValueOnce({
        data: { data: mockData } as ApiResponse<typeof mockData>,
      });

      renderHook(() =>
        useFetch<typeof mockData>('/api/test', { onSuccess })
      );

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(mockData);
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it('should call onError with Error on failure', async () => {
      const errorMessage = 'Callback test error';
      const onError = vi.fn();

      mockedApi.get.mockRejectedValueOnce(new Error(errorMessage));

      renderHook(() => useFetch<unknown>('/api/test', { onError }));

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(onError.mock.calls[0][0].message).toBe(errorMessage);
    });

    it('should call both callbacks in correct order', async () => {
      const onSuccess = vi.fn();
      const onError = vi.fn();

      mockedApi.get.mockResolvedValueOnce({
        data: { data: { id: 1 } } as ApiResponse<{ id: number }>,
      });

      renderHook(() =>
        useFetch<{ id: number }>('/api/test', { onSuccess, onError })
      );

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());

      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SET DATA
  // ─────────────────────────────────────────────────────────────────────────────

  describe('setData', () => {
    it('should have setData function available', () => {
      const { result } = renderHook(() =>
        useFetch<unknown>('/api/test', { immediate: false })
      );

      expect(typeof result.current.setData).toBe('function');
    });

    it('should return a dispatch function', () => {
      const { result } = renderHook(() =>
        useFetch<{ id: number }>('/api/test', { immediate: false })
      );

      // setData should be a function that can be called
      expect(result.current.setData).toBeDefined();
      expect(typeof result.current.setData).toBe('function');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // REFETCH
  // ─────────────────────────────────────────────────────────────────────────────

  describe('refetch', () => {
    it('should have refetch function available', () => {
      const { result } = renderHook(() =>
        useFetch<{ id: number }>('/api/test', { immediate: false })
      );

      expect(typeof result.current.refetch).toBe('function');
    });

    it('should call API when refetch is invoked', async () => {
      mockedApi.get.mockResolvedValue({
        data: { data: { id: 1 } } as ApiResponse<{ id: number }>,
      });

      const { result } = renderHook(() =>
        useFetch<{ id: number }>('/api/test', { immediate: false })
      );

      await result.current.refetch();

      expect(mockedApi.get).toHaveBeenCalledWith('/api/test');
      expect(mockedApi.get).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // URL CHANGES
  // ─────────────────────────────────────────────────────────────────────────────

  describe('url changes', () => {
    it('should call API with different URLs', async () => {
      mockedApi.get.mockResolvedValue({
        data: { data: { id: 1 } } as ApiResponse<{ id: number }>,
      });

      const { rerender } = renderHook(
        ({ url }) => useFetch<{ id: number }>(url),
        { initialProps: { url: '/api/endpoint1' } }
      );

      // Wait for initial call
      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledWith('/api/endpoint1');
      });

      // Change URL
      rerender({ url: '/api/endpoint2' });

      // Wait for second call
      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledWith('/api/endpoint2');
      });

      expect(mockedApi.get).toHaveBeenCalledTimes(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TYPED RESPONSES
  // ─────────────────────────────────────────────────────────────────────────────

  describe('typed responses', () => {
    it('should handle array response', async () => {
      type ItemList = string[];
      const mockItems = ['apple', 'banana', 'cherry'];

      mockedApi.get.mockResolvedValueOnce({
        data: { data: mockItems } as ApiResponse<ItemList>,
      });

      const { result } = renderHook(() => useFetch<ItemList>('/api/items'));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.data).toHaveLength(3);
      expect(result.current.data).toContain('banana');
    });

    it('should handle nested object response', async () => {
      interface ApiResult {
        data: {
          user: {
            profile: {
              name: string;
              avatar: string;
            };
          };
          total: number;
        };
      }

      const mockResult: ApiResult = {
        data: {
          user: {
            profile: {
              name: 'Alice',
              avatar: 'https://example.com/alice.png',
            },
          },
          total: 100,
        },
      };

      mockedApi.get.mockResolvedValueOnce({
        data: { data: mockResult } as ApiResponse<ApiResult>,
      });

      const { result } = renderHook(() => useFetch<ApiResult>('/api/complex'));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.data?.data.user.profile.name).toBe('Alice');
      expect(result.current.data?.data.total).toBe(100);
    });
  });
});
