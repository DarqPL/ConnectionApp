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

interface Member {
  userId: number;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  role: string;
}

interface MemberRoleModalProps {
  visible: boolean;
  onClose: () => void;
  member: Member | null;
  currentUserRole: string | null;
  currentUserId: number;
  conversationId: number;
  onRoleUpdate: (memberId: number, newRole: string) => Promise<void>;
}

const roleDescriptions: Record<string, string> = {
  OWNER: "Chủ nhóm - Có quyền quản lý nhóm hoàn toàn",
  CO_OWNER: "Phó nhóm - Có quyền quản lý thành viên như chủ nhóm",
  MEMBER: "Thành viên - Quyền hạn tiêu chuẩn",
};

const roleColors: Record<string, string> = {
  OWNER: "#f59e0b",
  CO_OWNER: "#3b82f6",
  MEMBER: "#6b7280",
};

export const MemberRoleModal: React.FC<MemberRoleModalProps> = ({
  visible,
  onClose,
  member,
  currentUserRole,
  currentUserId,
  conversationId,
  onRoleUpdate,
}) => {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!member) return null;

  const getAvailableRoles = (): string[] => {
    if (!currentUserRole) return [];

    if (currentUserRole === "OWNER") {
      return ["CO_OWNER", "MEMBER"];
    }
    if (currentUserRole === "CO_OWNER") {
      return ["MEMBER"];
    }
    return [];
  };

  const availableRoles = getAvailableRoles();
  const canManageRoles =
    currentUserRole === "OWNER" || currentUserRole === "CO_OWNER";

  const handleSaveRole = async () => {
    if (!selectedRole) {
      Alert.alert("Lỗi", "Vui lòng chọn một vai trò");
      return;
    }

    if (member.userId === currentUserId) {
      Alert.alert("Lỗi", "Không thể thay đổi vai trò của chính mình");
      return;
    }

    setIsLoading(true);
    try {
      await onRoleUpdate(member.userId, selectedRole);
      Alert.alert("Thành công", `Đã cập nhật vai trò của ${member.displayName}`);
      setSelectedRole(null);
      onClose();
    } catch (error) {
      Alert.alert("Lỗi", "Không thể cập nhật vai trò");
      console.error("Lỗi cập nhật vai trò:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Quản lý vai trò thành viên</Text>
            <TouchableOpacity onPress={onClose} disabled={isLoading}>
              <Ionicons
                name="close"
                size={28}
                color={COLORS.text}
              />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Member Info */}
            <View style={styles.memberInfo}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: roleColors[member.role] },
                ]}
              >
                <Text style={styles.avatarText}>
                  {member.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberDetails}>
                <Text style={styles.memberName}>{member.displayName}</Text>
                <Text style={styles.username}>@{member.username}</Text>
              </View>
            </View>

            {/* Current Role */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vai trò hiện tại</Text>
              <View
                style={[
                  styles.roleCard,
                  {
                    borderLeftColor: roleColors[member.role],
                  },
                ]}
              >
                <Text style={styles.roleName}>{member.role}</Text>
                <Text style={styles.roleDesc}>
                  {roleDescriptions[member.role]}
                </Text>
              </View>
            </View>

            {/* Role Selector */}
            {canManageRoles ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Chọn vai trò mới</Text>
                {availableRoles.map((role) => (
                  <TouchableOpacity
                    key={role}
                    onPress={() => setSelectedRole(role)}
                    disabled={isLoading}
                    style={[
                      styles.roleOption,
                      selectedRole === role && styles.roleOptionSelected,
                    ]}
                  >
                    <View
                      style={[
                        styles.roleCheckbox,
                        selectedRole === role && styles.roleCheckboxSelected,
                      ]}
                    >
                      {selectedRole === role && (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color="#fff"
                        />
                      )}
                    </View>
                    <View style={styles.roleOptionContent}>
                      <Text style={styles.roleOptionName}>{role}</Text>
                      <Text style={styles.roleOptionDesc}>
                        {roleDescriptions[role]}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {selectedRole && selectedRole !== member.role && (
                  <View style={styles.warning}>
                    <Ionicons
                      name="alert-circle"
                      size={20}
                      color="#b45309"
                    />
                    <Text style={styles.warningText}>
                      {selectedRole === "CO_OWNER"
                        ? "Thành viên này sẽ có quyền quản lý nhóm tương tự như bạn"
                        : "Thành viên này sẽ trở lại thành viên thường"}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.section}>
                <View style={styles.noPermission}>
                  <Text style={styles.noPermissionText}>
                    Bạn không có quyền thay đổi vai trò thành viên
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Đóng</Text>
            </TouchableOpacity>
            {canManageRoles && selectedRole && selectedRole !== member.role && (
              <TouchableOpacity
                style={[styles.button, styles.submitButton]}
                onPress={handleSaveRole}
                disabled={isLoading}
              >
                <Text style={styles.submitButtonText}>
                  {isLoading ? "Đang cập nhật..." : "Cập nhật vai trò"}
                </Text>
              </TouchableOpacity>
            )}
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.background,
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  username: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
  },
  roleCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
  },
  roleName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  roleDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  roleOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + "15",
  },
  roleCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  roleCheckboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleOptionContent: {
    flex: 1,
  },
  roleOptionName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  roleOptionDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  warningText: {
    fontSize: 12,
    color: "#92400e",
    marginLeft: 8,
    flex: 1,
  },
  noPermission: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
  },
  noPermissionText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
