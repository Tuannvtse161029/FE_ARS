import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  LogLevel,
} from '@microsoft/signalr';
import { API_BASE_URL, API_ENDPOINTS } from '../utils/constants';
import { storage } from '../utils/storage';
import { secureToken } from '../utils/secureToken';

export interface NotificationPayload {
  notificationId?: number;
  id?: number;
  userId?: number;
  message?: string;
  isRead?: boolean;
  createdAt?: string;
}

export interface PaperStatusUpdatedPayload {
  paperId: number | string;
  status: string;
  authorshipVerificationStatus?: string;
}

export interface ReviewRequestAssignedPayload {
  reviewRequestId: number;
  paperId: number;
  paperTitle: string;
  deadline?: string;
}

export interface GroupJoinRequestUpdatedPayload {
  groupId: number;
  requestId: number;
  status: string;
  applicantUserId?: number;
  applicantName?: string;
}

export interface ForumCommentAddedPayload {
  forumPostId: number;
  forumCommentId: number;
  userId: number;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface MedalAwardedPayload {
  medalId?: number;
  medalName: string;
  iconUrl?: string;
  medalTier?: string;
  description?: string;
  unlockedAt?: string;
}

export type EventListener<T = unknown> = (data: T) => void;

/**
 * SignalR Service for real-time communication across ARS Frontend.
 *
 * Supported Contract Events (Hub: /hubs/notifications):
 * 1. ReceiveNotification: { notificationId, userId, message, isRead, createdAt }
 * 2. UpdateUnreadCount: number
 * 3. PaperStatusUpdated: { paperId, status, authorshipVerificationStatus }
 * 4. ReviewRequestAssigned: { reviewRequestId, paperId, paperTitle, deadline }
 * 5. GroupJoinRequestUpdated: { groupId, requestId, status, applicantUserId, applicantName }
 * 6. ForumCommentAdded: { forumPostId, forumCommentId, userId, authorName, content, createdAt }
 * 7. MedalAwarded: { medalId, medalName, iconUrl, unlockedAt }
 *
 * Supported Group Management Methods:
 * - joinPaperGroup(paperId) / leavePaperGroup(paperId)
 * - joinPostGroup(postId) / leavePostGroup(postId)
 */
class SignalRService {
  private connection: HubConnection | null = null;
  private startPromise: Promise<void> | null = null;
  private listeners = new Map<string, Set<EventListener<any>>>();
  private activePostGroups = new Set<string>();
  private activePaperGroups = new Set<string>();

  /**
   * Resolve canonical Hub URL based on API_BASE_URL and constants.
   */
  private getHubUrl(): string {
    const base = API_BASE_URL.replace(/\/+$/, '');
    const path = API_ENDPOINTS.HUBS.NOTIFICATIONS.replace(/^\/+/, '');
    return `${base}/${path}`;
  }

  /**
   * Build a fresh HubConnection instance configured with reconnect and transport fallbacks.
   */
  private createConnection(): HubConnection {
    const hubUrl = this.getHubUrl();

    const builder = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: async () => {
          let token = storage.getToken();
          if (!token) {
            try {
              await secureToken.rehydrate();
              token = storage.getToken();
            } catch {
              /* ignore */
            }
          }
          if (!token && typeof window !== 'undefined') {
            try {
              token = localStorage.getItem('ars_token') || sessionStorage.getItem('ars_token');
            } catch {
              /* ignore */
            }
          }
          return token || '';
        },
        transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Information);

    const conn = builder.build();

    // Register all contract events from the Hub with event logging and fallback aliases
    conn.on('ReceiveNotification', (data: unknown) => {
      console.info('[SignalR ⚡] ReceiveNotification:', data);
      this.emit('ReceiveNotification', data, 'ars:receive-notification');
    });

    conn.on('UpdateUnreadCount', (data: unknown) => {
      console.info('[SignalR ⚡] UpdateUnreadCount:', data);
      this.emit('UpdateUnreadCount', data, 'ars:update-unread-count');
    });

    conn.on('PaperStatusUpdated', (data: unknown) => {
      console.info('[SignalR ⚡] PaperStatusUpdated:', data);
      this.emit('PaperStatusUpdated', data, 'ars:paper-status-updated');
    });

    conn.on('PaperStatusChanged', (data: unknown) => {
      console.info('[SignalR ⚡] PaperStatusChanged:', data);
      this.emit('PaperStatusUpdated', data, 'ars:paper-status-updated');
    });

    conn.on('ReviewRequestAssigned', (data: unknown) => {
      console.info('[SignalR ⚡] ReviewRequestAssigned:', data);
      this.emit('ReviewRequestAssigned', data, 'ars:review-request-assigned');
    });

