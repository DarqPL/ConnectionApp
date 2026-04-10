import type { Conversation } from "@/types/chat";
import ChatCard from "./ChatCard";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { cn } from "@/lib/utils";
import UserAvatar from "./UserAvatar";
import StatusBadge from "./StatusBadge";
import UnreadCountBadge from "./UnreadCountBadge";
import { useSocketStore } from "@/stores/useSocketStore";

const DirectMessageCard = ({ convo }: { convo: Conversation }) => {
  const { user } = useAuthStore();
  const {
    activeConversationId,
    setActiveConversation,
    messages,
    fetchMessages,
  } = useChatStore();

  // 👇 fallback an toàn nếu onlineUsers undefined
  const onlineUsers = useSocketStore((state) => state.onlineUsers ?? []);

  if (!user) return null;

  // Find the other participant (not the current user)
  const otherParticipant = convo.participants.find((p) => p.userId !== user.id);
  if (!otherParticipant) return null;

  const unreadCount = convo.unreadCount ?? 0;
  const lastMessage = convo.lastMessageContent ?? "";

  const isOnline =
    Array.isArray(onlineUsers) && onlineUsers.includes(String(otherParticipant.userId));

  const handleSelectConversation = async (id: number) => {
    setActiveConversation(id);
    if (!messages[id]) {
      await fetchMessages(id);
    }
  };

  return (
    <ChatCard
      convoId={convo.id}
      name={otherParticipant.displayName ?? ""}
      timestamp={
        convo.lastMessageAt
          ? new Date(convo.lastMessageAt)
          : undefined
      }
      isActive={activeConversationId === convo.id}
      onSelect={handleSelectConversation}
      unreadCount={unreadCount}
      leftSection={
        <>
          <UserAvatar
            type="sidebar"
            name={otherParticipant.displayName ?? ""}
            avatarUrl={otherParticipant.avatarUrl ?? undefined}
          />
          <StatusBadge status={isOnline ? "online" : "offline"} />
          {unreadCount > 0 && <UnreadCountBadge unreadCount={unreadCount} />}
        </>
      }
      subtitle={
        <p
          className={cn(
            "text-sm truncate",
            unreadCount > 0
              ? "font-medium text-foreground"
              : "text-muted-foreground",
          )}
        >
          {lastMessage}
        </p>
      }
    />
  );
};

export default DirectMessageCard;
