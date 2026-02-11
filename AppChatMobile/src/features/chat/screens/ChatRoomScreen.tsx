import React from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MessageBubble from "../components/MessageBubble";
import ChatInput from "../components/ChatInput";
import ChatHeader from "../components/ChatHeader";

const messages = [
  { id: "1", text: "Anh ơi bài tập khó quá 🥲", isMe: false },
  { id: "2", text: "Bài nào khó thế?", isMe: true },
];

const ChatRoomScreen = () => {
  return (
    <LinearGradient
      colors={["#8e44ad", "#6c5ce7"]}
      style={styles.container}
    >
      <ChatHeader />

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble message={item.text} isMe={item.isMe} />
        )}
        contentContainerStyle={{ padding: 16 }}
      />

      <ChatInput />
    </LinearGradient>
  );
};

export default ChatRoomScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
