import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/api/client";
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
import { AvatarCropper } from "@/components/ui/avatar-cropper";
import { LocationSelector } from "./LocationSelector";

export function DoctorApplicationForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [formData, setFormData] = useState({
    specialty: "",
    experienceYears: "",
    education: "",
    bio: "",
    country: "Узбекистан",
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
  };

  const handleFileUpload = async (file: File, folder: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("User not authenticated");

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${folder}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("application-documents")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("application-documents")
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!agreementAccepted) {
        toast.error("Необходимо принять условия партнёрского соглашения");
        setLoading(false);
        return;
      }

      if (!photoFile) {
        toast.error("Загрузите фото профиля");
        setLoading(false);
        return;
      }

      if (!licenseFile || !diplomaFile) {
        toast.error("Загрузите все обязательные документы");
        setLoading(false);
        return;
      }

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        toast.error("Пользователь не авторизован");
        return;
      }

      // Build full_name from separate fields if not set
      const buildFullName = () => {
        const meta = user.user_metadata;
        if (meta?.full_name) return meta.full_name;
        const parts = [meta?.last_name, meta?.first_name, meta?.middle_name].filter(Boolean);
        return parts.join(" ") || "Врач";
      };

      // Get or create profile
      let { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

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
          toast.error("Ошибка создания профиля");
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

      // Upload documents and photo
      const licenseUrl = await handleFileUpload(licenseFile, "licenses");
      const diplomaUrl = await handleFileUpload(diplomaFile, "diplomas");
      const photoUrl = await handleFileUpload(photoFile!, "photos");

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
        certifications: certifications.filter((c) => c.trim() !== ""),
        bio: formData.bio,
        price_from: 100000,
        verified: false,
        images: photoUrl ? [photoUrl] : null,
        address: `${formData.region}, ${formData.district}, ${formData.address}`,
        latitude: formData.latitude,
        longitude: formData.longitude,
      }).select().single();

      if (doctorError) throw doctorError;

      // Add doctor role to user_roles
      await supabase.from("user_roles").insert({
        user_id: user.id,
        role: "doctor" as any,
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

      toast.success("Заявка отправлена на проверку!", {
        description: "Мы проверим ваши документы в течение 1-2 рабочих дней",
      });

      setTimeout(() => navigate("/"), 2000);
    } catch (error: any) {
      toast.error("Ошибка отправки заявки", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-primary" />
              Заявка на регистрацию врача
            </CardTitle>
            <CardDescription>
              Заполните все поля и загрузите необходимые документы. Ваша заявка будет проверена администратором в течение 1-2 рабочих дней.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Photo upload section */}
              <div className="space-y-3">
                <Label>Фото профиля *</Label>
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
                      Загрузите качественное фото для вашего профиля. Это первое, что увидят пациенты.
                    </p>
                    {photoFile && (
                      <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                        <CheckCircle className="h-4 w-4" /> Фото выбрано
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Avatar Cropper Dialog */}
              {tempImageSrc && (
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
              )}

              <div className="space-y-2">
                <Label htmlFor="specialty">Специализация *</Label>
                <Input
                  id="specialty"
                  placeholder="Например: Стоматолог-терапевт"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="experience">Опыт работы (лет) *</Label>
                <Input
                  id="experience"
                  type="number"
                  min="0"
                  value={formData.experienceYears}
                  onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="education">Образование *</Label>
                <Textarea
                  id="education"
                  placeholder="Укажите учебное заведение, год окончания, специальность"
                  value={formData.education}
                  onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                  required
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Сертификаты и курсы повышения квалификации</Label>
                {certifications.map((cert, index) => (
                  <Input
                    key={index}
                    placeholder="Название сертификата"
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
                  Добавить сертификат
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">О себе</Label>
                <Textarea
                  id="bio"
                  placeholder="Расскажите о своем опыте и достижениях"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={4}
                />
              </div>

              {/* Location Selection */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Местоположение</h3>
                <LocationSelector
                  country={formData.country}
                  region={formData.region}
                  district={formData.district}
                  address={formData.address}
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  onCountryChange={(value) => setFormData({ ...formData, country: value, region: "", district: "" })}
                  onRegionChange={(value) => setFormData({ ...formData, region: value, district: "" })}
                  onDistrictChange={(value) => setFormData({ ...formData, district: value })}
                  onAddressChange={(value) => setFormData({ ...formData, address: value })}
                  onLocationChange={(lat, lng) => setFormData({ ...formData, latitude: lat, longitude: lng })}
                  disabled={loading}
                />
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Загрузка документов</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="license-file">Лицензия (скан) *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="license-file"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                      required
                    />
                    {licenseFile && <CheckCircle className="h-5 w-5 text-green-500" />}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="diploma-file">Диплом (скан) *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="diploma-file"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setDiplomaFile(e.target.files?.[0] || null)}
                      required
                    />
                    {diplomaFile && <CheckCircle className="h-5 w-5 text-green-500" />}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <DoctorPartnershipAgreement
                  accepted={agreementAccepted}
                  onAcceptChange={setAgreementAccepted}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading || !agreementAccepted}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Отправить заявку
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
