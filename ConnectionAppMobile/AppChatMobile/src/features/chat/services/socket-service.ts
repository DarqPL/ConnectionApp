import { authService } from "../../auth/services/auth.service";

export type SocketEventType =
  | "USER_ONLINE"
  | "USER_OFFLINE"
  | "NEW_MESSAGE"
  | "MESSAGE_DELETED"
  | "MESSAGE_RECALLED"
  | "USER_TYPING"
  | "USER_STOPPED_TYPING"
  | "CONVERSATION_CREATED"
  | "CONVERSATION_UPDATED"
  | "FRIEND_REQUEST_RECEIVED"
  | "FRIEND_REQUEST_ACCEPTED"
  | "USER_STATUS_CHANGED"
  | "ERROR";

export interface SocketMessage {
  type: SocketEventType;
  data?: any;
  timestamp: string;
}

export type SocketEventListener = (data: any) => void;

export class SocketService {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private listeners: Map<SocketEventType, SocketEventListener[]> = new Map();
  private userId: number | null = null;

  /**
   * Connect to WebSocket server
   */
  connect(userId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.userId = userId;
        const wsUrl = authService.getWebSocketUrl();

        console.log("[SocketService] Connecting to:", wsUrl);

        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          console.log("[SocketService] Connected!");
          this.reconnectAttempts = 0;
          this.clearReconnectTimer();

          // Notify server about user coming online
          this.send({
            type: "USER_ONLINE",
            userId,
            timestamp: new Date().toISOString(),
          });

          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const message: SocketMessage = JSON.parse(event.data);
            console.log("[SocketService] Received:", message.type, message);

            this.emit(message.type, message.data);
          } catch (err) {
            console.error("[SocketService] Failed to parse message:", err);
          }
        };

        this.socket.onerror = (error) => {
          console.error("[SocketService] WebSocket error:", error);
          this.emit("ERROR", { message: "Connection error" });
          reject(error);
        };

        this.socket.onclose = () => {
          console.log("[SocketService] Disconnected!");
          this.handleDisconnect();
        };
      } catch (err) {
        console.error("[SocketService] Connection failed:", err);
        reject(err);
      }
    });
  }

  /**
   * Handle disconnection and auto-reconnect
   */
  private handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.userId) {
      this.reconnectAttempts++;
      console.log(
        `[SocketService] Auto-reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
      );

      this.reconnectTimer = setTimeout(() => {
        this.connect(this.userId!).catch((err) => {
          console.error("[SocketService] Reconnect failed:", err);
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.log("[SocketService] Max reconnect attempts reached");
      this.emit("ERROR", {
        message: "Connection lost. Please refresh the app.",
      });
    }
  }

  /**
   * Send message to server
   */
  send(data: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      try {
        const message: SocketMessage = {
          type: data.type,
          data: data.data,
          timestamp: new Date().toISOString(),
        };

        console.log("[SocketService] Sending:", message.type);
        this.socket.send(JSON.stringify(message));
      } catch (err) {
        console.error("[SocketService] Failed to send:", err);
      }
    } else {
      console.warn("[SocketService] Socket not connected");
    }
  }

  /**
   * Subscribe to socket events
   */
  on(event: SocketEventType, listener: SocketEventListener): () => void {
    const listeners = this.listeners.get(event) || [];
    listeners.push(listener);
    this.listeners.set(event, listeners);

    // Return unsubscribe function
    return () => {
      const filtered = listeners.filter((l) => l !== listener);
      this.listeners.set(event, filtered);
    };
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: SocketEventType, data: any): void {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.error(`[SocketService] Listener error for ${event}:`, err);
      }
    });
  }

  /**
   * Notify typing
   */
  notifyTyping(conversationId: number): void {
    this.send({
      type: "USER_TYPING",
      data: { conversationId, userId: this.userId },
    });
  }

  /**
   * Notify stopped typing
   */
  notifyStoppedTyping(conversationId: number): void {
    this.send({
      type: "USER_STOPPED_TYPING",
      data: { conversationId, userId: this.userId },
    });
  }

  /**
   * Mark conversation as read
   */
  markAsRead(conversationId: number): void {
    this.send({
      type: "CONVERSATION_UPDATED",
      data: { conversationId, action: "mark_read" },
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    console.log("[SocketService] Disconnecting...");
    this.clearReconnectTimer();

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.listeners.clear();
    this.userId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const socketService = new SocketService();
