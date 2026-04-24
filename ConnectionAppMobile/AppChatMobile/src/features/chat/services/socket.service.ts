import { Client } from "@stomp/stompjs";
import type { Conversation, Message } from "../types";

export interface ChatSocketHandlers {
  onIncomingMessage: (message: Message) => void;
  onIncomingConversation: (conversation: Conversation) => void;
  onRecallMessage: (message: Message) => void;
  onCallInvite?: (payload: any) => void;
  onCallStatusUpdate?: (payload: any) => void;
  onUserTyping?: (data: TypingPayload) => void;
  onUserStoppedTyping?: (data: TypingPayload) => void;
  onSecurityNotification?: (payload: {
    type?: string;
    title?: string;
    message: string;
    targetPlatform?: string;
    reason?: string;
    deviceName?: string;
    ipAddress?: string;
    remainingMinutes?: number;
    lockUntil?: string;
  }) => void;
  onConversationUpdate?: (payload: any) => void;
  onReminderDeleted?: (messageId: string) => void;
  onReminderTriggered?: (payload: any) => void;
  onConnectionError?: (error: string) => void;
}

export interface TypingPayload {
  conversationId: number;
  userId: number;
  displayName?: string;
  typedAt?: string;
}

/**
 * Singleton WebSocket service for STOMP chat.
 *
 * Key design:
 * - Handlers are stored in a mutable ref so the socket only connects ONCE
 * per session without needing to reconnect when React callbacks change.
 * - Only disconnects/reconnects when user logs out or token changes.
 */
class ChatSocketService {
  private client: Client | null = null;
  private handlersRef: ChatSocketHandlers | null = null;
  private isDisconnecting = false;

  /** Update handlers without reconnecting. Used from React context. */
  updateHandlers(handlers: ChatSocketHandlers) {
    this.handlersRef = handlers;
  }

