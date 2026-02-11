import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";

const ChatHeader = () => {
  return (
    <View style={styles.container}>
      <Image
        source={{ uri: "https://i.pravatar.cc/150?img=2" }}
        style={styles.avatar}
      />

      <View>
        <Text style={styles.name}>Trần Thị Bình</Text>
        <Text style={styles.status}>Đang hoạt động</Text>
      </View>
    </View>
  );
};

export default ChatHeader;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22,
    marginRight: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  status: {
    fontSize: 12,
    color: "#ddd",
    marginTop: 2,
  },
});
