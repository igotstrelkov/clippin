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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "convex/react";
import { CheckCircle2, Instagram, Shield, XCircle } from "lucide-react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import InstagramVerification from "./InstagramVerification";
import TikTokVerification from "./TikTokVerification";

interface ViewAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ViewAccountsModal({
  isOpen,
  onClose,
}: ViewAccountsModalProps) {
  const [activeVerification, setActiveVerification] = useState<
    "overview" | "tiktok" | "instagram"
  >("overview");

  const profile = useQuery(api.profiles.getCurrentProfile);

  const getVerificationBadge = (verified: boolean | undefined) => {
    if (verified === true) {
      return (
        <Badge
          variant="default"
          className="bg-green-100 text-green-800 border-green-200"
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Verified
        </Badge>
      );
    } else {
      return (
        <Badge
          variant="secondary"
          className="bg-red-50 text-red-700 border-red-200"
        >
          <XCircle className="h-3 w-3 mr-1" />
          Not Verified
        </Badge>
      );
    }
  };

  const handleBackToOverview = () => {
    setActiveVerification("overview");
  };

  if (activeVerification === "tiktok") {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">TT</span>
              </div>
              <div>
                <DialogTitle>TikTok Verification</DialogTitle>
                <DialogDescription>
                  Verify your TikTok account to submit to campaigns
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <TikTokVerification />
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleBackToOverview}>
              ← Back
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (activeVerification === "instagram") {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Instagram className="h-4 w-4 text-white" />
              </div>
              <div>
                <DialogTitle>Instagram Verification</DialogTitle>
                <DialogDescription>
                  Verify your Instagram account to submit to campaigns
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <InstagramVerification />
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleBackToOverview}>
              ← Back
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Overview screen
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div>
              <DialogTitle className="text-xl">
                Account Verification
              </DialogTitle>
              <DialogDescription>
                Verify your social media accounts to unlock campaign submissions
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Verification Status Overview */}
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-900 dark:text-blue-100">
                Verification Status
              </span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {profile?.tiktokVerified || profile?.instagramVerified
                ? "You have verified accounts! You can submit to campaigns."
                : "Verify at least one social media account to start submitting to campaigns."}
            </p>
          </div>

          <div className="grid gap-4">
            {/* TikTok Card */}
            <Card
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setActiveVerification("tiktok")}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm font-bold">TT</span>
                    </div>
                    <div>
                      <CardTitle className="text-lg">TikTok</CardTitle>
                      <CardDescription>
                        {profile?.tiktokUsername
                          ? `@${profile.tiktokUsername}`
                          : "Not connected"}
                      </CardDescription>
                    </div>
                  </div>
                  {getVerificationBadge(profile?.tiktokVerified)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button
                    variant={profile?.tiktokVerified ? "outline" : "default"}
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveVerification("tiktok");
                    }}
                  >
                    {profile?.tiktokVerified ? "Manage" : "Verify Account"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Instagram Card */}
            <Card
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setActiveVerification("instagram")}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                      <Instagram className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Instagram</CardTitle>
                      <CardDescription>
                        {profile?.instagramUsername
                          ? `@${profile.instagramUsername}`
                          : "Not connected"}
                      </CardDescription>
                    </div>
                  </div>
                  {getVerificationBadge(profile?.instagramVerified)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button
                    variant={profile?.instagramVerified ? "outline" : "default"}
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveVerification("instagram");
                    }}
                  >
                    {profile?.instagramVerified ? "Manage" : "Verify Account"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Need help with verification? Check our{" "}
              <a href="#" className="text-primary hover:underline">
                verification guide
              </a>
            </p>
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
