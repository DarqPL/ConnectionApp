import { create } from "zustand";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";

interface SocketState {
  client: Client | null;
  onlineUsers: string[];
  connectSocket: (conversationId: string) => void;
  disconnectSocket: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  client: null,
  onlineUsers: [],

  connectSocket: (conversationId) => {
    const token = useAuthStore.getState().accessToken;
    const existingClient = get().client;

    if (existingClient) return;

    const socket = new SockJS("http://localhost:8080/ws");

    const client = new Client({
      webSocketFactory: () => socket,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,

      onConnect: () => {
        console.log("Connected to WebSocket");

        // subscribe message
        client.subscribe(`/topic/conversation/${conversationId}`, (message) => {
          const newMessage = JSON.parse(message.body);
          useChatStore.getState().addMessage(newMessage);
        });

        // subscribe online users
        client.subscribe("/topic/online-users", (message) => {
          const users = JSON.parse(message.body);
          set({ onlineUsers: users });
        });
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
