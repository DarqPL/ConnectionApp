import { useChatStore } from "@/stores/useChatStore";
import { useShallow } from "zustand/react/shallow";
import GroupChatCard from "./GroupChatCard";

const GroupChatList = () => {
  const groupConversations = useChatStore(
    useShallow((state) =>
      state.conversations.filter((convo) => convo.type === "GROUP"),
    ),
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
