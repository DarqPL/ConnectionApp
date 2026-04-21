import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreate: (pollData: {
    question: string;
    options: Array<{ text: string }>;
    multiChoice: boolean;
    isAnonymous: boolean;
  }) => Promise<void>;
}

const PollCreatorModal: React.FC<Props> = ({ visible, onClose, onCreate }) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiChoice, setMultiChoice] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = [...options];
      newOptions.splice(index, 1);
      setOptions(newOptions);
    }
  };

  const handleOptionChange = (text: string, index: number) => {
    const newOptions = [...options];
    newOptions[index] = text;
    setOptions(newOptions);
  };

  const handleCreate = async () => {
    if (!question.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập câu hỏi");
      return;
    }

    const validOptions = options.filter((opt) => opt.trim().length > 0);
    if (validOptions.length < 2) {
      Alert.alert("Lỗi", "Vui lòng nhập ít nhất 2 phương án");
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        question: question.trim(),
        options: validOptions.map(opt => ({ text: opt })),
        multiChoice,
        isAnonymous,
      });
      setQuestion("");
      setOptions(["", ""]);
      setMultiChoice(false);
      setIsAnonymous(false);
      onClose();
    } catch (error) {
      Alert.alert("Lỗi", "Không thể tạo cuộc bình chọn");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Tạo bình chọn mới</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Câu hỏi</Text>
            <TextInput
              style={styles.questionInput}
              placeholder="Nhập câu hỏi bình chọn..."
              value={question}
              onChangeText={setQuestion}
              multiline
            />

            <Text style={styles.label}>Các phương án</Text>
            {options.map((option, index) => (
              <View key={index} style={styles.optionInputRow}>
                <TextInput
                  style={styles.optionInput}
                  placeholder={`Phương án ${index + 1}`}
                  value={option}
                  onChangeText={(text) => handleOptionChange(text, index)}
                />
                {options.length > 2 && (
                  <TouchableOpacity
                    onPress={() => handleRemoveOption(index)}
                    style={styles.removeOptionBtn}
                  >
                    <Ionicons name="remove-circle" size={22} color="#e74c3c" />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {options.length < 10 && (
              <TouchableOpacity
                style={styles.addOptionBtn}
                onPress={handleAddOption}
              >
                <Ionicons name="add-circle" size={22} color={COLORS.primary} />
                <Text style={styles.addOptionText}>Thêm phương án</Text>
              </TouchableOpacity>
            )}

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Chọn nhiều phương án</Text>
              <Switch
                value={multiChoice}
                onValueChange={setMultiChoice}
                trackColor={{ false: "#ddd", true: COLORS.primary + "80" }}
                thumbColor={multiChoice ? COLORS.primary : "#f4f3f4"}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Bình chọn ẩn danh</Text>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: "#ddd", true: COLORS.primary + "80" }}
                thumbColor={isAnonymous ? COLORS.primary : "#f4f3f4"}
              />
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.createBtn, isSubmitting && styles.disabledBtn]}
            onPress={handleCreate}
            disabled={isSubmitting}
          >
            <Text style={styles.createBtnText}>Tạo cuộc bình chọn</Text>
          </TouchableOpacity>
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
  content: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
  },
  closeBtn: {
    padding: 5,
  },
  scrollBody: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    marginTop: 10,
  },
  questionInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: "top",
  },
  optionInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  optionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  removeOptionBtn: {
    padding: 8,
  },
  addOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginTop: 5,
  },
  addOptionText: {
    marginLeft: 8,
    color: COLORS.primary,
    fontWeight: "600",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  settingLabel: {
    fontSize: 15,
    color: COLORS.text,
  },
  createBtn: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  createBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  disabledBtn: {
    backgroundColor: "#ccc",
  },
});

export default PollCreatorModal;
