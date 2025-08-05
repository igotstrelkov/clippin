import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency, getRelativeTime } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  Eye,
  XCircle,
} from "lucide-react";
import { memo, useCallback, useState } from "react";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { ViewChart } from "./ViewChart";

// Extended submission type for the card component
// Using Pick to only require the fields we actually use in the component
type Submission = Pick<
  Doc<"submissions">,
  "_id" | "status" | "viewCount" | "tiktokUrl" | "rejectionReason" | "earnings"
> & {
  creatorName: string;
  campaignTitle: string;
  submittedAt: number;
};

export const SubmissionCard = memo(
  ({
    submission,
    onApprove,
    onReject,
    onExpand,
    userType,
  }: {
    submission: Submission;
    onApprove?: (id: Id<"submissions">) => void;
    onReject?: (id: Id<"submissions">, rejectionReason: string) => void;
    onExpand?: (submission: Submission) => void;
    userType?: "brand" | "creator";
  }) => {
    const [expandedSubmission, setExpandedSubmission] =
      useState<Submission | null>(null);
    const [showRejectionDialog, setShowRejectionDialog] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");

    const handleApprove = useCallback(() => {
      onApprove?.(submission._id);
    }, [onApprove, submission._id]);

    const handleReject = useCallback(() => {
      setShowRejectionDialog(true);
    }, []);

    const handleRejectConfirm = useCallback(() => {
      if (!rejectionReason.trim()) return;
      onReject?.(submission._id, rejectionReason.trim());
      setShowRejectionDialog(false);
      setRejectionReason("");
    }, [onReject, submission._id, rejectionReason]);

    const getStatusIcon = () => {
      switch (submission.status) {
        case "pending":
          return <Clock className="w-4 h-4 text-gray-500" />;
        case "approved":
          return <CheckCircle className="w-4 h-4 text-green-500" />;
        case "rejected":
          return <XCircle className="w-4 h-4 text-red-500" />;
        default:
          return null;
      }
    };

    return (
      <>
        <Card className={`border-l-4`}>
          <div className="p-6">
            <div className="flex items-center justify-between">
              {/* Left side - Status and Creator Info */}
              <div className="flex items-center gap-4 flex-1">
                {getStatusIcon()}

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">
                    {submission.creatorName}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {submission.campaignTitle}
                  </p>
                </div>
              </div>

              {/* Center - Metrics */}
              <div className="flex items-center gap-8 mx-8">
                {/* <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  <span>{getRelativeTime(submission.submittedAt)}</span>
                </div> */}
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    Submitted
                  </p>
                  <p className="font-bold text-lg">
                    {getRelativeTime(submission.submittedAt)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Views</p>
                  <p className="font-bold text-lg">
                    {submission.viewCount?.toLocaleString() ?? "—"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    {userType === "brand" ? "Est. Cost" : "Est. Earnings"}
                  </p>
                  <p className="font-bold text-lg">
                    {formatCurrency((submission.earnings || 0) / 100)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">TikTok</p>
                  <Button variant="outline" size="sm" asChild className="h-8">
                    <a
                      href={submission.tiktokUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open
                    </a>
                  </Button>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    {" "}
                    Analytics
                  </p>
                  <Button
                    variant="outline"
                    disabled={submission.status !== "approved"}
                    size="sm"
                    onClick={() => {
                      if (onExpand) {
                        onExpand(submission);
                      } else {
                        setExpandedSubmission(submission);
                      }
                    }}
                    className="h-8"
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </Button>
                </div>
              </div>

              {/* Right side - Actions */}
              <div className="flex gap-2 items-center flex-shrink-0">
                {submission.status === "pending" && (
                  <>
                    {onApprove && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={handleApprove}
                      >
                        Approve
                      </Button>
                    )}
                    {onReject && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleReject}
                      >
                        Reject
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Rejection reason - separate row for better alignment */}
            {submission.status === "rejected" && submission.rejectionReason && (
              <div className="flex items-start gap-2 mt-4 p-3 bg-red-50 border border-red-200 rounded">
                {/* <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" /> */}
                <p className="text-sm text-red-700">
                  <span className="font-medium">Rejection reason:</span>{" "}
                  {submission.rejectionReason}
                </p>
              </div>
            )}
          </div>
        </Card>
        <Dialog
          open={!!expandedSubmission}
          onOpenChange={(isOpen) => !isOpen && setExpandedSubmission(null)}
        >
          <DialogContent className="max-w-3xl">
            {expandedSubmission && (
              <>
                <DialogHeader>
                  <DialogTitle>
                    Performance for: {expandedSubmission.campaignTitle}
                  </DialogTitle>
                  <DialogDescription>
                    Submitted on{" "}
                    {new Date(
                      expandedSubmission.submittedAt
                    ).toLocaleDateString()}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {expandedSubmission.status === "rejected" &&
                    expandedSubmission.rejectionReason && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Rejection Feedback</AlertTitle>
                        <AlertDescription>
                          {expandedSubmission.rejectionReason}
                        </AlertDescription>
                      </Alert>
                    )}
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    {/* <ViewTracker
                    submissionId={expandedSubmission._id}
                    showRefreshButton
                  /> */}
                    <ViewChart submissionId={expandedSubmission._id} />
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Rejection Dialog */}
        <AlertDialog
          open={showRejectionDialog}
          onOpenChange={setShowRejectionDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject Submission?</AlertDialogTitle>
              <AlertDialogDescription>
                Provide feedback for the creator to help them improve. This
                reason will be shared with the creator.
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
                onClick={handleRejectConfirm}
                disabled={!rejectionReason.trim()}
              >
                Reject Submission
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }
);
