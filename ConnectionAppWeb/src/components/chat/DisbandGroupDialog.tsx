import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/types/chat";

interface DisbandGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  onDisband: () => Promise<void>;
}

export function DisbandGroupDialog({
  isOpen,
  onClose,
  conversation,
  onDisband,
}: DisbandGroupDialogProps) {
  const handleDisband = async () => {
    await onDisband();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Giải tán nhóm</DialogTitle>
        </DialogHeader>
        <DialogDescription className="text-sm text-muted-foreground">
          Mời tất cả mọi người rời nhóm và xóa tin nhắn? Nhóm đã giải tán sẽ{" "}
          <strong>KHÔNG THỂ</strong> khôi phục.
        </DialogDescription>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Không
          </Button>
          <Button variant="destructive" onClick={handleDisband}>
            Giải tán nhóm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
