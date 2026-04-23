import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";
import { MemberRoleModal } from "./MemberRoleModal";
import type { Participant } from "../types";

interface MemberListModalProps {
  visible: boolean;
  onClose: () => void;
  members: Participant[];
  currentUserRole: string | null;
  currentUserId: number;
  conversationId: number;
  onRoleUpdate: (memberId: number, newRole: string) => Promise<void>;
  onRemoveMember?: (memberId: number) => void | Promise<void>;
}

const roleColors: Record<string, string> = {
  OWNER: "#f59e0b",
  CO_OWNER: "#3b82f6",
  MEMBER: "#6b7280",
};

const getRoleLabel = (role: string): string => {
  if (role === "OWNER") return "Chủ nhóm";
  if (role === "CO_OWNER") return "Phó nhóm";
  return "Thành viên";
};

const getRoleIcon = (role: string): string => {
  if (role === "OWNER") return "star";
  if (role === "CO_OWNER") return "star-outline";
  return "person-outline";
};

export const MemberListModal: React.FC<MemberListModalProps> = ({
  visible,
  onClose,
  members,
  currentUserRole,
  currentUserId,
  conversationId,
  onRoleUpdate,
  onRemoveMember,
}) => {
  const [selectedMember, setSelectedMember] = useState<Participant | null>(
    null,
  );
  const [isRoleModalVisible, setIsRoleModalVisible] = useState(false);

  const canManageRoles =
    currentUserRole === "OWNER" || currentUserRole === "CO_OWNER";

  const sortedMembers = useMemo(() => {
    console.log(`[MemberListModal] Recalculating sortedMembers. Total: ${members?.length || 0}`);
    if (!members) return [];
    
    const roleOrder: Record<string, number> = {
      OWNER: 0,
      CO_OWNER: 1,
      MEMBER: 2,
    };
    return [...members].sort((a, b) => {
      const aOrder = a.role ? (roleOrder[a.role.toUpperCase()] ?? 3) : 3;
      const bOrder = b.role ? (roleOrder[b.role.toUpperCase()] ?? 3) : 3;
      return aOrder - bOrder;
    });
  }, [members]);

  const handleMemberPress = (member: Participant) => {
    // Only allow managing others if current user is owner/co-owner
    if (canManageRoles && member.userId !== currentUserId) {
      setSelectedMember(member);
      setIsRoleModalVisible(true);
    }
  };

  const handleRemovePress = (member: Participant) => {
    console.log(`[MemberListModal] Confirming removal of user: ${member.userId}`);
    Alert.alert(
      "Xác nhận xóa",
      `Bạn có chắc chắn muốn xóa ${member.displayName} khỏi nhóm?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              if (onRemoveMember) {
                console.log(`[MemberListModal] Removing member: ${member.userId} from conv: ${conversationId}`);
                await onRemoveMember(member.userId);
                console.log(`[MemberListModal] Removal completed for: ${member.userId}`);
              } else {
                console.warn("[MemberListModal] onRemoveMember callback missing");
              }
            } catch (error) {
              console.error("[MemberListModal] Removal failed:", error);
              Alert.alert("Lỗi", "Không thể xóa thành viên. Vui lòng thử lại sau.");
            }
          },
        },
      ],
    );
  };

  const canRemove = (member: Participant) => {
    if (member.userId === currentUserId) return false;
    const role = currentUserRole?.toUpperCase();
    const targetRole = member.role?.toUpperCase();

    // Owner can remove anyone (except themselves)
    if (role === "OWNER") return true;
    // Co-owner can remove Member
    if (role === "CO_OWNER" && targetRole === "MEMBER") return true;
    return false;
  };

  const renderMemberItem = ({ item: member }: { item: Participant }) => {
    const isCurrentUser = member.userId === currentUserId;
    const canManageThisMember = canManageRoles && !isCurrentUser;

    return (
      <View style={styles.memberItem}>
        <TouchableOpacity
          style={styles.memberMainAction}
          onPress={() => handleMemberPress(member)}
          disabled={!canManageThisMember}
          activeOpacity={canManageThisMember ? 0.7 : 1}
        >
          <View style={styles.memberAvatarWrap}>
            {member.avatarUrl ? (
              <Image source={{ uri: member.avatarUrl }} style={styles.memberAvatar} />
            ) : (
              <View
                style={[
                  styles.memberAvatarCircle,
                  { backgroundColor: (roleColors[member.role?.toUpperCase() || "MEMBER"] || "#6b7280") + "20" },
                ]}
              >
                <Text
                  style={[styles.memberAvatarText, { color: roleColors[member.role?.toUpperCase() || "MEMBER"] || "#6b7280" }]}
                >
                  {member.displayName?.charAt(0).toUpperCase() || "?"}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.roleIndicator,
                { backgroundColor: roleColors[member.role?.toUpperCase() || "MEMBER"] || "#6b7280" },
              ]}
            >
              <Ionicons
                name={getRoleIcon(member.role?.toUpperCase() || "MEMBER") as any}
                size={10}
                color="#fff"
              />
            </View>
          </View>

          <View style={styles.memberContent}>
            <View>
              <Text style={styles.memberName} numberOfLines={1}>
                {member.displayName}
                {isCurrentUser ? " (Bạn)" : ""}
              </Text>
            </View>
            <Text style={styles.memberRoleLabel}>{getRoleLabel(member.role?.toUpperCase() || "MEMBER")}</Text>
          </View>
        </TouchableOpacity>

        {canRemove(member) && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemovePress(member)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="person-remove-outline" size={22} color="#dc2626" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={onClose}
          />
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitle}>
                <Text style={styles.title}>
                  Thành viên ({members.length})
                </Text>
                <Text style={styles.subtitle}>
                  {canManageRoles
                    ? "Nhấn để thay đổi vai trò"
                    : "Xem danh sách thành viên"}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeHeaderBtn}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Members List */}
            <FlatList
              data={sortedMembers}
              renderItem={renderMemberItem}
              keyExtractor={(item) => item.userId.toString()}
              scrollEnabled
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Member Role Modal */}
      {selectedMember && (
        <MemberRoleModal
          visible={isRoleModalVisible}
          onClose={() => {
            setIsRoleModalVisible(false);
            setSelectedMember(null);
          }}
          member={{
            userId: selectedMember.userId,
            displayName: selectedMember.displayName,
            username: selectedMember.username,
            avatarUrl: selectedMember.avatarUrl,
            role: selectedMember.role,
          }}
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          conversationId={conversationId}
          onRoleUpdate={onRoleUpdate}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
  },
  content: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingBottom: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  closeHeaderBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 4,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
  },
  memberMainAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  memberAvatarWrap: {
    position: "relative",
    marginRight: 14,
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e2e8f0",
  },
  memberAvatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  memberAvatarText: {
    fontSize: 20,
    fontWeight: "700",
  },
  roleIndicator: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  memberContent: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  memberRoleLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
