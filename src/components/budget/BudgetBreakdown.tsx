/**
 * Budget Breakdown Component
 * 
 * Displays the three-state budget architecture:
 * - Total Budget (what brand paid)
 * - Spent Budget (paid to creators)
 * - Reserved Budget (held for approved submissions)
 * - Remaining Budget (available for new submissions)
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, TrendingUp, Lock, Wallet } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useQuery } from "convex/react";
import { Id } from "../../../convex/_generated/dataModel";

interface BudgetBreakdownProps {
  campaignId: Id<"campaigns">;
  className?: string;
}

export const BudgetBreakdown: React.FC<BudgetBreakdownProps> = ({ 
  campaignId, 
  className 
}) => {
  const budgetData = useQuery(api.budgetOperations.getCampaignBudgetBreakdown, {
    campaignId,
  });

  if (!budgetData) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Budget Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const {
    totalBudget,
    spentBudget,
    reservedBudget,
    remainingBudget,
    spentPercentage,
    reservedPercentage,
    remainingPercentage,
  } = budgetData;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Budget Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Budget */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <Wallet className="w-4 h-4" />
            Total Budget
          </div>
          <div className="text-lg font-bold">
            {formatCurrency(totalBudget / 100)}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-3">
          <div className="relative">
            <Progress value={100} className="h-3 bg-gray-100" />
            {/* Spent Budget Overlay */}
            <div 
              className="absolute top-0 left-0 h-3 bg-green-500 rounded-full"
              style={{ width: `${spentPercentage}%` }}
            />
            {/* Reserved Budget Overlay */}
            <div 
              className="absolute top-0 h-3 bg-yellow-500 rounded-full"
              style={{ 
                left: `${spentPercentage}%`, 
                width: `${reservedPercentage}%` 
              }}
            />
            {/* Remaining is shown by the default progress background */}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Spent</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span>Reserved</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
              <span>Available</span>
            </div>
          </div>
        </div>

        {/* Budget Details */}
        <div className="space-y-4">
          {/* Spent Budget */}
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <div>
                <div className="text-sm font-medium text-green-800">Spent Budget</div>
                <div className="text-xs text-green-600">Paid to creators</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-green-800">
                {formatCurrency(spentBudget / 100)}
              </div>
              <div className="text-xs text-green-600">
                {spentPercentage.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Reserved Budget */}
          <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-yellow-600" />
              <div>
                <div className="text-sm font-medium text-yellow-800">Reserved Budget</div>
                <div className="text-xs text-yellow-600">Held for approved submissions</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-yellow-800">
                {formatCurrency(reservedBudget / 100)}
              </div>
              <div className="text-xs text-yellow-600">
                {reservedPercentage.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Remaining Budget */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-600" />
              <div>
                <div className="text-sm font-medium text-blue-800">Available Budget</div>
                <div className="text-xs text-blue-600">For new submissions</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-blue-800">
                {formatCurrency(remainingBudget / 100)}
              </div>
              <div className="text-xs text-blue-600">
                {remainingPercentage.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Budget Status Alert */}
        {remainingBudget <= 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm font-medium text-red-800">
              Budget Exhausted
            </div>
            <div className="text-xs text-red-600">
              Campaign will auto-pause when no budget remains for new submissions
            </div>
          </div>
        )}

        {remainingBudget > 0 && remainingBudget < 1000 && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="text-sm font-medium text-orange-800">
              Low Budget Warning
            </div>
            <div className="text-xs text-orange-600">
              Less than €10 remaining. Consider adding more budget or completing the campaign.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BudgetBreakdown;