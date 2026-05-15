import { create } from "zustand";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";
import { useCallStore } from "./useCallStore";
import { useFriendStore } from "./useFriendStore";
import { toast } from "sonner";
import api from "@/lib/axios";
import type { CallSession } from "@/types/call";

const LOCK_NOTICE_KEY = "auth_lock_notice";

interface SecurityNotification {
  type: string;
  title: string;
  message: string;
  targetPlatform?: string;
  reason?: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
  loginAt?: string;
  remainingMinutes?: number;
  lockUntil?: string;
}

interface SocketState {
  client: Client | null;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  connectSocket: (userId: number) => void;
  disconnectSocket: () => void;
  notifyTyping: (conversationId: number) => void;
  notifyStoppedTyping: (conversationId: number) => void;
}

interface TypingPayload {
  conversationId: number;
  userId: number;
  displayName?: string;
  typedAt?: string;
}

const resolveSocketUrl = (): string => {
  const base = api.defaults.baseURL;

  if (typeof base === "string" && base.startsWith("http")) {
    return base.replace(/\/api\/?$/, "") + "/ws";
  }

  // Fallback when baseURL is relative in production.
  return `${window.location.origin}/ws`;
};

export const useSocketStore = create<SocketState>((set, get) => ({
  client: null,
  heartbeatTimer: null,

  connectSocket: (userId) => {
    const token = useAuthStore.getState().accessToken;
    const existingClient = get().client;

    if (existingClient || !token) return;

    const socket = new SockJS(resolveSocketUrl());

    const client = new Client({
      webSocketFactory: () => socket,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,

      onConnect: () => {
        console.log("Connected to WebSocket");

        api.put("/users/status", null, { params: { status: "ONLINE" } })
          .catch(() => {});

        const existingTimer = get().heartbeatTimer;
        if (existingTimer) {
          clearInterval(existingTimer);
        }

        const timer = setInterval(() => {
          const currentClient = get().client;
          if (currentClient?.connected) {
            currentClient.publish({
              destination: "/app/presence/heartbeat",
              body: "{}",
            });
          }
        }, 30000);

        set({ heartbeatTimer: timer });

        // Subscribe to personal user topic for all conversation messages
        client.subscribe(`/topic/user.${userId}`, (message) => {
          const newMessage = JSON.parse(message.body);
          useChatStore.getState().addMessage(newMessage);
        });

        // Subscribe to new conversation notifications
        client.subscribe(`/topic/user.${userId}/conversations`, (message) => {
          const newConvo = JSON.parse(message.body);
          useChatStore.getState().addConvo(newConvo);
        });

        // Subscribe to message recall notifications
        client.subscribe(`/topic/user.${userId}/recall`, (message) => {
          const recalledMessage = JSON.parse(message.body);
          useChatStore.getState().updateMessage(recalledMessage);
        });

        client.subscribe(`/topic/user.${userId}/reactions`, (message) => {
          const updatedMessage = JSON.parse(message.body);
          useChatStore.getState().updateMessage(updatedMessage);
        });

        client.subscribe(`/topic/user.${userId}/typing`, (message) => {
          const payload: TypingPayload = JSON.parse(message.body);
          if (!payload?.conversationId || !payload?.userId) {
            return;
          }

          if (payload.userId === userId) {
            return;
          }

          useChatStore.getState().upsertTypingUser({
            conversationId: payload.conversationId,
            userId: payload.userId,
            displayName: payload.displayName || "Nguoi dung",
            typedAt: payload.typedAt,
          });
        });

        client.subscribe(`/topic/user.${userId}/stopped-typing`, (message) => {
          const payload: TypingPayload = JSON.parse(message.body);
          if (!payload?.conversationId || !payload?.userId) {
            return;
          }

          useChatStore
            .getState()
            .removeTypingUser(payload.conversationId, payload.userId);
        });

        // Subscribe to reminder deletion — remove the card from chat for all members
        client.subscribe(`/topic/user.${userId}/reminder-deleted`, (message) => {
          try {
            // Handle both raw strings and JSON-quoted strings
            let deletedMessageId: string;
            try {
              deletedMessageId = JSON.parse(message.body);
            } catch {
              deletedMessageId = message.body;
            }

            if (!deletedMessageId) return;

            // Find which conversation this message belongs to and remove it
            const state = useChatStore.getState();
            const allMessages = state.messages;
            
            for (const convoIdStr in allMessages) {
              const convoId = Number(convoIdStr);
              const items = allMessages[convoId]?.items ?? [];
              const found = items.some((m) => String(m.id) === String(deletedMessageId));
              if (found) {
                state.removeMessage(convoId, String(deletedMessageId));
                break;
              }
            }
          } catch (error) {
            console.error("Error processing reminder-deleted message:", error);
          }
        });

        client.subscribe(`/topic/user.${userId}/call-invite`, (message) => {
          const payload: CallSession = JSON.parse(message.body);
          useCallStore.getState().setIncomingCall(payload);

          const callerName = payload.participants.find(
            (participant) => participant.userId === payload.initiatedBy,
          )?.displayName;

          toast.info("Cuoc goi den", {
            description: callerName
              ? `${callerName} dang goi ${payload.mediaType === "VIDEO" ? "video" : "thoai"}`
              : "Ban co cuoc goi moi",
            duration: 6000,
          });
        });

        client.subscribe(`/topic/user.${userId}/call-status`, (message) => {
          const payload: CallSession = JSON.parse(message.body);
          useCallStore.getState().handleCallStatus(payload);
        });

        // Subscribe to security warnings (unknown-device login).
        client.subscribe(`/topic/user.${userId}/security`, (message) => {
          const payload: SecurityNotification = JSON.parse(message.body);

          if (payload.type === "ACCOUNT_TEMP_LOCKED") {
            get().disconnectSocket();
            useAuthStore.getState().clearState();

            const lockMessage =
              payload.message ||
              (payload.remainingMinutes
                ? `Bạn bị khóa ${payload.remainingMinutes} phút do vi phạm chính sách.`
                : "Bạn đã vi phạm chính sách của chúng tôi.");

            sessionStorage.setItem(LOCK_NOTICE_KEY, lockMessage);

            toast.error(payload.title || "Tài khoản bị khóa tạm thời", {
              description: lockMessage,
              duration: 7000,
            });

            if (window.location.pathname !== "/signin") {
              window.location.href = "/signin";
            }
            return;
          }

          if (
            payload.type === "SESSION_REVOKED_NEW_LOGIN" &&
            payload.targetPlatform === "WEB"
          ) {
            get().disconnectSocket();
            useAuthStore.getState().clearState();

            toast.error(payload.title || "Phiên đăng nhập đã kết thúc", {
              description: payload.message,
              duration: 5000,
            });

            if (window.location.pathname !== "/signin") {
              window.location.href = "/signin";
            }
            return;
          }

          toast.warning(payload.title || "Cảnh báo bảo mật", {
            description: [
              payload.message,
              payload.deviceName ? `Thiết bị: ${payload.deviceName}` : null,
              payload.ipAddress ? `IP: ${payload.ipAddress}` : null,
            ]
              .filter(Boolean)
              .join(" • "),
            duration: 9000,
          });
        });

        // Subscribe to friend request notifications
        client.subscribe(`/topic/user.${userId}/friend-requests`, (message) => {
          const newRequest = JSON.parse(message.body);
          useFriendStore.getState().addPendingRequest(newRequest);

          // Show toast notification
          toast.info("Bạn có lời mời kết bạn mới", {
            description: `${newRequest.displayName} đã gửi lời mời kết bạn`,
            duration: 4000,
          });
        });

        // Subscribe to friend accepted notifications
        client.subscribe(`/topic/user.${userId}/friend-accepted`, (message) => {
          const acceptedFriend = JSON.parse(message.body);
          useFriendStore
            .getState()
            .removePendingRequest(acceptedFriend.friendId);

          // Show toast notification
          toast.success("Lời mời được chấp nhận", {
            description: `${acceptedFriend.displayName} đã chấp nhận lời mời kết bạn`,
            duration: 4000,
          });
        });

        // Subscribe to reminder trigger notifications
        client.subscribe(`/topic/user.${userId}/reminders`, (message) => {
           const reminder = JSON.parse(message.body);
           toast.info(`Nhắc hẹn mới: ${reminder.title}`, {
             description: `Hẹn lúc: ${new Date(reminder.reminderTime).toLocaleString("vi-VN")}`,
             duration: 5000,
           });
        });

        client.subscribe(`/topic/user.${userId}/reminder-trigger`, (message) => {
           const reminder = JSON.parse(message.body);
           toast.success(`ĐẾN GIỜ: ${reminder.title}`, {
             description: reminder.content || "Bạn có một lịch hẹn ngay bây giờ!",
             duration: 10000,
           });
        });

        // Subscribe to conversation updates (member joined/left)
        client.subscribe(
          `/topic/user.${userId}/conversation-updates`,
          (message) => {
            const update = JSON.parse(message.body);

            if (update?.type === "PIN_UPDATE" && update?.conversationId) {
              useChatStore
                .getState()
                .fetchConversationById(update.conversationId);
              return;
            }

            if (update?.type === "CONVERSATION_UPDATED" && update?.updatedConversation) {
              const updated = update.updatedConversation;
              if (updated.avatarUrl) {
                updated.avatarUrl = `${updated.avatarUrl}?t=${Date.now()}`;
              } else {
                updated.avatarUrl = null;
              }
              useChatStore.getState().updateConversation(updated);
              return;
            }

            // update: { conversationId, participants }
            if (update?.conversationId && update?.participants) {
              useChatStore
                .getState()
                .updateConversationParticipants(
                  update.conversationId,
                  update.participants,
                );
            }
          },
        );

      },

      onStompError: (frame) => {
        console.error("STOMP error:", frame.headers["message"]);
      },
      onWebSocketClose: () => {
        console.warn("WebSocket closed. Waiting for reconnect...");
      },
      onWebSocketError: () => {
        console.error("WebSocket transport error");
      },
    });

    client.activate();
    set({ client });
  },

  disconnectSocket: () => {
    const timer = get().heartbeatTimer;
    if (timer) {
      clearInterval(timer);
      set({ heartbeatTimer: null });
    }

    api.put("/users/status", null, { params: { status: "OFFLINE" } })
      .catch(() => {});

    const client = get().client;
    client?.deactivate();
    useChatStore.getState().clearAllTypingUsers();
    set({ client: null });
  },

  notifyTyping: (conversationId) => {
    const client = get().client;
    if (!client?.connected) {
      return;
    }

    client.publish({
      destination: `/app/chat/${conversationId}/typing`,
      body: JSON.stringify({ conversationId }),
    });
  },

  notifyStoppedTyping: (conversationId) => {
    const client = get().client;
    if (!client?.connected) {
      return;
    }

    client.publish({
      destination: `/app/chat/${conversationId}/stopped-typing`,
      body: JSON.stringify({ conversationId }),
    });
  },
}));
