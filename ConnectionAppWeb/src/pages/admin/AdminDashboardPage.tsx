import { useEffect } from "react";
import { useAdminStore } from "@/stores/useAdminStore";
import { StatCard } from "@/components/admin/StatCard";
import {
  Users,
  UserCheck,
  Lock,
  MessageSquare,
  Flag,
  AlertCircle,
} from "lucide-react";

export default function AdminDashboardPage() {
  const { stats, fetchStats } = useAdminStore();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your application.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers ?? 0}
          icon={Users}
        />
        <StatCard
          title="Active Users"
          value={stats?.activeUsers ?? 0}
          icon={UserCheck}
          iconClassName="bg-green-100 dark:bg-green-900"
        />
        <StatCard
          title="Locked Users"
          value={stats?.lockedUsers ?? 0}
          icon={Lock}
          iconClassName="bg-red-100 dark:bg-red-900"
        />
        <StatCard
          title="Conversations"
          value={stats?.totalConversations ?? 0}
          icon={MessageSquare}
        />
        <StatCard
          title="Total Reports"
          value={stats?.totalReports ?? 0}
          icon={Flag}
        />
        <StatCard
          title="Pending Reports"
          value={stats?.pendingReports ?? 0}
          icon={AlertCircle}
          iconClassName="bg-yellow-100 dark:bg-yellow-900"
        />
      </div>
    </div>
  );
}
