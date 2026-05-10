import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
  Modal,
  Alert,
  Linking,
  PanResponder,
  LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import * as VideoThumbnails from "expo-video-thumbnails";
import { COLORS } from "../../../theme";
import PollMessage from "./PollMessage";
import ReminderMessage from "./ReminderMessage";
import type {
  Attachment,
  ReplyInfo,
  Poll,
  MessageReaction,
  Reminder,
  Participant,
} from "../types";
import {
  detectEmailInMessage,
  isValidEmailFormat,
} from "../services/emailDetector";
import {
  getOrFetchEmailUser,
  type FriendStatus,
} from "../services/userEmailCache";
import BusinessCard from "./BusinessCard";
import { useAuth } from "../../auth/context/AuthContext";
import type { User } from "../../auth/services/auth.service";

interface Props {
  message: string;
  attachments?: Attachment[];
  poll?: Poll | null;
  reminder?: Reminder | null;
  messageId?: string;
  isMe?: boolean;
  senderName?: string;
  avatarUrl?: string | null;
  createdAt?: string;
  recalledAt?: string | null;
  isGroup?: boolean;
  onLongPress?: () => void;
  onReplyPreviewPress?: () => void;
  onPollVote?: () => void;
  replyInfo?: ReplyInfo | null;
  isHighlighted?: boolean;
  reactions?: MessageReaction[];
  currentUserId?: number;
  participants?: Participant[];
  onReact?: (reactionCode: string | null) => void;
  onReminderEdit?: () => void;
  status?: "SENDING" | "SENT" | "RECEIVED" | "ERROR";
  onRetrySend?: () => void;
  markAdminMessages?: boolean;
  senderRole?: string;
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

const isVideoAttachment = (attachment: Attachment): boolean => {
  if (attachment.type === "VIDEO") {
    return true;
  }
  return /\.(mp4|webm|mov|m4v|ogv|mkv)(\?|$)/i.test(attachment.fileUrl);
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

/**
 * Trả về text preview cho reply info.
 * Ưu tiên: nội dung text → label attachment → tin nhắn đã thu hồi
 */
const getReplyPreviewText = (
  replyInfo: import("../types").ReplyInfo,
): string => {
  if (replyInfo.parentRecalled) {
    return "Tin nhắn đã được thu hồi";
  }
  if (replyInfo.parentContent) {
    return replyInfo.parentContent;
  }
  const atts = replyInfo.parentAttachments;
  if (atts && atts.length > 0) {
    const first = atts[0];
    if (first.type === "IMAGE")
      return atts.length > 1 ? `📷 ${atts.length} hình ảnh` : "📷 Hình ảnh";
    if (first.type === "VIDEO")
      return atts.length > 1 ? `🎥 ${atts.length} video` : "🎥 Video";
    if (first.type === "AUDIO") return "🎵 Âm thanh";
    const name = first.originalFileName ?? "Tệp đính kèm";
    return `📄 ${name}`;
  }
  return "Tin nhắn đã được thu hồi";
};

const MessageBubbleBase: React.FC<Props> = ({
  message,
  attachments = [],
  isMe = false,
  senderName,
  avatarUrl,
  createdAt,
  recalledAt,
  isGroup = false,
  onLongPress,
  onReplyPreviewPress,
  onPollVote,
  replyInfo,
  isHighlighted = false,
  poll,
  reminder,
  messageId,
  reactions = [],
  currentUserId,
  participants = [],
  onReact,
  onReminderEdit,
  status,
  onRetrySend,
  markAdminMessages = false,
  senderRole,
}) => {
  const isRecalled = !!recalledAt;
  const FALLBACK = "https://i.pravatar.cc/150?img=5";
  const isAdmin = senderRole === "OWNER" || senderRole === "CO_OWNER";
  const isOwner = senderRole === "OWNER";
  const showKeyIcon = markAdminMessages && isAdmin && !isMe;
  const { user: currentUser } = useAuth();

  const groupedReactions = reactions.reduce((acc, reaction) => {
    const existing = acc.get(reaction.reactionCode);
    if (existing) {
      existing.count += 1;
      existing.userIds.push(reaction.userId);
    } else {
      acc.set(reaction.reactionCode, {
        emoji: reaction.reactionCode,
        count: 1,
        userIds: [reaction.userId],
      });
    }
    return acc;
  }, new Map<string, { emoji: string; count: number; userIds: number[] }>());
  const reactionSummary = Array.from(groupedReactions.values());

  // ── Email / Business card state ──────────────────────────────────────────
  const [emailUser, setEmailUser] = useState<User | null>(null);
  const [emailStatus, setEmailStatus] = useState<FriendStatus>("NONE");
  const [detectedEmail, setDetectedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (isRecalled) return;
    const email = detectEmailInMessage(message || "");
    if (!email || !isValidEmailFormat(email)) {
      setEmailUser(null);
      setDetectedEmail(null);
      return;
    }
    setDetectedEmail(email);
    getOrFetchEmailUser(email)
      .then((result) => {
        setEmailUser(result.user);
        setEmailStatus(result.status);
      })
      .catch(() => setEmailUser(null));
  }, [message, isRecalled]);
  const [previewImage, setPreviewImage] = React.useState<Attachment | null>(
    null,
  );
  const [previewVideo, setPreviewVideo] = React.useState<Attachment | null>(
    null,
  );
  const [previewViewport, setPreviewViewport] = React.useState({
    width: 0,
    height: 0,
  });
  const [previewImageSize, setPreviewImageSize] = React.useState({
    width: 0,
    height: 0,
  });
  const [videoThumbnailByUrl, setVideoThumbnailByUrl] = React.useState<
    Record<string, string>
  >({});
  const previewScale = React.useRef(new Animated.Value(1)).current;
  const previewTranslateX = React.useRef(new Animated.Value(0)).current;
  const previewTranslateY = React.useRef(new Animated.Value(0)).current;
  const previewScaleRef = React.useRef(1);
  const panOffsetRef = React.useRef({ x: 0, y: 0 });
  const panStartRef = React.useRef({ x: 0, y: 0 });
  const pinchStartDistanceRef = React.useRef<number | null>(null);
  const pinchStartScaleRef = React.useRef(1);
  const thumbnailLoadingRef = React.useRef<Record<string, boolean>>({});
  const isMountedRef = React.useRef(true);

  const clampScale = (value: number): number => Math.max(1, Math.min(4, value));

  const getPanBounds = React.useCallback(
    (scale: number) => {
      const viewportWidth = previewViewport.width;
      const viewportHeight = previewViewport.height;

      if (scale <= 1 || viewportWidth <= 0 || viewportHeight <= 0) {
        return { maxX: 0, maxY: 0 };
      }

      let renderedWidth = viewportWidth;
      let renderedHeight = viewportHeight;

      if (previewImageSize.width > 0 && previewImageSize.height > 0) {
        const fitScale = Math.min(
          viewportWidth / previewImageSize.width,
          viewportHeight / previewImageSize.height,
        );
        renderedWidth = previewImageSize.width * fitScale;
        renderedHeight = previewImageSize.height * fitScale;
      }

      return {
        maxX: Math.max(0, (renderedWidth * scale - viewportWidth) / 2),
        maxY: Math.max(0, (renderedHeight * scale - viewportHeight) / 2),
      };
    },
    [previewViewport, previewImageSize],
  );

  const clampPanOffset = React.useCallback(
    (x: number, y: number, scale = previewScaleRef.current) => {
      const bounds = getPanBounds(scale);
      return {
        x: Math.min(bounds.maxX, Math.max(-bounds.maxX, x)),
        y: Math.min(bounds.maxY, Math.max(-bounds.maxY, y)),
      };
    },
    [getPanBounds],
  );

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

      const clampedOffset = clampPanOffset(
        panOffsetRef.current.x,
        panOffsetRef.current.y,
        nextScale,
      );

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
      } else {
        panOffsetRef.current = clampedOffset;
        previewTranslateX.setValue(clampedOffset.x);
        previewTranslateY.setValue(clampedOffset.y);
      }
    },
    [previewScale, previewTranslateX, previewTranslateY, clampPanOffset],
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
            } else {
              const clampedOffset = clampPanOffset(
                panOffsetRef.current.x,
                panOffsetRef.current.y,
                nextScale,
              );
              panOffsetRef.current = clampedOffset;
              previewTranslateX.setValue(clampedOffset.x);
              previewTranslateY.setValue(clampedOffset.y);
            }

            return;
          }

          if (previewScaleRef.current <= 1) {
            return;
          }

          const nextX = panStartRef.current.x + gestureState.dx;
          const nextY = panStartRef.current.y + gestureState.dy;
          const clampedOffset = clampPanOffset(nextX, nextY);
          panOffsetRef.current = clampedOffset;
          previewTranslateX.setValue(clampedOffset.x);
          previewTranslateY.setValue(clampedOffset.y);
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
    [
      previewImage,
      previewScale,
      previewTranslateX,
      previewTranslateY,
      clampPanOffset,
    ],
  );

  const openImagePreview = (attachment: Attachment) => {
    setPreviewVideo(null);
    setPreviewImageSize({ width: 0, height: 0 });
    resetPreviewTransform();
    setPreviewImage(attachment);
    Image.getSize(
      attachment.fileUrl,
      (width, height) => setPreviewImageSize({ width, height }),
      () => setPreviewImageSize({ width: 0, height: 0 }),
    );
  };

  const ensureVideoThumbnail = React.useCallback(
    async (videoUrl: string) => {
      if (!videoUrl || videoThumbnailByUrl[videoUrl]) {
        return;
      }

      if (thumbnailLoadingRef.current[videoUrl]) {
        return;
      }

      thumbnailLoadingRef.current[videoUrl] = true;

      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUrl, {
          time: 1000,
          quality: 0.6,
        });

        if (!isMountedRef.current) {
          return;
        }

        setVideoThumbnailByUrl((prev) => ({
          ...prev,
          [videoUrl]: uri,
        }));
      } catch {
        // Keep the fallback placeholder when thumbnail generation fails.
      } finally {
        thumbnailLoadingRef.current[videoUrl] = false;
      }
    },
    [videoThumbnailByUrl],
  );

  const openVideoPreview = (attachment: Attachment) => {
    void ensureVideoThumbnail(attachment.fileUrl);
    setPreviewImage(null);
    resetPreviewTransform();
    setPreviewVideo(attachment);
  };

  const closeImagePreview = () => {
    setPreviewImage(null);
    setPreviewImageSize({ width: 0, height: 0 });
    setPreviewViewport({ width: 0, height: 0 });
    resetPreviewTransform();
  };

  const closeVideoPreview = () => {
    setPreviewVideo(null);
  };

  const handlePreviewLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPreviewViewport({ width, height });
  };

  React.useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    attachments.forEach((attachment) => {
      if (isVideoAttachment(attachment)) {
        void ensureVideoThumbnail(attachment.fileUrl);
      }
    });
  }, [attachments, ensureVideoThumbnail]);

  React.useEffect(() => {
    if (!previewImage || previewScaleRef.current <= 1.01) {
      return;
    }

    const clampedOffset = clampPanOffset(
      panOffsetRef.current.x,
      panOffsetRef.current.y,
      previewScaleRef.current,
    );
    panOffsetRef.current = clampedOffset;
    previewTranslateX.setValue(clampedOffset.x);
    previewTranslateY.setValue(clampedOffset.y);
  }, [
    previewImage,
    previewViewport,
    previewImageSize,
    clampPanOffset,
    previewTranslateX,
    previewTranslateY,
  ]);

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
    <View
      style={[
        styles.row,
        poll || reminder
          ? styles.rowCenter
          : isMe
            ? styles.rowRight
            : styles.rowLeft,
      ]}
    >
      {/* Avatar for received messages in groups */}
      {!isMe && isGroup && (
        <View style={styles.avatarWrap}>
          <Image source={{ uri: avatarUrl || FALLBACK }} style={styles.avatar} />
          {showKeyIcon && (
            <View style={[
              styles.keyIconBadge,
              isOwner ? styles.keyIconOwner : styles.keyIconCoOwner
            ]}>
              <Ionicons
                name="key"
                size={10}
                color={isOwner ? "#f59e0b" : "#3b82f6"}
              />
            </View>
          )}
        </View>
      )}

      <View style={[styles.col, isMe ? styles.colRight : styles.colLeft]}>
        {/* Sender name in group */}
        {!isMe && isGroup && senderName && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}

        <View style={styles.bubbleShell}>
          <TouchableOpacity
            activeOpacity={onLongPress && !isRecalled ? 0.75 : 1}
            onLongPress={!isRecalled ? onLongPress : undefined}
            style={[
              styles.bubble,
              poll
                ? styles.bubblePoll
                : isMe
                  ? styles.bubbleSent
                  : styles.bubbleReceived,
              isRecalled && styles.bubbleRecalled,
              replyInfo && !isRecalled && styles.bubbleWithReply,
              isHighlighted && styles.bubbleHighlighted,
              showKeyIcon && !isRecalled && !isMe && (
                isOwner ? styles.bubbleAdminOwner : styles.bubbleAdminCoOwner
              ),
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
                {replyInfo && (
                  <TouchableOpacity
                    activeOpacity={onReplyPreviewPress ? 0.65 : 1}
                    onPress={onReplyPreviewPress}
                    style={[
                      styles.replyPreviewWrap,
                      isMe
                        ? styles.replyPreviewWrapSent
                        : styles.replyPreviewWrapReceived,
                    ]}
                  >
                    <Text
                      style={[
                        styles.replySender,
                        isMe
                          ? styles.replySenderSent
                          : styles.replySenderReceived,
                      ]}
                      numberOfLines={1}
                    >
                      {replyInfo.parentSenderName}
                    </Text>
                    <Text
                      style={[
                        styles.replyContent,
                        isMe
                          ? styles.replyContentSent
                          : styles.replyContentReceived,
                      ]}
                      numberOfLines={1}
                    >
                      {getReplyPreviewText(replyInfo)}
                    </Text>
                  </TouchableOpacity>
                )}

                {attachments.length > 0 && (
                  <View style={styles.attachmentsWrap}>
                    {attachments.map((attachment, index) =>
                      isImageAttachment(attachment) ? (
                        <TouchableOpacity
                          key={`${attachment.fileUrl}-${index}`}
                          onPress={() => openImagePreview(attachment)}
                          onLongPress={!isRecalled ? onLongPress : undefined}
                          delayLongPress={350}
                          activeOpacity={0.85}
                        >
                          <Image
                            source={{ uri: attachment.fileUrl }}
                            style={styles.attachmentImage}
                          />
                        </TouchableOpacity>
                      ) : isVideoAttachment(attachment) ? (
                        <TouchableOpacity
                          key={`${attachment.fileUrl}-${index}`}
                          onPress={() => openVideoPreview(attachment)}
                          onLongPress={!isRecalled ? onLongPress : undefined}
                          delayLongPress={350}
                          style={styles.videoCard}
                          activeOpacity={0.85}
                        >
                          <View style={styles.videoThumb}>
                            {videoThumbnailByUrl[attachment.fileUrl] ? (
                              <Image
                                source={{
                                  uri: videoThumbnailByUrl[attachment.fileUrl],
                                }}
                                style={styles.videoThumbImage}
                              />
                            ) : (
                              <View style={styles.videoThumbFallback} />
                            )}
                            <View style={styles.videoThumbOverlay}>
                              <Ionicons
                                name="play-circle"
                                size={40}
                                color="#fff"
                              />
                            </View>
                          </View>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.videoLabel,
                              isMe ? styles.sentText : styles.receivedText,
                            ]}
                          >
                            {resolveFileName(
                              attachment.originalFileName,
                              attachment.fileUrl,
                            )}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          key={`${attachment.fileUrl}-${index}`}
                          onPress={() => handleOpenAttachment(attachment)}
                          onLongPress={!isRecalled ? onLongPress : undefined}
                          delayLongPress={350}
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

                {poll && (
                  <PollMessage
                    poll={poll}
                    onVote={onPollVote || (() => {})}
                    isMe={isMe}
                  />
                )}

                {reminder && messageId && (
                  <ReminderMessage
                    messageId={messageId}
                    conversationId={reminder.conversationId}
                    reminder={reminder}
                    currentUserId={currentUserId ?? 0}
                    participants={participants}
                    onEdit={onReminderEdit}
                  />
                )}

                {/* Business card — shown when message contains a known email */}
                {!isRecalled && emailUser && detectedEmail && (
                  <BusinessCard
                    email={detectedEmail}
                    user={emailUser}
                    initialStatus={emailStatus}
                    currentUserId={currentUser?.id}
                  />
                )}
              </View>
            )}
          </TouchableOpacity>
        </View>

        {status === "SENDING" && !isRecalled && (
          <View
            style={[
              styles.statusRow,
              isMe ? styles.statusRowRight : styles.statusRowLeft,
            ]}
          >
            <ActivityIndicator
              size="small"
              color={isMe ? "rgba(255,255,255,0.75)" : COLORS.textMuted}
            />
            <Text
              style={[
                styles.statusText,
                isMe ? styles.statusTextSent : styles.statusTextReceived,
              ]}
            >
              Dang gui...
            </Text>
          </View>
        )}

        {status === "ERROR" && !isRecalled && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={onRetrySend}
            style={[
              styles.statusRow,
              isMe ? styles.statusRowRight : styles.statusRowLeft,
            ]}
          >
            <Ionicons name="alert-circle" size={14} color="#dc2626" />
            <Text style={[styles.statusText, styles.statusTextError]}>
              Gui that bai. Thu lai
            </Text>
          </TouchableOpacity>
        )}

        {createdAt && !isRecalled && (
          <Text
            style={[styles.time, isMe ? styles.timeRight : styles.timeLeft]}
          >
            {formatTime(createdAt)}
          </Text>
        )}

        {reactionSummary.length > 0 && (
          <View
            style={[
              styles.reactionWrap,
              isMe ? styles.reactionWrapRight : styles.reactionWrapLeft,
            ]}
          >
            {reactionSummary.map((reaction) => {
              const isMine =
                currentUserId != null &&
                reaction.userIds.includes(currentUserId);
              return (
                <TouchableOpacity
                  key={reaction.emoji}
                  activeOpacity={0.8}
                  onPress={() => onReact?.(isMine ? null : reaction.emoji)}
                  style={[
                    styles.reactionChip,
                    isMine && styles.reactionChipMine,
                  ]}
                >
                  <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                  <Text style={styles.reactionCount}>{reaction.count}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={closeImagePreview}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewFrameWrap}>
            <TouchableOpacity
              style={styles.previewCloseFloating}
              onPress={closeImagePreview}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.previewContainer}>
              <View style={styles.previewMediaWrap}>
                <View
                  style={styles.previewImageWrap}
                  onLayout={handlePreviewLayout}
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
              </View>

              <View style={styles.previewBottomActions}>
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

      <Modal
        visible={!!previewVideo}
        transparent
        animationType="fade"
        onRequestClose={closeVideoPreview}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewFrameWrap}>
            <TouchableOpacity
              style={styles.previewCloseFloating}
              onPress={closeVideoPreview}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.previewContainer}>
              <View style={styles.previewMediaWrap}>
                {previewVideo && (
                  <Video
                    source={{ uri: previewVideo.fileUrl }}
                    style={styles.previewVideo}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay
                  />
                )}
              </View>

              <View style={styles.previewBottomActions}>
                {previewVideo && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleOpenAttachment(previewVideo)}
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

const MessageBubble = React.memo(MessageBubbleBase);

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
  rowCenter: {
    justifyContent: "center",
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
  avatarWrap: {
    position: "relative",
    marginRight: 6,
    marginBottom: 4,
  },
  keyIconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  keyIconOwner: {
    borderColor: "#f59e0b40",
  },
  keyIconCoOwner: {
    borderColor: "#3b82f640",
  },
  bubbleAdminOwner: {
    borderWidth: 2,
    borderColor: "#f59e0b60",
  },
  bubbleAdminCoOwner: {
    borderWidth: 2,
    borderColor: "#3b82f660",
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
  bubbleShell: {
    position: "relative",
    marginBottom: 4,
  },
  bubbleWithReply: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  contentWrap: {
    gap: 8,
  },
  replyPreviewWrap: {
    borderLeftWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  replyPreviewWrapSent: {
    borderLeftColor: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  replyPreviewWrapReceived: {
    borderLeftColor: COLORS.primary,
    backgroundColor: COLORS.backgroundMuted,
  },
  replySender: {
    fontSize: 11,
    fontWeight: "700",
  },
  replySenderSent: {
    color: "rgba(255,255,255,0.95)",
  },
  replySenderReceived: {
    color: COLORS.primary,
  },
  replyContent: {
    fontSize: 11,
    marginTop: 1,
  },
  replyContentSent: {
    color: "rgba(255,255,255,0.86)",
  },
  replyContentReceived: {
    color: COLORS.textMuted,
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
  videoCard: {
    width: 220,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  videoThumb: {
    position: "relative",
    height: 120,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  videoThumbImage: {
    width: "100%",
    height: "100%",
  },
  videoThumbFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  videoThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  videoLabel: {
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    justifyContent: "space-between",
  },
  previewMediaWrap: {
    flex: 1,
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
  previewVideo: {
    width: "100%",
    height: "100%",
  },
  previewBottomActions: {
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
  bubblePoll: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ede9fe",
    width: "85%",
    paddingHorizontal: 0, // Let PollMessage handle padding
    paddingVertical: 0,
  },
  bubbleRecalled: {
    backgroundColor: COLORS.backgroundMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  bubbleHighlighted: {
    borderWidth: 2,
    borderColor: "#f5c542",
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
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginHorizontal: 4,
  },
  statusRowLeft: {
    alignSelf: "flex-start",
  },
  statusRowRight: {
    alignSelf: "flex-end",
  },
  statusText: {
    fontSize: 11,
  },
  statusTextSent: {
    color: "rgba(255,255,255,0.8)",
  },
  statusTextReceived: {
    color: COLORS.textMuted,
  },
  statusTextError: {
    color: "#dc2626",
    fontWeight: "600",
  },
  reactionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  reactionWrapLeft: {
    alignSelf: "flex-start",
  },
  reactionWrapRight: {
    alignSelf: "flex-end",
  },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#d8d8e6",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reactionChipMine: {
    borderColor: COLORS.primary,
    backgroundColor: "#efe9ff",
  },
  reactionEmoji: {
    fontSize: 13,
  },
  reactionCount: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
});
