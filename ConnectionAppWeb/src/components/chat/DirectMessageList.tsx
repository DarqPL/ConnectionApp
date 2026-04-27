import { useChatStore } from "@/stores/useChatStore";
import { useShallow } from "zustand/react/shallow";
import DirectMessageCard from "./DirectMessageCard";

const DirectMessageList = () => {
  const directConversations = useChatStore(
    useShallow((state) =>
      state.conversations.filter((convo) => convo.type === "PRIVATE"),
    ),
  );

  return (
    <div className="flex-1 overflow-y-auto p-1 space-y-1">
      {directConversations.map((convo) => (
        <DirectMessageCard
          convo={convo}
          key={convo.id}
        />
      ))}
    </div>
  );
};

export default DirectMessageList;
