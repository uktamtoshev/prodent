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
import { Loader2, CheckCircle, ImagePlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AvatarCropper } from "@/components/ui/avatar-cropper";
import { LocationSelector } from "./LocationSelector";

export function ClinicApplicationForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    address: "",
    country: "Узбекистан",
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
      if (!logoFile) {
        toast.error("Загрузите логотип клиники");
        return;
      }

      if (!licenseFile || !registrationFile) {
        toast.error("Загрузите все обязательные документы");
        return;
      }

      const user = (await supabase.auth.getUser()).data.user;
      const profile = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (!user || !profile.data) {
        toast.error("Ошибка получения данных пользователя");
        return;
      }

      // Upload documents and logo
      const licenseUrl = await handleFileUpload(licenseFile, "clinic-licenses");
      const registrationUrl = await handleFileUpload(registrationFile, "clinic-registration");
      const logoUrl = await handleFileUpload(logoFile!, "clinic-logos");

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
              Заявка на регистрацию клиники
            </CardTitle>
            <CardDescription>
              Заполните все поля и загрузите необходимые документы. Ваша заявка будет проверена администратором в течение 1-2 рабочих дней.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Logo upload section */}
              <div className="space-y-3">
                <Label>Логотип клиники *</Label>
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
                      Загрузите логотип вашей клиники. Это будет первое, что увидят пациенты.
                    </p>
                    {logoFile && (
                      <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                        <CheckCircle className="h-4 w-4" /> Логотип выбран
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Logo Cropper Dialog */}
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
                  circularCrop={false}
                />
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Название клиники *</Label>
                <Input
                  id="name"
                  placeholder="Например: DentalPro Clinic"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание клиники</Label>
                <Textarea
                  id="description"
                  placeholder="Расскажите о вашей клинике, услугах и преимуществах"
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
                onCountryChange={(value) => setFormData({ ...formData, country: value, region: "", district: "" })}
                onRegionChange={(value) => setFormData({ ...formData, region: value, district: "" })}
                onDistrictChange={(value) => setFormData({ ...formData, district: value })}
                onAddressChange={(value) => setFormData({ ...formData, address: value })}
                onLocationChange={(lat, lng) => setFormData({ ...formData, latitude: lat, longitude: lng })}
                disabled={loading}
              />

              <div className="space-y-2">
                <Label htmlFor="website">Веб-сайт</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="director">ФИО директора *</Label>
                <Input
                  id="director"
                  placeholder="Иванов Иван Иванович"
                  value={formData.directorName}
                  onChange={(e) => setFormData({ ...formData, directorName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="license">Номер лицензии *</Label>
                <Input
                  id="license"
                  placeholder="Введите номер медицинской лицензии"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Загрузка документов</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="license-file">Медицинская лицензия (скан) *</Label>
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
                  <Label htmlFor="registration-file">Свидетельство о регистрации (скан) *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="registration-file"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setRegistrationFile(e.target.files?.[0] || null)}
                      required
                    />
                    {registrationFile && <CheckCircle className="h-5 w-5 text-green-500" />}
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
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
