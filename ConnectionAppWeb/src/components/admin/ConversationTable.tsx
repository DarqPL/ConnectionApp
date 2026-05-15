import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Lock, Unlock, Trash2, Users, Hash } from "lucide-react";
import { useAdminStore } from "@/stores/useAdminStore";
import type { AdminConversation } from "@/types/admin";
import { toast } from "sonner";
import { AdminPagination } from "./AdminPagination";

interface ConversationTableProps {
  conversations: AdminConversation[];
  loading: boolean;
  total: number;
  page: number;
  onRefresh: (params?: { type?: string; page?: number; limit?: number }) => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  PRIVATE: <Users className="h-4 w-4" />,
  GROUP: <Hash className="h-4 w-4" />,
};

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  LOCKED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  DELETED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

export function ConversationTable({
  conversations,
  loading,
  total,
  page,
  onRefresh,
}: ConversationTableProps) {
  const { lockConversation, unlockConversation, deleteConversation } = useAdminStore();
  const [typeFilter, setTypeFilter] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: string;
    conversation: AdminConversation | null;
  }>({ open: false, action: "", conversation: null });

  const applyFilters = useCallback(
    (overrides?: { type?: string; page?: number }) => {
      onRefresh({
        type: overrides?.type ?? typeFilter,
        page: (overrides?.page ?? page) + 1,
        limit: pageSize,
      });
    },
    [typeFilter, page, pageSize, onRefresh],
  );

  useEffect(() => {
    applyFilters({ page: 0 });
  }, [typeFilter]);

  const handlePageChange = (newPage: number) => {
    applyFilters({ page: newPage });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    onRefresh({ type: typeFilter, page: 1, limit: newSize });
  };

  const handleAction = async (action: string, convo: AdminConversation) => {
    try {
      if (action === "lock") {
        await lockConversation(convo.id);
        toast.success(`Locked "${convo.name}"`);
      } else if (action === "unlock") {
        await unlockConversation(convo.id);
        toast.success(`Unlocked "${convo.name}"`);
      } else if (action === "delete") {
        await deleteConversation(convo.id);
        toast.success(`Deleted "${convo.name}"`);
      }
    } catch {
      toast.error(`Failed to ${action} conversation`);
    }
    setConfirmDialog({ open: false, action: "", conversation: null });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          <option value="PRIVATE">Private</option>
          <option value="GROUP">Group</option>
        </select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Participants</TableHead>
            <TableHead>Creator</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Loading...
              </TableCell>
            </TableRow>
          ) : conversations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No conversations found
              </TableCell>
            </TableRow>
          ) : (
            conversations.map((convo) => (
              <TableRow key={convo.id}>
                <TableCell className="font-medium">{convo.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {typeIcons[convo.type]}
                    <span className="text-sm">{convo.type}</span>
                  </div>
                </TableCell>
                <TableCell>{convo.participantCount}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {convo.creatorName || "—"}
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[convo.status] || ""}>
                    {convo.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(convo.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {convo.status === "LOCKED" ? (
                        <DropdownMenuItem
                          onClick={() =>
                            setConfirmDialog({
                              open: true,
                              action: "unlock",
                              conversation: convo,
                            })
                          }
                        >
                          <Unlock className="mr-2 h-4 w-4" />
                          Unlock
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() =>
                            setConfirmDialog({
                              open: true,
                              action: "lock",
                              conversation: convo,
                            })
                          }
                        >
                          <Lock className="mr-2 h-4 w-4" />
                          Lock
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() =>
                          setConfirmDialog({
                            open: true,
                            action: "delete",
                            conversation: convo,
                          })
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <AdminPagination
        currentPage={page}
        pageSize={pageSize}
        totalItems={total}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog({ open, action: "", conversation: null })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.action === "lock"
                ? "Lock Conversation"
                : confirmDialog.action === "unlock"
                  ? "Unlock Conversation"
                  : "Delete Conversation"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === "lock"
                ? `Lock "${confirmDialog.conversation?.name}"? Users won't be able to send new messages.`
                : confirmDialog.action === "unlock"
                  ? `Unlock "${confirmDialog.conversation?.name}"? Users will be able to send messages again.`
                  : `Delete "${confirmDialog.conversation?.name}"? All messages will be soft-deleted.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog({ open: false, action: "", conversation: null })
              }
            >
              Cancel
            </Button>
            <Button
              variant={confirmDialog.action === "delete" ? "destructive" : "default"}
              onClick={() =>
                confirmDialog.action &&
                confirmDialog.conversation &&
                handleAction(confirmDialog.action, confirmDialog.conversation)
              }
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
