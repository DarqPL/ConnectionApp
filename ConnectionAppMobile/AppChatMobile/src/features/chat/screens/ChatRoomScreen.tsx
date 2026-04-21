import React, { useEffect, useRef } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Alert,
  Text,
  StatusBar,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MessageBubble from "../components/MessageBubble";
import ForwardMessageModal from "../components/ForwardMessageModal";
import ChatInput from "../components/ChatInput";
import ChatHeader from "../components/ChatHeader";
import GroupSidebar from "../components/GroupSidebar";
import PollCreatorModal from "../components/PollCreatorModal";
import VotePollModal from "../components/VotePollModal";
import { useChat, type PendingAttachment } from "../context/ChatContext";
import { useAuth } from "../../auth/context/AuthContext";
import { COLORS } from "../../../theme";
import type { Message, Poll } from "../types";
import { chatService } from "../services/chat.service";
import { friendService, type BlockStatus } from "../services/friend.service";

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

const ChatRoomScreen = ({ route }: any) => {
  const insets = useSafeAreaInsets();
  const { conversationId, name, avatarUrl, type, participants } = route.params;
  const {
    currentMessages,
    typingUsers,
    isLoading,
    fetchMessages,
    sendMessage,
    recallMessage,
    deleteMessage,
    pinMessage,
    unpinMessage,
    conversations,
    setCurrentConversation,
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
  const [pinnedMessages, setPinnedMessages] = React.useState<Message[]>([]);

  const currentConversation = conversations.find((c) => c.id === conversationId);

  useEffect(() => {
    if (!currentConversation?.pinnedMessageIds) {
      setPinnedMessages([]);
      return;
    }

    const ids = currentConversation.pinnedMessageIds
      .split(",")
      .filter((id) => id.trim().length > 0);
    if (ids.length === 0) {
      setPinnedMessages([]);
      return;
    }

    const fetchPinned = async () => {
      try {
        const results = await Promise.all(
          ids.map(async (id) => {
            const existing = currentMessages.find((m) => m.id === id);
            if (existing) return existing;
            try {
              return await chatService.getMessage(id);
            } catch (e) {
              return null;
            }
          }),
        );
        setPinnedMessages(results.filter((m): m is Message => m !== null));
      } catch (error) {
        console.error("[ChatRoom] Error fetching pinned messages:", error);
      }
    };

    fetchPinned();
  }, [currentConversation?.pinnedMessageIds, currentMessages]);

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
    console.log("[ChatRoom] handleClosePoll called. activePollMessage ID:", activePollMessage?.id);
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
  const displayMessages = currentMessages;
  const isGroup = type === "GROUP";
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

  const handleRecallMessage = (msgId: string) => {
    Alert.alert("Thu hồi hoặc xóa", "Bạn muốn làm gì với tin nhắn này?", [
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
      {
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
      },
    ]);
  };

  const handleMessageLongPress = (item: Message) => {
    if (item.recalledAt) return;

    const isOwnMessage = item.senderInfo?.senderId === user?.id;
    const currentConversation = conversations.find(
      (c) => c.id === conversationId,
    );
    const pinnedIds = currentConversation?.pinnedMessageIds
      ? currentConversation.pinnedMessageIds.split(",")
      : [];
    const isPinned = pinnedIds.includes(item.id);

    const actions: any[] = [
      {
        text: "Trả lời",
        onPress: () => setReplyTo(item),
      },
      {
        text: "Chuyển tiếp",
        onPress: () => setMessageToForward(item),
      },
      {
        text: isPinned ? "Bỏ ghim" : "Ghim tin nhắn",
        onPress: () => {
          if (isPinned) {
            unpinMessage(conversationId, item.id);
          } else {
            pinMessage(conversationId, item.id);
          }
        },
      },
      {
        text: "Hủy",
        style: "cancel",
      },
    ];

    if (isOwnMessage) {
      actions.splice(3, 0, {
        text: "Thu hồi",
        style: "destructive",
        onPress: () => handleRecallMessage(item.id),
      });
    }

    Alert.alert("Tùy chọn", "Chọn hành động cho tin nhắn", actions);
  };

  if (isLoading && displayMessages.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="light-content" />
        <ChatHeader
          name={name}
          avatar={avatarUrl}
          type={type}
          participants={participants}
          isBlockedByMe={isBlockedByMe}
          isBlockedByOther={isBlockedByOther}
          onBlockUser={handleBlockUser}
          onUnblockUser={handleUnblockUser}
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
          name={name}
          avatar={avatarUrl}
          type={type}
          participants={participants}
          isBlockedByMe={isBlockedByMe}
          isBlockedByOther={isBlockedByOther}
          onBlockUser={handleBlockUser}
          onUnblockUser={handleUnblockUser}
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

        {pinnedMessages.length > 0 && (
          <TouchableOpacity
            style={styles.pinnedBanner}
            onPress={() => handleScrollToParent(pinnedMessages[0].id)}
            activeOpacity={0.8}
          >
            <View style={styles.pinnedIcon}>
              <Ionicons name="pin" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.pinnedContent}>
              <Text style={styles.pinnedLabel}>Tin nhắn đã ghim</Text>
              <Text style={styles.pinnedText} numberOfLines={1}>
                {pinnedMessages[0].content || (pinnedMessages[0].attachments?.length ? "Tệp đính kèm" : "Tin nhắn bình chọn")}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.unpinBannerBtn}
              onPress={() => unpinMessage(conversationId, pinnedMessages[0].id)}
            >
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
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
            renderItem={({ item }) => (
              <MessageBubble
                message={item.content || ""}
                attachments={item.attachments || []}
                poll={item.poll}
                isMe={item.senderInfo?.senderId === user?.id}
                senderName={item.senderInfo?.displayName}
                avatarUrl={item.senderInfo?.avatarUrl}
                createdAt={item.createdAt}
                recalledAt={item.recalledAt}
                replyInfo={item.replyInfo}
                isGroup={isGroup}
                onLongPress={() => handleMessageLongPress(item)}
                onReplyPreviewPress={
                  item.replyInfo?.parentId
                    ? () => handleScrollToParent(item.replyInfo.parentId)
                    : undefined
                }
                onPollVote={() => setPollToVote(item)}
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
            />
          </>
        ) : (
          <View style={styles.blockedComposerPlaceholder}>
            <Text style={styles.blockedComposerText}>
              {isBlockedByOther ? "Bạn đã bị chặn" : "Bạn đã chặn người này"}
            </Text>
          </View>
        )}

        <ForwardMessageModal
          message={messageToForward}
          onClose={() => setMessageToForward(null)}
        />

        {isGroup && (
          <GroupSidebar
            visible={isGroupSidebarOpen}
            onClose={() => setIsGroupSidebarOpen(false)}
            groupName={name}
            groupAvatar={avatarUrl}
            participants={participants || []}
            messages={displayMessages}
          />
        )}

        <PollCreatorModal
          visible={isPollCreatorOpen}
          onClose={() => setIsPollCreatorOpen(false)}
          onCreate={handleCreatePoll}
        />

        {activePollMessage && activePollMessage.poll && (
          <VotePollModal
            visible={!!activePollMessage}
            onClose={() => setPollToVote(null)}
            poll={activePollMessage.poll}
            onConfirm={handleVote}
            currentUserId={user?.id || 0}
            isCreator={(() => {
              const check = !!user && Number(activePollMessage.senderInfo?.senderId) === Number(user?.id);
              console.log("[ChatRoom] Creator check:", {
                senderId: activePollMessage.senderInfo?.senderId,
                userId: user?.id,
                isCreator: check
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
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  pinnedIcon: {
    marginRight: 10,
  },
  pinnedContent: {
    flex: 1,
  },
  pinnedLabel: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "bold",
    marginBottom: 2,
  },
  pinnedText: {
    fontSize: 14,
    color: COLORS.text,
  },
  unpinBannerBtn: {
    padding: 5,
  },
});
