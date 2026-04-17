import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChat } from "../context/ChatContext";
import { useAuth } from "../../auth/context/AuthContext";
import { chatService } from "../services/chat.service";
import type { Message, Conversation } from "../types";
import { COLORS } from "../../../theme";

interface ForwardMessageModalProps {
  message: Message | null;
  onClose: () => void;
}

const FALLBACK_AVATAR = "https://i.pravatar.cc/150?img=10";

const getConversationName = (
  convo: Conversation,
  currentUserId: number,
): string => {
  if (convo.type === "GROUP") return convo.name ?? "Nhóm";
  const other = convo.participants.find((p) => p.userId !== currentUserId);
  return other?.displayName ?? "Người dùng";
};

const getConversationAvatar = (
  convo: Conversation,
  currentUserId: number,
): string | null => {
  if (convo.type === "GROUP") return convo.avatarUrl ?? null;
  const other = convo.participants.find((p) => p.userId !== currentUserId);
  return other?.avatarUrl ?? null;
};

// Mini group avatar (overlapping circles)
const GroupAvatar: React.FC<{ participants: Conversation["participants"] }> = ({
  participants,
}) => {
  const shown = participants.slice(0, 2);
  return (
    <View style={styles.groupAvatarWrap}>
      {shown.map((p, i) => (
        <Image
          key={p.userId}
          source={{ uri: p.avatarUrl || FALLBACK_AVATAR }}
          style={[
            styles.groupAvatarImg,
            i === 0 ? styles.groupAvatarTop : styles.groupAvatarBottom,
          ]}
        />
      ))}
    </View>
  );
};

const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({
  message,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  // FIX 1: Also get fetchConversations to load data when modal opens
  const { conversations, fetchConversations } = useChat();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [forwardingIds, setForwardingIds] = useState<Set<number>>(new Set());
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const [isFetchingConvos, setIsFetchingConvos] = useState(false);

  const slideAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Animate in + fetch conversations when modal opens
  useEffect(() => {
    if (message) {
      setSentIds(new Set());
      setSearch("");
      setForwardingIds(new Set());

      // Fetch conversations to ensure list is populated
      console.log("[ForwardModal] Fetching conversations, current count:", conversations.length);
      setIsFetchingConvos(true);
      fetchConversations()
        .then(() => console.log("[ForwardModal] Fetch done, count:", conversations.length))
        .catch((e) => console.error("[ForwardModal] Fetch error:", e))
        .finally(() => setIsFetchingConvos(false));

      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4,
          speed: 14,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 400,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [message?.id]); // depend on message id so each new message triggers a reset

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [onClose]);

  const handleForward = useCallback(
    async (conversationId: number) => {
      if (!message) return;
      if (sentIds.has(conversationId) || forwardingIds.has(conversationId)) return;

      setForwardingIds((prev) => new Set(prev).add(conversationId));
      try {
        // FIX 2: Call chatService directly so attachments are forwarded as-is
        // (reusing existing fileUrl) without re-uploading to storage.
        await chatService.sendMessage(
          conversationId,
          message.content || "",
          null, // parentId = null (forward is an independent message)
          message.attachments ?? [],
        );
        setSentIds((prev) => new Set(prev).add(conversationId));
      } catch {
        // Silent fail — button reverts to "Gửi" so user can retry
      } finally {
        setForwardingIds((prev) => {
          const next = new Set(prev);
          next.delete(conversationId);
          return next;
        });
      }
    },
    [message, sentIds, forwardingIds],
  );

  const filtered = conversations.filter((c) => {
    if (!user) return true;
    const name = getConversationName(c, user.id);
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const renderItem = useCallback(
    ({ item: c }: { item: Conversation }) => {
      if (!user) return null;
      const isGroup = c.type === "GROUP";
      const name = getConversationName(c, user.id);
      const avatarUrl = getConversationAvatar(c, user.id);
      const isSent = sentIds.has(c.id);
      const isForwarding = forwardingIds.has(c.id);

      return (
        <View style={styles.convoItem}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {isGroup && !avatarUrl ? (
              <GroupAvatar participants={c.participants} />
            ) : (
              <Image
                source={{ uri: avatarUrl || FALLBACK_AVATAR }}
                style={styles.avatar}
              />
            )}
          </View>

          {/* Name */}
          <Text style={styles.convoName} numberOfLines={1}>
            {name}
          </Text>

          {/* Send button */}
          <TouchableOpacity
            style={[
              styles.sendBtn,
              isSent && styles.sendBtnSent,
              (isForwarding || isSent) && styles.sendBtnDisabled,
            ]}
            onPress={() => handleForward(c.id)}
            disabled={isSent || isForwarding}
            activeOpacity={0.75}
          >
            {isForwarding ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.sendBtnText, isSent && styles.sendBtnTextSent]}>
                {isSent ? "Đã gửi" : "Gửi"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [user, sentIds, forwardingIds, handleForward],
  );

  return (
    <Modal
      visible={!!message}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Backdrop */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={handleClose}
            activeOpacity={1}
          />
        </Animated.View>

        {/* Bottom sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + 8,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Chuyển tiếp tin nhắn</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Message preview */}
          {message && (message.content || (message.attachments?.length ?? 0) > 0) && (
            <View style={styles.previewBox}>
              <Ionicons
                name="arrow-redo-outline"
                size={14}
                color={COLORS.primary}
                style={{ marginTop: 1 }}
              />
              <Text style={styles.previewText} numberOfLines={2}>
                {message.content ||
                  (message.attachments?.length === 1
                    ? "1 tệp đính kèm"
                    : `${message.attachments?.length} tệp đính kèm`)}
              </Text>
            </View>
          )}

          {/* Search */}
          <View style={styles.searchWrap}>
            <Ionicons
              name="search-outline"
              size={18}
              color={COLORS.textMuted}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm cuộc trò chuyện..."
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          {/* Conversation list */}
          {isFetchingConvos && conversations.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Đang tải danh sách...</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              style={styles.list}
              contentContainerStyle={
                filtered.length === 0 ? styles.emptyContainer : styles.listContent
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {isFetchingConvos
                    ? "Đang tải..."
                    : "Không tìm thấy cuộc trò chuyện nào"}
                </Text>
              }
            />
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ForwardMessageModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    // FIX: Use explicit height (not maxHeight) so that flex:1 inside FlatList works.
    // With only maxHeight, the parent shrinks to content → FlatList collapses to 0.
    height: "72%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e0e0e0",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ebebeb",
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
  },
  closeBtn: {
    padding: 2,
  },
  previewBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f4f4fa",
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  previewText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 6,
    backgroundColor: "#f4f4fa",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    paddingVertical: 0,
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
  convoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    gap: 12,
  },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: "visible",
    flexShrink: 0,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.backgroundMuted,
  },
  groupAvatarWrap: {
    width: 46,
    height: 46,
    position: "relative",
  },
  groupAvatarImg: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#fff",
    position: "absolute",
    backgroundColor: COLORS.backgroundMuted,
  },
  groupAvatarTop: {
    top: 0,
    right: 0,
    zIndex: 1,
  },
  groupAvatarBottom: {
    bottom: 0,
    left: 0,
  },
  convoName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  sendBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnSent: {
    backgroundColor: "#e8e8ef",
  },
  sendBtnDisabled: {
    opacity: 0.85,
  },
  sendBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  sendBtnTextSent: {
    color: COLORS.textMuted,
  },
});
