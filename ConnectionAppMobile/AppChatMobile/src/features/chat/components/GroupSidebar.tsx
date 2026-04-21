import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  Switch,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../../theme";
import { LeaveGroupModal } from "./LeaveGroupModal";
import { MemberListModal } from "./MemberListModal";
import { SuccessorPromotionModal } from "./SuccessorPromotionModal";
import AddMemberModal from "./AddMemberModal";
import type { Message, Attachment, AttachmentType, Conversation, Participant } from "../types";

interface GroupParticipant {
  userId: number;
  displayName: string;
  avatarUrl?: string | null;
  role?: string;
}

interface GroupSidebarProps {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  groupAvatar?: string | null;
  participants: GroupParticipant[];
  messages: Message[];
  conversation: Conversation | null;
  currentUserId: number;
  currentUserRole: string | null;
  onLeaveGroup: (
    conversationId: number,
    userId: number,
    transferToUserId?: number,
  ) => Promise<void>;
  onRoleUpdate?: (memberId: number, newRole: string) => Promise<void>;
  onRemoveMember: (memberId: number) => Promise<void>;
}

interface MediaItem {
  id: string;
  fileUrl: string;
  type: AttachmentType;
  originalFileName?: string | null;
  createdAt: string;
}

interface FileItem {
  id: string;
  fileUrl: string;
  originalFileName?: string | null;
  type: AttachmentType;
  createdAt: string;
}

const FALLBACK = "https://i.pravatar.cc/150?img=10";

const buildMessageAttachmentId = (
  messageId: string,
  attachment: Attachment,
  index: number,
): string => `${messageId}-${index}-${attachment.fileUrl}`;