    conn.on('GroupJoinRequestUpdated', (data: unknown) => {
      console.info('[SignalR ⚡] GroupJoinRequestUpdated:', data);
      this.emit('GroupJoinRequestUpdated', data, 'ars:group-join-request-updated');
    });

    conn.on('ForumCommentAdded', (data: unknown) => {
      console.info('[SignalR ⚡] ForumCommentAdded:', data);
      this.emit('ForumCommentAdded', data, 'ars:forum-comment-added');
    });

    conn.on('ReceiveComment', (data: unknown) => {
      console.info('[SignalR ⚡] ReceiveComment:', data);
      this.emit('ForumCommentAdded', data, 'ars:forum-comment-added');
    });

    conn.on('MedalAwarded', (data: unknown) => {
      console.info('[SignalR ⚡] MedalAwarded:', data);
      this.emit('MedalAwarded', data, 'ars:medal-awarded');
    });

    conn.onreconnecting((error) => {
      console.warn('[SignalR] Connection lost, reconnecting...', error);
    });

    conn.onreconnected((connectionId) => {
      console.info('[SignalR] Reconnected successfully. ConnectionId:', connectionId);
      void this.rejoinAllActiveGroups();
    });

    conn.onclose((error) => {
      if (error) {
        console.warn('[SignalR] Connection closed with error:', error);
      }
      this.startPromise = null;
    });

    return conn;
  }

