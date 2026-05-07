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

export default function SignInScreen({ navigation }: any) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { signIn, isLoading, error } = useAuth();

  const handleSignIn = async () => {
    if (!username || !password) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên đăng nhập và mật khẩu");
      return;
    }

    try {
      await signIn(username, password);
    } catch (err: any) {
      if (err?.code === "ACCOUNT_MANUAL_LOCKED") {
        navigation.navigate("ManualUnlock", { usernameOrEmail: username });
        return;
      }

      Alert.alert(
        "Đăng nhập thất bại",
        error || (err instanceof Error ? err.message : "Unknown error"),
      );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.card}>
        <Text style={styles.title}>Chào mừng quay lại</Text>
        <Text style={styles.subtitle}>Đăng nhập vào tài khoản của bạn</Text>

        <AuthInput placeholder="Tên đăng nhập" value={username} onChangeText={setUsername} editable={!isLoading} />
        <AuthInput placeholder="Mật khẩu" secureTextEntry value={password} onChangeText={setPassword} editable={!isLoading} />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")} style={{ alignSelf: "flex-end", marginBottom: 15 }}>
          <Text style={[styles.link, { marginTop: 0 }]}>Quên mật khẩu?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ width: "100%" }} onPress={handleSignIn} disabled={isLoading}>
          <LinearGradient colors={["#8E2DE2", "#4A00E0"]} style={[styles.button, isLoading && styles.buttonDisabled]}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Đăng nhập</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
          <Text style={styles.link}>Chưa có tài khoản? Đăng ký</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f7" },
  scrollContent: { justifyContent: "center", alignItems: "center", padding: 20, minHeight: "100%" },
  card: { width: "100%", backgroundColor: "#fff", padding: 24, borderRadius: 20, elevation: 5 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 20, textAlign: "center" },
  button: { padding: 15, borderRadius: 12, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  link: { textAlign: "center", marginTop: 16, color: "#4A00E0", fontWeight: "500" },
  errorText: { color: "#e74c3c", fontSize: 14, marginBottom: 12, textAlign: "center" },
});
