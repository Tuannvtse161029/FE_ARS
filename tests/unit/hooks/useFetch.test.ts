import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFetch } from '../../../src/hooks/useFetch';
import api from '../../../src/services/axios';

// Mock the axios instance
vi.mock('../../../src/services/axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('useFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts loading with immediate=true (default)', () => {
      mockedApi.get.mockResolvedValueOnce({ data: { id: 1 } });

      const { result } = renderHook(() => useFetch<{ id: number }>('/api/test'));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('does not load when immediate=false', () => {
      const { result } = renderHook(() =>
        useFetch<unknown>('/api/test', { immediate: false })
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(mockedApi.get).not.toHaveBeenCalled();
    });
  });

  describe('successful fetch', () => {
    it('returns data on success (response.data is the payload, no envelope)', async () => {
      const mockData = { id: 1, name: 'Test User' };
      mockedApi.get.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useFetch<typeof mockData>('/api/test'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();
      expect(mockedApi.get).toHaveBeenCalledWith('/api/test', expect.any(Object));
    });

    it('preserves typed fields on the returned object', async () => {
      interface User {
        id: number;
        name: string;
        email: string;
      }

      const mockUser: User = { id: 42, name: 'John Doe', email: 'john@example.com' };
      mockedApi.get.mockResolvedValueOnce({ data: mockUser });

      const { result } = renderHook(() => useFetch<User>('/api/users/42'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockUser);
      expect(result.current.data?.id).toBe(42);
    });
  });

  describe('fetch error', () => {
    it('returns Error on failure', async () => {
      const errorMessage = 'Network request failed';
      mockedApi.get.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useFetch<unknown>('/api/test'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe(errorMessage);
      expect(result.current.data).toBeNull();
    });

    it('coerces non-Error rejections to Error', async () => {
      mockedApi.get.mockRejectedValueOnce('String error');

      const { result } = renderHook(() => useFetch<unknown>('/api/test'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('An error occurred');
    });

    it('coerces null rejections to Error', async () => {
      mockedApi.get.mockRejectedValueOnce(null);

      const { result } = renderHook(() => useFetch<unknown>('/api/test'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe('callbacks', () => {
    it('calls onSuccess with the payload', async () => {
      const mockData = { id: 1, value: 'success' };
      const onSuccess = vi.fn();

      mockedApi.get.mockResolvedValueOnce({ data: mockData });

      renderHook(() =>
        useFetch<typeof mockData>('/api/test', { onSuccess })
      );

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(mockData);
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it('calls onError with an Error instance', async () => {
      const errorMessage = 'Callback test error';
      const onError = vi.fn();

      mockedApi.get.mockRejectedValueOnce(new Error(errorMessage));

      renderHook(() => useFetch<unknown>('/api/test', { onError }));

      await waitFor(() => expect(onError).toHaveBeenCalled());

      const arg = onError.mock.calls[0][0];
      expect(arg).toBeInstanceOf(Error);
      expect(arg.message).toBe(errorMessage);
    });

    it('runs only the matching callback', async () => {
      const onSuccess = vi.fn();
      const onError = vi.fn();

      mockedApi.get.mockResolvedValueOnce({ data: { id: 1 } });

      renderHook(() =>
        useFetch<{ id: number }>('/api/test', { onSuccess, onError })
      );

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());

      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('setData', () => {
    it('exposes setData as a function', () => {
      const { result } = renderHook(() =>
        useFetch<unknown>('/api/test', { immediate: false })
      );

      expect(typeof result.current.setData).toBe('function');
    });
  });

  describe('refetch', () => {
    it('exposes refetch as a function', () => {
      const { result } = renderHook(() =>
        useFetch<{ id: number }>('/api/test', { immediate: false })
      );

      expect(typeof result.current.refetch).toBe('function');
    });

    it('calls the API with the configured URL when refetch is invoked', async () => {
      mockedApi.get.mockResolvedValue({ data: { id: 1 } });

      const { result } = renderHook(() =>
        useFetch<{ id: number }>('/api/test', { immediate: false })
      );

      await result.current.refetch();

      expect(mockedApi.get).toHaveBeenCalledTimes(1);
      expect(mockedApi.get).toHaveBeenCalledWith('/api/test', expect.any(Object));
    });
  });

  describe('URL changes', () => {
    it('re-fetches when the URL changes', async () => {
      mockedApi.get.mockResolvedValue({ data: { id: 1 } });

      const { rerender } = renderHook(
        ({ url }) => useFetch<{ id: number }>(url),
        { initialProps: { url: '/api/endpoint1' } }
      );

      await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/api/endpoint1', expect.any(Object)));

      rerender({ url: '/api/endpoint2' });

      await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/api/endpoint2', expect.any(Object)));

      expect(mockedApi.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('typed responses', () => {
    it('returns an array payload directly', async () => {
      type ItemList = string[];
      const mockItems = ['apple', 'banana', 'cherry'];

      mockedApi.get.mockResolvedValueOnce({ data: mockItems });

      const { result } = renderHook(() => useFetch<ItemList>('/api/items'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(3);
      expect(result.current.data).toContain('banana');
    });

    it('returns a nested object payload directly', async () => {
      const mockResult = {
        data: {
          user: { profile: { name: 'Alice', avatar: 'https://example.com/alice.png' } },
          total: 100,
        },
      };

      mockedApi.get.mockResolvedValueOnce({ data: mockResult });

      const { result } = renderHook(() => useFetch<typeof mockResult>('/api/complex'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.data.user.profile.name).toBe('Alice');
      expect(result.current.data?.data.total).toBe(100);
    });
  });
});
