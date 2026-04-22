import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  X, Download, File, UserPlus, Settings, BellOff, Pin,
  ChevronDown, ChevronRight, Users, Pencil,
  Calendar, StickyNote, Image as ImageIcon, LogOut, Trash2,
  MessageCircle, Link as LinkIcon, BarChart3
} from "lucide-react";
import type { Message, Conversation } from "@/types/chat";
import { cn } from "@/lib/utils";
import UserAvatar from "./UserAvatar";
import GroupChatAvatar from "./GroupChatAvatar";
import { TransferOwnershipDialog } from "./TransferOwnershipDialog";
import { SuccessorPromotionDialog } from "./SuccessorPromotionDialog";
import { MemberListDialog } from "./MemberListDialog";
import AddMemberDialog from "./AddMemberDialog";
import { RenameGroupDialog } from "./RenameGroupDialog";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { chatService } from "@/services/chatService";
import { toast } from "sonner";
import "yet-another-react-lightbox/styles.css";
import Lightbox from "yet-another-react-lightbox";

interface ChatInfoPanelProps {
  chat: Conversation;
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
  onLeaveGroup?: () => void;
  onDeleteHistory?: () => void;
  onLogout?: () => void;
}

const SectionHeader = ({
  title,
  isOpen,
  onToggle,
  count
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  count?: number;
}) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors border-t border-border/40"
  >
    <div className="flex items-center gap-2">
      <span className="font-semibold text-sm">
        {title} {count !== undefined && <span className="text-muted-foreground font-normal">({count})</span>}
      </span>
    </div>
    {isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
  </button>
);

