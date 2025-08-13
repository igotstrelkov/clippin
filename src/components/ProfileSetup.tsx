import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "convex/react";
import { ArrowLeft, Building, Upload, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { LoadingSpinner } from "./ui/loading-spinner";

export function ProfileSetup() {
  const [userType, setUserType] = useState<"creator" | "brand" | null>(null);
  const [creatorName, setCreatorName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateProfile = useMutation(api.profiles.updateProfile);
  const generateUploadUrl = useMutation(api.profiles.generateUploadUrl);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Logo must be smaller than 5MB");
        return;
      }
      setSelectedLogo(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (): Promise<Id<"_storage"> | undefined> => {
    if (!selectedLogo) return undefined;

    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": selectedLogo.type },
        body: selectedLogo,
      });

      if (!result.ok) {
        toast.error("Failed to upload logo");
        return;
      }

      const { storageId } = await result.json();
      return storageId;
    } catch (error) {
      // Log error for debugging (replace with proper error tracking in production)
      if (process.env.NODE_ENV === "development") {
        console.error("Logo upload error:", error);
      }
      toast.error("Failed to upload logo");
    }
  };

  const handleSave = async () => {
    if (!userType) return;

    setLoading(true);
    try {
      let logoStorageId: Id<"_storage"> | undefined;

      if (userType === "brand" && selectedLogo) {
        logoStorageId = await uploadLogo();
      }

      if (userType === "creator") {
        if (!creatorName.trim()) {
          toast.error("Display Name is required.");
          setLoading(false);
          return;
        }
        await updateProfile({
          userType: "creator",
          creatorName,
        });
      } else if (userType === "brand") {
        if (!companyName.trim()) {
          toast.error("Company Name is required.");
          setLoading(false);
          return;
        }
        await updateProfile({
          userType: "brand",
          companyName,
          companyLogo: logoStorageId,
        });
      }
      toast.success("Profile created");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create profile"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold">
          Welcome to Clippin!
        </CardTitle>
        <p className="text-lg text-muted-foreground">
          Let's set up your profile to get started.
        </p>
      </CardHeader>
      <CardContent>
        {!userType ? (
          <div className="space-y-4 mt-6">
            <h3 className="text-xl font-semibold text-center mb-6">
              Choose Your Account Type
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card
                className="p-6 text-center cursor-pointer hover:border-primary transition-colors flex flex-col items-center justify-center"
                onClick={() => setUserType("creator")}
              >
                <User className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h4 className="text-lg font-bold mb-2">Creator</h4>
                <p className="text-sm text-muted-foreground">
                  Create content for brands and earn money from your videos.
                </p>
              </Card>
              <Card
                className="p-6 text-center cursor-pointer hover:border-primary transition-colors flex flex-col items-center justify-center"
                onClick={() => setUserType("brand")}
              >
                <Building className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h4 className="text-lg font-bold mb-2">Brand</h4>
                <p className="text-sm text-muted-foreground">
                  Launch campaigns and connect with creators.
                </p>
              </Card>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold">
                Complete your {userType} profile
              </h3>
            </div>

            {userType === "creator" ? (
              <div className="grid gap-2">
                <Label htmlFor="creator-name">Display Name</Label>
                <Input
                  id="creator-name"
                  type="text"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="Enter your display name"
                  required
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input
                    id="company-name"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Enter your company name"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Company Logo</Label>
                  <div className="flex items-center gap-4">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo Preview"
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <Upload className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setUserType(null)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <LoadingSpinner size="sm" centered={false} />}
                {loading ? "Creating Profile..." : "Complete Setup"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
