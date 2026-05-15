import { useEffect } from "react";
import { useAdminStore } from "@/stores/useAdminStore";
import { UserTable } from "@/components/admin/UserTable";

export default function AdminUsersPage() {
  const { users, loading, userTotal, userPage, fetchUsers } = useAdminStore();

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
        <p className="text-muted-foreground">
          Manage all registered users in the system.
        </p>
      </div>
      <UserTable
        users={users}
        loading={loading}
        total={userTotal}
        page={userPage}
        onRefresh={fetchUsers}
      />
    </div>
  );
}
