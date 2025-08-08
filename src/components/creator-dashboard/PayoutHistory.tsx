import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { useQuery } from "convex/react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { EmptyState } from "../ui/empty-state";
import { LoadingSpinner } from "../ui/loading-spinner";

export function PayoutHistory() {
  const payoutHistory = useQuery(api.payoutHelpers.getCreatorPayouts);

  if (payoutHistory === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>View your past payout transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-32">
            <LoadingSpinner />
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
            <Clock className="w-3 h-3 mr-1" />
            Processing
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payout History</CardTitle>
        <CardDescription>
          View your past payout transactions and their status
        </CardDescription>
      </CardHeader>
      <CardContent>
        {payoutHistory.length === 0 ? (
          <EmptyState
            title="No Payouts Yet"
            description="Your payout history will appear here once you request your first payout."
          />
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {/* <TableHead>Campaigns</TableHead> */}
                  <TableHead className="text-center">Submissions</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutHistory.map((payout) => (
                  <TableRow key={payout._id}>
                    <TableCell>
                      {new Date(payout.createdAt).toLocaleDateString()}
                    </TableCell>
                    {/* <TableCell className="max-w-[200px]">
                      <div className="truncate" title={payout.campaignTitles.join(", ")}>
                        {payout.campaignTitles.length > 0
                          ? payout.campaignTitles.join(", ")
                          : "Multiple campaigns"}
                      </div>
                    </TableCell> */}
                    <TableCell className="text-center">
                      {payout.submissionCount}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(payout.status)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCurrency(payout.amount / 100)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
