import React from "react";
import { View, FlatList, StyleSheet } from "react-native";
import ChatItem from "../components/ChatItem";
import { useNavigation } from "@react-navigation/native";

const data = [
  {
    id: "1",
    name: "Hội Bạn Thân 💖",
    lastMessage: "Cuối tuần đi cà phê không?",
    time: "1d",
    avatar: "https://i.pravatar.cc/150?img=1",
  },
  {
    id: "2",
    name: "Trần Thị Bình",
    lastMessage: "Anh ơi bài tập khó quá 🥲",
    time: "23h",
    avatar: "https://i.pravatar.cc/150?img=2",
  },
];

const ChatListScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatItem
            {...item}
            onPress={() =>
              navigation.navigate("ChatRoom", { name: item.name })
            }
          />
        )}
      />
    </View>
  );
};

export default ChatListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});
