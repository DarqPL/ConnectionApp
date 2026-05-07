import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function ManualUnlockScreen({ navigation, route }: any) {
  const initialIdentifier = route?.params?.usernameOrEmail ?? "";
  const [identifier] = useState(initialIdentifier);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const { requestManualUnlockOtp, verifyManualUnlockOtp, isLoading } = useAuth();

  const handleRequestOtp = async () => {
    if (!identifier || !email) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập email đã đăng ký.");
      return;
    }
    try {
      await requestManualUnlockOtp(identifier, email);
      setStep("otp");
      Alert.alert("Thành công", "Mã OTP đã được gửi đến email của bạn.");
    } catch (err) {
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể gửi OTP");
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập mã OTP hợp lệ.");
      return;
    }
    try {
      await verifyManualUnlockOtp(identifier, email, otp);
      Alert.alert("Thành công", "Mở khóa tài khoản thành công. Vui lòng đăng nhập lại.", [
        { text: "Đồng ý", onPress: () => navigation.navigate("SignIn") },
      ]);
    } catch (err) {
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Xác thực OTP thất bại");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Tài khoản đã bị khóa</Text>
        <Text style={styles.subtitle}>
          Tài khoản của bạn đã bị khóa do chính yêu cầu của người dùng. Nếu muốn mở khóa vui lòng nhập email để xác thực.
        </Text>

        <TextInput value={identifier} editable={false} style={[styles.input, styles.disabledInput]} />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Nhập email đã đăng ký"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
          editable={!isLoading && step === "email"}
        />

        {step === "otp" && (
          <TextInput
            value={otp}
            onChangeText={setOtp}
            placeholder="Nhập mã OTP"
            keyboardType="number-pad"
            style={styles.input}
            editable={!isLoading}
          />
        )}

        {step === "email" ? (
          <TouchableOpacity style={styles.button} onPress={handleRequestOtp} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Gửi OTP</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Xác thực OTP</Text>}
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => navigation.navigate("SignIn")}>
          <Text style={styles.link}>Quay lại đăng nhập</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f7", padding: 20 },
  card: { width: "100%", backgroundColor: "#fff", borderRadius: 20, padding: 20, elevation: 4 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#555", marginBottom: 16, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: "#fff" },
  disabledInput: { backgroundColor: "#f0f0f0" },
  button: { backgroundColor: "#4A00E0", borderRadius: 10, padding: 12, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#fff", fontWeight: "600" },
  link: { marginTop: 14, textAlign: "center", color: "#4A00E0", fontWeight: "500" },
});
