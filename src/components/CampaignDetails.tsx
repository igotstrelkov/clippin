import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";
import type { UICampaignWithBrand } from "@/types/ui";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CheckCircle,
  Copy,
  DollarSign,
  ExternalLink,
  Info,
  Link,
  Percent,
  PlusCircle,
  Target,
  Video,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { SignInForm } from "./auth/SignInForm";
import { LoadingSpinner } from "./ui/loading-spinner";

export function CampaignDetails() {
  const isMobile = useIsMobile();
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  const campaign = useQuery(
    api.campaigns.getCampaign,
    campaignId ? { campaignId: campaignId as Id<"campaigns"> } : "skip"
  ) as UICampaignWithBrand | null | undefined;
  const profile = useQuery(api.profiles.getCurrentProfile);
  const submitToCampaign = useMutation(api.submissions.submitToCampaign);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = tiktokUrl.trim();
    if (!url) return;

    const tiktokPatterns = [
      /^https?:\/\/(www\.)?tiktok\.com\/@[-.\w]+\/video\/\d+/,
      /^https?:\/\/vm\.tiktok\.com\/[\w]+/,
      /^https?:\/\/(www\.)?tiktok\.com\/t\/[\w]+/,
    ];

    if (!tiktokPatterns.some((p) => p.test(url))) {
      toast.error("Please provide a valid TikTok URL");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await submitToCampaign({
        campaignId: campaignId as Id<"campaigns">,
        tiktokUrl: url,
      });
      if (!response.success) {
        toast.error(response.message);
        return;
      }
      toast.success(response.message);
      void navigate("/marketplace");
      setIsSubmitModalOpen(false); // Close modal on success
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const budgetUsedPercentage = campaign
    ? ((campaign.totalBudget - campaign.remainingBudget) /
        campaign.totalBudget) *
      100
    : 0;

  const canSubmit = profile?.userType === "creator" && profile?.tiktokVerified;

  if (!campaignId) {
    void navigate("/marketplace");
    return null;
  }

  if (!campaign) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void navigate("/marketplace");
          }}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Button>
      </div>

      {/* Campaign Header */}
      <div className="flex items-start justify-between gap-4">
        <Avatar className="w-16 h-16 border">
          <AvatarImage src={campaign.brandLogo ?? ""} />
          <AvatarFallback>
            {campaign.brandName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2">{campaign.title}</h1>
          <div className="flex items-center gap-4 text-muted-foreground">
            <span>
              by <span className="font-semibold">{campaign.brandName}</span>
            </span>
            {!isMobile && (
              <Badge variant="secondary">{campaign.category}</Badge>
            )}
          </div>
        </div>
        <div>
          <Button onClick={() => setIsSubmitModalOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {isMobile ? "Create" : "Create Submission"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={DollarSign}
          title="CPM Rate"
          value={`${formatCurrency(campaign.cpmRate / 100)}`}
          description="per 1,000 views"
        />
        <StatCard
          icon={Target}
          title="Max Payout"
          value={`${formatCurrency(campaign.maxPayoutPerSubmission / 100)}`}
          description="per submission"
        />
        <StatCard
          icon={Percent}
          title="Budget Used"
          value={`${budgetUsedPercentage.toFixed(1)}%`}
          progress={budgetUsedPercentage}
        />
      </div>

      {/* Campaign Content */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{campaign.description}</p>
          </CardContent>
        </Card>

        {campaign.requirements.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {campaign.requirements.map((req, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{req}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {campaign.assetLinks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Asset Links</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {campaign.assetLinks.map((link, index) => (
                  <li
                    key={index}
                    className="group flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <Link className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground flex-1 font-mono break-all">
                      {link}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(link)
                            .catch((err) => {
                              console.error(
                                "Failed to copy to clipboard:",
                                err
                              );
                            });
                          toast.success("Link copied to clipboard");
                        }}
                        title="Copy to clipboard"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => window.open(link, "_blank")}
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Your Clip</DialogTitle>
            </DialogHeader>
            {profile ? (
              canSubmit ? (
                <form
                  onSubmit={(e) => {
                    void handleSubmit(e);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <Label htmlFor="tiktokUrl">TikTok Clip URL</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="tiktokUrl"
                        type="url"
                        value={tiktokUrl}
                        onChange={(e) => setTiktokUrl(e.target.value)}
                        placeholder="https://www.tiktok.com/@username/video/..."
                        required
                      />
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && (
                          <LoadingSpinner size="sm" centered={false} />
                        )}
                        Submit
                      </Button>
                    </div>
                  </div>
                </form>
              ) : (
                <Alert variant="default">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Action Required</AlertTitle>
                  <AlertDescription>
                    {profile.userType !== "creator"
                      ? "Only creators can submit to campaigns."
                      : "Please verify your TikTok account in your profile to submit."}
                  </AlertDescription>
                </Alert>
              )
            ) : (
              <Alert variant="default" className="text-center">
                <Video className="h-4 w-4" />
                <AlertTitle>Sign In to Participate</AlertTitle>
                <AlertDescription className="mt-4">
                  <SignInForm />
                </AlertDescription>
              </Alert>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  description,
  progress,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  description?: string;
  progress?: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {progress !== undefined && (
          <Progress value={progress} className="mt-2 h-2" />
        )}
      </CardContent>
    </Card>
  );
}
