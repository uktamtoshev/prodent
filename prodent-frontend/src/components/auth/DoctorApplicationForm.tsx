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
import { Loader2, Upload, CheckCircle, ImagePlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { DoctorPartnershipAgreement } from "./DoctorPartnershipAgreement";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LocationSelector } from "./LocationSelector";
import { useLanguage } from "@/contexts/LanguageContext";

const AvatarCropper = lazy(() =>
  import("@/components/ui/avatar-cropper").then((module) => ({ default: module.AvatarCropper })),
);

export function DoctorApplicationForm() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  const [formData, setFormData] = useState({
    specialty: "",
    experienceYears: "",
    education: "",
    bio: "",
    country: t("auth.uzbekistan"),
    region: "",
    district: "",
    address: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [certifications, setCertifications] = useState<string[]>([""]);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [diplomaFile, setDiplomaFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    const file = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(croppedBlob));
    setTempImageSrc(null);
    clearError("photo");
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

    if (!formData.specialty.trim()) newErrors.specialty = t("auth.fieldRequired");
    if (!formData.experienceYears.trim()) newErrors.experienceYears = t("auth.fieldRequired");
    if (!formData.education.trim()) newErrors.education = t("auth.fieldRequired");
    if (!formData.region) newErrors.region = t("auth.errRegion");
    if (!formData.address.trim()) newErrors.address = t("auth.errAddress");
    if (!photoFile) newErrors.photo = t("auth.uploadProfilePhoto");
    if (!licenseFile) newErrors.license = t("auth.fieldRequired");
    if (!diplomaFile) newErrors.diploma = t("auth.fieldRequired");
    if (!agreementAccepted) newErrors.agreement = t("auth.partnershipAcceptRequired");

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
      if (!user) {
        toast.error(t("auth.userNotAuthed"));
        return;
      }

      // Build full_name from separate fields if not set
      const buildFullName = () => {
        const meta = user.user_metadata;
        if (meta?.full_name) return meta.full_name;
        const parts = [meta?.last_name, meta?.first_name, meta?.middle_name].filter(Boolean);
        return parts.join(" ") || t("auth.doctorFallbackName");
      };

      // Get or create profile
      const profileResult = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      let profileData = profileResult.data;
      const profileError = profileResult.error;

      const fullName = buildFullName();

      if (profileError || !profileData) {
        // Create profile if doesn't exist
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            full_name: fullName,
            phone: user.user_metadata?.phone || user.phone || "",
          })
          .select()
          .single();
        
        if (createError) {
          console.error("Error creating profile:", createError);
          toast.error(t("auth.profileCreationError"));
          return;
        }
        profileData = newProfile;
      } else if (!profileData.full_name) {
        // Update profile if full_name is empty
        await supabase
          .from("profiles")
          .update({ full_name: fullName })
          .eq("id", user.id);
        profileData.full_name = fullName;
      }

      // Upload documents (private) and photo (public so it renders on doctor cards)
      const licenseUrl = await handleFileUpload(licenseFile, "documents", "doctor-licenses");
      const diplomaUrl = await handleFileUpload(diplomaFile, "documents", "doctor-diplomas");
      const photoUrl = await handleFileUpload(photoFile!, "doctor-photos", "photos");

      // Update profile with photo
      await supabase
        .from("profiles")
        .update({ avatar_url: photoUrl })
        .eq("id", user.id);

      // Create doctor profile immediately (unverified)
      const { data: doctor, error: doctorError } = await supabase.from("doctors").insert({
        user_id: user.id,
        specialty: formData.specialty,
        experience_years: parseInt(formData.experienceYears),
        education: formData.education,
        // The doctors table column is `certificates` (jsonb), not `certifications`.
        certificates: certifications.filter((c) => c.trim() !== ""),
        bio: formData.bio,
        price_from: 100000,
        images: photoUrl ? [photoUrl] : null,
        address: `${formData.region}, ${formData.district}, ${formData.address}`,
        latitude: formData.latitude,
        longitude: formData.longitude,
      }).select().single();

      if (doctorError) throw doctorError;

      // Add doctor role to user_roles
      await supabase.from("user_roles").insert({
        user_id: user.id,
        role: "doctor",
      });

      // Create application for verification tracking
      const { error } = await supabase.from("doctor_applications").insert({
        user_id: user.id,
        full_name: profileData.full_name || fullName,
        phone: profileData.phone,
        email: user.email,
        specialty: formData.specialty,
        experience_years: parseInt(formData.experienceYears),
        education: formData.education,
        certifications: certifications.filter((c) => c.trim() !== ""),
        bio: formData.bio,
        license_number: "",
        license_document_url: licenseUrl,
        diploma_document_url: diplomaUrl,
        clinic_affiliation: null,
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
    <div className="min-h-screen flex flex-col bg-background" data-testid="application-form-doctor">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-primary" />
              {t("auth.doctorAppTitle")}
            </CardTitle>
            <CardDescription>
              {t("auth.doctorAppDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Photo upload section */}
              <div className="space-y-3">
                <Label>{t("auth.profilePhotoLbl")}</Label>
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <Avatar className="h-24 w-24 border-2 border-dashed border-muted-foreground/50">
                      {photoPreview ? (
                        <AvatarImage src={photoPreview} alt="Preview" />
                      ) : (
                        <AvatarFallback className="bg-muted">
                          <ImagePlus className="h-8 w-8 text-muted-foreground" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    {photoPreview && (
                      <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Pencil className="h-6 w-6 text-white" />
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      {t("auth.photoQualityHint")}
                    </p>
                    {photoFile && (
                      <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                        <CheckCircle className="h-4 w-4" /> {t("auth.photoSelectedShort")}
                      </p>
                    )}
                    {errors.photo && <p className="text-sm text-destructive mt-1">{errors.photo}</p>}
                  </div>
                </div>
              </div>

              {/* Avatar Cropper Dialog */}
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
                  />
                </Suspense>
              )}

              <div className="space-y-2">
                <Label htmlFor="specialty">{t("auth.specializationLbl")}</Label>
                <Input
                  id="specialty"
                  placeholder={t("auth.specializationPh")}
                  value={formData.specialty}
                  onChange={(e) => { setFormData({ ...formData, specialty: e.target.value }); if (e.target.value.trim()) clearError("specialty"); }}
                  className={errors.specialty ? "border-destructive" : ""}
                />
                {errors.specialty && <p className="text-sm text-destructive">{errors.specialty}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="experience">{t("auth.experienceLbl")}</Label>
                <Input
                  id="experience"
                  type="number"
                  min="0"
                  value={formData.experienceYears}
                  onChange={(e) => { setFormData({ ...formData, experienceYears: e.target.value }); if (e.target.value.trim()) clearError("experienceYears"); }}
                  className={errors.experienceYears ? "border-destructive" : ""}
                />
                {errors.experienceYears && <p className="text-sm text-destructive">{errors.experienceYears}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="education">{t("auth.educationDetailLbl")}</Label>
                <Textarea
                  id="education"
                  placeholder={t("auth.educationDetailPh")}
                  value={formData.education}
                  onChange={(e) => { setFormData({ ...formData, education: e.target.value }); if (e.target.value.trim()) clearError("education"); }}
                  rows={3}
                  className={errors.education ? "border-destructive" : ""}
                />
                {errors.education && <p className="text-sm text-destructive">{errors.education}</p>}
              </div>

              <div className="space-y-2">
                <Label>{t("auth.certificatesAndCourses")}</Label>
                {certifications.map((cert, index) => (
                  <Input
                    key={index}
                    placeholder={t("auth.certificateNamePh")}
                    value={cert}
                    onChange={(e) => {
                      const newCerts = [...certifications];
                      newCerts[index] = e.target.value;
                      setCertifications(newCerts);
                    }}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCertifications([...certifications, ""])}
                >
                  {t("auth.addCertificate")}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">{t("auth.aboutSelfLbl")}</Label>
                <Textarea
                  id="bio"
                  placeholder={t("auth.aboutSelfPh")}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={4}
                />
              </div>

              {/* Location Selection */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">{t("auth.location")}</h3>
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
                  onLocationChange={(lat, lng) => setFormData((p) => ({ ...p, latitude: lat, longitude: lng }))}
                  disabled={loading}
                  errors={{ region: errors.region, address: errors.address }}
                />
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">{t("auth.docsUploadHeading")}</h3>

                <div className="space-y-2">
                  <Label htmlFor="license-file">{t("auth.licenseLbl")}</Label>
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
                  <Label htmlFor="diploma-file">{t("auth.diplomaLbl2")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="diploma-file"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => { setDiplomaFile(e.target.files?.[0] || null); if (e.target.files?.[0]) clearError("diploma"); }}
                      className={errors.diploma ? "border-destructive" : ""}
                    />
                    {diplomaFile && <CheckCircle className="h-5 w-5 text-green-500" />}
                  </div>
                  {errors.diploma && <p className="text-sm text-destructive">{errors.diploma}</p>}
                </div>
              </div>

              <div className="pt-4 border-t">
                <DoctorPartnershipAgreement
                  accepted={agreementAccepted}
                  onAcceptChange={(v) => { setAgreementAccepted(v); if (v) clearError("agreement"); }}
                />
                {errors.agreement && <p className="text-sm text-destructive mt-2">{errors.agreement}</p>}
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
