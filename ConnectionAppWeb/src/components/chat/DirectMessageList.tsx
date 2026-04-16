import { useChatStore } from "@/stores/useChatStore";
import DirectMessageCard from "./DirectMessageCard";

const DirectMessageList = () => {
  const { conversations } = useChatStore();

  if (!conversations) return null;

  const directConversations = conversations.filter(
    (convo) => convo.type === "PRIVATE"
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
