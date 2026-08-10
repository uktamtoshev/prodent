import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { LocationSelector } from "./LocationSelector";
import { useLanguage } from "@/contexts/LanguageContext";

// Verification application for a dental-lab technician. Mirrors the doctor/clinic
// flow: the applicant (a freshly-registered PATIENT) submits their lab details +
// a license/diploma document; a SUPER_ADMIN approves in /admin/verification, which
// grants the TECHNICIAN role. The lab_profile is created lazily on the
// technician's first visit to /technician/profile, so nothing extra is needed here.
export function TechnicianApplicationForm() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    labName: "",
    region: "",
    district: "",
    address: "",
    phone: "",
    experienceYears: "",
    description: "",
  });
  const [licenseFile, setLicenseFile] = useState<File | null>(null);

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      if (!e[k]) return e;
      const n = { ...e };
      delete n[k];
      return n;
    });
  };

  const uploadDoc = async (file: File) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error(t("auth.userNotAuthed"));
    const ext = file.name.split(".").pop();
    const path = `${user.id}/technician-licenses/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
    if (upErr) throw upErr;
    return supabase.storage.from("documents").getPublicUrl(path).data.publicUrl;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.labName.trim()) e.labName = t("auth.fieldRequired");
    if (!form.region) e.region = t("auth.errRegion");
    if (!form.address.trim()) e.address = t("auth.errAddress");
    if (!licenseFile) e.license = t("auth.fieldRequired");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .maybeSingle();

      const licenseUrl = await uploadDoc(licenseFile!);

      const { error } = await supabase.from("technician_applications").insert({
        user_id: user.id,
        full_name: profile?.full_name || user.user_metadata?.full_name || null,
        phone: form.phone.trim() || profile?.phone || user.phone || null,
        email: user.email || null,
        lab_name: form.labName.trim(),
        // Keep the legacy `city` column populated from region for back-compat.
        city: form.region || null,
        region: form.region || null,
        district: form.district || null,
        address: form.address.trim() || null,
        description: form.description.trim() || null,
        experience_years: form.experienceYears ? parseInt(form.experienceYears) : null,
        license_document_url: licenseUrl,
        status: "pending",
      });
      if (error) throw error;

      toast.success(t("auth.applicationSent"), { description: t("auth.applicationSentDesc") });
      setTimeout(() => navigate("/"), 2000);
    } catch (err: unknown) {
      toast.error(t("auth.applicationError"), { description: err instanceof Error ? err.message : t("auth.applicationError") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" data-testid="application-form-technician">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-primary" />
              {t("auth.techAppTitle")}
            </CardTitle>
            <CardDescription>{t("auth.techAppDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="labName">{t("auth.techLabNameLbl")}</Label>
                <Input
                  id="labName"
                  placeholder={t("auth.techLabNamePh")}
                  value={form.labName}
                  onChange={(e) => set("labName", e.target.value)}
                  className={errors.labName ? "border-destructive" : ""}
                />
                {errors.labName && <p className="text-sm text-destructive">{errors.labName}</p>}
              </div>

              {/* Область / Район (селекты) + Адрес (произвольно) */}
              <LocationSelector
                region={form.region}
                district={form.district}
                address={form.address}
                onRegionChange={(v) => set("region", v)}
                onDistrictChange={(v) => set("district", v)}
                onAddressChange={(v) => set("address", v)}
                showMap={false}
                disabled={loading}
                errors={{ region: errors.region, address: errors.address }}
              />

              <div className="space-y-2">
                <Label htmlFor="phone">{t("auth.contactPhoneLabel")}</Label>
                <Input
                  id="phone"
                  placeholder="+998 90 123 45 67"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exp">{t("auth.experienceLbl")}</Label>
                <Input
                  id="exp"
                  type="number"
                  min="0"
                  value={form.experienceYears}
                  onChange={(e) => set("experienceYears", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">{t("auth.techDescLbl")}</Label>
                <Textarea
                  id="desc"
                  placeholder={t("auth.techDescPh")}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="license-file">{t("auth.techLicenseLbl")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="license-file"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      setLicenseFile(e.target.files?.[0] || null);
                      if (e.target.files?.[0]) setErrors((er) => ({ ...er, license: "" }));
                    }}
                    className={errors.license ? "border-destructive" : ""}
                  />
                  {licenseFile && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>
                {errors.license && <p className="text-sm text-destructive">{errors.license}</p>}
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
