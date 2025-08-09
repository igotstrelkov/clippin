import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";
import type { UICampaign } from "@/types/ui";
import {
  CheckCircle,
  Clock,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  PlusCircle,
} from "lucide-react";
import { memo, useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { CreateCampaignModal } from "./CreateCampaignModal";

interface CampaignListProps {
  activeCampaigns: UICampaign[];
  draftCampaigns: UICampaign[];
  completedCampaigns: UICampaign[];
  onEdit: (campaign: UICampaign) => void;
  onDelete: (campaignId: Id<"campaigns">) => void;
}

export const CampaignList = memo(
  ({
    activeCampaigns,
    draftCampaigns,
    completedCampaigns,
    onEdit,
    onDelete,
  }: CampaignListProps) => {
    const isMobile = useIsMobile();
    const [showCreateModal, setShowCreateModal] = useState(false);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Your Campaigns</CardTitle>
                <CardDescription>
                  Manage and track your marketing campaigns
                </CardDescription>
              </div>
              <Button onClick={() => setShowCreateModal(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {isMobile ? "Create" : "Create Campaign"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="active" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="active">
                  Active ({activeCampaigns.length})
                </TabsTrigger>
                <TabsTrigger value="draft">
                  Draft ({draftCampaigns.length})
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Completed ({completedCampaigns.length})
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
                  <NonActiveCampaignCard
                    key={campaign._id}
                    campaign={campaign}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    draft={true}
                  />
                ))}

                {draftCampaigns.length === 0 && (
                  <EmptyState
                    title="No Draft Campaigns"
                    description="Draft campaigns will appear here."
                  />
                )}
              </TabsContent>

              <TabsContent value="completed" className="space-y-4">
                {completedCampaigns.map((campaign) => (
                  <NonActiveCampaignCard
                    key={campaign._id}
                    campaign={campaign}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}

                {completedCampaigns.length === 0 && (
                  <EmptyState
                    title="No Completed Campaigns"
                    description="Completed campaigns will appear here."
                  />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        {showCreateModal && (
          <CreateCampaignModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => setShowCreateModal(false)}
          />
        )}
      </div>
    );
  }
);

CampaignList.displayName = "CampaignList";

const ActiveCampaignCard = memo(
  ({
    campaign,
    onEdit,
    onDelete,
  }: {
    campaign: UICampaign;
    onEdit: (campaign: UICampaign) => void;
    onDelete: (campaignId: Id<"campaigns">) => void;
  }) => {
    const progressPercentage = Math.round(
      ((campaign.totalBudget - campaign.remainingBudget) /
        campaign.totalBudget) *
        100
    );

    return (
      <Card className={getBorderColorClass(campaign.status)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                {getStatusIcon(campaign.status)}
                <h3 className="text-lg font-semibold">{campaign.title}</h3>

                <Badge variant="secondary">{campaign.category}</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
                {/* <DropdownMenuSeparator /> */}
                {/* <DropdownMenuItem
                  onClick={() => onDelete(campaign._id)}
                  className="text-destructive"
                >
                  Delete Campaign
                </DropdownMenuItem> */}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Budget Progress</span>
              <span>
                {formatCurrency(
                  (campaign.totalBudget - campaign.remainingBudget) / 100
                )}{" "}
                / {formatCurrency(campaign.totalBudget / 100)}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Views</p>
              <p className="font-semibold">
                {(campaign.totalViews || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Submissions</p>
              <p className="font-semibold">{campaign.totalSubmissions || 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">CPM Rate</p>
              <p className="font-semibold">
                {formatCurrency(campaign.cpmRate / 100)}
              </p>
            </div>
          </div>
        </div>
      </Card>
    );
  }
);

ActiveCampaignCard.displayName = "ActiveCampaignCard";

const getStatusIcon = (status: "draft" | "active" | "completed" | "paused") => {
  switch (status) {
    case "draft":
      return <Clock className="w-4 h-4 text-gray-500" />;
    case "active":
      return <PlayCircle className="w-4 h-4 text-blue-500" />;
    case "paused":
      return <PauseCircle className="w-4 h-4 text-yellow-500" />;
    case "completed":
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    default:
      return null;
  }
};

const getBorderColorClass = (
  status: "draft" | "active" | "completed" | "paused"
) => {
  switch (status) {
    case "draft":
      return "p-6 border-l-4 border-l-gray-500";
    case "active":
      return "p-6 border-l-4 border-l-blue-500";
    case "paused":
      return "p-6 border-l-4 border-l-yellow-500";
    case "completed":
      return "p-6 border-l-4 border-l-green-500";
    default:
      return "p-6 border-l-4 border-l-gray-500";
  }
};

const NonActiveCampaignCard = memo(
  ({
    campaign,
    onEdit,
    onDelete,
    draft,
  }: {
    campaign: UICampaign;
    onEdit: (campaign: UICampaign) => void;
    onDelete: (campaignId: Id<"campaigns">) => void;
    draft?: boolean;
  }) => {
    return (
      <Card className={getBorderColorClass(campaign.status)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                {getStatusIcon(campaign.status)}
                <h3 className="text-lg font-semibold">{campaign.title}</h3>

                <Badge variant="secondary">{campaign.category}</Badge>
              </div>
            </div>
          </div>
          {draft && (
            <div className="flex items-center gap-2">
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
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Budget</p>
            <p className="font-semibold">
              {formatCurrency(campaign.totalBudget / 100)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">CPM Rate</p>
            <p className="font-semibold">
              {formatCurrency(campaign.cpmRate / 100)}
            </p>
          </div>

          <div>
            <p className="text-muted-foreground">Created</p>
            <p className="font-semibold">
              {new Date(campaign._creationTime).toLocaleDateString()}
            </p>
          </div>
        </div>
      </Card>
    );
  }
);

NonActiveCampaignCard.displayName = "NonActiveCampaignCard";
