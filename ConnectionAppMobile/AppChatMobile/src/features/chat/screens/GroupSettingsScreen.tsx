import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../../../theme";
import { chatService } from "../services/chat.service";
import { authService } from "../../auth/services/auth.service";
import type { Conversation } from "../types";
import { buildMobileGroupInviteUrl } from "../utils/groupInvite";
import * as Clipboard from "expo-clipboard";
import { CoOwnerManagerModal } from "../components/CoOwnerManagerModal";
import { DisbandGroupModal } from "../components/DisbandGroupModal";
import { BlockedMembersModal } from "../components/BlockedMembersModal";

interface GroupSettingsScreenProps {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  currentUserId: number;
  currentUserRole: string | null;
  onSettingsUpdated: () => void;
}

const ToggleRow = ({
  label,
  checked,
  onValueChange,
  disabled,
  helpText,
}: {
  label: string;
  checked: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  helpText?: string;
}) => (
  <View style={styles.toggleRow}>
    <View style={styles.toggleLabelWrap}>
      <Text style={[styles.toggleLabel, disabled && styles.toggleLabelDisabled]}>
        {label}
      </Text>
      {helpText ? <Text style={styles.toggleHelp}>{helpText}</Text> : null}
    </View>
    <Switch
      value={checked}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: "#d2d6dc", true: COLORS.primary }}
      thumbColor="#fff"
    />
  </View>
);

