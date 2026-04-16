import { create } from "zustand";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";
import { useFriendStore } from "./useFriendStore";
import { toast } from "sonner";
import api from "@/lib/axios";

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
}

interface SocketState {
  client: Client | null;
  onlineUsers: string[];
  connectSocket: (userId: number) => void;
  disconnectSocket: () => void;
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
  onlineUsers: [],

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

        // Subscribe to security warnings (unknown-device login).
        client.subscribe(`/topic/user.${userId}/security`, (message) => {
          const payload: SecurityNotification = JSON.parse(message.body);

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
          useFriendStore.getState().removePendingRequest(acceptedFriend.friendId);
          
          // Show toast notification
          toast.success("Lời mời được chấp nhận", {
            description: `${acceptedFriend.displayName} đã chấp nhận lời mời kết bạn`,
            duration: 4000,
          });
        });

        // Subscribe to online users
        client.subscribe("/topic/online-users", (message) => {
          const users = JSON.parse(message.body);
          set({ onlineUsers: users });
        });
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
    const client = get().client;
    client?.deactivate();
    set({ client: null });
  },
}));
