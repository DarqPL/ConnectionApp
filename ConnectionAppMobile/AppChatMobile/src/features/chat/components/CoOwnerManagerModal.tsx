import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";
import { chatService } from "../services/chat.service";
import type { Conversation, Participant } from "../types";

interface CoOwnerManagerModalProps {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation;
  currentUserId: number;
  onUpdated: () => void;
}

export function CoOwnerManagerModal({
  visible,
  onClose,
  conversation,
  currentUserId,
  onUpdated,
}: CoOwnerManagerModalProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"manage" | "add">("manage");

  const owner = useMemo(
    () => conversation.participants.find((p) => p.role === "OWNER"),
    [conversation.participants]
  );
  const coOwners = useMemo(
    () => conversation.participants.filter((p) => p.role === "CO_OWNER"),
    [conversation.participants]
  );
  const regularMembers = useMemo(
    () => conversation.participants.filter((p) => p.role === "MEMBER"),
    [conversation.participants]
  );

  const filteredMembers = useMemo(() => {
    const list = mode === "add" ? regularMembers : coOwners;
    if (!search.trim()) return list;
    return list.filter((m) =>
      m.displayName.toLowerCase().includes(search.toLowerCase())
    );
  }, [regularMembers, coOwners, search, mode]);

  const toggleSelect = (userId: number) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) return;
    setIsLoading(true);
    try {
      if (mode === "add") {
        await chatService.addCoOwners(conversation.id, selectedIds);
        Alert.alert("Thành công", `Đã thêm ${selectedIds.length} phó nhóm`);
      } else {
        for (const id of selectedIds) {
          await chatService.removeCoOwner(conversation.id, id);
        }
        Alert.alert("Thành công", `Đã xoá ${selectedIds.length} phó nhóm`);
      }
      onUpdated();
      setSelectedIds([]);
      setMode("manage");
      onClose();
    } catch (e: any) {
      Alert.alert("Lỗi", e.message || "Không thể cập nhật phó nhóm");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCoOwner = async (memberId: number) => {
    Alert.alert("Xác nhận", "Bạn có chắc muốn xoá phó nhóm này?", [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Xoá",
        style: "destructive",
        onPress: async () => {
          setIsLoading(true);
          try {
            await chatService.removeCoOwner(conversation.id, memberId);
            onUpdated();
            Alert.alert("Thành công", "Đã xoá phó nhóm");
          } catch (e: any) {
            Alert.alert("Lỗi", e.message || "Không thể xoá phó nhóm");
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Trưởng & phó nhóm</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Owner */}
          {owner && (
            <View style={styles.ownerRow}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {owner.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.ownerName}>{owner.displayName}</Text>
                <Text style={styles.ownerRole}>Trưởng nhóm</Text>
              </View>
            </View>
          )}

          {/* Co-owners */}
          {coOwners.length > 0 && mode === "manage" && (
            <View style={styles.coOwnerList}>
              {coOwners.map((co) => (
                <View key={co.userId} style={styles.coOwnerRow}>
                  <View style={styles.avatarSmall}>
                    <Text style={styles.avatarTextSmall}>
                      {co.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coOwnerName}>{co.displayName}</Text>
                    <Text style={styles.coOwnerRole}>Phó nhóm</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemoveCoOwner(co.userId)}
                    disabled={isLoading}
                  >
                    <Text style={styles.removeBtnText}>Xoá</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Action buttons */}
          {mode === "manage" && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  setMode("add");
                  setSelectedIds([]);
                }}
              >
                <Text style={styles.actionBtnText}>Thêm phó nhóm</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Chuyển quyền trưởng nhóm</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Add mode */}
          {mode === "add" && (
            <View style={styles.addMode}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={COLORS.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm kiếm thành viên"
                  placeholderTextColor={COLORS.textMuted}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
              <ScrollView style={styles.memberList}>
                {filteredMembers.map((member) => {
                  const isSelected = selectedIds.includes(member.userId);
                  return (
                    <TouchableOpacity
                      key={member.userId}
                      style={styles.memberRow}
                      onPress={() => toggleSelect(member.userId)}
                    >
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        )}
                      </View>
                      <View style={styles.avatarSmall}>
                        <Text style={styles.avatarTextSmall}>
                          {member.displayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.memberName}>{member.displayName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setMode("manage");
                    setSelectedIds([]);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Huỷ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, selectedIds.length === 0 && styles.confirmBtnDisabled]}
                  onPress={handleConfirm}
                  disabled={selectedIds.length === 0 || isLoading}
                >
                  <Text style={styles.confirmBtnText}>
                    {isLoading ? "Đang xử lý..." : "Xác nhận"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.primary,
  },
  ownerName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  ownerRole: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  coOwnerList: {
    paddingVertical: 8,
  },
  coOwnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTextSmall: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
  coOwnerName: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
  },
  coOwnerRole: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  removeBtn: {
    backgroundColor: COLORS.destructive,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  actionButtons: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  actionBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  addMode: {
    flex: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  memberList: {
    flex: 1,
    maxHeight: 300,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  memberName: {
    fontSize: 14,
    color: COLORS.text,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
