import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";
import type { Reminder, Participant } from "../types";
import { chatService } from "../services/chat.service";
import { useChat } from "../context/ChatContext";
import { Image } from "react-native";

interface Props {
  messageId: string;
  conversationId: number;
  reminder: Reminder;
  currentUserId: number;
  participants: Participant[];
  onEdit?: () => void;
}

const ReminderMessage: React.FC<Props> = ({
  messageId,
  conversationId,
  reminder,
  currentUserId,
  participants = [],
  onEdit,
}) => {
  const { deleteReminder } = useChat();
  const [isLoading, setIsLoading] = useState<"join" | "decline" | null>(null);

  const participantIds = reminder.participantIds ?? [];
  const declinedIds = reminder.declinedIds ?? [];
  const isJoined = participantIds.includes(currentUserId);
  const isDeclined = declinedIds.includes(currentUserId);
  const isCreator = reminder.creatorId === currentUserId;
  const participantCount = participantIds.length;

  const joinedUsers = React.useMemo(() => {
    return participantIds
      .map((id) => participants.find((p) => p.userId === id))
      .filter((p): p is Participant => !!p);
  }, [participantIds, participants]);

  const declinedUsers = React.useMemo(() => {
    return declinedIds
      .map((id) => participants.find((p) => p.userId === id))
      .filter((p): p is Participant => !!p);
  }, [declinedIds, participants]);

  const reminderDate = new Date(reminder.reminderTime);
  const dateStr = reminderDate.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = reminderDate.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleJoin = async () => {
    if (isJoined || isLoading) return;
    setIsLoading("join");
    try {
      await chatService.joinReminder(messageId);
    } catch (e) {
      Alert.alert("Lỗi", "Không thể tham gia nhắc hẹn");
    } finally {
      setIsLoading(null);
    }
  };

  const handleDecline = async () => {
    if (isDeclined || isLoading) return;
    setIsLoading("decline");
    try {
      await chatService.declineReminder(messageId);
    } catch (e) {
      Alert.alert("Lỗi", "Không thể từ chối nhắc hẹn");
    } finally {
      setIsLoading(null);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Xóa nhắc hẹn",
      "Bạn có chắc muốn xóa nhắc hẹn này cho tất cả mọi người?",
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Xóa", 
          style: "destructive",
          onPress: async () => {
            try {
              await deleteReminder(messageId);
            } catch (e) {
              Alert.alert("Lỗi", "Không thể xóa nhắc hẹn");
            }
          }
        }
      ]
    );
  };

  const FALLBACK = "https://i.pravatar.cc/150?img=5";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="alarm-outline" size={16} color={COLORS.primary} />
          <Text style={styles.headerLabel}>LỜI NHẮC HẸN</Text>
        </View>
        <View style={styles.participantBadge}>
          <Ionicons name="people-outline" size={12} color={COLORS.primary} />
          <Text style={styles.participantText}>{participantCount} tham gia</Text>
        </View>
      </View>

      {/* Participant Lists (Always visible if not empty) */}
      {(joinedUsers.length > 0 || declinedUsers.length > 0) && (
        <View style={styles.membersExpand}>
          {joinedUsers.length > 0 && (
            <View style={styles.memberSection}>
              <Text style={styles.sectionTitle}>Đã tham gia ({joinedUsers.length})</Text>
              <View style={styles.avatarRow}>
                {joinedUsers.map((u) => (
                  <View key={`join-${u.userId}`} style={styles.avatarChip}>
                    <Image 
                      source={{ uri: u.avatarUrl || FALLBACK }} 
                      style={styles.miniAvatar} 
                    />
                    <Text style={styles.chipName} numberOfLines={1}>{u.displayName}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {declinedUsers.length > 0 && (
            <View style={styles.memberSection}>
              <Text style={[styles.sectionTitle, { color: "#ef4444" }]}>Từ chối ({declinedUsers.length})</Text>
              <View style={styles.avatarRow}>
                {declinedUsers.map((u) => (
                  <View key={`decline-${u.userId}`} style={styles.avatarChip}>
                    <Image 
                      source={{ uri: u.avatarUrl || FALLBACK }} 
                      style={[styles.miniAvatar, { borderColor: "#fee2e2" }]} 
                    />
                    <Text style={[styles.chipName, { color: "#991b1b" }]} numberOfLines={1}>{u.displayName}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.title}>{reminder.title}</Text>

        {!!reminder.content && (
          <Text style={styles.content}>{reminder.content}</Text>
        )}

        {/* Date / Time row */}
        <View style={styles.dateTimeRow}>
          <View style={styles.dateTimeItem}>
            <View style={styles.dateTimeIcon}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.dateTimeLabel}>Ngày</Text>
              <Text style={styles.dateTimeValue}>{dateStr}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.dateTimeItem}>
            <View style={styles.dateTimeIcon}>
              <Ionicons name="time-outline" size={16} color="#f59e0b" />
            </View>
            <View>
              <Text style={styles.dateTimeLabel}>Giờ nhắc</Text>
              <Text style={styles.dateTimeValue}>{timeStr}</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {/* Join */}
          <TouchableOpacity
            style={[
              styles.btn,
              isJoined ? styles.btnJoinedActive : styles.btnJoin,
            ]}
            onPress={handleJoin}
            disabled={isLoading !== null || isJoined}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isJoined ? "checkmark-circle" : "checkmark"}
              size={16}
              color={isJoined ? COLORS.primary : "#fff"}
            />
            <Text style={[styles.btnText, isJoined && styles.btnTextJoined]}>
              {isLoading === "join"
                ? "..."
                : isJoined
                ? "Đã tham gia"
                : "Tôi tham gia"}
            </Text>
          </TouchableOpacity>

          {/* Decline */}
          <TouchableOpacity
            style={[
              styles.btn,
              styles.btnDecline,
              isDeclined && styles.btnDeclinedActive,
            ]}
            onPress={handleDecline}
            disabled={isLoading !== null || isDeclined}
            activeOpacity={0.8}
          >
            <Ionicons
              name="close"
              size={16}
              color={isDeclined ? "#ef4444" : "#6b7280"}
            />
            <Text
              style={[styles.btnText, styles.btnTextDecline, isDeclined && styles.btnTextDeclinedActive]}
            >
              {isLoading === "decline"
                ? "..."
                : isDeclined
                ? "Đã từ chối"
                : "Từ chối"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerCreator}>
          Tạo bởi: <Text style={styles.footerCreatorName}>{reminder.creatorName}</Text>
        </Text>
        <View style={styles.footerRight}>
          {isCreator && (
            <>
              {onEdit && (
                <TouchableOpacity onPress={onEdit} style={styles.footerActionBtn}>
                  <Ionicons name="create-outline" size={14} color={COLORS.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleDelete} style={styles.footerActionBtn}>
                <Ionicons name="trash-outline" size={14} color="#ef4444" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    minWidth: 260,
    maxWidth: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f5f3ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.primary}20`,
  },
  membersExpand: {
    backgroundColor: "#f9fafb",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  memberSection: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  avatarRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: `${COLORS.primary}20`,
  },
  noMembersText: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 4,
  },
  headerLeft: {

    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  participantBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  participantText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.primary,
    marginLeft: 3,
  },
  body: {
    padding: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
    lineHeight: 22,
  },
  content: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 12,
    lineHeight: 18,
    backgroundColor: "#f9fafb",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#e5e7eb",
  },
  dateTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${COLORS.primary}08`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${COLORS.primary}20`,
    padding: 10,
    marginBottom: 12,
  },
  dateTimeItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  dateTimeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: "#e5e7eb",
    marginHorizontal: 10,
  },
  dateTimeLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dateTimeValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginTop: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  btnJoin: {
    backgroundColor: COLORS.primary,
  },
  btnJoinedActive: {
    backgroundColor: `${COLORS.primary}15`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}40`,
  },
  btnDecline: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  btnDeclinedActive: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  btnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  btnTextJoined: {
    color: COLORS.primary,
  },
  btnTextDecline: {
    color: "#6b7280",
  },
  btnTextDeclinedActive: {
    color: "#ef4444",
  },
  avatarChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#f3f4f6",
    borderRadius: 16,
    paddingRight: 8,
    gap: 4,
  },
  chipName: {
    fontSize: 10,
    fontWeight: "600",
    color: "#4b5563",
    maxWidth: 80,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fafafa",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  footerCreator: {
    fontSize: 11,
    color: "#9ca3af",
  },
  footerCreatorName: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  footerActionBtn: {
    padding: 4,
  },
});

export default ReminderMessage;
