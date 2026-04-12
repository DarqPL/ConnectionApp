import React, { useEffect, useRef } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Text,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MessageBubble from "../components/MessageBubble";
import ChatInput from "../components/ChatInput";
import ChatHeader from "../components/ChatHeader";
import { useChat, type PendingAttachment } from "../context/ChatContext";
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
  const [sending, setSending] = React.useState(false);

  useEffect(() => {
    setCurrentConversation(conversationId);
    fetchMessages(conversationId);

    return () => {
      setCurrentConversation(null);
    };
  }, [conversationId]);

  const handleSend = async (content: string, files: PendingAttachment[]) => {
    setSending(true);
    try {
      await sendMessage(conversationId, content, files);
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
  const displayMessages = currentMessages.filter((m) => !m.isDeleted);

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
              isGroup={isGroup}
              onLongPress={
                item.senderInfo?.senderId === user?.id
                  ? () => handleLongPress(item.id)
                  : undefined
              }
            />
          )}
          contentContainerStyle={styles.msgList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        />
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
