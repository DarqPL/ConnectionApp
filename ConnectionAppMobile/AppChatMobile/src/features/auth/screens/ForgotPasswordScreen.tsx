import React, { useState, useEffect, useRef } from "react";
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

export default function ForgotPasswordScreen({ navigation }: any) {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { forgotPassword, resetPassword, isLoading, error } = useAuth();

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [countdown]);

  const handleSendOtp = async () => {
    if (!email) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập email của bạn");
      return;
    }

    try {
      await forgotPassword(email);
      setStep(2);
      setCountdown(60);
      Alert.alert("Thành công", "Mã OTP đã được gửi đến email của bạn");
    } catch (err) {
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể gửi OTP");
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập mã OTP 6 chữ số");
      return;
    }
    // We don't have a standalone verify-only context method yet, 
    // but we can just move to step 3 and verify during reset.
    // Or we could add it to context. For now, let's keep it simple.
    setStep(3);
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập đầy đủ mật khẩu mới");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Mật khẩu không khớp", "Mật khẩu xác nhận không trùng khớp");
      return;
    }

    try {
      await resetPassword(email, otp, newPassword);
      Alert.alert("Thành công", "Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại.", [
        { text: "OK", onPress: () => navigation.navigate("SignIn") }
      ]);
    } catch (err) {
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Đặt lại mật khẩu thất bại");
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    try {
      await forgotPassword(email);
      setCountdown(60);
      Alert.alert("Thông báo", "Mã OTP mới đã được gửi");
    } catch (err) {
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể gửi lại OTP");
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.card}>
        <Text style={styles.title}>
          {step === 1 ? "Quên mật khẩu" : step === 2 ? "Xác thực OTP" : "Đặt lại mật khẩu"}
        </Text>
        <Text style={styles.subtitle}>
          {step === 1
            ? "Nhập email để nhận mã khôi phục"
            : step === 2
            ? `Mã OTP đã được gửi đến ${email}`
            : "Nhập mật khẩu mới cho tài khoản của bạn"}
        </Text>

        {step === 1 && (
          <AuthInput
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            editable={!isLoading}
          />
        )}

        {step === 2 && (
          <>
            <AuthInput
              placeholder="Nhập mã OTP 6 chữ số"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              editable={!isLoading}
            />
            <TouchableOpacity 
              onPress={handleResendOtp} 
              disabled={countdown > 0 || isLoading}
              style={{ marginBottom: 15 }}
            >
              <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                {countdown > 0 ? `Gửi lại mã (${countdown}s)` : "Gửi lại mã OTP"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <>
            <AuthInput
              placeholder="Mật khẩu mới"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              editable={!isLoading}
            />
            <AuthInput
              placeholder="Xác nhận mật khẩu mới"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!isLoading}
            />
          </>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={{ width: "100%", marginTop: 10 }}
          onPress={step === 1 ? handleSendOtp : step === 2 ? handleVerifyOtp : handleResetPassword}
          disabled={isLoading}
        >
          <LinearGradient
            colors={["#8E2DE2", "#4A00E0"]}
            style={[styles.button, isLoading && styles.buttonDisabled]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {step === 1 ? "Gửi mã OTP" : step === 2 ? "Tiếp tục" : "Đặt lại mật khẩu"}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()} 
          disabled={isLoading}
        >
          <Text style={styles.link}>Quay lại</Text>
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
  resendText: {
    textAlign: "center",
    color: "#4A00E0",
    fontWeight: "500",
  },
  resendDisabled: {
    color: "#999",
  },
});
