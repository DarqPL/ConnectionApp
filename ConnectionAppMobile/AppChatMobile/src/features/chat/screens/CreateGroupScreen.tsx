import React, { useEffect, useState } from "react";
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
import { friendService } from "../services/friend.service";
import { chatService } from "../services/chat.service";
import type { Friend } from "../types";

const FALLBACK = "https://i.pravatar.cc/150?img=5";
const MIN_GROUP_MEMBERS = 3;
const MIN_INVITED_FRIENDS = MIN_GROUP_MEMBERS - 1;

const CreateGroupScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const canCreate =
    selected.length >= MIN_INVITED_FRIENDS &&
    Boolean(groupName.trim()) &&
    !creating;

  useEffect(() => {
    friendService
      .getFriends()
      .then(setFriends)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleSelect = (friendId: number) => {
    setSelected((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId],
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert("Thiếu tên", "Vui lòng nhập tên nhóm");
      return;
    }
    if (selected.length < MIN_INVITED_FRIENDS) {
      Alert.alert(
        "Chưa đủ thành viên",
        `Nhóm cần ít nhất ${MIN_GROUP_MEMBERS} thành viên (bao gồm bạn). Vui lòng chọn tối thiểu ${MIN_INVITED_FRIENDS} người.`,
      );
      return;
    }
    setCreating(true);
    try {
      const group = await chatService.createConversation(
        "GROUP",
        groupName.trim(),
        selected,
      );
      navigation.replace("ChatRoom", {
        conversationId: group.id,
        name: group.name,
        avatarUrl: null,
        type: "GROUP",
        participants: group.participants || [],
      });
    } catch (err) {
      Alert.alert("Lỗi", "Không thể tạo nhóm. Vui lòng thử lại.");
    } finally {
      setCreating(false);
    }
  };

  const renderFriend = ({ item }: { item: Friend }) => {
    const isSelected = selected.includes(item.friendId);
    return (
      <TouchableOpacity
        style={styles.friendRow}
        onPress={() => toggleSelect(item.friendId)}
      >
        <Image
          source={{ uri: item.avatarUrl || FALLBACK }}
          style={styles.avatar}
        />
        <View style={styles.friendInfo}>
          <Text style={styles.displayName}>{item.displayName}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
          {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

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
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tạo nhóm mới</Text>
          <TouchableOpacity
            style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={!canCreate}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.createBtnText}>Tạo</Text>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Group name input */}
      <View style={styles.nameSection}>
        <Ionicons
          name="camera-outline"
          size={24}
          color={COLORS.textMuted}
          style={styles.cameraIcon}
        />
        <TextInput
          style={styles.nameInput}
          placeholder="Tên nhóm..."
          placeholderTextColor={COLORS.textLight}
          value={groupName}
          onChangeText={setGroupName}
          autoFocus
        />
      </View>

      {/* Selected chips */}
      {selected.length > 0 && (
        <View style={styles.selectedSection}>
          <Text style={styles.selectedLabel}>Đã chọn ({selected.length}):</Text>
          {selected.length < MIN_INVITED_FRIENDS && (
            <Text style={styles.validationText}>
              Chọn thêm {MIN_INVITED_FRIENDS - selected.length} người để đủ 3
              thành viên (tính cả bạn).
            </Text>
          )}
          <View style={styles.chips}>
            {selected.map((id) => {
              const f = friends.find((fr) => fr.friendId === id);
              if (!f) return null;
              return (
                <TouchableOpacity
                  key={id}
                  style={styles.chip}
                  onPress={() => toggleSelect(id)}
                >
                  <Text style={styles.chipText}>{f.displayName}</Text>
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Bạn bè</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.friendId.toString()}
          renderItem={renderFriend}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                Bạn chưa có bạn bè nào để thêm vào nhóm
              </Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default CreateGroupScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    paddingBottom: 14,
    paddingHorizontal: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    padding: 4,
    marginRight: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  createBtn: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  nameSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: "#fff",
  },
  cameraIcon: {
    marginRight: 12,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    padding: 0,
  },
  selectedSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#faf5ff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ede9fe",
  },
  selectedLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  validationText: {
    fontSize: 12,
    color: "#b45309",
    marginBottom: 6,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  chipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.backgroundMuted,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
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
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  empty: {
    padding: 30,
    alignItems: "center",
  },
  emptyText: {
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
});
