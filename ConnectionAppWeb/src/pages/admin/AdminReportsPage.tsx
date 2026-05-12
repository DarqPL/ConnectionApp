import { useEffect } from "react";
import { useAdminStore } from "@/stores/useAdminStore";
import { ReportTable } from "@/components/admin/ReportTable";

export default function AdminReportsPage() {
  const { reports, loading, fetchReports } = useAdminStore();

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Report Management</h2>
        <p className="text-muted-foreground">
          Review and manage user-reported messages.
        </p>
      </div>
      <ReportTable reports={reports} loading={loading} />
    </div>
  );
}
