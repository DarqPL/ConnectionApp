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
import { MoreHorizontal, Search, Lock, Unlock, Trash2, Shield, AlertTriangle } from "lucide-react";
import { useAdminStore } from "@/stores/useAdminStore";
import type { AdminUser } from "@/types/admin";
import { toast } from "sonner";
import { AdminPagination } from "./AdminPagination";

interface UserTableProps {
  users: AdminUser[];
  loading: boolean;
  total: number;
  page: number;
  onRefresh: (params?: { search?: string; status?: string; page?: number; limit?: number }) => void;
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

export function UserTable({ users, loading, total, page, onRefresh }: UserTableProps) {
  const { updateUserRole, lockUser, unlockUser, deleteUser } = useAdminStore();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: string;
    user: AdminUser | null;
  }>({ open: false, action: "", user: null });
  const [roleDialog, setRoleDialog] = useState<{
    open: boolean;
    user: AdminUser | null;
    newRole: string;
    confirmText: string;
  }>({ open: false, user: null, newRole: "", confirmText: "" });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const applyFilters = useCallback(
    (overrides?: { search?: string; status?: string; page?: number }) => {
      onRefresh({
        search: overrides?.search ?? debouncedSearch,
        status: overrides?.status ?? statusFilter,
        page: (overrides?.page ?? page) + 1,
        limit: pageSize,
      });
    },
    [debouncedSearch, statusFilter, page, pageSize, onRefresh],
  );

  useEffect(() => {
    applyFilters({ page: 0 });
  }, [debouncedSearch, statusFilter]);

  const handlePageChange = (newPage: number) => {
    applyFilters({ page: newPage });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    onRefresh({ search: debouncedSearch, status: statusFilter, page: 1, limit: newSize });
  };

  const handleAction = async (action: string, user: AdminUser) => {
    try {
      if (action === "lock") {
        await lockUser(user.id);
        toast.success(`Locked ${user.displayName}`);
      } else if (action === "unlock") {
        await unlockUser(user.id);
        toast.success(`Unlocked ${user.displayName}`);
      } else if (action === "delete") {
        await deleteUser(user.id);
        toast.success(`Deleted ${user.displayName}`);
      }
    } catch {
      toast.error(`Failed to ${action} user`);
    }
    setConfirmDialog({ open: false, action: "", user: null });
  };

  const openRoleDialog = (user: AdminUser, newRole: string) => {
    setRoleDialog({
      open: true,
      user,
      newRole,
      confirmText: "",
    });
  };

  const handleRoleChange = async () => {
    if (!roleDialog.user) return;

    const expectedText =
      roleDialog.newRole === "ADMIN"
        ? `MAKE ${roleDialog.user.username} ADMIN`
        : `REMOVE ${roleDialog.user.username} ADMIN`;

    if (roleDialog.confirmText !== expectedText) {
      toast.error("Confirmation text does not match");
      return;
    }

    try {
      await updateUserRole(roleDialog.user.id, roleDialog.newRole);
      toast.success(
        roleDialog.newRole === "ADMIN"
          ? `${roleDialog.user.displayName} is now admin`
          : `${roleDialog.user.displayName} is now user`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update role";
      toast.error(message);
    }
    setRoleDialog({ open: false, user: null, newRole: "", confirmText: "" });
  };

  const expectedConfirmText =
    roleDialog.newRole === "ADMIN"
      ? `MAKE ${roleDialog.user?.username} ADMIN`
      : `REMOVE ${roleDialog.user?.username} ADMIN`;

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
          ) : users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No users found
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
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
                          onClick={() => openRoleDialog(user, "USER")}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Remove Admin
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => openRoleDialog(user, "ADMIN")}
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

      <Dialog
        open={roleDialog.open}
        onOpenChange={(open) => {
          if (!open) setRoleDialog({ open: false, user: null, newRole: "", confirmText: "" });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {roleDialog.newRole === "ADMIN" ? "Grant Admin Role" : "Remove Admin Role"}
            </DialogTitle>
            <DialogDescription>
              {roleDialog.newRole === "ADMIN"
                ? `You are about to grant admin privileges to ${roleDialog.user?.displayName}. Admins have full access to the admin dashboard.`
                : `You are about to remove admin privileges from ${roleDialog.user?.displayName}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Type the following to confirm:
            </p>
            <code className="block rounded bg-muted px-3 py-2 text-sm font-mono">
              {expectedConfirmText}
            </code>
            <Input
              placeholder="Type confirmation here..."
              value={roleDialog.confirmText}
              onChange={(e) =>
                setRoleDialog((prev) => ({ ...prev, confirmText: e.target.value }))
              }
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setRoleDialog({ open: false, user: null, newRole: "", confirmText: "" })
              }
            >
              Cancel
            </Button>
            <Button
              variant={roleDialog.newRole === "USER" ? "destructive" : "default"}
              onClick={handleRoleChange}
              disabled={roleDialog.confirmText !== expectedConfirmText}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
