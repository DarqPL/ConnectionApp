import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ChatListScreen from "./features/chat/screens/ChatListScreen";
import ChatRoomScreen from "./features/chat/screens/ChatRoomScreen";
import SignInScreen from "./features/auth/screens/SignInScreen";
import SignUpScreen from "./features/auth/screens/SignUpScreen";

export type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ChatList: undefined;
  ChatRoom: { name: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="ChatList">
        <Stack.Screen
          name="SignIn"
          component={SignInScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="SignUp"
          component={SignUpScreen}
          options={{ headerShown: false }}
        />

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
