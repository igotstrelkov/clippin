import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle,
  DollarSign,
  Info,
  Loader2,
  Percent,
  Target,
  Video,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { SignInForm } from "../SignInForm";

interface CampaignModalProps {
  campaignId: Id<"campaigns">;
  onClose: () => void;
}

export function CampaignModal({ campaignId, onClose }: CampaignModalProps) {
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const campaign = useQuery(api.campaigns.getCampaign, { campaignId });
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
      await submitToCampaign({ campaignId, tiktokUrl: url });
      toast.success("Submission successful! Awaiting brand approval.");
      onClose();
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

  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {!campaign ? (
          <CampaignModalSkeleton />
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start gap-4">
                <Avatar className="w-16 h-16 border">
                  <AvatarImage src={campaign.brandLogo ?? ""} />
                  <AvatarFallback>
                    {campaign.brandName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <DialogTitle className="text-2xl mb-1">
                    {campaign.title}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-4">
                    <span>
                      by{" "}
                      <span className="font-semibold">
                        {campaign.brandName}
                      </span>
                    </span>
                    <Badge variant="secondary">{campaign.category}</Badge>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6">
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

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    {campaign.description}
                  </p>
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

              <Card>
                <CardHeader>
                  <CardTitle>Submit Your Video</CardTitle>
                </CardHeader>
                <CardContent>
                  {profile ? (
                    canSubmit ? (
                      <form
                        onSubmit={(e) => {
                          void handleSubmit(e);
                        }}
                        className="space-y-4"
                      >
                        <div>
                          <Label htmlFor="tiktokUrl">TikTok Post URL</Label>
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
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                </CardContent>
              </Card>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
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
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground" />
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

function CampaignModalSkeleton() {
  return (
    <>
      <DialogHeader>
        <div className="flex items-start gap-4">
          <Skeleton className="w-16 h-16 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>
      </DialogHeader>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <DialogFooter className="mt-6">
        <Skeleton className="h-10 w-24" />
      </DialogFooter>
    </>
  );
}
