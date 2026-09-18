import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signalrService } from '../../../src/services/signalr.service';
import { storage } from '../../../src/utils/storage';
import { HubConnectionState } from '@microsoft/signalr';

describe('SignalRService', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await signalrService.stop();
  });

  it('does not start connection if no auth token is in storage', async () => {
    vi.spyOn(storage, 'getToken').mockReturnValue(null);
    await signalrService.start();
    expect(signalrService.getState()).toBe(HubConnectionState.Disconnected);
  });

  it('registers and triggers ReceiveNotification listeners and custom events', () => {
    const listener = vi.fn();
    const unsubscribe = signalrService.onReceiveNotification(listener);

    const windowSpy = vi.fn();
    window.addEventListener('ars:receive-notification', windowSpy);

    const testPayload = { id: 101, message: '[Paper] status changed to Accepted' };

    // Simulate internal handleReceiveNotification
    (signalrService as unknown as { handleReceiveNotification: (data: unknown) => void })
      .handleReceiveNotification(testPayload);

    expect(listener).toHaveBeenCalledWith(testPayload);
    expect(windowSpy).toHaveBeenCalled();

    unsubscribe();
    window.removeEventListener('ars:receive-notification', windowSpy);

    // After unsubscribe
    (signalrService as unknown as { handleReceiveNotification: (data: unknown) => void })
      .handleReceiveNotification(testPayload);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('registers and triggers PaperStatusUpdated listeners and custom events', () => {
    const listener = vi.fn();
    const unsubscribe = signalrService.onPaperStatusUpdated(listener);

    const windowSpy = vi.fn();
    window.addEventListener('ars:paper-status-updated', windowSpy);

    const testPayload = { paperId: 42, status: 'PUBLISHED' };

    (signalrService as unknown as { handlePaperStatusUpdated: (data: unknown) => void })
      .handlePaperStatusUpdated(testPayload);

    expect(listener).toHaveBeenCalledWith(testPayload);
    expect(windowSpy).toHaveBeenCalled();

    unsubscribe();
    window.removeEventListener('ars:paper-status-updated', windowSpy);
  });

  it('prevents duplicate start() connections when already connected or connecting', async () => {
    vi.spyOn(storage, 'getToken').mockReturnValue('mock-jwt-token');

    const mockConn = {
      state: HubConnectionState.Connected,
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
      onreconnecting: vi.fn(),
      onreconnected: vi.fn(),
      onclose: vi.fn(),
    };

    signalrService.setConnectionForTesting(mockConn as any);

    await signalrService.start();
    expect(mockConn.start).not.toHaveBeenCalled();
    expect(signalrService.getState()).toBe(HubConnectionState.Connected);
  });

  it('stops connection gracefully', async () => {
    const mockConn = {
      state: HubConnectionState.Connected,
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
      onreconnecting: vi.fn(),
      onreconnected: vi.fn(),
      onclose: vi.fn(),
    };

    signalrService.setConnectionForTesting(mockConn as any);
    await signalrService.stop();

    expect(mockConn.stop).toHaveBeenCalled();
    expect(signalrService.getState()).toBe(HubConnectionState.Disconnected);
  });
});
