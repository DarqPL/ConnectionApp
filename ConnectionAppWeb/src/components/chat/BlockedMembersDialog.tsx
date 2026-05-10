import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserCog, Ban } from "lucide-react";
import type { Conversation, Participant } from "@/types/chat";
import UserAvatar from "./UserAvatar";
import { chatService } from "@/services/chatService";
import { toast } from "sonner";

interface BlockedMembersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
}

export function BlockedMembersDialog({
  isOpen,
  onClose,
  conversation,
}: BlockedMembersDialogProps) {
  const blockedMembers = conversation.blockedMembers || [];

  const handleUnblock = async (memberId: number) => {
    try {
      await chatService.unblockMember(conversation.id, memberId);
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

        {blockedMembers.length > 0 && (
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
