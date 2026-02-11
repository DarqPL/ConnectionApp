import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AuthInput from "../components/AuthInput";

export default function SignInScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Chào mừng quay lại</Text>
        <Text style={styles.subtitle}>
          Đăng nhập vào tài khoản của bạn
        </Text>

        <AuthInput placeholder="Tên đăng nhập" />
        <AuthInput placeholder="Mật khẩu" secureTextEntry />

        <TouchableOpacity style={{ width: "100%" }}>
          <LinearGradient
            colors={["#8E2DE2", "#4A00E0"]}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Đăng nhập</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.link}>
          Chưa có tài khoản? Đăng ký
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f7",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
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
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  link: {
    textAlign: "center",
    marginTop: 16,
    color: "#4A00E0",
  },
});
