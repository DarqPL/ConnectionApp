import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { COLORS } from "../../../theme";
import { userService } from "../services/user.service";
import { friendService } from "../services/friend.service";
import BottomNavigator from "../../../components/BottomNavigator";

type RelationshipStatus = "NONE" | "FRIEND" | "SENDING" | "RECEIVED" | "LOCKED" | null;

interface SearchUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  status: string;
  relationship: RelationshipStatus;
}

const FALLBACK = "https://i.pravatar.cc/150?img=5";

const AddFriendScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(false);
    setResults([]);
    try {
      const users = await userService.searchUsers(q);
      const filtered = users.filter((u: any) => u.status !== "DELETED");

      const withRelationship = await Promise.all(
        filtered.map(async (u: any) => {
          try {
            const [isFriend, isSending, isReceived] = await Promise.all([
              friendService.checkFriendship(u.id),
              friendService.checkIsSending(u.id),
              friendService.checkIsReceived(u.id),
            ]);
            let rel: RelationshipStatus = "NONE";
            if (u.status === "LOCKED") rel = "LOCKED";
            else if (isFriend) rel = "FRIEND";
            else if (isSending) rel = "SENDING";
            else if (isReceived) rel = "RECEIVED";
            return { ...u, relationship: rel };
          } catch {
            return { ...u, relationship: "NONE" as RelationshipStatus };
          }
        })
      );
      setResults(withRelationship);
    } catch (err) {
      Alert.alert("Lỗi", "Không thể tìm kiếm. Vui lòng thử lại.");
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const updateRelationship = (userId: number, rel: RelationshipStatus) => {
    setResults((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, relationship: rel } : u))
    );
  };

  const handleSendRequest = async (userId: number) => {
    try {
      await friendService.sendFriendRequest(userId);
      updateRelationship(userId, "SENDING");
    } catch { Alert.alert("Lỗi", "Không thể gửi lời mời"); }
  };

  const handleCancel = async (userId: number) => {
    try {
      await friendService.cancelFriendRequest(userId);
      updateRelationship(userId, "NONE");
    } catch { Alert.alert("Lỗi", "Không thể hủy lời mời"); }
  };

  const handleAccept = async (userId: number) => {
    try {
      await friendService.acceptFriendRequest(userId);
      updateRelationship(userId, "FRIEND");
    } catch { Alert.alert("Lỗi", "Không thể chấp nhận"); }
  };

  const handleReject = async (userId: number) => {
    try {
      await friendService.rejectFriendRequest(userId);
      updateRelationship(userId, "NONE");
    } catch { Alert.alert("Lỗi", "Không thể từ chối"); }
  };

  const handleUnfriend = async (userId: number) => {
    Alert.alert("Hủy kết bạn", "Bạn có chắc muốn hủy kết bạn?", [
      { text: "Bỏ qua", style: "cancel" },
      {
        text: "Hủy kết bạn", style: "destructive", onPress: async () => {
          try {
            await friendService.unfriend(userId);
            updateRelationship(userId, "NONE");
          } catch { Alert.alert("Lỗi", "Không thể hủy kết bạn"); }
        }
      },
    ]);
  };

  const renderActions = (user: SearchUser) => {
    if (user.status === "LOCKED") {
      return <Text style={styles.lockedText}>Tài khoản bị khóa</Text>;
    }
    switch (user.relationship) {
      case "FRIEND":
        return (
          <TouchableOpacity
            style={[styles.actionBtn, styles.destructiveBtn]}
            onPress={() => handleUnfriend(user.id)}
          >
            <Text style={styles.destructiveBtnText}>Hủy kết bạn</Text>
          </TouchableOpacity>
        );
      case "SENDING":
        return (
          <TouchableOpacity
            style={[styles.actionBtn, styles.outlineBtn]}
            onPress={() => handleCancel(user.id)}
          >
            <Text style={styles.outlineBtnText}>Hủy lời mời</Text>
          </TouchableOpacity>
        );
      case "RECEIVED":
        return (
          <View style={styles.twoBtn}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.primaryBtn, { marginRight: 6 }]}
              onPress={() => handleAccept(user.id)}
            >
              <Text style={styles.primaryBtnText}>Chấp nhận</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.outlineBtn]}
              onPress={() => handleReject(user.id)}
            >
              <Text style={styles.outlineBtnText}>Từ chối</Text>
            </TouchableOpacity>
          </View>
        );
      case "NONE":
      default:
        return (
          <TouchableOpacity
            style={[styles.actionBtn, styles.primaryBtn]}
            onPress={() => handleSendRequest(user.id)}
          >
            <Ionicons name="person-add" size={14} color="#fff" />
            <Text style={[styles.primaryBtnText, { marginLeft: 4 }]}>Kết bạn</Text>
          </TouchableOpacity>
        );
    }
  };

  const renderUser = ({ item }: { item: SearchUser }) => (
    <View style={styles.userRow}>
      <Image source={{ uri: item.avatarUrl || FALLBACK }} style={styles.avatar} />
      <View style={styles.userInfo}>
        <Text style={styles.displayName}>{item.displayName}</Text>
        <Text style={styles.username}>@{item.username}</Text>
      </View>
      {renderActions(item)}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent />

      <LinearGradient
        colors={COLORS.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.7)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm bạn bè..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(""); setResults([]); setSearched(false); }}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderUser}
          ListEmptyComponent={() =>
            searched ? (
              <View style={styles.empty}>
                <Ionicons name="search" size={48} color={COLORS.border} />
                <Text style={styles.emptyText}>Không tìm thấy "{query}"</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={56} color={COLORS.border} />
                <Text style={styles.emptyText}>Nhập tên hoặc username để tìm bạn bè</Text>
              </View>
            )
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <BottomNavigator />
    </View>
  );
};

export default AddFriendScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundMuted,
  },
  header: {
    paddingBottom: 14,
    paddingHorizontal: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#fff",
    padding: 0,
  },
  userRow: {
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
  userInfo: {
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
  lockedText: {
    fontSize: 12,
    color: COLORS.destructive,
  },
  twoBtn: {
    flexDirection: "row",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  outlineBtnText: {
    color: COLORS.text,
    fontSize: 13,
  },
  destructiveBtn: {
    backgroundColor: "#fee2e2",
  },
  destructiveBtnText: {
    color: COLORS.destructive,
    fontSize: 13,
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 32,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 15,
    marginTop: 12,
    textAlign: "center",
    lineHeight: 22,
  },
});
