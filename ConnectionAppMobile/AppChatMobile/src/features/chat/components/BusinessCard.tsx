import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";
import type { User } from "../../auth/services/auth.service";
import type { FriendStatus } from "../services/userEmailCache";
import { friendService } from "../services/friend.service";
import { invalidateEmailCache } from "../services/userEmailCache";

interface BusinessCardProps {
  email: string;
  user: User;
  initialStatus: FriendStatus;
  currentUserId?: number;
}

const FALLBACK_AVATAR = "https://i.pravatar.cc/150?img=10";

const BusinessCard: React.FC<BusinessCardProps> = ({
  email,
  user,
  initialStatus,
  currentUserId,
}) => {
  const [status, setStatus] = useState<FriendStatus>(initialStatus);
  const [loading, setLoading] = useState(false);

  const isSelf = currentUserId != null && user.id === currentUserId;
  const isDisabled =
    user.status === "LOCKED" || user.status === "DELETED" || isSelf;

  const doAction = async (action: () => Promise<void>, next: FriendStatus) => {
    setLoading(true);
    try {
      await action();
      setStatus(next);
      invalidateEmailCache(email); // bust cache so next open reflects new state
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = () =>
    doAction(() => friendService.sendFriendRequest(user.id), "SENDING");

  const handleCancel = () =>
    doAction(() => friendService.cancelFriendRequest(user.id), "NONE");

  const handleAccept = () =>
    doAction(() => friendService.acceptFriendRequest(user.id), "FRIEND");

  const handleReject = () =>
    doAction(() => friendService.rejectFriendRequest(user.id), "NONE");

  const renderActionButton = () => {
    if (isSelf || isDisabled) {
      return (
        <View style={styles.disabledBadge}>
          <Text style={styles.disabledText}>
            {isSelf ? "Tài khoản của bạn" : "Tài khoản không khả dụng"}
          </Text>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={styles.actionBtn}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      );
    }

    switch (status) {
      case "FRIEND":
        return (
          <View style={[styles.actionBtn, styles.friendBtn]}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
            <Text style={[styles.actionBtnText, styles.friendBtnText]}>
              Bạn bè
            </Text>
          </View>
        );
      case "SENDING":
        return (
          <TouchableOpacity
            style={[styles.actionBtn, styles.sendingBtn]}
            onPress={handleCancel}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
            <Text style={[styles.actionBtnText, styles.sendingBtnText]}>
              Đã gửi lời mời
            </Text>
          </TouchableOpacity>
        );
      case "RECEIVED":
        return (
          <View style={styles.receivedRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={handleAccept}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>Chấp nhận</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={handleReject}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, styles.rejectBtnText]}>
                Từ chối
              </Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleAddFriend}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add-outline" size={14} color="#fff" />
            <Text style={styles.actionBtnText}>Kết bạn</Text>
          </TouchableOpacity>
        );
    }
  };

  const initials = user.displayName?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <View style={styles.card}>
      {/* Label */}
      <View style={styles.labelRow}>
        <Ionicons
          name="id-card-outline"
          size={12}
          color="rgba(255,255,255,0.8)"
        />
        <Text style={styles.label}>Danh thiếp từ {email}</Text>
      </View>

      {/* User info row */}
      <View style={styles.userRow}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {user.avatarUrl ? (
            <Image
              source={{ uri: user.avatarUrl }}
              style={styles.avatar}
              defaultSource={{ uri: FALLBACK_AVATAR }}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
        </View>

        {/* Name & username */}
        <View style={styles.nameWrap}>
          <Text style={styles.displayName} numberOfLines={1}>
            {user.displayName}
          </Text>
          <Text style={styles.username} numberOfLines={1}>
            @{user.username}
          </Text>
        </View>
      </View>

      {/* Action */}
      <View style={styles.actionWrap}>{renderActionButton()}</View>
    </View>
  );
};

export default BusinessCard;

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    padding: 10,
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  label: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    flexShrink: 1,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
  },
  avatarWrap: {
    flexShrink: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundMuted,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },
  avatarInitials: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  nameWrap: {
    flex: 1,
  },
  displayName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  username: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  actionWrap: {
    alignItems: "flex-start",
  },
  receivedRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  friendBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  friendBtnText: {
    color: COLORS.primary,
  },
  sendingBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  sendingBtnText: {
    color: COLORS.textMuted,
  },
  acceptBtn: {
    backgroundColor: COLORS.primary,
  },
  rejectBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  rejectBtnText: {
    color: COLORS.text,
  },
  disabledBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  disabledText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },
});
