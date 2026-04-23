import { useChatStore } from "@/stores/useChatStore";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import { SidebarInset } from "../ui/sidebar";
import ChatWindowHeader from "./ChatWindowHeader";
import ChatWindowBody from "./ChatWindowBody";
import CallOverlay from "./CallOverlay";
import MessageInput from "./MessageInput";
import ChatInfoPanel from "./ChatInfoPanel";
import PinnedMessagesBar from "./PinnedMessagesBar";
import ReminderBanner from "./ReminderBanner";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Message } from "@/types/chat";
import { useAuthStore } from "@/stores/useAuthStore";
import { ForwardMessageModal } from "./ForwardMessageModal";
import { userService } from "@/services/userService";
import type { User } from "@/types/user";
import { friendService, type BlockStatus } from "@/services/friendService";
import { Button } from "../ui/button";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const TypingDots = () => {
  return (
    <span className="ml-1 inline-flex items-end gap-1" aria-hidden="true">
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="inline-block size-1.5 rounded-full bg-current animate-bounce"
          style={{
            animationDelay: `${dot * 0.14}s`,
            animationDuration: "0.9s",
          }}
        />
      ))}
    </span>
  );
};

const ChatWindowLayout = () => {
  const {
    activeConversationId,
    conversations,
    fetchMessages,
    messages: allMessages,
    typingByConversation,
    removeConversation,
  } = useChatStore();

  const { user } = useAuthStore();
  const { getUserById } = userService;
  const navigate = useNavigate();

  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [messageToForward, setMessageToForward] = useState<Message | null>(
    null,
  );
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [blockStatus, setBlockStatus] = useState<BlockStatus>({
    blocked: false,
    blockedByMe: false,
    blockedByOther: false,
  });
  const [isUpdatingBlock, setIsUpdatingBlock] = useState(false);
  const [isFilesPanelOpen, setIsFilesPanelOpen] = useState(false);

  const handleLeaveGroup = useCallback(() => {
    if (activeConversationId) {
      removeConversation(activeConversationId);
      navigate("/");
    }
  }, [activeConversationId, removeConversation, navigate]);

  const selectedConvo =
    conversations.find((c) => c.id === activeConversationId) ?? null;

  const typingLabel = useMemo(() => {
    const typingUsers = selectedConvo
      ? (typingByConversation[selectedConvo.id] ?? [])
      : [];

    if (!selectedConvo || typingUsers.length === 0) {
      return null;
    }

    const names = typingUsers
      .map((item) => item.displayName?.trim())
      .filter((name): name is string => Boolean(name));

    if (names.length === 0) {
      return "Người dùng đang nhập";
    }

    if (selectedConvo.type === "PRIVATE") {
      return `${names[0]} đang nhập`;
    }

    if (names.length === 1) {
      return `${names[0]} đang nhập`;
    }

    if (names.length === 2) {
      return `${names[0]} và ${names[1]} đang nhập`;
    }

    return `${names[0]}, ${names[1]} và ${names.length - 2} người khác đang nhập`;
  }, [selectedConvo, typingByConversation]);

  // 🔥 reset khi đổi conversation
  useEffect(() => {
    setReplyTo(null);
    setMessageToForward(null);
    setOtherUser(null);
    setBlockStatus({
      blocked: false,
      blockedByMe: false,
      blockedByOther: false,
    });
    setIsFilesPanelOpen(false);
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
    <div className="flex h-full w-full overflow-hidden bg-background">
      <SidebarInset className="flex flex-col h-full flex-1 min-w-0 overflow-hidden bg-transparent border-none shadow-none">
        {/* Header */}
        <ChatWindowHeader
          chat={selectedConvo}
          peerUserId={peerUserId}
          blockedByMe={isBlockedByMe}
          blockedByOther={isBlockedByOther}
          onBlockStatusChanged={refreshBlockStatus}
          onFilesOpen={() => setIsFilesPanelOpen(true)}
        />

        <CallOverlay conversationId={selectedConvo.id} />

        {activeConversationId && (
          <>
            <PinnedMessagesBar conversationId={activeConversationId} />
            <ReminderBanner conversationId={activeConversationId} />
          </>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-transparent">
          <ChatWindowBody
            onReply={(msg) => setReplyTo(msg)}
            onForward={(msg) => setMessageToForward(msg)}
            isLocked={isLocked}
            isDeleted={isDeleted}
          />
        </div>

        {/* Footer */}
        {!isBlockedChat ? (
          <>
            {typingLabel && (
              <div className="border-t border-border/40 px-4 py-1.5 text-xs text-muted-foreground bg-background/80">
                <span>{typingLabel}</span>
                <TypingDots />
              </div>
            )}
            <MessageInput
              selectedConvo={selectedConvo}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              onBlockedDetected={refreshBlockStatus}
            />
          </>
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

      <ChatInfoPanel
        chat={selectedConvo}
        messages={allMessages[selectedConvo.id]?.items || []}
        isOpen={isFilesPanelOpen}
        onClose={() => setIsFilesPanelOpen(false)}
        onLeaveGroup={handleLeaveGroup}
      />

      {/* Forward Modal */}
      <ForwardMessageModal
        message={messageToForward}
        onClose={() => setMessageToForward(null)}
      />
    </div>
  );
};

export default ChatWindowLayout;
