import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";
import type { Conversation } from "../types";

interface BlockedMembersModalProps {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation | null;
}

export function BlockedMembersModal({
  visible,
  onClose,
  conversation,
}: BlockedMembersModalProps) {
  const blockedMembers = conversation?.blockedMembers || [];

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

          {blockedMembers.length > 0 && (
            <ScrollView style={styles.blockedList}>
              {blockedMembers.map((member) => (
                <View key={member.userId} style={styles.blockedRow}>
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {member.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.blockedName}>{member.displayName}</Text>
                  <TouchableOpacity style={styles.unblockBtn}>
                    <Text style={styles.unblockText}>Bỏ chặn</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
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
    borderColor: COLORS.border,
  },
  unblockText: {
    fontSize: 12,
    color: COLORS.textMuted,
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
