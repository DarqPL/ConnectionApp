import React, { useEffect, useRef, useMemo } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Alert,
  Modal,
  Text,
  StatusBar,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  KeyboardAvoidingView,
  Platform,
  PermissionsAndroid,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MessageBubble from "../components/MessageBubble";
import ForwardMessageModal from "../components/ForwardMessageModal";
import ChatInput from "../components/ChatInput";
import ChatHeader from "../components/ChatHeader";
import GroupSidebar from "../components/GroupSidebar";
import PollCreatorModal from "../components/PollCreatorModal";
import VotePollModal from "../components/VotePollModal";
import ReminderCreatorModal from "../components/ReminderCreatorModal";
import { useChat, type PendingAttachment } from "../context/ChatContext";
import { useAuth } from "../../auth/context/AuthContext";
import { authService } from "../../auth/services/auth.service";
import { COLORS } from "../../../theme";
import type { Message, Poll, Participant } from "../types";
import { chatService } from "../services/chat.service";
import { callService, type CallMediaType } from "../services/call.service";
import { friendService, type BlockStatus } from "../services/friend.service";
import { loadZegoRoomModule } from "../services/zegoCallKit";

const getReadableErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  return "Unknown SDK error";
};

const getCallRoomPendingReason = ({
  hasToken,
  hasAppSign,
  hasModule,
  isPreparing,
}: {
  hasToken: boolean;
  hasAppSign: boolean;
  hasModule: boolean;
  isPreparing: boolean;
}): string => {
  if (isPreparing) {
    return "Dang chuan bi quyen va khoi tao phong goi...";
  }

  if (!hasToken) {
    return "Dang cho call token tu backend...";
  }

  if (!hasAppSign) {
    return "Thieu cau hinh ZEGO_APP_SIGN tren mobile.";
  }

  if (!hasModule) {
    return "Dang tai ZEGO room module...";
  }

  return "Dang khoi tao phong goi...";
};

