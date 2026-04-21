import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import UserAvatar from "./UserAvatar";
import { toast } from "sonner";
import { chatService } from "@/services/chatService";
import type { Conversation } from "@/types/chat";

interface TransferOwnershipDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  currentUserId: number;
  onTransferComplete?: () => void;
}

export const TransferOwnershipDialog = ({
  isOpen,
  onClose,
  conversation,
  currentUserId,
  onTransferComplete,
}: TransferOwnershipDialogProps) => {
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filter out current user and show only members who can become owner
  const eligibleMembers = conversation.participants.filter(
    (p) => p.userId !== currentUserId && p.role !== "OWNER"
  );

  const handleTransfer = async () => {
    if (!selectedMemberId) {
      toast.error("Vui lòng chọn người để nhận quyền quản lý nhóm");
      return;
    }

    setIsLoading(true);
    try {
      // Transfer ownership
      await chatService.updateMemberRole(conversation.id, selectedMemberId, "OWNER");
      toast.success("Đã chuyển quyền quản lý nhóm thành công");
      onTransferComplete?.();
      onClose();
    } catch (error) {
      console.error("Lỗi chuyển quyền:", error);
      toast.error("Không thể chuyển quyền quản lý nhóm");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chuyển quyền quản lý nhóm</DialogTitle>
          <DialogDescription>
            Vui lòng chọn một thành viên để nhận quyền quản lý nhóm "{conversation.name}" trước khi bạn rời khỏi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {eligibleMembers.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              <p className="text-sm">Không có thành viên khác để chuyển quyền</p>
            </div>
          ) : (
            eligibleMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => setSelectedMemberId(member.userId)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                  selectedMemberId === member.userId
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 bg-transparent"
                }`}
              >
                <UserAvatar
                  type="chat"
                  name={member.displayName}
                  avatarUrl={member.avatarUrl || undefined}
                  className="size-10"
                />
                <div className="flex-1 text-left min-w-0">
                  <p className="font-medium text-sm truncate">{member.displayName}</p>
                  <p className="text-xs text-muted-foreground uppercase">{member.role}</p>
                </div>
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Hủy
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={isLoading || !selectedMemberId}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading ? "Đang xử lý..." : "Chuyển quyền"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
