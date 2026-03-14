import React, { useEffect, useRef } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MessageBubble from "../components/MessageBubble";
import ChatInput from "../components/ChatInput";
import ChatHeader from "../components/ChatHeader";
import { useChat } from "../context/ChatContext";
import { useAuth } from "../../auth/context/AuthContext";

const ChatRoomScreen = ({ route }: any) => {
  const { name } = route.params;
  const {
    currentMessages,
    currentConversationId,
    isLoading,
    fetchMessages,
    sendMessage,
  } = useChat();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const [sending, setSending] = React.useState(false);

  useEffect(() => {
    if (currentConversationId) {
      fetchMessages(currentConversationId);
    }
  }, [currentConversationId, fetchMessages]);

  const handleSendMessage = async (content: string) => {
    if (!currentConversationId || !content.trim()) return;

    setSending(true);
    try {
      await sendMessage(currentConversationId, content);
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to send message"
      );
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  // Filter out deleted messages for display
  const displayMessages = currentMessages.filter((msg) => !msg.isDeleted);

  const mappedMessages = displayMessages.map((msg) => ({
    id: msg.id,
    text: msg.content,
    isMe: msg.senderId === user?.id,
    createdAt: msg.createdAt,
  }));

  return (
    <LinearGradient
      colors={["#8e44ad", "#6c5ce7"]}
      style={styles.container}
    >
      <ChatHeader name={name} />

      {isLoading && mappedMessages.length === 0 ? (
        <View style={[styles.messageContainer, styles.centerContent]}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={mappedMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble message={item.text} isMe={item.isMe} />
          )}
          contentContainerStyle={styles.messageContainer}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          scrollEnabled={mappedMessages.length > 0}
        />
      )}

      <ChatInput onSend={handleSendMessage} disabled={sending} />
    </LinearGradient>
  );
};

export default ChatRoomScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageContainer: {
    padding: 16,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
});
