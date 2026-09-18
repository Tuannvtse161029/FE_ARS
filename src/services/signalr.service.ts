import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  LogLevel,
} from '@microsoft/signalr';
import { API_BASE_URL, API_ENDPOINTS } from '../utils/constants';
import { storage } from '../utils/storage';

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
        accessTokenFactory: () => {
          const token = storage.getToken();
          return token || '';
        },
        transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(
        import.meta.env.DEV ? LogLevel.Information : LogLevel.Warning,
      );

    const conn = builder.build();

    // Register all contract events from the Hub
    conn.on('ReceiveNotification', (data: unknown) => {
      this.emit('ReceiveNotification', data, 'ars:receive-notification');
    });

    conn.on('UpdateUnreadCount', (data: unknown) => {
      this.emit('UpdateUnreadCount', data, 'ars:update-unread-count');
    });

    conn.on('PaperStatusUpdated', (data: unknown) => {
      this.emit('PaperStatusUpdated', data, 'ars:paper-status-updated');
    });

    conn.on('ReviewRequestAssigned', (data: unknown) => {
      this.emit('ReviewRequestAssigned', data, 'ars:review-request-assigned');
    });

    conn.on('GroupJoinRequestUpdated', (data: unknown) => {
      this.emit('GroupJoinRequestUpdated', data, 'ars:group-join-request-updated');
    });

    conn.on('ForumCommentAdded', (data: unknown) => {
      this.emit('ForumCommentAdded', data, 'ars:forum-comment-added');
    });

    conn.on('MedalAwarded', (data: unknown) => {
      this.emit('MedalAwarded', data, 'ars:medal-awarded');
    });

    conn.onreconnecting((error) => {
      if (import.meta.env.DEV) {
        console.warn('[SignalR] Connection lost, reconnecting...', error);
      }
    });

    conn.onreconnected((connectionId) => {
      if (import.meta.env.DEV) {
        console.info('[SignalR] Reconnected successfully. ConnectionId:', connectionId);
      }
    });

    conn.onclose((error) => {
      if (import.meta.env.DEV && error) {
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
    const token = storage.getToken();
    if (!token) {
      // User not authenticated, do not establish connection
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
        if (import.meta.env.DEV) {
          console.info('[SignalR] Connected to notifications hub.');
        }
      })
      .catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('[SignalR] Connection start failed:', err);
        }
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
   * Join a paper-scoped group on the Hub.
   */
  public async joinPaperGroup(paperId: number | string): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      return;
    }
    try {
      await this.connection.invoke('JoinPaperGroup', String(paperId));
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn(`[SignalR] Failed to join paper group "${paperId}":`, err);
      }
    }
  }

  /**
   * Leave a paper-scoped group on the Hub.
   */
  public async leavePaperGroup(paperId: number | string): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      return;
    }
    try {
      await this.connection.invoke('LeavePaperGroup', String(paperId));
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn(`[SignalR] Failed to leave paper group "${paperId}":`, err);
      }
    }
  }

  /**
   * Join a forum-post-scoped group on the Hub.
   */
  public async joinPostGroup(postId: number | string): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      return;
    }
    try {
      await this.connection.invoke('JoinPostGroup', String(postId));
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn(`[SignalR] Failed to join post group "${postId}":`, err);
      }
    }
  }

  /**
   * Leave a forum-post-scoped group on the Hub.
   */
  public async leavePostGroup(postId: number | string): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      return;
    }
    try {
      await this.connection.invoke('LeavePostGroup', String(postId));
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn(`[SignalR] Failed to leave post group "${postId}":`, err);
      }
    }
  }
}

export const signalrService = new SignalRService();
export default signalrService;
