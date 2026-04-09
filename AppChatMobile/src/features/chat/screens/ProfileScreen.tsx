import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { COLORS } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import { authService } from "../../auth/services/auth.service";
import BottomNavigator from "../../../components/BottomNavigator";

const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, signOut, updateUserProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || "");

  // Change password
  const [showChangePw, setShowChangePw] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const handleUpdate = async () => {
    if (!displayName.trim()) {
      Alert.alert("Lỗi", "Tên hiển thị không được trống");
      return;
    }
    setLoading(true);
    try {
      await updateUserProfile({ displayName: displayName.trim() });
      setIsEditing(false);
      Alert.alert("Thành công", "Đã cập nhật hồ sơ");
    } catch (err) {
      Alert.alert("Lỗi", "Không thể cập nhật. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert("Lỗi", "Vui lòng điền đầy đủ thông tin");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Lỗi", "Mật khẩu mới không khớp");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Lỗi", "Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }
    setPwLoading(true);
    try {
      const res = await authService.authFetch(
        `/users/change-password?oldPassword=${encodeURIComponent(oldPassword)}&newPassword=${encodeURIComponent(newPassword)}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error();
      Alert.alert("Thành công", "Đã đổi mật khẩu");
      setShowChangePw(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      Alert.alert("Lỗi", "Không thể đổi mật khẩu. Kiểm tra lại mật khẩu cũ.");
    } finally {
      setPwLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Bỏ qua", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: signOut },
    ]);
  };

  const FALLBACK = "https://i.pravatar.cc/150?img=12";

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent />

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Gradient header */}
        <LinearGradient
          colors={COLORS.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradientHeader, { paddingTop: insets.top + 20 }]}
        >
          <View style={styles.avatarWrap}>
            <Image
              source={{ uri: user?.avatarUrl || FALLBACK }}
              style={styles.avatar}
            />
            <View style={styles.onlineDot} />
          </View>
          <Text style={styles.userName}>
            {isEditing ? "" : (user?.displayName || "User")}
          </Text>
          <Text style={styles.userHandle}>@{user?.username}</Text>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Profile info card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Thông tin cá nhân</Text>
              <TouchableOpacity
                onPress={() => {
                  if (isEditing) handleUpdate();
                  else {
                    setDisplayName(user?.displayName || "");
                    setIsEditing(true);
                  }
                }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={styles.editBtn}>{isEditing ? "Lưu" : "Chỉnh sửa"}</Text>
                )}
              </TouchableOpacity>
            </View>

            {isEditing && (
              <View style={styles.fieldRow}>
                <Ionicons name="person-outline" size={20} color={COLORS.primary} />
                <TextInput
                  style={styles.editInput}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Tên hiển thị..."
                  placeholderTextColor={COLORS.textLight}
                />
              </View>
            )}

            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: "#ede9fe" }]}>
                <Ionicons name="person" size={18} color={COLORS.primary} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Tên hiển thị</Text>
                <Text style={styles.infoValue}>{user?.displayName || "—"}</Text>
              </View>
            </View>

            <View style={styles.separator} />

            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: "#dbeafe" }]}>
                <Ionicons name="mail" size={18} color="#2563eb" />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user?.email || "—"}</Text>
              </View>
            </View>

            <View style={styles.separator} />

            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: "#dcfce7" }]}>
                <Ionicons name="at" size={18} color="#16a34a" />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Username</Text>
                <Text style={styles.infoValue}>@{user?.username}</Text>
              </View>
            </View>

            {isEditing && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsEditing(false)}
              >
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Settings card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cài đặt tài khoản</Text>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setShowChangePw(!showChangePw)}
            >
              <View style={[styles.settingIcon, { backgroundColor: "#fef3c7" }]}>
                <Ionicons name="lock-closed" size={18} color="#d97706" />
              </View>
              <Text style={styles.settingLabel}>Đổi mật khẩu</Text>
              <Ionicons
                name={showChangePw ? "chevron-up" : "chevron-forward"}
                size={18}
                color={COLORS.textLight}
              />
            </TouchableOpacity>

            {showChangePw && (
              <View style={styles.changePwSection}>
                <TextInput
                  style={styles.pwInput}
                  placeholder="Mật khẩu hiện tại"
                  placeholderTextColor={COLORS.textLight}
                  secureTextEntry
                  value={oldPassword}
                  onChangeText={setOldPassword}
                />
                <TextInput
                  style={styles.pwInput}
                  placeholder="Mật khẩu mới"
                  placeholderTextColor={COLORS.textLight}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <TextInput
                  style={styles.pwInput}
                  placeholder="Xác nhận mật khẩu mới"
                  placeholderTextColor={COLORS.textLight}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.pwSubmitBtn}
                  onPress={handleChangePassword}
                  disabled={pwLoading}
                >
                  {pwLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.pwSubmitText}>Cập nhật mật khẩu</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Sign out */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.destructive} />
            <Text style={styles.signOutText}>Đăng xuất</Text>
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </View>
      </ScrollView>

      <BottomNavigator />
    </View>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundMuted,
  },
  gradientHeader: {
    alignItems: "center",
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  avatarWrap: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  onlineDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.online,
    borderWidth: 2.5,
    borderColor: "#fff",
  },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginTop: 4,
  },
  userHandle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 3,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  editBtn: {
    color: COLORS.primary,
    fontWeight: "600",
    fontSize: 14,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.backgroundMuted,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 10,
  },
  editInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    padding: 0,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: "500",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: 2,
  },
  cancelBtn: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  cancelBtnText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
    marginTop: 8,
  },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  changePwSection: {
    marginTop: 8,
    gap: 10,
  },
  pwInput: {
    backgroundColor: COLORS.backgroundMuted,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  pwSubmitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  pwSubmitText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  signOutBtn: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  signOutText: {
    fontSize: 15,
    color: COLORS.destructive,
    fontWeight: "600",
  },
});
