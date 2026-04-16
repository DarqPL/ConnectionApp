import React, { useEffect, useRef } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Text,
  StatusBar,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MessageBubble from "../components/MessageBubble";
import ChatInput from "../components/ChatInput";
import ChatHeader from "../components/ChatHeader";
import { useChat, type PendingAttachment } from "../context/ChatContext";
import { useAuth } from "../../auth/context/AuthContext";
import { COLORS } from "../../../theme";
import type { Message } from "../types";
import { friendService, type BlockStatus } from "../services/friend.service";

const ChatRoomScreen = ({ route }: any) => {
  const insets = useSafeAreaInsets();
  const { conversationId, name, avatarUrl, type, participants } = route.params;
  const {
    currentMessages,
    isLoading,
    fetchMessages,
    sendMessage,
    deleteMessage,
    setCurrentConversation,
  } = useChat();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const userInteractedRef = useRef(false);
  const initialAnchorDoneRef = useRef(false);
  const [sending, setSending] = React.useState(false);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);
  const [isListReady, setIsListReady] = React.useState(false);
  const [replyTo, setReplyTo] = React.useState<Message | null>(null);
  const [blockStatus, setBlockStatus] = React.useState<BlockStatus>({
    blocked: false,
    blockedByMe: false,
    blockedByOther: false,
  });
  const [isBlockStatusLoading, setIsBlockStatusLoading] = React.useState(false);

  const showScrollThreshold = 120;
  const nearBottomThreshold = 24;
  const displayMessages = currentMessages;
  const isGroup = type === "GROUP";
  const isPrivateChat = !isGroup;

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

  useEffect(() => {
    userInteractedRef.current = false;
    initialAnchorDoneRef.current = false;
    setIsAtBottom(true);
    setShowScrollToBottom(false);
    setIsListReady(false);
    setReplyTo(null);
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
    Alert.alert("Thu hồi tin nhắn", "Bạn có chắc muốn thu hồi tin nhắn này?", [
      { text: "Bỏ qua", style: "cancel" },
      {
        text: "Thu hồi",
        style: "destructive",
        onPress: () => deleteMessage(msgId),
      },
    ]);
  };

  const handleMessageAction = (item: Message) => {
    if (item.recalledAt) {
      return;
    }

    const isOwnMessage = item.senderInfo?.senderId === user?.id;
    const actions: Array<{
      text: string;
      style?: "default" | "cancel" | "destructive";
      onPress?: () => void;
    }> = [
      {
        text: "Trả lời",
        onPress: () => setReplyTo(item),
      },
      {
        text: "Hủy",
        style: "cancel",
      },
    ];

    if (isOwnMessage) {
      actions.splice(1, 0, {
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
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
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
              isMe={item.senderInfo?.senderId === user?.id}
              senderName={item.senderInfo?.displayName}
              avatarUrl={item.senderInfo?.avatarUrl}
              createdAt={item.createdAt}
              recalledAt={item.recalledAt}
              replyInfo={item.replyInfo}
              isGroup={isGroup}
              onLongPress={() => handleMessageAction(item)}
            />
          )}
          contentContainerStyle={[
            styles.msgList,
            !isListReady && styles.msgListHidden,
          ]}
          onContentSizeChange={handleContentSizeChange}
          onScrollBeginDrag={() => {
            userInteractedRef.current = true;
          }}
          onScroll={handleListScroll}
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
        <ChatInput
          conversationId={conversationId}
          onSend={handleSend}
          disabled={sending || (isPrivateChat && isBlockStatusLoading)}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      ) : (
        <View style={styles.blockedComposerPlaceholder}>
          <Text style={styles.blockedComposerText}>
            {isBlockedByOther ? "Bạn đã bị chặn" : "Bạn đã chặn người này"}
          </Text>
        </View>
      )}
    </View>
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
});
