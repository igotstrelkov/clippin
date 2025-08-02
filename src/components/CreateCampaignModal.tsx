import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { CampaignPayment } from "./CampaignPayment";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PlusCircle, Trash2, Loader2, Info } from "lucide-react";

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CampaignFormData {
  title: string;
  description: string;
  category: string;
  totalBudget: number;
  cpmRate: number;
  maxPayoutPerSubmission: number;
  endDate: string;
  youtubeAssetUrl: string;
  requirements: string[];
}

export function CreateCampaignModal({ isOpen, onClose, onSuccess }: CreateCampaignModalProps) {
  const [step, setStep] = useState<'form' | 'payment'>('form');
  const [loading, setLoading] = useState(false);
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CampaignFormData>({
    title: "",
    description: "",
    category: "lifestyle",
    totalBudget: 500,
    cpmRate: 5,
    maxPayoutPerSubmission: 100,
    endDate: "",
    youtubeAssetUrl: "",
    requirements: [""],
  });

  const createDraftCampaign = useMutation(api.campaigns.createDraftCampaign);

  const handleRequirementChange = (index: number, value: string) => {
    const newRequirements = [...formData.requirements];
    newRequirements[index] = value;
    setFormData({ ...formData, requirements: newRequirements });
  };

  const addRequirement = () => {
    setFormData({ ...formData, requirements: [...formData.requirements, ""] });
  };

  const removeRequirement = (index: number) => {
    if (formData.requirements.length > 1) {
      const newRequirements = formData.requirements.filter((_, i) => i !== index);
      setFormData({ ...formData, requirements: newRequirements });
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim() || formData.requirements.some(req => !req.trim())) {
      toast.error("Please fill in all required fields and requirements.");
      return;
    }
    if (formData.totalBudget < 50) {
      toast.error("Minimum campaign budget is $50");
      return;
    }
    if (formData.cpmRate < 1) {
      toast.error("Minimum CPM rate is $1.00");
      return;
    }
    if (formData.maxPayoutPerSubmission > formData.totalBudget) {
      toast.error("Max payout per submission cannot exceed total budget");
      return;
    }
    if (formData.youtubeAssetUrl && !/^(https|http):\/\/(www\.)?youtube\.com\/watch\?v=/.test(formData.youtubeAssetUrl)) {
      toast.error("Please provide a valid YouTube watch URL");
      return;
    }

    setLoading(true);
    try {
      const campaignId = await createDraftCampaign({
        title: formData.title,
        description: formData.description,
        category: formData.category,
        totalBudget: Math.round(formData.totalBudget * 100),
        cpmRate: Math.round(formData.cpmRate * 100),
        maxPayoutPerSubmission: Math.round(formData.maxPayoutPerSubmission * 100),
        endDate: formData.endDate ? new Date(formData.endDate).getTime() : undefined,
        youtubeAssetUrl: formData.youtubeAssetUrl,
        requirements: formData.requirements.filter(req => req.trim()),
      });

      setDraftCampaignId(campaignId);
      setStep('payment');
      toast.success("Campaign details saved! Proceed to payment.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    toast.success("Campaign created and funded successfully!");
    onSuccess();
    handleClose();
  };

  const handleClose = () => {
    setStep('form');
    setDraftCampaignId(null);
    setFormData({
      title: "", description: "", category: "lifestyle", totalBudget: 500, cpmRate: 5,
      maxPayoutPerSubmission: 100, endDate: "", youtubeAssetUrl: "", requirements: [""]
    });
    onClose();
  };

  const handleBackToForm = () => setStep('form');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
              <DialogDescription>Step 1 of 2: Fill in your campaign details.</DialogDescription>
            </DialogHeader>
                        <form onSubmit={(e) => { void handleFormSubmit(e); }} className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Campaign Title</Label>
                  <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lifestyle">Lifestyle</SelectItem>
                      <SelectItem value="gaming">Gaming</SelectItem>
                      <SelectItem value="tech">Tech</SelectItem>
                      <SelectItem value="beauty">Beauty</SelectItem>
                      <SelectItem value="fashion">Fashion</SelectItem>
                      <SelectItem value="food">Food</SelectItem>
                      <SelectItem value="travel">Travel</SelectItem>
                      <SelectItem value="comedy">Comedy</SelectItem>
                      <SelectItem value="music">Music</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="totalBudget">Total Budget ($)</Label>
                  <Input id="totalBudget" type="number" value={formData.totalBudget} onChange={(e) => setFormData({ ...formData, totalBudget: Number(e.target.value) })} min="50" step="10" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpmRate">CPM Rate ($)</Label>
                  <Input id="cpmRate" type="number" value={formData.cpmRate} onChange={(e) => setFormData({ ...formData, cpmRate: Number(e.target.value) })} min="1" step="0.5" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxPayoutPerSubmission">Max Payout / Submission ($)</Label>
                  <Input id="maxPayoutPerSubmission" type="number" value={formData.maxPayoutPerSubmission} onChange={(e) => setFormData({ ...formData, maxPayoutPerSubmission: Number(e.target.value) })} min="1" step="1" required />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date (Optional)</Label>
                  <Input id="endDate" type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtubeAssetUrl">YouTube Asset URL (Optional)</Label>
                  <Input id="youtubeAssetUrl" type="url" value={formData.youtubeAssetUrl} onChange={(e) => setFormData({ ...formData, youtubeAssetUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Requirements</Label>
                <div className="space-y-2">
                  {formData.requirements.map((req, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input type="text" value={req} onChange={(e) => handleRequirementChange(index, e.target.value)} required />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeRequirement(index)} disabled={formData.requirements.length <= 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addRequirement} className="mt-2">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Requirement
                </Button>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? "Processing..." : "Save & Continue"}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Complete Payment</DialogTitle>
              <DialogDescription>Step 2 of 2: Fund your campaign to make it live.</DialogDescription>
            </DialogHeader>
            <div className="py-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Payment Required</AlertTitle>
                <AlertDescription>
                  Complete the payment of ${formData.totalBudget.toFixed(2)} to activate your campaign and make it available to creators.
                </AlertDescription>
              </Alert>
              <div className="mt-6">
                <CampaignPayment
                  campaignId={draftCampaignId!}
                  amount={formData.totalBudget}
                  onSuccess={handlePaymentSuccess}
                  onCancel={handleBackToForm}
                />
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>

  );
}
