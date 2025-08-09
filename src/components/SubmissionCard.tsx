import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, getRelativeTime } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
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

// Reusable StatusBadge component
function StatusBadge({ status }: { status: string }) {
  const getStatusConfig = () => {
    switch (status) {
      case "pending":
        return {
          icon: <Clock className="w-3 h-3" />,
          label: "Pending",
          variant: "secondary" as const,
          className: "bg-yellow-100 text-yellow-800 border-yellow-300",
        };
      case "approved":
        return {
          icon: <CheckCircle className="w-3 h-3" />,
          label: "Approved",
          variant: "default" as const,
          className: "bg-green-100 text-green-800 border-green-300",
        };
      case "rejected":
        return {
          icon: <XCircle className="w-3 h-3" />,
          label: "Rejected",
          variant: "destructive" as const,
          className: "bg-red-100 text-red-800 border-red-300",
        };
      default:
        return {
          icon: null,
          label: status,
          variant: "secondary" as const,
          className: "",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge variant={config.variant} className={`${config.className} flex items-center gap-1.5`}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

// Touch-friendly ActionButtons component
function ActionButtons({
  submission,
  onApprove,
  onReject,
}: {
  submission: UISubmission;
  onApprove?: (id: Id<"submissions">) => void;
  onReject?: () => void;
}) {
  if (submission.status !== "pending") return null;

  return (
    <div className="flex gap-3 w-full sm:w-auto">
      {onApprove && (
        <Button
          size="lg"
          variant="default"
          onClick={() => onApprove(submission._id)}
          className="flex-1 sm:flex-none h-11"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Approve
        </Button>
      )}
      {onReject && (
        <Button
          size="lg"
          variant="destructive"
          onClick={onReject}
          className="flex-1 sm:flex-none h-11"
        >
          <XCircle className="w-4 h-4 mr-2" />
          Reject
        </Button>
      )}
    </div>
  );
}

// Mobile-optimized SubmissionCard component
function MobileSubmissionCard({
  submission,
  onApprove,
  onReject,
  onExpand,
  userType,
  setExpandedSubmission,
}: {
  submission: UISubmission;
  onApprove?: (id: Id<"submissions">) => void;
  onReject?: () => void;
  onExpand?: (submission: UISubmission) => void;
  userType?: "brand" | "creator";
  setExpandedSubmission: (submission: UISubmission | null) => void;
}) {
  return (
    <Card className="border-l-4 border-l-primary">
      <div className="p-4 space-y-4">
        {/* Header Row - Creator Info and Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-foreground truncate">
              {submission.creatorName}
            </h3>
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {submission.campaignTitle}
            </p>
          </div>
          <StatusBadge status={submission.status} />
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Views</p>
            <p className="font-bold text-lg text-foreground">
              {submission.viewCount?.toLocaleString() ?? "—"}
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">
              {userType === "brand" ? "Cost" : "Earnings"}
            </p>
            <p className="font-bold text-lg text-foreground">
              {formatCurrency((submission.earnings || 0) / 100)}
            </p>
          </div>
        </div>

        {/* Submission Time */}
        <div className="text-center py-2">
          <p className="text-xs text-muted-foreground">
            Submitted {getRelativeTime(submission.submittedAt ?? submission._creationTime)}
          </p>
        </div>

        {/* Action Buttons Row */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            asChild
            className="flex-1 h-11"
          >
            <a
              href={submission.tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              TikTok
            </a>
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={submission.status !== "approved"}
            onClick={() => {
              if (onExpand) {
                onExpand(submission);
              } else {
                setExpandedSubmission(submission);
              }
            }}
            className="flex-1 h-11"
          >
            <Eye className="w-4 h-4 mr-2" />
            Analytics
          </Button>
        </div>

        {/* Approval Actions */}
        <ActionButtons
          submission={submission}
          onApprove={onApprove}
          onReject={onReject}
        />

        {/* Rejection Reason */}
        {submission.status === "rejected" && submission.rejectionReason && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              <span className="font-medium">Rejection reason:</span>{" "}
              {submission.rejectionReason}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

// Modern Desktop SubmissionCard with improved layout
function DesktopSubmissionCard({
  submission,
  onApprove,
  onReject,
  onExpand,
  userType,
  setExpandedSubmission,
}: {
  submission: UISubmission;
  onApprove?: (id: Id<"submissions">) => void;
  onReject?: () => void;
  onExpand?: (submission: UISubmission) => void;
  userType?: "brand" | "creator";
  setExpandedSubmission: (submission: UISubmission | null) => void;
}) {
  return (
    <Card className="border-l-4 border-l-primary">
      <div className="p-6 space-y-6">
        {/* Header Row - Creator Info and Status */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-xl text-foreground truncate">
              {submission.creatorName}
            </h3>
            <p className="text-base text-muted-foreground truncate mt-1">
              {submission.campaignTitle}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Submitted {getRelativeTime(submission.submittedAt ?? submission._creationTime)}
            </p>
          </div>
          <StatusBadge status={submission.status} />
        </div>

        {/* Metrics and Actions Row */}
        <div className="flex items-center justify-between gap-6">
          {/* Metrics Cards */}
          <div className="flex gap-6 flex-1">
            <div className="bg-muted/30 rounded-lg px-4 py-3 text-center min-w-[120px]">
              <p className="text-xs text-muted-foreground mb-1">Views</p>
              <p className="font-bold text-xl text-foreground">
                {submission.viewCount?.toLocaleString() ?? "—"}
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg px-4 py-3 text-center min-w-[120px]">
              <p className="text-xs text-muted-foreground mb-1">
                {userType === "brand" ? "Cost" : "Earnings"}
              </p>
              <p className="font-bold text-xl text-foreground">
                {formatCurrency((submission.earnings || 0) / 100)}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="default"
              asChild
              className="min-w-[100px]"
            >
              <a
                href={submission.tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                TikTok
              </a>
            </Button>
            <Button
              variant="outline"
              size="default"
              disabled={submission.status !== "approved"}
              onClick={() => {
                if (onExpand) {
                  onExpand(submission);
                } else {
                  setExpandedSubmission(submission);
                }
              }}
              className="min-w-[100px]"
            >
              <Eye className="w-4 h-4 mr-2" />
              Analytics
            </Button>

            {/* Approval Actions */}
            {submission.status === "pending" && (
              <>
                {onApprove && (
                  <Button
                    size="default"
                    variant="default"
                    onClick={() => onApprove(submission._id)}
                    className="min-w-[100px]"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                )}
                {onReject && (
                  <Button
                    size="default"
                    variant="destructive"
                    onClick={onReject}
                    className="min-w-[100px]"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Rejection Reason */}
        {submission.status === "rejected" && submission.rejectionReason && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              <span className="font-medium">Rejection reason:</span>{" "}
              {submission.rejectionReason}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

// Main SubmissionCard component with responsive logic
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
    const isMobile = useIsMobile();
    const [expandedSubmission, setExpandedSubmission] =
      useState<UISubmission | null>(null);
    const [showRejectionDialog, setShowRejectionDialog] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");

    const handleReject = useCallback(() => {
      setShowRejectionDialog(true);
    }, []);

    const handleRejectConfirm = useCallback(() => {
      if (!rejectionReason.trim()) return;
      onReject?.(submission._id, rejectionReason.trim());
      setShowRejectionDialog(false);
      setRejectionReason("");
    }, [onReject, submission._id, rejectionReason]);

    return (
      <>
        {isMobile ? (
          <MobileSubmissionCard
            submission={submission}
            onApprove={onApprove}
            onReject={handleReject}
            onExpand={onExpand}
            userType={userType}
            setExpandedSubmission={setExpandedSubmission}
          />
        ) : (
          <DesktopSubmissionCard
            submission={submission}
            onApprove={onApprove}
            onReject={handleReject}
            onExpand={onExpand}
            userType={userType}
            setExpandedSubmission={setExpandedSubmission}
          />
        )}

        {/* Analytics Dialog */}
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