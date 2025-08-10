import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { UICampaign } from "@/types/ui";
import { useMutation } from "convex/react";
import {
  AlertTriangle,
  ChevronDownIcon,
  PlusCircle,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Calendar } from "../ui/calendar";
import { LoadingSpinner } from "../ui/loading-spinner";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { CampaignPayment } from "./CampaignPayment";

interface EditCampaignModalProps {
  campaign: UICampaign | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditCampaignModal({
  campaign,
  isOpen,
  onClose,
  onSuccess,
}: EditCampaignModalProps) {
  const [open, setOpen] = useState(false);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [showPayment, setShowPayment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "lifestyle",
    endDate: "",
    assetLinks: [""],
    requirements: [""],
    status: "active" as "active" | "paused" | "completed",
  });

  const updateCampaign = useMutation(api.campaigns.updateCampaign);

  useEffect(() => {
    if (campaign) {
      setFormData({
        title: campaign.title ?? "",
        description: campaign.description ?? "",
        category: campaign.category ?? "",
        endDate: endDate ? new Date(endDate).toISOString().split("T")[0] : "",
        assetLinks: campaign.assetLinks ?? [],
        requirements: campaign.requirements ?? [],
        status: campaign.status === "draft" ? "active" : campaign.status,
      });
    }
  }, [campaign, endDate]);

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
                <DialogDescription>Activate {campaign.title}</DialogDescription>
              </DialogHeader>
              <CampaignPayment
                campaignId={campaign._id}
                amount={campaign.totalBudget / 100}
                onSuccess={() => {
                  toast.success("Campaign activated");
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
                <DialogDescription>{campaign.title}</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <Alert variant="default">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Payment Required</AlertTitle>
                  <AlertDescription>
                    This campaign is a draft. Complete payment to activate it
                    and make it available to creators.
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
                      <span>
                        $
                        {((campaign.maxPayoutPerSubmission ?? 0) / 100).toFixed(
                          2
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <span className="capitalize">{campaign.category}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <DialogFooter className="flex flex-col gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={() => setShowPayment(true)}>
                  Complete Payment
                </Button>
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
      const newRequirements = formData.requirements.filter(
        (_, i) => i !== index
      );
      setFormData({ ...formData, requirements: newRequirements });
    }
  };

  const handleAssetLinkChange = (index: number, value: string) => {
    const newAssetLinks = [...formData.assetLinks];
    newAssetLinks[index] = value;
    setFormData({ ...formData, assetLinks: newAssetLinks });
  };

  const addAssetLink = () => {
    setFormData({
      ...formData,
      assetLinks: [...formData.assetLinks, ""],
    });
  };

  const removeAssetLink = (index: number) => {
    if (formData.assetLinks.length > 1) {
      const newAssetLinks = formData.assetLinks.filter((_, i) => i !== index);
      setFormData({ ...formData, assetLinks: newAssetLinks });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.requirements.some((req) => !req.trim())) {
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
        endDate: formData.endDate
          ? new Date(formData.endDate).getTime()
          : undefined,
        assetLinks: formData.assetLinks.filter((req) => req.trim()),
        requirements: formData.requirements.filter((req) => req.trim()),
        status: formData.status,
      });

      toast.success("Campaign updated");
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update campaign"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Campaign</DialogTitle>
          <DialogDescription>
            Make changes to your campaign details below.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-6 py-4"
        >
          <div className="space-y-2">
            <Label htmlFor="title">Campaign Title *</Label>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Enter campaign title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              placeholder="Describe your campaign"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
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
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    status: value as "active" | "paused" | "completed",
                  })
                }
              >
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
            <div className="relative flex gap-2">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    id="endDate"
                    className="w-48 justify-between font-normal"
                  >
                    {endDate ? endDate.toLocaleDateString() : "Select date"}
                    <ChevronDownIcon />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto overflow-hidden p-0"
                  align="start"
                >
                  <Calendar
                    mode="single"
                    selected={endDate}
                    captionLayout="dropdown"
                    onSelect={(date) => {
                      setEndDate(date);
                      setOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Asset Links</Label>
            <div className="space-y-2">
              {formData.assetLinks.map((assetLink, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    type="text"
                    value={assetLink}
                    onChange={(e) =>
                      handleAssetLinkChange(index, e.target.value)
                    }
                    placeholder={`Asset Link #${index + 1}`}
                  />
                  {formData.assetLinks.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAssetLink(index)}
                    >
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAssetLink}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Asset Link
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Requirements</Label>
            <div className="space-y-2">
              {formData.requirements.map((requirement, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    type="text"
                    value={requirement}
                    onChange={(e) =>
                      handleRequirementChange(index, e.target.value)
                    }
                    placeholder={`Requirement #${index + 1}`}
                  />
                  {formData.requirements.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRequirement(index)}
                    >
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRequirement}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Requirement
              </Button>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <LoadingSpinner size="sm" centered={false} />}
              {loading ? "Updating..." : "Update Campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
