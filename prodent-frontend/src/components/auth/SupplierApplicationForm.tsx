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

// Verification application for a marketplace supplier (юр. лицо). Mirrors the
// technician/doctor/clinic flow: the applicant (a freshly-registered PATIENT)
// submits the company details + a company-registration certificate (Гувохнома,
// required) and an optional sale/service license. A SUPER_ADMIN approves it in
// /admin/verification, which grants the SELLER role. Rows go through the generic
// /api/v1/data proxy (owner-scoped + decision-gated — see DataController).
export function SupplierApplicationForm() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    companyName: "",
    region: "",
    district: "",
    address: "",
    phone: "",
    description: "",
  });
  const [guvohnomaFile, setGuvohnomaFile] = useState<File | null>(null);
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

  // Upload a document to the private `documents` bucket under the user's folder.
  const uploadDoc = async (file: File, kind: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error(t("auth.userNotAuthed"));
    const ext = file.name.split(".").pop();
    const path = `${user.id}/supplier-docs/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
    if (upErr) throw upErr;
    return supabase.storage.from("documents").getPublicUrl(path).data.publicUrl;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.companyName.trim()) e.companyName = t("auth.fieldRequired");
    if (!form.region) e.region = t("auth.errRegion");
    if (!form.address.trim()) e.address = t("auth.errAddress");
    // Гувохнома (company registration certificate) is mandatory; the license is not.
    if (!guvohnomaFile) e.guvohnoma = t("auth.fieldRequired");
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

      const guvohnomaUrl = await uploadDoc(guvohnomaFile!, "guvohnoma");
      const licenseUrl = licenseFile ? await uploadDoc(licenseFile, "license") : null;

      const companyName = form.companyName.trim();
      const { error } = await supabase.from("supplier_applications").insert({
        user_id: user.id,
        full_name: companyName || profile?.full_name || null,
        company_name: companyName,
        phone: form.phone.trim() || profile?.phone || user.phone || null,
        email: user.email || null,
        region: form.region || null,
        district: form.district || null,
        address: form.address.trim() || null,
        description: form.description.trim() || null,
        guvohnoma_document_url: guvohnomaUrl,
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
    <div className="min-h-screen flex flex-col bg-background" data-testid="application-form-supplier">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-primary" />
              {t("auth.supAppTitle")}
            </CardTitle>
            <CardDescription>{t("auth.supAppDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="companyName">{t("auth.supCompanyLbl")}</Label>
                <Input
                  id="companyName"
                  placeholder={t("auth.supCompanyPh")}
                  value={form.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                  className={errors.companyName ? "border-destructive" : ""}
                />
                {errors.companyName && <p className="text-sm text-destructive">{errors.companyName}</p>}
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
                <Label htmlFor="desc">{t("auth.supDescLbl")}</Label>
                <Textarea
                  id="desc"
                  placeholder={t("auth.supDescPh")}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="guvohnoma-file">{t("auth.supGuvohnomaLbl")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="guvohnoma-file"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      setGuvohnomaFile(e.target.files?.[0] || null);
                      if (e.target.files?.[0]) setErrors((er) => ({ ...er, guvohnoma: "" }));
                    }}
                    className={errors.guvohnoma ? "border-destructive" : ""}
                  />
                  {guvohnomaFile && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>
                {errors.guvohnoma && <p className="text-sm text-destructive">{errors.guvohnoma}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="license-file">{t("auth.supLicenseLbl")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="license-file"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                  />
                  {licenseFile && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>
                <p className="text-xs text-muted-foreground">{t("auth.supLicenseHint")}</p>
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
