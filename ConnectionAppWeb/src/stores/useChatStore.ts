import { chatService } from "@/services/chatService";
import type { ChatState } from "@/types/store";
import type { Message, ReminderRequest } from "@/types/chat";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";

const TYPING_CLEAR_DELAY_MS = 3500;
const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const getTypingKey = (conversationId: number, userId: number): string =>
  `${conversationId}:${userId}`;

const clearTypingTimeout = (conversationId: number, userId: number): void => {
  const key = getTypingKey(conversationId, userId);
  const timeoutId = typingTimeouts.get(key);
  if (!timeoutId) {
    return;
  }

  clearTimeout(timeoutId);
  typingTimeouts.delete(key);
};

const clearTypingTimeoutsByConversation = (conversationId: number): void => {
  for (const [key, timeoutId] of typingTimeouts.entries()) {
    if (!key.startsWith(`${conversationId}:`)) {
      continue;
    }

    clearTimeout(timeoutId);
    typingTimeouts.delete(key);
  }
};

const clearAllTypingTimeouts = (): void => {
  for (const timeoutId of typingTimeouts.values()) {
    clearTimeout(timeoutId);
  }
  typingTimeouts.clear();
};

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

const normalizeContent = (content: string | null | undefined): string =>
  (content ?? "").trim();

const buildAttachmentKey = (attachments: Message["attachments"]): string =>
  (attachments ?? [])
    .map((attachment) =>
      [
        attachment.type,
        attachment.fileUrl,
        attachment.originalFileName ?? "",
      ].join("::"),
    )
    .sort()
    .join("||");

const findOptimisticMatchIndex = (
  items: Message[],
  incoming: Message,
  currentUserId?: number,
): number => {
  const incomingSenderId = incoming.senderInfo?.senderId;
  if (!incomingSenderId || incomingSenderId !== currentUserId) {
    return -1;
  }

  const incomingContent = normalizeContent(incoming.content);
  const incomingAttachmentsKey = buildAttachmentKey(incoming.attachments);
  const incomingParentId = incoming.parentId ?? null;
  const incomingCreatedAt = new Date(incoming.createdAt).getTime();

  return items.findIndex((item) => {
    if (item.status !== "SENDING" && item.status !== "ERROR") {
      return false;
    }
    if (!item.isOwn || item.senderInfo?.senderId !== incomingSenderId) {
      return false;
    }

    const itemContent = normalizeContent(item.content);
    const itemAttachmentsKey = buildAttachmentKey(item.attachments);
    const itemParentId = item.parentId ?? null;
    const itemCreatedAt = new Date(item.createdAt).getTime();

    if (itemContent !== incomingContent) {
      return false;
    }
    if (itemAttachmentsKey !== incomingAttachmentsKey) {
      return false;
    }
    if (itemParentId !== incomingParentId) {
      return false;
    }

    return Math.abs(itemCreatedAt - incomingCreatedAt) <= 90_000;
  });
};

const applyReactionForUser = (
  message: Message,
  userId: number,
  reactionCode: string | null,
): Message => {
  const existing = message.reactions ?? [];
  const others = existing.filter((reaction) => reaction.userId !== userId);
  const mine = existing.find((reaction) => reaction.userId === userId);

  if (!reactionCode) {
    return {
      ...message,
      reactions: others,
    };
  }

  if (mine?.reactionCode === reactionCode) {
    return {
      ...message,
      reactions: others,
    };
  }

  return {
    ...message,
    reactions: [
      ...others,
      {
        userId,
        reactionCode,
      },
    ],
  };
};

