import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../theme";
import type { Poll, PollOption } from "../types";

interface Props {
  poll: Poll;
  onVote: () => void;
  isMe: boolean;
}

const PollMessage: React.FC<Props> = ({ poll, onVote, isMe }) => {
  const totalVotes = poll.options.reduce(
    (sum, opt) => sum + (opt.voterIds?.length || 0),
    0,
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="stats-chart" size={18} color={COLORS.primary} />
        <Text style={styles.question}>
          {poll.question}
        </Text>
      </View>

      <View style={styles.optionsContainer}>
        {poll.options.map((option) => {
          const voteCount = option.voterIds?.length || 0;
          const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;

          return (
            <View key={option.id} style={styles.optionRow}>
              <View style={styles.optionInfo}>
                <Text style={styles.optionText}>
                  {option.text}
                </Text>
                <Text style={styles.voteCount}>
                  {voteCount}
                </Text>
              </View>
              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${percentage}%`,
                      backgroundColor: COLORS.primary + "40",
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      <TouchableOpacity 
        style={[styles.voteButton, styles.voteButtonOther]} 
        onPress={onVote}
      >
        <Text style={[styles.voteButtonText, styles.voteButtonTextOther]}>
          {poll.closed ? "Cuộc bình chọn đã kết thúc" : "Bình chọn"}
        </Text>
      </TouchableOpacity>
      
      {!poll.closed && (
        <Text style={styles.footerText}>
          {poll.multiChoice ? "Chọn nhiều phương án" : "Chọn một phương án"}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    minWidth: 220,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  question: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
    flexShrink: 1,
  },
  optionsContainer: {
    marginBottom: 12,
  },
  optionRow: {
    marginBottom: 8,
  },
  optionInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  optionText: {
    fontSize: 14,
    flex: 1,
  },
  voteCount: {
    fontSize: 12,
    marginLeft: 8,
  },
  progressContainer: {
    height: 6,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
  voteButton: {
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  voteButtonMe: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  voteButtonOther: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  voteButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  voteButtonTextMe: {
    color: "#fff",
  },
  voteButtonTextOther: {
    color: COLORS.primary,
  },
  footerText: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
  textMe: {
    color: "#fff",
  },
  textOther: {
    color: COLORS.text,
  },
  textMeDim: {
    color: "rgba(255,255,255,0.7)",
  },
  textOtherDim: {
    color: "#666",
  },
});

export default PollMessage;
