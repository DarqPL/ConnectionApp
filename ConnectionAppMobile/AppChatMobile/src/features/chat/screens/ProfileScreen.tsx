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
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { COLORS } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import BottomNavigator from "../../../components/BottomNavigator";

import * as ImagePicker from "expo-image-picker";

const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    user,
    signOut,
    updateUserProfile,
    updateAvatar,
    changePassword,
    requestDeleteOtp,
    confirmDeleteAccount,
    deleteAccount,
    lockAccount,
  } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [bio, setBio] = useState(user?.bio || "");

  // Change password
  const [showChangePw, setShowChangePw] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [deleteOtp, setDeleteOtp] = useState("");

  const handleUpdate = async () => {
    if (!displayName.trim()) {
      Alert.alert("Lỗi", "Tên hiển thị không được trống");
      return;
    }
    setLoading(true);
    try {
      await updateUserProfile({
        displayName: displayName.trim(),
        phone: phone.trim(),
        bio: bio.trim()
      });
      setIsEditing(false);
      Alert.alert("Thành công", "Đã cập nhật hồ sơ");
    } catch (err) {
      Alert.alert("Lỗi", "Không thể cập nhật. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh để đổi ảnh đại diện.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      handleAvatarUpload(result.assets[0]);
    }
  };

  const handleAvatarUpload = async (asset: ImagePicker.ImagePickerAsset) => {
    setAvatarLoading(true);
    try {
      console.log("[ProfileScreen] Starting avatar upload");
      console.log("[ProfileScreen] Asset info:", {
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });

      const formData = new FormData();

      // @ts-ignore
      formData.append('file', {
        uri: asset.uri,
        name: asset.fileName || 'avatar.jpg',
        type: asset.mimeType || 'image/jpeg',
      });

      console.log("[ProfileScreen] FormData created");
      console.log("[ProfileScreen] FormData instanceof FormData:", formData instanceof FormData);
      console.log("[ProfileScreen] Has append method:", typeof (formData as any).append === 'function');

      console.log("[ProfileScreen] Calling updateAvatar...");
      await updateAvatar(formData);
      
      console.log("[ProfileScreen] Avatar upload successful!");
      Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện');
    } catch (err) {
      console.error("[ProfileScreen] Avatar upload error:", err);
      const errorMsg = err instanceof Error ? err.message : 'Không thể upload ảnh đại diện. Thử lại sau.';
      Alert.alert('Lỗi', errorMsg);
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert("Lỗi", "Vui lòng điền đầy đủ thông tin");
      return;
    }
    if (oldPassword === newPassword) {
      Alert.alert("Lỗi", "Mật khẩu mới phải khác mật khẩu hiện tại");
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
      await changePassword(oldPassword, newPassword);
      Alert.alert("Thành công", "Đã đổi mật khẩu");
      setShowChangePw(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Không thể đổi mật khẩu. Kiểm tra lại mật khẩu cũ.";
      Alert.alert("Lỗi", errorMessage);
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

  const handleDeleteAccount = () => {
    Alert.alert(
      "Xác nhận xóa",
      "Tài khoản của bạn sẽ bị xóa vĩnh viễn và không thể khôi phục. Bạn có chắc chắn muốn xóa?",
      [
        { text: "Bỏ qua", style: "cancel" },
        {
          text: "Tiếp tục",
          style: "destructive",
          onPress: async () => {
            setDeleteLoading(true);
            try {
              await requestDeleteOtp();
              setDeleteLoading(false);
              setShowOtpModal(true);
            } catch (err) {
              setDeleteLoading(false);
              Alert.alert("Lỗi", "Không thể gửi mã OTP. Thử lại sau.");
            }
          },
        },
      ],
    );
  };

  const handleLockAccount = () => {
    Alert.alert(
      "Khoá tài khoản",
      "Sau khi khóa tài khoản, bạn sẽ bị đăng xuất ngay. Bạn có muốn tiếp tục?",
      [
        { text: "Bỏ qua", style: "cancel" },
        {
          text: "Khoá tài khoản",
          style: "destructive",
          onPress: async () => {
            try {
              await lockAccount();
              Alert.alert("Thành công", "Tài khoản đã được khoá.");
            } catch (err) {
              Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể khoá tài khoản");
            }
          },
        },
      ],
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteOtp || deleteOtp.length < 6) {
      Alert.alert("Lỗi", "Vui lòng nhập mã OTP 6 chữ số.");
      return;
    }

    setDeleteLoading(true);
    try {
      await deleteAccount(deleteOtp);
      setShowOtpModal(false);
      Alert.alert(
        "Thành công",
        "Tài khoản của bạn đã được xóa vĩnh viễn.",
        [
          {
            text: "Đồng ý",
            onPress: () => {
              // Trạng thái isAuthenticated trong AuthContext thay đổi sẽ tự động 
              // đưa người dùng về trang Đăng nhập qua AppNavigator
            }
          }
        ]
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Mã OTP không chính xác.";
      Alert.alert("Lỗi", errorMessage);
    } finally {
      setDeleteLoading(false);
    }
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
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={handlePickImage}
            disabled={avatarLoading}
          >
            <Image
              source={{ uri: user?.avatarUrl || FALLBACK }}
              style={styles.avatar}
            />
            {avatarLoading && (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
            <View style={styles.cameraIconBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>
            {isEditing ? "" : user?.displayName || "User"}
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
                  <Text style={styles.editBtn}>
                    {isEditing ? "Lưu" : "Chỉnh sửa"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {isEditing && (
              <View style={{ gap: 10, marginBottom: 14 }}>
                <View style={styles.fieldRow}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                  <TextInput
                    style={styles.editInput}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Tên hiển thị..."
                    placeholderTextColor={COLORS.textLight}
                  />
                </View>
                <View style={styles.fieldRow}>
                  <Ionicons
                    name="call-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                  <TextInput
                    style={styles.editInput}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Số điện thoại..."
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.fieldRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                  <TextInput
                    style={[styles.editInput, { minHeight: 60 }]}
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Giới thiệu bản thân..."
                    placeholderTextColor={COLORS.textLight}
                    multiline
                  />
                </View>
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
              <View style={[styles.infoIcon, { backgroundColor: "#f3f4f6" }]}>
                <Ionicons name="information-circle" size={18} color={COLORS.textMuted} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Tiểu sử</Text>
                <Text style={styles.infoValue}>{user?.bio || "Chưa cập nhật"}</Text>
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
              <View
                style={[styles.settingIcon, { backgroundColor: "#fef3c7" }]}
              >
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

          <TouchableOpacity
            style={styles.deleteAccountBtn}
            onPress={handleDeleteAccount}
            disabled={deleteLoading}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={COLORS.destructive}
            />
            {deleteLoading ? (
              <ActivityIndicator size="small" color={COLORS.destructive} />
            ) : (
              <Text style={styles.deleteAccountText}>Xóa tài khoản</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleLockAccount}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.destructive} />
            <Text style={styles.deleteAccountText}>Khoá tài khoản</Text>
          </TouchableOpacity>

          {/* Sign out */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Ionicons
              name="log-out-outline"
              size={20}
              color={COLORS.destructive}
            />
            <Text style={styles.signOutText}>Đăng xuất</Text>
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </View>
      </ScrollView>

      <BottomNavigator />

      {/* OTP Modal for Deletion */}
      <Modal
        visible={showOtpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOtpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.warningIcon}>
                <Ionicons name="warning" size={32} color={COLORS.destructive} />
              </View>
              <Text style={styles.modalTitle}>Xác nhận OTP</Text>
              <Text style={styles.modalSubtitle}>
                Vui lòng nhập mã OTP đã được gửi đến email {user?.email} để xác
                nhận xóa tài khoản.
              </Text>
            </View>

            <TextInput
              style={styles.otpInput}
              placeholder="Nhập mã OTP 6 số"
              placeholderTextColor={COLORS.textLight}
              keyboardType="number-pad"
              maxLength={6}
              value={deleteOtp}
              onChangeText={setDeleteOtp}
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowOtpModal(false);
                  setDeleteOtp("");
                }}
              >
                <Text style={styles.modalCancelText}>Hủy bỏ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Xác nhận xóa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  cameraIconBadge: {
    position: "absolute",
    bottom: 2,
    left: 2,
    backgroundColor: COLORS.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
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
  deleteAccountBtn: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  deleteAccountText: {
    fontSize: 15,
    color: COLORS.destructive,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  warningIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  otpInput: {
    width: "100%",
    backgroundColor: COLORS.backgroundMuted,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    color: COLORS.text,
    letterSpacing: 4,
    marginBottom: 24,
  },
  modalFooter: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: COLORS.backgroundMuted,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: COLORS.destructive,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
