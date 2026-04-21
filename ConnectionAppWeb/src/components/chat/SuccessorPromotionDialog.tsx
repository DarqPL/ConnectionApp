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
import type { Conversation, Participant } from "@/types/chat";

interface SuccessorPromotionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  currentUserId: number;
  coOwner: Participant | null;
  onPromotionComplete?: () => void;
}

type SuccessionMode = "auto-promote" | "select-other";

export const SuccessorPromotionDialog = ({
  isOpen,
  onClose,
  conversation,
  currentUserId,
  coOwner,
  onPromotionComplete,
}: SuccessorPromotionDialogProps) => {
  const [mode, setMode] = useState<SuccessionMode>("auto-promote");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get eligible members (excluding current user and CO_OWNER if auto-promote selected)
  const otherMembers = conversation.participants.filter(
    (p) => p.userId !== currentUserId && p.role !== "OWNER" && (mode === "select-other" ? p.userId !== coOwner?.userId : true)
  );

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      if (mode === "auto-promote" && coOwner) {
        // Auto-promote CO_OWNER to OWNER
        await chatService.updateMemberRole(conversation.id, coOwner.userId, "OWNER");
        toast.success(`${coOwner.displayName} đã được nâng lên làm nhóm trưởng`);
      } else if (mode === "select-other" && selectedMemberId) {
        // Manually select another member
        await chatService.updateMemberRole(conversation.id, selectedMemberId, "OWNER");
        const selectedMember = conversation.participants.find(p => p.userId === selectedMemberId);
        toast.success(`${selectedMember?.displayName} đã được nâng lên làm nhóm trưởng`);
      } else {
        toast.error("Vui lòng chọn một người để làm nhóm trưởng");
        return;
      }

      onPromotionComplete?.();
      onClose();
    } catch (error) {
      console.error("Lỗi nâng cấp nhóm phó:", error);
      toast.error("Không thể nâng cấp nhóm phó");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chọn nhóm trưởng tiếp theo</DialogTitle>
          <DialogDescription>
            Bạn sắp rời khỏi nhóm. Vui lòng chọn ai sẽ làm nhóm trưởng tiếp theo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Auto-promote CO_OWNER option */}
          {coOwner && (
            <div className="space-y-3 mb-4">
              <button
                onClick={() => setMode("auto-promote")}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                  mode === "auto-promote"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 bg-transparent"
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  mode === "auto-promote" ? "border-primary" : "border-border"
                }`}>
                  {mode === "auto-promote" && (
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                  )}
                </div>
                <span className="font-medium">Tự động nâng cấp nhóm phó</span>
              </button>
              <div className="ml-6 p-3 rounded-lg border-2 border-primary/30 bg-primary/5">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    type="chat"
                    name={coOwner.displayName}
                    avatarUrl={coOwner.avatarUrl || undefined}
                    className="size-10"
                  />
                  <div>
                    <p className="font-medium text-sm">{coOwner.displayName}</p>
                    <p className="text-xs text-muted-foreground">Nhóm phó hiện tại</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Manual selection option */}
          <div className="space-y-3">
            <button
              onClick={() => setMode("select-other")}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                mode === "select-other"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 bg-transparent"
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                mode === "select-other" ? "border-primary" : "border-border"
              }`}>
                {mode === "select-other" && (
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                )}
              </div>
              <span className="font-medium">Chọn thành viên khác</span>
            </button>

            {mode === "select-other" && (
              <div className="ml-6 space-y-2 max-h-96 overflow-y-auto">
                {otherMembers.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground">
                    <p className="text-sm">Không có thành viên khác để chọn</p>
                  </div>
                ) : (
                  otherMembers.map((member) => (
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
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Đang xử lý..." : "Xác nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
