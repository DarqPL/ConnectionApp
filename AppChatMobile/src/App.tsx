import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import ChatListScreen from "./features/chat/screens/ChatListScreen";
import ChatRoomScreen from "./features/chat/screens/ChatRoomScreen";
import SignInScreen from "./features/auth/screens/SignInScreen";
import SignUpScreen from "./features/auth/screens/SignUpScreen";
import ForgotPasswordScreen from "./features/auth/screens/ForgotPasswordScreen";
import { AuthProvider, useAuth } from "./features/auth/context/AuthContext";
import { ChatProvider } from "./features/chat/context/ChatContext";

export type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ChatList: undefined;
  ChatRoom: { conversationId: number; name: string; avatarUrl?: string | null };
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
          </>
        ) : (
          // Chat Stack
          <>
            <Stack.Screen
              name="ChatList"
              component={ChatListScreen}
              options={{
                title: "Connection",
                headerShown: true,
              }}
            />

            <Stack.Screen
              name="ChatRoom"
              component={ChatRoomScreen}
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

export default function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <AppNavigator />
      </ChatProvider>
    </AuthProvider>
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
