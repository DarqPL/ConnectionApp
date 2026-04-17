import { chatService } from "@/services/chatService";
import type { ChatState } from "@/types/store";
import type { Message } from "@/types/chat";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";

const buildMessagePreview = (message: Message): string => {
  const content = (message.content ?? "").trim();
  if (content) {
    return content;
  }

  const attachmentCount = message.attachments?.length ?? 0;
  if (attachmentCount === 1) {
    return "Da gui 1 tep dinh kem";
  }
  if (attachmentCount > 1) {
    return `Da gui ${attachmentCount} tep dinh kem`;
  }

  return "";
};

export const useChatStore = create<ChatState>()((set, get) => ({
  conversations: [],
  messages: {},
  activeConversationId: null,
  convoLoading: false,
  messageLoading: false,
  loading: false,
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
    // Call backend to mark as read
    if (id) {
      chatService.markAsRead(id).catch(console.error);

      // Reset local unread count
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, unreadCount: 0 } : c,
        ),
      }));
    }
  },

  reset: () => {
    set({
      conversations: [],
      messages: {},
      activeConversationId: null,
      convoLoading: false,
      messageLoading: false,
    });
  },

  fetchConversations: async (page = 0) => {
    set({ convoLoading: true });
    try {
      const pageResponse = await chatService.fetchConversations(page);
      const user = useAuthStore.getState().user;

      const convos = pageResponse.content.map((c) => {
        const myParticipant = c.participants?.find(
          (p) => p.userId === user?.id,
        );
        return {
          ...c,
          // Fallback to unreadCount if already there, else take from participant
          unreadCount: c.unreadCount ?? (myParticipant?.unreadCounts || 0),
        };
      });
      set({ conversations: convos });
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      set({ convoLoading: false });
    }
  },

  fetchMessages: async (conversationId) => {
    const { activeConversationId } = get();
    const convoId = conversationId ?? activeConversationId;

    if (convoId == null) return;

    set({ messageLoading: true });

    try {
      const currentMsgs = get().messages[convoId];
      const nextPage = currentMsgs ? currentMsgs.page + 1 : 0;

      const pageResponse = await chatService.fetchMessages(convoId, nextPage);

      // Mark messages as own based on logged in user
      const user = useAuthStore.getState().user;
      const messagesWithOwn: Message[] = pageResponse.content.map((msg) => ({
        ...msg,
        isOwn: user ? msg.senderInfo.senderId === user.id : false,
      }));

      set((state) => {
        const prevItems = state.messages[convoId]?.items ?? [];
        return {
          messages: {
            ...state.messages,
            [convoId]: {
              // Prepend older messages (API returns DESC order)
              items:
                nextPage === 0
                  ? messagesWithOwn.reverse()
                  : [...messagesWithOwn.reverse(), ...prevItems],
              hasMore: pageResponse.hasNext,
              page: nextPage,
            },
          },
        };
      });
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      set({ messageLoading: false });
    }
  },

  sendMessage: async (conversationId, content, parentId, attachments = []) => {
    try {
      const response = await chatService.sendMessage(
        conversationId,
        content,
        parentId,
        attachments,
      );

      const user = useAuthStore.getState().user;
      const messageWithOwn: Message = {
        ...response,
        isOwn: user ? response.senderInfo.senderId === user.id : false,
      };
      const preview = buildMessagePreview(messageWithOwn);

      // Add message to the conversation
      set((state) => {
        const prevItems = state.messages[conversationId]?.items ?? [];

        const updatedConversations = state.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                lastMessageContent: preview,
                lastMessageAt: messageWithOwn.createdAt,
              }
            : c,
        );

        const targetConvo = updatedConversations.find(
          (c) => c.id === conversationId,
        );
        const otherConvos = updatedConversations.filter(
          (c) => c.id !== conversationId,
        );
        const finalConversations = targetConvo
          ? [targetConvo, ...otherConvos]
          : updatedConversations;

        if (prevItems.some((m) => m.id === messageWithOwn.id)) {
          // Update conversation's last message info anyway
          return {
            conversations: finalConversations,
          };
        }

        return {
          messages: {
            ...state.messages,
            [conversationId]: {
              items: [...prevItems, messageWithOwn],
              hasMore: state.messages[conversationId]?.hasMore ?? false,
              page: state.messages[conversationId]?.page ?? 0,
            },
          },
          // Update conversation's last message info
          conversations: finalConversations,
        };
      });
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  },

  addMessage: (message) => {
    const convoId = message.conversationId;
    const prevItems = get().messages[convoId]?.items ?? [];

    // Avoid duplicates
    if (prevItems.some((m) => m.id === message.id)) {
      return;
    }

    const user = useAuthStore.getState().user;
    const messageWithOwn: Message = {
      ...message,
      isOwn: user ? message.senderInfo.senderId === user.id : false,
    };
    const preview = buildMessagePreview(messageWithOwn);

    // Check if conversation exists in state
    const convoExists = get().conversations.some((c) => c.id === convoId);

    if (!convoExists) {
      // Conversation not in state — fetch it from backend and add it
      chatService
        .fetchConversationById(convoId)
        .then((convo) => {
          set((state) => {
            const otherConvos = state.conversations.filter(
              (c) => c.id !== convoId,
            );
            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  items: [messageWithOwn],
                  hasMore: false,
                  page: 0,
                },
              },
              conversations: [
                {
                  ...convo,
                  lastMessageContent: preview,
                  lastMessageAt: message.createdAt,
                  unreadCount: state.activeConversationId === convoId ? 0 : 1,
                },
                ...otherConvos,
              ],
            };
          });
        })
        .catch(console.error);
      return;
    }

    set((state) => {
      const updatedConversations = state.conversations.map((c) =>
        c.id === convoId
          ? {
              ...c,
              lastMessageContent: preview,
              lastMessageAt: message.createdAt,
              // Increment unread count if we are NOT currently viewing this chat
              unreadCount:
                state.activeConversationId === convoId
                  ? 0
                  : (c.unreadCount || 0) + 1,
            }
          : c,
      );

      const targetConvo = updatedConversations.find((c) => c.id === convoId);
      const otherConvos = updatedConversations.filter((c) => c.id !== convoId);
      const finalConversations = targetConvo
        ? [targetConvo, ...otherConvos]
        : updatedConversations;

      return {
        messages: {
          ...state.messages,
          [convoId]: {
            items: [...prevItems, messageWithOwn],
            hasMore: state.messages[convoId]?.hasMore ?? false,
            page: state.messages[convoId]?.page ?? 0,
          },
        },
        conversations: finalConversations,
      };
    });

    // If we are currently viewing it, notify backend that we've read it
    if (get().activeConversationId === convoId) {
      chatService.markAsRead(convoId).catch(console.error);
    }
  },

  updateConversation: (conversation) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversation.id ? { ...c, ...conversation } : c,
      ),
    }));
  },

  updateMessage: (message) => {
    const convoId = message.conversationId;
    const user = useAuthStore.getState().user;
    const messageWithOwn: Message = {
      ...message,
      isOwn: user ? message.senderInfo.senderId === user.id : false,
    };

    set((state) => {
      const prevItems = state.messages[convoId]?.items ?? [];
      return {
        messages: {
          ...state.messages,
          [convoId]: {
            ...state.messages[convoId],
            items: prevItems.map((m) =>
              m.id === messageWithOwn.id ? messageWithOwn : m,
            ),
          },
        },
      };
    });
  },

  recallMessage: async (conversationId, messageId) => {
    try {
      const response = await chatService.recallMessage(messageId);
      const user = useAuthStore.getState().user;
      const messageWithOwn: Message = {
        ...response,
        isOwn: user ? response.senderInfo.senderId === user.id : false,
      };

      set((state) => {
        const prevItems = state.messages[conversationId]?.items ?? [];
        return {
          messages: {
            ...state.messages,
            [conversationId]: {
              ...state.messages[conversationId],
              items: prevItems.map((m) =>
                m.id === messageWithOwn.id ? messageWithOwn : m,
              ),
            },
          },
        };
      });
    } catch (error) {
      console.error("Error recalling message:", error);
      throw error;
    }
  },

  deleteMessage: async (conversationId, messageId) => {
    try {
      await chatService.deleteMessage(messageId);
      
      set((state) => {
        const prevItems = state.messages[conversationId]?.items ?? [];
        return {
          messages: {
            ...state.messages,
            [conversationId]: {
              ...state.messages[conversationId],
              items: prevItems.filter((m) => m.id !== messageId),
            },
          },
        };
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  },

  addConvo: (convo) => {
    set((state) => {
      const otherConvos = state.conversations.filter((c) => c.id !== convo.id);

      return {
        conversations: [convo, ...otherConvos],
        activeConversationId: convo.id,
      };
    });
  },

  createConversation: async (type, name, participantIds) => {
    set({ loading: true });
    try {
      const newConvo = await chatService.createConversation({
        name,
        type,
        participantIds,
      });
      // Re-fetch to ensure we have complete data (including participants)
      const fullConvo = await chatService.fetchConversationById(newConvo.id);
      get().addConvo(fullConvo);
    } catch (error) {
      console.error("Error creating conversation:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
}));
