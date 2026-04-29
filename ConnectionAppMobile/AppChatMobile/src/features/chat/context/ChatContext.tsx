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
import { callService, type CallSession } from "../services/call.service";
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
  incomingCall: CallSession | null;
  activeCall: CallSession | null;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: number) => Promise<void>;
  sendMessage: (
    conversationId: number,
    content: string,
    files?: PendingAttachment[],
    parentId?: string | null,
    poll?: any,
  ) => Promise<void>;
  retrySendMessage: (
    conversationId: number,
    tempMessageId: string,
  ) => Promise<void>;
  updateMessage: (updatedMsg: Message) => void;
  recallMessage: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  deleteReminder: (messageId: string) => Promise<void>;
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
  joinGroupByInviteToken: (inviteToken: string) => Promise<Conversation>;
  updateMemberRole: (
    conversationId: number,
    memberId: number,
    role: string,
  ) => Promise<void>;
  startOutgoingCall: (
    conversationId: number,
    mediaType: "VOICE" | "VIDEO",
  ) => Promise<void>;
  acceptIncomingCall: (callId: number) => Promise<void>;
  rejectIncomingCall: (callId: number) => Promise<void>;
  endActiveCall: (callId: number, reason?: string) => Promise<void>;
  renameGroup: (conversationId: number, newName: string) => Promise<void>;
  updateGroupDescription: (
    conversationId: number,
    description: string,
  ) => Promise<void>;
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
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
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

  const normalizeContent = (content: string | null | undefined): string =>
    (content ?? "").trim();

  const buildAttachmentKey = (attachments: Attachment[] | undefined): string =>
    (attachments ?? [])
      .map((attachment) =>
        [
          attachment.type,
          attachment.originalFileName ?? attachment.fileUrl,
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
      if (item.senderInfo?.senderId !== incomingSenderId) {
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

  const isOptimisticServerMatch = (
    optimistic: Message,
    serverMessage: Message,
  ): boolean => {
    if (!optimistic.senderInfo?.senderId) {
      return false;
    }
    if (optimistic.senderInfo.senderId !== serverMessage.senderInfo?.senderId) {
      return false;
    }

    const optimisticContent = normalizeContent(optimistic.content);
    const serverContent = normalizeContent(serverMessage.content);
    if (optimisticContent !== serverContent) {
      return false;
    }

    const optimisticAttachmentsKey = buildAttachmentKey(optimistic.attachments);
    const serverAttachmentsKey = buildAttachmentKey(serverMessage.attachments);
    if (optimisticAttachmentsKey !== serverAttachmentsKey) {
      return false;
    }

    const optimisticParentId = optimistic.parentId ?? null;
    const serverParentId = serverMessage.parentId ?? null;
    if (optimisticParentId !== serverParentId) {
      return false;
    }

    const optimisticCreatedAt = new Date(optimistic.createdAt).getTime();
    const serverCreatedAt = new Date(serverMessage.createdAt).getTime();
    return Math.abs(optimisticCreatedAt - serverCreatedAt) <= 90_000;
  };

  const resolveAttachmentType = (
    file: PendingAttachment,
  ): Attachment["type"] => {
    const mime = (file.mimeType ?? "").toLowerCase();
    const name = (file.name ?? "").toLowerCase();

    if (
      mime.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)
    ) {
      return "IMAGE";
    }
    if (
      mime.startsWith("video/") ||
      /\.(mp4|webm|mov|m4v|ogv|mkv)$/.test(name)
    ) {
      return "VIDEO";
    }
    if (
      mime.startsWith("audio/") ||
      /\.(mp3|wav|m4a|aac|flac|ogg)$/.test(name)
    ) {
      return "AUDIO";
    }
    if (
      mime.includes("pdf") ||
      mime.includes("word") ||
      mime.includes("officedocument") ||
      mime.includes("text") ||
      /\.(pdf|docx?|xlsx?|pptx?|txt|rtf|csv)$/.test(name)
    ) {
      return "DOCUMENT";
    }
    return "FILE";
  };

  const isLocalAttachmentUrl = (url: string): boolean => {
    return (
      url.startsWith("file:") ||
      url.startsWith("content:") ||
      url.startsWith("asset:")
    );
  };

  const upsertConversation = useCallback((conversation: Conversation) => {
    setConversations((prev) =>
      sortConversations([
        conversation,
        ...prev.filter((item) => item.id !== conversation.id),
      ]),
    );
  }, []);

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
      setCurrentMessages((prev) => {
        const optimisticIndex = findOptimisticMatchIndex(
          prev,
          incomingMessage,
          userIdRef.current ?? undefined,
        );

        if (optimisticIndex !== -1) {
          const optimistic = prev[optimisticIndex];
          return prev.map((item, index) =>
            index === optimisticIndex
              ? {
                  ...incomingMessage,
                  status: "SENT",
                  tempId: optimistic.tempId ?? optimistic.id,
                }
              : item,
          );
        }

        return upsertMessage(prev, incomingMessage);
      });
    }

    // 2. Update conversation list
    setConversations((prev) => {
      const conversationMap = new Map(prev.map((c) => [c.id, c]));
      const existingConversation = conversationMap.get(
        incomingMessage.conversationId,
      );

      if (!existingConversation) {
        return prev;
      }

      const isOpen =
        currentConversationRef.current === incomingMessage.conversationId;
      const isOwn = incomingMessage.senderInfo?.senderId === userIdRef.current;

      const updatedConversation: Conversation = {
        ...existingConversation,
        lastMessageContent: buildMessagePreview(
          incomingMessage.content,
          incomingMessage.attachments,
        ),
        lastMessageAt: incomingMessage.createdAt,
        unreadCount:
          isOpen || isOwn ? 0 : (existingConversation.unreadCount || 0) + 1,
      };

      conversationMap.set(incomingMessage.conversationId, updatedConversation);

      return [
        updatedConversation,
        ...prev.filter((c) => c.id !== incomingMessage.conversationId),
      ];
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
    const type = data.type;
    // Backend events are inconsistent: some send fields in payload,
    // some send fields directly at root.
    const payload = data.payload || data;
    const conversationId = payload?.conversationId || payload?.id;

    if (!conversationId) {
      console.log("[ChatContext] Invalid conversation update:", data);
      return;
    }

    console.log(
      `[ChatContext] Update event: ${type} for conv: ${conversationId}`,
    );

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
      const updatedConvo = payload.updatedConversation;
      if (updatedConvo) {
        setConversations((prev) =>
          prev.map((c) =>
            Number(c.id) === Number(conversationId)
              ? { ...c, ...updatedConvo }
              : c,
          ),
        );
      }
      return;
    }
  }, []);

  const onCallInvite = useCallback((payload: any) => {
    if (!payload?.callId) {
      return;
    }

    setIncomingCall(payload as CallSession);

    if (payload?.conversationId === currentConversationRef.current) {
      return;
    }

    const callerName = payload?.participants?.find(
      (participant: any) => participant?.userId === payload?.initiatedBy,
    )?.displayName;

    Alert.alert(
      "Cuoc goi den",
      callerName
        ? `${callerName} dang goi ${payload?.mediaType === "VIDEO" ? "video" : "thoai"}`
        : "Ban co cuoc goi moi",
    );
  }, []);

  const onCallStatusUpdate = useCallback((payload: any) => {
    if (!payload?.status || !payload?.callId) {
      return;
    }

    const session = payload as CallSession;

    if (payload.status === "RINGING") {
      const isIncoming = payload?.initiatedBy !== userIdRef.current;
      if (isIncoming) {
        setIncomingCall(session);
      } else {
        setActiveCall((prev) => ({
          ...session,
          token:
            session.token ??
            (prev?.callId === session.callId ? prev.token : null),
        }));
      }
      return;
    }

    if (payload.status === "ONGOING") {
      setActiveCall((prev) => ({
        ...session,
        token:
          session.token ??
          (prev?.callId === session.callId ? prev.token : null),
      }));
      setIncomingCall((prev) =>
        prev?.callId === session.callId ? null : prev,
      );
      return;
    }

    if (
      payload.status === "ENDED" ||
      payload.status === "MISSED" ||
      payload.status === "CANCELLED"
    ) {
      setActiveCall((prev) => (prev?.callId === session.callId ? null : prev));
      setIncomingCall((prev) =>
        prev?.callId === session.callId ? null : prev,
      );

      if (payload?.conversationId === currentConversationRef.current) {
        Alert.alert("Cuoc goi", "Cuoc goi da ket thuc");
      }
    }
  }, []);

  const onReminderDeleted = useCallback((messageId: string) => {
    console.log("[ChatContext] Reminder deleted:", messageId);
    setCurrentMessages((prev) => {
      // Find the message to be deleted to see if it belongs to a group
      const target = prev.find((m) => m.id === messageId);
      const groupId = target?.reminder?.reminderGroupId;

      if (groupId) {
        // Remove ALL messages sharing this reminderGroupId
        return prev.filter(
          (m) => m.id !== messageId && m.reminder?.reminderGroupId !== groupId,
        );
      }

      // Fallback: just remove the single message
      return prev.filter((m) => m.id !== messageId);
    });
  }, []);

  const onReminderTriggered = useCallback((payload: any) => {
    console.log("[ChatContext] Reminder triggered:", payload);
    Alert.alert(
      "ĐẾN GIỜ: " + payload.title,
      payload.content || "Bạn có một lịch hẹn ngay bây giờ!",
    );
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
      onCallInvite,
      onCallStatusUpdate,
      onUserTyping,
      onUserStoppedTyping,
      onSecurityNotification,
      onConversationUpdate,
      onReminderDeleted,
      onReminderTriggered,
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
    onCallInvite,
    onCallStatusUpdate,
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
        onCallInvite,
        onCallStatusUpdate,
        onUserTyping,
        onUserStoppedTyping,
        onSecurityNotification,
        onConversationUpdate,
        onReminderDeleted,
        onReminderTriggered,
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
    onCallInvite,
    onCallStatusUpdate,
    onUserTyping,
    onUserStoppedTyping,
    onSecurityNotification,
    onConversationUpdate,
    onReminderDeleted,
    onReminderTriggered,
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

        setCurrentMessages((prev) => {
          const pending = prev.filter(
            (message) =>
              message.status === "SENDING" ||
              message.status === "ERROR" ||
              Boolean(message.tempId),
          );

          const serverIds = new Set(data.map((message) => message.id));
          const merged = [...data];

          pending.forEach((message) => {
            if (serverIds.has(message.id)) {
              return;
            }

            const hasMatch = data.some((serverMessage) =>
              isOptimisticServerMatch(message, serverMessage),
            );

            if (!hasMatch) {
              merged.push(message);
            }
          });

          return merged.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        });
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
        await chatService.updateConversation(conversationId, { name: newName });
        // Socket will handle update, but we can update local state immediately for better UX
        setConversations((prev) =>
          prev.map((c) =>
            Number(c.id) === Number(conversationId)
              ? { ...c, name: newName }
              : c,
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

  const updateGroupDescription = useCallback(
    async (conversationId: number, description: string) => {
      setError(null);
      try {
        await chatService.updateConversation(conversationId, {
          description: description.trim() || null,
        });
        setConversations((prev) =>
          prev.map((c) =>
            Number(c.id) === Number(conversationId)
              ? { ...c, description: description.trim() || null }
              : c,
          ),
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Cập nhật mô tả nhóm thất bại";
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
      const tempId = `temp_${Date.now()}`;
      const normalizedContent = content.trim();
      const localAttachments: Attachment[] = files.map((file) => ({
        fileUrl: file.uri,
        type: resolveAttachmentType(file),
        originalFileName: file.name,
      }));

      const tempMessage: Message = {
        id: tempId,
        tempId,
        conversationId,
        senderInfo: {
          senderId: user?.id ?? 0,
          displayName: user?.displayName || user?.username || "You",
          avatarUrl: user?.avatarUrl ?? null,
        },
        content: normalizedContent,
        attachments: localAttachments,
        createdAt: new Date().toISOString(),
        updatedAt: null,
        parentId: parentId ?? null,
        isDeleted: false,
        recalledAt: null,
        replyInfo: null,
        poll: poll ?? null,
        reminder: null,
        reactions: [],
        status: "SENDING",
      };

      const tempPreview = buildMessagePreview(
        tempMessage.content,
        tempMessage.attachments,
      );

      setCurrentMessages((prev) => upsertMessage(prev, tempMessage));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                lastMessageContent: tempPreview,
                lastMessageAt: tempMessage.createdAt,
                unreadCount: 0,
              }
            : c,
        ),
      );
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

        if (attachments.length > 0) {
          setCurrentMessages((prev) =>
            prev.map((m) =>
              m.id === tempId || m.tempId === tempId
                ? { ...m, attachments }
                : m,
            ),
          );
        }

        const newMsg = await chatService.sendMessage(
          conversationId,
          normalizedContent,
          parentId,
          attachments,
          poll,
        );
        const messageWithStatus: Message = {
          ...newMsg,
          status: "SENT",
          tempId,
        };
        const preview = buildMessagePreview(newMsg.content, newMsg.attachments);

        setCurrentMessages((prev) => {
          const indexByTemp = prev.findIndex(
            (m) => m.id === tempId || m.tempId === tempId,
          );
          if (indexByTemp !== -1) {
            return prev.map((m) =>
              m.id === tempId || m.tempId === tempId ? messageWithStatus : m,
            );
          }

          const indexById = prev.findIndex((m) => m.id === newMsg.id);
          if (indexById !== -1) {
            return prev.map((m) =>
              m.id === newMsg.id ? messageWithStatus : m,
            );
          }

          return [...prev, messageWithStatus];
        });
        // Update conversation list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  lastMessageContent: preview,
                  lastMessageAt: newMsg.createdAt,
                  unreadCount: 0,
                }
              : c,
          ),
        );
      } catch (err) {
        setCurrentMessages((prev) =>
          prev.map((m) =>
            m.id === tempId || m.tempId === tempId
              ? { ...m, status: "ERROR" }
              : m,
          ),
        );
        const msg =
          err instanceof Error ? err.message : "Gửi tin nhắn thất bại";
        setError(msg);
        throw err;
      }
    },
    [user?.avatarUrl, user?.displayName, user?.id, user?.username],
  );

  const retrySendMessage = useCallback(
    async (conversationId: number, tempMessageId: string) => {
      setError(null);
      const target = currentMessages.find(
        (item) => item.id === tempMessageId || item.tempId === tempMessageId,
      );

      if (!target) {
        return;
      }

      const tempId = target.tempId ?? target.id;
      const content = target.content ?? "";
      const parentId = target.parentId ?? null;
      const poll = target.poll ?? null;
      const existingAttachments = target.attachments ?? [];
      const localAttachments = existingAttachments.filter((attachment) =>
        isLocalAttachmentUrl(attachment.fileUrl),
      );
      const remoteAttachments = existingAttachments.filter(
        (attachment) => !isLocalAttachmentUrl(attachment.fileUrl),
      );

      setCurrentMessages((prev) =>
        prev.map((m) =>
          m.id === tempId || m.tempId === tempId
            ? { ...m, status: "SENDING" }
            : m,
        ),
      );

      try {
        const uploadedAttachments =
          localAttachments.length === 0
            ? []
            : await Promise.all(
                localAttachments.map((attachment) =>
                  chatService.uploadAttachment({
                    uri: attachment.fileUrl,
                    name: attachment.originalFileName ?? "attachment",
                    mimeType: null,
                  }),
                ),
              );

        const attachmentsToSend = [
          ...remoteAttachments,
          ...uploadedAttachments,
        ];

        if (uploadedAttachments.length > 0) {
          setCurrentMessages((prev) =>
            prev.map((m) =>
              m.id === tempId || m.tempId === tempId
                ? { ...m, attachments: attachmentsToSend }
                : m,
            ),
          );
        }

        const newMsg = await chatService.sendMessage(
          conversationId,
          content.trim(),
          parentId,
          attachmentsToSend,
          poll,
        );

        const messageWithStatus: Message = {
          ...newMsg,
          status: "SENT",
          tempId,
        };
        const preview = buildMessagePreview(newMsg.content, newMsg.attachments);

        setCurrentMessages((prev) => {
          const indexByTemp = prev.findIndex(
            (m) => m.id === tempId || m.tempId === tempId,
          );
          if (indexByTemp !== -1) {
            return prev.map((m) =>
              m.id === tempId || m.tempId === tempId ? messageWithStatus : m,
            );
          }

          const indexById = prev.findIndex((m) => m.id === newMsg.id);
          if (indexById !== -1) {
            return prev.map((m) =>
              m.id === newMsg.id ? messageWithStatus : m,
            );
          }

          return [...prev, messageWithStatus];
        });

        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  lastMessageContent: preview,
                  lastMessageAt: newMsg.createdAt,
                  unreadCount: 0,
                }
              : c,
          ),
        );
      } catch (err) {
        setCurrentMessages((prev) =>
          prev.map((m) =>
            m.id === tempId || m.tempId === tempId
              ? { ...m, status: "ERROR" }
              : m,
          ),
        );

        const msg =
          err instanceof Error ? err.message : "Gửi tin nhắn thất bại";
        setError(msg);
        throw err;
      }
    },
    [currentMessages],
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

  const deleteReminder = useCallback(
    async (messageId: string) => {
      setError(null);
      try {
        // Optimistic delete: trigger the group deletion logic locally
        onReminderDeleted(messageId);
        await chatService.deleteReminder(messageId);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Xóa nhắc hẹn thất bại";
        setError(msg);
        // Optional: we could refetch messages here to restore the card if delete failed
        throw err;
      }
    },
    [onReminderDeleted],
  );

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

  const joinGroupByInviteToken = useCallback(
    async (inviteToken: string) => {
      try {
        const conversation =
          await chatService.joinGroupByInviteToken(inviteToken);
        upsertConversation(conversation);
        return conversation;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Khong the tham gia nhom";
        setError(msg);
        throw err;
      }
    },
    [upsertConversation],
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

  const uploadGroupAvatarFile = useCallback(
    async (
      conversationId: number,
      file: { uri: string; name: string; type: string },
    ) => {
      try {
        const updatedConversation = await chatService.updateConversationAvatar(
          conversationId,
          file,
        );
        upsertConversation({
          ...updatedConversation,
          avatarUrl: updatedConversation.avatarUrl
            ? `${updatedConversation.avatarUrl}?t=${Date.now()}`
            : null,
        });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Khong the cap nhat anh nhom";
        setError(msg);
        throw err;
      }
    },
    [upsertConversation],
  );

  const acceptIncomingCall = useCallback(async (callId: number) => {
    const session = await callService.acceptCall(callId);

    let token = session.token ?? null;
    if (!token) {
      try {
        token = await callService.issueToken(callId);
      } catch (tokenError) {
        console.warn("[ChatContext] Failed to issue call token", tokenError);
      }
    }

    setActiveCall({
      ...session,
      token,
    });
    setIncomingCall((prev) => (prev?.callId === callId ? null : prev));
  }, []);

  const startOutgoingCall = useCallback(
    async (conversationId: number, mediaType: "VOICE" | "VIDEO") => {
      const session = await callService.startCallSession(
        conversationId,
        mediaType,
      );

      let token = session.token ?? null;
      if (!token) {
        try {
          token = await callService.issueToken(session.callId);
        } catch (tokenError) {
          console.warn(
            "[ChatContext] Failed to issue outgoing call token",
            tokenError,
          );
        }
      }

      setActiveCall({
        ...session,
        token,
      });
      setIncomingCall(null);
    },
    [],
  );

  const rejectIncomingCall = useCallback(async (callId: number) => {
    await callService.rejectCall(callId);
    setIncomingCall((prev) => (prev?.callId === callId ? null : prev));
    setActiveCall((prev) => (prev?.callId === callId ? null : prev));
  }, []);

  const endActiveCall = useCallback(
    async (callId: number, reason = "ENDED_BY_USER") => {
      await callService.endCall(callId, reason);
      setActiveCall((prev) => (prev?.callId === callId ? null : prev));
      setIncomingCall((prev) => (prev?.callId === callId ? null : prev));
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
    incomingCall,
    activeCall,
    fetchConversations,
    fetchMessages,
    sendMessage,
    retrySendMessage,
    updateMessage,
    recallMessage,
    deleteMessage,
    deleteReminder,
    pinMessage,
    unpinMessage,
    removeMemberFromGroup,
    setCurrentConversation,
    notifyTyping,
    notifyStoppedTyping,
    reactMessage,
    leaveGroup,
    addMemberToGroup,
    joinGroupByInviteToken,
    updateMemberRole,
    startOutgoingCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endActiveCall,
    renameGroup,
    updateGroupDescription,
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
