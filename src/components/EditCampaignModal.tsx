import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { CampaignPayment } from "./CampaignPayment";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertTriangle, PlusCircle, XCircle } from 'lucide-react';

// Define a more specific type for the campaign prop
type Campaign = {
  _id: Id<"campaigns">;
  title: string;
  description?: string;
  category?: string;
  endDate?: number;
  youtubeAssetUrl?: string;
  requirements?: string[];
  status: 'draft' | 'active' | 'paused' | 'completed';
  totalBudget: number;
  cpmRate?: number;
  maxPayoutPerSubmission?: number;
  // Fields from dashboard view
  _creationTime?: number;
  remainingBudget?: number;
  totalSubmissions?: number;
  approvedSubmissions?: number;
  totalViews?: number;
  updatedTime?: number;
};

interface EditCampaignModalProps {
  campaign: Campaign | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditCampaignModal({ campaign, isOpen, onClose, onSuccess }: EditCampaignModalProps) {
  const [showPayment, setShowPayment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "lifestyle",
    endDate: "",
    youtubeAssetUrl: "",
    requirements: [""],
    status: "active" as "active" | "paused" | "completed",
  });

  const updateCampaign = useMutation(api.campaigns.updateCampaign);

  useEffect(() => {
    if (campaign) {
      setFormData({
        title: campaign.title ?? '',
        description: campaign.description ?? '',
        category: campaign.category ?? '',
        endDate: campaign.endDate ? new Date(campaign.endDate).toISOString().split('T')[0] : "",
        youtubeAssetUrl: campaign.youtubeAssetUrl ?? '',
        requirements: campaign.requirements ?? [],
        status: campaign.status === 'draft' ? 'active' : campaign.status,
      });
    }
  }, [campaign]);

  if (!isOpen || !campaign) return null;

  // If this is a draft campaign, show payment flow
  if (campaign.status === "draft") {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          {showPayment ? (
            <>
              <DialogHeader>
                <DialogTitle>Complete Payment</DialogTitle>
                <DialogDescription>Activate "{campaign.title}"</DialogDescription>
              </DialogHeader>
              <CampaignPayment
                campaignId={campaign._id}
                amount={campaign.totalBudget / 100}
                onSuccess={() => {
                  toast.success("Campaign activated successfully!");
                  onSuccess();
                  onClose();
                }}
                onCancel={() => setShowPayment(false)}
              />
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Activate Campaign</DialogTitle>
                <DialogDescription>"{campaign.title}"</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <Alert variant="default">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Payment Required</AlertTitle>
                  <AlertDescription>
                    This campaign is a draft. Complete payment to activate it and make it available to creators.
                  </AlertDescription>
                </Alert>

                <Card>
                  <CardHeader>
                    <CardTitle>Campaign Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Budget:</span>
                      <span>${(campaign.totalBudget / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CPM Rate:</span>
                      <span>${((campaign.cpmRate ?? 0) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Payout:</span>
                      <span>${((campaign.maxPayoutPerSubmission ?? 0) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <span className="capitalize">{campaign.category}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={() => setShowPayment(true)}>Complete Payment</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  const handleRequirementChange = (index: number, value: string) => {
    const newRequirements = [...formData.requirements];
    newRequirements[index] = value;
    setFormData({ ...formData, requirements: newRequirements });
  };

  const addRequirement = () => {
    setFormData({
      ...formData,
      requirements: [...formData.requirements, ""],
    });
  };

  const removeRequirement = (index: number) => {
    if (formData.requirements.length > 1) {
      const newRequirements = formData.requirements.filter((_, i) => i !== index);
      setFormData({ ...formData, requirements: newRequirements });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.requirements.some(req => !req.trim())) {
      toast.error("Please fill in all requirements or remove empty ones");
      return;
    }

    setLoading(true);
    try {
      await updateCampaign({
        campaignId: campaign._id,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        endDate: formData.endDate ? new Date(formData.endDate).getTime() : undefined,
        youtubeAssetUrl: formData.youtubeAssetUrl,
        requirements: formData.requirements.filter(req => req.trim()),
        status: formData.status,
      });

      toast.success("Campaign updated successfully");
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update campaign");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Campaign</DialogTitle>
          <DialogDescription>Make changes to your campaign details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Campaign Title *</Label>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter campaign title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Describe your campaign"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lifestyle">Lifestyle</SelectItem>
                  <SelectItem value="fashion">Fashion</SelectItem>
                  <SelectItem value="beauty">Beauty</SelectItem>
                  <SelectItem value="fitness">Fitness</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="tech">Technology</SelectItem>
                  <SelectItem value="gaming">Gaming</SelectItem>
                  <SelectItem value="music">Music</SelectItem>
                  <SelectItem value="comedy">Comedy</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as any })}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date (Optional)</Label>
            <Input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="youtubeAssetUrl">YouTube Asset URL (Optional)</Label>
            <Input
              id="youtubeAssetUrl"
              type="url"
              value={formData.youtubeAssetUrl}
              onChange={(e) => setFormData({ ...formData, youtubeAssetUrl: e.target.value })}
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>

          <div className="space-y-2">
            <Label>Requirements</Label>
            <div className="space-y-2">
              {formData.requirements.map((requirement, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    type="text"
                    value={requirement}
                    onChange={(e) => handleRequirementChange(index, e.target.value)}
                    placeholder={`Requirement #${index + 1}`}
                  />
                  {formData.requirements.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRequirement(index)}>
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addRequirement}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Requirement
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
              {loading ? "Updating..." : "Update Campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
