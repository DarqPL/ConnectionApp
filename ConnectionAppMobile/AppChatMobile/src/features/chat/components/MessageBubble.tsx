import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";
import type { Attachment } from "../types";

interface Props {
  message: string;
  attachments?: Attachment[];
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

const isImageAttachment = (attachment: Attachment): boolean => {
  if (attachment.type === "IMAGE") {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(attachment.fileUrl);
};

const resolveFileName = (url: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    return decodeURIComponent(segments[segments.length - 1] || "attached-file");
  } catch {
    return "attached-file";
  }
};

const MessageBubble: React.FC<Props> = ({
  message,
  attachments = [],
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

  const openAttachment = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error("Cannot open attachment", error);
    }
  };

  return (
    <View style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}>
      {/* Avatar for received messages in groups */}
      {!isMe && isGroup && (
        <Image source={{ uri: avatarUrl || FALLBACK }} style={styles.avatar} />
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
          {isRecalled ? (
            <Text
              style={[
                styles.messageText,
                isMe ? styles.sentText : styles.receivedText,
                styles.recalledText,
              ]}
            >
              Tin nhắn đã được thu hồi
            </Text>
          ) : (
            <View style={styles.contentWrap}>
              {attachments.length > 0 && (
                <View style={styles.attachmentsWrap}>
                  {attachments.map((attachment, index) =>
                    isImageAttachment(attachment) ? (
                      <TouchableOpacity
                        key={`${attachment.fileUrl}-${index}`}
                        onPress={() => openAttachment(attachment.fileUrl)}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: attachment.fileUrl }}
                          style={styles.attachmentImage}
                        />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        key={`${attachment.fileUrl}-${index}`}
                        onPress={() => openAttachment(attachment.fileUrl)}
                        style={styles.fileCard}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="document-outline"
                          size={16}
                          color={isMe ? "#fff" : COLORS.text}
                        />
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.fileName,
                            isMe ? styles.sentText : styles.receivedText,
                          ]}
                        >
                          {resolveFileName(attachment.fileUrl)}
                        </Text>
                      </TouchableOpacity>
                    ),
                  )}
                </View>
              )}

              {!!message && (
                <Text
                  style={[
                    styles.messageText,
                    isMe ? styles.sentText : styles.receivedText,
                  ]}
                >
                  {message}
                </Text>
              )}
            </View>
          )}
        </TouchableOpacity>

        {createdAt && !isRecalled && (
          <Text
            style={[styles.time, isMe ? styles.timeRight : styles.timeLeft]}
          >
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
  contentWrap: {
    gap: 8,
  },
  attachmentsWrap: {
    gap: 8,
  },
  attachmentImage: {
    width: 180,
    height: 180,
    borderRadius: 10,
    backgroundColor: COLORS.backgroundMuted,
  },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: 220,
  },
  fileName: {
    fontSize: 13,
    flexShrink: 1,
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
