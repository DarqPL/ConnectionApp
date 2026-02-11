import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ChatListScreen from "./features/chat/screens/ChatListScreen";
import ChatRoomScreen from "./features/chat/screens/ChatRoomScreen";

export type RootStackParamList = {
  ChatList: undefined;
  ChatRoom: { name: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="ChatList"
          component={ChatListScreen}
          options={{ title: "Connection 💜" }}
        />
        <Stack.Screen
          name="ChatRoom"
          component={ChatRoomScreen}
          options={({ route }) => ({
            title: route.params.name,
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
