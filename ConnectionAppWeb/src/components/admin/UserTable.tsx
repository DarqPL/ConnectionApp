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
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, Search, Lock, Unlock, Trash2, Shield } from "lucide-react";
import { useAdminStore } from "@/stores/useAdminStore";
import type { AdminUser } from "@/types/admin";
import { toast } from "sonner";

interface UserTableProps {
  users: AdminUser[];
  loading: boolean;
  onRefresh: () => void;
}

const statusColors: Record<string, string> = {
  ONLINE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  OFFLINE: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  LOCKED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  DELETED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

const roleColors: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  USER: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
};

export function UserTable({ users, loading }: UserTableProps) {
  const { updateUserStatus, updateUserRole, deleteUser } = useAdminStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: string;
    user: AdminUser | null;
  }>({ open: false, action: "", user: null });

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || u.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleAction = async (action: string, user: AdminUser) => {
    if (action === "lock") {
      await updateUserStatus(user.id, "LOCKED");
      toast.success(`Locked ${user.displayName}`);
    } else if (action === "unlock") {
      await updateUserStatus(user.id, "OFFLINE");
      toast.success(`Unlocked ${user.displayName}`);
    } else if (action === "delete") {
      await deleteUser(user.id);
      toast.success(`Deleted ${user.displayName}`);
    } else if (action === "make-admin") {
      await updateUserRole(user.id, "ADMIN");
      toast.success(`${user.displayName} is now admin`);
    } else if (action === "make-user") {
      await updateUserRole(user.id, "USER");
      toast.success(`${user.displayName} is now user`);
    }
    setConfirmDialog({ open: false, action: "", user: null });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="ONLINE">Online</option>
          <option value="OFFLINE">Offline</option>
          <option value="LOCKED">Locked</option>
        </select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
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
                No users found
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatarUrl} />
                      <AvatarFallback>
                        {user.displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.displayName}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{user.username}</TableCell>
                <TableCell className="text-sm">{user.email}</TableCell>
                <TableCell>
                  <Badge className={roleColors[user.role] || ""}>{user.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[user.status] || ""}>
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {user.status === "LOCKED" ? (
                        <DropdownMenuItem
                          onClick={() => handleAction("unlock", user)}
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
                              user,
                            })
                          }
                        >
                          <Lock className="mr-2 h-4 w-4" />
                          Lock
                        </DropdownMenuItem>
                      )}
                      {user.role === "ADMIN" ? (
                        <DropdownMenuItem
                          onClick={() => handleAction("make-user", user)}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Remove Admin
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => handleAction("make-admin", user)}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Make Admin
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() =>
                          setConfirmDialog({
                            open: true,
                            action: "delete",
                            user,
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
          setConfirmDialog({ open, action: "", user: null })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.action === "lock"
                ? "Lock User"
                : confirmDialog.action === "delete"
                  ? "Delete User"
                  : "Confirm Action"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === "lock"
                ? `Are you sure you want to lock ${confirmDialog.user?.displayName}?`
                : confirmDialog.action === "delete"
                  ? `Are you sure you want to delete ${confirmDialog.user?.displayName}? This action cannot be undone.`
                  : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog({ open: false, action: "", user: null })
              }
            >
              Cancel
            </Button>
            <Button
              variant={confirmDialog.action === "delete" ? "destructive" : "default"}
              onClick={() =>
                confirmDialog.action &&
                confirmDialog.user &&
                handleAction(confirmDialog.action, confirmDialog.user)
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
