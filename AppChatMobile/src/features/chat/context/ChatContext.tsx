import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Alert } from "react-native";
import type { Message, Conversation } from "../types";
import { chatService } from "../services/chat.service";
import { chatSocketService } from "../services/socket.service";
import { useAuth } from "../../auth/context/AuthContext";
import { authService } from "../../auth/services/auth.service";

interface ChatContextType {
  conversations: Conversation[];
  currentMessages: Message[];
  currentConversationId: number | null;
  isLoading: boolean;
  error: string | null;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: number) => Promise<void>;
  sendMessage: (conversationId: number, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  setCurrentConversation: (conversationId: number | null) => void;
  clearError: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, accessToken, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    number | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentConversationRef = useRef<number | null>(null);

  const sortConversations = (items: Conversation[]): Conversation[] =>
    [...items].sort((a, b) => {
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });

  const upsertMessage = (messages: Message[], incoming: Message): Message[] => {
    const index = messages.findIndex((item) => item.id === incoming.id);
    if (index === -1) {
      return [...messages, incoming];
    }

    const next = [...messages];
    next[index] = incoming;
    return next;
  };

  useEffect(() => {
    currentConversationRef.current = currentConversationId;
  }, [currentConversationId]);

  const handleIncomingMessage = useCallback(
    (incomingMessage: Message) => {
      setConversations((prev) => {
        const exists = prev.some(
          (conversation) => conversation.id === incomingMessage.conversationId,
        );
        if (!exists) return prev;

        return sortConversations(
          prev.map((conversation) => {
            if (conversation.id !== incomingMessage.conversationId)
              return conversation;

            const inActiveConversation =
              currentConversationRef.current === conversation.id;
            const isOwnMessage =
              incomingMessage.senderInfo?.senderId === user?.id;
            return {
              ...conversation,
              lastMessageContent: incomingMessage.content,
              lastMessageAt: incomingMessage.createdAt,
              unreadCount:
                inActiveConversation || isOwnMessage
                  ? 0
                  : Math.max((conversation.unreadCount || 0) + 1, 1),
            };
          }),
        );
      });

      if (incomingMessage.conversationId === currentConversationRef.current) {
        setCurrentMessages((prev) => upsertMessage(prev, incomingMessage));
      }
    },
    [user?.id],
  );

  useEffect(() => {
    if (!isAuthenticated) return;

    chatSocketService.syncConversationSubscriptions(
      conversations.map((conversation) => conversation.id),
      handleIncomingMessage,
    );
  }, [conversations, isAuthenticated, handleIncomingMessage]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !accessToken) {
      chatSocketService.disconnect();
      return;
    }

    chatSocketService.connect(
      authService.getWebSocketUrl(),
      user.id,
      accessToken,
      {
        onIncomingMessage: handleIncomingMessage,
        onIncomingConversation: (incomingConversation) => {
          setConversations((prev) => {
            const index = prev.findIndex(
              (conversation) => conversation.id === incomingConversation.id,
            );
            if (index === -1) {
              return sortConversations([incomingConversation, ...prev]);
            }

            const next = [...prev];
            next[index] = incomingConversation;
            return sortConversations(next);
          });
        },
        onRecallMessage: (recalledMessage) => {
          if (
            recalledMessage.conversationId === currentConversationRef.current
          ) {
            setCurrentMessages((prev) =>
              prev.map((message) =>
                message.id === recalledMessage.id ? recalledMessage : message,
              ),
            );
          }
        },
        onSecurityNotification: (payload) => {
          Alert.alert(
            payload.title || "Cảnh báo bảo mật",
            [
              payload.message,
              payload.deviceName,
              payload.ipAddress ? `IP: ${payload.ipAddress}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
          );
        },
        onConnectionError: (socketError) => {
          setError(socketError);
        },
      },
    );

    return () => {
      chatSocketService.disconnect();
    };
  }, [isAuthenticated, user?.id, accessToken]);

  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await chatService.getConversations();
      setConversations(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Không tải được danh sách cuộc trò chuyện";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (conversationId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await chatService.getMessages(conversationId);
      setCurrentMessages(data);
      setCurrentConversationId(conversationId);
      await chatService.markAsRead(conversationId);
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ),
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Không tải được tin nhắn";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (conversationId: number, content: string) => {
      setError(null);
      try {
        const newMessage = await chatService.sendMessage(
          conversationId,
          content,
        );
        setCurrentMessages((prev) => upsertMessage(prev, newMessage));

        // Update last message in conversation
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  lastMessageContent: content,
                  lastMessageAt: new Date().toISOString(),
                  unreadCount: 0,
                }
              : conv,
          ),
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Gửi tin nhắn thất bại";
        setError(errorMessage);
        throw err;
      }
    },
    [],
  );

  const deleteMessage = useCallback(async (messageId: string) => {
    setError(null);
    try {
      await chatService.deleteMessage(messageId);
      setCurrentMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, isDeleted: true } : msg,
        ),
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Thu hồi tin nhắn thất bại";
      setError(errorMessage);
      throw err;
    }
  }, []);

  const setCurrentConversationSafe = useCallback(
    (conversationId: number | null) => {
      setCurrentConversationId(conversationId);
    },
    [],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: ChatContextType = {
    conversations,
    currentMessages,
    currentConversationId,
    isLoading,
    error,
    fetchConversations,
    fetchMessages,
    sendMessage,
    deleteMessage,
    setCurrentConversation: setCurrentConversationSafe,
    clearError,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
};
