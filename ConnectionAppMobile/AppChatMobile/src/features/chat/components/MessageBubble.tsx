import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Modal,
  Alert,
  Linking,
  PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";
import type { Attachment } from "../types";

interface Props {
  message: string;
  attachments?: Attachment[];
  isMe?: boolean;
  senderName?: string;
  avatarUrl?: string | null;
  createdAt?: string;
  recalledAt?: string | null;
  isGroup?: boolean;
  onLongPress?: () => void;
}

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
};

const isImageAttachment = (attachment: Attachment): boolean => {
  if (attachment.type === "IMAGE") {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(attachment.fileUrl);
};

const resolveFileName = (
  originalFileName: string | null | undefined,
  url: string,
): string => {
  if (originalFileName && originalFileName.trim().length > 0) {
    return originalFileName;
  }

  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    return decodeURIComponent(segments[segments.length - 1] || "attached-file");
  } catch {
    return "attached-file";
  }
};

const MessageBubble: React.FC<Props> = ({
  message,
  attachments = [],
  isMe = false,
  senderName,
  avatarUrl,
  createdAt,
  recalledAt,
  isGroup = false,
  onLongPress,
}) => {
  const isRecalled = !!recalledAt;
  const FALLBACK = "https://i.pravatar.cc/150?img=5";
  const [previewImage, setPreviewImage] = React.useState<Attachment | null>(
    null,
  );
  const previewScale = React.useRef(new Animated.Value(1)).current;
  const previewTranslateX = React.useRef(new Animated.Value(0)).current;
  const previewTranslateY = React.useRef(new Animated.Value(0)).current;
  const previewScaleRef = React.useRef(1);
  const panOffsetRef = React.useRef({ x: 0, y: 0 });
  const panStartRef = React.useRef({ x: 0, y: 0 });
  const pinchStartDistanceRef = React.useRef<number | null>(null);
  const pinchStartScaleRef = React.useRef(1);

  const clampScale = (value: number): number => Math.max(1, Math.min(4, value));

  const resetPreviewTransform = React.useCallback(() => {
    previewScaleRef.current = 1;
    panOffsetRef.current = { x: 0, y: 0 };
    previewScale.setValue(1);
    previewTranslateX.setValue(0);
    previewTranslateY.setValue(0);
  }, [previewScale, previewTranslateX, previewTranslateY]);

  const applyPreviewScale = React.useCallback(
    (value: number) => {
      const nextScale = clampScale(value);
      previewScaleRef.current = nextScale;

      Animated.spring(previewScale, {
        toValue: nextScale,
        useNativeDriver: true,
        bounciness: 0,
        speed: 18,
      }).start();

      if (nextScale <= 1.01) {
        panOffsetRef.current = { x: 0, y: 0 };
        Animated.spring(previewTranslateX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
          speed: 18,
        }).start();
        Animated.spring(previewTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
          speed: 18,
        }).start();
      }
    },
    [previewScale, previewTranslateX, previewTranslateY],
  );

  const getTouchDistance = (
    touches: readonly { pageX: number; pageY: number }[],
  ) => {
    if (touches.length < 2) {
      return 0;
    }

    const a = touches[0];
    const b = touches[1];
    return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
  };

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !!previewImage,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !!previewImage &&
          (gestureState.numberActiveTouches === 2 ||
            Math.abs(gestureState.dx) > 2 ||
            Math.abs(gestureState.dy) > 2),
        onPanResponderGrant: (event) => {
          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            pinchStartDistanceRef.current = getTouchDistance(touches);
            pinchStartScaleRef.current = previewScaleRef.current;
          } else {
            pinchStartDistanceRef.current = null;
          }

          panStartRef.current = { ...panOffsetRef.current };
        },
        onPanResponderMove: (event, gestureState) => {
          if (!previewImage) {
            return;
          }

          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            const currentDistance = getTouchDistance(touches);
            const startDistance = pinchStartDistanceRef.current;

            if (!startDistance || startDistance <= 0 || currentDistance <= 0) {
              return;
            }

            const nextScale = clampScale(
              (pinchStartScaleRef.current * currentDistance) / startDistance,
            );
            previewScaleRef.current = nextScale;
            previewScale.setValue(nextScale);

            if (nextScale <= 1.01) {
              panOffsetRef.current = { x: 0, y: 0 };
              previewTranslateX.setValue(0);
              previewTranslateY.setValue(0);
            }

            return;
          }

          if (previewScaleRef.current <= 1) {
            return;
          }

          const nextX = panStartRef.current.x + gestureState.dx;
          const nextY = panStartRef.current.y + gestureState.dy;
          panOffsetRef.current = { x: nextX, y: nextY };
          previewTranslateX.setValue(nextX);
          previewTranslateY.setValue(nextY);
        },
        onPanResponderRelease: () => {
          pinchStartDistanceRef.current = null;

          if (previewScaleRef.current <= 1.01) {
            panOffsetRef.current = { x: 0, y: 0 };
            Animated.spring(previewTranslateX, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 0,
              speed: 18,
            }).start();
            Animated.spring(previewTranslateY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 0,
              speed: 18,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          pinchStartDistanceRef.current = null;
        },
      }),
    [previewImage, previewScale, previewTranslateX, previewTranslateY],
  );

  const openImagePreview = (attachment: Attachment) => {
    resetPreviewTransform();
    setPreviewImage(attachment);
  };

  const closePreview = () => {
    setPreviewImage(null);
    resetPreviewTransform();
  };

  const handleOpenAttachment = async (attachment: Attachment) => {
    try {
      const canOpen = await Linking.canOpenURL(attachment.fileUrl);
      if (!canOpen) {
        Alert.alert("Loi", "Khong the tai tep nay tren thiet bi.");
        return;
      }
      await Linking.openURL(attachment.fileUrl);
    } catch (error) {
      console.error("Cannot open attachment", error);
      Alert.alert("Loi", "Tai tep that bai.");
    }
  };

  return (
    <View style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}>
      {/* Avatar for received messages in groups */}
      {!isMe && isGroup && (
        <Image source={{ uri: avatarUrl || FALLBACK }} style={styles.avatar} />
      )}

      <View style={[styles.col, isMe ? styles.colRight : styles.colLeft]}>
        {/* Sender name in group */}
        {!isMe && isGroup && senderName && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}

        <TouchableOpacity
          activeOpacity={isMe && !isRecalled ? 0.75 : 1}
          onLongPress={isMe && !isRecalled ? onLongPress : undefined}
          style={[
            styles.bubble,
            isMe ? styles.bubbleSent : styles.bubbleReceived,
            isRecalled && styles.bubbleRecalled,
          ]}
        >
          {isRecalled ? (
            <Text
              style={[
                styles.messageText,
                isMe ? styles.sentText : styles.receivedText,
                styles.recalledText,
              ]}
            >
              Tin nhắn đã được thu hồi
            </Text>
          ) : (
            <View style={styles.contentWrap}>
              {attachments.length > 0 && (
                <View style={styles.attachmentsWrap}>
                  {attachments.map((attachment, index) =>
                    isImageAttachment(attachment) ? (
                      <TouchableOpacity
                        key={`${attachment.fileUrl}-${index}`}
                        onPress={() => openImagePreview(attachment)}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: attachment.fileUrl }}
                          style={styles.attachmentImage}
                        />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        key={`${attachment.fileUrl}-${index}`}
                        onPress={() => handleOpenAttachment(attachment)}
                        style={styles.fileCard}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="document-outline"
                          size={16}
                          color={isMe ? "#fff" : COLORS.text}
                        />
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.fileName,
                            isMe ? styles.sentText : styles.receivedText,
                          ]}
                        >
                          {resolveFileName(
                            attachment.originalFileName,
                            attachment.fileUrl,
                          )}
                        </Text>
                      </TouchableOpacity>
                    ),
                  )}
                </View>
              )}

              {!!message && (
                <Text
                  style={[
                    styles.messageText,
                    isMe ? styles.sentText : styles.receivedText,
                  ]}
                >
                  {message}
                </Text>
              )}
            </View>
          )}
        </TouchableOpacity>

        {createdAt && !isRecalled && (
          <Text
            style={[styles.time, isMe ? styles.timeRight : styles.timeLeft]}
          >
            {formatTime(createdAt)}
          </Text>
        )}
      </View>

      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewFrameWrap}>
            <TouchableOpacity
              style={styles.previewCloseFloating}
              onPress={closePreview}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.previewContainer}>
              <View
                style={styles.previewImageWrap}
                {...panResponder.panHandlers}
              >
                {previewImage && (
                  <Animated.Image
                    source={{ uri: previewImage.fileUrl }}
                    style={[
                      styles.previewImage,
                      {
                        transform: [
                          { translateX: previewTranslateX },
                          { translateY: previewTranslateY },
                          { scale: previewScale },
                        ],
                      },
                    ]}
                  />
                )}
              </View>

              <View style={styles.previewBottomActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.disabledActionBtn]}
                  disabled
                >
                  <Ionicons
                    name="chevron-back-outline"
                    size={20}
                    color="#8f8f8f"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.disabledActionBtn]}
                  disabled
                >
                  <Ionicons
                    name="chevron-forward-outline"
                    size={20}
                    color="#8f8f8f"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() =>
                    applyPreviewScale(previewScaleRef.current - 0.25)
                  }
                >
                  <Ionicons name="remove" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() =>
                    applyPreviewScale(previewScaleRef.current + 0.25)
                  }
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
                {previewImage && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleOpenAttachment(previewImage)}
                  >
                    <Ionicons name="download-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default MessageBubble;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginVertical: 2,
    paddingHorizontal: 12,
    alignItems: "flex-end",
  },
  rowLeft: {
    justifyContent: "flex-start",
  },
  rowRight: {
    justifyContent: "flex-end",
  },
  col: {
    maxWidth: "75%",
  },
  colLeft: {
    alignItems: "flex-start",
  },
  colRight: {
    alignItems: "flex-end",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 6,
    marginBottom: 4,
    backgroundColor: COLORS.backgroundMuted,
  },
  senderName: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: "600",
    marginBottom: 3,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    maxWidth: "100%",
  },
  contentWrap: {
    gap: 8,
  },
  attachmentsWrap: {
    gap: 8,
  },
  attachmentImage: {
    width: 180,
    height: 180,
    borderRadius: 10,
    backgroundColor: COLORS.backgroundMuted,
  },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: 220,
  },
  fileName: {
    fontSize: 13,
    flexShrink: 1,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  previewFrameWrap: {
    width: "100%",
    height: "82%",
    position: "relative",
    paddingTop: 8,
  },
  previewContainer: {
    width: "100%",
    height: "100%",
    borderWidth: 4,
    borderColor: "#000",
    backgroundColor: "#0f0f0f",
    borderRadius: 12,
    overflow: "hidden",
  },
  previewCloseFloating: {
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
  previewImageWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  previewBottomActions: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    zIndex: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledActionBtn: {
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  bubbleSent: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  bubbleRecalled: {
    backgroundColor: COLORS.backgroundMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  sentText: {
    color: "#fff",
  },
  receivedText: {
    color: COLORS.text,
  },
  recalledText: {
    color: COLORS.textMuted,
    fontStyle: "italic",
    fontSize: 14,
  },
  time: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 3,
    marginHorizontal: 4,
  },
  timeLeft: {
    alignSelf: "flex-start",
  },
  timeRight: {
    alignSelf: "flex-end",
  },
});
