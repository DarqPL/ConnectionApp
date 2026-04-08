import { useChatStore } from "@/stores/useChatStore";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import { SidebarInset } from "../ui/sidebar";
import ChatWindowHeader from "./ChatWindowHeader";
import ChatWindowBody from "./ChatWindowBody";
import MessageInput from "./MessageInput";
import { useEffect, useState } from "react";
import type { Message } from "@/types/chat";
import { useAuthStore } from "@/stores/useAuthStore";
import { userService } from "@/services/userService";
import type { User } from "@/types/user";

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

  const selectedConvo =
    conversations.find((c) => c.id === activeConversationId) ?? null;

  // 🔥 reset khi đổi conversation
  useEffect(() => {
    setReplyTo(null);
    setOtherUser(null);
  }, [activeConversationId]);

  // 🔥 lấy user bên kia + gọi API
  useEffect(() => {
    const fetchOtherUser = async () => {
      if (!selectedConvo || !user) return;

      const participant = selectedConvo.participants.find(
        (u) => u.userId !== user.id
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
  const isBlockedChat = isLocked || isDeleted;

  return (
    <SidebarInset className="flex flex-col h-full flex-1 overflow-hidden rounded-sm shadow-md">
      {/* Header */}
      <ChatWindowHeader chat={selectedConvo} />

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
        />
      ) : (
        <div className="p-3 text-center text-sm text-muted-foreground border-t">
          {isLocked && "Tài khoản này đã bị khóa"}
          {isDeleted && "Tài khoản này đã bị xóa"}
        </div>
      )}
    </SidebarInset>
  );
};

export default ChatWindowLayout;