  /**
   * Internal dispatcher for incoming events.
   * Invokes all registered JS listeners and dispatches DOM CustomEvent.
   */
  public emit(eventName: string, data: unknown, domEventName?: string): void {
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (err) {
          console.error(`[SignalR] Error in listener for "${eventName}":`, err);
        }
      });
    }

    if (typeof window !== 'undefined') {
      const customEventName = domEventName || `ars:${eventName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}`;
      window.dispatchEvent(
        new CustomEvent(customEventName, { detail: data }),
      );
    }
  }

  /**
   * For backwards compatibility and testing: simulate receiving a notification.
   */
  public handleReceiveNotification(data: unknown): void {
    this.emit('ReceiveNotification', data, 'ars:notification-received');
  }

  /**
   * For backwards compatibility and testing: simulate receiving a paper status update.
   */
  public handlePaperStatusUpdated(data: unknown): void {
    this.emit('PaperStatusUpdated', data, 'ars:paper-status-updated');
  }

  /**
   * Start the SignalR connection if authenticated and not already connected.
   * Prevents duplicate connections during React re-renders or concurrent callers.
   */
  public async start(): Promise<void> {
    let token = storage.getToken();
    if (!token) {
      try {
        await secureToken.rehydrate();
        token = storage.getToken();
      } catch {
        /* ignore */
      }
    }
    if (!token && typeof window !== 'undefined') {
      try {
        token = localStorage.getItem('ars_token') || sessionStorage.getItem('ars_token');
      } catch {
        /* ignore */
      }
    }
    if (!token) {
      console.info('[SignalR] Skipping connection start: user is not authenticated (no token).');
      return;
    }

    if (
      this.connection &&
      (this.connection.state === HubConnectionState.Connected ||
        this.connection.state === HubConnectionState.Connecting ||
        this.connection.state === HubConnectionState.Reconnecting)
    ) {
      return this.startPromise ?? Promise.resolve();
    }

    if (!this.connection) {
      this.connection = this.createConnection();
    }

    this.startPromise = this.connection
      .start()
      .then(() => {
        console.info(`[SignalR] Connected to notifications hub: ${this.getHubUrl()}`);
        void this.rejoinAllActiveGroups();
      })
      .catch((err) => {
        console.warn('[SignalR] Connection start failed:', err);
        this.connection = null;
        throw err;
      })
      .finally(() => {
        this.startPromise = null;
      });

    return this.startPromise;
  }

  /**
   * Gracefully stop the connection if active.
   */
  public async stop(): Promise<void> {
    if (!this.connection) {
      return;
    }

    const activeConn = this.connection;
    this.connection = null;
    this.startPromise = null;

    if (
      activeConn.state === HubConnectionState.Connected ||
      activeConn.state === HubConnectionState.Connecting ||
      activeConn.state === HubConnectionState.Reconnecting
    ) {
      try {
        await activeConn.stop();
        if (import.meta.env.DEV) {
          console.info('[SignalR] Disconnected successfully.');
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[SignalR] Error during connection stop:', err);
        }
      }
    }
  }

  /**
   * Check current Hub connection state.
   */
  public getState(): HubConnectionState {
    return this.connection ? this.connection.state : HubConnectionState.Disconnected;
  }

  /**
   * For testing purposes: inject custom HubConnection instance.
   */
  public setConnectionForTesting(conn: HubConnection | null): void {
    this.connection = conn;
  }

  /**
   * Generic subscription to any event name.
   * Returns an unsubscribe callback.
   */
  public on<T = unknown>(eventName: string, listener: EventListener<T>): () => void {
    let set = this.listeners.get(eventName);
    if (!set) {
      set = new Set();
      this.listeners.set(eventName, set);
    }
    set.add(listener as EventListener<any>);

    return () => {
      this.off(eventName, listener as EventListener<any>);
    };
  }

  /**
   * Remove listener for an event name.
   */
  public off(eventName: string, listener?: EventListener<any>): void {
    if (!listener) {
      this.listeners.delete(eventName);
      return;
    }
    const set = this.listeners.get(eventName);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(eventName);
      }
    }
  }

  /**
   * Helper subscription for ReceiveNotification.
   */
  public onReceiveNotification(listener: EventListener<NotificationPayload | unknown>): () => void {
    return this.on('ReceiveNotification', listener);
  }

  /**
   * Helper subscription for PaperStatusUpdated.
   */
  public onPaperStatusUpdated(listener: EventListener<PaperStatusUpdatedPayload | unknown>): () => void {
    return this.on('PaperStatusUpdated', listener);
  }

  /**
   * Helper subscription for MedalAwarded.
   */
  public onMedalAwarded(listener: EventListener<MedalAwardedPayload>): () => void {
    return this.on('MedalAwarded', listener);
  }

  /**
   * Helper to re-join all tracked groups upon initial connect or reconnect.
   */
  private async rejoinAllActiveGroups(): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      return;
    }
    for (const postId of this.activePostGroups) {
      await this.invokeJoinPostGroup(postId);
    }
    for (const paperId of this.activePaperGroups) {
      await this.invokeJoinPaperGroup(paperId);
    }
  }

  private async invokeJoinPostGroup(postId: string): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) return;
    try {
      await this.connection.invoke('JoinPostGroup', postId);
      console.info(`[SignalR 🚀] Joined post group: ${postId}`);
    } catch {
      try {
        await this.connection.invoke('JoinPostGroup', Number(postId));
        console.info(`[SignalR 🚀] Joined post group (numeric): ${postId}`);
      } catch {
        try {
          await this.connection.invoke('JoinGroup', `post_${postId}`);
        } catch (err) {
          console.warn(`[SignalR] Could not invoke JoinPostGroup for ${postId}:`, err);
        }
      }
    }
  }

  private async invokeJoinPaperGroup(paperId: string): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) return;
    try {
      await this.connection.invoke('JoinPaperGroup', paperId);
      console.info(`[SignalR 🚀] Joined paper group: ${paperId}`);
    } catch {
      try {
        await this.connection.invoke('JoinPaperGroup', Number(paperId));
        console.info(`[SignalR 🚀] Joined paper group (numeric): ${paperId}`);
      } catch {
        try {
          await this.connection.invoke('JoinGroup', `paper_${paperId}`);
        } catch (err) {
          console.warn(`[SignalR] Could not invoke JoinPaperGroup for ${paperId}:`, err);
        }
      }
    }
  }

  /**
   * Join a paper-scoped group on the Hub.
   */
  public async joinPaperGroup(paperId: number | string): Promise<void> {
    const idStr = String(paperId);
    this.activePaperGroups.add(idStr);
    await this.invokeJoinPaperGroup(idStr);
  }

  /**
   * Leave a paper-scoped group on the Hub.
   */
  public async leavePaperGroup(paperId: number | string): Promise<void> {
    const idStr = String(paperId);
    this.activePaperGroups.delete(idStr);
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      return;
    }
    try {
      await this.connection.invoke('LeavePaperGroup', idStr);
    } catch {
      try {
        await this.connection.invoke('LeavePaperGroup', Number(idStr));
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Join a forum-post-scoped group on the Hub.
   */
  public async joinPostGroup(postId: number | string): Promise<void> {
    const idStr = String(postId);
    this.activePostGroups.add(idStr);
    await this.invokeJoinPostGroup(idStr);
  }

  /**
   * Leave a forum-post-scoped group on the Hub.
   */
  public async leavePostGroup(postId: number | string): Promise<void> {
    const idStr = String(postId);
    this.activePostGroups.delete(idStr);
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      return;
    }
    try {
      await this.connection.invoke('LeavePostGroup', idStr);
    } catch {
      try {
        await this.connection.invoke('LeavePostGroup', Number(idStr));
      } catch {
        /* ignore */
      }
    }
  }
}

export const signalrService = new SignalRService();
export default signalrService;
