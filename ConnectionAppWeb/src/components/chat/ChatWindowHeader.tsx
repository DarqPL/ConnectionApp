import { useChatStore } from "@/stores/useChatStore";
import type { Conversation } from "@/types/chat";
import { SidebarTrigger } from "../ui/sidebar";
import { useAuthStore } from "@/stores/useAuthStore";
import { Separator } from "../ui/separator";
import UserAvatar from "./UserAvatar";
import GroupChatAvatar from "./GroupChatAvatar";
import { useCallStore } from "@/stores/useCallStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import {
  Ban,
  MoreVertical,
  ShieldCheck,
  PanelRight,
  Phone,
  Video,
} from "lucide-react";
import { friendService } from "@/services/friendService";
import { toast } from "sonner";
import { useState } from "react";
import type { CallMediaType } from "@/types/call";

const isActiveCallStatus = (status?: string | null): boolean =>
  status === "RINGING" || status === "ONGOING";

interface ChatWindowHeaderProps {
  chat?: Conversation;
  peerUserId?: number | null;
  blockedByMe?: boolean;
  blockedByOther?: boolean;
  onBlockStatusChanged?: () => Promise<void> | void;
  onFilesOpen?: () => void;
}

const ChatWindowHeader = ({
  chat,
  peerUserId,
  blockedByMe = false,
  blockedByOther = false,
  onBlockStatusChanged,
  onFilesOpen,
}: ChatWindowHeaderProps) => {
  const { conversations, activeConversationId } = useChatStore();
  const { user } = useAuthStore();
  const { startCall, activeCall } = useCallStore();
  const [isUpdatingBlock, setIsUpdatingBlock] = useState(false);
  const [isStartingCall, setIsStartingCall] = useState(false);

  let otherUser;

  chat = chat ?? conversations.find((c) => c.id === activeConversationId);

  if (!chat) {
    return (
      <header className="md:hidden sticky top-0 z-10 flex items-center gap-2 px-4 py-2 w-full">
        <SidebarTrigger className="-ml-1 text-foreground" />
      </header>
    );
  }

  if (chat.type === "PRIVATE") {
    const otherUsers = chat.participants.filter((p) => p.userId !== user?.id);
    otherUser = otherUsers.length > 0 ? otherUsers[0] : null;

    if (!user || !otherUser) return;
  }

  const showBlockActions =
    chat.type === "PRIVATE" && !!peerUserId && !!onBlockStatusChanged;
  const canStartCall = !(
    chat.type === "PRIVATE" &&
    (blockedByMe || blockedByOther)
  );

  const handleStartCall = async (mediaType: CallMediaType) => {
    if (!chat || isStartingCall || !canStartCall) {
      return;
    }

    if (
      activeCall?.conversationId === chat.id &&
      isActiveCallStatus(activeCall.status)
    ) {
      toast.info("Cuoc goi cua doan chat nay dang dien ra");
      return;
    }

    setIsStartingCall(true);
    try {
      await startCall(chat.id, mediaType);
      toast.success(
        mediaType === "VIDEO"
          ? "Da bat dau cuoc goi video"
          : "Da bat dau cuoc goi thoai",
      );
    } catch (error) {
      console.error(error);
      toast.error("Khong the bat dau cuoc goi");
    } finally {
      setIsStartingCall(false);
    }
  };

  const handleBlock = async () => {
    if (!peerUserId || isUpdatingBlock) return;

    setIsUpdatingBlock(true);
    try {
      await friendService.blockUser(peerUserId);
      toast.success("Đã chặn người dùng");
      await onBlockStatusChanged?.();
    } catch (error) {
      console.error(error);
      toast.error("Không thể chặn người dùng");
    } finally {
      setIsUpdatingBlock(false);
    }
  };

  const handleUnblock = async () => {
    if (!peerUserId || isUpdatingBlock) return;

    setIsUpdatingBlock(true);
    try {
      await friendService.unblockUser(peerUserId);
      toast.success("Đã bỏ chặn người dùng");
      await onBlockStatusChanged?.();
    } catch (error) {
      console.error(error);
      toast.error("Không thể bỏ chặn người dùng");
    } finally {
      setIsUpdatingBlock(false);
    }
  };

  return (
    <header className="sticky top-0 z-10 px-4 py-2 flex items-center bg-background/50 backdrop-blur-md border-b border-border/10">
      <div className="flex items-center gap-2 w-full">
        <SidebarTrigger className="-ml-1 text-foreground" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />

        <div className="p-2 w-full flex items-center gap-3">
          {/* avatar */}
          <div className="relative">
            {chat.type === "PRIVATE" ? (
              <>
                <UserAvatar
                  type={"sidebar"}
                  name={otherUser?.displayName || "Moji"}
                  avatarUrl={otherUser?.avatarUrl || undefined}
                />
              </>
            ) : (
              <GroupChatAvatar
                participants={chat.participants}
                type="sidebar"
                avatarUrl={chat.avatarUrl}
              />
            )}
          </div>

          {/* name */}
          <h2 className="font-semibold text-foreground">
            {chat.type === "PRIVATE" ? otherUser?.displayName : chat.name}
          </h2>

          {showBlockActions && (
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => void handleStartCall("VOICE")}
                disabled={!canStartCall || isStartingCall}
                title="Goi thoai"
              >
                <Phone className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => void handleStartCall("VIDEO")}
                disabled={!canStartCall || isStartingCall}
                title="Goi video"
              >
                <Video className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onFilesOpen}
                title="Thông tin hội thoại"
              >
                <PanelRight className="size-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={isUpdatingBlock}
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {blockedByMe ? (
                    <DropdownMenuItem onClick={handleUnblock}>
                      <ShieldCheck className="size-4" />
                      Bỏ chặn người dùng
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={handleBlock}
                      variant={blockedByOther ? "default" : "destructive"}
                    >
                      <Ban className="size-4" />
                      {blockedByOther
                        ? "Chặn lại người dùng"
                        : "Chặn người dùng"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          {!showBlockActions && (
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => void handleStartCall("VOICE")}
                disabled={!canStartCall || isStartingCall}
                title="Goi thoai"
              >
                <Phone className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => void handleStartCall("VIDEO")}
                disabled={!canStartCall || isStartingCall}
                title="Goi video"
              >
                <Video className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onFilesOpen}
                title="Thông tin hội thoại"
              >
                <PanelRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default ChatWindowHeader;
