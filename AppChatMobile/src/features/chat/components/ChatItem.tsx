import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";

interface Props {
  name: string;
  lastMessage: string;
  time: string;
  avatar?: string | null;
  unreadCount?: number;
  onPress: () => void;
}

const ChatItem: React.FC<Props> = ({
  name,
  lastMessage,
  time,
  avatar,
  unreadCount = 0,
  onPress,
}) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Image
        source={{ uri: avatar || "https://i.pravatar.cc/150?img=10" }}
        style={styles.avatar}
      />
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <View style={styles.bottomRow}>
          <Text style={styles.message} numberOfLines={1}>
            {lastMessage}
          </Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
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
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  name: {
    fontWeight: "600",
    fontSize: 16,
  },
  time: {
    fontSize: 12,
    color: "#999",
  },
  message: {
    marginTop: 4,
    color: "#666",
    flex: 1,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#6c5ce7",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginTop: 4,
  },
  unreadText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
