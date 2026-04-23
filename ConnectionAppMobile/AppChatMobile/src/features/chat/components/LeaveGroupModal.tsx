import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";
import type { Conversation } from "../types";

interface LeaveGroupModalProps {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  currentUserId: number;
  currentUserRole: string | null;
  onLeaveConfirmed: (transferToUserId?: number) => Promise<void>;
}

export const LeaveGroupModal: React.FC<LeaveGroupModalProps> = ({
  visible,
  onClose,
  conversation,
  currentUserId,
  currentUserRole,
  onLeaveConfirmed,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filter eligible members for role transfer
  const eligibleMembers = useMemo(() => {
    if (!conversation) return [];
    return conversation.participants.filter(
      (p) => p.userId !== currentUserId && p.role !== "OWNER"
    );
  }, [conversation, currentUserId]);

  const isOwnerWithMultipleMembers =
    currentUserRole === "OWNER" && conversation && conversation.participants.length > 1;

  const handleLeave = async () => {
    if (isOwnerWithMultipleMembers && !selectedMemberId) {
      Alert.alert("Lỗi", "Vui lòng chọn người để nhận quyền quản lý");
      return;
    }

    setIsLoading(true);
    try {
      await onLeaveConfirmed(selectedMemberId || undefined);
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể rời khỏi nhóm";
      Alert.alert("Lỗi", message);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmMessage =
    currentUserRole === "OWNER" && conversation && conversation.participants.length === 1
      ? "Bạn có chắc chắn muốn rời khỏi và xóa nhóm này không?"
      : "Bạn có chắc chắn muốn rời khỏi nhóm này không?";

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isOwnerWithMultipleMembers
                ? "Chuyển quyền quản lý nhóm"
                : "Rời khỏi nhóm"}
            </Text>
            <TouchableOpacity onPress={onClose} disabled={isLoading}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Description */}
          {isOwnerWithMultipleMembers && (
            <Text style={styles.description}>
              Vui lòng chọn một thành viên để nhận quyền quản lý nhóm trước khi
              bạn rời khỏi.
            </Text>
          )}

          {/* Member Selection */}
          {isOwnerWithMultipleMembers && eligibleMembers.length > 0 && (
            <View style={styles.membersContainer}>
              <FlatList
                data={eligibleMembers}
                keyExtractor={(item) => String(item.userId)}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.memberItem,
                      selectedMemberId === item.userId &&
                        styles.memberItemSelected,
                    ]}
                    onPress={() => setSelectedMemberId(item.userId)}
                    disabled={isLoading}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        selectedMemberId === item.userId &&
                          styles.checkboxSelected,
                      ]}
                    >
                      {selectedMemberId === item.userId && (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={COLORS.background}
                        />
                      )}
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {item.displayName}
                      </Text>
                      <Text style={styles.memberRole}>{item.role}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {isOwnerWithMultipleMembers && eligibleMembers.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Không có thành viên khác để chuyển quyền
              </Text>
            </View>
          )}

          {/* Confirmation Text */}
          <View style={styles.confirmSection}>
            <Text style={styles.confirmText}>{confirmMessage}</Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                (isLoading ||
                  Boolean(
                    isOwnerWithMultipleMembers && !selectedMemberId,
                  )) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleLeave}
              disabled={
                isLoading ||
                Boolean(isOwnerWithMultipleMembers && !selectedMemberId)
              }
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.background} size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  {currentUserRole === "OWNER" &&
                  conversation &&
                  conversation.participants.length === 1
                    ? "Xóa nhóm"
                    : currentUserRole === "OWNER"
                    ? "Chuyển quyền & Rời"
                    : "Rời khỏi nhóm"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  description: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 16,
    lineHeight: 20,
  },
  membersContainer: {
    marginBottom: 16,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  memberItemSelected: {
    backgroundColor: COLORS.primary + "10",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: "uppercase",
  },
  emptyState: {
    paddingVertical: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
  },
  confirmSection: {
    marginVertical: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.destructive + "10",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.destructive,
  },
  confirmText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: COLORS.backgroundMuted,
  },
  cancelButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
  confirmButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
