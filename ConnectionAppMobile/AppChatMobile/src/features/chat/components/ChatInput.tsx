import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";
import EmojiPicker from "rn-emoji-keyboard";

interface ChatInputProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled = false }) => {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending || disabled) return;
    setIsSending(true);
    try {
      await onSend(trimmed);
      setText("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const canSend = text.trim().length > 0 && !isSending && !disabled;

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
      <View style={styles.container}>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="image-outline" size={24} color={COLORS.textMuted} />
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
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ede9fe",
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
