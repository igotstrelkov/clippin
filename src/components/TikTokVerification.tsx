import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  AtSign,
  CheckCircle,
  Copy,
  Info,
  KeyRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { LoadingSpinner } from "./ui/loading-spinner";

function TikTokVerification() {
  const [tiktokUsername, setTiktokUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const profile = useQuery(api.profiles.getCurrentProfile);

  const generateCode = useMutation(api.profiles.generateTikTokVerificationCode);
  const verifyBio = useMutation(api.profiles.verifyTikTokBio);

  // Determine current step from database state
  const getStep = () => {
    if (profile?.tiktokVerified) return "success";
    if (profile?.tiktokVerificationCode) return "bio";
    if (profile?.tiktokUsername) return "generate";
    return "username";
  };

  const step = getStep();

  // Show error toast when verification fails
  useEffect(() => {
    if (profile?.tiktokVerificationError) {
      toast.error(profile.tiktokVerificationError);
    }
  }, [profile?.tiktokVerificationError]);

  if (step === "success" && profile?.tiktokVerified) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto bg-green-100 dark:bg-green-900/20 rounded-full h-16 w-16 flex items-center justify-center mb-4">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <CardTitle className="text-green-500">
            TikTok Account Verified!
          </CardTitle>
          <CardDescription>@{profile.tiktokUsername}</CardDescription>
        </CardHeader>
        {/* <CardContent className="text-center">
          <p className="text-muted-foreground">
            Your TikTok account has been successfully verified. You can now
            submit to campaigns.
          </p>
        </CardContent> */}
      </Card>
    );
  }

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = profile?.tiktokUsername || tiktokUsername.trim();
    if (!username) return;

    setTiktokUsername(username);

    // Automatically generate code after setting username
    setIsLoading(true);
    try {
      await generateCode({ tiktokUsername: username });
      toast.success("Verification code generated successfully!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate code."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!profile?.tiktokUsername || tiktokUsername.trim()) {
      toast.error("Please enter a TikTok username first.");
      return;
    }

    setIsLoading(true);
    try {
      await generateCode({
        tiktokUsername: profile?.tiktokUsername || tiktokUsername.trim(),
      });
      toast.success("Verification code generated successfully!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate code."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyBio = async () => {
    setIsLoading(true);
    try {
      const result = await verifyBio({
        tiktokUsername: profile?.tiktokUsername || tiktokUsername.trim(),
      });
      if (result.success) {
        toast.success("Verification started! This may take a few moments...");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Verification failed."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    switch (step) {
      case "username":
        return (
          <form
            onSubmit={(e) => void handleUsernameSubmit(e)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="username">TikTok Username</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  value={tiktokUsername}
                  onChange={(e) => setTiktokUsername(e.target.value)}
                  placeholder="yourusername"
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter your TikTok username without the @ symbol.
              </p>
            </div>
            <Button type="submit" className="w-full">
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
                Ready to verify @
                {profile?.tiktokUsername || tiktokUsername.trim()}?
              </AlertTitle>
              <AlertDescription>
                We'll generate a unique code for you to add to your TikTok bio
                temporarily.
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => void handleGenerateCode()}
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
              <AlertTitle>Add this code to your TikTok bio</AlertTitle>
              <AlertDescription>
                <div className="bg-background/50 dark:bg-background/80 rounded-lg p-3 my-3">
                  <div className="flex items-center justify-between">
                    <code className="text-lg font-mono text-foreground tracking-wider">
                      {profile?.tiktokVerificationCode}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (profile?.tiktokVerificationCode) {
                          void navigator.clipboard.writeText(
                            profile.tiktokVerificationCode
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
                  <li>Open TikTok and go to your profile.</li>
                  <li>Tap "Edit profile".</li>
                  <li>Add the code above anywhere in your bio.</li>
                  <li>Save your changes, then return here.</li>
                </ol>
              </AlertDescription>
            </Alert>
            <div className="text-center">
              <a
                href={`https://www.tiktok.com/@${profile?.tiktokUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Open @{profile?.tiktokUsername} on TikTok →
              </a>
            </div>
            <Button
              onClick={() => void handleVerifyBio()}
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

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Verify Your TikTok Account</CardTitle>
        <CardDescription>
          Complete the steps to link your account and start earning.
        </CardDescription>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  );
}

export default TikTokVerification;
