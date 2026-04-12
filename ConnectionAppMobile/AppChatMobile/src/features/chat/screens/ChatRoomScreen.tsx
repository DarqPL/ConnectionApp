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
import { useChat } from "../context/ChatContext";
import { useAuth } from "../../auth/context/AuthContext";
import { COLORS } from "../../../theme";

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
  const [sending, setSending] = React.useState(false);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);
  const [hasAutoScrolledOnOpen, setHasAutoScrolledOnOpen] =
    React.useState(false);

  const showScrollThreshold = 120;
  const nearBottomThreshold = 24;
  const displayMessages = currentMessages.filter((m) => !m.isDeleted);

  const scrollToBottom = React.useCallback((animated = true) => {
    flatListRef.current?.scrollToEnd({ animated });
  }, []);

  useEffect(() => {
    userInteractedRef.current = false;
    setIsAtBottom(true);
    setShowScrollToBottom(false);
    setHasAutoScrolledOnOpen(false);

    setCurrentConversation(conversationId);
    fetchMessages(conversationId);

    return () => {
      setCurrentConversation(null);
      setShowScrollToBottom(false);
    };
  }, [conversationId, fetchMessages, setCurrentConversation]);

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

  const handleListLayout = React.useCallback(() => {
    if (!displayMessages.length || hasAutoScrolledOnOpen) {
      return;
    }

    scrollToBottom(false);
  }, [displayMessages.length, hasAutoScrolledOnOpen, scrollToBottom]);

  const handleContentSizeChange = React.useCallback(() => {
    if (!displayMessages.length) {
      return;
    }

    if (!hasAutoScrolledOnOpen) {
      scrollToBottom(false);
      setIsAtBottom(true);
      setShowScrollToBottom(false);
      setHasAutoScrolledOnOpen(true);
      return;
    }

    if (isAtBottom) {
      scrollToBottom(false);
    }
  }, [
    displayMessages.length,
    hasAutoScrolledOnOpen,
    isAtBottom,
    scrollToBottom,
  ]);

  const handleScrollToBottomPress = () => {
    scrollToBottom(true);
    setShowScrollToBottom(false);
    setIsAtBottom(true);
  };

  const handleSend = async (content: string) => {
    setSending(true);
    try {
      await sendMessage(conversationId, content);
    } catch (error) {
      Alert.alert(
        "Lỗi",
        error instanceof Error ? error.message : "Gửi thất bại",
      );
    } finally {
      setSending(false);
    }
  };

  const handleLongPress = (msgId: string) => {
    Alert.alert("Thu hồi tin nhắn", "Bạn có chắc muốn thu hồi tin nhắn này?", [
      { text: "Bỏ qua", style: "cancel" },
      {
        text: "Thu hồi",
        style: "destructive",
        onPress: () => deleteMessage(msgId),
      },
    ]);
  };

  const isGroup = type === "GROUP";

  if (isLoading && displayMessages.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="light-content" />
        <ChatHeader
          name={name}
          avatar={avatarUrl}
          type={type}
          participants={participants}
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
      />

      {displayMessages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Chưa có tin nhắn nào.{"\n"}Hãy gửi lời chào! 👋
          </Text>
        </View>
      ) : (
        <FlatList
          key={`conversation-${conversationId}`}
          ref={flatListRef}
          data={displayMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item.content || ""}
              isMe={item.senderInfo?.senderId === user?.id}
              senderName={item.senderInfo?.displayName}
              avatarUrl={item.senderInfo?.avatarUrl}
              createdAt={item.createdAt}
              recalledAt={item.recalledAt}
              isGroup={isGroup}
              onLongPress={
                item.senderInfo?.senderId === user?.id
                  ? () => handleLongPress(item.id)
                  : undefined
              }
            />
          )}
          contentContainerStyle={styles.msgList}
          onContentSizeChange={handleContentSizeChange}
          onLayout={handleListLayout}
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

      <ChatInput onSend={handleSend} disabled={sending} />
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
