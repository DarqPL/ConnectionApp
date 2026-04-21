import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../../../theme";
import type { Conversation, Friend } from "../types";
import { friendService } from "../services/friend.service";
import { chatService } from "../services/chat.service";

// Local item type for selection
interface SelectableFriend extends Friend { }

interface AddMemberModalProps {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  onMemberAdded?: () => void;
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({
  visible,
  onClose,
  conversation,
  onMemberAdded,
}) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [friends, setFriends] = useState<SelectableFriend[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load friends on mount
  useEffect(() => {
    if (!visible) return;

    const loadFriends = async () => {
      try {
        console.log("[AddMemberModal] Loading friends...");
        setLoading(true);
        const friendsList = await friendService.getFriends();
        console.log(`[AddMemberModal] Loaded ${friendsList?.length || 0} friends`);

        // Ensure friendsList is an array
        if (Array.isArray(friendsList)) {
          setFriends(friendsList);
        } else {
          console.warn("[AddMemberModal] getFriends returned non-array:", friendsList);
          setFriends([]);
        }
      } catch (error) {
        console.error("[AddMemberModal] Error loading friends:", error);
        Alert.alert("Lỗi", "Không thể tải danh sách bạn");
      } finally {
        setLoading(false);
      }
    };

    loadFriends();
  }, [visible]);

  const isAlreadyInGroup = (friendId: number) => {
    if (!conversation?.participants) return false;
    return conversation.participants.some((p) => Number(p.userId) === Number(friendId));
  };

  const toggleMember = (memberId: number) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleAddMembers = async () => {
    if (selectedMembers.length === 0) {
      Alert.alert("Thông báo", "Vui lòng chọn ít nhất một thành viên");
      return;
    }

    setIsSubmitting(true);
    try {
      if (!conversation) return;

      console.log(`[AddMemberModal] Adding ${selectedMembers.length} members to group: ${conversation.id}`);

      for (const memberId of selectedMembers) {
        await chatService.addMemberToGroup(conversation.id, memberId);
      }

      Alert.alert("Thành công", `Đã thêm ${selectedMembers.length} thành viên`);
      setSelectedMembers([]);
      setSearchQuery("");
      onMemberAdded?.();
      onClose();
    } catch (error) {
      console.error("[AddMemberModal] Error adding members:", error);
      const message = error instanceof Error ? error.message : "Không thể thêm thành viên";
      Alert.alert("Lỗi", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFriends = searchQuery.trim()
    ? friends.filter(
      (f) =>
        f.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.username?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : friends;

  const availableFriends = filteredFriends.filter(
    (f) => !isAlreadyInGroup(f.friendId)
  );

  const renderFriendItem = ({ item }: { item: SelectableFriend }) => (
    <TouchableOpacity
      style={[styles.friendItem, { paddingHorizontal: 16 }]}
      onPress={() => toggleMember(item.friendId)}
      activeOpacity={0.7}
    >
      <View style={styles.checkboxWrap}>
        <View
          style={[
            styles.checkbox,
            selectedMembers.includes(item.friendId) && styles.checkboxSelected,
          ]}
        >
          {selectedMembers.includes(item.friendId) && (
            <Ionicons name="checkmark" size={16} color="#fff" />
          )}
        </View>
      </View>

      <View style={styles.avatarWrap}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatar,
              { backgroundColor: COLORS.primary + "10" },
            ]}
          >
            <Text style={styles.avatarText}>
              {item.displayName?.charAt(0).toUpperCase() || "?"}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.displayName}</Text>
        <Text style={styles.friendEmail} numberOfLines={1}>
          @{item.username}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <LinearGradient
          colors={COLORS.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={onClose}
            disabled={isSubmitting}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Thêm thành viên</Text>
            {selectedMembers.length > 0 && (
              <Text style={styles.headerSubtitle}>
                Đã chọn {selectedMembers.length} thành viên
              </Text>
            )}
          </View>
        </LinearGradient>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={18}
            color={COLORS.background}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm theo tên hoặc username..."
            placeholderTextColor={COLORS.background}
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={!isSubmitting}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={18} color={COLORS.background} />
            </TouchableOpacity>
          )}
        </View>

        {/* Friend List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Đang tải danh sách bạn bè...</Text>
          </View>
        ) : availableFriends.length > 0 ? (
          <FlatList
            data={availableFriends}
            renderItem={renderFriendItem}
            keyExtractor={(item) => item.friendId.toString()}
            scrollEnabled={true}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.centerContainer}>
            <Ionicons
              name="people-outline"
              size={64}
              color={COLORS.background + "40"}
            />
            <Text style={styles.emptyText}>
              {searchQuery ? "Không tìm thấy bạn bè nào" : "Không có bạn bè khả dụng để thêm"}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footerButtons}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onClose}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelButtonText}>Hủy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              styles.confirmButton,
              (selectedMembers.length === 0 || isSubmitting) && styles.confirmButtonDisabled,
            ]}
            onPress={handleAddMembers}
            disabled={selectedMembers.length === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.confirmButtonText}>Thêm vào nhóm</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#fff",
    marginTop: 2,
    opacity: 0.8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border + "40",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.background,
  },
  clearButton: {
    padding: 6,
    marginLeft: 4,
  },
  listContent: {
    paddingVertical: 8,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + "20",
  },
  checkboxWrap: {
    marginRight: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  avatarWrap: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.background,
  },
  friendEmail: {
    fontSize: 12,
    color: COLORS.background,
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.background,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.background,
    marginTop: 12,
    textAlign: "center",
  },
  footerButtons: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border + "20",
    backgroundColor: COLORS.background,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.background,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
  confirmButtonDisabled: {
    backgroundColor: COLORS.primary + "50",
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});

export default AddMemberModal;