const TypingDots = () => {
  const dotOpacities = React.useRef([
    new Animated.Value(0.35),
    new Animated.Value(0.35),
    new Animated.Value(0.35),
  ]).current;

  useEffect(() => {
    const loops = dotOpacities.map((opacity, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.35,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.delay(220),
        ]),
      ),
    );

    loops.forEach((loop) => loop.start());

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [dotOpacities]);

  return (
    <View style={styles.typingDots}>
      {dotOpacities.map((opacity, index) => (
        <Animated.View
          key={index}
          style={[
            styles.typingDot,
            {
              opacity,
              transform: [
                {
                  scale: opacity.interpolate({
                    inputRange: [0.35, 1],
                    outputRange: [0.85, 1.15],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

type ZegoCallModule = {
  ZegoUIKitPrebuiltCall: React.ComponentType<any>;
  ONE_ON_ONE_VIDEO_CALL_CONFIG?: Record<string, unknown>;
  ONE_ON_ONE_VOICE_CALL_CONFIG?: Record<string, unknown>;
  GROUP_VIDEO_CALL_CONFIG?: Record<string, unknown>;
  GROUP_VOICE_CALL_CONFIG?: Record<string, unknown>;
};

const getExpoEnv = (key: string): string => {
  const processValue = (globalThis as any)?.process?.env?.[key];
  if (typeof processValue === "string" && processValue.trim().length > 0) {
    return processValue.trim();
  }

  const extra = Constants.expoConfig?.extra as
    | Record<string, unknown>
    | undefined;
  const extraValue = extra?.[key] ?? extra?.[key.replace(/^EXPO_PUBLIC_/, "")];
  return typeof extraValue === "string" ? extraValue.trim() : "";
};

const isExpoGoRuntime = (): boolean => {
  const executionEnvironment = (Constants as any).executionEnvironment;
  const appOwnership = (Constants as any).appOwnership;
  return executionEnvironment === "storeClient" || appOwnership === "expo";
};

const isWebRuntime = (): boolean => Platform.OS === "web";

const ChatRoomScreen = ({ route }: any) => {
  const REACTION_OPTIONS = ["❤️", "👍", "😆", "😮", "😢", "😡"] as const;
  const insets = useSafeAreaInsets();
  const { conversationId, name, avatarUrl, type, participants } = route.params;
  const {
    currentMessages,
    typingUsers,
    isLoading,
    incomingCall,
    activeCall,
    fetchMessages,
    sendMessage,
    retrySendMessage,
    recallMessage,
    deleteMessage,
    reactMessage,
    pinMessage,
    unpinMessage,
    conversations,
    setCurrentConversation,
    leaveGroup,
    updateMemberRole,
    startOutgoingCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endActiveCall,
    removeMemberFromGroup,
    renameGroup,
    updateGroupDescription,
    uploadGroupAvatarFile,
  } = useChat();
  const { user, signOut } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const userInteractedRef = useRef(false);
  const initialAnchorDoneRef = useRef(false);
  const [sending, setSending] = React.useState(false);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);
  const [isListReady, setIsListReady] = React.useState(false);
  const [replyTo, setReplyTo] = React.useState<Message | null>(null);
  const [messageToForward, setMessageToForward] =
    React.useState<Message | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = React.useState<string | null>(
    null,
  );
  const highlightTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [blockStatus, setBlockStatus] = React.useState<BlockStatus>({
    blocked: false,
    blockedByMe: false,
    blockedByOther: false,
  });
  const [isBlockStatusLoading, setIsBlockStatusLoading] = React.useState(false);
  const [isGroupSidebarOpen, setIsGroupSidebarOpen] = React.useState(false);
  const [pollToVote, setPollToVote] = React.useState<Message | null>(null);
  const [isPollCreatorOpen, setIsPollCreatorOpen] = React.useState(false);
  const [isReminderCreatorOpen, setIsReminderCreatorOpen] =
    React.useState(false);
  const [reminderToEdit, setReminderToEdit] = React.useState<Message | null>(
    null,
  );
  const [pinnedMessages, setPinnedMessages] = React.useState<Message[]>([]);

  // Call setup state
  const [zegoCallModule, setZegoCallModule] =
    React.useState<ZegoCallModule | null>(null);
  const [callSetupError, setCallSetupError] = React.useState<string | null>(
    null,
  );
  const [isPreparingCallRoom, setIsPreparingCallRoom] = React.useState(false);
  const callEndGuardRef = useRef<number | null>(null);
  const zegoAppId = Number.parseInt(getExpoEnv("EXPO_PUBLIC_ZEGO_APP_ID"), 10);
  const zegoAppSign = getExpoEnv("EXPO_PUBLIC_ZEGO_APP_SIGN");
  const devRuntimeConnectionWarning =
    authService.getDevRuntimeConnectionWarning();
  const isGroupCall = type === "GROUP";

  const [actionSheetMessage, setActionSheetMessage] =
    React.useState<Message | null>(null);

  const currentConversation = conversations.find(
    (c) => Number(c.id) === Number(conversationId),
  );

  const incomingForConversation =
    incomingCall?.conversationId === conversationId ? incomingCall : null;
  const activeForConversation =
    activeCall?.conversationId === conversationId ? activeCall : null;

  const ensureCallPermissions = React.useCallback(
    async (mediaType: CallMediaType) => {
      if (Platform.OS !== "android") {
        return { ok: true as const };
      }

      const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
      if (mediaType === "VIDEO") {
        permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
      }

      try {
        const result = await PermissionsAndroid.requestMultiple(permissions);
        const deniedPermissions = permissions.filter(
          (permission) =>
            result[permission] !== PermissionsAndroid.RESULTS.GRANTED,
        );

        if (deniedPermissions.length === 0) {
          return { ok: true as const };
        }

        return {
          ok: false as const,
          error:
            mediaType === "VIDEO"
              ? "Can cap quyen camera va microphone de vao cuoc goi video."
              : "Can cap quyen microphone de vao cuoc goi thoai.",
        };
      } catch (error) {
        console.warn("[ChatRoom] Failed to request call permissions", error);
        return {
          ok: false as const,
          error: "Khong the xac nhan quyen camera/microphone tren thiet bi.",
        };
      }
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    if (!activeForConversation || isExpoGoRuntime() || isWebRuntime()) {
      setZegoCallModule(null);
      setCallSetupError(null);
      setIsPreparingCallRoom(false);
      return () => {
        mounted = false;
      };
    }

    setIsPreparingCallRoom(true);
    setCallSetupError(null);

    const prepareCallRoom = async () => {
      if (!activeForConversation.token?.token) {
        if (mounted) {
          setIsPreparingCallRoom(false);
        }
        return;
      }

      if (!zegoAppId || !zegoAppSign) {
        if (mounted) {
          setZegoCallModule(null);
          setCallSetupError("Thieu cau hinh ZEGO_APP_ID hoac ZEGO_APP_SIGN.");
          setIsPreparingCallRoom(false);
        }
        return;
      }

      if (activeForConversation.token.appId !== zegoAppId) {
        if (mounted) {
          setZegoCallModule(null);
          setCallSetupError(
            "ZEGO_APP_ID tren mobile khong khop appId backend dang cap token.",
          );
          setIsPreparingCallRoom(false);
        }
        return;
      }

      const permissionResult = await ensureCallPermissions(
        activeForConversation.mediaType,
      );
      if (!mounted) {
        return;
      }

      if (!permissionResult.ok) {
        setZegoCallModule(null);
        setCallSetupError(permissionResult.error);
        setIsPreparingCallRoom(false);
        return;
      }

      loadZegoRoomModule()
        .then((exportedModule) => {
          if (!mounted) {
            return;
          }

          if (!exportedModule?.ZegoUIKitPrebuiltCall) {
            setCallSetupError("SDK goi khong kha dung trong runtime hien tai");
            setIsPreparingCallRoom(false);
            return;
          }

          setCallSetupError(null);
          setZegoCallModule(exportedModule);
          setIsPreparingCallRoom(false);
        })
        .catch((error) => {
          if (!mounted) {
            return;
          }

          console.warn("[ChatRoom] Failed to load ZEGO call module", error);
          setZegoCallModule(null);
          setCallSetupError(
            `Khong the khoi tao ZEGO SDK. ${getReadableErrorMessage(error)}`,
          );
          setIsPreparingCallRoom(false);
        });
    };

    void prepareCallRoom();

    return () => {
      mounted = false;
    };
  }, [activeForConversation, ensureCallPermissions, zegoAppId, zegoAppSign]);

  const getBackendEndReason = (reason?: string) => {
    if (reason === "remoteHangUp") {
      return "ENDED_BY_REMOTE";
    }

    if (reason === "kickOut") {
      return "ENDED_BY_SYSTEM";
    }

    return "ENDED_BY_USER";
  };

  const finalizeCallEnd = async (callId: number, reason: string) => {
    if (callEndGuardRef.current === callId) {
      return;
    }

    callEndGuardRef.current = callId;
    try {
      await endActiveCall(callId, reason);
    } finally {
      if (callEndGuardRef.current === callId) {
        callEndGuardRef.current = null;
      }
    }
  };

  const currentParticipants = useMemo(() => {
    if (currentConversation && currentConversation.participants) {
      return currentConversation.participants;
    }
    return participants || [];
  }, [currentConversation, participants]);

  useEffect(() => {
    if (
      !currentConversation?.pinnedMessages ||
      currentConversation.pinnedMessages.length === 0
    ) {
      setPinnedMessages([]);
      return;
    }

    // pinnedMessages already contains full message objects from backend
    setPinnedMessages(currentConversation.pinnedMessages);
  }, [currentConversation?.pinnedMessages]);

  const activePollMessage = React.useMemo(() => {
    if (!pollToVote) return null;
    return currentMessages.find((m) => m.id === pollToVote.id) || pollToVote;
  }, [pollToVote, currentMessages]);

  const handleCreatePoll = async (pollData: any) => {
    try {
      await sendMessage(conversationId, "", [], null, pollData);
    } catch (error) {
      console.error("Create poll error", error);
      throw error;
    }
  };

  const handleVote = async (selectedOptionIds: string[]) => {
    if (!pollToVote) return;
    try {
      await chatService.votePoll(pollToVote.id, selectedOptionIds);
      // Socket will update the message
    } catch (error) {
      Alert.alert("Lỗi", "Không thể thực hiện bình chọn");
    }
  };

  const handleClosePoll = async () => {
    console.log(
      "[ChatRoom] handleClosePoll called. activePollMessage ID:",
      activePollMessage?.id,
    );
    if (!activePollMessage) return;

    try {
      console.log("[ChatRoom] Closing poll via service...");
      const res = await chatService.closePoll(activePollMessage.id);
      console.log("[ChatRoom] Close poll success:", res.id);
      setPollToVote(null);
    } catch (error) {
      console.error("[ChatRoom] Close poll failed:", error);
      Alert.alert("Lỗi", "Không thể kết thúc cuộc bình chọn");
    }
  };

  const showScrollThreshold = 120;
  const nearBottomThreshold = 24;

  // Filter messages based on allowNewMembersReadHistory setting
  const displayMessages = React.useMemo(() => {
    if (!currentConversation || currentConversation.allowNewMembersReadHistory !== false || !user) {
      return currentMessages;
    }

    const currentUserParticipant = currentParticipants?.find(
      (p: Participant) => p.userId === user.id
    );
    if (!currentUserParticipant) return currentMessages;

    const joinedAt = new Date(currentUserParticipant.joinedAt).getTime();
    return currentMessages.filter(
      (msg) => new Date(msg.createdAt).getTime() >= joinedAt
    );
  }, [currentMessages, currentConversation, currentParticipants, user]);
  const isGroup = isGroupCall;
  const isPrivateChat = !isGroup;
  const messageIndexMap = React.useMemo(
    () => new Map(displayMessages.map((message, index) => [message.id, index])),
    [displayMessages],
  );

  const peerUserId = React.useMemo(() => {
    if (!isPrivateChat || !user) {
      return null;
    }

    const peer = participants?.find((p: any) => p.userId !== user.id);
    return peer?.userId ?? null;
  }, [isPrivateChat, participants, user]);

  const isBlockedByMe = blockStatus.blockedByMe;
  const isBlockedByOther = blockStatus.blockedByOther;
  const isBlockedChat = isPrivateChat && (isBlockedByMe || isBlockedByOther);

  const typingLabel = React.useMemo(() => {
    if (typingUsers.length === 0) {
      return null;
    }

    const names = typingUsers
      .map((item) => item.displayName?.trim())
      .filter((name): name is string => Boolean(name));

    if (names.length === 0) {
      return "Người dùng đang nhập";
    }

    if (!isGroup) {
      return `${names[0]} đang nhập`;
    }

    if (names.length === 1) {
      return `${names[0]} đang nhập`;
    }

    if (names.length === 2) {
      return `${names[0]} và ${names[1]} đang nhập`;
    }

    return `${names[0]}, ${names[1]} và ${names.length - 2} người khác đang nhập`;
  }, [isGroup, typingUsers]);

  const refreshBlockStatus = React.useCallback(async () => {
    if (!isPrivateChat || !peerUserId) {
      setBlockStatus({
        blocked: false,
        blockedByMe: false,
        blockedByOther: false,
      });
      return;
    }

    setIsBlockStatusLoading(true);
    try {
      const next = await friendService.getBlockStatus(peerUserId);
      setBlockStatus(next);
    } catch (error) {
      console.error("[ChatRoom] Cannot fetch block status", error);
    } finally {
      setIsBlockStatusLoading(false);
    }
  }, [isPrivateChat, peerUserId]);

  const scrollToBottom = React.useCallback((animated = true) => {
    flatListRef.current?.scrollToEnd({ animated });
  }, []);

  const handleScrollToParent = React.useCallback(
    (parentId: string) => {
      const index = messageIndexMap.get(parentId);
      if (index === undefined) {
        return;
      }

      flatListRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.3,
      });

      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }

      setHighlightedMsgId(parentId);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedMsgId(null);
      }, 1500);
    },
    [messageIndexMap],
  );

  const handleScrollToIndexFailed = React.useCallback(
    (info: {
      index: number;
      highestMeasuredFrameIndex: number;
      averageItemLength: number;
    }) => {
      const fallbackOffset = Math.max(0, info.averageItemLength * info.index);
      flatListRef.current?.scrollToOffset({
        offset: fallbackOffset,
        animated: false,
      });

      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: info.index,
          animated: true,
          viewPosition: 0.3,
        });
      }, 120);
    },
    [],
  );

  useEffect(() => {
    userInteractedRef.current = false;
    initialAnchorDoneRef.current = false;
    setIsAtBottom(true);
    setShowScrollToBottom(false);
    setIsListReady(false);
    setReplyTo(null);
    setHighlightedMsgId(null);
    setIsGroupSidebarOpen(false);
    setBlockStatus({
      blocked: false,
      blockedByMe: false,
      blockedByOther: false,
    });
    setIsBlockStatusLoading(false);

    setCurrentConversation(conversationId);
    void fetchMessages(conversationId);

    return () => {
      setCurrentConversation(null, conversationId);
      setShowScrollToBottom(false);
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [conversationId, fetchMessages, setCurrentConversation]);

  useEffect(() => {
    if (!isLoading && displayMessages.length === 0) {
      setIsListReady(true);
    }
  }, [displayMessages.length, isLoading]);

  useEffect(() => {
    if (!isPrivateChat) {
      setBlockStatus({
        blocked: false,
        blockedByMe: false,
        blockedByOther: false,
      });
      return;
    }

    void refreshBlockStatus();
  }, [conversationId, isPrivateChat, refreshBlockStatus]);

  const handleListScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;

      const distanceFromBottom = Math.max(
        0,
        contentSize.height - layoutMeasurement.height - contentOffset.y,
      );
      const atBottom = distanceFromBottom <= nearBottomThreshold;

      setIsAtBottom(atBottom);
      setShowScrollToBottom(distanceFromBottom > showScrollThreshold);
    },
    [],
  );

  const handleContentSizeChange = React.useCallback(() => {
    if (!displayMessages.length) {
      return;
    }

    if (!initialAnchorDoneRef.current) {
      initialAnchorDoneRef.current = true;
      scrollToBottom(false);
      setIsAtBottom(true);
      setShowScrollToBottom(false);
      setIsListReady(true);
      return;
    }

    if (isAtBottom) {
      scrollToBottom(false);
    }
  }, [displayMessages.length, isAtBottom, scrollToBottom]);

  const handleScrollToBottomPress = () => {
    scrollToBottom(true);
    userInteractedRef.current = false;
    setShowScrollToBottom(false);
    setIsAtBottom(true);
  };

  const handleSend = async (
    content: string,
    files: PendingAttachment[],
    parentId?: string | null,
  ) => {
    if (isBlockedChat) {
      Alert.alert(
        "Thông báo",
        isBlockedByOther ? "Bạn đã bị chặn" : "Bạn đã chặn người này",
      );
      return;
    }

    setSending(true);
    try {
      await sendMessage(conversationId, content, files, parentId);
      setReplyTo(null);
    } catch (error) {
      const code = (error as any)?.code;
      const message =
        error instanceof Error ? error.message : "Gửi tin nhắn thất bại";

      if (code === "ACCOUNT_TEMP_LOCKED") {
        Alert.alert("Tài khoản bị khóa tạm thời", message);
        await signOut().catch(() => {
          Alert.alert("Phiên đăng nhập đã hết hạn", "Vui lòng đăng nhập lại.");
        });
        return;
      }

      if (code === "CHAT_BLOCKED" || /chặn/i.test(message)) {
        await refreshBlockStatus();
        Alert.alert("Thông báo", message);
        return;
      }

      Alert.alert("Lỗi", message);
    } finally {
      setSending(false);
    }
  };

  const handleBlockUser = async () => {
    if (!peerUserId) return;

    try {
      await friendService.blockUser(peerUserId);
      await refreshBlockStatus();
      Alert.alert("Thành công", "Đã chặn người dùng");
    } catch (error) {
      Alert.alert(
        "Lỗi",
        error instanceof Error ? error.message : "Không thể chặn người dùng",
      );
    }
  };

  const handleUnblockUser = async () => {
    if (!peerUserId) return;

    try {
      await friendService.unblockUser(peerUserId);
      await refreshBlockStatus();
      Alert.alert("Thành công", "Đã bỏ chặn người dùng");
    } catch (error) {
      Alert.alert(
        "Lỗi",
        error instanceof Error ? error.message : "Không thể bỏ chặn người dùng",
      );
    }
  };

  const handleStartCall = async (mediaType: CallMediaType) => {
    if (isBlockedChat) {
      Alert.alert(
        "Thong bao",
        isBlockedByOther ? "Ban da bi chan" : "Ban da chan nguoi nay",
      );
      return;
    }

    if (
      activeForConversation &&
      (activeForConversation.status === "RINGING" ||
        activeForConversation.status === "ONGOING")
    ) {
      Alert.alert("Thong bao", "Cuoc goi cua doan chat nay dang dien ra.");
      return;
    }

    try {
      const permissionResult = await ensureCallPermissions(mediaType);
      if (!permissionResult.ok) {
        Alert.alert("Thong bao", permissionResult.error);
        return;
      }

      await startOutgoingCall(conversationId, mediaType);
      Alert.alert(
        mediaType === "VIDEO" ? "Dang goi video" : "Dang goi thoai",
        "Da tao cuoc goi va dang khoi tao phong goi",
      );
    } catch (error) {
      Alert.alert(
        "Loi",
        error instanceof Error ? error.message : "Khong thể bắt đầu cuộc gọi",
      );
    }
  };

  const handleAcceptCall = async () => {
    if (!incomingForConversation) {
      return;
    }

    try {
      const permissionResult = await ensureCallPermissions(
        incomingForConversation.mediaType,
      );
      if (!permissionResult.ok) {
        Alert.alert("Thong bao", permissionResult.error);
        return;
      }

      await acceptIncomingCall(incomingForConversation.callId);
    } catch (error) {
      Alert.alert(
        "Loi",
        error instanceof Error ? error.message : "Khong the nhan cuoc goi",
      );
    }
  };

  const handleRejectCall = async () => {
    if (!incomingForConversation) {
      return;
    }

    try {
      await rejectIncomingCall(incomingForConversation.callId);
    } catch (error) {
      Alert.alert(
        "Loi",
        error instanceof Error ? error.message : "Khong the tu choi cuoc goi",
      );
    }
  };

  const handleEndCall = async () => {
    if (!activeForConversation) {
      return;
    }

    try {
      await finalizeCallEnd(activeForConversation.callId, "ENDED_BY_USER");
    } catch (error) {
      Alert.alert(
        "Loi",
        error instanceof Error ? error.message : "Khong the ket thuc cuoc goi",
      );
    }
  };

  const handleSdkCallEnd = async (
    callId: number,
    reason: string,
  ): Promise<void> => {
    try {
      await finalizeCallEnd(callId, getBackendEndReason(reason));
    } catch (error) {
      console.error("[ChatRoom] Failed to sync ZEGO call end", error);
    }
  };

  const zegoCallConfig = React.useMemo(() => {
    if (!zegoCallModule) {
      return null;
    }

    const baseConfig =
      activeForConversation?.mediaType === "VIDEO"
        ? isGroupCall
          ? zegoCallModule.GROUP_VIDEO_CALL_CONFIG
          : zegoCallModule.ONE_ON_ONE_VIDEO_CALL_CONFIG
        : isGroupCall
          ? zegoCallModule.GROUP_VOICE_CALL_CONFIG
          : zegoCallModule.ONE_ON_ONE_VOICE_CALL_CONFIG;

    return {
      ...(baseConfig ?? {}),
      turnOnCameraWhenJoining: activeForConversation?.mediaType === "VIDEO",
      turnOnMicrophoneWhenJoining: true,
      useSpeakerWhenJoining: true,
      onCallEnd: handleSdkCallEnd,
    };
  }, [
    activeForConversation?.mediaType,
    handleSdkCallEnd,
    isGroupCall,
    zegoCallModule,
  ]);

  const handleRecallMessage = (msgId: string, isOwnMessage: boolean) => {
    const options: any[] = [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa ở phía tôi",
        style: "destructive",
        onPress: () => {
          deleteMessage(msgId).catch((err) => {
            Alert.alert(
              "Lỗi",
              err instanceof Error ? err.message : "Xóa tin nhắn thất bại",
            );
          });
        },
      },
    ];

    if (isOwnMessage) {
      options.push({
        text: "Thu hồi từ tất cả",
        style: "destructive",
        onPress: () => {
          recallMessage(msgId).catch((err) => {
            Alert.alert(
              "Lỗi",
              err instanceof Error ? err.message : "Thu hồi tin nhắn thất bại",
            );
          });
        },
      });
    }

    Alert.alert(
      isOwnMessage ? "Thu hồi hoặc xóa" : "Xóa tin nhắn",
      isOwnMessage
        ? "Bạn muốn làm gì với tin nhắn này?"
        : "Tin nhắn này sẽ bị xóa khỏi lịch sử chat của bạn.",
      options,
    );
  };

  const closeActionSheet = () => setActionSheetMessage(null);

  const handleActionSheetReaction = (emoji: string) => {
    if (!actionSheetMessage) return;
    const myReaction = actionSheetMessage.reactions?.find(
      (reaction) => reaction.userId === user?.id,
    );
    const nextReaction = myReaction?.reactionCode === emoji ? null : emoji;

    reactMessage(conversationId, actionSheetMessage.id, nextReaction)
      .catch((err) => {
        Alert.alert(
          "Lỗi",
          err instanceof Error ? err.message : "Không thể thả cảm xúc",
        );
      })
      .finally(closeActionSheet);
  };

  const handleActionSheetSelect = (
    action: "reply" | "forward" | "pin" | "remove-reaction" | "recall-delete",
  ) => {
    if (!actionSheetMessage) return;

    const target = actionSheetMessage;
    const isOwnMessage = target.senderInfo?.senderId === user?.id;
    const currentConv = conversations.find((c) => c.id === conversationId);
    const isPinned =
      currentConv?.pinnedMessages?.some((msg) => msg.id === target.id) ?? false;

    closeActionSheet();

    if (action === "reply") {
      setReplyTo(target);
      return;
    }

    if (action === "forward") {
      setMessageToForward(target);
      return;
    }

    if (action === "pin") {
      (isPinned
        ? unpinMessage(conversationId, target.id)
        : pinMessage(conversationId, target.id)
      ).catch((err) => {
        Alert.alert(
          "Lỗi",
          err instanceof Error ? err.message : "Không thể cập nhật ghim",
        );
      });
      return;
    }

    if (action === "remove-reaction") {
      reactMessage(conversationId, target.id, null).catch((err) => {
        Alert.alert(
          "Lỗi",
          err instanceof Error ? err.message : "Không thể bỏ cảm xúc",
        );
      });
      return;
    }

    handleRecallMessage(target.id, isOwnMessage);
  };

  const handleMessageLongPress = (item: Message) => {
    if (item.recalledAt) return;
    setActionSheetMessage(item);
  };

  const actionSheetIsOwnMessage =
    actionSheetMessage?.senderInfo?.senderId === user?.id;
  const actionSheetMyReaction = actionSheetMessage?.reactions?.find(
    (reaction) => reaction.userId === user?.id,
  );
  const actionSheetPinned = (() => {
    if (!actionSheetMessage) return false;
    const currentConv = conversations.find((c) => c.id === conversationId);
    return (
      currentConv?.pinnedMessages?.some(
        (msg) => msg.id === actionSheetMessage.id,
      ) ?? false
    );
  })();
  const firstPinnedMessage = pinnedMessages[0] ?? null;
  const morePinnedCount = Math.max(pinnedMessages.length - 1, 0);

  if (isLoading && displayMessages.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="light-content" />
        <ChatHeader
          name={currentConversation?.name || name}
          avatar={currentConversation?.avatarUrl || avatarUrl}
          type={type}
          participants={participants}
          isBlockedByMe={isBlockedByMe}
          isBlockedByOther={isBlockedByOther}
          onBlockUser={handleBlockUser}
          onUnblockUser={handleUnblockUser}
          onVoiceCallPress={() => void handleStartCall("VOICE")}
          onVideoCallPress={() => void handleStartCall("VIDEO")}
          onGroupInfoPress={
            isGroup ? () => setIsGroupSidebarOpen(true) : undefined
          }
        />
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={{ flex: 1 }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        <StatusBar barStyle="light-content" />
        <ChatHeader
          name={currentConversation?.name || name}
          avatar={currentConversation?.avatarUrl || avatarUrl}
          type={type}
          participants={currentParticipants}
          isBlockedByMe={isBlockedByMe}
          isBlockedByOther={isBlockedByOther}
          onBlockUser={handleBlockUser}
          onUnblockUser={handleUnblockUser}
          onVoiceCallPress={() => void handleStartCall("VOICE")}
          onVideoCallPress={() => void handleStartCall("VIDEO")}
          onGroupInfoPress={
            isGroup ? () => setIsGroupSidebarOpen(true) : undefined
          }
        />

        {isBlockedChat && (
          <View style={styles.blockedBanner}>
            <Text style={styles.blockedText}>
              {isBlockedByOther ? "Bạn đã bị chặn" : "Bạn đã chặn người này"}
            </Text>
            {isBlockedByMe && (
              <TouchableOpacity
                style={styles.unblockBtn}
                onPress={handleUnblockUser}
                activeOpacity={0.85}
              >
                <Text style={styles.unblockBtnText}>Bỏ chặn</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {incomingForConversation && (
          <View style={styles.callBannerIncoming}>
            <Text style={styles.callBannerTitle}>
              Cuoc goi{" "}
              {incomingForConversation.mediaType === "VIDEO"
                ? "video"
                : "thoai"}{" "}
              den
            </Text>
            <Text style={styles.callBannerSubtitle}>
              Nhan hoac tu choi de tiep tuc
            </Text>
            <View style={styles.callBannerActions}>
              <TouchableOpacity
                style={[styles.callActionButton, styles.callAcceptButton]}
                onPress={() => void handleAcceptCall()}
              >
                <Text style={styles.callActionText}>Nhan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.callActionButton, styles.callRejectButton]}
                onPress={() => void handleRejectCall()}
              >
                <Text style={styles.callActionText}>Tu choi</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeForConversation && (
          <View style={styles.callBannerActive}>
            <View style={{ flex: 1 }}>
              <Text style={styles.callBannerTitle}>
                Cuoc goi{" "}
                {activeForConversation.mediaType === "VIDEO"
                  ? "video"
                  : "thoai"}{" "}
                dang dien ra
              </Text>
              <Text style={styles.callBannerSubtitle}>
                Trang thai: {activeForConversation.status}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.callActionButton, styles.callEndButton]}
              onPress={() => void handleEndCall()}
            >
              <Text style={styles.callActionText}>Ket thuc</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeForConversation && (
          <View style={styles.callRoomOverlay}>
            {isExpoGoRuntime() ? (
              <View style={styles.callRoomLoading}>
                <Text style={styles.callRoomLoadingText}>
                  ZEGO native call room khong ho tro tren Expo Go. Vui long dung
                  Development Build.
                </Text>
              </View>
            ) : isWebRuntime() ? (
              <View style={styles.callRoomLoading}>
                <Text style={styles.callRoomLoadingText}>
                  ZEGO native call room khong ho tro tren mobile-web. Vui long
                  mo ban Android Development Build de dung tinh nang goi.
                </Text>
              </View>
            ) : callSetupError ? (
              <View style={styles.callRoomLoading}>
                <Text style={styles.callRoomLoadingText}>{callSetupError}</Text>
                {devRuntimeConnectionWarning ? (
                  <Text style={[styles.callRoomLoadingText, { marginTop: 10 }]}>
                    {devRuntimeConnectionWarning}
                  </Text>
                ) : null}
              </View>
            ) : activeForConversation.token?.token &&
              zegoAppSign &&
              zegoCallModule?.ZegoUIKitPrebuiltCall &&
              zegoCallConfig ? (
              <zegoCallModule.ZegoUIKitPrebuiltCall
                appID={activeForConversation.token.appId}
                appSign={zegoAppSign}
                userID={activeForConversation.token.userId}
                userName={
                  user?.displayName ||
                  user?.username ||
                  `user_${user?.id ?? ""}`
                }
                callID={activeForConversation.roomId}
                token={activeForConversation.token.token}
                config={zegoCallConfig}
              />
            ) : (
              <View style={styles.callRoomLoading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.callRoomLoadingText}>
                  {getCallRoomPendingReason({
                    hasToken: Boolean(activeForConversation.token?.token),
                    hasAppSign: Boolean(zegoAppSign),
                    hasModule: Boolean(zegoCallModule?.ZegoUIKitPrebuiltCall),
                    isPreparing: isPreparingCallRoom,
                  })}
                </Text>
              </View>
            )}
          </View>
        )}

        {firstPinnedMessage && (
          <TouchableOpacity
            style={styles.pinnedBanner}
            onPress={() => handleScrollToParent(firstPinnedMessage.id)}
            activeOpacity={0.8}
          >
            <View style={styles.pinnedIconWrap}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={20}
                color="#3b82f6"
              />
            </View>

            <View style={styles.pinnedContent}>
              <Text style={styles.pinnedText} numberOfLines={1}>
                {firstPinnedMessage.content ||
                  (firstPinnedMessage.attachments?.length
                    ? "Tệp đính kèm"
                    : "Tin nhắn bình chọn")}
              </Text>
              <Text style={styles.pinnedMeta} numberOfLines={1}>
                {`Tin nhắn của ${firstPinnedMessage.senderInfo?.displayName ?? "Thành viên"}`}
              </Text>
            </View>

            {morePinnedCount > 0 && (
              <View style={styles.pinnedCountChip}>
                <Text
                  style={styles.pinnedCountText}
                >{`+${morePinnedCount}`}</Text>
                <Ionicons name="chevron-down" size={16} color="#6b7280" />
              </View>
            )}
          </TouchableOpacity>
        )}

        {displayMessages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Chưa có tin nhắn nào.{"\n"}Hãy gửi lời chào! 👋
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={displayMessages}
            keyExtractor={(item) => item.id}
            windowSize={10}
            initialNumToRender={20}
            maxToRenderPerBatch={12}
            removeClippedSubviews
            renderItem={({ item }) => (
              <MessageBubble
                message={item.content || ""}
                attachments={item.attachments || []}
                poll={item.poll}
                reminder={item.reminder}
                messageId={item.id}
                status={item.status}
                onRetrySend={() =>
                  retrySendMessage(
                    conversationId,
                    item.tempId ?? item.id,
                  ).catch((err) => {
                    Alert.alert(
                      "Lỗi",
                      err instanceof Error
                        ? err.message
                        : "Không thể gửi lại tin nhắn",
                    );
                  })
                }
                reactions={item.reactions || []}
                currentUserId={user?.id}
                onReact={(reactionCode) => {
                  reactMessage(conversationId, item.id, reactionCode).catch(
                    (err) => {
                      Alert.alert(
                        "Lỗi",
                        err instanceof Error
                          ? err.message
                          : "Không thể thả cảm xúc",
                      );
                    },
                  );
                }}
                isMe={item.senderInfo?.senderId === user?.id}
                senderName={item.senderInfo?.displayName}
                avatarUrl={item.senderInfo?.avatarUrl}
                createdAt={item.createdAt}
                recalledAt={item.recalledAt}
                replyInfo={item.replyInfo}
                isGroup={isGroup}
                participants={currentParticipants}
                markAdminMessages={currentConversation?.markAdminMessages}
                senderRole={
                  currentParticipants?.find(
                    (p: Participant) => p.userId === item.senderInfo?.senderId
                  )?.role
                }
                onLongPress={() => handleMessageLongPress(item)}
                onReplyPreviewPress={
                  item.replyInfo?.parentId
                    ? () => handleScrollToParent(item.replyInfo.parentId)
                    : undefined
                }
                onPollVote={() => setPollToVote(item)}
                onReminderEdit={() => setReminderToEdit(item)}
                isHighlighted={item.id === highlightedMsgId}
              />
            )}
            extraData={highlightedMsgId}
            contentContainerStyle={[
              styles.msgList,
              !isListReady && styles.msgListHidden,
            ]}
            onContentSizeChange={handleContentSizeChange}
            onScrollBeginDrag={() => {
              userInteractedRef.current = true;
            }}
            onScroll={handleListScroll}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          />
        )}

        {displayMessages.length > 0 && showScrollToBottom && (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.scrollToBottomFab,
              {
                bottom: insets.bottom + 78,
              },
            ]}
            onPress={handleScrollToBottomPress}
          >
            <Ionicons name="chevron-down" size={24} color="#fff" />
          </TouchableOpacity>
        )}

        {!isBlockedChat ? (
          <>
            {typingLabel && (
              <View style={styles.typingContainer}>
                <View style={styles.typingRow}>
                  <Text style={styles.typingText}>{typingLabel}</Text>
                  <TypingDots />
                </View>
              </View>
            )}
            <ChatInput
              conversationId={conversationId}
              onSend={handleSend}
              disabled={sending || (isPrivateChat && isBlockStatusLoading)}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              onOpenPollCreator={() => setIsPollCreatorOpen(true)}
              onOpenReminderCreator={() => setIsReminderCreatorOpen(true)}
              allowMemberSendMessage={currentConversation?.allowMemberSendMessage}
              currentUserRole={
                currentParticipants?.find(
                  (p: Participant) => p.userId === user?.id,
                )?.role || null
              }
              isGroup={isGroup}
            />
          </>
        ) : (
          <View style={styles.blockedComposerPlaceholder}>
            <Text style={styles.blockedComposerText}>
              {isBlockedByOther ? "Bạn đã bị chặn" : "Bạn đã chặn người này"}
            </Text>
          </View>
        )}

        <Modal
          visible={!!actionSheetMessage}
          transparent
          animationType="fade"
          onRequestClose={closeActionSheet}
        >
          <View style={styles.actionSheetOverlay}>
            <TouchableOpacity
              activeOpacity={1}
              style={StyleSheet.absoluteFillObject}
              onPress={closeActionSheet}
            />

            <View style={styles.actionSheetWrap}>
              <View style={styles.actionSheetReactionRow}>
                {REACTION_OPTIONS.map((emoji) => {
                  const isActive =
                    actionSheetMyReaction?.reactionCode === emoji;
                  return (
                    <TouchableOpacity
                      key={emoji}
                      activeOpacity={0.85}
                      onPress={() => handleActionSheetReaction(emoji)}
                      style={[
                        styles.actionSheetReactionBtn,
                        isActive && styles.actionSheetReactionBtnActive,
                      ]}
                    >
                      <Text style={styles.actionSheetReactionText}>
                        {emoji}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.actionSheetGrid}>
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={() => handleActionSheetSelect("reply")}
                >
                  <Ionicons
                    name="arrow-undo-outline"
                    size={24}
                    color="#6a5acd"
                  />
                  <Text style={styles.actionSheetItemLabel}>Trả lời</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={() => handleActionSheetSelect("forward")}
                >
                  <Ionicons
                    name="arrow-redo-outline"
                    size={24}
                    color="#3b82f6"
                  />
                  <Text style={styles.actionSheetItemLabel}>Chuyển tiếp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={() => handleActionSheetSelect("pin")}
                >
                  <Ionicons
                    name={actionSheetPinned ? "pin-outline" : "attach-outline"}
                    size={24}
                    color="#f59e0b"
                  />
                  <Text style={styles.actionSheetItemLabel}>
                    {actionSheetPinned ? "Bỏ ghim" : "Ghim"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={() => handleActionSheetSelect("recall-delete")}
                >
                  <Ionicons name="trash-outline" size={24} color="#ef4444" />
                  <Text style={styles.actionSheetItemLabel}>
                    {actionSheetIsOwnMessage ? "Thu hồi / Xóa" : "Xóa"}
                  </Text>
                </TouchableOpacity>

                {actionSheetMyReaction && (
                  <TouchableOpacity
                    style={styles.actionSheetItem}
                    onPress={() => handleActionSheetSelect("remove-reaction")}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={24}
                      color="#f97316"
                    />
                    <Text style={styles.actionSheetItemLabel}>Bỏ cảm xúc</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>

        <ForwardMessageModal
          message={messageToForward}
          onClose={() => setMessageToForward(null)}
        />

        {isGroup && (
          <GroupSidebar
            visible={isGroupSidebarOpen}
            onClose={() => setIsGroupSidebarOpen(false)}
            groupName={currentConversation?.name || name || "Tùy chọn"}
            groupAvatar={currentConversation?.avatarUrl || avatarUrl}
            participants={currentParticipants}
            messages={displayMessages}
            pinnedMessages={pinnedMessages}
            conversation={
              currentConversation ??
              ({
                id: conversationId,
                type: type || "GROUP",
                participants: currentParticipants,
              } as any)
            }
            currentUserId={user?.id || 0}
            currentUserRole={
              currentParticipants?.find(
                (p: Participant) => p.userId === user?.id,
              )?.role || null
            }
            onLeaveGroup={async (convId, userId, transferToUserId) => {
              if (transferToUserId) {
                await updateMemberRole(convId, transferToUserId, "OWNER");
              }
              await leaveGroup(convId, userId);
              setIsGroupSidebarOpen(false);
            }}
            onRoleUpdate={async (memberId, newRole) => {
              try {
                await updateMemberRole(conversationId, memberId, newRole);
              } catch (error) {
                console.error("Lỗi cập nhật vai trò:", error);
                Alert.alert("Lỗi", "Không thể cập nhật vai trò thành viên");
              }
            }}
            onRemoveMember={async (memberId) => {
              try {
                await removeMemberFromGroup(conversationId, memberId);
              } catch (error) {
                console.error("Lỗi xóa thành viên:", error);
                throw error;
              }
            }}
            onRenameGroup={async (newName) => {
              try {
                await renameGroup(conversationId, newName);
              } catch (error) {
                console.error("Lỗi đổi tên nhóm:", error);
                Alert.alert("Lỗi", "Không thể đổi tên nhóm");
              }
            }}
            onUpdateDescription={async (newDescription) => {
              try {
                await updateGroupDescription(conversationId, newDescription);
              } catch (error) {
                console.error("Lỗi cập nhật mô tả nhóm:", error);
                Alert.alert("Lỗi", "Không thể cập nhật mô tả nhóm");
              }
            }}
            onUpdateAvatarFile={async (file) => {
              try {
                await uploadGroupAvatarFile(conversationId, file);
              } catch (error) {
                console.error("Lỗi cập nhật ảnh nhóm:", error);
                Alert.alert("Lỗi", "Không thể cập nhật ảnh nhóm");
              }
            }}
          />
        )}

        <PollCreatorModal
          visible={isPollCreatorOpen}
          onClose={() => setIsPollCreatorOpen(false)}
          onCreate={handleCreatePoll}
        />

        <ReminderCreatorModal
          visible={isReminderCreatorOpen || !!reminderToEdit}
          onClose={() => {
            setIsReminderCreatorOpen(false);
            setReminderToEdit(null);
          }}
          conversationId={conversationId}
          initialData={
            reminderToEdit?.reminder
              ? {
                  messageId: reminderToEdit.id,
                  title: reminderToEdit.reminder.title,
                  content: reminderToEdit.reminder.content || "",
                  reminderTime: reminderToEdit.reminder.reminderTime,
                }
              : undefined
          }
        />

        {activePollMessage && activePollMessage.poll && (
          <VotePollModal
            visible={!!activePollMessage}
            onClose={() => setPollToVote(null)}
            poll={activePollMessage.poll}
            onConfirm={handleVote}
            currentUserId={user?.id || 0}
            isCreator={(() => {
              const check =
                !!user &&
                Number(activePollMessage.senderInfo?.senderId) ===
                  Number(user?.id);
              console.log("[ChatRoom] Creator check:", {
                senderId: activePollMessage.senderInfo?.senderId,
                userId: user?.id,
                isCreator: check,
              });
              return check;
            })()}
            onClosePoll={handleClosePoll}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChatRoomScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f0f8",
  },
  center: {
    justifyContent: "flex-start",
  },
  msgList: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  msgListHidden: {
    opacity: 0,
  },
  blockedBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#ffe9e9",
    borderWidth: 1,
    borderColor: "#ffc9c9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  blockedText: {
    color: "#a61e1e",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  unblockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#f1a3a3",
  },
  unblockBtnText: {
    color: "#a61e1e",
    fontWeight: "700",
    fontSize: 12,
  },
  blockedComposerPlaceholder: {
    minHeight: 54,
    borderTopWidth: 1,
    borderTopColor: "#e8e8ef",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#fff7f7",
  },
  blockedComposerText: {
    color: "#a61e1e",
    fontSize: 13,
    fontWeight: "600",
  },
  callBannerIncoming: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#e9f6ff",
    borderWidth: 1,
    borderColor: "#b7ddff",
  },
  callBannerActive: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#eaf9ef",
    borderWidth: 1,
    borderColor: "#bfe8cc",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  callBannerTitle: {
    color: "#12344d",
    fontSize: 13,
    fontWeight: "700",
  },
  callBannerSubtitle: {
    color: "#486581",
    fontSize: 12,
    marginTop: 2,
  },
  callBannerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  callActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  callAcceptButton: {
    backgroundColor: COLORS.primary,
  },
  callRejectButton: {
    backgroundColor: "#d64545",
  },
  callEndButton: {
    backgroundColor: "#d64545",
  },
  callRoomOverlay: {
    flex: 1,
    minHeight: 320,
    position: "relative",
    zIndex: 20,
  },
  callRoomLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#0f172a",
    borderRadius: 20,
    marginHorizontal: 12,
    marginTop: 12,
  },
  callRoomLoadingText: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "600",
  },
  callActionText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  typingContainer: {
    borderTopWidth: 1,
    borderTopColor: "#e8e8ef",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 2,
    backgroundColor: "#fff",
  },
  typingText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontStyle: "italic",
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  typingDots: {
    marginLeft: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  typingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.textMuted,
  },
  scrollToBottomFab: {
    position: "absolute",
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: COLORS.textMuted,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 24,
  },
  pinnedBanner: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    marginHorizontal: 8,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  pinnedIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    marginRight: 10,
  },
  pinnedContent: {
    flex: 1,
  },
  pinnedText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  pinnedMeta: {
    marginTop: 2,
    fontSize: 11,
    color: "#6b7280",
  },
  pinnedCountChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#9ca3af",
    borderRadius: 18,
    paddingHorizontal: 10,
    height: 36,
    marginLeft: 8,
    gap: 2,
  },
  pinnedCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4b5563",
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.38)",
    justifyContent: "flex-end",
  },
  actionSheetWrap: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    gap: 10,
  },
  actionSheetReactionRow: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionSheetReactionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  actionSheetReactionBtnActive: {
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#93c5fd",
  },
  actionSheetReactionText: {
    fontSize: 30,
  },
  actionSheetGrid: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  actionSheetItem: {
    width: "25%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  actionSheetItemLabel: {
    fontSize: 13,
    color: "#293241",
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 4,
  },
});