const ChatInfoPanel = ({
  chat,
  messages,
  isOpen,
  onClose,
  onLeaveGroup,
  onDeleteHistory
}: ChatInfoPanelProps) => {
  const { user } = useAuthStore();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    members: true,
    board: true,
    media: true,
    files: true,
    description: false,
    pinnedMessages: false,
    schedule: false,
    polls: false,
    groupLink: false,
  });
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [showAllImages, setShowAllImages] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showSuccessorDialog, setShowSuccessorDialog] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [showMemberListDialog, setShowMemberListDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  // Check if current user is group owner
  const currentUserRole = useMemo(() => {
    if (!user) return null;
    const participant = chat.participants.find(p => p.userId === user.id);
    return participant?.role || null;
  }, [chat.participants, user]);

  // Find CO_OWNER if exists
  const coOwner = useMemo(() => {
    return chat.participants.find(p => p.role === "CO_OWNER") || null;
  }, [chat.participants]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleDeleteHistory = () => {
    const confirmed = window.confirm("Bạn có chắc chắn muốn xóa lịch sử cuộc trò chuyện này không?\n\nLưu ý: Hành động này không thể hoàn tác.");
    if (confirmed) {
      onDeleteHistory?.();
    }
  };

  const handleLeaveGroup = async () => {
    // If user is owner and there are other members, must handle succession
    if (currentUserRole === "OWNER" && chat.participants.length > 1) {
      // If there's a CO_OWNER, show succession dialog with auto-promote option
      if (coOwner) {
        setShowSuccessorDialog(true);
        return;
      }
      // Otherwise, show transfer dialog to manually select owner
      setShowTransferDialog(true);
      return;
    }

    // For members or owners of groups with 1 member, show confirmation and leave
    const message = currentUserRole === "OWNER"
      ? "Bạn có chắc chắn muốn rời khỏi và xóa nhóm này không?"
      : "Bạn có chắc chắn muốn rời khỏi nhóm này không?";

    const confirmed = window.confirm(message);
    if (confirmed) {
      setIsLeavingGroup(true);
      try {
        if (user) {
          await chatService.leaveGroup(chat.id, user.id);
          toast.success(currentUserRole === "OWNER" ? "Đã xóa nhóm" : "Đã rời khỏi nhóm");
          onLeaveGroup?.();
          onClose();
        }
      } catch (error) {
        console.error("Lỗi rời khỏi nhóm:", error);
        toast.error("Không thể rời khỏi nhóm");
      } finally {
        setIsLeavingGroup(false);
      }
    }
  };

  const handleTransferComplete = async () => {
    // After successful transfer, leave the group
    setIsLeavingGroup(true);
    try {
      if (user) {
        await chatService.leaveGroup(chat.id, user.id);
        toast.success("Đã chuyển quyền và rời khỏi nhóm");
        onLeaveGroup?.();
        onClose();
      }
    } catch (error) {
      console.error("Lỗi rời khỏi nhóm:", error);
      toast.error("Không thể rời khỏi nhóm");
    } finally {
      setIsLeavingGroup(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: number, newRole: string) => {
    try {
      await chatService.updateMemberRole(chat.id, memberId, newRole);
      toast.success("Đã cập nhật vai trò thành viên");
    } catch (error) {
      console.error("Lỗi cập nhật vai trò:", error);
      toast.error("Không thể cập nhật vai trò");
      throw error;
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    try {
      await chatService.leaveGroup(chat.id, memberId);
      toast.success("Đã xóa thành viên khỏi nhóm");
    } catch (error) {
      console.error("Lỗi xóa thành viên:", error);
      toast.error("Không thể xóa thành viên");
      throw error;
    }
  };

  const handleAvatarUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUpdatingAvatar(true);
    try {
      // 1. Prepare FormData
      const formData = new FormData();
      formData.append("file", file);

      // 2. Update conversation avatar via dedicated endpoint (handles S3)
      const updated = await chatService.updateConversationAvatar(chat.id, formData);
 
      // 3. Update local store
      useChatStore.getState().updateConversation({
        ...updated,
        avatarUrl: updated.avatarUrl ? `${updated.avatarUrl}?t=${Date.now()}` : null
      });

      toast.success("Cập nhật ảnh nhóm thành công");
    } catch (error) {
      console.error("Lỗi cập nhật ảnh nhóm:", error);
      toast.error("Không thể cập nhật ảnh nhóm");
    } finally {
      setIsUpdatingAvatar(false);
    }
  };


  const allMedia = useMemo(() => {
    const media: { src: string; width: number; height: number; type: "image" }[] = [];
    messages.forEach(msg => {
      msg.attachments.forEach(att => {
        if (att.type === "IMAGE") {
          media.push({ src: att.fileUrl, width: 800, height: 600, type: "image" });
        } else if (att.type === "VIDEO") {
          // PhotoAlbum handles images better, videos might just show a placeholder or we use a custom renderer
          media.push({ src: att.fileUrl, width: 800, height: 600, type: "image" });
        }
      });
    });
    return media;
  }, [messages]);

  const allFiles = useMemo(() => {
    const files: Array<typeof messages[0]["attachments"][0] & { createdAt: string }> = [];
    messages.forEach(msg => {
      msg.attachments.forEach(att => {
        if (att.type !== "IMAGE" && att.type !== "VIDEO") {
          files.push({ ...att, createdAt: msg.createdAt });
        }
      });
    });
    return files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [messages]);

  const handleDownload = (fileUrl: string, fileName?: string) => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName || "file";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className={cn(
        "h-full bg-background border-l border-border transition-all duration-300 flex flex-col overflow-hidden",
        isOpen ? "w-80 opacity-100" : "w-0 opacity-0 pointer-events-none border-none"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-background z-10">
        <h2 className="font-bold text-lg">Thông tin hội thoại</h2>
        <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto beautiful-scrollbar">
        {/* Profile Card */}
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <div className="relative group">
            {chat.type === "PRIVATE" ? (
              <UserAvatar
                type="profile"
                name={chat.name}
                avatarUrl={chat.avatarUrl || undefined}
                className="size-20 text-2xl border-2 border-primary/20"
              />
            ) : (
              <GroupChatAvatar
                participants={chat.participants}
                type="sidebar"
                avatarUrl={chat.avatarUrl}
              />
            )}
            {(currentUserRole === "OWNER" || currentUserRole === "CO_OWNER") && (
              <label className="absolute bottom-0 right-0 p-1 bg-background border border-border rounded-full shadow-sm hover:bg-accent transition-colors cursor-pointer">
                <Pencil className="size-3" />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarUpdate}
                  disabled={isUpdatingAvatar}
                />
              </label>
            )}
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-xl flex items-center justify-center gap-2 group/title">
              {chat.name}
              {(currentUserRole === "OWNER" || currentUserRole === "CO_OWNER") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 rounded-full opacity-0 group-hover/title:opacity-100 transition-opacity"
                  onClick={() => setShowRenameDialog(true)}
                >
                  <Pencil className="size-3 text-muted-foreground" />
                </Button>
              )}
            </h3>
          </div>

          <div className="grid grid-cols-4 gap-4 w-full pt-2">
            {[
              { icon: BellOff, label: "Tắt thông báo", action: "mute" },
              { icon: Pin, label: "Ghim hội thoại", action: "pin" },
              { icon: UserPlus, label: "Thêm thành viên", action: "add-member" },
              { icon: Settings, label: "Quản lý", action: "settings" },
            ].map((action, i) => (
              <button
                key={i}
                onClick={() => {
                  if (action.action === "add-member") {
                    setShowAddMemberDialog(true);
                  }
                }}
                className="flex flex-col items-center gap-1.5 cursor-pointer group"
              >
                <div className="size-10 rounded-full bg-secondary/50 flex items-center justify-center text-secondary-foreground group-hover:bg-secondary transition-colors">
                  <action.icon className="size-5" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground text-center leading-tight">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Members Section */}
        <SectionHeader
          title="Thành viên nhóm"
          count={chat.participants.length}
          isOpen={openSections.members}
          onToggle={() => toggleSection("members")}
        />
        {openSections.members && (
          <div className="px-4 pb-4 space-y-3">
            <div
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => setShowMemberListDialog(true)}
            >
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Users className="size-4" />
              </div>
              <span className="text-sm font-medium">{chat.participants.length} thành viên</span>
            </div>
            {chat.participants.slice(0, 3).map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors group"
                onClick={() => {
                  if (currentUserRole === "OWNER" || currentUserRole === "CO_OWNER") {
                    setShowMemberListDialog(true);
                  }
                }}
              >
                <UserAvatar type="chat" name={p.displayName} avatarUrl={p.avatarUrl || undefined} className="size-8" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.displayName}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{p.role}</p>
                </div>
              </div>
            ))}
            {chat.participants.length > 3 && (
              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground hover:bg-accent/50"
                onClick={() => setShowMemberListDialog(true)}
              >
                Xem tất cả ({chat.participants.length})
              </Button>
            )}
          </div>
        )}

        {/* Group Description Section */}
        <SectionHeader
          title="Thêm mô tả nhóm"
          isOpen={openSections.description}
          onToggle={() => toggleSection("description")}
        />
        {openSections.description && (
          <div className="px-4 pb-4">
            <div className="p-3 rounded-lg bg-secondary/30 text-sm text-muted-foreground italic">
              Chưa có mô tả nhóm. Nhấn để thêm mô tả cho nhóm của bạn.
            </div>
          </div>
        )}

        {/* Pinned Messages Section */}
        <SectionHeader
          title="Tin nhắn đã ghim"
          isOpen={openSections.pinnedMessages}
          onToggle={() => toggleSection("pinnedMessages")}
        />
        {openSections.pinnedMessages && (
          <div className="px-4 pb-4">
            <div className="text-center py-4 text-muted-foreground">
              <MessageCircle className="size-6 mx-auto mb-2 opacity-50" />
              <p className="text-xs italic">Chưa có tin nhắn đã ghim</p>
            </div>
          </div>
        )}

        {/* Group Schedule Section */}
        <SectionHeader
          title="Lịch nhóm"
          isOpen={openSections.schedule}
          onToggle={() => toggleSection("schedule")}
        />
        {openSections.schedule && (
          <div className="px-4 pb-4">
            <div className="text-center py-4 text-muted-foreground">
              <Calendar className="size-6 mx-auto mb-2 opacity-50" />
              <p className="text-xs italic">Chưa có sự kiện nào</p>
            </div>
          </div>
        )}

        {/* Polls Section */}
        <SectionHeader
          title="Bình chọn"
          isOpen={openSections.polls}
          onToggle={() => toggleSection("polls")}
        />
        {openSections.polls && (
          <div className="px-4 pb-4">
            <div className="text-center py-4 text-muted-foreground">
              <BarChart3 className="size-6 mx-auto mb-2 opacity-50" />
              <p className="text-xs italic">Chưa có bình chọn nào</p>
            </div>
          </div>
        )}

        {/* Group Link Section */}
        <SectionHeader
          title="Link nhóm"
          isOpen={openSections.groupLink}
          onToggle={() => toggleSection("groupLink")}
        />
        {openSections.groupLink && (
          <div className="px-4 pb-4 space-y-2">
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/40 text-xs space-y-2">
              <p className="font-semibold">https://zalo.me/g/mvdfnx533</p>
              <Button size="sm" variant="outline" className="w-full h-7 text-xs">
                <LinkIcon className="size-3 mr-1" />
                Sao chép link
              </Button>
            </div>
          </div>
        )}

        {/* Board Section */}
        <SectionHeader
          title="Bảng tin nhóm"
          isOpen={openSections.board}
          onToggle={() => toggleSection("board")}
        />
        {openSections.board && (
          <div className="px-4 pb-4 space-y-1">
            {[
              { icon: Calendar, label: "Danh sách nhắc hẹn" },
              { icon: StickyNote, label: "Ghi chú, ghim, bình chọn" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors group">
                <item.icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Media Section */}
        <SectionHeader
          title="Ảnh/Video"
          count={allMedia.length}
          isOpen={openSections.media}
          onToggle={() => toggleSection("media")}
        />
        {openSections.media && (
          <div className="px-4 pb-4 space-y-3">
            {allMedia.length > 0 ? (
              <>
                {/* Image Grid */}
                <div className="rounded-xl overflow-hidden border border-border/40 bg-secondary/20">
                  <div className="grid grid-cols-4 gap-1 p-1">
                    {allMedia.slice(0, showAllImages ? allMedia.length : 8).map((photo, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                        onClick={() => setLightboxIndex(idx)}
                      >
                        <img
                          src={photo.src}
                          alt={`media-${idx}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <ImageIcon className="size-5 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* View All Button */}
                {allMedia.length > 8 && (
                  <Button
                    variant="outline"
                    className="w-full h-9 text-xs font-semibold"
                    onClick={() => setShowAllImages(!showAllImages)}
                  >
                    {showAllImages ? "Thu gọn" : `Xem tất cả (${allMedia.length})`}
                  </Button>
                )}

                {/* Lightbox */}
                <Lightbox
                  index={lightboxIndex}
                  open={lightboxIndex >= 0}
                  close={() => setLightboxIndex(-1)}
                  slides={allMedia}
                />
              </>
            ) : (
              <div className="py-6 text-center text-muted-foreground">
                <ImageIcon className="size-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs italic">Chưa có ảnh/video nào</p>
              </div>
            )}
          </div>
        )}

        {/* Files Section */}
        <SectionHeader
          title="File"
          count={allFiles.length}
          isOpen={openSections.files}
          onToggle={() => toggleSection("files")}
        />
        {openSections.files && (
          <div className="px-4 pb-4 space-y-2">
            {allFiles.length > 0 ? (
              <>
                {allFiles.slice(0, 3).map((file, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-all group cursor-pointer" onClick={() => handleDownload(file.fileUrl, file.originalFileName || undefined)}>
                    <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <File className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={file.originalFileName || undefined}>
                        {file.originalFileName}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {new Date(file.createdAt).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Download className="size-4" />
                    </Button>
                  </div>
                ))}
                {allFiles.length > 3 && (
                  <Button variant="ghost" className="w-full text-xs text-muted-foreground hover:bg-accent/50 underline-offset-4 hover:underline">
                    Xem tất cả
                  </Button>
                )}
              </>
            ) : (
              <div className="py-6 text-center text-muted-foreground">
                <p className="text-xs italic">Chưa có file nào</p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons - Delete History & Leave Group */}
        <div className="px-4 pb-4 space-y-2 border-t border-border/40 mt-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-full h-9 text-xs text-destructive hover:text-destructive"
            onClick={handleDeleteHistory}
          >
            <Trash2 className="size-4 mr-2" />
            Xóa lịch sử cuộc trò chuyện
          </Button>
          {currentUserRole === "OWNER" && chat.participants.length > 1 && (
            <div className="px-2 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-700 dark:text-yellow-400">
              <p className="font-medium">Bạn là quản lý nhóm</p>
              <p className="text-[11px] mt-1">Vui lòng chuyển quyền quản lý cho người khác trước khi rời nhóm</p>
            </div>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="w-full h-9 text-xs text-destructive hover:text-destructive"
            onClick={handleLeaveGroup}
            disabled={isLeavingGroup}
          >
            <LogOut className="size-4 mr-2" />
            {isLeavingGroup
              ? "Đang xử lý..."
              : currentUserRole === "OWNER" && chat.participants.length > 1
                ? "Chuyển quyền & Rời"
                : currentUserRole === "OWNER"
                  ? "Xóa nhóm"
                  : "Rời khỏi nhóm"}
          </Button>
        </div>
      </div>

      {/* Successor Promotion Dialog */}
      {user && (
        <SuccessorPromotionDialog
          isOpen={showSuccessorDialog}
          onClose={() => setShowSuccessorDialog(false)}
          conversation={chat}
          currentUserId={user.id}
          coOwner={coOwner}
          onPromotionComplete={handleTransferComplete}
        />
      )}

      {/* Transfer Ownership Dialog */}
      {user && (
        <TransferOwnershipDialog
          isOpen={showTransferDialog}
          onClose={() => setShowTransferDialog(false)}
          conversation={chat}
          currentUserId={user.id}
          onTransferComplete={handleTransferComplete}
        />
      )}

      {/* Member List Dialog */}
      <MemberListDialog
        isOpen={showMemberListDialog}
        conversation={chat}
        currentUserRole={currentUserRole}
        currentUserId={user?.id || null}
        conversationId={chat.id}
        onClose={() => setShowMemberListDialog(false)}
        onRoleUpdate={handleUpdateMemberRole}
        onRemoveMember={handleRemoveMember}
      />

      {/* Add Member Dialog */}
      <AddMemberDialog
        isOpen={showAddMemberDialog}
        conversation={chat}
        onClose={() => setShowAddMemberDialog(false)}
      />

      <RenameGroupDialog
        isOpen={showRenameDialog}
        onClose={() => setShowRenameDialog(false)}
        currentName={chat.name}
        conversationId={chat.id}
      />

      {/* Bottom Section with Pin Toggle and Logout Button */}

    </div>
  );
};

export default ChatInfoPanel;
