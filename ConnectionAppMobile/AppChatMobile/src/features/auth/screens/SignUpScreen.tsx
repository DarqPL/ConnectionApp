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

export default function SignUpScreen({ navigation }: any) {
  const [step, setStep] = useState(1); // 1: Info, 2: OTP
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { signUp, sendSignupOtp, isLoading, error, clearError } = useAuth();

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
    if (!firstName || !lastName || !username || !email || !password) {
      Alert.alert("Thiếu thông tin", "Vui lòng điền đầy đủ thông tin đăng ký");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Email không hợp lệ", "Vui lòng nhập đúng định dạng email");
      return;
    }

    try {
      await sendSignupOtp(username, email);
      setStep(2);
      setCountdown(60);
      Alert.alert("Thành công", "Mã OTP đã được gửi đến email của bạn");
    } catch (err) {
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể gửi OTP");
    }
  };

  const handleVerifyAndSignUp = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập mã OTP 6 chữ số");
      return;
    }

    try {
      await signUp(firstName, lastName, username, email, password, otp);
      // Auth state will trigger navigation
    } catch (err) {
      Alert.alert("Đăng ký thất bại", err instanceof Error ? err.message : "Lỗi không xác định");
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    try {
      await sendSignupOtp(username, email);
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
          {step === 1 ? "Tạo tài khoản" : "Xác thực OTP"}
        </Text>
        <Text style={styles.subtitle}>
          {step === 1
            ? "Chào mừng bạn! Hãy đăng ký để bắt đầu"
            : `Mã OTP đã được gửi đến ${email}`}
        </Text>

        {step === 1 ? (
          <>
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
              keyboardType="email-address"
              autoCapitalize="none"
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
          </>
        ) : (
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
            <TouchableOpacity onPress={() => setStep(1)} disabled={isLoading}>
              <Text style={styles.link}>Thay đổi thông tin</Text>
            </TouchableOpacity>
          </>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={{ width: "100%", marginTop: 10 }}
          onPress={step === 1 ? handleSendOtp : handleVerifyAndSignUp}
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
                {step === 1 ? "Tiếp tục" : "Hoàn tất đăng ký"}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("SignIn")} disabled={isLoading}>
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
  resendText: {
    textAlign: "center",
    color: "#4A00E0",
    fontWeight: "500",
  },
  resendDisabled: {
    color: "#999",
  },
});
