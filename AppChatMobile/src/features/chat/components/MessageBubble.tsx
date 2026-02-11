import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface Props {
  message: string;
  isMe?: boolean;
}

const MessageBubble: React.FC<Props> = ({ message, isMe }) => {
  return (
    <View
      style={[
        styles.container,
        isMe ? styles.rightContainer : styles.leftContainer,
      ]}
    >
      <Text style={isMe ? styles.rightText : styles.leftText}>
        {message}
      </Text>
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
});
