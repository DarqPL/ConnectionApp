import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
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
  if (role === "OWNER") return "shield-checkmark";
  if (role === "CO_OWNER") return "flash";
  return "person";
};

export const MemberListModal: React.FC<MemberListModalProps> = ({
  visible,
  onClose,
  members,
  currentUserRole,
  currentUserId,
  conversationId,
  onRoleUpdate,
}) => {
  const [selectedMember, setSelectedMember] = useState<Participant | null>(null);
  const [isRoleModalVisible, setIsRoleModalVisible] = useState(false);

  const canManageRoles =
    currentUserRole === "OWNER" || currentUserRole === "CO_OWNER";

  const sortedMembers = useMemo(() => {
    const roleOrder: Record<string, number> = {
      OWNER: 0,
      CO_OWNER: 1,
      MEMBER: 2,
    };
    return [...members].sort((a, b) => {
      return (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
    });
  }, [members]);

  const handleMemberPress = (member: Participant) => {
    if (canManageRoles) {
      setSelectedMember(member);
      setIsRoleModalVisible(true);
    }
  };

  const renderMemberItem = ({ item: member }: { item: Participant }) => (
    <TouchableOpacity
      style={styles.memberItem}
      onPress={() => handleMemberPress(member)}
      disabled={!canManageRoles}
      activeOpacity={canManageRoles ? 0.7 : 1}
    >
      <View
        style={[
          styles.memberAvatar,
          { backgroundColor: roleColors[member.role] },
        ]}
      >
        <Text style={styles.memberAvatarText}>
          {member.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.memberContent}>
        <View style={styles.memberHeader}>
          <Text style={styles.memberName}>{member.displayName}</Text>
          <Ionicons
            name={getRoleIcon(member.role) as any}
            size={16}
            color={roleColors[member.role]}
          />
        </View>
        <Text style={styles.memberUsername}>@{member.username}</Text>
      </View>

      <View
        style={[
          styles.roleBadge,
          { backgroundColor: roleColors[member.role] },
        ]}
      >
        <Text style={styles.roleBadgeText}>{getRoleLabel(member.role)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
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
              <View style={styles.headerTitle}>
                <Text style={styles.title}>
                  Danh sách thành viên ({members.length})
                </Text>
                <Text style={styles.subtitle}>
                  {canManageRoles
                    ? "Nhấn để thay đổi vai trò"
                    : "Xem danh sách thành viên"}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Ionicons
                  name="close"
                  size={28}
                  color={COLORS.text}
                />
              </TouchableOpacity>
            </View>

            {/* Members List */}
            <FlatList
              data={sortedMembers}
              renderItem={renderMemberItem}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />

            {/* Close Button */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
              >
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
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginVertical: 4,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  memberContent: {
    flex: 1,
  },
  memberHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginRight: 6,
  },
  memberUsername: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
