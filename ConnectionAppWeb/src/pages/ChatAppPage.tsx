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
      <div className="relative flex h-screen w-full overflow-hidden bg-background font-sans">
        {/* Subtle Mesh Background for App */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] opaicty-50" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-500/5 rounded-full blur-[120px]" />
          <div className="absolute top-[40%] right-[-5%] w-[30%] h-[30%] bg-blue-400/5 rounded-full blur-[100px]" />
        </div>

        {/* Sidebar wrapper for glassmorphism */}
        <div className="relative z-10 h-full">
          <AppSidebar className="border-r border-border/40 bg-background/40 backdrop-blur-xl" />
        </div>

        {/* Main Content Area */}
        <main className="relative z-10 flex flex-1 flex-col overflow-hidden p-2 md:p-3 lg:p-4">
          <div className="flex flex-1 overflow-hidden rounded-3xl border border-border/40 bg-background/60 shadow-2xl backdrop-blur-xl transition-all duration-500 ease-in-out">
            <ChatWindowLayout />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default ChatAppPage;
