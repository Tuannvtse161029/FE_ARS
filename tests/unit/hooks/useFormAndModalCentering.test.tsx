import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalScrollLock, syncModalBodyScrollLock } from '../../../src/hooks/useModalScrollLock';
import { centerElementInView, useFormFieldAutoCenter } from '../../../src/hooks/useFormFieldAutoCenter';

describe('useModalScrollLock', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
    delete document.body.dataset.modalLocked;
    delete document.body.dataset.originalOverflow;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';
  });

  it('locks body scroll when modal is mounted in DOM', () => {
    // Detection requires BOTH role="dialog" AND aria-modal="true"
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);

    syncModalBodyScrollLock();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.dataset.modalLocked).toBe('true');
  });

  it('restores body scroll when modal is removed from DOM', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);

    syncModalBodyScrollLock();
    expect(document.body.style.overflow).toBe('hidden');

    document.body.removeChild(dialog);
    syncModalBodyScrollLock();
    expect(document.body.style.overflow).toBe('');
    expect(document.body.dataset.modalLocked).toBeUndefined();
  });

  it('locks body scroll when active is passed as true to hook', () => {
    const { rerender, unmount } = renderHook(
      ({ active }) => useModalScrollLock(active),
      { initialProps: { active: true } },
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender({ active: false });
    unmount();
  });
});

describe('useFormFieldAutoCenter', () => {
  it('calls scrollIntoView when centerElementInView is called on an element outside comfort zone', () => {
    const input = document.createElement('input');
    const scrollIntoViewMock = vi.fn();
    input.scrollIntoView = scrollIntoViewMock;

    // Mock bounding rect near the bottom (outside 25% - 75% zone)
    input.getBoundingClientRect = () => ({
      top: 900,
      bottom: 940,
      left: 0,
      right: 200,
      width: 200,
      height: 40,
      x: 0,
      y: 900,
      toJSON: () => {},
    });

    // Window height mock
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);

    centerElementInView(input);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  });

  it('does not scroll if the element is already well-centered in comfort zone', () => {
    const input = document.createElement('input');
    const scrollIntoViewMock = vi.fn();
    input.scrollIntoView = scrollIntoViewMock;

    // Mock bounding rect in middle (top 400 in 800px window = 50%)
    input.getBoundingClientRect = () => ({
      top: 400,
      bottom: 440,
      left: 0,
      right: 200,
      width: 200,
      height: 40,
      x: 0,
      y: 400,
      toJSON: () => {},
    });

    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);

    centerElementInView(input);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });
});