const GroupSidebar: React.FC<GroupSidebarProps> = ({
  visible,
  onClose,
  groupName,
  groupAvatar,
  participants,
  messages,
  conversation,
  currentUserId,
  currentUserRole,
  onLeaveGroup,
  onRoleUpdate,
  onRemoveMember,
}) => {
  const insets = useSafeAreaInsets();
  const [isPinned, setIsPinned] = useState(true);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showMemberListModal, setShowMemberListModal] = useState(false);
  const [showSuccessorDialog, setShowSuccessorDialog] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  const mediaItems = useMemo<MediaItem[]>(() => {
    const output: MediaItem[] = [];
    messages.forEach((msg) => {
      msg.attachments.forEach((att, index) => {
        if (att.type === "IMAGE" || att.type === "VIDEO") {
          output.push({
            id: buildMessageAttachmentId(msg.id, att, index),
            fileUrl: att.fileUrl,
            type: att.type,
            originalFileName: att.originalFileName,
            createdAt: msg.createdAt,
          });
        }
      });
    });
    return output.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [messages]);

  const fileItems = useMemo<FileItem[]>(() => {
    const output: FileItem[] = [];
    messages.forEach((msg) => {
      msg.attachments.forEach((att, index) => {
        if (att.type !== "IMAGE" && att.type !== "VIDEO") {
          output.push({
            id: buildMessageAttachmentId(msg.id, att, index),
            fileUrl: att.fileUrl,
            originalFileName: att.originalFileName,
            type: att.type,
            createdAt: msg.createdAt,
          });
        }
      });
    });
    return output.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [messages]);

  const openUrl = async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      return;
    }
    await Linking.openURL(url);
  };

  // Find CO_OWNER if exists
  const coOwner = useMemo(() => {
    if (!conversation) return null;
    return conversation.participants.find((p) => p.role === "CO_OWNER") || null;
  }, [conversation]);

  const handleLeaveGroupConfirmed = async (transferToUserId?: number) => {
    if (!conversation) return;
    try {
      // Call onLeaveGroup with transfer recipient if needed
      await onLeaveGroup(
        conversation.id,
        currentUserId,
        transferToUserId,
      );
      setShowLeaveModal(false);
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể rời khỏi nhóm";
      Alert.alert("Lỗi", message);
    }
  };

  const renderGroupAvatar = () => {
    if (groupAvatar) {
      return <Image source={{ uri: groupAvatar }} style={styles.groupAvatar} />;
    }

    const first = participants[0]?.avatarUrl || FALLBACK;
    const second = participants[1]?.avatarUrl || FALLBACK;

    return (
      <View style={styles.groupAvatarWrap}>
        <Image
          source={{ uri: first }}
          style={[styles.combinedAvatar, styles.combinedFirst]}
        />
        <Image
          source={{ uri: second }}
          style={[styles.combinedAvatar, styles.combinedSecond]}
        />
      </View>
    );
  };

  const sectionRow = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    subtitle?: string,
  ) => (
    <TouchableOpacity style={styles.rowItem} activeOpacity={0.75}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={22} color="#8b939f" />
        <View style={styles.rowTextWrap}>
          <Text style={styles.rowLabel}>{label}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#a3a8b1" />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.screen}>
        <LinearGradient
          colors={COLORS.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.topHeader, { paddingTop: insets.top + 8 }]}
        >
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Tùy chọn</Text>
        </LinearGradient>

        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileBlock}>
            <View style={styles.avatarWrap}>
              {renderGroupAvatar()}
              <TouchableOpacity style={styles.cameraBtn}>
                <Ionicons name="camera-outline" size={16} color="#222" />
              </TouchableOpacity>
            </View>

            <View style={styles.groupNameRow}>
              <Text style={styles.groupName}>{groupName}</Text>
              <TouchableOpacity style={styles.editBtn}>
                <Ionicons name="pencil-outline" size={16} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.quickActionRow}>
              {[
                { icon: "search-outline" as const, label: "Tìm\ntin nhắn", action: "search" },
                {
                  icon: "person-add-outline" as const,
                  label: "Thêm\nthành viên",
                  action: "add-member",
                },
                { icon: "color-wand-outline" as const, label: "Đổi\nhình nền", action: "wallpaper" },
                {
                  icon: "notifications-outline" as const,
                  label: "Tắt\nthông báo",
                  action: "mute",
                },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.quickActionItem}
                  onPress={() => {
                    if (item.action === "add-member") {
                      setShowAddMemberModal(true);
                    }
                  }}
                >
                  <View style={styles.quickActionIconWrap}>
                    <Ionicons name={item.icon} size={24} color="#2d333a" />
                  </View>
                  <Text style={styles.quickActionLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.sectionGap} />

          {sectionRow("information-circle-outline", "Thêm mô tả nhóm")}

          <View style={styles.sectionGap} />

          <TouchableOpacity style={styles.rowItem} activeOpacity={0.75}>
            <View style={styles.rowLeft}>
              <Ionicons name="images-outline" size={22} color="#8b939f" />
              <Text style={styles.rowLabel}>Ảnh, file, link</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#a3a8b1" />
          </TouchableOpacity>

          {mediaItems.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mediaPreviewStrip}
            >
              {mediaItems.slice(0, 8).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.previewItem}
                  onPress={() => void openUrl(item.fileUrl)}
                >
                  <Image
                    source={{ uri: item.fileUrl }}
                    style={styles.previewImage}
                  />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.previewItem, styles.previewMore]}
              >
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            </ScrollView>
          )}

          <View style={styles.sectionGap} />

          {sectionRow("calendar-outline", "Lịch nhóm")}
          {sectionRow("attach-outline", "Tin nhắn đã ghim")}
          {sectionRow("stats-chart-outline", "Bình chọn")}

          <View style={styles.sectionGap} />

          <TouchableOpacity 
            style={styles.rowItem} 
            activeOpacity={0.75}
            onPress={() => setShowMemberListModal(true)}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="people-outline" size={22} color="#8b939f" />
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowLabel}>Xem thành viên ({participants.length})</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#a3a8b1" />
          </TouchableOpacity>
          {sectionRow(
            "link-outline",
            "Link nhóm",
            "https://zalo.me/g/nhomchat",
          )}

          <View style={styles.sectionGap} />

          <View style={styles.pinRow}>
            <View style={styles.rowLeft}>
              <Ionicons name="attach-outline" size={22} color="#8b939f" />
              <Text style={styles.rowLabel}>Ghim trò chuyện</Text>
            </View>
            <Switch
              value={isPinned}
              onValueChange={setIsPinned}
              trackColor={{ false: "#d2d6dc", true: COLORS.primary }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.sectionGap} />

          {/* Leave Group Button */}
          <TouchableOpacity
            style={styles.leaveGroupButton}
            onPress={() => {
              // If owner with multiple members and there's a CO_OWNER, show successor promotion
              if (
                currentUserRole === "OWNER" &&
                participants.length > 1 &&
                coOwner
              ) {
                setShowSuccessorDialog(true);
              } else {
                // Otherwise, show leave group modal
                setShowLeaveModal(true);
              }
            }}
          >
            <Ionicons name="exit-outline" size={22} color={COLORS.destructive} />
            <Text style={styles.leaveGroupText}>
              {currentUserRole === "OWNER" && participants.length === 1
                ? "Xóa nhóm"
                : currentUserRole === "OWNER"
                ? "Chuyển quyền & Rời"
                : "Rời khỏi nhóm"}
            </Text>
          </TouchableOpacity>

          <View style={styles.sectionGap} />
        </ScrollView>

        {/* Successor Promotion Modal */}
        <SuccessorPromotionModal
          visible={showSuccessorDialog}
          onClose={() => setShowSuccessorDialog(false)}
          conversation={conversation}
          currentUserId={currentUserId}
          coOwner={coOwner}
          onPromotionComplete={() => {
            setShowSuccessorDialog(false);
            // After succession is handled, leave the group
            handleLeaveGroupConfirmed();
          }}
          onRoleUpdate={onRoleUpdate || (async () => {})}
        />

        {/* Leave Group Modal */}
        <LeaveGroupModal
          visible={showLeaveModal}
          onClose={() => setShowLeaveModal(false)}
          conversation={conversation}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onLeaveConfirmed={handleLeaveGroupConfirmed}
        />

        {/* Member List Modal */}
        <MemberListModal
          visible={showMemberListModal}
          onClose={() => setShowMemberListModal(false)}
          members={conversation?.participants || []}
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          conversationId={conversation?.id || 0}
          onRoleUpdate={onRoleUpdate || (async () => {})}
          onRemoveMember={onRemoveMember}
        />

        {/* Add Member Modal */}
        <AddMemberModal
          visible={showAddMemberModal}
          onClose={() => setShowAddMemberModal(false)}
          conversation={conversation}
        />
      </View>
    </Modal>
  );
};


