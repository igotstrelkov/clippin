import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ViewChart } from "./ViewChart";
import { ViewTracker } from "./ViewTracker";

// Define a more specific type for the submission prop
type Submission = {
  _id: Id<"submissions">;
  status: "pending" | "approved" | "rejected";
  creatorName: string;
  campaignTitle: string;
  submittedAt: number;
  viewCount?: number;
  potentialEarnings: number;
  tiktokUrl: string;
  rejectionReason?: string;
};

export function SubmissionCard({
  submission,
  onApprove,
  onReject,
}: {
  submission: Submission;
  onApprove: (id: Id<"submissions">) => void;
  onReject: (id: Id<"submissions">) => void;
}) {
  const [expandedSubmission, setExpandedSubmission] =
    useState<Submission | null>(null);
  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 w-56">
            <div
              className={`w-3 h-3 rounded-full ${submission.status === "pending" ? "bg-yellow-500" : submission.status === "approved" ? "bg-green-500" : "bg-red-500"}`}
            ></div>
            <div>
              <h3 className="font-semibold">{submission.creatorName}</h3>
              <p className="text-sm text-muted-foreground">
                {submission.campaignTitle}
              </p>
              {/* <p className="text-xs text-muted-foreground">{new Date(submission.submittedAt).toLocaleString()}</p> */}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-8 text-center">
            {/* <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge
              variant={
                submission.status === "approved"
                  ? "default"
                  : submission.status === "rejected"
                    ? "destructive"
                    : "secondary"
              }
            >
              {submission.status}
            </Badge>
          </div> */}
            <div>
              <p className="text-sm text-muted-foreground">Views</p>
              <p className="font-semibold">
                {submission.viewCount?.toLocaleString() ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Est. Cost</p>
              <p className="font-semibold">
                ${submission.potentialEarnings.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Submitted</p>
              <p className="font-semibold">
                {new Date(submission.submittedAt).toLocaleDateString()}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">TikTok Link</p>

              <a
                href={submission.tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline font-semibold"
              >
                View Post
              </a>
            </div>
          </div>

          <div className="flex gap-2 items-center w-56 justify-end">
            {submission.status === "approved" && (
              <Button
                size="sm"
                variant="default"
                onClick={() => setExpandedSubmission(submission)}
              >
                View Analytics
              </Button>
            )}

            {submission.status === "pending" && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onApprove(submission._id)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onReject(submission._id)}
                >
                  Reject
                </Button>
              </>
            )}
            {submission.status === "rejected" && submission.rejectionReason && (
              <p className="text-xs text-muted-foreground">
                Reason: {submission.rejectionReason}
              </p>
            )}
          </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ViewTracker
                    submissionId={expandedSubmission._id}
                    showRefreshButton
                  />
                  <ViewChart submissionId={expandedSubmission._id} />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
