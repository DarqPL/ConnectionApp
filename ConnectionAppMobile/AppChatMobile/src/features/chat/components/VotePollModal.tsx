import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";
import type { Poll, PollOption } from "../types";

interface Props {
  visible: boolean;
  onClose: () => void;
  poll: Poll;
  onConfirm: (selectedOptionIds: string[]) => Promise<void>;
  currentUserId: number;
  isCreator: boolean;
  onClosePoll?: () => Promise<void>;
}

const VotePollModal: React.FC<Props> = ({
  visible,
  onClose,
  poll,
  onConfirm,
  currentUserId,
  isCreator,
  onClosePoll,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      console.log("[VotePollModal] isCreator:", isCreator, "hasOnClosePoll:", !!onClosePoll);
      if (!poll) return;
      // Find options user already voted for
      const userVotes = poll.options
        .filter((opt) => opt.voterIds?.includes(currentUserId))
        .map((opt) => opt.id);
      setSelectedIds(userVotes);
    }
  }, [visible, poll, currentUserId]);

  const handleToggleOption = (id: string) => {
    if (poll.closed) return;
    
    if (poll.multiChoice) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
      );
    } else {
      setSelectedIds([id]);
    }
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) return;
    setIsSubmitting(true);
    try {
      await onConfirm(selectedIds);
      onClose();
    } catch (error) {
      console.error("Vote error", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Bình chọn</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.question}>{poll.question}</Text>
          <Text style={styles.subTitle}>
            {poll.multiChoice
              ? "Chọn nhiều phương án"
              : "Chọn một phương án duy nhất"}
          </Text>

          <ScrollView style={styles.optionsList}>
            {poll.options.map((option) => {
              const isSelected = selectedIds.includes(option.id);
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionItem,
                    isSelected && styles.optionItemSelected,
                  ]}
                  onPress={() => handleToggleOption(option.id)}
                  disabled={poll.closed}
                >
                  <View style={styles.optionLeft}>
                    <Ionicons
                      name={
                        poll.multiChoice
                          ? isSelected
                            ? "checkbox"
                            : "square-outline"
                          : isSelected
                            ? "radio-button-on"
                            : "radio-button-off"
                      }
                      size={22}
                      color={isSelected ? COLORS.primary : "#ccc"}
                    />
                    <Text style={styles.optionText}>{option.text}</Text>
                  </View>
                  <Text style={styles.votersCount}>
                    {option.voterIds?.length || 0}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            {isCreator && !poll.closed && onClosePoll && (
              <TouchableOpacity
                style={styles.closePollBtn}
                onPress={() => {
                  console.log("[VotePollModal] Close Poll button pressed");
                  onClosePoll();
                }}
                disabled={isSubmitting}
              >
                <Text style={styles.closePollText}>Kết thúc bình chọn</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (selectedIds.length === 0 || isSubmitting || poll.closed) && styles.disabledBtn,
              ]}
              onPress={handleConfirm}
              disabled={selectedIds.length === 0 || isSubmitting || poll.closed}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmBtnText}>Xác nhận</Text>
              )}
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
  content: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
  },
  closeBtn: {
    padding: 5,
  },
  question: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 5,
  },
  subTitle: {
    fontSize: 13,
    color: "#666",
    marginBottom: 20,
  },
  optionsList: {
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f9f9f9",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionItemSelected: {
    backgroundColor: COLORS.primary + "10",
    borderColor: COLORS.primary,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  optionText: {
    fontSize: 15,
    marginLeft: 10,
    color: COLORS.text,
  },
  votersCount: {
    fontSize: 12,
    color: "#888",
  },
  footer: {
    flexDirection: "row",
    gap: 10,
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  closePollBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e74c3c",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  closePollText: {
    color: "#e74c3c",
    fontSize: 14,
    fontWeight: "600",
  },
  disabledBtn: {
    backgroundColor: "#ccc",
    borderColor: "transparent",
  },
});

export default VotePollModal;
