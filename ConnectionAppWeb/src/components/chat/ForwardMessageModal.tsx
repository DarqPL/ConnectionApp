import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { useChatStore } from "@/stores/useChatStore";
import { useState, useEffect } from "react";
import type { Message, Conversation } from "@/types/chat";
import { Input } from "../ui/input";
import { Search } from "lucide-react";
import { Button } from "../ui/button";
import UserAvatar from "./UserAvatar";
import GroupChatAvatar from "./GroupChatAvatar";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/useAuthStore";

interface ForwardMessageModalProps {
  message: Message | null;
  onClose: () => void;
}

export const ForwardMessageModal = ({
  message,
  onClose,
}: ForwardMessageModalProps) => {
  const { conversations, sendMessage } = useChatStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [forwardingIds, setForwardingIds] = useState<Set<number>>(new Set());
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());

  // Reset state when forwarding a different message
  useEffect(() => {
    if (message) {
      setSentIds(new Set());
      setSearch("");
    }
  }, [message?.id]);

  if (!message || !user) return null;

  const getConvoName = (c: Conversation) => {
    if (c.type === "GROUP") return c.name;
    const other = c.participants.find((p) => p.userId !== user.id);
    return other?.displayName ?? "Người dùng";
  };

  const filteredConversations = conversations.filter((c) =>
    getConvoName(c)?.toLowerCase().includes(search.toLowerCase())
  );

  const handleForward = async (conversationId: number) => {
    if (sentIds.has(conversationId) || forwardingIds.has(conversationId)) return;
    try {
      setForwardingIds((prev) => new Set(prev).add(conversationId));

      // We forward content and attachments.
      // parentId is null because this is a new message in that conversation
      await sendMessage(
        conversationId,
        message.content || "",
        undefined,
        message.attachments || []
      );

      setSentIds((prev) => new Set(prev).add(conversationId));
      toast.success("Đã chuyển tiếp tin nhắn");
    } catch {
      toast.error("Không thể chuyển tiếp tin nhắn");
    } finally {
      setForwardingIds((prev) => {
        const next = new Set(prev);
        next.delete(conversationId);
        return next;
      });
    }
  };

  return (
    <Dialog open={!!message} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Chuyển tiếp tin nhắn</DialogTitle>
        </DialogHeader>
        <div className="p-4 bg-muted/30">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm trò chuyện..."
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="h-[40vh] overflow-y-auto space-y-1.5 beautiful-scrollbar pr-1">
            {filteredConversations.length > 0 ? (
              filteredConversations.map((c) => {
                const isGroup = c.type === "GROUP";
                const other = c.participants.find((p) => p.userId !== user.id);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2 hover:bg-muted/60 transition-colors rounded-lg bg-background border border-border/40"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {isGroup ? (
                        <div className="shrink-0 flex items-center justify-center">
                          <GroupChatAvatar participants={c.participants} type="sidebar" />
                        </div>
                      ) : (
                        <UserAvatar
                          type="sidebar"
                          name={other?.displayName ?? ""}
                          avatarUrl={other?.avatarUrl ?? undefined}
                        />
                      )}
                      <span className="font-medium text-sm truncate">
                        {getConvoName(c)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant={sentIds.has(c.id) ? "secondary" : "default"}
                      disabled={sentIds.has(c.id) || forwardingIds.has(c.id)}
                      onClick={() => handleForward(c.id)}
                      className="shrink-0 min-w-[70px]"
                    >
                      {sentIds.has(c.id) ? "Đã gửi" : "Gửi"}
                    </Button>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-sm text-muted-foreground mt-10">
                Không tìm thấy hội thoại nào
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
