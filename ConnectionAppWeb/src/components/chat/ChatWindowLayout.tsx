import { useChatStore } from "@/stores/useChatStore";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import { SidebarInset } from "../ui/sidebar";
import ChatWindowHeader from "./ChatWindowHeader";
import ChatWindowBody from "./ChatWindowBody";
import MessageInput from "./MessageInput";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Message } from "@/types/chat";
import { useAuthStore } from "@/stores/useAuthStore";
import { userService } from "@/services/userService";
import type { User } from "@/types/user";
import { friendService, type BlockStatus } from "@/services/friendService";
import { Button } from "../ui/button";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const ChatWindowLayout = () => {
  const {
    activeConversationId,
    conversations,
    fetchMessages,
    messages: allMessages,
  } = useChatStore();

  const { user } = useAuthStore();
  const { getUserById } = userService;

  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [blockStatus, setBlockStatus] = useState<BlockStatus>({
    blocked: false,
    blockedByMe: false,
    blockedByOther: false,
  });
  const [isUpdatingBlock, setIsUpdatingBlock] = useState(false);

  const selectedConvo =
    conversations.find((c) => c.id === activeConversationId) ?? null;

  // 🔥 reset khi đổi conversation
  useEffect(() => {
    setReplyTo(null);
    setOtherUser(null);
    setBlockStatus({
      blocked: false,
      blockedByMe: false,
      blockedByOther: false,
    });
  }, [activeConversationId]);

  const peerUserId = useMemo(() => {
    if (!selectedConvo || selectedConvo.type !== "PRIVATE" || !user) {
      return null;
    }

    const participant = selectedConvo.participants.find(
      (u) => u.userId !== user.id,
    );

    return participant?.userId ?? null;
  }, [selectedConvo, user]);

  const refreshBlockStatus = useCallback(async () => {
    if (!peerUserId) {
      setBlockStatus({
        blocked: false,
        blockedByMe: false,
        blockedByOther: false,
      });
      return;
    }

    try {
      const next = await friendService.getBlockStatus(peerUserId);
      setBlockStatus(next);
    } catch (err) {
      console.error("Lỗi lấy trạng thái chặn:", err);
    }
  }, [peerUserId]);

  // 🔥 lấy user bên kia + gọi API
  useEffect(() => {
    const fetchOtherUser = async () => {
      if (!selectedConvo || !user) return;

      const participant = selectedConvo.participants.find(
        (u) => u.userId !== user.id,
      );

      if (!participant) return;

      try {
        const fullUser = await getUserById(participant.userId);
        setOtherUser(fullUser);
      } catch (err) {
        console.error("Lỗi lấy user:", err);
      }
    };

    fetchOtherUser();
  }, [selectedConvo, user, getUserById]);

  useEffect(() => {
    if (selectedConvo?.type !== "PRIVATE") {
      setBlockStatus({
        blocked: false,
        blockedByMe: false,
        blockedByOther: false,
      });
      return;
    }

    void refreshBlockStatus();
  }, [selectedConvo?.id, selectedConvo?.type, refreshBlockStatus]);

  // 🔥 fetch messages
  useEffect(() => {
    if (activeConversationId) {
      if (!allMessages[activeConversationId]) {
        fetchMessages(activeConversationId);
      }
    }
  }, [activeConversationId, fetchMessages, allMessages]);

  if (!selectedConvo) {
    return <ChatWelcomeScreen />;
  }

  // 🔥 check trạng thái user
  const isLocked = otherUser?.status === "LOCKED";
  const isDeleted = otherUser?.status === "DELETED";
  const isBlockedByMe = blockStatus.blockedByMe;
  const isBlockedByOther = blockStatus.blockedByOther;
  const isBlockedChat =
    isLocked || isDeleted || isBlockedByMe || isBlockedByOther;

  const handleUnblock = async () => {
    if (!peerUserId || isUpdatingBlock) {
      return;
    }

    setIsUpdatingBlock(true);
    try {
      await friendService.unblockUser(peerUserId);
      toast.success("Đã bỏ chặn người dùng");
      await refreshBlockStatus();
    } catch (err) {
      console.error(err);
      toast.error("Không thể bỏ chặn người dùng");
    } finally {
      setIsUpdatingBlock(false);
    }
  };

  return (
    <SidebarInset className="flex flex-col h-full flex-1 overflow-hidden rounded-sm shadow-md">
      {/* Header */}
      <ChatWindowHeader
        chat={selectedConvo}
        peerUserId={peerUserId}
        blockedByMe={isBlockedByMe}
        blockedByOther={isBlockedByOther}
        onBlockStatusChanged={refreshBlockStatus}
      />

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-primary-foreground">
        <ChatWindowBody
          onReply={(msg) => setReplyTo(msg)}
          isLocked={isLocked}
          isDeleted={isDeleted}
        />
      </div>

      {/* Footer */}
      {!isBlockedChat ? (
        <MessageInput
          selectedConvo={selectedConvo}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onBlockedDetected={refreshBlockStatus}
        />
      ) : (
        <div className="p-3 text-center text-sm text-muted-foreground border-t space-y-2">
          {isLocked && <p>Tài khoản này đã bị khóa</p>}
          {isDeleted && <p>Tài khoản này đã bị xóa</p>}
          {isBlockedByOther && <p>Bạn đã bị chặn</p>}
          {isBlockedByMe && (
            <>
              <p>Bạn đã chặn người này</p>
              <Button
                type="button"
                variant="outline"
                className="mx-auto"
                onClick={handleUnblock}
                disabled={isUpdatingBlock}
              >
                <ShieldCheck className="size-4 mr-2" />
                Bỏ chặn
              </Button>
            </>
          )}
        </div>
      )}
    </SidebarInset>
  );
};

export default ChatWindowLayout;
