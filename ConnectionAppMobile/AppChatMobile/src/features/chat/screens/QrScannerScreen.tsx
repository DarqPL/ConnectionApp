import React from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChat } from "../context/ChatContext";
import { useAuth } from "../../auth/context/AuthContext";
import type { Conversation } from "../types";
import { COLORS } from "../../../theme";
import { extractInviteTokenFromGroupLink } from "../utils/groupInvite";

const QrScannerScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { joinGroupByInviteToken } = useChat();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanningLocked, setIsScanningLocked] = React.useState(false);
  const [isJoining, setIsJoining] = React.useState(false);

  const openConversation = React.useCallback(
    (conversation: Conversation) => {
      const displayName =
        conversation.type === "PRIVATE"
          ? conversation.participants.find((p) => p.userId !== user?.id)
              ?.displayName || conversation.name || "Unknown"
          : conversation.name || "Nhom chat";

      const avatarUrl =
        conversation.type === "PRIVATE"
          ? conversation.participants.find((p) => p.userId !== user?.id)
              ?.avatarUrl || null
          : conversation.avatarUrl || null;

      navigation.replace("ChatRoom", {
        conversationId: conversation.id,
        name: displayName,
        avatarUrl,
        type: conversation.type,
        participants: conversation.participants || [],
      });
    },
    [navigation, user?.id],
  );

  const resetScannerSoon = React.useCallback(() => {
    setTimeout(() => {
      setIsScanningLocked(false);
    }, 1200);
  }, []);

  const handleBarcodeScanned = React.useCallback(
    async ({ data }: { data: string }) => {
      if (isScanningLocked || isJoining) {
        return;
      }

      setIsScanningLocked(true);
      const inviteToken = extractInviteTokenFromGroupLink(data);

      if (!inviteToken) {
        Alert.alert("QR khong hop le", "Day khong phai ma QR link nhom.");
        resetScannerSoon();
        return;
      }

      setIsJoining(true);
      try {
        const conversation = await joinGroupByInviteToken(inviteToken);
        openConversation(conversation);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Khong the tham gia nhom";
        Alert.alert("Khong the vao nhom", message);
        setIsJoining(false);
        resetScannerSoon();
      }
    },
    [
      isJoining,
      isScanningLocked,
      joinGroupByInviteToken,
      openConversation,
      resetScannerSoon,
    ],
  );

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Text style={styles.permissionTitle}>Can quyen camera</Text>
        <Text style={styles.permissionText}>
          Hay cap quyen camera de quet QR tham gia nhom.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => void requestPermission()}>
          <Text style={styles.primaryButtonText}>Cap quyen camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.secondaryButtonText}>Quay lai</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleBarcodeScanned}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Quet QR nhom</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.helperText}>
          Dua QR link nhom vao trong khung de tu dong tham gia.
        </Text>
        {isJoining && (
          <View style={styles.statusBadge}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.statusText}>Dang vao nhom...</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default QrScannerScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  permissionScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#111827",
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 14,
    color: "#cbd5e1",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  primaryButton: {
    minWidth: 180,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryButton: {
    minWidth: 180,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  placeholder: {
    width: 40,
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: "#fff",
    backgroundColor: "transparent",
  },
  helperText: {
    marginTop: 24,
    fontSize: 14,
    lineHeight: 22,
    color: "#fff",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  statusBadge: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(17,24,39,0.88)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  statusText: {
    color: "#fff",
    fontWeight: "600",
  },
});
