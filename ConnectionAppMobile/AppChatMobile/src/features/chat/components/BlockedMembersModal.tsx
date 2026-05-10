import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";
import type { Conversation } from "../types";
import { chatService } from "../services/chat.service";

interface BlockedMembersModalProps {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  onSettingsUpdated?: () => void;
}

export function BlockedMembersModal({
  visible,
  onClose,
  conversation,
  onSettingsUpdated,
}: BlockedMembersModalProps) {
  const [blockedMembers, setBlockedMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!visible || !conversation) return;
    fetchBlockedMembers();
  }, [visible, conversation?.id]);

  const fetchBlockedMembers = async () => {
    if (!conversation) return;
    setIsLoading(true);
    try {
      const data = await chatService.getBlockedMembers(conversation.id);
      setBlockedMembers(data || []);
    } catch {
      setBlockedMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblock = async (memberId: number) => {
    if (!conversation) return;
    Alert.alert("Xác nhận", "Bạn có chắc muốn bỏ chặn thành viên này?", [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Bỏ chặn",
        style: "default",
        onPress: async () => {
          try {
            await chatService.unblockMember(conversation.id, memberId);
            setBlockedMembers((prev) => prev.filter((m) => m.userId !== memberId));
            onSettingsUpdated?.();
            Alert.alert("Thành công", "Đã bỏ chặn thành viên");
          } catch (e: any) {
            Alert.alert("Lỗi", e.message || "Không thể bỏ chặn");
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="ban-outline" size={22} color={COLORS.text} />
              <Text style={styles.headerTitle}>Chặn khỏi nhóm</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.infoBlock}>
            <Ionicons name="person-remove-outline" size={48} color={COLORS.textMuted + "40"} />
            <Text style={styles.infoText}>
              Những người đã bị chặn không thể tham gia lại nhóm, trừ khi được
              trưởng/phó nhóm bỏ chặn hoặc thêm lại vào nhóm.
            </Text>
          </View>

          {isLoading ? (
            <ActivityIndicator size="small" color={COLORS.textMuted} style={{ paddingVertical: 24 }} />
          ) : blockedMembers.length > 0 ? (
            <ScrollView style={styles.blockedList}>
              {blockedMembers.map((member) => (
                <View key={member.userId} style={styles.blockedRow}>
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {member.displayName?.charAt(0).toUpperCase() || "?"}
                    </Text>
                  </View>
                  <Text style={styles.blockedName}>{member.displayName}</Text>
                  <TouchableOpacity
                    style={styles.unblockBtn}
                    onPress={() => handleUnblock(member.userId)}
                  >
                    <Text style={styles.unblockText}>Bỏ chặn</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={[styles.infoText, { paddingVertical: 24 }]}>
              Không có thành viên nào bị chặn
            </Text>
          )}

          <TouchableOpacity style={styles.addBlockBtn} disabled>
            <Text style={styles.addBlockText}>Thêm vào danh sách chặn</Text>
          </TouchableOpacity>
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
    maxHeight: "70%",
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  infoBlock: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 18,
  },
  blockedList: {
    maxHeight: 200,
    paddingHorizontal: 16,
  },
  blockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6b7280",
  },
  blockedName: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  unblockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  unblockText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "600",
  },
  addBlockBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.destructive,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.5,
  },
  addBlockText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
