import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  TrendingUp,
  Video,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ViewChart } from "./ViewChart";
import { ViewTracker } from "./ViewTracker";

// Define a more specific type for submissions from the query
type Submission = {
  _id: Id<"submissions">;
  creatorName: string;
  tiktokUsername: string;
  tiktokUrl: string;
  status: "pending" | "approved" | "rejected";
  hasReachedThreshold: boolean;
  potentialEarnings: number;
  submittedAt: number;
  earnings?: number;
  rejectionReason?: string;
};

interface SubmissionsReviewModalProps {
  campaignId: string;
  onClose: () => void;
}

export function SubmissionsReviewModal({
  campaignId,
  onClose,
}: SubmissionsReviewModalProps) {
  const [rejectionCandidate, setRejectionCandidate] =
    useState<Submission | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<
    string | null
  >(null);

  const submissions = useQuery(api.submissions.getCampaignSubmissions, {
    campaignId: campaignId as Id<"campaigns">,
  }) as Submission[] | undefined;

  const updateSubmissionStatus = useMutation(
    api.submissions.updateSubmissionStatus
  );

  const handleApprove = async (submissionId: Id<"submissions">) => {
    try {
      await updateSubmissionStatus({ submissionId, status: "approved" });
      toast.success("Submission approved!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to approve submission"
      );
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectionCandidate || !rejectionReason.trim()) {
      toast.error("A rejection reason is required.");
      return;
    }
    try {
      await updateSubmissionStatus({
        submissionId: rejectionCandidate._id,
        status: "rejected",
        rejectionReason: rejectionReason.trim(),
      });
      toast.success("Submission rejected");
      setRejectionCandidate(null);
      setRejectionReason("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reject submission"
      );
    }
  };

  const { pendingSubmissions, reviewedSubmissions } = useMemo(() => {
    if (!submissions)
      return { pendingSubmissions: [], reviewedSubmissions: [] };
    const pending = submissions.filter((s) => s.status === "pending");
    const reviewed = submissions.filter((s) => s.status !== "pending");
    return { pendingSubmissions: pending, reviewedSubmissions: reviewed };
  }, [submissions]);

  const isLoading = submissions === undefined;

  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-6xl w-full max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Submissions</DialogTitle>
          <DialogDescription>
            Approve or reject creator submissions for your campaign.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (submissions ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <Video className="h-16 w-16 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No Submissions Yet</h3>
            <p className="text-muted-foreground text-sm">
              Submissions will appear here once creators respond.
            </p>
          </div>
        ) : (
          <Tabs
            defaultValue="pending"
            className="flex-grow flex flex-col overflow-hidden"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pending">
                Pending ({pendingSubmissions.length})
              </TabsTrigger>
              <TabsTrigger value="reviewed">
                Reviewed ({reviewedSubmissions.length})
              </TabsTrigger>
            </TabsList>
            <div className="flex-grow overflow-y-auto">
              <TabsContent value="pending" className="mt-4">
                <SubmissionsTable
                  submissions={pendingSubmissions}
                  onApprove={handleApprove}
                  onReject={setRejectionCandidate}
                  expandedId={expandedSubmissionId}
                  onToggleExpand={setExpandedSubmissionId}
                />
              </TabsContent>
              <TabsContent value="reviewed" className="mt-4">
                <SubmissionsTable
                  submissions={reviewedSubmissions}
                  expandedId={expandedSubmissionId}
                  onToggleExpand={setExpandedSubmissionId}
                />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>

      {rejectionCandidate && (
        <AlertDialog
          open={!!rejectionCandidate}
          onOpenChange={(isOpen) => !isOpen && setRejectionCandidate(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject Submission?</AlertDialogTitle>
              <AlertDialogDescription>
                Provide feedback for{" "}
                <strong>{rejectionCandidate.creatorName}</strong> to help them
                improve. This reason will be shared with the creator.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="rejectionReason">
                Rejection Reason (Required)
              </Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Video quality is poor, content doesn't align with brand..."
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setRejectionReason("")}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  void handleRejectConfirm();
                }}
                disabled={!rejectionReason.trim()}
              >
                Confirm Rejection
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Dialog>
  );
}

function SubmissionsTable({
  submissions,
  onApprove,
  onReject,
  expandedId,
  onToggleExpand,
}: {
  submissions: Submission[];
  onApprove?: (id: Id<"submissions">) => Promise<void>;
  onReject?: (sub: Submission) => void;
  expandedId: string | null;
  onToggleExpand: (id: string | null) => void;
}) {
  if (submissions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No submissions in this category.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Creator</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Earned</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((sub) => (
            <>
              <TableRow key={sub._id}>
                <TableCell className="font-medium">
                  <div>{sub.creatorName}</div>
                  <a
                    href={`https://tiktok.com/@${sub.tiktokUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    @{sub.tiktokUsername}
                  </a>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      sub.status === "approved"
                        ? "default"
                        : sub.status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {sub.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono">
                  ${sub.potentialEarnings.toLocaleString()}
                </TableCell>
                <TableCell>
                  {new Date(sub.submittedAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  {onApprove && onReject && (
                    <Button
                      onClick={() => {
                        if (onApprove) void onApprove(sub._id);
                      }}
                      size="sm"
                      disabled={!sub.hasReachedThreshold}
                      className="mr-2"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          onToggleExpand(
                            expandedId === sub._id ? null : sub._id
                          )
                        }
                      >
                        <TrendingUp className="h-4 w-4 mr-2" /> View Performance
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a
                          href={sub.tiktokUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Video className="h-4 w-4 mr-2" />
                          View on TikTok
                        </a>
                      </DropdownMenuItem>
                      {onReject && (
                        <DropdownMenuItem
                          onClick={() => onReject(sub)}
                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                          <XCircle className="h-4 w-4 mr-2" /> Reject
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              {expandedId === sub._id && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Card>
                      <CardHeader>
                        <CardTitle>Performance Details</CardTitle>
                        {!sub.hasReachedThreshold &&
                          sub.status === "pending" && (
                            <Alert variant="destructive" className="mt-2">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                This submission has not met the 1,000 view
                                threshold for approval.
                              </AlertDescription>
                            </Alert>
                          )}
                        {sub.status === "rejected" && sub.rejectionReason && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              <strong>Rejection Reason:</strong>{" "}
                              {sub.rejectionReason}
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ViewTracker submissionId={sub._id} showRefreshButton />
                        <ViewChart submissionId={sub._id} />
                      </CardContent>
                    </Card>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SubmissionsSkeleton() {
  return (
    <div className="space-y-4 p-1">
      <div className="flex space-x-2 border-b">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-10 w-1/2" />
      </div>
      <div className="border rounded-lg p-4">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-24" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-9" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
