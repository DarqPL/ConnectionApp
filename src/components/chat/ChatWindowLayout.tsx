import { useChatStore } from "@/stores/useChatStore";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import { SidebarInset } from "../ui/sidebar";
import ChatWindowHeader from "./ChatWindowHeader";
import ChatWindowBody from "./ChatWindowBody";
import MessageInput from "./MessageInput";
import { useEffect, useState } from "react";
import type { Message } from "@/types/chat";

const ChatWindowLayout = () => {
  const {
    activeConversationId,
    conversations,
    fetchMessages,
    messages: allMessages,
  } = useChatStore();

  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const selectedConvo =
    conversations.find((c) => c.id === activeConversationId) ?? null;

  // Clear reply when switching conversations
  useEffect(() => {
    setReplyTo(null);
  }, [activeConversationId]);

  useEffect(() => {
    if (activeConversationId) {
      // Fetch initial messages if not fetched yet
      if (!allMessages[activeConversationId]) {
        fetchMessages(activeConversationId);
      }
    }
  }, [activeConversationId, fetchMessages, allMessages]);

  if (!selectedConvo) {
    return <ChatWelcomeScreen />;
  }

  return (
    <SidebarInset className="flex flex-col h-full flex-1 overflow-hidden rounded-sm shadow-md">
      {/* Header */}
      <ChatWindowHeader chat={selectedConvo} />

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-primary-foreground">
        <ChatWindowBody onReply={(msg) => setReplyTo(msg)} />
      </div>

      {/* Footer */}
      <MessageInput
        selectedConvo={selectedConvo}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </SidebarInset>
  );
};

export default ChatWindowLayout;
