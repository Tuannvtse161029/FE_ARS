import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../../hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('should debounce string value', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    // Update value
    rerender({ value: 'updated', delay: 500 });
    
    // Should still be old value before delay
    expect(result.current).toBe('initial');

    // Advance time past delay
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should now be new value
    expect(result.current).toBe('updated');
  });

  it('should debounce number value', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 300 } }
    );

    expect(result.current).toBe(0);

    rerender({ value: 42, delay: 300 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe(42);
  });

  it('should debounce object value', () => {
    const initialObj = { name: 'initial' };
    const updatedObj = { name: 'updated' };

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: initialObj, delay: 500 } }
    );

    expect(result.current).toEqual({ name: 'initial' });

    rerender({ value: updatedObj, delay: 500 });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toEqual({ name: 'updated' });
  });

  it('should use default delay of 500ms', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated' });

    // Default delay is 500ms, so advance by 400ms should not update
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current).toBe('initial');

    // Advance remaining 100ms
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe('updated');
  });

  it('should cancel previous timer when value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'first', delay: 500 } }
    );

    expect(result.current).toBe('first');

    // Change value
    rerender({ value: 'second', delay: 500 });

    // Advance only 200ms (partial delay)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Should still be first because timer was cancelled
    expect(result.current).toBe('first');

    // Change value again before first timer completes
    rerender({ value: 'third', delay: 500 });

    // Advance full 500ms
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should be third, not second
    expect(result.current).toBe('third');
  });

  it('should handle rapid value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 100 } }
    );

    rerender({ value: 'b', delay: 100 });
    rerender({ value: 'c', delay: 100 });
    rerender({ value: 'd', delay: 100 });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Should only have the last value
    expect(result.current).toBe('d');
  });

  it('should cleanup timer on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { unmount } = renderHook(() => useDebounce('value', 500));

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
