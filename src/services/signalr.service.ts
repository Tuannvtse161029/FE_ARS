import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  LogLevel,
} from '@microsoft/signalr';
import { API_BASE_URL, API_ENDPOINTS } from '../utils/constants';
import { storage } from '../utils/storage';

export type NotificationListener = (data: unknown) => void;
export type PaperStatusListener = (data: unknown) => void;

/**
 * SignalR Service for real-time communication across ARS Frontend.
 *
 * Requirements:
 * 1. Endpoint: `${API_BASE_URL}/hubs/notifications`
 * 2. Token factory: retrieves current JWT from `storage.getToken()`
 * 3. Automatic reconnect: [0, 2000, 5000, 10000, 30000]
 * 4. Fallback transports: WebSockets | LongPolling
 * 5. Lifecycle:
 *    - Only connects when user is authenticated (valid token exists)
 *    - Guards against duplicate connections and concurrent start invocations
 *    - Disconnects cleanly on logout / unmount
 * 6. Events:
 *    - `ReceiveNotification`
 *    - `PaperStatusUpdated`
 */
class SignalRService {
  private connection: HubConnection | null = null;
  private startPromise: Promise<void> | null = null;
  private notificationListeners = new Set<NotificationListener>();
  private paperStatusListeners = new Set<PaperStatusListener>();

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

    // Register incoming event handlers
    conn.on('ReceiveNotification', (data: unknown) => {
      this.handleReceiveNotification(data);
    });

    conn.on('PaperStatusUpdated', (data: unknown) => {
      this.handlePaperStatusUpdated(data);
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
   * Internal dispatcher for ReceiveNotification.
   * Invokes all registered JS listeners and dispatches DOM CustomEvent.
   */
  private handleReceiveNotification(data: unknown): void {
    // Notify registered subscribers
    this.notificationListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.error('[SignalR] Error in notification listener:', err);
      }
    });

    // Dispatch DOM CustomEvent for decoupled components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ars:receive-notification', { detail: data }),
      );
    }
  }

  /**
   * Internal dispatcher for PaperStatusUpdated.
   * Invokes all registered JS listeners and dispatches DOM CustomEvent.
   */
  private handlePaperStatusUpdated(data: unknown): void {
    // Notify registered subscribers
    this.paperStatusListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.error('[SignalR] Error in paper status listener:', err);
      }
    });

    // Dispatch DOM CustomEvent for decoupled components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ars:paper-status-updated', { detail: data }),
      );
    }
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
      // Already connected or currently establishing connection
      return this.startPromise ?? Promise.resolve();
    }

    if (!this.connection) {
      this.connection = this.createConnection();
    }

    // Guard against concurrent start invocations
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
        // Reset connection reference so future attempts can re-try cleanly
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
   * Subscribe to ReceiveNotification events.
   * Returns an unsubscribe callback.
   */
  public onReceiveNotification(listener: NotificationListener): () => void {
    this.notificationListeners.add(listener);
    return () => {
      this.notificationListeners.delete(listener);
    };
  }

  /**
   * Subscribe to PaperStatusUpdated events.
   * Returns an unsubscribe callback.
   */
  public onPaperStatusUpdated(listener: PaperStatusListener): () => void {
    this.paperStatusListeners.add(listener);
    return () => {
      this.paperStatusListeners.delete(listener);
    };
  }
}

export const signalrService = new SignalRService();
export default signalrService;
