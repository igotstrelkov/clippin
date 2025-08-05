import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import { MoreHorizontal, Package } from "lucide-react";
import { memo } from "react";
import { Id } from "../../../convex/_generated/dataModel";

interface Campaign {
  _id: Id<"campaigns">;
  _creationTime: number;
  title: string;
  status: "active" | "draft" | "completed" | "paused";
  totalBudget: number;
  remainingBudget: number;
  totalViews?: number;
  totalSubmissions?: number;
  description: string;
  category: string;
  cpmRate: number;
  maxPayoutPerSubmission: number;
  endDate?: number;
}

interface CampaignListProps {
  activeCampaigns: Campaign[];
  draftCampaigns: Campaign[];
  onEdit: (campaign: Campaign) => void;
  onDelete: (campaignId: Id<"campaigns">) => void;
}

export const CampaignList = memo(({
  activeCampaigns,
  draftCampaigns,
  onEdit,
  onDelete,
}: CampaignListProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Your Campaigns</h2>
        <p className="text-muted-foreground mb-6">
          Manage and track your marketing campaigns
        </p>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active">
              Active ({activeCampaigns.length})
            </TabsTrigger>
            <TabsTrigger value="draft">
              Draft ({draftCampaigns.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeCampaigns.map((campaign) => (
              <ActiveCampaignCard
                key={campaign._id}
                campaign={campaign}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}

            {activeCampaigns.length === 0 && (
              <EmptyState
                title="No Active Campaigns"
                description="Your active campaigns will appear here."
              />
            )}
          </TabsContent>

          <TabsContent value="draft" className="space-y-4">
            {draftCampaigns.map((campaign) => (
              <DraftCampaignCard
                key={campaign._id}
                campaign={campaign}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}

            {draftCampaigns.length === 0 && (
              <EmptyState
                title="No Draft Campaigns"
                description="Draft campaigns will appear here."
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

CampaignList.displayName = "CampaignList";

const ActiveCampaignCard = memo(({
  campaign,
  onEdit,
  onDelete,
}: {
  campaign: Campaign;
  onEdit: (campaign: Campaign) => void;
  onDelete: (campaignId: Id<"campaigns">) => void;
}) => {
  const progressPercentage = Math.round(
    ((campaign.totalBudget - campaign.remainingBudget) / campaign.totalBudget) * 100
  );

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-lg font-semibold">{campaign.title}</h3>
            <p className="text-sm text-muted-foreground">
              {campaign.category}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default">Active</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(campaign)}>
                Edit Campaign
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(campaign._id)}
                className="text-destructive"
              >
                Delete Campaign
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Budget Progress</span>
            <span>
              {formatCurrency((campaign.totalBudget - campaign.remainingBudget) / 100)} /{" "}
              {formatCurrency(campaign.totalBudget / 100)}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Views</p>
            <p className="font-semibold">{(campaign.totalViews || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Submissions</p>
            <p className="font-semibold">{campaign.totalSubmissions || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">CPM Rate</p>
            <p className="font-semibold">{formatCurrency(campaign.cpmRate / 100)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
});

ActiveCampaignCard.displayName = "ActiveCampaignCard";

const DraftCampaignCard = memo(({
  campaign,
  onEdit,
  onDelete,
}: {
  campaign: Campaign;
  onEdit: (campaign: Campaign) => void;
  onDelete: (campaignId: Id<"campaigns">) => void;
}) => {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-lg font-semibold">{campaign.title}</h3>
            <p className="text-sm text-muted-foreground">
              {campaign.category}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Draft</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(campaign)}>
                Complete Payment
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(campaign._id)}
                className="text-destructive"
              >
                Delete Campaign
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Budget</p>
          <p className="font-semibold">
            {formatCurrency(campaign.totalBudget / 100)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Status</p>
          <p className="font-semibold text-gray-600">Draft</p>
        </div>
        <div>
          <p className="text-muted-foreground">Created</p>
          <p className="font-semibold">
            {new Date(campaign._creationTime).toLocaleDateString()}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Action</p>
          <Button size="sm" onClick={() => onEdit(campaign)}>
            Complete Payment
          </Button>
        </div>
      </div>
    </Card>
  );
});

DraftCampaignCard.displayName = "DraftCampaignCard";

const EmptyState = memo(({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="text-center py-12 text-muted-foreground">
    <Package className="mx-auto h-12 w-12" />
    <h3 className="mt-4 text-lg font-medium">{title}</h3>
    <p className="mt-1 text-sm">{description}</p>
  </div>
));

EmptyState.displayName = "EmptyState";
