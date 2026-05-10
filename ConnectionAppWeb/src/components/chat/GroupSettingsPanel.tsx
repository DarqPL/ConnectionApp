import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Key,
  Ban,
  Trash2,
  RefreshCw,
  Copy,
  Share2,
  Lock,
  Check,
} from "lucide-react";
import type { Conversation } from "@/types/chat";
import { cn } from "@/lib/utils";
import UserAvatar from "./UserAvatar";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { chatService } from "@/services/chatService";
import { toast } from "sonner";
import { buildGroupInviteUrl } from "@/lib/apiConfig";
import { CoOwnerManagerDialog } from "./CoOwnerManagerDialog";
import { DisbandGroupDialog } from "./DisbandGroupDialog";
import { BlockedMembersDialog } from "./BlockedMembersDialog";

interface GroupSettingsPanelProps {
  chat: Conversation;
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
}

const ToggleRow = ({
  label,
  checked,
  onCheckedChange,
  disabled,
  helpText,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  helpText?: string;
}) => (
  <div className="flex items-center justify-between py-3">
    <div className="flex-1 pr-4">
      <p className={cn("text-sm", disabled && "text-muted-foreground")}>
        {label}
      </p>
      {helpText && (
        <p className="text-xs text-muted-foreground mt-0.5">{helpText}</p>
      )}
    </div>
    <Switch
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
    />
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4 mb-2">
    {children}
  </p>
);

