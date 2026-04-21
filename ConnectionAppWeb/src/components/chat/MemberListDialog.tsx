import { useState } from "react";
import type { Participant, Conversation } from "@/types/chat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import UserAvatar from "./UserAvatar";
import { MemberRoleDialog } from "./MemberRoleDialog";
import { Shield, Zap, UserMinus } from "lucide-react";

interface MemberListDialogProps {
  isOpen: boolean;
  conversation: Conversation;
  currentUserRole: string | null;
  currentUserId: number | null;
  conversationId: number;
  onClose: () => void;
  onRoleUpdate: (memberId: number, newRole: string) => Promise<void>;
  onRemoveMember: (memberId: number) => Promise<void>;
}

const getRoleIcon = (role: string) => {
  if (role === "OWNER") return <Shield className="size-4 text-amber-500" />;
  if (role === "CO_OWNER") return <Zap className="size-4 text-blue-500" />;
  return null;
};

const getRoleLabel = (role: string) => {
  if (role === "OWNER") return "Chủ nhóm";
  if (role === "CO_OWNER") return "Phó nhóm";
  return "Thành viên";
};

const getRoleBadgeColor = (role: string) => {
  if (role === "OWNER") return "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200";
  if (role === "CO_OWNER") return "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200";
  return "bg-secondary text-secondary-foreground";
};

export const MemberListDialog = ({
  isOpen,
  conversation,
  currentUserRole,
  currentUserId,
  conversationId,
  onClose,
  onRoleUpdate,
  onRemoveMember,
}: MemberListDialogProps) => {
  const [selectedMember, setSelectedMember] = useState<Participant | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);

  const canManageRoles = currentUserRole === "OWNER" || currentUserRole === "CO_OWNER";

  // Sort members by role (OWNER first, then CO_OWNER, then MEMBER)
  const sortedMembers = [...conversation.participants].sort((a, b) => {
    const roleOrder: Record<string, number> = { OWNER: 0, CO_OWNER: 1, MEMBER: 2 };
    return (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
  });

  const handleMemberClick = (member: Participant) => {
    if (canManageRoles && member.userId !== currentUserId) {
      setSelectedMember(member);
      setIsRoleDialogOpen(true);
    }
  };

  const handleRemoveClick = async (e: React.MouseEvent, member: Participant) => {
    e.stopPropagation();
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${member.displayName} khỏi nhóm?`)) {
      return;
    }

    try {
      await onRemoveMember(member.userId);
    } catch (err) {
      console.error("Failed to remove member:", err);
      alert("Không thể xóa thành viên");
    }
  };

  const canRemove = (member: Participant) => {
    if (member.userId === currentUserId) return false;
    if (currentUserRole === "OWNER") return true;
    if (currentUserRole === "CO_OWNER" && member.role === "MEMBER") return true;
    return false;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Danh sách thành viên ({conversation.participants.length})</DialogTitle>
            <DialogDescription>
              {canManageRoles 
                ? "Nhấp vào thành viên để thay đổi vai trò" 
                : "Xem danh sách tất cả thành viên trong nhóm"}
            </DialogDescription>
          </DialogHeader>

          <div className="h-96 overflow-y-auto pr-4 space-y-2">
            {sortedMembers.map((member) => (
              <div
                key={member.id}
                onClick={() => handleMemberClick(member)}
                className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${
                  canManageRoles
                    ? "cursor-pointer hover:bg-accent/70 border-border hover:border-primary/50"
                    : "border-border bg-background"
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <UserAvatar
                    type="chat"
                    name={member.displayName}
                    avatarUrl={member.avatarUrl || undefined}
                    className="size-10 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">
                        {member.displayName}
                      </p>
                      {getRoleIcon(member.role)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      @{member.username}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getRoleBadgeColor(member.role)}`}>
                    {getRoleLabel(member.role)}
                  </div>
                  
                  {canRemove(member) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleRemoveClick(e, member)}
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Member Role Dialog */}
      {selectedMember && (
        <MemberRoleDialog
          isOpen={isRoleDialogOpen}
          member={selectedMember}
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          conversationId={conversationId}
          onClose={() => {
            setIsRoleDialogOpen(false);
            setSelectedMember(null);
          }}
          onRoleUpdate={onRoleUpdate}
        />
      )}
    </>
  );
};
