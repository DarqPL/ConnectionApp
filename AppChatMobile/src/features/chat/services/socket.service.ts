import { Client, type StompSubscription } from "@stomp/stompjs";
import type { Conversation, Message } from "../types";

interface ChatSocketHandlers {
  onIncomingMessage: (message: Message) => void;
  onIncomingConversation: (conversation: Conversation) => void;
  onRecallMessage: (message: Message) => void;
  onSecurityNotification?: (payload: {
    title?: string;
    message?: string;
    deviceName?: string;
    ipAddress?: string;
  }) => void;
  onConnectionError?: (error: string) => void;
}

class ChatSocketService {
  private client: Client | null = null;
  private isConnected = false;
  private conversationSubscriptions = new Map<number, StompSubscription>();
  private bufferedConversationIds: number[] = [];

  private subscribeConversationTopics(
    conversationIds: number[],
    onIncomingMessage: (message: Message) => void,
  ): void {
    if (!this.client || !this.isConnected) {
      this.bufferedConversationIds = conversationIds;
      return;
    }

    const nextSet = new Set(conversationIds);

    // Unsubscribe removed conversations.
    for (const [conversationId, subscription] of this
      .conversationSubscriptions) {
      if (!nextSet.has(conversationId)) {
        subscription.unsubscribe();
        this.conversationSubscriptions.delete(conversationId);
      }
    }

    // Subscribe new conversations.
    for (const conversationId of conversationIds) {
      if (this.conversationSubscriptions.has(conversationId)) continue;

      const subscription = this.client.subscribe(
        `/topic/conversation${conversationId}`,
        (frame) => {
          const payload = JSON.parse(frame.body) as Message;
          onIncomingMessage(payload);
        },
      );

      this.conversationSubscriptions.set(conversationId, subscription);
    }
  }

  connect(
    wsUrl: string,
    userId: number,
    accessToken: string,
    handlers: ChatSocketHandlers,
  ): void {
    if (this.client?.active) {
      return;
    }

    const client = new Client({
      webSocketFactory: () => new WebSocket(wsUrl),
      connectHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
      reconnectDelay: 5000,

      onConnect: () => {
        this.isConnected = true;

        client.subscribe(`/topic/user.${userId}`, (frame) => {
          const payload = JSON.parse(frame.body) as Message;
          handlers.onIncomingMessage(payload);
        });

        client.subscribe(`/topic/user.${userId}/conversations`, (frame) => {
          const payload = JSON.parse(frame.body) as Conversation;
          handlers.onIncomingConversation(payload);
        });

        client.subscribe(`/topic/user.${userId}/recall`, (frame) => {
          const payload = JSON.parse(frame.body) as Message;
          handlers.onRecallMessage(payload);
        });

        client.subscribe(`/topic/user.${userId}/security`, (frame) => {
          const payload = JSON.parse(frame.body) as {
            title?: string;
            message?: string;
            deviceName?: string;
            ipAddress?: string;
          };

          handlers.onSecurityNotification?.(payload);
        });

        if (this.bufferedConversationIds.length > 0) {
          this.subscribeConversationTopics(
            this.bufferedConversationIds,
            handlers.onIncomingMessage,
          );
        }
      },

      onStompError: (frame) => {
        handlers.onConnectionError?.(
          frame.headers["message"] || "STOMP connection error",
        );
      },

      onWebSocketError: () => {
        handlers.onConnectionError?.("WebSocket connection error");
      },

      onWebSocketClose: () => {
        this.isConnected = false;
      },
    });

    client.activate();
    this.client = client;
  }

  syncConversationSubscriptions(
    conversationIds: number[],
    onIncomingMessage: (message: Message) => void,
  ): void {
    this.subscribeConversationTopics(conversationIds, onIncomingMessage);
  }

  disconnect(): void {
    this.isConnected = false;
    this.bufferedConversationIds = [];

    for (const subscription of this.conversationSubscriptions.values()) {
      subscription.unsubscribe();
    }
    this.conversationSubscriptions.clear();

    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
  }
}

export const chatSocketService = new ChatSocketService();