  connect(
    wsUrl: string,
    userId: number,
    accessToken: string,
    handlers: ChatSocketHandlers,
  ): void {
    if (this.client?.active) {
      // Just update handlers, don't reconnect
      this.handlersRef = handlers;
      console.log("[Socket] Already connected, handlers updated.");
      return;
    }

    this.handlersRef = handlers;
    this.isDisconnecting = false;

    console.log("[Socket] Connecting to:", wsUrl);

    const client = new Client({
      webSocketFactory: () => {
        const ws = new WebSocket(wsUrl);
        console.log("[Socket] WebSocket created, readyState:", ws.readyState);
        return ws;
      },
      // React Native websocket may strip NULL terminator in some environments.
      appendMissingNULLonIncoming: true,
      forceBinaryWSFrames: true,
      connectHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: (line: string) => {
        if (
          line.includes("ERROR") ||
          line.includes("CONNECTED") ||
          line.includes("RECEIPT")
        ) {
          console.log("[Socket][STOMP]", line);
        }
      },

      onConnect: (frame) => {
        this.isDisconnecting = false;
        console.log(
          "[Socket] ✅ Connected! Session:",
          frame.headers?.["session"],
        );

        // All handlers are called via ref to avoid stale closures
        client.subscribe(`/topic/user.${userId}`, (stompFrame) => {
          try {
            const payload = JSON.parse(stompFrame.body) as Message;
            this.handlersRef?.onIncomingMessage(payload);
          } catch (e) {
            console.error("[Socket] Failed to parse message:", e);
          }
        });

        client.subscribe(
          `/topic/user.${userId}/conversations`,
          (stompFrame) => {
            try {
              const payload = JSON.parse(stompFrame.body) as Conversation;
              this.handlersRef?.onIncomingConversation(payload);
            } catch (e) {
              console.error("[Socket] Failed to parse conversation:", e);
            }
          },
        );

        client.subscribe(`/topic/user.${userId}/recall`, (stompFrame) => {
          try {
            const payload = JSON.parse(stompFrame.body) as Message;
            this.handlersRef?.onRecallMessage(payload);
          } catch (e) {
            console.error("[Socket] Failed to parse recall:", e);
          }
        });

        client.subscribe(`/topic/user.${userId}/poll`, (stompFrame) => {
          try {
            const payload = JSON.parse(stompFrame.body) as Message;
            this.handlersRef?.onIncomingMessage(payload);
          } catch (e) {
            console.error("[Socket] Failed to parse poll update:", e);
          }
        });

        client.subscribe(`/topic/user.${userId}/call-invite`, (stompFrame) => {
          try {
            const payload = JSON.parse(stompFrame.body);
            this.handlersRef?.onCallInvite?.(payload);
          } catch (e) {
            console.error("[Socket] Failed to parse call invite:", e);
          }
        });

        client.subscribe(`/topic/user.${userId}/call-status`, (stompFrame) => {
          try {
            const payload = JSON.parse(stompFrame.body);
            this.handlersRef?.onCallStatusUpdate?.(payload);
          } catch (e) {
            console.error("[Socket] Failed to parse call status:", e);
          }
        });

        client.subscribe(`/topic/user.${userId}/reactions`, (stompFrame) => {
          try {
            const payload = JSON.parse(stompFrame.body) as Message;
            this.handlersRef?.onIncomingMessage(payload);
          } catch (e) {
            console.error("[Socket] Failed to parse reaction update:", e);
          }
        });

        // NEW: Subscribe to typing notifications
        client.subscribe(`/topic/user.${userId}/typing`, (stompFrame) => {
          try {
            const payload = JSON.parse(stompFrame.body);
            this.handlersRef?.onUserTyping?.(payload);
          } catch (e) {
            console.error("[Socket] Failed to parse typing notification:", e);
          }
        });

        // NEW: Subscribe to stopped typing notifications
        client.subscribe(
          `/topic/user.${userId}/stopped-typing`,
          (stompFrame) => {
            try {
              const payload = JSON.parse(stompFrame.body);
              this.handlersRef?.onUserStoppedTyping?.(payload);
            } catch (e) {
              console.error(
                "[Socket] Failed to parse stopped-typing notification:",
                e,
              );
            }
          },
        );

        client.subscribe(`/topic/user.${userId}/security`, (stompFrame) => {
          try {
            const payload = JSON.parse(stompFrame.body);
            this.handlersRef?.onSecurityNotification?.(payload);
          } catch (e) {
            console.error("[Socket] Failed to parse security notification:", e);
          }
        });

        client.subscribe(
          `/topic/user.${userId}/conversation-updates`,
          (stompFrame) => {
            try {
              const payload = JSON.parse(stompFrame.body);
              this.handlersRef?.onConversationUpdate?.(payload);
            } catch (e) {
              console.error("[Socket] Failed to parse conversation update:", e);
            }
          },
        );

        client.subscribe(
          `/topic/user.${userId}/reminder-deleted`,
          (stompFrame) => {
            try {
              // Handle both raw strings and JSON strings
              let deletedMessageId: string;
              try {
                deletedMessageId = JSON.parse(stompFrame.body);
              } catch {
                deletedMessageId = stompFrame.body;
              }

              if (deletedMessageId) {
                this.handlersRef?.onReminderDeleted?.(deletedMessageId);
              }
            } catch (e) {
              console.error("[Socket] Failed to parse reminder deletion:", e);
            }
          },
        );

        client.subscribe(
          `/topic/user.${userId}/reminder-trigger`,
          (stompFrame) => {
            try {
              const payload = JSON.parse(stompFrame.body);
              this.handlersRef?.onReminderTriggered?.(payload);
            } catch (e) {
              console.error("[Socket] Failed to parse reminder trigger:", e);
            }
          },
        );
      },

      onStompError: (frame) => {
        const msg = frame.headers?.["message"] || "Lỗi STOMP";
        console.error("[Socket] STOMP error:", msg);
        this.handlersRef?.onConnectionError?.(msg);
      },

      onWebSocketError: (evt) => {
        if (this.isDisconnecting || !client.active) {
          console.log(
            "[Socket] WebSocket error while disconnecting/inactive, ignored.",
          );
          return;
        }

        console.warn("[Socket] WebSocket error:", JSON.stringify(evt));
        this.handlersRef?.onConnectionError?.("Không thể kết nối realtime");
      },

      onWebSocketClose: (evt) => {
        const e = evt as any;
        console.log(
          `[Socket] WebSocket closed. code=${e?.code}, reason=${e?.reason}`,
        );
      },
      onDisconnect: () => {
        console.log("[Socket] STOMP disconnected");
      },
    });

    client.activate();
    this.client = client;
    console.log("[Socket] Client activated.");
  }

  disconnect(): void {
    if (this.client) {
      console.log("[Socket] Disconnecting...");
      this.isDisconnecting = true;
      this.handlersRef = null;
      this.client.deactivate();
      this.client = null;
    }
  }

  // NEW: Send typing notification
  notifyTyping(conversationId: number): void {
    if (this.client?.connected) {
      this.client.publish({
        destination: `/app/chat/${conversationId}/typing`,
        body: JSON.stringify({ conversationId }),
      });
      console.log(
        "[Socket] Sent typing notification for conversation:",
        conversationId,
      );
    }
  }

  // NEW: Send stopped typing notification
  notifyStoppedTyping(conversationId: number): void {
    if (this.client?.connected) {
      this.client.publish({
        destination: `/app/chat/${conversationId}/stopped-typing`,
        body: JSON.stringify({ conversationId }),
      });
      console.log(
        "[Socket] Sent stopped typing notification for conversation:",
        conversationId,
      );
    }
  }

  get isConnected(): boolean {
    return this.client?.connected ?? false;
  }
}

export const chatSocketService = new ChatSocketService();