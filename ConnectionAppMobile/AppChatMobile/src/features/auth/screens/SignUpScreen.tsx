import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../context/AuthContext";
import { COLORS } from "../../../theme";

type Step = "email" | "otp" | "register";

export default function SignUpScreen({ navigation }: any) {
  const { signUp, sendSignupOtp, verifyOtp, isLoading, clearError } = useAuth();

  // Step management
  const [step, setStep] = useState<Step>("email");
  const [verifiedEmail, setVerifiedEmail] = useState("");

  // Step 1 - Email
  const [email, setEmail] = useState("");

  // Step 2 - OTP
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Step 3 - Register
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [countdown]);

  // ─── STEP 1: Gửi OTP đến email ──────────────────────────────────────────────
  const handleSendOtp = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập email");
      return;
    }
    if (!emailRegex.test(email)) {
      Alert.alert("Email không hợp lệ", "Vui lòng nhập đúng định dạng email");
      return;
    }
    try {
      // Chỉ gửi email (không cần username ở bước này)
      await sendSignupOtp(email, "");
      setVerifiedEmail(email.trim());
      setStep("otp");
      setCountdown(60);
      Alert.alert("Thành công", "Mã OTP đã được gửi đến email của bạn");
    } catch (err) {
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể gửi OTP");
    }
  };

  // ─── STEP 2: Xác minh OTP ───────────────────────────────────────────────────
  const otp = otpDigits.join("");

  const handleOtpDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otpDigits];
    next[index] = value;
    setOtpDigits(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, key: string) => {
    if (key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập đủ 6 chữ số OTP");
      return;
    }
    try {
      // Gọi /verify-otp → backend markEmailVerified → user có 10 phút để điền form
      await verifyOtp(verifiedEmail, otp);
      setStep("register");
      Alert.alert("Xác minh thành công", "Vui lòng điền thông tin tài khoản");
    } catch (err) {
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Mã OTP không hợp lệ hoặc đã hết hạn");
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    try {
      await sendSignupOtp(verifiedEmail, "");
      setCountdown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      Alert.alert("Thông báo", "Mã OTP mới đã được gửi");
    } catch (err) {
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể gửi lại OTP");
    }
  };

  // ─── STEP 3: Đăng ký tài khoản ─────────────────────────────────────────────
  const handleSignUp = async () => {
    if (!firstName || !lastName || !username || !password || !confirmPassword) {
      Alert.alert("Thiếu thông tin", "Vui lòng điền đầy đủ thông tin");
      return;
    }
    if (username.length < 3) {
      Alert.alert("Tên đăng nhập", "Tên đăng nhập phải có ít nhất 3 ký tự");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Mật khẩu", "Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Mật khẩu", "Mật khẩu xác nhận không khớp");
      return;
    }
    try {
      // Backend sẽ kiểm tra isEmailVerified(email) thay vì OTP
      await signUp(firstName, lastName, username, verifiedEmail, password);
      Alert.alert("Thành công", "Đăng ký tài khoản thành công!", [
        { text: "Đăng nhập ngay", onPress: () => navigation.navigate("SignIn") },
      ]);
    } catch (err) {
      Alert.alert("Đăng ký thất bại", err instanceof Error ? err.message : "Lỗi không xác định");
    }
  };

  // ─── Step Title ─────────────────────────────────────────────────────────────
  const stepTitle = step === "email" ? "Tạo tài khoản" : step === "otp" ? "Xác thực email" : "Thông tin tài khoản";
  const stepSubtitle =
    step === "email"
      ? "Nhập email để nhận mã xác nhận"
      : step === "otp"
      ? `Mã OTP đã được gửi đến ${verifiedEmail}`
      : "Điền thông tin để hoàn tất đăng ký";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        {/* Progress indicator */}
        <View style={styles.progressRow}>
          {["Email", "OTP", "Tài khoản"].map((label, i) => {
            const currentIndex = step === "email" ? 0 : step === "otp" ? 1 : 2;
            const done = i < currentIndex;
            const active = i === currentIndex;
            return (
              <View key={label} style={styles.progressStep}>
                <View
                  style={[
                    styles.progressDot,
                    done && styles.progressDotDone,
                    active && styles.progressDotActive,
                  ]}
                >
                  <Text style={[styles.progressDotText, (done || active) && styles.progressDotTextActive]}>
                    {done ? "✓" : i + 1}
                  </Text>
                </View>
                <Text style={[styles.progressLabel, active && styles.progressLabelActive]}>
                  {label}
                </Text>
                {i < 2 && <View style={[styles.progressLine, done && styles.progressLineDone]} />}
              </View>
            );
          })}
        </View>

        <Text style={styles.title}>{stepTitle}</Text>
        <Text style={styles.subtitle}>{stepSubtitle}</Text>

        {/* ── BƯỚC 1: EMAIL ── */}
        {step === "email" && (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@gmail.com"
              placeholderTextColor={COLORS.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.btnWrapper, isLoading && styles.btnDisabled]}
              onPress={handleSendOtp}
              disabled={isLoading}
            >
              <LinearGradient colors={COLORS.gradient as any} style={styles.btn}>
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Gửi mã OTP</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("SignIn")} disabled={isLoading}>
              <Text style={styles.link}>Đã có tài khoản? Đăng nhập</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── BƯỚC 2: OTP ── */}
        {step === "otp" && (
          <>
            <Text style={styles.label}>Mã OTP (6 chữ số)</Text>
            <View style={styles.otpRow}>
              {otpDigits.map((val, i) => (
                <TextInput
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  style={[styles.otpBox, val ? styles.otpBoxFilled : null]}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={val}
                  onChangeText={(v) => handleOtpDigit(i, v)}
                  onKeyPress={({ nativeEvent }) => handleOtpKeyDown(i, nativeEvent.key)}
                  editable={!isLoading}
                />
              ))}
            </View>

            <TouchableOpacity
              onPress={handleResendOtp}
              disabled={countdown > 0 || isLoading}
              style={{ marginBottom: 12 }}
            >
              <Text style={[styles.link, countdown > 0 && styles.linkDisabled]}>
                {countdown > 0 ? `Gửi lại mã (${countdown}s)` : "Gửi lại mã OTP"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnWrapper, isLoading && styles.btnDisabled]}
              onPress={handleVerifyOtp}
              disabled={isLoading}
            >
              <LinearGradient colors={COLORS.gradient as any} style={styles.btn}>
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Xác minh OTP</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep("email")} disabled={isLoading}>
              <Text style={styles.link}>← Thay đổi email</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── BƯỚC 3: ĐĂNG KÝ ── */}
        {step === "register" && (
          <>
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Họ</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nguyễn"
                  placeholderTextColor={COLORS.textLight}
                  value={firstName}
                  onChangeText={setFirstName}
                  editable={!isLoading}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Tên</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Văn A"
                  placeholderTextColor={COLORS.textLight}
                  value={lastName}
                  onChangeText={setLastName}
                  editable={!isLoading}
                />
              </View>
            </View>

            <Text style={styles.label}>Tên đăng nhập</Text>
            <TextInput
              style={styles.input}
              placeholder="connection"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
              editable={!isLoading}
            />

            <Text style={styles.label}>Mật khẩu</Text>
            <TextInput
              style={styles.input}
              placeholder="Ít nhất 6 ký tự"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!isLoading}
            />

            <Text style={styles.label}>Xác nhận mật khẩu</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập lại mật khẩu"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!isLoading}
            />

            <TouchableOpacity
              style={[styles.btnWrapper, isLoading && styles.btnDisabled]}
              onPress={handleSignUp}
              disabled={isLoading}
            >
              <LinearGradient colors={COLORS.gradient as any} style={styles.btn}>
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Xác nhận & Đăng ký</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("SignIn")} disabled={isLoading}>
              <Text style={styles.link}>Đã có tài khoản? Đăng nhập</Text>
            </TouchableOpacity>
          </>
        )}
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    gap: 4,
  },
  progressStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotDone: {
    backgroundColor: "#8E2DE2",
    borderColor: "#8E2DE2",
  },
  progressDotActive: {
    borderColor: "#8E2DE2",
  },
  progressDotText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#aaa",
  },
  progressDotTextActive: {
    color: "#8E2DE2",
  },
  progressLabel: {
    fontSize: 11,
    color: "#aaa",
    marginRight: 4,
  },
  progressLabelActive: {
    color: "#8E2DE2",
    fontWeight: "600",
  },
  progressLine: {
    width: 20,
    height: 2,
    backgroundColor: "#ccc",
    marginHorizontal: 2,
  },
  progressLineDone: {
    backgroundColor: "#8E2DE2",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
    color: "#1a1a2e",
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#222",
    backgroundColor: "#fafafa",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  btnWrapper: {
    width: "100%",
    marginTop: 8,
    marginBottom: 12,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btn: {
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  link: {
    textAlign: "center",
    color: "#8E2DE2",
    fontWeight: "500",
    fontSize: 14,
    marginTop: 8,
  },
  linkDisabled: {
    color: "#aaa",
  },
  otpRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 12,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
    backgroundColor: "#fafafa",
  },
  otpBoxFilled: {
    borderColor: "#8E2DE2",
    color: "#8E2DE2",
    backgroundColor: "#f5f0ff",
  },
});
