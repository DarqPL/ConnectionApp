import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { COLORS } from "../../../theme";
import type { Conversation } from "../types";

interface DisbandGroupModalProps {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  onDisband: () => Promise<void>;
}

export function DisbandGroupModal({
  visible,
  onClose,
  conversation,
  onDisband,
}: DisbandGroupModalProps) {
  const handleDisband = async () => {
    await onDisband();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Giải tán nhóm</Text>
          <Text style={styles.description}>
            Mời tất cả mọi người rời nhóm và xóa tin nhắn? Nhóm đã giải tán sẽ{" "}
            <Text style={styles.bold}>KHÔNG THỂ</Text> khôi phục.
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Không</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.disbandBtn} onPress={handleDisband}>
              <Text style={styles.disbandText}>Giải tán nhóm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 340,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    marginBottom: 20,
  },
  bold: {
    fontWeight: "700",
    color: COLORS.destructive,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  disbandBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.destructive,
  },
  disbandText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
