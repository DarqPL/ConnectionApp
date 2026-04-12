import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Alert } from "react-native";
import type { Attachment, Message, Conversation } from "../types";
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
  sendMessage: (
    conversationId: number,
    content: string,
    files?: PendingAttachment[],
  ) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  setCurrentConversation: (
    conversationId: number | null,
    sourceConversationId?: number,
  ) => void;
  clearError: () => void;
}

export interface PendingAttachment {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, accessToken, isAuthenticated, signOut } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    number | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref so socket handlers always access latest state without reconnecting
  const currentConversationRef = useRef<number | null>(null);
  const userIdRef = useRef<number | null>(null);
  const messageFetchVersionRef = useRef(0);

  useEffect(() => {
    currentConversationRef.current = currentConversationId;
  }, [currentConversationId]);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  const sortConversations = (items: Conversation[]): Conversation[] =>
    [...items].sort((a, b) => {
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });

  const upsertMessage = (messages: Message[], incoming: Message): Message[] => {
    const index = messages.findIndex((item) => item.id === incoming.id);
    if (index === -1) return [...messages, incoming];
    const next = [...messages];
    next[index] = incoming;
    return next;
  };

  const buildMessagePreview = (
    content: string | null | undefined,
    attachments: Attachment[] | undefined,
  ): string => {
    const normalized = (content ?? "").trim();
    if (normalized) {
      return normalized;
    }

    const total = attachments?.length ?? 0;
    if (total === 1) {
      return "Da gui 1 tep dinh kem";
    }
    if (total > 1) {
      return `Da gui ${total} tep dinh kem`;
    }
    return "";
  };

  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await chatService.getConversations();
      setConversations(sortConversations(data));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không tải được danh sách cuộc trò chuyện",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─── Socket handlers (stable functions, state accessed via refs/setters) ───

  const onIncomingMessage = useCallback((incomingMessage: Message) => {
    console.log(
      "[ChatContext] Incoming message:",
      incomingMessage.id,
      "convId:",
      incomingMessage.conversationId,
    );

    // 1. Add to current chat room if it's open
    if (incomingMessage.conversationId === currentConversationRef.current) {
      setCurrentMessages((prev) => upsertMessage(prev, incomingMessage));
    }

    // 2. Update conversation list
    setConversations((prev) => {
      const index = prev.findIndex(
        (c) => c.id === incomingMessage.conversationId,
      );

      if (index === -1) {
        // Conversation not in list yet → refetch (new conv or first message)
        console.log("[ChatContext] Unknown conversation, refetching list...");
        chatService
          .getConversations()
          .then((data) => setConversations(sortConversations(data)))
          .catch(console.error);
        return prev;
      }

      const next = [...prev];
      const isOpen =
        currentConversationRef.current === incomingMessage.conversationId;
      const isOwn = incomingMessage.senderInfo?.senderId === userIdRef.current;

      next[index] = {
        ...next[index],
        lastMessageContent: buildMessagePreview(
          incomingMessage.content,
          incomingMessage.attachments,
        ),
        lastMessageAt: incomingMessage.createdAt,
        unreadCount: isOpen || isOwn ? 0 : (next[index].unreadCount || 0) + 1,
      };

      // Move to top
      const updated = next.splice(index, 1)[0];
      return [updated, ...next];
    });
  }, []); // ← empty deps: state is accessed via refs/functional setters

  const onIncomingConversation = useCallback((newConvo: Conversation) => {
    console.log("[ChatContext] New conversation:", newConvo.id);
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === newConvo.id);
      if (index === -1) return sortConversations([newConvo, ...prev]);
      const next = [...prev];
      next[index] = newConvo;
      return sortConversations(next);
    });
  }, []);

  const onRecallMessage = useCallback((recalledMessage: Message) => {
    console.log("[ChatContext] Recalled message:", recalledMessage.id);
    if (recalledMessage.conversationId === currentConversationRef.current) {
      setCurrentMessages((prev) =>
        prev.map((m) => (m.id === recalledMessage.id ? recalledMessage : m)),
      );
    }
  }, []);

  const onSecurityNotification = useCallback(
    (payload: {
      type?: string;
      title?: string;
      message: string;
      targetPlatform?: string;
      reason?: string;
      deviceName?: string;
      ipAddress?: string;
    }) => {
      if (
        payload.type === "SESSION_REVOKED_NEW_LOGIN" &&
        payload.targetPlatform === "MOBILE"
      ) {
        Alert.alert(
          payload.title || "Phiên đăng nhập đã kết thúc",
          payload.message,
        );
        signOut().catch(() => {
          // Fallback UX if network fails while trying to logout.
          Alert.alert("Phiên đăng nhập đã hết hạn", "Vui lòng đăng nhập lại.");
        });
        return;
      }

      Alert.alert(payload.title || "Cảnh báo bảo mật", payload.message);
    },
    [signOut],
  );

  // ─── Single socket connect effect — only depends on userId/token ───
  useEffect(() => {
    if (!isAuthenticated || !user?.id || !accessToken) {
      chatSocketService.disconnect();
      return;
    }

    const wsUrl = authService.getWebSocketUrl();
    console.log(
      "[ChatContext] Connecting socket, userId:",
      user.id,
      "url:",
      wsUrl,
    );

    chatSocketService.connect(wsUrl, user.id, accessToken, {
      onIncomingMessage,
      onIncomingConversation,
      onRecallMessage,
      onSecurityNotification,
      onConnectionError: (socketError) => {
        console.error("[ChatContext] Socket error:", socketError);
        setError(socketError);
      },
    });

    return () => {
      chatSocketService.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, accessToken, onSecurityNotification]);
  // ↑ intentionally excluding handler callbacks — they're stable (empty deps)
  //   and the socket service updates them via ref when needed

  // ─── Update handlers ref when callbacks change (shouldn't happen with empty deps) ───
  useEffect(() => {
    if (chatSocketService.isConnected) {
      chatSocketService.updateHandlers({
        onIncomingMessage,
        onIncomingConversation,
        onRecallMessage,
        onSecurityNotification,
        onConnectionError: setError,
      });
    }
  }, [
    onIncomingMessage,
    onIncomingConversation,
    onRecallMessage,
    onSecurityNotification,
  ]);

  // ─── Regular methods ───────────────────────────────────────────────────────

  const fetchMessages = useCallback(async (conversationId: number) => {
    const fetchVersion = ++messageFetchVersionRef.current;
    currentConversationRef.current = conversationId;
    setCurrentConversationId(conversationId);
    setIsLoading(true);
    setError(null);
    try {
      const data = await chatService.getMessages(conversationId);

      if (
        fetchVersion !== messageFetchVersionRef.current ||
        currentConversationRef.current !== conversationId
      ) {
        return;
      }

      setCurrentMessages(data);
      setCurrentConversationId(conversationId);
      // Mark as read
      chatService.markAsRead(conversationId).catch(() => {});
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c,
        ),
      );
    } catch (err) {
      if (
        fetchVersion !== messageFetchVersionRef.current ||
        currentConversationRef.current !== conversationId
      ) {
        return;
      }

      setError(err instanceof Error ? err.message : "Không tải được tin nhắn");
    } finally {
      if (
        fetchVersion === messageFetchVersionRef.current &&
        currentConversationRef.current === conversationId
      ) {
        setIsLoading(false);
      }
    }
  }, []);

  const sendMessage = useCallback(
    async (
      conversationId: number,
      content: string,
      files: PendingAttachment[] = [],
    ) => {
      setError(null);
      try {
        const attachments =
          files.length === 0
            ? []
            : await Promise.all(
                files.map((file) =>
                  chatService.uploadAttachment({
                    uri: file.uri,
                    name: file.name,
                    mimeType: file.mimeType,
                  }),
                ),
              );

        const normalizedContent = content.trim();
        const newMsg = await chatService.sendMessage(
          conversationId,
          normalizedContent,
          attachments,
        );
        const preview = buildMessagePreview(newMsg.content, newMsg.attachments);

        // Optimistically add to current messages
        setCurrentMessages((prev) => upsertMessage(prev, newMsg));
        // Update conversation list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  lastMessageContent: preview,
                  lastMessageAt: new Date().toISOString(),
                  unreadCount: 0,
                }
              : c,
          ),
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Gửi tin nhắn thất bại";
        setError(msg);
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
        prev.map((m) =>
          m.id === messageId
            ? { ...m, recalledAt: new Date().toISOString() }
            : m,
        ),
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Thu hồi tin nhắn thất bại";
      setError(msg);
      throw err;
    }
  }, []);

  const setCurrentConversation = useCallback(
    (conversationId: number | null, sourceConversationId?: number) => {
      if (
        conversationId === null &&
        sourceConversationId != null &&
        currentConversationRef.current !== sourceConversationId
      ) {
        return;
      }

      messageFetchVersionRef.current += 1;
      currentConversationRef.current = conversationId;
      setCurrentConversationId(conversationId);
      setCurrentMessages([]);
      setError(null);

      if (conversationId === null) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

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
    setCurrentConversation,
    clearError,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within ChatProvider");
  return context;
};
