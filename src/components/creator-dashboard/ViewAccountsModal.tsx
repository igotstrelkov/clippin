import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  AtSign,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  Copy,
  ExternalLink,
  Info,
  KeyRound,
  Shield,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { SocialIcon } from "react-social-icons";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { LoadingSpinner } from "../ui/loading-spinner";

// Custom Instagram Icon component
// const InstagramIcon = ({ className }: { className?: string }) => (
//   <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
//     <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
//   </svg>
// );

// const TikTokIcon = ({ className }: { className?: string }) => (
//   <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
//     <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
//   </svg>
// );

interface ViewAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type VerificationView = "overview" | "tiktok" | "instagram";
type VerificationStep = "username" | "generate" | "bio" | "success";

export default function ViewAccountsModal({
  isOpen,
  onClose,
}: ViewAccountsModalProps) {
  const [activeView, setActiveView] = useState<VerificationView>("overview");
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const profile = useQuery(api.profiles.getCurrentProfile);

  // TikTok mutations
  const generateTikTokCode = useMutation(api.profiles.generateverificationCode);
  const verifyTikTokBio = useMutation(api.profiles.verifyTikTokBio);

  // Instagram mutations
  const generateInstagramCode = useMutation(
    api.profiles.generateInstagramVerificationCode
  );
  const verifyInstagramBio = useMutation(api.profiles.verifyInstagramBio);

  // Reset state when switching views
  useEffect(() => {
    if (activeView === "overview") {
      setUsername("");
      setIsLoading(false);
    }
  }, [activeView]);

  // Show error toast when verification fails
  useEffect(() => {
    if (profile?.verificationError) {
      toast.error(profile.verificationError);
    }
    setIsLoading(false);
  }, [profile?.verificationError]);

  const getVerificationStep = (
    platform: "tiktok" | "instagram"
  ): VerificationStep => {
    const verified =
      platform === "tiktok"
        ? profile?.tiktokVerified
        : profile?.instagramVerified;
    const platformUsername =
      platform === "tiktok"
        ? profile?.tiktokUsername
        : profile?.instagramUsername;

    if (verified) return "success";
    if (profile?.verificationCode) return "bio";
    if (platformUsername) return "generate";
    return "username";
  };

  const getVerificationBadge = (verified: boolean | undefined) => {
    if (verified === true) {
      return (
        <Badge variant="success">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Verified
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Not Verified
        </Badge>
      );
    }
  };

  const handleUsernameSubmit = async (
    e: React.FormEvent,
    platform: "tiktok" | "instagram"
  ) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const currentUsername =
        platform === "tiktok"
          ? profile?.tiktokUsername
          : profile?.instagramUsername;
      const usernameValue = currentUsername || username.trim();

      if (platform === "tiktok") {
        await generateTikTokCode({ tiktokUsername: usernameValue });
      } else {
        await generateInstagramCode({ instagramUsername: usernameValue });
      }

      toast.success("Verification code generated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate code."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCode = async (platform: "tiktok" | "instagram") => {
    setIsLoading(true);

    try {
      const currentUsername =
        platform === "tiktok"
          ? profile?.tiktokUsername
          : profile?.instagramUsername;
      const usernameValue = currentUsername || username.trim();

      if (platform === "tiktok") {
        await generateTikTokCode({ tiktokUsername: usernameValue });
      } else {
        await generateInstagramCode({ instagramUsername: usernameValue });
      }

      toast.success("Verification code generated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate code."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyBio = async (platform: "tiktok" | "instagram") => {
    setIsLoading(true);

    try {
      const currentUsername =
        platform === "tiktok"
          ? profile?.tiktokUsername
          : profile?.instagramUsername;
      const usernameValue = currentUsername || username.trim();

      if (platform === "tiktok") {
        await verifyTikTokBio({ tiktokUsername: usernameValue });
      } else {
        await verifyInstagramBio({ instagramUsername: usernameValue });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Verification failed."
      );
    }
  };

  const renderVerificationContent = (platform: "tiktok" | "instagram") => {
    const step = getVerificationStep(platform);
    const platformName = platform === "tiktok" ? "TikTok" : "Instagram";
    const platformUsername =
      platform === "tiktok"
        ? profile?.tiktokUsername
        : profile?.instagramUsername;
    const platformVerified =
      platform === "tiktok"
        ? profile?.tiktokVerified
        : profile?.instagramVerified;
    const urlPrefix =
      platform === "tiktok"
        ? "https://www.tiktok.com/@"
        : "https://www.instagram.com/";

    if (step === "success" && platformVerified) {
      return (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto bg-green-100 dark:bg-green-900/20 rounded-full h-16 w-16 flex items-center justify-center mb-4">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <CardTitle className="text-green-500">
              {platformName} account verified!
            </CardTitle>
            <CardDescription>@{platformUsername}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              Your {platformName} account has been successfully verified. You
              can now submit to campaigns.
            </p>
          </CardContent>
        </Card>
      );
    }

    switch (step) {
      case "username":
        return (
          <form
            onSubmit={(e) => void handleUsernameSubmit(e, platform)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="username">{platformName} Username</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="yourusername"
                  className="pl-9"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter your {platformName} username without the @ symbol.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <LoadingSpinner size="sm" centered={false} />}
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        );

      case "generate":
        return (
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>
                Ready to verify @{platformUsername || username.trim()}?
              </AlertTitle>
              <AlertDescription>
                We'll generate a unique code for you to add to your{" "}
                {platformName} bio temporarily.
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => void handleGenerateCode(platform)}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading && <LoadingSpinner size="sm" centered={false} />}
              Generate Code
            </Button>
          </div>
        );

      case "bio":
        return (
          <div className="space-y-4">
            <Alert variant="warning">
              <KeyRound className="h-4 w-4" />
              <AlertTitle>Add this code to your {platformName} bio</AlertTitle>
              <AlertDescription>
                <div className="bg-background/50 dark:bg-background/80 rounded-lg p-3 my-3">
                  <div className="flex items-center justify-between">
                    <code className="text-lg font-mono text-foreground tracking-wider">
                      {profile?.verificationCode}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (profile?.verificationCode) {
                          void navigator.clipboard.writeText(
                            profile.verificationCode
                          );
                          toast.success("Code copied to clipboard!");
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-sm">
                  <li>Open {platformName} and go to your profile.</li>
                  <li>Tap "Edit profile".</li>
                  <li>Add the code above anywhere in your bio.</li>
                  <li>Save your changes, then return here.</li>
                </ol>
              </AlertDescription>
            </Alert>
            <div className="text-center">
              <a
                href={`${urlPrefix}${platformUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                Open @{platformUsername} on {platformName}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <Button
              onClick={() => void handleVerifyBio(platform)}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading && <LoadingSpinner size="sm" centered={false} />}
              Verify Now
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  // Platform-specific view
  if (activeView === "tiktok" || activeView === "instagram") {
    const platform = activeView;
    const platformName = platform === "tiktok" ? "TikTok" : "Instagram";

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {/* {platform === "tiktok" ? (
                <SocialIcon url="https://tiktok.com" />
              ) : (
                <SocialIcon url="https://instagram.com" />
              )} */}
              <div>
                <DialogTitle>{platformName} Verification</DialogTitle>
                <DialogDescription>
                  Verify your {platformName} account to submit to campaigns
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-2">{renderVerificationContent(platform)}</div>

          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setActiveView("overview")}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
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
  const totalVerified = [
    profile?.tiktokVerified,
    profile?.instagramVerified,
  ].filter(Boolean).length;
  const hasAnyVerification = totalVerified > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div>
              <DialogTitle>My Accounts</DialogTitle>
              <DialogDescription>
                Manage my social media accounts
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Overview */}
          <Alert
            className={
              hasAnyVerification
                ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
                : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
            }
          >
            {hasAnyVerification ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <Shield className="h-4 w-4 text-amber-600" />
            )}
            <AlertTitle
              className={
                hasAnyVerification
                  ? "text-green-900 dark:text-green-100"
                  : "text-amber-900 dark:text-amber-100"
              }
            >
              {hasAnyVerification
                ? `${totalVerified} Account${totalVerified === 1 ? "" : "s"} Verified`
                : "No Accounts Verified"}
            </AlertTitle>
            <AlertDescription
              className={
                hasAnyVerification
                  ? "text-green-700 dark:text-green-300"
                  : "text-amber-700 dark:text-amber-300"
              }
            >
              {hasAnyVerification
                ? "Great! You can now submit to campaigns."
                : "Verify at least one account to start submitting to campaigns."}
            </AlertDescription>
          </Alert>

          {/* Platform Cards */}
          <div className="space-y-3">
            {/* TikTok Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <SocialIcon url="https://tiktok.com" />
                    <div>
                      <CardTitle className="text-base">TikTok</CardTitle>
                      <CardDescription className="text-xs">
                        {profile?.tiktokUsername
                          ? `@${profile.tiktokUsername}`
                          : "Not connected"}
                      </CardDescription>
                    </div>
                  </div>
                  {getVerificationBadge(profile?.tiktokVerified)}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  variant={profile?.tiktokVerified ? "outline" : "default"}
                  size="sm"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveView("tiktok");
                  }}
                >
                  {profile?.tiktokVerified ? "Manage" : "Verify Account"}
                </Button>
              </CardContent>
            </Card>

            {/* Instagram Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <SocialIcon url="https://instagram.com" />

                    <div>
                      <CardTitle className="text-base">Instagram</CardTitle>
                      <CardDescription className="text-xs">
                        {profile?.instagramUsername
                          ? `@${profile.instagramUsername}`
                          : "Not connected"}
                      </CardDescription>
                    </div>
                  </div>
                  {getVerificationBadge(profile?.instagramVerified)}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  variant={profile?.instagramVerified ? "outline" : "default"}
                  size="sm"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveView("instagram");
                  }}
                >
                  {profile?.instagramVerified ? "Manage" : "Verify Account"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* <Separator />

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose} size="sm">
              Close
            </Button>
          </div> */}
        </div>
        {/* <DialogFooter className="flex flex-col gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter> */}
      </DialogContent>
    </Dialog>
  );
}