const GroupSettingsPanel = ({
  chat,
  isOpen,
  onClose,
  onBack,
}: GroupSettingsPanelProps) => {
  const { user } = useAuthStore();
  const fetchConversationById = useChatStore((s) => s.fetchConversationById);

  const handleSettingsUpdated = async () => {
    await fetchConversationById(chat.id);
  };

  const [settings, setSettings] = useState({
    allowMemberEditInfo: chat.allowMemberEditInfo ?? true,
    allowMemberCreateNotes: chat.allowMemberCreateNotes ?? true,
    allowMemberCreatePolls: chat.allowMemberCreatePolls ?? true,
    allowMemberSendMessage: chat.allowMemberSendMessage ?? true,
    approvalMode: chat.approvalMode ?? false,
    markAdminMessages: chat.markAdminMessages ?? false,
    allowNewMembersReadHistory: chat.allowNewMembersReadHistory ?? true,
    allowLinkJoin: chat.allowLinkJoin ?? true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showCoOwnerManager, setShowCoOwnerManager] = useState(false);
  const [showDisbandDialog, setShowDisbandDialog] = useState(false);
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [pendingMembers, setPendingMembers] = useState<Participant[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);

  const currentUserRole = useMemo(() => {
    if (!user) return null;
    const p = chat.participants.find((p) => p.userId === user.id);
    return p?.role || null;
  }, [chat.participants, user]);

  const isOwner = currentUserRole === "OWNER";
  const groupInviteUrl = chat.type === "GROUP" ? buildGroupInviteUrl(chat.inviteToken) : null;

  const saveSetting = async (key: keyof typeof settings, value: boolean) => {
    if (!isOwner) return;
    setIsSaving(true);
    try {
      await chatService.updateGroupSettings(chat.id, { [key]: value });
      setSettings((prev) => ({ ...prev, [key]: value }));
      await fetchConversationById(chat.id);
    } catch {
      toast.error("Không thể cập nhật cài đặt");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshToken = async () => {
    if (!isOwner) return;
    setIsRefreshingToken(true);
    try {
      const res = await chatService.refreshInviteToken(chat.id);
      await fetchConversationById(chat.id);
      toast.success("Đã tạo link mời mới");
    } catch {
      toast.error("Không thể tạo link mới");
    } finally {
      setIsRefreshingToken(false);
    }
  };

  const handleCopyLink = async () => {
    if (!groupInviteUrl) return;
    try {
      await navigator.clipboard.writeText(groupInviteUrl);
      toast.success("Đã sao chép link nhóm");
    } catch {
      toast.error("Không thể sao chép link");
    }
  };

  useEffect(() => {
    if (!isOpen || !isOwner) return;
    fetchPendingMembers();
  }, [isOpen, isOwner, chat.id]);

  const fetchPendingMembers = async () => {
    setIsLoadingPending(true);
    try {
      const data = await chatService.getPendingMembers(chat.id);
      setPendingMembers(data || []);
    } catch {
      setPendingMembers([]);
    } finally {
      setIsLoadingPending(false);
    }
  };

  const handleApproveMember = async (memberId: number) => {
    try {
      await chatService.approvePendingMember(chat.id, memberId);
      setPendingMembers((prev) => prev.filter((m) => m.userId !== memberId));
      await fetchConversationById(chat.id);
      toast.success("Đã phê duyệt thành viên");
    } catch {
      toast.error("Không thể phê duyệt");
    }
  };

  const handleRejectMember = async (memberId: number) => {
    try {
      await chatService.rejectPendingMember(chat.id, memberId);
      setPendingMembers((prev) => prev.filter((m) => m.userId !== memberId));
      toast.success("Đã từ chối thành viên");
    } catch {
      toast.error("Không thể từ chối");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="h-full bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="font-bold text-lg flex-1 text-center mr-8">Quản lý nhóm</h2>
      </div>

      {/* Non-owner banner */}
      {!isOwner && (
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
          <Lock className="size-4 text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Tính năng này chỉ dành cho trưởng nhóm
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto beautiful-scrollbar px-4">
        <SectionTitle>Cho phép các thành viên trong nhóm:</SectionTitle>

        <div className="divide-y divide-border/50">
          <ToggleRow
            label="Thay đổi tên & ảnh đại diện của nhóm"
            checked={settings.allowMemberEditInfo}
            onCheckedChange={(v) => saveSetting("allowMemberEditInfo", v)}
            disabled={!isOwner || isSaving}
          />
          <ToggleRow
            label="Ghim tin nhắn, ghi chú, bình chọn lên đầu hội thoại"
            checked={true}
            onCheckedChange={() => {}}
            disabled
            helpText="Tính năng sẽ được cập nhật sau"
          />
          <ToggleRow
            label="Tạo mới ghi chú, nhắc hẹn"
            checked={settings.allowMemberCreateNotes}
            onCheckedChange={(v) => saveSetting("allowMemberCreateNotes", v)}
            disabled={!isOwner || isSaving}
          />
          <ToggleRow
            label="Tạo mới bình chọn"
            checked={settings.allowMemberCreatePolls}
            onCheckedChange={(v) => saveSetting("allowMemberCreatePolls", v)}
            disabled={!isOwner || isSaving}
          />
          <ToggleRow
            label="Gửi tin nhắn"
            checked={settings.allowMemberSendMessage}
            onCheckedChange={(v) => saveSetting("allowMemberSendMessage", v)}
            disabled={!isOwner || isSaving}
            helpText={
              !settings.allowMemberSendMessage
                ? "Chỉ trưởng nhóm và phó nhóm được nhắn tin"
                : undefined
            }
          />
        </div>

        <div className="divide-y divide-border/50 mt-2">
          <ToggleRow
            label="Chế độ phê duyệt thành viên mới"
            checked={settings.approvalMode}
            onCheckedChange={(v) => saveSetting("approvalMode", v)}
            disabled={!isOwner || isSaving}
          />
        </div>

        {/* Pending members section */}
        {settings.approvalMode && isOwner && (
          <div className="mt-4">
            <SectionTitle>Thành viên chờ phê duyệt ({pendingMembers.length})</SectionTitle>
            <div className="space-y-2">
              {isLoadingPending ? (
                <p className="text-sm text-muted-foreground py-2">Đang tải...</p>
              ) : pendingMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 italic">Không có thành viên nào chờ phê duyệt</p>
              ) : (
                pendingMembers.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <UserAvatar
                      type="chat"
                      name={member.displayName}
                      avatarUrl={member.avatarUrl || undefined}
                      className="size-10"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.displayName}</p>
                      <p className="text-xs text-muted-foreground">@{member.username}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs text-green-600 border-green-600/30 hover:bg-green-600/10"
                        onClick={() => handleApproveMember(member.userId)}
                      >
                        <Check className="size-3 mr-1" />
                        Duyệt
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs text-red-600 border-red-600/30 hover:bg-red-600/10"
                        onClick={() => handleRejectMember(member.userId)}
                      >
                        <X className="size-3 mr-1" />
                        Từ chối
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="divide-y divide-border/50 mt-2">
          <ToggleRow
            label="Đánh dấu tin nhắn từ trưởng/phó nhóm"
            checked={settings.markAdminMessages}
            onCheckedChange={(v) => saveSetting("markAdminMessages", v)}
            disabled={!isOwner || isSaving}
          />
          <ToggleRow
            label="Cho phép thành viên mới đọc tin nhắn gần nhất"
            checked={settings.allowNewMembersReadHistory}
            onCheckedChange={(v) => saveSetting("allowNewMembersReadHistory", v)}
            disabled={!isOwner || isSaving}
          />
        </div>

        {/* Link/QR section */}
        <SectionTitle>Cho phép dùng link tham gia nhóm</SectionTitle>
        <div className="mb-3">
          <ToggleRow
            label=""
            checked={settings.allowLinkJoin}
            onCheckedChange={(v) => saveSetting("allowLinkJoin", v)}
            disabled={!isOwner || isSaving}
          />
          {groupInviteUrl && (
            <div className="mt-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-mono text-primary break-all flex-1">
                  {groupInviteUrl}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs flex-1"
                  onClick={handleCopyLink}
                  disabled={!settings.allowLinkJoin}
                >
                  <Copy className="size-3 mr-1" />
                  Sao chép
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs flex-1"
                  disabled={!settings.allowLinkJoin}
                >
                  <Share2 className="size-3 mr-1" />
                  Chia sẻ
                </Button>
                {isOwner && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleRefreshToken}
                    disabled={isRefreshingToken || !settings.allowLinkJoin}
                  >
                    <RefreshCw className={cn("size-3", isRefreshingToken && "animate-spin")} />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Blocked members */}
        <button
          onClick={() => setShowBlockedDialog(true)}
          className="w-full flex items-center gap-3 py-3 hover:bg-accent/50 rounded-lg transition-colors"
        >
          <Ban className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Chặn khỏi nhóm</span>
        </button>

        {/* Owner & co-owners */}
        <button
          onClick={() => setShowCoOwnerManager(true)}
          className="w-full flex items-center gap-3 py-3 hover:bg-accent/50 rounded-lg transition-colors"
        >
          <Key className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Trưởng & phó nhóm</span>
        </button>

        {/* Disband group */}
        {isOwner && (
          <div className="mt-6 mb-4">
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setShowDisbandDialog(true)}
            >
              <Trash2 className="size-4 mr-2" />
              Giải tán nhóm
            </Button>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CoOwnerManagerDialog
        isOpen={showCoOwnerManager}
        onClose={() => setShowCoOwnerManager(false)}
        conversation={chat}
        currentUserId={user?.id || 0}
      />
      <DisbandGroupDialog
        isOpen={showDisbandDialog}
        onClose={() => setShowDisbandDialog(false)}
        conversation={chat}
        onDisband={async () => {
          try {
            await chatService.disbandGroup(chat.id);
            toast.success("Đã giải tán nhóm");
            onClose();
          } catch {
            toast.error("Không thể giải tán nhóm");
          }
        }}
      />
      <BlockedMembersDialog
        isOpen={showBlockedDialog}
        onClose={() => setShowBlockedDialog(false)}
        conversation={chat}
        onSettingsUpdated={handleSettingsUpdated}
      />
    </div>
  );
};

export default GroupSettingsPanel;
