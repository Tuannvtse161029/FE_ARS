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

  it('registers and triggers generic .on<T>() listeners and custom events', () => {
    const listener = vi.fn();
    const unsubscribe = signalrService.on('ReceiveNotification', listener);

    const windowSpy = vi.fn();
    window.addEventListener('ars:receive-notification', windowSpy);

    const testPayload = { id: 101, message: '[Paper] status changed to Accepted' };

    signalrService.emit('ReceiveNotification', testPayload, 'ars:receive-notification');

    expect(listener).toHaveBeenCalledWith(testPayload);
    expect(windowSpy).toHaveBeenCalled();

    unsubscribe();
    window.removeEventListener('ars:receive-notification', windowSpy);

    signalrService.emit('ReceiveNotification', testPayload, 'ars:receive-notification');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('registers and triggers contract events: UpdateUnreadCount, ReviewRequestAssigned, ForumCommentAdded, MedalAwarded', () => {
    const countListener = vi.fn();
    const reviewListener = vi.fn();
    const commentListener = vi.fn();
    const medalListener = vi.fn();

    signalrService.on('UpdateUnreadCount', countListener);
    signalrService.on('ReviewRequestAssigned', reviewListener);
    signalrService.on('ForumCommentAdded', commentListener);
    signalrService.on('MedalAwarded', medalListener);

    signalrService.emit('UpdateUnreadCount', 5);
    signalrService.emit('ReviewRequestAssigned', { reviewRequestId: 12, paperId: 99, paperTitle: 'AI Paper' });
    signalrService.emit('ForumCommentAdded', { forumPostId: 1, forumCommentId: 10, content: 'Great post!' });
    signalrService.emit('MedalAwarded', { medalId: 4, medalName: 'Top Reviewer' });

    expect(countListener).toHaveBeenCalledWith(5);
    expect(reviewListener).toHaveBeenCalledWith(expect.objectContaining({ paperTitle: 'AI Paper' }));
    expect(commentListener).toHaveBeenCalledWith(expect.objectContaining({ content: 'Great post!' }));
    expect(medalListener).toHaveBeenCalledWith(expect.objectContaining({ medalName: 'Top Reviewer' }));
  });

  it('invokes group join and leave methods on Hub', async () => {
    const mockConn = {
      state: HubConnectionState.Connected,
      invoke: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
      onreconnecting: vi.fn(),
      onreconnected: vi.fn(),
      onclose: vi.fn(),
    };

    signalrService.setConnectionForTesting(mockConn as any);

    await signalrService.joinPaperGroup(123);
    expect(mockConn.invoke).toHaveBeenCalledWith('JoinPaperGroup', '123');

    await signalrService.leavePaperGroup(123);
    expect(mockConn.invoke).toHaveBeenCalledWith('LeavePaperGroup', '123');

    await signalrService.joinPostGroup(456);
    expect(mockConn.invoke).toHaveBeenCalledWith('JoinPostGroup', '456');

    await signalrService.leavePostGroup(456);
    expect(mockConn.invoke).toHaveBeenCalledWith('LeavePostGroup', '456');
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
