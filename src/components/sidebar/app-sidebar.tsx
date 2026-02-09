import { NavUser } from "@/components/sidebar/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Moon, Sun } from "lucide-react";
import { Switch } from "../ui/switch";
// import CreateNewChat from "../chat/CreateNewChat";
// import NewGroupChatModal from "../chat/NewGroupChatModal";
// import GroupChatList from "../chat/GroupChatList";
// import AddFriendModal from "../chat/AddFriendModal";
// import DirectMessageList from "../chat/DirectMessageList";
import { useThemeStore } from "@/stores/useThemeStore";
import { useAuthStore } from "@/stores/useAuthStore";


export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isDark, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();
  // const { convoLoading } = useChatStore();
  const user1 = {
    _id: '1',
    username: 'johndoe',
    displayName: 'John Doe',
    email: 'johndoe@example.com',
    avatarUrl: 'https://i.pravatar.cc/150?img=3',
    bio: 'Passionate about technology and connecting with people. Love to code and explore new ideas.',
    phone: '+84 123 456 789',
    createdAt: '2024-01-01',
    updatedAt: '2024-02-09',
  }
  return (
    <Sidebar
      variant="inset"
      {...props}
    >
      {/* Header */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="bg-gradient-primary"
            >
              <a href="#">
                <div className="flex w-full items-center px-2 justify-between">
                  <h1 className="text-xl font-bold text-white">Connection</h1>
                  <div className="flex items-center gap-2">
                    <Sun className="size-4 text-white/80" />
                    <Switch
                      checked={isDark}
                      onCheckedChange={toggleTheme}
                      className="data-[state=checked]:bg-background/80"
                    />
                    <Moon className="size-4 text-white/80" />
                  </div>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent className="beautiful-scrollbar">
        {/* New Chat */}
        <SidebarGroup>
          <SidebarGroupContent>
            {/* <CreateNewChat /> */}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Group Chat */}
        <SidebarGroup>
          <div className="flex items-center justify-between">
            <SidebarGroupLabel className="uppercase">nhóm chat</SidebarGroupLabel>
            {/* <NewGroupChatModal /> */}
          </div>

          {/* <SidebarGroupContent>
            {convoLoading ? <ConversationSkeleton /> : <GroupChatList />}
          </SidebarGroupContent> */}
        </SidebarGroup>

        {/* Dirrect Message */}
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase">bạn bè</SidebarGroupLabel>
          <SidebarGroupAction
            title="Kết Bạn"
            className="cursor-pointer"
          >
            {/* <AddFriendModal /> */}
          </SidebarGroupAction>

          {/* <SidebarGroupContent>
            {convoLoading ? <ConversationSkeleton /> : <DirectMessageList />}
          </SidebarGroupContent> */}
        </SidebarGroup>
      </SidebarContent>
      {/* Footer */}
      <SidebarFooter>{user1 && <NavUser user={user1} />}</SidebarFooter>
    </Sidebar>
  );
}
