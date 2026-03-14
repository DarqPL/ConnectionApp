import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AuthInput from "../components/AuthInput";
import { useAuth } from "../context/AuthContext";

export default function SignUpScreen({ navigation }: any) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signUp, isLoading, error } = useAuth();

  const handleSignUp = async () => {
    if (!firstName || !lastName || !username || !email || !password) {
      Alert.alert("Validation Error", "Please fill in all fields");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Validation Error", "Please enter a valid email address");
      return;
    }

    try {
      await signUp(firstName, lastName, username, email, password);
      // Navigation is handled by the app's auth state
    } catch (err) {
      Alert.alert(
        "Sign Up Failed",
        error || (err instanceof Error ? err.message : "Unknown error")
      );
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Tạo tài khoản</Text>
        <Text style={styles.subtitle}>
          Chào mừng bạn! Hãy đăng ký để bắt đầu
        </Text>

        <AuthInput
          placeholder="Họ"
          value={firstName}
          onChangeText={setFirstName}
          editable={!isLoading}
        />

        <AuthInput
          placeholder="Tên"
          value={lastName}
          onChangeText={setLastName}
          editable={!isLoading}
        />

        <AuthInput
          placeholder="Tên đăng nhập"
          value={username}
          onChangeText={setUsername}
          editable={!isLoading}
        />

        <AuthInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          editable={!isLoading}
        />

        <AuthInput
          placeholder="Mật khẩu"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!isLoading}
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={{ width: "100%" }}
          onPress={handleSignUp}
          disabled={isLoading}
        >
          <LinearGradient
            colors={["#8E2DE2", "#4A00E0"]}
            style={[styles.button, isLoading && styles.buttonDisabled]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Tạo tài khoản</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("SignIn")}>
          <Text style={styles.link}>Đã có tài khoản? Đăng nhập</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  scrollContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    minHeight: "100%",
  },
  card: {
    width: "100%",
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 20,
    elevation: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  button: {
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  link: {
    textAlign: "center",
    marginTop: 16,
    color: "#4A00E0",
    fontWeight: "500",
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
});