export const useChatStore = create<ChatState>()((set, get) => ({
  conversations: [],
  typingByConversation: {},
  messages: {},
  activeConversationId: null,
  convoLoading: false,
  messageLoading: false,
  loading: false,
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),

  setActiveConversation: (id) => {
    const prevConversationId = get().activeConversationId;
    if (prevConversationId && prevConversationId !== id) {
      get().clearTypingUsers(prevConversationId);
    }

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
    clearAllTypingTimeouts();
    set({
      conversations: [],
      typingByConversation: {},
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

  sendMessage: async (
    conversationId,
    content,
    parentId,
    attachments = [],
    poll = null,
  ) => {
    const user = useAuthStore.getState().user;
    const tempId = `temp_${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      tempId,
      conversationId,
      senderInfo: {
        senderId: user?.id ?? 0,
        displayName: user?.displayName || user?.username || "You",
        avatarUrl: user?.avatarUrl ?? null,
      },
      content,
      attachments,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      parentId: parentId ?? null,
      isDeleted: false,
      recalledAt: null,
      replyInfo: null,
      poll,
      reminder: null,
      reactions: [],
      isOwn: true,
      status: "SENDING",
    };

    const tempPreview = buildMessagePreview(tempMessage);
    set((state) => {
      const prevItems = state.messages[conversationId]?.items ?? [];
      const updatedConversations = state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              lastMessageContent: tempPreview,
              lastMessageAt: tempMessage.createdAt,
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

      return {
        messages: {
          ...state.messages,
          [conversationId]: {
            items: [...prevItems, tempMessage],
            hasMore: state.messages[conversationId]?.hasMore ?? false,
            page: state.messages[conversationId]?.page ?? 0,
          },
        },
        conversations: finalConversations,
      };
    });

    try {
      const response = await chatService.sendMessage(
        conversationId,
        content,
        parentId,
        attachments,
        poll,
      );

      const messageWithOwn: Message = {
        ...response,
        isOwn: user ? response.senderInfo.senderId === user.id : false,
        status: "SENT",
        tempId,
      };
      const preview = buildMessagePreview(messageWithOwn);

      set((state) => {
        const prevItems = state.messages[conversationId]?.items ?? [];
        const hasTemp = prevItems.some(
          (m) => m.id === tempId || m.tempId === tempId,
        );
        const withoutServerDup = prevItems.filter(
          (m) => m.id !== messageWithOwn.id,
        );
        const nextItems = hasTemp
          ? withoutServerDup.map((m) =>
              m.id === tempId || m.tempId === tempId ? messageWithOwn : m,
            )
          : [...withoutServerDup, messageWithOwn];

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

        return {
          messages: {
            ...state.messages,
            [conversationId]: {
              items: nextItems,
              hasMore: state.messages[conversationId]?.hasMore ?? false,
              page: state.messages[conversationId]?.page ?? 0,
            },
          },
          conversations: finalConversations,
        };
      });
    } catch (error) {
      set((state) => {
        const prevItems = state.messages[conversationId]?.items ?? [];
        return {
          messages: {
            ...state.messages,
            [conversationId]: {
              ...state.messages[conversationId],
              items: prevItems.map((m) =>
                m.id === tempId || m.tempId === tempId
                  ? { ...m, status: "ERROR" }
                  : m,
              ),
            },
          },
        };
      });
      console.error("Error sending message:", error);
      throw error;
    }
  },

  retrySendMessage: async (conversationId, tempMessageId) => {
    const target =
      get().messages[conversationId]?.items.find(
        (item) => item.id === tempMessageId || item.tempId === tempMessageId,
      ) ?? null;

    if (!target) {
      return;
    }

    const tempId = target.tempId ?? target.id;
    const content = target.content ?? "";
    const attachments = target.attachments ?? [];
    const parentId = target.parentId ?? null;
    const poll = target.poll ?? null;
    const user = useAuthStore.getState().user;

    set((state) => {
      const prevItems = state.messages[conversationId]?.items ?? [];
      return {
        messages: {
          ...state.messages,
          [conversationId]: {
            ...state.messages[conversationId],
            items: prevItems.map((m) =>
              m.id === tempId || m.tempId === tempId
                ? { ...m, status: "SENDING" }
                : m,
            ),
          },
        },
      };
    });

    try {
      const response = await chatService.sendMessage(
        conversationId,
        content,
        parentId,
        attachments,
        poll,
      );

      const messageWithOwn: Message = {
        ...response,
        isOwn: user ? response.senderInfo.senderId === user.id : false,
        status: "SENT",
        tempId,
      };
      const preview = buildMessagePreview(messageWithOwn);

      set((state) => {
        const prevItems = state.messages[conversationId]?.items ?? [];
        const withoutServerDup = prevItems.filter(
          (m) => m.id !== messageWithOwn.id,
        );
        const nextItems = withoutServerDup.map((m) =>
          m.id === tempId || m.tempId === tempId ? messageWithOwn : m,
        );

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

        return {
          messages: {
            ...state.messages,
            [conversationId]: {
              items: nextItems,
              hasMore: state.messages[conversationId]?.hasMore ?? false,
              page: state.messages[conversationId]?.page ?? 0,
            },
          },
          conversations: finalConversations,
        };
      });
    } catch (error) {
      set((state) => {
        const prevItems = state.messages[conversationId]?.items ?? [];
        return {
          messages: {
            ...state.messages,
            [conversationId]: {
              ...state.messages[conversationId],
              items: prevItems.map((m) =>
                m.id === tempId || m.tempId === tempId
                  ? { ...m, status: "ERROR" }
                  : m,
              ),
            },
          },
        };
      });
      console.error("Error retrying message:", error);
      throw error;
    }
  },

  addMessage: (message) => {
    const convoId = message.conversationId;
    const prevItems = get().messages[convoId]?.items ?? [];

    const user = useAuthStore.getState().user;
    const messageWithOwn: Message = {
      ...message,
      isOwn: user ? message.senderInfo.senderId === user.id : false,
    };
    const preview = buildMessagePreview(messageWithOwn);

    // If message already exists -> update it IN-PLACE (do not move to bottom)
    // This handles Join/Decline/Edit on reminder & poll cards correctly.
    const exists = prevItems.some((m) => m.id === message.id);

    if (exists) {
      get().updateMessage(messageWithOwn);
      return; // Stop here - do NOT append to bottom
    }

    const optimisticIndex = findOptimisticMatchIndex(
      prevItems,
      messageWithOwn,
      user?.id,
    );

    if (optimisticIndex !== -1) {
      const nextItems = prevItems.map((item, index) =>
        index === optimisticIndex
          ? { ...messageWithOwn, status: "SENT" }
          : item,
      );

      set((state) => {
        const updatedConversations = state.conversations.map((c) => {
          if (c.id !== convoId) {
            return c;
          }

          const isOwn = messageWithOwn.isOwn;
          const nextUnreadCount =
            state.activeConversationId === convoId || isOwn
              ? 0
              : (c.unreadCount || 0) + 1;

          return {
            ...c,
            lastMessageContent: preview,
            lastMessageAt: messageWithOwn.createdAt,
            unreadCount: nextUnreadCount,
          };
        });

        const targetConvo = updatedConversations.find((c) => c.id === convoId);
        const otherConvos = updatedConversations.filter(
          (c) => c.id !== convoId,
        );
        const finalConversations = targetConvo
          ? [targetConvo, ...otherConvos]
          : updatedConversations;

        return {
          messages: {
            ...state.messages,
            [convoId]: {
              items: nextItems,
              hasMore: state.messages[convoId]?.hasMore ?? false,
              page: state.messages[convoId]?.page ?? 0,
            },
          },
          conversations: finalConversations,
        };
      });

      return;
    }

    const updatedItems = prevItems;

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
            items: [...updatedItems, messageWithOwn],
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

  updateConversationParticipants: (conversationId, participants) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, participants } : c,
      ),
    }));
  },

  upsertTypingUser: (typingUser) => {
    const user = useAuthStore.getState().user;
    if (!typingUser.conversationId || !typingUser.userId) {
      return;
    }

    if (user && typingUser.userId === user.id) {
      return;
    }

    const fallbackName = typingUser.displayName?.trim() || "Nguoi dung";

    set((state) => {
      const current =
        state.typingByConversation[typingUser.conversationId] ?? [];
      const index = current.findIndex(
        (item) => item.userId === typingUser.userId,
      );

      const nextTypingUser = {
        conversationId: typingUser.conversationId,
        userId: typingUser.userId,
        displayName: fallbackName,
        typedAt: typingUser.typedAt,
      };

      const next =
        index === -1
          ? [...current, nextTypingUser]
          : current.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...nextTypingUser } : item,
            );

      return {
        typingByConversation: {
          ...state.typingByConversation,
          [typingUser.conversationId]: next,
        },
      };
    });

    clearTypingTimeout(typingUser.conversationId, typingUser.userId);
    const timeoutId = setTimeout(() => {
      get().removeTypingUser(typingUser.conversationId, typingUser.userId);
    }, TYPING_CLEAR_DELAY_MS);

    typingTimeouts.set(
      getTypingKey(typingUser.conversationId, typingUser.userId),
      timeoutId,
    );
  },

  removeTypingUser: (conversationId, userId) => {
    clearTypingTimeout(conversationId, userId);

    set((state) => {
      const current = state.typingByConversation[conversationId] ?? [];
      if (current.length === 0) {
        return state;
      }

      const filtered = current.filter((item) => item.userId !== userId);
      if (filtered.length === current.length) {
        return state;
      }

      if (filtered.length === 0) {
        const rest = { ...state.typingByConversation };
        delete rest[conversationId];
        return { typingByConversation: rest };
      }

      return {
        typingByConversation: {
          ...state.typingByConversation,
          [conversationId]: filtered,
        },
      };
    });
  },

  clearTypingUsers: (conversationId) => {
    clearTypingTimeoutsByConversation(conversationId);

    set((state) => {
      if (!state.typingByConversation[conversationId]) {
        return state;
      }

      const rest = { ...state.typingByConversation };
      delete rest[conversationId];
      return { typingByConversation: rest };
    });
  },

  clearAllTypingUsers: () => {
    clearAllTypingTimeouts();
    set({ typingByConversation: {} });
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
      get().removeMessage(conversationId, messageId);
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  },

  removeMessage: (conversationId, messageId) => {
    set((state) => {
      const prevItems = state.messages[conversationId]?.items ?? [];
      const idStr = String(messageId);
      if (!prevItems.some((m) => String(m.id) === idStr)) return state;

      return {
        messages: {
          ...state.messages,
          [conversationId]: {
            ...state.messages[conversationId],
            items: prevItems.filter((m) => String(m.id) !== idStr),
          },
        },
      };
    });
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

  removeConversation: (conversationId) => {
    set((state) => {
      const filteredConvos = state.conversations.filter(
        (c) => c.id !== conversationId,
      );
      const newActiveId =
        state.activeConversationId === conversationId
          ? null
          : state.activeConversationId;

      // Clear messages for this conversation
      const messagesClone = { ...state.messages };
      delete messagesClone[conversationId];

      // Clear typing users for this conversation
      const typingClone = { ...state.typingByConversation };
      delete typingClone[conversationId];

      return {
        conversations: filteredConvos,
        activeConversationId: newActiveId,
        messages: messagesClone,
        typingByConversation: typingClone,
      };
    });
  },

  votePoll: async (messageId, optionIds) => {
    try {
      const updatedMessage = await chatService.votePoll(messageId, optionIds);
      get().updateMessage(updatedMessage);
    } catch (error) {
      console.error("Error voting in poll:", error);
      throw error;
    }
  },

  closePoll: async (messageId) => {
    try {
      const updatedMessage = await chatService.closePoll(messageId);
      get().updateMessage(updatedMessage);
    } catch (error) {
      console.error("Error closing poll:", error);
      throw error;
    }
  },

  reactMessage: async (conversationId, messageId, reactionCode) => {
    const user = useAuthStore.getState().user;
    if (!user) {
      throw new Error("Vui long dang nhap lai");
    }

    const previousMessage =
      get().messages[conversationId]?.items.find(
        (item) => item.id === messageId,
      ) ?? null;

    if (!previousMessage) {
      return;
    }

    const optimisticMessage = applyReactionForUser(
      previousMessage,
      user.id,
      reactionCode,
    );

    get().updateMessage(optimisticMessage);

    try {
      const serverMessage = reactionCode
        ? await chatService.reactMessage(messageId, reactionCode)
        : await chatService.removeReaction(messageId);
      get().updateMessage(serverMessage);
    } catch (error) {
      get().updateMessage(previousMessage);
      throw error;
    }
  },

  pinMessage: async (conversationId, messageId) => {
    try {
      await chatService.pinMessage(conversationId, messageId);
      // We'll re-fetch the conversation to get updated pinned list
      await get().fetchConversationById(conversationId);
    } catch (error) {
      console.error("Error pinning message:", error);
      throw error;
    }
  },

  unpinMessage: async (conversationId, messageId) => {
    try {
      await chatService.unpinMessage(conversationId, messageId);
      await get().fetchConversationById(conversationId);
    } catch (error) {
      console.error("Error unpinning message:", error);
      throw error;
    }
  },

  fetchConversationById: async (conversationId) => {
    try {
      const conversation =
        await chatService.fetchConversationById(conversationId);
      const user = useAuthStore.getState().user;

      const myParticipant = conversation.participants?.find(
        (p) => p.userId === user?.id,
      );
      const updatedConvo = {
        ...conversation,
        unreadCount:
          conversation.unreadCount ?? (myParticipant?.unreadCounts || 0),
      };

      set((state) => {
        const exists = state.conversations.some((c) => c.id === conversationId);
        if (exists) {
          return {
            conversations: state.conversations.map((c) =>
              c.id === conversationId ? updatedConvo : c,
            ),
          };
        } else {
          return {
            conversations: [updatedConvo, ...state.conversations],
          };
        }
      });
    } catch (error) {
      console.error("Error fetching conversation by id:", error);
    }
  },

  createReminder: async (request: ReminderRequest) => {
    try {
      const { activeConversationId } = get();
      const targetConvoId = request.conversationId || activeConversationId;
      if (!targetConvoId) return;

      await chatService.createReminder({
        ...request,
        conversationId: targetConvoId,
      });

      // The socket will eventually broadcast the new message,
      // but we can optimistic add it or wait.
      // ReminderService.createReminder sends a WS to /reminders topic.
      // But it also saves a Message.
      // Let's rely on the Message broadcast from backend if any.
      // Actually ReminderService doesn't seem to broadcast to /topic/conversation/{id}.
      // It only sends to /reminders.
      // I should probably manually fetch messages or wait for the Message response.

      // Update: I'll manually add the reminder message if it's returned as a ReminderResponse
      // but wait, createReminder returns ReminderResponse which has the messageId.
      // I'll fetch the messages again to be sure.
      await get().fetchMessages(targetConvoId);
    } catch (error) {
      console.error("Error creating reminder:", error);
      throw error;
    }
  },

  deleteReminder: async (messageId: string) => {
    try {
      const { activeConversationId } = get();
      if (!activeConversationId) return;

      await chatService.deleteReminder(messageId);

      // Update local state by removing the message
      set((state) => {
        const prevItems = state.messages[activeConversationId]?.items ?? [];
        return {
          messages: {
            ...state.messages,
            [activeConversationId]: {
              ...state.messages[activeConversationId],
              items: prevItems.filter((m) => m.id !== messageId),
            },
          },
        };
      });
    } catch (error) {
      console.error("Error deleting reminder:", error);
      throw error;
    }
  },
}));
