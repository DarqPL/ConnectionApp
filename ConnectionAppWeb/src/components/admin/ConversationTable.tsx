import { useState } from "react";
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
import { MoreHorizontal, Lock, Trash2, Users, Hash } from "lucide-react";
import { useAdminStore } from "@/stores/useAdminStore";
import type { AdminConversation } from "@/types/admin";
import { toast } from "sonner";

interface ConversationTableProps {
  conversations: AdminConversation[];
  loading: boolean;
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

export function ConversationTable({ conversations, loading }: ConversationTableProps) {
  const { lockConversation, deleteConversation } = useAdminStore();
  const [typeFilter, setTypeFilter] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: string;
    conversation: AdminConversation | null;
  }>({ open: false, action: "", conversation: null });

  const filtered = typeFilter
    ? conversations.filter((c) => c.type === typeFilter)
    : conversations;

  const handleAction = async (action: string, convo: AdminConversation) => {
    if (action === "lock") {
      await lockConversation(convo.id);
      toast.success(`Locked conversation "${convo.name}"`);
    } else if (action === "delete") {
      await deleteConversation(convo.id);
      toast.success(`Deleted conversation "${convo.name}"`);
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
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No conversations found
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((convo) => (
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
                      {convo.status !== "LOCKED" && (
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
                : "Delete Conversation"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === "lock"
                ? `Lock "${confirmDialog.conversation?.name}"? Users won't be able to send new messages.`
                : `Delete "${confirmDialog.conversation?.name}"? This action cannot be undone.`}
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
              variant="destructive"
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
