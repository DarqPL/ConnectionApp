import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Keyboard,
  ScrollView,
  Image,
  Text,
  Alert,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";
import EmojiPicker from "rn-emoji-keyboard";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import type { PendingAttachment } from "../context/ChatContext";
import { useChat } from "../context/ChatContext";
import { chatService, type AiRewriteAction } from "../services/chat.service";
import type { Message } from "../types";
import {
  MAX_UPLOAD_FILE_SIZE_BYTES,
  MAX_UPLOAD_FILE_SIZE_LABEL,
} from "../../../config/upload";

interface ChatInputProps {
  onSend: (
    message: string,
    files: PendingAttachment[],
    parentId?: string | null,
  ) => Promise<void>;
  conversationId: number;
  disabled?: boolean;
  replyTo?: Message | null;
  onCancelReply?: () => void;
  onOpenPollCreator?: () => void;
  onOpenReminderCreator?: () => void;
  allowMemberSendMessage?: boolean;
  currentUserRole?: string | null;
  isGroup?: boolean;
}

const MAX_FILES = 5;

type LocalAttachment = PendingAttachment & {
  id: string;
  isImage: boolean;
};

type DeliveryState = "SENT" | "RECEIVED" | null;

const formatFileSize = (size?: number): string => {
  if (!size || Number.isNaN(size)) return "Unknown";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const getReplyPreviewText = (message: Message | null | undefined): string => {
  if (!message) return "";
  if (message.recalledAt) {
    return "Tin nhắn đã được thu hồi";
  }

  const normalized = (message.content ?? "").trim();
  if (normalized.length > 0) {
    return normalized;
  }

  const attachmentCount = message.attachments?.length ?? 0;
  if (attachmentCount === 1) {
    return "Đính kèm 1 tệp";
  }
  if (attachmentCount > 1) {
    return `Đính kèm ${attachmentCount} tệp`;
  }
  return "Tin nhắn";
};

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  conversationId,
  disabled = false,
  replyTo = null,
  onCancelReply,
  onOpenPollCreator,
  onOpenReminderCreator,
  allowMemberSendMessage = true,
  currentUserRole = null,
  isGroup = false,
}) => {
  const { notifyTyping, notifyStoppedTyping } = useChat();
  const isAdmin = currentUserRole === "OWNER" || currentUserRole === "CO_OWNER";
  const canSendMessage = !isGroup || allowMemberSendMessage || isAdmin;
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isAiActionModalOpen, setIsAiActionModalOpen] = useState(false);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<LocalAttachment[]>([]);
  const [deliveryState, setDeliveryState] = useState<DeliveryState>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingStateRef = useRef(false);
  const deliveryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTyping = (targetConversationId: number) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (typingStateRef.current) {
      notifyStoppedTyping(targetConversationId);
      typingStateRef.current = false;
    }
  };

  const appendFiles = (incoming: LocalAttachment[]) => {
    if (incoming.length === 0) return;

    setSelectedFiles((prev) => {
      const available = MAX_FILES - prev.length;
      if (available <= 0) {
        Alert.alert("Thông báo", `Bạn chỉ có thể gửi tối đa ${MAX_FILES} tệp.`);
        return prev;
      }

      const acceptedBySize: LocalAttachment[] = [];
      let rejectedBySize = 0;

      incoming.slice(0, available).forEach((item) => {
        if (item.size && item.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
          rejectedBySize += 1;
          return;
        }
        acceptedBySize.push(item);
      });

      if (incoming.length > available) {
        Alert.alert(
          "Thông báo",
          `Chỉ nhận ${available} tệp do giới hạn ${MAX_FILES} tệp.`,
        );
      }

      if (rejectedBySize > 0) {
        Alert.alert(
          "Dung lượng vượt quá",
          `${rejectedBySize} tệp lớn hơn ${MAX_UPLOAD_FILE_SIZE_LABEL} và đã bị bỏ qua.`,
        );
      }

      return [...prev, ...acceptedBySize];
    });
  };

  const pickImages = async () => {
    Keyboard.dismiss();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_FILES,
      quality: 1,
    });

    if (result.canceled) return;

    appendFiles(
      result.assets.map((asset) => ({
        id: `${Date.now()}-${Math.random()}-${asset.fileName || "image"}`,
        uri: asset.uri,
        name: asset.fileName || `image-${Date.now()}.jpg`,
        mimeType: asset.mimeType,
        size: asset.fileSize,
        isImage: true,
      })),
    );
  };

  const pickDocuments = async () => {
    Keyboard.dismiss();
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
      type: "*/*",
    });

    if (result.canceled) return;

    appendFiles(
      result.assets.map((asset) => ({
        id: `${Date.now()}-${Math.random()}-${asset.name}`,
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
        isImage: (asset.mimeType ?? "").startsWith("image/"),
      })),
    );
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if ((!trimmed && selectedFiles.length === 0) || isSending || disabled)
      return;

    stopTyping(conversationId);

    const filesToSend = selectedFiles.map((file) => ({
      uri: file.uri,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
    }));

    setIsSending(true);
    setText("");
    setSelectedFiles([]);
    onCancelReply?.();
    try {
      await onSend(trimmed, filesToSend, replyTo?.id ?? null);

      setDeliveryState("SENT");
      if (deliveryTimeoutRef.current) {
        clearTimeout(deliveryTimeoutRef.current);
      }
      deliveryTimeoutRef.current = setTimeout(() => {
        setDeliveryState("RECEIVED");
      }, 700);
    } catch (error) {
      console.error("Error sending message:", error);
      setDeliveryState(null);
    } finally {
      setIsSending(false);
    }
  };

  const canSend =
    (text.trim().length > 0 || selectedFiles.length > 0) &&
    !isSending &&
    !disabled;

  const handleOpenEmojiPicker = () => {
    Keyboard.dismiss();
    setIsEmojiPickerOpen(true);
  };

  const handleSelectEmoji = ({ emoji }: { emoji: string }) => {
    if (!emoji) return;
    handleTextChange(`${text}${emoji}`);
  };

  const applyAiDraft = (nextDraft: string) => {
    handleTextChange(nextDraft);
  };

  const runAiRewrite = async (
    action: AiRewriteAction,
    targetLanguage?: "EN" | "VI",
  ) => {
    const draft = text.trim();
    if (action !== "SUGGEST_REPLY" && !draft) {
      Alert.alert(
        "Thông báo",
        "Vui lòng nhập nội dung trước khi dùng AI Rewrite.",
      );
      return;
    }

    setIsAiProcessing(true);
    try {
      const result = await chatService.aiRewriteDraft({
        conversationId,
        draftContent: draft,
        action,
        targetLanguage,
      });

      if (action === "SUGGEST_REPLY") {
        const suggestions = (result.suggestions ?? [])
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 3);

        if (suggestions.length === 0) {
          Alert.alert("AI Rewrite", "AI chưa tạo được gợi ý trả lời.");
          return;
        }

        setAiSuggestions(suggestions);
        setIsSuggestionModalOpen(true);
        return;
      }

      const rewritten = result.rewrittenText?.trim();
      if (!rewritten) {
        Alert.alert("AI Rewrite", "AI Rewrite trả về dữ liệu không hợp lệ.");
        return;
      }

      applyAiDraft(rewritten);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể xử lý AI Rewrite.";
      Alert.alert("AI Rewrite", message);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const openAiMenu = () => {
    Keyboard.dismiss();
    setIsAiActionModalOpen(true);
  };

  const handleSuggestionSelect = (suggestion: string) => {
    applyAiDraft(suggestion);
    setIsSuggestionModalOpen(false);
    setAiSuggestions([]);
  };

  // NEW: Handle text input with typing notification
  const handleTextChange = (newText: string) => {
    setText(newText);

    // If user is typing and text is not empty
    if (newText.trim().length > 0) {
      // If not already in typing state, send typing notification
      if (!typingStateRef.current) {
        notifyTyping(conversationId);
        typingStateRef.current = true;
        console.log("[ChatInput] User started typing");
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to send stopped typing after 1 second of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        notifyStoppedTyping(conversationId);
        typingStateRef.current = false;
        typingTimeoutRef.current = null;
        console.log("[ChatInput] User stopped typing");
      }, 1000);
    } else {
      // Text is empty, send stopped typing
      if (typingStateRef.current) {
        notifyStoppedTyping(conversationId);
        typingStateRef.current = false;
        console.log("[ChatInput] User cleared text");
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  // NEW: Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (deliveryTimeoutRef.current) {
        clearTimeout(deliveryTimeoutRef.current);
      }
      if (typingStateRef.current) {
        notifyStoppedTyping(conversationId);
      }
    };
  }, [conversationId, notifyStoppedTyping]);

  const isComposing = text.trim().length > 0;
  const deliveryLabel =
    deliveryState === "SENT"
      ? "Đã gửi"
      : deliveryState === "RECEIVED"
        ? "Đã nhận"
        : null;

  return (
    <>
      <View style={styles.wrapper}>
        {(isComposing || deliveryLabel) && (
          <View style={styles.chatStatusRow}>
            {isComposing && (
              <Text style={styles.composingText}>Bạn đang soạn tin...</Text>
            )}
            {deliveryLabel && (
              <Text style={styles.deliveryText}>{deliveryLabel}</Text>
            )}
          </View>
        )}

        {replyTo && (
          <View style={styles.replyBanner}>
            <View style={styles.replyContent}>
              <Text style={styles.replyTitle}>
                Đang trả lời {replyTo.senderInfo?.displayName}
              </Text>
              <Text numberOfLines={1} style={styles.replyText}>
                {getReplyPreviewText(replyTo)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.replyCloseBtn}
              onPress={onCancelReply}
              disabled={isSending}
            >
              <Ionicons name="close" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {!canSendMessage && (
          <View style={styles.disabledBanner}>
            <Ionicons name="lock-closed-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.disabledText}>
              Chỉ trưởng nhóm và phó nhóm được nhắn tin
            </Text>
          </View>
        )}

        {selectedFiles.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.previewRow}
          >
            {selectedFiles.map((item) => (
              <View key={item.id} style={styles.previewCard}>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeFile(item.id)}
                  disabled={isSending}
                >
                  <Ionicons name="close" size={14} color={COLORS.textMuted} />
                </TouchableOpacity>

                {item.isImage ? (
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.previewImage}
                  />
                ) : (
                  <View style={styles.previewFileIcon}>
                    <Ionicons
                      name="document-outline"
                      size={18}
                      color={COLORS.textMuted}
                    />
                  </View>
                )}

                <Text style={styles.previewName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.previewSize}>
                  {formatFileSize(item.size)}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.container}>
          <TouchableOpacity
            style={[styles.iconBtn, !canSendMessage && styles.iconBtnDisabled]}
            onPress={pickImages}
            disabled={!canSendMessage}
          >
            <Ionicons name="image-outline" size={24} color={canSendMessage ? COLORS.textMuted : COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, !canSendMessage && styles.iconBtnDisabled]}
            onPress={pickDocuments}
            disabled={!canSendMessage}
          >
            <Ionicons
              name="attach-outline"
              size={24}
              color={canSendMessage ? COLORS.textMuted : COLORS.textLight}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, !canSendMessage && styles.iconBtnDisabled]}
            onPress={handleOpenEmojiPicker}
            disabled={!canSendMessage}
          >
            <Ionicons name="happy-outline" size={24} color={canSendMessage ? COLORS.textMuted : COLORS.textLight} />
          </TouchableOpacity>

          {onOpenPollCreator && (
            <TouchableOpacity
              style={[styles.iconBtn, !canSendMessage && styles.iconBtnDisabled]}
              onPress={onOpenPollCreator}
              disabled={isSending || disabled || !canSendMessage}
            >
              <Ionicons
                name="stats-chart-outline"
                size={22}
                color={canSendMessage ? COLORS.textMuted : COLORS.textLight}
              />
            </TouchableOpacity>
          )}

          {onOpenReminderCreator && (
            <TouchableOpacity
              style={[styles.iconBtn, !canSendMessage && styles.iconBtnDisabled]}
              onPress={onOpenReminderCreator}
              disabled={isSending || disabled || !canSendMessage}
            >
              <Ionicons
                name="alarm-outline"
                size={22}
                color={canSendMessage ? COLORS.textMuted : COLORS.textLight}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.iconBtn, !canSendMessage && styles.iconBtnDisabled]}
            onPress={openAiMenu}
            disabled={isSending || disabled || isAiProcessing || !canSendMessage}
          >
            {isAiProcessing ? (
              <ActivityIndicator size="small" color={COLORS.textMuted} />
            ) : (
              <Ionicons
                name="sparkles-outline"
                size={22}
                color={canSendMessage ? COLORS.textMuted : COLORS.textLight}
              />
            )}
          </TouchableOpacity>

          <View style={styles.inputWrap}>
            <TextInput
              value={text}
              onChangeText={handleTextChange}
              placeholder="Soạn tin nhắn..."
              placeholderTextColor={COLORS.textLight}
              style={styles.input}
              editable={!isSending && !disabled}
              multiline
              maxLength={1000}
              returnKeyType="default"
              textAlignVertical="center"
            />
          </View>

          {canSend ? (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={handleSend}
              disabled={!canSend}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="mic-outline" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <EmojiPicker
        open={isEmojiPickerOpen}
        onClose={() => setIsEmojiPickerOpen(false)}
        onEmojiSelected={handleSelectEmoji}
      />

      <Modal
        visible={isAiActionModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAiActionModalOpen(false)}
      >
        <View style={styles.suggestionOverlay}>
          <View style={styles.suggestionCard}>
            <Text style={styles.suggestionTitle}>AI Rewrite</Text>
            <Text style={styles.suggestionDesc}>
              Chọn chức năng bạn muốn dùng.
            </Text>

            <TouchableOpacity
              style={styles.suggestionButton}
              onPress={() => {
                setIsAiActionModalOpen(false);
                runAiRewrite("TRANSLATE", "VI").catch(() => {});
              }}
            >
              <Text style={styles.suggestionButtonText}>
                Dịch sang tiếng Việt
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.suggestionButton}
              onPress={() => {
                setIsAiActionModalOpen(false);
                runAiRewrite("TRANSLATE", "EN").catch(() => {});
              }}
            >
              <Text style={styles.suggestionButtonText}>
                Translate to English
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.suggestionButton}
              onPress={() => {
                setIsAiActionModalOpen(false);
                runAiRewrite("SUGGEST_REPLY").catch(() => {});
              }}
            >
              <Text style={styles.suggestionButtonText}>
                Gợi ý 3 câu trả lời
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.suggestionButton}
              onPress={() => {
                setIsAiActionModalOpen(false);
                runAiRewrite("REWRITE_STYLE").catch(() => {});
              }}
            >
              <Text style={styles.suggestionButtonText}>
                Viết lịch sự, ngắn gọn
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.suggestionCancelBtn}
              onPress={() => setIsAiActionModalOpen(false)}
            >
              <Text style={styles.suggestionCancelText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isSuggestionModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsSuggestionModalOpen(false);
          setAiSuggestions([]);
        }}
      >
        <View style={styles.suggestionOverlay}>
          <View style={styles.suggestionCard}>
            <Text style={styles.suggestionTitle}>Gợi ý trả lời từ AI</Text>
            <Text style={styles.suggestionDesc}>
              Chọn 1 gợi ý để thay thế nội dung đang soạn.
            </Text>

            <ScrollView
              style={styles.suggestionList}
              contentContainerStyle={{ gap: 10 }}
              showsVerticalScrollIndicator={false}
            >
              {aiSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={`${index}-${suggestion}`}
                  style={styles.suggestionButton}
                  onPress={() => handleSuggestionSelect(suggestion)}
                >
                  <Text style={styles.suggestionButtonText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.suggestionCancelBtn}
              onPress={() => {
                setIsSuggestionModalOpen(false);
                setAiSuggestions([]);
              }}
            >
              <Text style={styles.suggestionCancelText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default ChatInput;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ede9fe",
  },
  chatStatusRow: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 2,
  },
  composingText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: "italic",
  },
  deliveryText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    backgroundColor: COLORS.backgroundMuted,
    marginHorizontal: 8,
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 6,
  },
  replyContent: {
    flex: 1,
  },
  replyTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  replyCloseBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 8,
    marginTop: 8,
    paddingVertical: 10,
    backgroundColor: COLORS.backgroundMuted,
    borderRadius: 10,
  },
  disabledText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  previewRow: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  previewCard: {
    width: 110,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundMuted,
    padding: 6,
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: 62,
    borderRadius: 6,
    backgroundColor: "#fff",
    marginBottom: 4,
  },
  previewFileIcon: {
    width: "100%",
    height: 62,
    borderRadius: 6,
    backgroundColor: "#fff",
    marginBottom: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  previewName: {
    fontSize: 11,
    color: COLORS.text,
  },
  previewSize: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    zIndex: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 56,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDisabled: {
    opacity: 0.4,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: COLORS.backgroundMuted,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 9 : 4,
    marginHorizontal: 4,
    maxHeight: 120,
    justifyContent: "center",
  },
  input: {
    fontSize: 15,
    color: COLORS.text,
    maxHeight: 100,
    minHeight: 22,
    padding: 0,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  suggestionOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  suggestionCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "75%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  suggestionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
  },
  suggestionDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  suggestionList: {
    maxHeight: 320,
  },
  suggestionButton: {
    borderWidth: 1,
    borderColor: "#dedee8",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fafafe",
  },
  suggestionButtonText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  suggestionCancelBtn: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#efeff6",
  },
  suggestionCancelText: {
    color: COLORS.text,
    fontWeight: "600",
  },
});
