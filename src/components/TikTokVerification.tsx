import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, Copy, Info, Loader2, KeyRound, Search, AtSign, ArrowRight } from "lucide-react";

type VerificationStep = "username" | "generate" | "bio" | "verify" | "success";

function TikTokVerification() {
  const [step, setStep] = useState<VerificationStep>("username");
  const [tiktokUsername, setTiktokUsername] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const profile = useQuery(api.profiles.getCurrentProfile);
  const generateCode = useMutation(api.profiles.generateTikTokVerificationCode);
  const verifyBio = useMutation(api.profiles.verifyTikTokBio);

  useEffect(() => {
    if (profile?.tiktokVerified) {
      setStep("success");
    }
  }, [profile]);

  if (step === "success" && profile?.tiktokVerified) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto bg-green-100 dark:bg-green-900/20 rounded-full h-16 w-16 flex items-center justify-center mb-4">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <CardTitle className="text-green-500">TikTok Account Verified!</CardTitle>
          <CardDescription>@{profile.tiktokUsername}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            Your TikTok account has been successfully verified. You can now submit to campaigns.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const username = tiktokUsername.trim();
    if (!username) return;

    if (username.length < 2 || username.length > 24) {
      toast.error("Username must be between 2 and 24 characters.");
      return;
    }

    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      toast.error("Username can only contain letters, numbers, periods, and underscores.");
      return;
    }

    setTiktokUsername(username);
    setStep("generate");
  };

  const handleGenerateCode = async () => {
    setIsLoading(true);
    try {
      const result = await generateCode({ tiktokUsername });
      setVerificationCode(result.verificationCode);
      setStep("bio");
    } catch (error) {
      toast.error("Failed to generate code. Please check the username and try again.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyBio = async () => {
    setIsLoading(true);
    try {
      await verifyBio({ tiktokUsername });
      toast.success("TikTok account verified!");
      setStep("success");
    } catch (error) {
      toast.error("Verification failed. Make sure the code is in your bio and try again.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetProcess = () => {
    setStep("username");
    setTiktokUsername("");
    setVerificationCode("");
  };

  const renderContent = () => {
    switch (step) {
      case "username":
        return (
          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tiktok-username">TikTok Username</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="tiktok-username"
                  type="text"
                  value={tiktokUsername}
                  onChange={(e) => setTiktokUsername(e.target.value)}
                  placeholder="yourusername"
                  className="pl-9"
                  required
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
              <AlertTitle>Ready to verify @{tiktokUsername}?</AlertTitle>
              <AlertDescription>
                We'll generate a unique code for you to add to your TikTok bio temporarily.
              </AlertDescription>
            </Alert>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("username")} className="flex-1">
                Back
              </Button>
              <Button onClick={() => { void handleGenerateCode(); }} disabled={isLoading} className="flex-1">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Code
              </Button>
            </div>
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
                      {verificationCode}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        void navigator.clipboard.writeText(verificationCode);
                        toast.success("Code copied to clipboard!");
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
                href={`https://www.tiktok.com/@${tiktokUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Open @{tiktokUsername} on TikTok →
              </a>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={resetProcess} className="flex-1">
                Start Over
              </Button>
              <Button onClick={() => setStep("verify")} className="flex-1">
                I've Added the Code
              </Button>
            </div>
          </div>
        );

      case "verify":
        return (
          <div className="space-y-4">
            <Alert>
              <Search className="h-4 w-4" />
              <AlertTitle>Ready to verify?</AlertTitle>
              <AlertDescription>
                We'll now check your TikTok bio for the verification code:{" "}
                <code className="bg-muted px-2 py-1 rounded text-foreground font-mono">
                  {verificationCode}
                </code>
              </AlertDescription>
            </Alert>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("bio")} className="flex-1">
                Back
              </Button>
              <Button onClick={() => { void handleVerifyBio(); }} disabled={isLoading} className="flex-1">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify Now
              </Button>
            </div>
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
