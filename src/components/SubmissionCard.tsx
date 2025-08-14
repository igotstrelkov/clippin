import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency, getRelativeTime } from "@/lib/utils";
import type { UISubmission } from "@/types/ui";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  Eye,
  XCircle,
} from "lucide-react";
import { memo, useCallback, useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
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

export const SubmissionCard = memo(
  ({
    submission,
    onApprove,
    onReject,
    onExpand,
    userType,
  }: {
    submission: UISubmission;
    onApprove?: (id: Id<"submissions">) => void;
    onReject?: (id: Id<"submissions">, rejectionReason: string) => void;
    onExpand?: (submission: UISubmission) => void;
    userType?: "brand" | "creator";
  }) => {
    const [expandedSubmission, setExpandedSubmission] =
      useState<UISubmission | null>(null);
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
          return <Clock className="w-4 h-4 text-orange-500" />;
        case "approved":
          return <CheckCircle className="w-4 h-4 text-green-500" />;
        case "rejected":
          return <XCircle className="w-4 h-4 text-red-500" />;
        default:
          return null;
      }
    };

    const getBorderColorClass = () => {
      switch (submission.status) {
        case "pending":
          return "border-l-4 border-l-orange-500";
        case "approved":
          return "border-l-4 border-l-green-500";
        case "rejected":
          return "border-l-4 border-l-red-500";
        default:
          return "border-l-4 border-l-gray-500";
      }
    };

    return (
      <>
        <Card className={getBorderColorClass()}>
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* {getStatusIcon()} */}
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">
                    {submission.creatorName}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {submission.campaignTitle}
                  </p>
                </div>
              </div>

              {/* Action buttons - always visible on right */}
              {submission.status === "pending" && (
                <div className="flex gap-2 flex-shrink-0">
                  {onApprove && (
                    <Button size="sm" onClick={handleApprove}>
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
                </div>
              )}
            </div>

            {/* Stats Grid - responsive layout */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Views</p>
                <p className="font-semibold">
                  {submission.viewCount?.toLocaleString() ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {userType === "brand" ? "Est. Cost" : "Earnings"}
                </p>
                <p className="font-semibold">
                  {formatCurrency((submission.earnings || 0) / 100)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p className="font-semibold">
                  {getRelativeTime(
                    submission.submittedAt ?? submission._creationTime
                  )}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Actions</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={submission.contentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={submission.status !== "approved"}
                    onClick={() => {
                      if (onExpand) {
                        onExpand(submission);
                      } else {
                        setExpandedSubmission(submission);
                      }
                    }}
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Rejection reason */}
            {submission.status === "rejected" && submission.rejectionReason && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                <span className="font-medium">Rejection reason:</span>{" "}
                {submission.rejectionReason}
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
                  <DialogTitle>{expandedSubmission.campaignTitle}</DialogTitle>
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
