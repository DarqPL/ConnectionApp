import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Alert, AppState, type AppStateStatus } from "react-native";
import type { Attachment, Message, Conversation } from "../types";
import { chatService } from "../services/chat.service";
import { chatSocketService } from "../services/socket.service";
import type { TypingPayload } from "../services/socket.service";
import { useAuth } from "../../auth/context/AuthContext";
import { authService } from "../../auth/services/auth.service";

interface TypingPresence {
  userId: number;
  displayName: string;
  conversationId: number;
}

interface ChatContextType {
  conversations: Conversation[];
  currentMessages: Message[];
  currentConversationId: number | null;
  isLoading: boolean;
  error: string | null;
  typingUsers: TypingPresence[];
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: number) => Promise<void>;
  sendMessage: (
    conversationId: number,
    content: string,
    files?: PendingAttachment[],
    parentId?: string | null,
    poll?: any,
  ) => Promise<void>;
  updateMessage: (updatedMsg: Message) => void;
  recallMessage: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  pinMessage: (conversationId: number, messageId: string) => Promise<void>;
  unpinMessage: (conversationId: number, messageId: string) => Promise<void>;
  removeMemberFromGroup: (
    conversationId: number,
    memberId: number,
  ) => Promise<void>;
  setCurrentConversation: (
    conversationId: number | null,
    sourceConversationId?: number,
  ) => void;
  notifyTyping: (conversationId: number) => void;
  notifyStoppedTyping: (conversationId: number) => void;
  reactMessage: (
    conversationId: number,
    messageId: string,
    reactionCode: string | null,
  ) => Promise<void>;
  leaveGroup: (conversationId: number, userId: number) => Promise<void>;
  addMemberToGroup: (conversationId: number, memberId: number) => Promise<void>;
  updateMemberRole: (
    conversationId: number,
    memberId: number,
    role: string,
  ) => Promise<void>;
  renameGroup: (conversationId: number, newName: string) => Promise<void>;
  updateGroupAvatar: (conversationId: number, avatarUrl: string) => Promise<void>;
  uploadGroupAvatarFile: (
    conversationId: number,
    file: { uri: string; name: string; type: string },
  ) => Promise<void>;
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
  const [typingUsers, setTypingUsers] = useState<TypingPresence[]>([]);
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );

  // Ref so socket handlers always access latest state without reconnecting
  const currentConversationRef = useRef<number | null>(null);
  const userIdRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const messageFetchVersionRef = useRef(0);
  const typingTimeoutRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  useEffect(() => {
    currentConversationRef.current = currentConversationId;
  }, [currentConversationId]);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

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

      // Merge server data with current realtime state:
      // Prefer the realtime values (unreadCount, lastMessageContent, lastMessageAt)
      // that WebSocket has already updated, as they are more up-to-date.
      setConversations((prev) => {
        const merged = data.map((serverConvo) => {
          const existing = prev.find((c) => c.id === serverConvo.id);
          if (!existing) return serverConvo;

          const serverTime = serverConvo.lastMessageAt
            ? new Date(serverConvo.lastMessageAt).getTime()
            : 0;
          const existingTime = existing.lastMessageAt
            ? new Date(existing.lastMessageAt).getTime()
            : 0;

          // If realtime state is newer, keep realtime values
          if (existingTime > serverTime) {
            return {
              ...serverConvo,
              lastMessageContent: existing.lastMessageContent,
              lastMessageAt: existing.lastMessageAt,
              unreadCount: Math.max(
                existing.unreadCount,
                serverConvo.unreadCount,
              ),
            };
          }
          return {
            ...serverConvo,
            unreadCount: Math.max(
              existing.unreadCount,
              serverConvo.unreadCount,
            ),
          };
        });

        return sortConversations(merged);
      });
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

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      setAppState(nextState);

      const resumedFromBackground =
        /inactive|background/.test(previousState) && nextState === "active";

      if (resumedFromBackground && isAuthenticated && user?.id && accessToken) {
        // App resumed: clear stale socket error and refresh list once.
        setError(null);
        fetchConversations().catch(() => {
          // Best effort refresh; keep existing realtime state if request fails.
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [accessToken, fetchConversations, isAuthenticated, user?.id]);

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

  // NEW: Handle user typing notification
  const onUserTyping = useCallback((data: TypingPayload) => {
    const activeConversationId = currentConversationRef.current;
    if (!activeConversationId || data.conversationId !== activeConversationId) {
      return;
    }

    if (!data.userId || data.userId === userIdRef.current) {
      return;
    }

    console.log("[ChatContext] User typing:", data.userId);

    const displayName =
      (data.displayName ?? "Nguoi dung").trim() || "Nguoi dung";

    setTypingUsers((prev) => {
      const index = prev.findIndex((item) => item.userId === data.userId);
      const nextPresence: TypingPresence = {
        userId: data.userId,
        displayName,
        conversationId: data.conversationId,
      };

      if (index === -1) {
        return [...prev, nextPresence];
      }

      const next = [...prev];
      next[index] = nextPresence;
      return next;
    });

    const timeoutKey = `${data.conversationId}:${data.userId}`;
    if (typingTimeoutRef.current[timeoutKey]) {
      clearTimeout(typingTimeoutRef.current[timeoutKey]);
    }

    typingTimeoutRef.current[timeoutKey] = setTimeout(() => {
      setTypingUsers((prev) =>
        prev.filter(
          (item) =>
            !(
              item.conversationId === data.conversationId &&
              item.userId === data.userId
            ),
        ),
      );
      delete typingTimeoutRef.current[timeoutKey];
    }, 3000);
  }, []);

  // NEW: Handle user stopped typing notification
  const onUserStoppedTyping = useCallback((data: TypingPayload) => {
    if (!data.conversationId || !data.userId) {
      return;
    }

    console.log("[ChatContext] User stopped typing:", data.userId);
    const timeoutKey = `${data.conversationId}:${data.userId}`;
    if (typingTimeoutRef.current[timeoutKey]) {
      clearTimeout(typingTimeoutRef.current[timeoutKey]);
      delete typingTimeoutRef.current[timeoutKey];
    }

    setTypingUsers((prev) =>
      prev.filter(
        (item) =>
          !(
            item.conversationId === data.conversationId &&
            item.userId === data.userId
          ),
      ),
    );
  }, []);

  const onConversationUpdate = useCallback((data: any) => {
    // data is MessageUpdateResponse: { type: string, payload: any }
    // or sometimes fields are at the root (e.g. for CONVERSATION_UPDATED)
    const type = data.type;
    const payload = data.payload || data; // fallback to root if payload is missing

    if (!payload || (!payload.conversationId && !payload.id)) {
      console.log("[ChatContext] Invalid conversation update:", data);
      return;
    }
    
    const conversationId = payload.conversationId || payload.id;
    console.log(`[ChatContext] Update event: ${type} for conv: ${conversationId}`);

    if (type === "PIN_UPDATE") {
      chatService
        .getConversation(conversationId)
        .then((updatedConvo) => {
          setConversations((prev) =>
            prev.map((c) =>
              Number(c.id) === Number(updatedConvo.id) ? updatedConvo : c,
            ),
          );
        })
        .catch(console.error);
      return;
    }

    if (type === "MEMBER_JOINED" || type === "MEMBER_ADDED") {
      const addedParticipants = payload.participants;
      if (addedParticipants && Array.isArray(addedParticipants)) {
        setConversations((prev) =>
          prev.map((c) => {
            if (Number(c.id) === Number(conversationId)) {
              return {
                ...c,
                participants: addedParticipants,
              };
            }
            return c;
          }),
        );
      } else {
        const newParticipant = payload.newMember;
        setConversations((prev) =>
          prev.map((c) => {
            if (Number(c.id) === Number(conversationId)) {
              const participantToAdd = newParticipant || {
                userId: payload.joinedUserId,
                displayName: "Thành viên mới",
                role: "MEMBER",
              };

              const exists = c.participants.some(
                (p) => Number(p.userId) === Number(participantToAdd.userId),
              );
              if (exists) return c;

              return {
                ...c,
                participants: [...c.participants, participantToAdd],
              };
            }
            return c;
          }),
        );
      }
      return;
    }

    if (type === "MEMBER_LEFT") {
      const leftUserId = payload.leftUserId;

      // If current user left, remove from list
      if (Number(leftUserId) === Number(userIdRef.current)) {
        console.log("[ChatContext] Current user removed:", conversationId);
        setConversations((prev) =>
          prev.filter((c) => Number(c.id) !== Number(conversationId)),
        );
        if (Number(currentConversationRef.current) === Number(conversationId)) {
          setCurrentConversationId(null);
          setCurrentMessages([]);
        }
        return;
      }

      setConversations((prev) =>
        prev.map((c) => {
          if (Number(c.id) === Number(conversationId)) {
            return {
              ...c,
              participants: c.participants.filter(
                (p) => Number(p.userId) !== Number(leftUserId),
              ),
            };
          }
          return c;
        }),
      );
      return;
    }

    if (type === "CONVERSATION_UPDATED") {
      const updatedConvo = payload; // The payload IS the conversation object
      if (updatedConvo) {
        setConversations((prev) =>
          prev.map((c) =>
            Number(c.id) === Number(conversationId) 
              ? { ...c, ...updatedConvo, avatarUrl: updatedConvo.avatarUrl ? `${updatedConvo.avatarUrl}?t=${Date.now()}` : null } 
              : c
          )
        );
      }
      return;
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
      remainingMinutes?: number;
      lockUntil?: string;
    }) => {
      if (payload.type === "ACCOUNT_TEMP_LOCKED") {
        const message =
          payload.message ||
          (payload.remainingMinutes
            ? `Bạn bị khóa tài khoản ${payload.remainingMinutes} phút do vi phạm chính sách.`
            : "Bạn đã vi phạm chính sách của chúng tôi.");

        Alert.alert(payload.title || "Tài khoản bị khóa tạm thời", message);
        signOut().catch(() => {
          Alert.alert("Phiên đăng nhập đã hết hạn", "Vui lòng đăng nhập lại.");
        });
        return;
      }

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
    const isAppActive = appState === "active";

    if (!isAuthenticated || !user?.id || !accessToken) {
      chatSocketService.disconnect();
      return;
    }

    if (!isAppActive) {
      // Keep socket fully closed while app is backgrounded.
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
      onUserTyping,
      onUserStoppedTyping,
      onSecurityNotification,
      onConversationUpdate,
      onConnectionError: (socketError) => {
        if (appStateRef.current !== "active") {
          console.log("[ChatContext] Ignored socket error while app inactive.");
          return;
        }

        console.warn("[ChatContext] Socket error:", socketError);
        setError(socketError);
      },
    });

    return () => {
      chatSocketService.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAuthenticated,
    user?.id,
    accessToken,
    appState,
    onSecurityNotification,
    onConversationUpdate,
  ]);
  // ↑ intentionally excluding handler callbacks — they're stable (empty deps)
  //   and the socket service updates them via ref when needed

  // ─── Update handlers ref when callbacks change (shouldn't happen with empty deps) ───
  useEffect(() => {
    if (chatSocketService.isConnected) {
      chatSocketService.updateHandlers({
        onIncomingMessage,
        onIncomingConversation,
        onRecallMessage,
        onUserTyping,
        onUserStoppedTyping,
        onSecurityNotification,
        onConversationUpdate,
        onConnectionError: (socketError) => {
          if (appStateRef.current === "active") {
            setError(socketError);
          }
        },
      });
    }
  }, [
    onIncomingMessage,
    onIncomingConversation,
    onRecallMessage,
    onUserTyping,
    onUserStoppedTyping,
    onSecurityNotification,
    onConversationUpdate,
  ]);

  // ─── Regular methods ───────────────────────────────────────────────────────

  const fetchMessages = useCallback(
    async (conversationId: number) => {
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
          currentConversationId !== conversationId
        ) {
          return;
        }

        setError(
          err instanceof Error ? err.message : "Không tải được tin nhắn",
        );
      } finally {
        if (
          fetchVersion === messageFetchVersionRef.current &&
          currentConversationRef.current === conversationId
        ) {
          setIsLoading(false);
        }
      }
    },
    [currentConversationId],
  );

  const updateMessage = useCallback((updatedMsg: Message) => {
    if (updatedMsg.conversationId === currentConversationRef.current) {
      setCurrentMessages((prev) => upsertMessage(prev, updatedMsg));
    }
  }, []);

  const pinMessage = useCallback(
    async (conversationId: number, messageId: string) => {
      setError(null);
      try {
        await chatService.pinMessage(conversationId, messageId);
        // Socket will handle update
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Ghim tin nhắn thất bại";
        setError(msg);
        throw err;
      }
    },
    [],
  );

  const unpinMessage = useCallback(
    async (conversationId: number, messageId: string) => {
      setError(null);
      try {
        await chatService.unpinMessage(conversationId, messageId);
        // Socket will handle update
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Bỏ ghim tin nhắn thất bại";
        setError(msg);
        throw err;
      }
    },
    [],
  );

  const removeMemberFromGroup = useCallback(
    async (conversationId: number, memberId: number) => {
      setError(null);
      try {
        console.log(
          `[ChatContext] Calling API to remove member ${memberId} from ${conversationId}`,
        );
        await chatService.removeMemberFromGroup(conversationId, memberId);
        console.log(`[ChatContext] API Success! Updating local state...`);

        // Update the conversation participants in the official state
        setConversations((prev) => {
          const next = prev.map((c) => {
            if (Number(c.id) === Number(conversationId)) {
              const newList = c.participants.filter(
                (p) => Number(p.userId) !== Number(memberId),
              );
              console.log(
                `[ChatContext] Updating conv ${c.id}: participants count ${c.participants.length} -> ${newList.length}`,
              );
              return {
                ...c,
                participants: newList,
              };
            }
            return c;
          });
          return [...next]; // Force a new array reference
        });
      } catch (err) {
        console.error("[ChatContext] removeMemberFromGroup Error:", err);
        const msg =
          err instanceof Error ? err.message : "Xóa thành viên thất bại";
        setError(msg);
        throw err;
      }
    },
    [],
  );

  const renameGroup = useCallback(
    async (conversationId: number, newName: string) => {
      setError(null);
      try {
        await chatService.updateConversation(conversationId, newName);
        // Socket will handle update, but we can update local state immediately for better UX
        setConversations((prev) =>
          prev.map((c) =>
            Number(c.id) === Number(conversationId) ? { ...c, name: newName } : c,
          ),
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Đổi tên nhóm thất bại";
        setError(msg);
        throw err;
      }
    },
    [],
  );

  const updateGroupAvatar = useCallback(
    async (conversationId: number, avatarUrl: string) => {
      setError(null);
      try {
        const updated = await chatService.updateConversation(conversationId, undefined, avatarUrl);
        setConversations((prev) =>
          prev.map((c) =>
            Number(c.id) === Number(conversationId) ? { ...updated, avatarUrl: updated.avatarUrl ? `${updated.avatarUrl}?t=${Date.now()}` : null } : c,
          ),
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Cập nhật ảnh nhóm thất bại";
        setError(msg);
        throw err;
      }
    },
    [],
  );

  const uploadGroupAvatarFile = useCallback(
    async (conversationId: number, file: { uri: string; name: string; type: string }) => {
      setError(null);
      try {
        const updated = await chatService.updateConversationAvatar(conversationId, file);
        setConversations((prev) =>
          prev.map((c) =>
            Number(c.id) === Number(conversationId) 
              ? { ...updated, avatarUrl: updated.avatarUrl ? `${updated.avatarUrl}?t=${Date.now()}` : null } 
              : c,
          ),
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Tải ảnh nhóm thất bại";
        setError(msg);
        throw err;
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (
      conversationId: number,
      content: string,
      files: PendingAttachment[] = [],
      parentId?: string | null,
      poll?: any,
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
          parentId,
          attachments,
          poll,
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

  const recallMessage = useCallback(async (messageId: string) => {
    setError(null);
    try {
      const updatedMsg = await chatService.recallMessage(messageId);
      setCurrentMessages((prev) =>
        prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)),
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Thu hồi tin nhắn thất bại";
      setError(msg);
      throw err;
    }
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    setError(null);
    try {
      await chatService.deleteMessage(messageId);
      setCurrentMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Xóa tin nhắn thất bại";
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
      Object.values(typingTimeoutRef.current).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      typingTimeoutRef.current = {};
      currentConversationRef.current = conversationId;
      setCurrentConversationId(conversationId);
      setCurrentMessages([]);
      setTypingUsers([]);
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

  // NEW: Notify socket that user is typing
  const notifyTyping = useCallback((conversationId: number) => {
    if (chatSocketService.isConnected) {
      chatSocketService.notifyTyping(conversationId);
    }
  }, []);

  // NEW: Notify socket that user stopped typing
  const notifyStoppedTyping = useCallback((conversationId: number) => {
    if (chatSocketService.isConnected) {
      chatSocketService.notifyStoppedTyping(conversationId);
    }
  }, []);

  const reactMessage = useCallback(
    async (
      conversationId: number,
      messageId: string,
      reactionCode: string | null,
    ) => {
      if (!user) {
        throw new Error("Vui long dang nhap lai");
      }

      const previousMessage =
        currentMessages.find((message) => message.id === messageId) ?? null;

      if (!previousMessage) {
        return;
      }

      const optimistic = applyReactionForUser(
        previousMessage,
        user.id,
        reactionCode,
      );
      setCurrentMessages((prev) => upsertMessage(prev, optimistic));

      try {
        const serverMessage = reactionCode
          ? await chatService.reactMessage(messageId, reactionCode)
          : await chatService.removeReaction(messageId);
        setCurrentMessages((prev) => upsertMessage(prev, serverMessage));
      } catch (err) {
        setCurrentMessages((prev) => upsertMessage(prev, previousMessage));
        const msg = err instanceof Error ? err.message : "Tha cam xuc that bai";
        setError(msg);
        throw err;
      }
    },
    [currentMessages, user],
  );

  const leaveGroup = useCallback(
    async (conversationId: number, userId: number) => {
      try {
        await chatService.leaveGroup(conversationId, userId);
        // Remove from conversations list
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        // Clear current conversation if it's the one we're leaving
        if (currentConversationRef.current === conversationId) {
          setCurrentConversationId(null);
          setCurrentMessages([]);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Không thể rời khỏi nhóm";
        setError(msg);
        throw err;
      }
    },
    [],
  );

  const addMemberToGroup = useCallback(
    async (conversationId: number, memberId: number) => {
      try {
        await chatService.addMemberToGroup(conversationId, memberId);

        // Refresh conversation to get latest participants list
        const updatedConvo = await chatService.getConversation(conversationId);
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? updatedConvo : c)),
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Không thể thêm thành viên";
        setError(msg);
        throw err;
      }
    },
    [],
  );

  const updateMemberRole = useCallback(
    async (conversationId: number, memberId: number, role: string) => {
      try {
        await chatService.updateMemberRole(conversationId, memberId, role);

        // Update local state with new role
        setConversations((prevConversations) =>
          prevConversations.map((conv) => {
            if (conv.id === conversationId) {
              return {
                ...conv,
                participants: conv.participants.map((p) =>
                  p.userId === memberId ? { ...p, role } : p,
                ),
              };
            }
            return conv;
          }),
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Không thể cập nhật quyền";
        setError(msg);
        throw err;
      }
    },
    [],
  );

  const value: ChatContextType = {
    conversations,
    currentMessages,
    currentConversationId,
    isLoading,
    error,
    typingUsers,
    fetchConversations,
    fetchMessages,
    sendMessage,
    updateMessage,
    recallMessage,
    deleteMessage,
    pinMessage,
    unpinMessage,
    removeMemberFromGroup,
    setCurrentConversation,
    notifyTyping,
    notifyStoppedTyping,
    reactMessage,
    leaveGroup,
    addMemberToGroup,
    updateMemberRole,
    renameGroup,
    updateGroupAvatar,
    uploadGroupAvatarFile,
    clearError,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within ChatProvider");
  return context;
};
