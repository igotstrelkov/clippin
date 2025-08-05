import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { useAction, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { EmptyState } from "../ui/empty-state";
import { LoadingSpinner } from "../ui/loading-spinner";
import { StripeConnectOnboarding } from "./StripeConnectOnboarding";

interface PayoutRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PayoutRequestModal({
  isOpen,
  onClose,
}: PayoutRequestModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedSubmissions, setSelectedSubmissions] = useState<
    Id<"submissions">[]
  >([]);

  const pendingEarnings = useQuery(api.payoutHelpers.getPendingEarnings);
  const processPayout = useAction(api.payouts.processPayout);
  const profile = useQuery(api.profiles.getCurrentProfile);

  useEffect(() => {
    // Reset selection when modal is closed or earnings data changes
    if (!isOpen) {
      setSelectedSubmissions([]);
    }
  }, [isOpen, pendingEarnings]);

  const handleSubmissionToggle = (submissionId: Id<"submissions">) => {
    setSelectedSubmissions((prev) =>
      prev.includes(submissionId)
        ? prev.filter((id) => id !== submissionId)
        : [...prev, submissionId]
    );
  };

  const selectedEarnings =
    pendingEarnings?.submissions
      .filter((sub) => selectedSubmissions.includes(sub._id))
      .reduce((sum, sub) => sum + (sub.pendingAmount || 0), 0) || 0;

  const handleSelectAll = () => {
    if (selectedSubmissions.length === pendingEarnings?.submissions.length) {
      setSelectedSubmissions([]);
    } else {
      setSelectedSubmissions(
        pendingEarnings?.submissions.map((s) => s._id) || []
      );
    }
  };

  const handleRequestPayout = async () => {
    if (!profile || selectedSubmissions.length === 0) return;

    setLoading(true);
    try {
      await processPayout({
        creatorId: profile.userId,
        amount: selectedEarnings,
        submissionIds: selectedSubmissions,
      });
      toast.success("Payout processed successfully!");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to process payout"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request Payout</DialogTitle>
        </DialogHeader>
        <StripeConnectOnboarding />

        {profile?.stripeConnectAccountId && (
          <>
            <div className="max-h-[60vh] overflow-y-auto pr-4">
              {pendingEarnings === undefined ? (
                <div className="flex justify-center items-center h-48">
                  <LoadingSpinner />
                </div>
              ) : pendingEarnings.submissions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={
                            pendingEarnings.submissions.length > 0 &&
                            selectedSubmissions.length ===
                              pendingEarnings.submissions.length
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingEarnings.submissions.map((s) => (
                      <TableRow key={s._id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedSubmissions.includes(s._id)}
                            onCheckedChange={() =>
                              handleSubmissionToggle(s._id)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {s.campaignTitle}
                        </TableCell>
                        <TableCell>
                          {new Date(s.submittedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency((s.pendingAmount || 0) / 100)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  title="No Pending Payouts"
                  description="Approved submissions with earnings will appear here."
                />
              )}
            </div>
            <DialogFooter className="sm:justify-between items-center pt-4 border-t">
              <div className="text-lg font-semibold">
                Total:{" "}
                <span className="font-mono text-primary">
                  {formatCurrency(selectedEarnings / 100)}
                </span>
              </div>
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={() => void handleRequestPayout()}
                  disabled={loading || selectedEarnings === 0}
                >
                  {loading && <LoadingSpinner size="sm" centered={false} />}
                  Request Payout
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
