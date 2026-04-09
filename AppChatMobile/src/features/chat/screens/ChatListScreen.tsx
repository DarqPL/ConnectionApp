import React, { useEffect } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import ChatItem from "../components/ChatItem";
import { useNavigation } from "@react-navigation/native";
import { useChat } from "../context/ChatContext";
import { useAuth } from "../../auth/context/AuthContext";
import type { Conversation } from "../types";

const ChatListScreen = () => {
  const navigation = useNavigation<any>();
  const {
    conversations,
    isLoading,
    fetchConversations,
    setCurrentConversation,
  } = useChat();
  const { signOut, user } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert(
        "Lỗi",
        error instanceof Error ? error.message : "Đăng xuất thất bại",
      );
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchConversations();
    } finally {
      setRefreshing(false);
    }
  }, [fetchConversations]);

  const formatTime = (dateString: string | null): string => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const resolveConversationName = (conversation: Conversation): string => {
    if (conversation.name?.trim()) return conversation.name;

    const other = conversation.participants.find(
      (participant) => participant.userId !== user?.id,
    );
    return other?.displayName || "Cuộc trò chuyện";
  };

  const resolveConversationAvatar = (conversation: Conversation): string => {
    if (conversation.avatarUrl) return conversation.avatarUrl;

    const other = conversation.participants.find(
      (participant) => participant.userId !== user?.id,
    );
    return other?.avatarUrl || "https://i.pravatar.cc/150?img=10";
  };

  const handleOpenConversation = (conversation: Conversation) => {
    setCurrentConversation(conversation.id);
    navigation.navigate("ChatRoom", {
      conversationId: conversation.id,
      name: resolveConversationName(conversation),
      avatarUrl: resolveConversationAvatar(conversation),
    });
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Chưa có cuộc trò chuyện nào</Text>
      <Text style={styles.emptySubtext}>
        Hãy bắt đầu cuộc trò chuyện mới để nhắn tin
      </Text>
    </View>
  );

  if (isLoading && conversations.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#8e44ad" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Đoạn chat gần đây</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ChatItem
            name={resolveConversationName(item)}
            lastMessage={item.lastMessageContent || "Chưa có tin nhắn"}
            time={formatTime(item.lastMessageAt)}
            avatar={resolveConversationAvatar(item)}
            unreadCount={item.unreadCount}
            onPress={() => handleOpenConversation(item)}
          />
        )}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
};

export default ChatListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  signOutText: {
    color: "#6c5ce7",
    fontWeight: "600",
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
});
