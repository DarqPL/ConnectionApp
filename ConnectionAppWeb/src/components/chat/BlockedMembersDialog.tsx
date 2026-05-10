import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserCog, Ban } from "lucide-react";
import type { Conversation } from "@/types/chat";
import UserAvatar from "./UserAvatar";
import { chatService } from "@/services/chatService";
import { toast } from "sonner";

interface BlockedMembersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  onSettingsUpdated?: () => void;
}

export function BlockedMembersDialog({
  isOpen,
  onClose,
  conversation,
  onSettingsUpdated,
}: BlockedMembersDialogProps) {
  const [blockedMembers, setBlockedMembers] = useState<
    { userId: number; displayName: string; avatarUrl: string | null; username: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetchBlockedMembers();
  }, [isOpen, conversation.id]);

  const fetchBlockedMembers = async () => {
    setIsLoading(true);
    try {
      const data = await chatService.getBlockedMembers(conversation.id);
      setBlockedMembers(data || []);
    } catch {
      setBlockedMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblock = async (memberId: number) => {
    try {
      await chatService.unblockMember(conversation.id, memberId);
      setBlockedMembers((prev) => prev.filter((m) => m.userId !== memberId));
      onSettingsUpdated?.();
      toast.success("Đã bỏ chặn thành viên");
    } catch {
      toast.error("Không thể bỏ chặn");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="size-5" />
            Chặn khỏi nhóm
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-6 text-center">
          <UserCog className="size-16 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground max-w-xs">
            Những người đã bị chặn không thể tham gia lại nhóm, trừ khi được
            trưởng/phó nhóm bỏ chặn hoặc thêm lại vào nhóm.
          </p>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Đang tải...</p>
        ) : blockedMembers.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {blockedMembers.map((member) => (
              <div
                key={member.userId}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
              >
                <UserAvatar
                  type="chat"
                  name={member.displayName}
                  avatarUrl={member.avatarUrl || undefined}
                  className="size-8"
                />
                <span className="text-sm font-medium flex-1 truncate">
                  {member.displayName}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleUnblock(member.userId)}
                >
                  Bỏ chặn
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4 italic">
            Không có thành viên nào bị chặn
          </p>
        )}

        <DialogFooter>
          <Button variant="destructive" className="w-full" disabled>
            Thêm vào danh sách chặn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
