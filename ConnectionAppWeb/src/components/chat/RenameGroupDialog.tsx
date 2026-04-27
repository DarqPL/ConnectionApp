import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { chatService } from "@/services/chatService";
import { useChatStore } from "@/stores/useChatStore";
import { toast } from "sonner";

interface RenameGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string | null | undefined;
  conversationId: number;
}

export const RenameGroupDialog = ({
  isOpen,
  onClose,
  currentName,
  conversationId,
}: RenameGroupDialogProps) => {
  const normalizedCurrentName = currentName ?? "";
  const [name, setName] = useState(normalizedCurrentName);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(normalizedCurrentName);
    }
  }, [isOpen, normalizedCurrentName]);

  const handleRename = async () => {
    const trimmedName = (name ?? "").trim();
    if (!trimmedName || trimmedName === normalizedCurrentName) {
      onClose();
      return;
    }

    setIsLoading(true);
    try {
      const updated = await chatService.updateConversation(conversationId, {
        name: trimmedName,
      });
      useChatStore.getState().updateConversation(updated);
      toast.success("Đã đổi tên nhóm thành công");
      onClose();
    } catch (error) {
      console.error("Lỗi đổi tên nhóm:", error);
      toast.error("Không thể đổi tên nhóm");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Đổi tên nhóm</DialogTitle>
          <DialogDescription>
            Nhập tên mới cho cuộc trò chuyện nhóm của bạn.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Tên nhóm</Label>
            <Input
              id="name"
              value={name ?? ""}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên nhóm..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Hủy
          </Button>
          <Button 
            onClick={handleRename} 
            disabled={
              isLoading ||
              !(name ?? "").trim() ||
              (name ?? "").trim() === normalizedCurrentName
            }
          >
            {isLoading ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
