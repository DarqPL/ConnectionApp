import { useEffect } from "react";
import { useAdminStore } from "@/stores/useAdminStore";
import { ConversationTable } from "@/components/admin/ConversationTable";

export default function AdminConversationsPage() {
  const { conversations, loading, conversationTotal, conversationPage, fetchConversations } =
    useAdminStore();

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Conversation Management
        </h2>
        <p className="text-muted-foreground">
          Monitor and manage all conversations.
        </p>
      </div>
      <ConversationTable
        conversations={conversations}
        loading={loading}
        total={conversationTotal}
        page={conversationPage}
        onRefresh={fetchConversations}
      />
    </div>
  );
}
