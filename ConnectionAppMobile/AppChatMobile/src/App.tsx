import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import ChatListScreen from "./features/chat/screens/ChatListScreen";
import ChatRoomScreen from "./features/chat/screens/ChatRoomScreen";
import ProfileScreen from "./features/chat/screens/ProfileScreen";
import AddFriendScreen from "./features/chat/screens/AddFriendScreen";
import ContactScreen from "./features/chat/screens/ContactScreen";
import CreateGroupScreen from "./features/chat/screens/CreateGroupScreen";
import QrScannerScreen from "./features/chat/screens/QrScannerScreen";
import SignInScreen from "./features/auth/screens/SignInScreen";
import SignUpScreen from "./features/auth/screens/SignUpScreen";
import ForgotPasswordScreen from "./features/auth/screens/ForgotPasswordScreen";
import ManualUnlockScreen from "./features/auth/screens/ManualUnlockScreen";
import { AuthProvider, useAuth } from "./features/auth/context/AuthContext";
import { ChatProvider } from "./features/chat/context/ChatContext";

export type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ManualUnlock: { usernameOrEmail: string };
  ChatList: undefined;
  ChatRoom: { conversationId: number; name: string; avatarUrl?: string | null };
  Profile: undefined;
  AddFriend: undefined;
  QrScanner: undefined;
  Contacts: undefined;
  CreateGroup: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { isAuthenticated, isHydrating } = useAuth();

  if (isHydrating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!isAuthenticated ? (
          // Auth Stack
          <>
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
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ManualUnlock"
              component={ManualUnlockScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          // Chat Stack
          <>
            <Stack.Screen
              name="ChatList"
              component={ChatListScreen}
              options={{
                headerShown: false,
              }}
            />

            <Stack.Screen
              name="ChatRoom"
              component={ChatRoomScreen}
              options={{
                headerShown: false,
              }}
            />

            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{
                headerShown: false,
              }}
            />

            <Stack.Screen
              name="AddFriend"
              component={AddFriendScreen}
              options={{
                headerShown: false,
              }}
            />

            <Stack.Screen
              name="QrScanner"
              component={QrScannerScreen}
              options={{
                headerShown: false,
              }}
            />

            <Stack.Screen
              name="Contacts"
              component={ContactScreen}
              options={{
                headerShown: false,
              }}
            />

            <Stack.Screen
              name="CreateGroup"
              component={CreateGroupScreen}
              options={{
                headerShown: false,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

import { SafeAreaProvider } from "react-native-safe-area-context";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ChatProvider>
          <AppNavigator />
        </ChatProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
});
