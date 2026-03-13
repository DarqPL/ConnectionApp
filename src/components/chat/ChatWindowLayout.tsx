import { useChatStore } from "@/stores/useChatStore";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import { SidebarInset } from "../ui/sidebar";
import ChatWindowHeader from "./ChatWindowHeader";
import ChatWindowBody from "./ChatWindowBody";
import MessageInput from "./MessageInput";
import { useEffect } from "react";
import { useSocketStore } from "@/stores/useSocketStore";

const ChatWindowLayout = () => {
  const {
    activeConversationId,
    conversations,
    fetchMessages,
    messages: allMessages,
  } = useChatStore();
  const { connectSocket, disconnectSocket } = useSocketStore();

  const selectedConvo =
    conversations.find((c) => c.id === activeConversationId) ?? null;

  useEffect(() => {
    if (activeConversationId) {
      // Connect socket when active conversation changes
      connectSocket(activeConversationId);

      // Fetch initial messages if not fetched yet
      if (!allMessages[activeConversationId]) {
        fetchMessages(activeConversationId);
      }

      return () => {
        disconnectSocket();
      };
    }
  }, [activeConversationId, connectSocket, disconnectSocket, fetchMessages, allMessages]);

  if (!selectedConvo) {
    return <ChatWelcomeScreen />;
  }

  return (
    <SidebarInset className="flex flex-col h-full flex-1 overflow-hidden rounded-sm shadow-md">
      {/* Header */}
      <ChatWindowHeader chat={selectedConvo} />

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-primary-foreground">
        <ChatWindowBody />
      </div>

      {/* Footer */}
      <MessageInput selectedConvo={selectedConvo} />
    </SidebarInset>
  );
};

export default ChatWindowLayout;
