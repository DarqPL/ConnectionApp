import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from "react-native";
import { COLORS } from "../../../theme";

interface Props {
  name: string;
  lastMessage: string;
  time: string;
  avatar?: string | null;
  unreadCount?: number;
  type?: string;
  participants?: Array<{ userId: number; avatarUrl?: string | null; displayName: string }>;
  onPress: () => void;
}

const ChatItem: React.FC<Props> = ({
  name,
  lastMessage,
  time,
  avatar,
  unreadCount = 0,
  type = "PRIVATE",
  participants = [],
  onPress,
}) => {
  const isGroup = type === "GROUP";
  const FALLBACK = "https://i.pravatar.cc/150?img=10";

  const [imageError, setImageError] = React.useState(false);

  const renderAvatar = () => {
    // If we have an explicit avatar URL (e.g. for a group), use it first
    if (avatar && !imageError) {
      return (
        <Image
          source={{ uri: avatar }}
          style={styles.avatar}
          onError={() => setImageError(true)}
        />
      );
    }

    if (!isGroup || participants.length < 2) {
      return (
        <Image
          source={{ uri: avatar || FALLBACK }}
          style={styles.avatar}
        />
      );
    }
    return (
      <View style={styles.groupAvatarWrap}>
        <Image
          source={{ uri: participants[0]?.avatarUrl || FALLBACK }}
          style={[styles.groupAvatar, styles.groupAvatarTop]}
        />
        <Image
          source={{ uri: participants[1]?.avatarUrl || FALLBACK }}
          style={[styles.groupAvatar, styles.groupAvatarBottom]}
        />
      </View>
    );
  };

  const hasUnread = unreadCount > 0;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      {renderAvatar()}
      <View style={styles.content}>
        <View style={styles.row}>
          <Text
            style={[styles.name, hasUnread && styles.nameUnread]}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text style={[styles.time, hasUnread && styles.timeUnread]}>{time}</Text>
        </View>
        <View style={styles.row}>
          <Text
            style={[styles.message, hasUnread && styles.messageUnread]}
            numberOfLines={1}
          >
            {lastMessage}
          </Text>
          {hasUnread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default ChatItem;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.backgroundMuted,
  },
  groupAvatarWrap: {
    width: 52,
    height: 52,
    position: "relative",
  },
  groupAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "#fff",
    position: "absolute",
    backgroundColor: COLORS.backgroundMuted,
  },
  groupAvatarTop: {
    top: 0,
    right: 0,
    zIndex: 1,
  },
  groupAvatarBottom: {
    bottom: 0,
    left: 0,
  },
  content: {
    flex: 1,
    marginLeft: 12,
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  nameUnread: {
    fontWeight: "700",
    color: COLORS.text,
  },
  time: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  timeUnread: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  message: {
    fontSize: 14,
    color: COLORS.textMuted,
    flex: 1,
    marginRight: 8,
  },
  messageUnread: {
    color: COLORS.text,
    fontWeight: "600",
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
