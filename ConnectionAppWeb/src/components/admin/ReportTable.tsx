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
import { Check, X, Eye } from "lucide-react";
import { useAdminStore } from "@/stores/useAdminStore";
import type { MessageReport } from "@/types/admin";
import { toast } from "sonner";

interface ReportTableProps {
  reports: MessageReport[];
  loading: boolean;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  RESOLVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  DISMISSED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

export function ReportTable({ reports, loading }: ReportTableProps) {
  const { resolveReport } = useAdminStore();
  const [statusFilter, setStatusFilter] = useState("");
  const [detailReport, setDetailReport] = useState<MessageReport | null>(null);

  const filtered = statusFilter
    ? reports.filter((r) => r.status === statusFilter)
    : reports;

  const handleResolve = async (reportId: number, action: "RESOLVED" | "DISMISSED") => {
    await resolveReport(reportId, action);
    toast.success(`Report ${action.toLowerCase()}`);
    setDetailReport(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reporter</TableHead>
            <TableHead>Reported User</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reported At</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
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
                No reports found
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="font-medium">{report.reporterName}</TableCell>
                <TableCell className="font-medium">{report.reportedUserName}</TableCell>
                <TableCell>
                  <Badge variant="outline">{report.reason}</Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                  {report.messageContent}
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[report.status] || ""}>
                    {report.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(report.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDetailReport(report)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {report.status === "PENDING" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600"
                          onClick={() => handleResolve(report.id, "RESOLVED")}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600"
                          onClick={() => handleResolve(report.id, "DISMISSED")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={!!detailReport} onOpenChange={() => setDetailReport(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
            <DialogDescription>
              Report #{detailReport?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Reporter</p>
                <p className="font-medium">{detailReport?.reporterName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Reported User</p>
                <p className="font-medium">{detailReport?.reportedUserName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Reason</p>
                <Badge variant="outline">{detailReport?.reason}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge className={statusColors[detailReport?.status || ""] || ""}>
                  {detailReport?.status}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Conversation</p>
                <p className="font-medium">{detailReport?.conversationName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Reported At</p>
                <p className="font-medium">
                  {detailReport?.createdAt
                    ? new Date(detailReport.createdAt).toLocaleString()
                    : ""}
                </p>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground text-sm mb-1">Reported Message</p>
              <div className="rounded-lg bg-muted p-3 text-sm">
                {detailReport?.messageContent}
              </div>
            </div>
          </div>
          {detailReport?.status === "PENDING" && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleResolve(detailReport.id, "DISMISSED")}
              >
                Dismiss
              </Button>
              <Button
                onClick={() => handleResolve(detailReport.id, "RESOLVED")}
              >
                Resolve
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
