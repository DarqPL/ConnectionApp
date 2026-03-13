import ChatWindowLayout from "@/components/chat/ChatWindowLayout";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useEffect } from "react";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import { useAuthStore } from "@/stores/useAuthStore";

const ChatAppPage = () => {
  const { fetchConversations } = useChatStore();
  const { getFriends } = useFriendStore();
  const { fetchMe, user } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (user) {
      fetchConversations();
      getFriends();
    }
  }, [user, fetchConversations, getFriends]);

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
