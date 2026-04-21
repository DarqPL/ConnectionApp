import { useState } from "react";
import type { Participant } from "@/types/chat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import UserAvatar from "./UserAvatar";
import { AlertCircle, ChevronDown } from "lucide-react";

interface MemberRoleDialogProps {
  isOpen: boolean;
  member: Participant | null;
  currentUserRole: string | null;
  currentUserId: number | null;
  conversationId: number;
  onClose: () => void;
  onRoleUpdate: (memberId: number, newRole: string) => Promise<void>;
}

const roleDescriptions: Record<string, string> = {
  OWNER: "Chủ nhóm - Có quyền quản lý nhóm hoàn toàn",
  CO_OWNER: "Phó nhóm - Có quyền quản lý thành viên như chủ nhóm",
  MEMBER: "Thành viên - Quyền hạn tiêu chuẩn",
};

export const MemberRoleDialog = ({
  isOpen,
  member,
  currentUserRole,
  currentUserId,
  onClose,
  onRoleUpdate,
}: MemberRoleDialogProps) => {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedRole(null);
      onClose();
    }
  };

  // Determine available roles
  const getAvailableRoles = () => {
    if (!currentUserRole) return [];
    
    if (currentUserRole === "OWNER") {
      return ["CO_OWNER", "MEMBER"];
    }
    if (currentUserRole === "CO_OWNER") {
      return ["MEMBER"];
    }
    return [];
  };

  const availableRoles = getAvailableRoles();
  const isCurrentUserOwner = currentUserRole === "OWNER";
  const isCurrentUserCoOwner = currentUserRole === "CO_OWNER";

  const handleSaveRole = async () => {
    if (!member || !selectedRole) {
      toast.error("Vui lòng chọn một vai trò");
      return;
    }

    // Prevent users from changing their own role
    if (member.userId === currentUserId) {
      toast.error("Không thể thay đổi vai trò của chính mình");
      return;
    }

    setIsLoading(true);
    try {
      await onRoleUpdate(member.userId, selectedRole);
      toast.success(`Đã cập nhật vai trò của ${member.displayName}`);
      handleOpenChange(false);
    } catch (error) {
      console.error("Lỗi cập nhật vai trò:", error);
      toast.error("Không thể cập nhật vai trò");
    } finally {
      setIsLoading(false);
    }
  };

  if (!member) return null;

  const canManageRoles = isCurrentUserOwner || isCurrentUserCoOwner;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quản lý vai trò thành viên</DialogTitle>
          <DialogDescription>
            Thay đổi vai trò và quyền hạn của thành viên trong nhóm
          </DialogDescription>
        </DialogHeader>

        {/* Member Info */}
        <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-lg">
          <UserAvatar
            type="chat"
            name={member.displayName}
            avatarUrl={member.avatarUrl || undefined}
            className="size-12"
          />
          <div className="flex-1">
            <p className="font-semibold">{member.displayName}</p>
            <p className="text-sm text-muted-foreground">@{member.username}</p>
          </div>
        </div>

        {/* Current Role Info */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Vai trò hiện tại</label>
          <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p className="font-medium text-sm">{member.role}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {roleDescriptions[member.role] || "Không xác định"}
            </p>
          </div>
        </div>

        {/* Role Selector */}
        {canManageRoles ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">Thay đổi vai trò thành</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                >
                  {selectedRole || "Chọn vai trò mới"}
                  <ChevronDown className="size-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Chọn vai trò</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={selectedRole || ""} onValueChange={setSelectedRole}>
                  {availableRoles.map((role) => (
                    <DropdownMenuRadioItem key={role} value={role}>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{role}</span>
                        <span className="text-xs text-muted-foreground">
                          {roleDescriptions[role]}
                        </span>
                      </div>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {selectedRole && selectedRole !== member.role && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg flex gap-2">
                <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-200">
                  {selectedRole === "CO_OWNER"
                    ? "Thành viên này sẽ có quyền quản lý nhóm tương tự như bạn"
                    : "Thành viên này sẽ trở lại thành viên thường"}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 bg-secondary/30 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              Bạn không có quyền thay đổi vai trò thành viên
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Đóng
          </Button>
          {canManageRoles && selectedRole && selectedRole !== member.role && (
            <Button
              onClick={handleSaveRole}
              disabled={isLoading || !selectedRole || selectedRole === member.role}
              className="bg-primary hover:bg-primary/90"
            >
              {isLoading ? "Đang cập nhật..." : "Cập nhật vai trò"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
