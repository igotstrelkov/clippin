import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Info, Lock, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface PayoutThresholdProps {
  currentEarnings: number; // in cents
  minimumThreshold: number; // in cents
  isEligible: boolean;
  amountNeeded: number; // in cents
  className?: string;
}

export const PayoutThreshold: React.FC<PayoutThresholdProps> = ({
  currentEarnings,
  minimumThreshold,
  isEligible,
  amountNeeded,
  className,
}) => {
  const progressPercentage = Math.min(
    (currentEarnings / minimumThreshold) * 100,
    100
  );

  return (
    <div className={className}>
      <Alert className={isEligible ? "border-green-500" : "border-yellow-500"}>
        <div className="flex items-start gap-3">
          {isEligible ? (
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
          ) : (
            <Lock className="h-5 w-5 text-yellow-500 mt-0.5" />
          )}
          <div className="flex-1">
            <AlertDescription className="space-y-3">
              <div>
                {isEligible ? (
                  <span className="font-semibold text-green-700">
                    You're eligible for payout!
                  </span>
                ) : (
                  <span className="font-semibold text-yellow-700">
                    Minimum payout threshold: {formatCurrency(minimumThreshold / 100)}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Current earnings</span>
                  <span className="font-medium">
                    {formatCurrency(currentEarnings / 100)}
                  </span>
                </div>
                <Progress 
                  value={progressPercentage} 
                  className="h-2"
                />
                {!isEligible && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {formatCurrency(amountNeeded / 100)} more needed
                    </span>
                    <span>{progressPercentage.toFixed(0)}%</span>
                  </div>
                )}
              </div>

              {!isEligible && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3 mt-0.5" />
                  <span>
                    Continue earning from your approved submissions to reach the
                    minimum payout threshold of {formatCurrency(minimumThreshold / 100)}.
                  </span>
                </div>
              )}
            </AlertDescription>
          </div>
        </div>
      </Alert>
    </div>
  );
};

export default PayoutThreshold;