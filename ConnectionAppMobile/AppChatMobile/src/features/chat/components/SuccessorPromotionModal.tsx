import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";
import type { Participant, Conversation } from "../types";

interface SuccessorPromotionModalProps {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  currentUserId: number;
  coOwner: Participant | null;
  onPromotionComplete?: () => void;
  onRoleUpdate: (memberId: number, newRole: string) => Promise<void>;
}

type SuccessionMode = "auto-promote" | "select-other";

export const SuccessorPromotionModal: React.FC<SuccessorPromotionModalProps> = ({
  visible,
  onClose,
  conversation,
  currentUserId,
  coOwner,
  onPromotionComplete,
  onRoleUpdate,
}) => {
  const [mode, setMode] = useState<SuccessionMode>("auto-promote");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!conversation) return null;

  const otherMembers = conversation.participants.filter(
    (p) =>
      p.userId !== currentUserId &&
      p.role !== "OWNER" &&
      (mode === "select-other" ? p.userId !== coOwner?.userId : true)
  );

  const handleConfirm = async () => {
    try {
      setIsLoading(true);

      if (mode === "auto-promote" && coOwner) {
        await onRoleUpdate(coOwner.userId, "OWNER");
        Alert.alert(
          "Thành công",
          `${coOwner.displayName} đã được nâng lên làm nhóm trưởng`
        );
      } else if (mode === "select-other" && selectedMemberId) {
        await onRoleUpdate(selectedMemberId, "OWNER");
        const selectedMember = conversation.participants.find(
          (p) => p.userId === selectedMemberId
        );
        Alert.alert(
          "Thành công",
          `${selectedMember?.displayName} đã được nâng lên làm nhóm trưởng`
        );
      } else {
        Alert.alert("Lỗi", "Vui lòng chọn một người để làm nhóm trưởng");
        return;
      }

      onPromotionComplete?.();
      onClose();
    } catch (error) {
      Alert.alert("Lỗi", "Không thể nâng cấp nhóm phó");
      console.error("Lỗi nâng cấp:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Chọn nhóm trưởng tiếp theo</Text>
            <TouchableOpacity onPress={onClose} disabled={isLoading}>
              <Ionicons name="close" size={28} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            Bạn sắp rời khỏi nhóm. Vui lòng chọn ai sẽ làm nhóm trưởng tiếp theo.
          </Text>

          <ScrollView style={styles.optionsContainer}>
            {/* Auto-promote CO_OWNER option */}
            {coOwner && (
              <View style={styles.optionGroup}>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setMode("auto-promote")}
                >
                  <View
                    style={[
                      styles.radio,
                      mode === "auto-promote" && styles.radioSelected,
                    ]}
                  >
                    {mode === "auto-promote" && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={COLORS.primary}
                      />
                    )}
                  </View>
                  <Text style={styles.optionLabel}>
                    Tự động nâng cấp nhóm phó
                  </Text>
                </TouchableOpacity>

                {mode === "auto-promote" && (
                  <View style={styles.memberCard}>
                    <View
                      style={[
                        styles.memberAvatar,
                        { backgroundColor: COLORS.primary },
                      ]}
                    >
                      <Text style={styles.memberAvatarText}>
                        {coOwner.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {coOwner.displayName}
                      </Text>
                      <Text style={styles.memberRole}>Nhóm phó hiện tại</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Manual selection option */}
            <View style={styles.optionGroup}>
              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => setMode("select-other")}
              >
                <View
                  style={[
                    styles.radio,
                    mode === "select-other" && styles.radioSelected,
                  ]}
                >
                  {mode === "select-other" && (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={COLORS.primary}
                    />
                  )}
                </View>
                <Text style={styles.optionLabel}>Chọn thành viên khác</Text>
              </TouchableOpacity>

              {mode === "select-other" && (
                <View style={styles.membersListContainer}>
                  {otherMembers.length === 0 ? (
                    <Text style={styles.noMembers}>
                      Không có thành viên khác để chọn
                    </Text>
                  ) : (
                    otherMembers.map((member) => (
                      <TouchableOpacity
                        key={member.id}
                        style={[
                          styles.memberSelectItem,
                          selectedMemberId === member.userId &&
                            styles.memberSelectItemSelected,
                        ]}
                        onPress={() => setSelectedMemberId(member.userId)}
                      >
                        <View
                          style={[
                            styles.memberAvatar,
                            { backgroundColor: COLORS.primary },
                          ]}
                        >
                          <Text style={styles.memberAvatarText}>
                            {member.displayName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>
                            {member.displayName}
                          </Text>
                          <Text style={styles.memberRole}>{member.role}</Text>
                        </View>
                        {selectedMemberId === member.userId && (
                          <Ionicons
                            name="checkmark-circle"
                            size={24}
                            color={COLORS.primary}
                          />
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.buttonSecondary}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.buttonSecondaryText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.buttonPrimary}
              onPress={handleConfirm}
              disabled={isLoading}
            >
              <Text style={styles.buttonPrimaryText}>
                {isLoading ? "Đang xử lý..." : "Xác nhận"}
              </Text>
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
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  description: {
    fontSize: 13,
    color: COLORS.textMuted,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  optionsContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionGroup: {
    marginBottom: 16,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  radioSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + "15",
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 8,
    backgroundColor: COLORS.primary + "15",
    borderRadius: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  memberRole: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  membersListContainer: {
    paddingHorizontal: 12,
    marginTop: 8,
  },
  memberSelectItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 4,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  memberSelectItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + "15",
  },
  noMembers: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
    paddingVertical: 16,
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  buttonSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  buttonPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPrimaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
