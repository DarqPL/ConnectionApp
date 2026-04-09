import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface Props {
  message: string;
  isMe?: boolean;
  senderName?: string;
  createdAt?: string;
}

const MessageBubble: React.FC<Props> = ({
  message,
  isMe,
  senderName,
  createdAt,
}) => {
  const timeLabel = createdAt
    ? new Date(createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <View
      style={[
        styles.container,
        isMe ? styles.rightContainer : styles.leftContainer,
      ]}
    >
      {!isMe && !!senderName && (
        <Text style={styles.senderName} numberOfLines={1}>
          {senderName}
        </Text>
      )}
      <Text style={isMe ? styles.rightText : styles.leftText}>{message}</Text>
      {!!timeLabel && (
        <Text style={isMe ? styles.rightTime : styles.leftTime}>
          {timeLabel}
        </Text>
      )}
    </View>
  );
};

export default MessageBubble;

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 18,
    marginVertical: 4,
    maxWidth: "75%",
  },
  leftContainer: {
    backgroundColor: "#f1f1f1",
    alignSelf: "flex-start",
  },
  rightContainer: {
    backgroundColor: "#8e44ad",
    alignSelf: "flex-end",
  },
  leftText: {
    color: "#000",
  },
  rightText: {
    color: "#fff",
  },
  senderName: {
    fontSize: 11,
    color: "#666",
    marginBottom: 4,
    fontWeight: "600",
  },
  leftTime: {
    marginTop: 6,
    fontSize: 10,
    color: "#777",
    alignSelf: "flex-end",
  },
  rightTime: {
    marginTop: 6,
    fontSize: 10,
    color: "#ddd",
    alignSelf: "flex-end",
  },
});
