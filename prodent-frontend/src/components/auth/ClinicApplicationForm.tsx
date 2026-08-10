import { lazy, Suspense, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Loader2, CheckCircle, ImagePlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { LocationSelector } from "./LocationSelector";
import { useLanguage } from "@/contexts/LanguageContext";

const AvatarCropper = lazy(() =>
  import("@/components/ui/avatar-cropper").then((module) => ({ default: module.AvatarCropper })),
);

export function ClinicApplicationForm() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    address: "",
    country: t("auth.uzbekistan"),
    region: "",
    district: "",
    website: "",
    licenseNumber: "",
    directorName: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImageSrc(reader.result as string);
        setCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], "logo.jpg", { type: "image/jpeg" });
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(croppedBlob));
    setTempImageSrc(null);
    clearError("logo");
  };

  const handleFileUpload = async (file: File, bucket: string, folder: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("User not authenticated");

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${folder}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim() || formData.name.trim().length < 2) newErrors.name = t("auth.errClinicName");
    if (!formData.region) newErrors.region = t("auth.errRegion");
    if (!formData.address.trim()) newErrors.address = t("auth.errAddress");
    // The map point is collected only here — the CRM no longer re-asks for it,
    // so an application without coordinates would leave the clinic off the map.
    if (formData.latitude == null || formData.longitude == null) {
      newErrors.location = t("auth.errLocation");
    }
    if (!formData.directorName.trim()) newErrors.directorName = t("auth.fieldRequired");
    if (!formData.licenseNumber.trim()) newErrors.licenseNumber = t("auth.fieldRequired");
    if (!logoFile) newErrors.logo = t("auth.uploadClinicLogo");
    if (!licenseFile) newErrors.license = t("auth.fieldRequired");
    if (!registrationFile) newErrors.registration = t("auth.fieldRequired");

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error(t("auth.fillRequiredFields"));
      return;
    }

    setLoading(true);

    try {
      const user = (await supabase.auth.getUser()).data.user;
      const profile = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (!user || !profile.data) {
        toast.error(t("auth.getUserDataError"));
        return;
      }

      // Upload documents (private) and logo (public so it renders on clinic listings)
      const licenseUrl = await handleFileUpload(licenseFile, "documents", "clinic-licenses");
      const registrationUrl = await handleFileUpload(registrationFile, "documents", "clinic-registration");
      const logoUrl = await handleFileUpload(logoFile!, "clinic-photos", "clinic-logos");

      // Update profile with logo as avatar
      await supabase
        .from("profiles")
        .update({ avatar_url: logoUrl })
        .eq("id", user.id);

      // Create application with logo URL
      const { error } = await supabase.from("clinic_applications").insert({
        user_id: user.id,
        name: formData.name,
        description: formData.description,
        address: formData.address,
        city: formData.region, // Using region as city for compatibility
        district: formData.district,
        latitude: formData.latitude,
        longitude: formData.longitude,
        phone: profile.data.phone,
        email: user.email,
        website: formData.website,
        license_number: formData.licenseNumber,
        license_document_url: licenseUrl,
        registration_document_url: registrationUrl,
        director_name: formData.directorName,
        logo_url: logoUrl,
        status: "pending",
      });

      if (error) throw error;

      toast.success(t("auth.applicationSent"), {
        description: t("auth.applicationSentDesc"),
      });

      setTimeout(() => navigate("/"), 2000);
    } catch (error: unknown) {
      toast.error(t("auth.applicationError"), {
        description: error instanceof Error ? error.message : t("auth.applicationError"),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" data-testid="application-form-clinic">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-primary" />
              {t("auth.clinicAppTitle")}
            </CardTitle>
            <CardDescription>
              {t("auth.clinicAppDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Logo upload section */}
              <div className="space-y-3">
                <Label>{t("auth.clinicLogoLabel")}</Label>
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <div className="h-24 w-24 rounded-lg border-2 border-dashed border-muted-foreground/50 flex items-center justify-center bg-muted overflow-hidden">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImagePlus className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    {logoPreview && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Pencil className="h-6 w-6 text-white" />
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      {t("auth.clinicLogoHint")}
                    </p>
                    {logoFile && (
                      <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                        <CheckCircle className="h-4 w-4" /> {t("auth.logoSelected")}
                      </p>
                    )}
                    {errors.logo && <p className="text-sm text-destructive mt-1">{errors.logo}</p>}
                  </div>
                </div>
              </div>

              {/* Logo Cropper Dialog */}
              {tempImageSrc && (
                <Suspense fallback={null}>
                  <AvatarCropper
                    open={cropperOpen}
                    onClose={() => {
                      setCropperOpen(false);
                      setTempImageSrc(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    imageSrc={tempImageSrc}
                    onCropComplete={handleCropComplete}
                    circularCrop={false}
                  />
                </Suspense>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">{t("auth.clinicNameLbl")}</Label>
                <Input
                  id="name"
                  placeholder={t("auth.clinicNameExample")}
                  value={formData.name}
                  onChange={(e) => { setFormData({ ...formData, name: e.target.value }); if (e.target.value.trim().length >= 2) clearError("name"); }}
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t("auth.clinicDescLbl")}</Label>
                <Textarea
                  id="description"
                  placeholder={t("auth.clinicDescPlaceholder")}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                />
              </div>

              {/* Location Selection */}
              <LocationSelector
                country={formData.country}
                region={formData.region}
                district={formData.district}
                address={formData.address}
                latitude={formData.latitude}
                longitude={formData.longitude}
                onCountryChange={(value) => { setFormData((p) => ({ ...p, country: value, region: "", district: "" })); clearError("country"); clearError("region"); }}
                onRegionChange={(value) => { setFormData((p) => ({ ...p, region: value, district: "" })); clearError("region"); }}
                onDistrictChange={(value) => setFormData((p) => ({ ...p, district: value }))}
                onAddressChange={(value) => { setFormData((p) => ({ ...p, address: value })); if (value.trim()) clearError("address"); }}
                onLocationChange={(lat, lng) => { setFormData((p) => ({ ...p, latitude: lat, longitude: lng })); clearError("location"); }}
                disabled={loading}
                errors={{ region: errors.region, address: errors.address, location: errors.location }}
              />

              <div className="space-y-2">
                <Label htmlFor="website">{t("auth.websiteLbl")}</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="director">{t("auth.directorNameLbl")}</Label>
                <Input
                  id="director"
                  placeholder={t("auth.directorNamePh")}
                  value={formData.directorName}
                  onChange={(e) => { setFormData({ ...formData, directorName: e.target.value }); if (e.target.value.trim()) clearError("directorName"); }}
                  className={errors.directorName ? "border-destructive" : ""}
                />
                {errors.directorName && <p className="text-sm text-destructive">{errors.directorName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="license">{t("auth.licenseNumberLbl")}</Label>
                <Input
                  id="license"
                  placeholder={t("auth.licenseNumberPh")}
                  value={formData.licenseNumber}
                  onChange={(e) => { setFormData({ ...formData, licenseNumber: e.target.value }); if (e.target.value.trim()) clearError("licenseNumber"); }}
                  className={errors.licenseNumber ? "border-destructive" : ""}
                />
                {errors.licenseNumber && <p className="text-sm text-destructive">{errors.licenseNumber}</p>}
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">{t("auth.docsUploadHeading")}</h3>

                <div className="space-y-2">
                  <Label htmlFor="license-file">{t("auth.medicalLicenseLbl")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="license-file"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => { setLicenseFile(e.target.files?.[0] || null); if (e.target.files?.[0]) clearError("license"); }}
                      className={errors.license ? "border-destructive" : ""}
                    />
                    {licenseFile && <CheckCircle className="h-5 w-5 text-green-500" />}
                  </div>
                  {errors.license && <p className="text-sm text-destructive">{errors.license}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registration-file">{t("auth.registrationCertLbl")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="registration-file"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => { setRegistrationFile(e.target.files?.[0] || null); if (e.target.files?.[0]) clearError("registration"); }}
                      className={errors.registration ? "border-destructive" : ""}
                    />
                    {registrationFile && <CheckCircle className="h-5 w-5 text-green-500" />}
                  </div>
                  {errors.registration && <p className="text-sm text-destructive">{errors.registration}</p>}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("auth.submitApp")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
