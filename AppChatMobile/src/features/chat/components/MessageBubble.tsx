import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { COLORS } from "../../../theme";

interface Props {
  message: string;
  isMe?: boolean;
  senderName?: string;
  avatarUrl?: string | null;
  createdAt?: string;
  recalledAt?: string | null;
  isGroup?: boolean;
  onLongPress?: () => void;
}

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
};

const MessageBubble: React.FC<Props> = ({
  message,
  isMe = false,
  senderName,
  avatarUrl,
  createdAt,
  recalledAt,
  isGroup = false,
  onLongPress,
}) => {
  const isRecalled = !!recalledAt;
  const FALLBACK = "https://i.pravatar.cc/150?img=5";

  return (
    <View style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}>
      {/* Avatar for received messages in groups */}
      {!isMe && isGroup && (
        <Image
          source={{ uri: avatarUrl || FALLBACK }}
          style={styles.avatar}
        />
      )}

      <View style={[styles.col, isMe ? styles.colRight : styles.colLeft]}>
        {/* Sender name in group */}
        {!isMe && isGroup && senderName && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}

        <TouchableOpacity
          activeOpacity={isMe && !isRecalled ? 0.75 : 1}
          onLongPress={isMe && !isRecalled ? onLongPress : undefined}
          style={[
            styles.bubble,
            isMe ? styles.bubbleSent : styles.bubbleReceived,
            isRecalled && styles.bubbleRecalled,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMe ? styles.sentText : styles.receivedText,
              isRecalled && styles.recalledText,
            ]}
          >
            {isRecalled ? "Tin nhắn đã được thu hồi" : message}
          </Text>
        </TouchableOpacity>

        {createdAt && !isRecalled && (
          <Text style={[styles.time, isMe ? styles.timeRight : styles.timeLeft]}>
            {formatTime(createdAt)}
          </Text>
        )}
      </View>
    </View>
  );
};

export default MessageBubble;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginVertical: 2,
    paddingHorizontal: 12,
    alignItems: "flex-end",
  },
  rowLeft: {
    justifyContent: "flex-start",
  },
  rowRight: {
    justifyContent: "flex-end",
  },
  col: {
    maxWidth: "75%",
  },
  colLeft: {
    alignItems: "flex-start",
  },
  colRight: {
    alignItems: "flex-end",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 6,
    marginBottom: 4,
    backgroundColor: COLORS.backgroundMuted,
  },
  senderName: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: "600",
    marginBottom: 3,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    maxWidth: "100%",
  },
  bubbleSent: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  bubbleRecalled: {
    backgroundColor: COLORS.backgroundMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  sentText: {
    color: "#fff",
  },
  receivedText: {
    color: COLORS.text,
  },
  recalledText: {
    color: COLORS.textMuted,
    fontStyle: "italic",
    fontSize: 14,
  },
  time: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 3,
    marginHorizontal: 4,
  },
  timeLeft: {
    alignSelf: "flex-start",
  },
  timeRight: {
    alignSelf: "flex-end",
  },
});