export default GroupSidebar;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundMuted,
  },
  topHeader: {
    minHeight: 70,
    paddingBottom: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  topTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 14,
  },
  profileBlock: {
    backgroundColor: "#fff",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
  },
  avatarWrap: {
    width: 118,
    height: 118,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  groupAvatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#e3e6ec",
  },
  groupAvatarWrap: {
    width: 104,
    height: 104,
    position: "relative",
  },
  combinedAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    borderColor: "#fff",
    position: "absolute",
    backgroundColor: "#e5e7eb",
  },
  combinedFirst: {
    top: 4,
    right: 6,
  },
  combinedSecond: {
    left: 4,
    bottom: 2,
  },
  cameraBtn: {
    position: "absolute",
    right: 2,
    bottom: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  groupNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  groupName: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  editBtn: {
    marginLeft: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
  },
  quickActionItem: {
    width: "24%",
    alignItems: "center",
  },
  quickActionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#f4f1ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickActionLabel: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.text,
  },
  sectionGap: {
    height: 8,
    backgroundColor: "#eef1f6",
  },
  rowItem: {
    paddingHorizontal: 14,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rowTextWrap: {
    marginLeft: 14,
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.text,
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  mediaPreviewStrip: {
    backgroundColor: "#fff",
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  previewItem: {
    width: 78,
    height: 78,
    borderRadius: 6,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewMore: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5fb",
  },
  pinRow: {
    paddingHorizontal: 14,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  filesPanel: {
    marginTop: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filesPanelTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2a2f36",
    marginBottom: 6,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 36,
  },
  fileText: {
    marginLeft: 8,
    flex: 1,
    fontSize: 13,
    color: "#5f6b7a",
  },
  leaveGroupButton: {
    paddingHorizontal: 14,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  leaveGroupText: {
    marginLeft: 14,
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.destructive,
  },
});
