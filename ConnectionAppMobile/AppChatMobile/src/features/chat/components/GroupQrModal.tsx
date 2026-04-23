import React from "react";
import {
  Alert,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import QRCode from "react-native-qrcode-svg";

interface GroupQrModalProps {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  qrValue: string | null;
}

const sanitizeFileName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "group-qr";

const GroupQrModal: React.FC<GroupQrModalProps> = ({
  visible,
  onClose,
  groupName,
  qrValue,
}) => {
  const [zoomLevel, setZoomLevel] = React.useState(1);
  const scale = React.useRef(new Animated.Value(1)).current;
  const qrCodeRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (!visible || !qrValue) {
      setZoomLevel(1);
      scale.setValue(1);
    }
  }, [qrValue, scale, visible]);

  const applyZoom = React.useCallback(
    (nextZoom: number) => {
      const clamped = Math.max(1, Math.min(4, nextZoom));
      setZoomLevel(clamped);
      Animated.spring(scale, {
        toValue: clamped,
        useNativeDriver: true,
        bounciness: 0,
        speed: 18,
      }).start();
    },
    [scale],
  );

  const handleSaveQr = React.useCallback(async () => {
    if (!qrValue) {
      Alert.alert("Loi", "Ma QR chua san sang");
      return;
    }

    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Loi", "Can quyen thu vien de luu ma QR");
        return;
      }

      const base64 = await new Promise<string>((resolve, reject) => {
        if (!qrCodeRef.current?.toDataURL) {
          reject(new Error("QR ref unavailable"));
          return;
        }

        qrCodeRef.current.toDataURL((data: string) => {
          if (!data) {
            reject(new Error("QR base64 unavailable"));
            return;
          }
          resolve(data);
        });
      });

      const fileUri = `${FileSystem.cacheDirectory}${sanitizeFileName(groupName)}-qr.png`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await MediaLibrary.saveToLibraryAsync(fileUri);
      Alert.alert("Thanh cong", "Da luu ma QR vao thu vien");
    } catch (error) {
      console.error("Save QR failed:", error);
      Alert.alert("Loi", "Khong the luu ma QR");
    }
  }, [groupName, qrValue]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.frameWrap}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={styles.container}>
            <View style={styles.content}>
              <Text style={styles.title}>QR nhom</Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {groupName}
              </Text>

              <View style={styles.imageWrap}>
                {qrValue ? (
                  <Animated.View
                    style={{
                      transform: [{ scale }],
                    }}
                  >
                    <View style={styles.qrCard}>
                      <QRCode
                        value={qrValue}
                        size={260}
                        quietZone={12}
                        color="#111111"
                        backgroundColor="#ffffff"
                        getRef={(ref) => {
                          qrCodeRef.current = ref;
                        }}
                      />
                    </View>
                  </Animated.View>
                ) : (
                  <Text style={styles.errorText}>Khong tao duoc ma QR</Text>
                )}
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => applyZoom(zoomLevel - 0.25)}
              >
                <Ionicons name="remove" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => applyZoom(zoomLevel + 0.25)}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => void handleSaveQr()}
                disabled={!qrValue}
              >
                <Ionicons name="download-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default GroupQrModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.84)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  frameWrap: {
    width: "100%",
    height: "82%",
    position: "relative",
    paddingTop: 8,
  },
  closeBtn: {
    position: "absolute",
    top: -14,
    right: -6,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    borderWidth: 4,
    borderColor: "#000",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0f0f0f",
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "#cbd5e1",
    textAlign: "center",
  },
  imageWrap: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  qrCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  errorText: {
    color: "#fff",
    fontSize: 14,
  },
  actions: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(0,0,0,0.88)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 10,
    paddingBottom: 16,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
});
