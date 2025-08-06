import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StripeConnectOnboarding } from "./StripeConnectOnboarding";

interface PayoutRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PayoutRequestModal({
  isOpen,
  onClose,
}: PayoutRequestModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request Payout</DialogTitle>
        </DialogHeader>
        <StripeConnectOnboarding />
      </DialogContent>
    </Dialog>
  );
}
