// import { chatService } from "@/services/chatService";
import { MOCK_CONVERSATIONS, MOCK_MESSAGES } from "@/data/mockChatData";
import type { ChatState } from "@/types/store";
import { create } from "zustand";
// import { persist } from "zustand/middleware";
// import { useAuthStore } from "./useAuthStore";
// import { useSocketStore } from "./useSocketStore";

export const useChatStore = create<ChatState>()(
  // persist(
  (set, get) => ({
    // ✅ Khởi tạo bằng mock data
    conversations: MOCK_CONVERSATIONS,
    messages: MOCK_MESSAGES,
    activeConversationId: null,
    convoLoading: false,
    messageLoading: false,
    loading: false,

    setActiveConversation: (id) => set({ activeConversationId: id }),
    reset: () => {
      set({
        conversations: MOCK_CONVERSATIONS,
        messages: MOCK_MESSAGES,
        activeConversationId: null,
        convoLoading: false,
        messageLoading: false,
      });
    },
    fetchConversations: async () => {
      // ✅ Mock: dùng dữ liệu cứng thay vì gọi API
      set({ convoLoading: true });
      // Simulate delay
      await new Promise((r) => setTimeout(r, 300));
      set({ conversations: MOCK_CONVERSATIONS, convoLoading: false });
    },
    fetchMessages: async (conversationId) => {
      const { activeConversationId } = get();
      const convoId = conversationId ?? activeConversationId;

      if (!convoId) return;

      set({ messageLoading: true });

      // ✅ Mock: load messages từ mock data
      await new Promise((r) => setTimeout(r, 200));

      const mockMsgs = MOCK_MESSAGES[convoId];
      if (mockMsgs) {
        set((state) => ({
          messages: {
            ...state.messages,
            [convoId]: mockMsgs,
          },
        }));
      }

      set({ messageLoading: false });
    },
    sendDirectMessage: async (_recipientId, content, _imgUrl) => {
      // ✅ Mock: thêm tin nhắn vào conversation hiện tại
      const { activeConversationId } = get();
      if (!activeConversationId) return;

      const newMsg = {
        _id: `msg-${Date.now()}`,
        conversationId: activeConversationId,
        senderId: "user-me",
        content,
        imgUrl: _imgUrl ?? null,
        updatedAt: null,
        createdAt: new Date().toISOString(),
        isOwn: true,
      };

      set((state) => {
        const prev = state.messages[activeConversationId]?.items ?? [];
        return {
          messages: {
            ...state.messages,
            [activeConversationId]: {
              items: [...prev, newMsg],
              hasMore: false,
              nextCursor: null,
            },
          },
          conversations: state.conversations.map((c) =>
            c._id === activeConversationId
              ? {
                ...c,
                seenBy: [],
                lastMessage: {
                  _id: newMsg._id,
                  content: newMsg.content ?? "",
                  createdAt: newMsg.createdAt,
                  sender: {
                    _id: "user-me",
                    displayName: "John Doe",
                    avatarUrl: "https://i.pravatar.cc/150?img=3",
                  },
                },
                lastMessageAt: newMsg.createdAt,
              }
              : c
          ),
        };
      });
    },
    sendGroupMessage: async (conversationId, content, imgUrl) => {
      // ✅ Mock: thêm tin nhắn vào group
      const newMsg = {
        _id: `msg-${Date.now()}`,
        conversationId,
        senderId: "user-me",
        content,
        imgUrl: imgUrl ?? null,
        updatedAt: null,
        createdAt: new Date().toISOString(),
        isOwn: true,
      };

      set((state) => {
        const prev = state.messages[conversationId]?.items ?? [];
        return {
          messages: {
            ...state.messages,
            [conversationId]: {
              items: [...prev, newMsg],
              hasMore: false,
              nextCursor: null,
            },
          },
          conversations: state.conversations.map((c) =>
            c._id === conversationId
              ? {
                ...c,
                seenBy: [],
                lastMessage: {
                  _id: newMsg._id,
                  content: newMsg.content ?? "",
                  createdAt: newMsg.createdAt,
                  sender: {
                    _id: "user-me",
                    displayName: "John Doe",
                    avatarUrl: "https://i.pravatar.cc/150?img=3",
                  },
                },
                lastMessageAt: newMsg.createdAt,
              }
              : c
          ),
        };
      });
    },
    addMessage: async (message) => {
      const convoId = message.conversationId;
      const prevItems = get().messages[convoId]?.items ?? [];

      if (prevItems.some((m) => m._id === message._id)) {
        return;
      }

      set((state) => ({
        messages: {
          ...state.messages,
          [convoId]: {
            items: [...prevItems, message],
            hasMore: state.messages[convoId]?.hasMore ?? false,
            nextCursor: state.messages[convoId]?.nextCursor ?? undefined,
          },
        },
      }));
    },
    updateConversation: (conversation: any) => {
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c._id === conversation._id ? { ...c, ...conversation } : c
        ),
      }));
    },
    markAsSeen: async () => {
      // ✅ Mock: đánh dấu đã đọc
      const { activeConversationId, conversations } = get();
      if (!activeConversationId) return;

      // ⚠️ QUAN TRỌNG: phải check xem unread đã = 0 chưa
      // Nếu đã = 0 thì KHÔNG set state, tránh vòng lặp vô hạn
      const convo = conversations.find((c) => c._id === activeConversationId);
      if (!convo) return;
      if ((convo.unreadCounts?.["user-me"] ?? 0) === 0) return;

      set((state) => ({
        conversations: state.conversations.map((c) =>
          c._id === activeConversationId
            ? {
              ...c,
              unreadCounts: {
                ...c.unreadCounts,
                "user-me": 0,
              },
            }
            : c
        ),
      }));
    },
    addConvo: (convo) => {
      set((state) => {
        const exists = state.conversations.some(
          (c) => c._id.toString() === convo._id.toString()
        );

        return {
          conversations: exists
            ? state.conversations
            : [convo, ...state.conversations],
          activeConversationId: convo._id,
        };
      });
    },
    createConversation: async (type, name, memberIds) => {
      // ✅ Mock: tạo conversation mới
      const newConvo = {
        _id: `conv-${Date.now()}`,
        type,
        group: { name: type === "group" ? name : "", createdBy: "user-me" },
        participants: memberIds.map((id) => ({
          _id: id,
          displayName: id,
          avatarUrl: null,
          joinedAt: new Date().toISOString(),
        })),
        lastMessageAt: new Date().toISOString(),
        seenBy: [],
        lastMessage: null,
        unreadCounts: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any;

      get().addConvo(newConvo);
    },
  }),
  // {
  //   name: "chat-storage",
  //   partialize: (state) => ({ conversations: state.conversations }),
  // }
  // )
);
