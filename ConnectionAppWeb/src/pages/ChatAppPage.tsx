import ChatWindowLayout from "@/components/chat/ChatWindowLayout";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useEffect } from "react";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSocketStore } from "@/stores/useSocketStore";

const ChatAppPage = () => {
  const { fetchConversations } = useChatStore();
  const { getFriends, getPendingRequests } = useFriendStore();
  const { fetchMe, user } = useAuthStore();
  const { connectSocket, disconnectSocket } = useSocketStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (user) {
      fetchConversations();
      getFriends();
      getPendingRequests();
      connectSocket(user.id);

      return () => {
        disconnectSocket();
      };
    }
  }, [user, fetchConversations, getFriends, getPendingRequests, connectSocket, disconnectSocket]);

  return (
    <SidebarProvider>
      <AppSidebar />

      <div className="flex h-screen w-full p-2">
        <ChatWindowLayout />
      </div>

    </SidebarProvider>
  );
};

export default ChatAppPage;
