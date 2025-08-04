import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { Id } from "../../convex/_generated/dataModel";

interface Campaign {
  _id: Id<"campaigns">;
  title: string;
  description: string;
  category: string;
  cpmRate: number;
  maxPayoutPerSubmission: number;
  totalBudget: number;
  remainingBudget: number;
  brandName: string;
  brandLogo?: string | null;
}

interface CampaignCardProps {
  campaign: Campaign;
  onClick: () => void;
}

export function CampaignCard({ campaign, onClick }: CampaignCardProps) {
  const budgetUsedPercentage =
    campaign.totalBudget > 0
      ? ((campaign.totalBudget - campaign.remainingBudget) /
          campaign.totalBudget) *
        100
      : 0;

  return (
    <Card
      onClick={onClick}
      className="hover:border-primary transition-colors cursor-pointer"
    >
      <CardHeader className="flex-row gap-4 items-center">
        <Avatar>
          <AvatarImage src={campaign.brandLogo ?? ""} />
          <AvatarFallback>
            {campaign.brandName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="grid gap-1">
          <CardTitle className="text-lg">{campaign.brandName}</CardTitle>
          <Badge variant="outline">{campaign.category}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <h3 className="text-xl font-semibold tracking-tight">
            {campaign.title}
          </h3>
          <CardDescription className="line-clamp-2">
            {campaign.description}
          </CardDescription>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-secondary p-3 rounded-lg">
            <div className="text-lg font-bold text-primary">
              {formatCurrency(campaign.cpmRate / 100)}
            </div>
            <div className="text-xs text-muted-foreground">per 1,000 views</div>
          </div>
          <div className="bg-secondary p-3 rounded-lg">
            <div className="text-lg font-bold">
              {formatCurrency(campaign.maxPayoutPerSubmission / 100)}
            </div>
            <div className="text-xs text-muted-foreground">max payout</div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2">
        <div className="w-full">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Budget Used</span>
            <span className="font-medium">
              {budgetUsedPercentage.toFixed(1)}%
            </span>
          </div>
          <Progress value={budgetUsedPercentage} />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>
              {formatCurrency(
                (campaign.totalBudget - campaign.remainingBudget) / 100
              )}
            </span>
            <span>
              {formatCurrency(campaign.remainingBudget / 100)} Remaining
            </span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