const SectionTitle = ({ children }: { children: string }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

export function GroupSettingsScreen({
  visible,
  onClose,
  conversation,
  currentUserId,
  currentUserRole,
  onSettingsUpdated,
}: GroupSettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [showCoOwnerModal, setShowCoOwnerModal] = useState(false);
  const [showDisbandModal, setShowDisbandModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);

  const isOwner = currentUserRole === "OWNER";

  const settings = useMemo(
    () => ({
      allowMemberEditInfo: conversation?.allowMemberEditInfo ?? true,
      allowMemberCreateNotes: conversation?.allowMemberCreateNotes ?? true,
      allowMemberCreatePolls: conversation?.allowMemberCreatePolls ?? true,
      allowMemberSendMessage: conversation?.allowMemberSendMessage ?? true,
      approvalMode: conversation?.approvalMode ?? false,
      markAdminMessages: conversation?.markAdminMessages ?? false,
      allowNewMembersReadHistory: conversation?.allowNewMembersReadHistory ?? true,
      allowLinkJoin: conversation?.allowLinkJoin ?? true,
    }),
    [conversation]
  );

  const groupInviteUrl = useMemo(
    () =>
      conversation?.type === "GROUP"
        ? buildMobileGroupInviteUrl(conversation.inviteToken, authService.getApiBaseUrl())
        : null,
    [conversation?.inviteToken, conversation?.type]
  );

  const saveSetting = async (key: string, value: boolean) => {
    if (!isOwner || !conversation) return;
    setIsSaving(true);
    try {
      await chatService.updateGroupSettings(conversation.id, { [key]: value });
      onSettingsUpdated();
    } catch (e: any) {
      Alert.alert("Lỗi", e.message || "Không thể cập nhật cài đặt");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshToken = async () => {
    if (!isOwner || !conversation) return;
    setIsRefreshingToken(true);
    try {
      await chatService.refreshInviteToken(conversation.id);
      onSettingsUpdated();
      Alert.alert("Thành công", "Đã tạo link mời mới");
    } catch (e: any) {
      Alert.alert("Lỗi", e.message || "Không thể tạo link mới");
    } finally {
      setIsRefreshingToken(false);
    }
  };

  const handleCopyLink = async () => {
    if (!groupInviteUrl) return;
    try {
      await Clipboard.setStringAsync(groupInviteUrl);
      Alert.alert("Thành công", "Đã sao chép link nhóm");
    } catch {
      Alert.alert("Lỗi", "Không thể sao chép link");
    }
  };

  useEffect(() => {
    if (!visible || !isOwner || !conversation) return;
    fetchPendingMembers();
  }, [visible, isOwner, conversation?.id]);

  const fetchPendingMembers = async () => {
    if (!conversation) return;
    setIsLoadingPending(true);
    try {
      const data = await chatService.getPendingMembers(conversation.id);
      setPendingMembers(data || []);
    } catch {
      setPendingMembers([]);
    } finally {
      setIsLoadingPending(false);
    }
  };

  const handleApproveMember = async (memberId: number) => {
    if (!conversation) return;
    try {
      await chatService.approvePendingMember(conversation.id, memberId);
      setPendingMembers((prev) => prev.filter((m) => m.userId !== memberId));
      onSettingsUpdated();
      Alert.alert("Thành công", "Đã phê duyệt thành viên");
    } catch (e: any) {
      Alert.alert("Lỗi", e.message || "Không thể phê duyệt");
    }
  };

  const handleRejectMember = async (memberId: number) => {
    if (!conversation) return;
    try {
      await chatService.rejectPendingMember(conversation.id, memberId);
      setPendingMembers((prev) => prev.filter((m) => m.userId !== memberId));
      Alert.alert("Thành công", "Đã từ chối thành viên");
    } catch (e: any) {
      Alert.alert("Lỗi", e.message || "Không thể từ chối");
    }
  };

  if (!visible || !conversation) return null;

  return (
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
        <Text style={styles.topTitle}>Quản lý nhóm</Text>
      </LinearGradient>

      {!isOwner && (
        <View style={styles.nonOwnerBanner}>
          <Ionicons name="lock-closed" size={16} color={COLORS.textMuted} />
          <Text style={styles.nonOwnerText}>
            Tính năng này chỉ dành cho trưởng nhóm
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <SectionTitle>Cho phép các thành viên trong nhóm:</SectionTitle>

        <View style={styles.section}>
          <ToggleRow
            label="Thay đổi tên & ảnh đại diện của nhóm"
            checked={settings.allowMemberEditInfo}
            onValueChange={(v) => saveSetting("allowMemberEditInfo", v)}
            disabled={!isOwner || isSaving}
          />
          <ToggleRow
            label="Ghim tin nhắn, ghi chú, bình chọn lên đầu hội thoại"
            checked={true}
            onValueChange={() => {}}
            disabled
            helpText="Tính năng sẽ được cập nhật sau"
          />
          <ToggleRow
            label="Tạo mới ghi chú, nhắc hẹn"
            checked={settings.allowMemberCreateNotes}
            onValueChange={(v) => saveSetting("allowMemberCreateNotes", v)}
            disabled={!isOwner || isSaving}
          />
          <ToggleRow
            label="Tạo mới bình chọn"
            checked={settings.allowMemberCreatePolls}
            onValueChange={(v) => saveSetting("allowMemberCreatePolls", v)}
            disabled={!isOwner || isSaving}
          />
          <ToggleRow
            label="Gửi tin nhắn"
            checked={settings.allowMemberSendMessage}
            onValueChange={(v) => saveSetting("allowMemberSendMessage", v)}
            disabled={!isOwner || isSaving}
            helpText={
              !settings.allowMemberSendMessage
                ? "Chỉ trưởng nhóm và phó nhóm được nhắn tin"
                : undefined
            }
          />
        </View>

        <View style={styles.section}>
          <ToggleRow
            label="Chế độ phê duyệt thành viên mới"
            checked={settings.approvalMode}
            onValueChange={(v) => saveSetting("approvalMode", v)}
            disabled={!isOwner || isSaving}
          />
        </View>

        {/* Pending members section */}
        {settings.approvalMode && isOwner && (
          <View style={styles.pendingSection}>
            <SectionTitle>{`Thành viên chờ phê duyệt (${pendingMembers.length})`}</SectionTitle>
            {isLoadingPending ? (
              <Text style={styles.pendingEmpty}>Đang tải...</Text>
            ) : pendingMembers.length === 0 ? (
              <Text style={styles.pendingEmpty}>Không có thành viên nào chờ phê duyệt</Text>
            ) : (
              pendingMembers.map((member) => (
                <View key={member.userId} style={styles.pendingRow}>
                  <View style={styles.pendingAvatar}>
                    <Text style={styles.pendingAvatarText}>
                      {member.displayName?.charAt(0).toUpperCase() || "?"}
                    </Text>
                  </View>
                  <View style={styles.pendingInfo}>
                    <Text style={styles.pendingName}>{member.displayName}</Text>
                    <Text style={styles.pendingUsername}>@{member.username}</Text>
                  </View>
                  <View style={styles.pendingActions}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApproveMember(member.userId)}
                    >
                      <Ionicons name="checkmark" size={16} color="#16a34a" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleRejectMember(member.userId)}
                    >
                      <Ionicons name="close" size={16} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={styles.section}>
          <ToggleRow
            label="Đánh dấu tin nhắn từ trưởng/phó nhóm"
            checked={settings.markAdminMessages}
            onValueChange={(v) => saveSetting("markAdminMessages", v)}
            disabled={!isOwner || isSaving}
          />
          <ToggleRow
            label="Cho phép thành viên mới đọc tin nhắn gần nhất"
            checked={settings.allowNewMembersReadHistory}
            onValueChange={(v) => saveSetting("allowNewMembersReadHistory", v)}
            disabled={!isOwner || isSaving}
          />
        </View>

        <SectionTitle>Cho phép dùng link tham gia nhóm</SectionTitle>
        <View style={styles.section}>
          <ToggleRow
            label=""
            checked={settings.allowLinkJoin}
            onValueChange={(v) => saveSetting("allowLinkJoin", v)}
            disabled={!isOwner || isSaving}
          />
          {groupInviteUrl && (
            <View style={styles.linkBox}>
              <Text style={styles.linkText} numberOfLines={2}>
                {groupInviteUrl}
              </Text>
              <View style={styles.linkActions}>
                <TouchableOpacity
                  style={styles.linkActionBtn}
                  onPress={handleCopyLink}
                  disabled={!settings.allowLinkJoin}
                >
                  <Ionicons name="copy-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.linkActionText}>Sao chép</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.linkActionBtn}
                  disabled={!settings.allowLinkJoin}
                >
                  <Ionicons name="share-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.linkActionText}>Chia sẻ</Text>
                </TouchableOpacity>
                {isOwner && (
                  <TouchableOpacity
                    style={styles.linkActionBtn}
                    onPress={handleRefreshToken}
                    disabled={isRefreshingToken || !settings.allowLinkJoin}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={16}
                      color={COLORS.primary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.rowItem}
          activeOpacity={0.75}
          onPress={() => setShowBlockedModal(true)}
        >
          <View style={styles.rowLeft}>
            <Ionicons name="ban-outline" size={22} color="#8b939f" />
            <Text style={styles.rowLabel}>Chặn khỏi nhóm</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#a3a8b1" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rowItem}
          activeOpacity={0.75}
          onPress={() => setShowCoOwnerModal(true)}
        >
          <View style={styles.rowLeft}>
            <Ionicons name="key-outline" size={22} color="#8b939f" />
            <Text style={styles.rowLabel}>Trưởng & phó nhóm</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#a3a8b1" />
        </TouchableOpacity>

        {isOwner && (
          <TouchableOpacity
            style={styles.disbandButton}
            onPress={() => setShowDisbandModal(true)}
          >
            <Ionicons name="trash-outline" size={22} color="#fff" />
            <Text style={styles.disbandText}>Giải tán nhóm</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <CoOwnerManagerModal
        visible={showCoOwnerModal}
        onClose={() => setShowCoOwnerModal(false)}
        conversation={conversation}
        currentUserId={currentUserId}
        onUpdated={onSettingsUpdated}
      />
      <DisbandGroupModal
        visible={showDisbandModal}
        onClose={() => setShowDisbandModal(false)}
        conversation={conversation}
        onDisband={async () => {
          try {
            await chatService.disbandGroup(conversation.id);
            Alert.alert("Thành công", "Đã giải tán nhóm");
            onClose();
          } catch (e: any) {
            Alert.alert("Lỗi", e.message || "Không thể giải tán nhóm");
          }
        }}
      />
      <BlockedMembersModal
        visible={showBlockedModal}
        onClose={() => setShowBlockedModal(false)}
        conversation={conversation}
        onSettingsUpdated={onSettingsUpdated}
      />
    </View>
  );
}

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
  nonOwnerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#f5f5f5",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  nonOwnerText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
  },
  section: {
    backgroundColor: "#fff",
  },
  pendingSection: {
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pendingEmpty: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: "italic",
    paddingVertical: 8,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  pendingAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  pendingUsername: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  pendingActions: {
    flexDirection: "row",
    gap: 8,
  },
  approveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#16a34a15",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#16a34a30",
  },
  rejectBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#dc262615",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dc262630",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  toggleLabelWrap: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 14,
    color: COLORS.text,
  },
  toggleLabelDisabled: {
    color: COLORS.textMuted,
  },
  toggleHelp: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  linkBox: {
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primary + "15",
    borderWidth: 1,
    borderColor: COLORS.primary + "30",
  },
  linkText: {
    fontSize: 11,
    fontFamily: "monospace",
    color: COLORS.primary,
    marginBottom: 8,
  },
  linkActions: {
    flexDirection: "row",
    gap: 8,
  },
  linkActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d8dbe2",
    backgroundColor: "#f8fafc",
  },
  linkActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
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
  rowLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.text,
    marginLeft: 14,
  },
  disbandButton: {
    marginHorizontal: 14,
    marginTop: 24,
    marginBottom: 12,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.destructive,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  disbandText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
