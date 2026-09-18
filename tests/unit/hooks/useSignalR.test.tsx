import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useSignalR } from '../../../src/hooks/useSignalR';
import { signalrService } from '../../../src/services/signalr.service';
import { storage } from '../../../src/utils/storage';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    user: { id: 10, role: 'Researcher' },
  })),
}));

vi.mock('../../../src/i18n/I18nContext', () => ({
  useI18n: vi.fn(() => ({
    t: (key: string, fallback?: string) => fallback || key,
    locale: 'en',
  })),
}));

describe('useSignalR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts SignalR connection when user is authenticated with token', () => {
    vi.spyOn(storage, 'getToken').mockReturnValue('mock-token-xyz');
    const startSpy = vi.spyOn(signalrService, 'start').mockResolvedValue(undefined);

    renderHook(() => useSignalR());

    expect(startSpy).toHaveBeenCalled();
  });

  it('handles incoming ReceiveNotification by invoking toast.info and custom callback', () => {
    vi.spyOn(storage, 'getToken').mockReturnValue('mock-token-xyz');
    vi.spyOn(signalrService, 'start').mockResolvedValue(undefined);

    const onNotif = vi.fn();
    renderHook(() => useSignalR({ onNotification: onNotif }));

    const notifPayload = {
      id: 999,
      message: '[Paper] status changed to Published',
    };

    act(() => {
      (signalrService as unknown as { handleReceiveNotification: (data: unknown) => void })
        .handleReceiveNotification(notifPayload);
    });

    expect(onNotif).toHaveBeenCalledWith(notifPayload);
    expect(toast.info).toHaveBeenCalledWith(
      'Paper status updated',
      expect.objectContaining({
        description: '[Paper] status changed to Published',
      }),
    );
  });

  it('handles incoming PaperStatusUpdated by invoking custom callback', () => {
    vi.spyOn(storage, 'getToken').mockReturnValue('mock-token-xyz');
    vi.spyOn(signalrService, 'start').mockResolvedValue(undefined);

    const onPaperUpdated = vi.fn();
    renderHook(() => useSignalR({ onPaperStatusUpdated: onPaperUpdated }));

    const paperPayload = {
      paperId: 123,
      status: 'UNDER_REVIEW',
    };

    act(() => {
      (signalrService as unknown as { handlePaperStatusUpdated: (data: unknown) => void })
        .handlePaperStatusUpdated(paperPayload);
    });

    expect(onPaperUpdated).toHaveBeenCalledWith(paperPayload);
  });
});
