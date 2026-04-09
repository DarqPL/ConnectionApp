import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { COLORS } from "../../../theme";
import { friendService } from "../services/friend.service";
import { chatService } from "../services/chat.service";
import type { Friend } from "../types";
import BottomNavigator from "../../../components/BottomNavigator";

const FALLBACK_AVATAR = "https://i.pravatar.cc/150?img=5";

const ContactScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFriends = async () => {
    try {
      const data = await friendService.getFriends();
      setFriends(data);
    } catch (err) {
      console.error("Error fetching friends:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFriends();
  };

  const handleChat = async (friend: Friend) => {
    try {
      const conv = await chatService.createConversation("PRIVATE", "", [friend.friendId]);
      navigation.navigate("ChatRoom", {
        conversationId: conv.id,
        name: friend.displayName,
        avatarUrl: friend.avatarUrl,
        type: "PRIVATE",
        participants: [],
      });
    } catch (error) {
      Alert.alert("Lỗi", "Không thể mở cuộc trò chuyện");
    }
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <TouchableOpacity style={styles.friendRow} onPress={() => handleChat(item)}>
      <Image
        source={{ uri: item.avatarUrl || FALLBACK_AVATAR }}
        style={styles.avatar}
      />
      <View style={styles.friendInfo}>
        <Text style={styles.displayName}>{item.displayName}</Text>
        <Text style={styles.username}>@{item.username}</Text>
      </View>
      <TouchableOpacity style={styles.chatBtn} onPress={() => handleChat(item)}>
        <Ionicons name="chatbubble-ellipses-outline" size={22} color={COLORS.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent />

      <LinearGradient
        colors={COLORS.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Text style={styles.headerTitle}>Danh bạ</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate("AddFriend")}
        >
          <Ionicons name="person-add-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Quick actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => navigation.navigate("AddFriend")}
        >
          <View style={[styles.actionIcon, { backgroundColor: "#ede9fe" }]}>
            <Ionicons name="person-add" size={20} color={COLORS.primary} />
          </View>
          <Text style={styles.actionLabel}>Tìm & kết bạn</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => navigation.navigate("CreateGroup")}
        >
          <View style={[styles.actionIcon, { backgroundColor: "#fce7f3" }]}>
            <Ionicons name="people" size={20} color="#db2777" />
          </View>
          <Text style={styles.actionLabel}>Tạo nhóm mới</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
        </TouchableOpacity>
      </View>

      {/* Friends count */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Bạn bè ({friends.length})</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.friendId.toString()}
          renderItem={renderFriend}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={56} color={COLORS.border} />
              <Text style={styles.emptyText}>Chưa có bạn bè nào</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate("AddFriend")}
              >
                <Text style={styles.emptyBtnText}>Tìm bạn bè</Text>
              </TouchableOpacity>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      <BottomNavigator />
    </View>
  );
};

export default ContactScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundMuted,
  },
  header: {
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  addBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  actions: {
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    fontWeight: "500",
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.backgroundMuted,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  displayName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  username: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  chatBtn: {
    padding: 8,
  },
  empty: {
    alignItems: "center",
    paddingTop: 50,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 15,
    marginTop: 12,
  },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
