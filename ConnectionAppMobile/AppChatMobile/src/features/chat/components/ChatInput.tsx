import React, { useState } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";
import EmojiPicker from "rn-emoji-keyboard";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import type { PendingAttachment } from "../context/ChatContext";

interface ChatInputProps {
  onSend: (message: string, files: PendingAttachment[]) => Promise<void>;
  disabled?: boolean;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

type LocalAttachment = PendingAttachment & {
  id: string;
  isImage: boolean;
};

const formatFileSize = (size?: number): string => {
  if (!size || Number.isNaN(size)) return "Unknown";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled = false }) => {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<LocalAttachment[]>([]);

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
        if (item.size && item.size > MAX_FILE_SIZE_BYTES) {
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
          `${rejectedBySize} tệp lớn hơn 2MB và đã bị bỏ qua.`,
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
    setIsSending(true);
    try {
      await onSend(
        trimmed,
        selectedFiles.map((file) => ({
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
        })),
      );
      setText("");
      setSelectedFiles([]);
    } catch (error) {
      console.error("Error sending message:", error);
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
    setText((prev) => `${prev}${emoji}`);
  };

  return (
    <>
      <View style={styles.wrapper}>
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
          <TouchableOpacity style={styles.iconBtn} onPress={pickImages}>
            <Ionicons name="image-outline" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={pickDocuments}>
            <Ionicons
              name="attach-outline"
              size={24}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleOpenEmojiPicker}
          >
            <Ionicons name="happy-outline" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>

          <View style={styles.inputWrap}>
            <TextInput
              value={text}
              onChangeText={setText}
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
});
