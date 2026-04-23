import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";
import { chatService } from "../services/chat.service";

interface ReminderCreatorModalProps {
  visible: boolean;
  onClose: () => void;
  conversationId: number;
  initialData?: {
    messageId: string;
    title: string;
    content: string;
    reminderTime: string; // "YYYY-MM-DDTHH:mm:ss"
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

const ReminderCreatorModal: React.FC<ReminderCreatorModalProps> = ({
  visible,
  onClose,
  conversationId,
  initialData,
}) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState(""); // YYYY-MM-DD
  const [time, setTime] = useState(""); // HH:mm
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setTitle(initialData.title);
        setContent(initialData.content);
        const parts = initialData.reminderTime.split("T");
        setDate(parts[0] ?? "");
        setTime(parts[1]?.substring(0, 5) ?? "");
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setDate(
          `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`
        );
        setTime("09:00");
        setTitle("");
        setContent("");
      }
    }
  }, [visible, initialData]);

  const handleSave = async () => {
    if (!title.trim() || !date || !time) {
      Alert.alert("Thiếu thông tin", "Vui lòng điền tiêu đề, ngày và giờ nhắc hẹn.");
      return;
    }

    setIsLoading(true);
    try {
      const reminderTime = `${date}T${time}:00`;
      await chatService.createReminder({
        title: title.trim(),
        content: content.trim(),
        reminderTime,
        conversationId,
      });
      onClose();
    } catch (e) {
      Alert.alert("Lỗi", "Không thể tạo nhắc hẹn. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="alarm-outline" size={24} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>
                {initialData ? "Chỉnh sửa nhắc hẹn" : "Tạo nhắc hẹn mới"}
              </Text>
              <Text style={styles.headerSubtitle}>
                {initialData
                  ? "Cập nhật lại thông tin nhắc hẹn"
                  : "Đặt lịch để không bỏ lỡ sự kiện quan trọng"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Title */}
            <Text style={styles.label}>Tiêu đề nhắc hẹn *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ví dụ: Họp nhóm dự án, Sinh nhật..."
              placeholderTextColor="#9ca3af"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />

            {/* Date & Time row */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Ngày nhắc *</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="calendar-outline" size={16} color={COLORS.primary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.inputFlex, { paddingLeft: 36 }]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9ca3af"
                    value={date}
                    onChangeText={setDate}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Giờ nhắc *</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="time-outline" size={16} color="#f59e0b" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.inputFlex, { paddingLeft: 36 }]}
                    placeholder="HH:MM"
                    placeholderTextColor="#9ca3af"
                    value={time}
                    onChangeText={setTime}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
              </View>
            </View>

            {/* Content */}
            <Text style={styles.label}>Ghi chú (tùy chọn)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Thêm mô tả chi tiết cho công việc này..."
              placeholderTextColor="#9ca3af"
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Để sau</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (!title.trim() || !date || !time) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isLoading || !title.trim() || !date || !time}
            >
              <Ionicons name="alarm-outline" size={18} color="#fff" />
              <Text style={styles.saveText}>
                {isLoading ? "Đang lưu..." : initialData ? "Lưu thay đổi" : "Xác nhận tạo"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    maxHeight: "90%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#d1d5db",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#fafafa",
    marginBottom: 16,
  },
  inputFlex: {
    marginBottom: 0,
  },
  inputWithIcon: {
    position: "relative",
    marginBottom: 16,
  },
  inputIcon: {
    position: "absolute",
    left: 12,
    top: 13,
    zIndex: 1,
  },
  textarea: {
    minHeight: 90,
    paddingTop: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6b7280",
  },
  saveBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    gap: 8,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});

export default ReminderCreatorModal;
