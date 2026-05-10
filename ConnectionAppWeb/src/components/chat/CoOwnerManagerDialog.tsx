import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import type { Conversation } from "@/types/chat";
import UserAvatar from "./UserAvatar";
import { useChatStore } from "@/stores/useChatStore";
import { chatService } from "@/services/chatService";
import { toast } from "sonner";

interface CoOwnerManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  currentUserId: number;
}

export function CoOwnerManagerDialog({
  isOpen,
  onClose,
  conversation,
  currentUserId,
}: CoOwnerManagerDialogProps) {
  const fetchConversationById = useChatStore((s) => s.fetchConversationById);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"manage" | "add">("manage");

  const owner = useMemo(
    () => conversation.participants.find((p) => p.role === "OWNER"),
    [conversation.participants]
  );
  const coOwners = useMemo(
    () => conversation.participants.filter((p) => p.role === "CO_OWNER"),
    [conversation.participants]
  );
  const regularMembers = useMemo(
    () => conversation.participants.filter((p) => p.role === "MEMBER"),
    [conversation.participants]
  );

  const filteredMembers = useMemo(() => {
    const list = mode === "add" ? regularMembers : coOwners;
    if (!search.trim()) return list;
    return list.filter((m) =>
      m.displayName.toLowerCase().includes(search.toLowerCase())
    );
  }, [regularMembers, coOwners, search, mode]);

  const toggleSelect = (userId: number) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) return;
    setIsLoading(true);
    try {
      if (mode === "add") {
        await chatService.addCoOwners(conversation.id, selectedIds);
        toast.success(`Đã thêm ${selectedIds.length} phó nhóm`);
      } else {
        for (const id of selectedIds) {
          await chatService.removeCoOwner(conversation.id, id);
        }
        toast.success(`Đã xoá ${selectedIds.length} phó nhóm`);
      }
      await fetchConversationById(conversation.id);
      setSelectedIds([]);
      onClose();
    } catch {
      toast.error("Không thể cập nhật phó nhóm");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCoOwner = async (memberId: number) => {
    setIsLoading(true);
    try {
      await chatService.removeCoOwner(conversation.id, memberId);
      await fetchConversationById(conversation.id);
      toast.success("Đã xoá phó nhóm");
    } catch {
      toast.error("Không thể xoá phó nhóm");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransferOwnership = () => {
    // Will be handled by existing TransferOwnershipDialog
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Trưởng & phó nhóm</DialogTitle>
        </DialogHeader>

        {/* Owner display */}
        {owner && (
          <div className="flex items-center gap-3 py-2 border-b border-border">
            <UserAvatar
              type="chat"
              name={owner.displayName}
              avatarUrl={owner.avatarUrl || undefined}
              className="size-10"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{owner.displayName}</p>
              <p className="text-xs text-muted-foreground">Trưởng nhóm</p>
            </div>
          </div>
        )}

        {/* Co-owners list */}
        {coOwners.length > 0 && (
          <div className="space-y-2 py-2 border-b border-border">
            {coOwners.map((co) => (
              <div key={co.userId} className="flex items-center gap-3">
                <UserAvatar
                  type="chat"
                  name={co.displayName}
                  avatarUrl={co.avatarUrl || undefined}
                  className="size-8"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{co.displayName}</p>
                  <p className="text-xs text-muted-foreground">Phó nhóm</p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs px-3"
                  onClick={() => handleRemoveCoOwner(co.userId)}
                  disabled={isLoading}
                >
                  Xoá
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2 py-2">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setMode("add");
              setSelectedIds([]);
            }}
          >
            Thêm phó nhóm
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleTransferOwnership}
          >
            Chuyển quyền trưởng nhóm
          </Button>
        </div>

        {/* Add co-owner selection (shown when mode === "add") */}
        {mode === "add" && (
          <div className="flex-1 overflow-hidden flex flex-col mt-2">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm thành viên"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {filteredMembers.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer"
                  onClick={() => toggleSelect(member.userId)}
                >
                  <Checkbox
                    checked={selectedIds.includes(member.userId)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds((prev) => [...prev, member.userId]);
                      } else {
                        setSelectedIds((prev) => prev.filter((id) => id !== member.userId));
                      }
                    }}
                  />
                  <UserAvatar
                    type="chat"
                    name={member.displayName}
                    avatarUrl={member.avatarUrl || undefined}
                    className="size-8"
                  />
                  <span className="text-sm font-medium">{member.displayName}</span>
                </div>
              ))}
              {filteredMembers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Không có thành viên nào
                </p>
              )}
            </div>
            <DialogFooter className="mt-3 gap-2">
              <Button variant="outline" onClick={() => { setMode("manage"); setSelectedIds([]); }}>
                Huỷ
              </Button>
              <Button onClick={handleConfirm} disabled={selectedIds.length === 0 || isLoading}>
                {isLoading ? "Đang xử lý..." : "Xác nhận"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
