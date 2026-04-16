import { useChatStore } from "@/stores/useChatStore";
import GroupChatCard from "./GroupChatCard";

const GroupChatList = () => {
  const { conversations } = useChatStore();

  if (!conversations) return null;

  const groupConversations = conversations.filter(
    (convo) => convo.type === "GROUP"
  );

  return (
    <div className="flex flex-col gap-1 p-1">
      {groupConversations.map((convo) => (
        <GroupChatCard
          key={convo.id}
          convo={convo}
        />
      ))}
    </div>
  );
};

export default GroupChatList;
