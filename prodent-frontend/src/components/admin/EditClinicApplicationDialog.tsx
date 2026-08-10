import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export interface ClinicApplication {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  district: string | null;
  phone: string;
  email: string;
  website: string | null;
  director_name: string;
  license_number: string;
}

interface EditClinicApplicationDialogProps {
  application: ClinicApplication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditClinicApplicationDialog({
  application,
  open,
  onOpenChange
}: EditClinicApplicationDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [formData, setFormData] = useState<ClinicApplication | null>(null);
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);

  // Initialize form data when application changes or dialog opens
  useEffect(() => {
    if (open && application) {
      setFormData({ ...application });
    }
  }, [open, application]);

  // Load regions (Uzbekistan) for the City select when the dialog opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: countries } = await supabase
        .from("countries").select("id").eq("code", "UZ").limit(1);
      const uzId = countries?.[0]?.id;
      if (!uzId) return;
      const { data } = await supabase
        .from("regions").select("id, name")
        .eq("country_id", uzId).eq("is_active", true).order("sort_order");
      setRegions(data || []);
    })();
  }, [open]);

  // Load districts whenever the selected city (region name) changes
  useEffect(() => {
    const regionName = formData?.city;
    const region = regions.find((r) => r.name === regionName);
    if (!region) { setDistricts([]); return; }
    (async () => {
      const { data } = await supabase
        .from("districts").select("id, name")
        .eq("region_id", region.id).eq("is_active", true).order("sort_order");
      setDistricts(data || []);
    })();
  }, [formData?.city, regions]);

  const updateMutation = useMutation({
    mutationFn: async (data: ClinicApplication) => {
      const { error } = await supabase
        .from("clinic_applications")
        .update({
          name: data.name,
          description: data.description,
          address: data.address,
          city: data.city,
          district: data.district,
          phone: data.phone,
          email: data.email,
          website: data.website,
          director_name: data.director_name,
          license_number: data.license_number,
        })
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("adminEditClinicApp.updated"));
      queryClient.invalidateQueries({ queryKey: ["clinic-applications"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(t("adminEditClinicApp.updateError"), { description: error instanceof Error ? error.message : t("adminEditClinicApp.updateError") });
    },
  });

  if (!formData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("adminEditClinicApp.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("adminEditClinicApp.labelName")}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="director_name">{t("adminEditClinicApp.labelDirector")}</Label>
              <Input
                id="director_name"
                value={formData.director_name}
                onChange={(e) => setFormData({ ...formData, director_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">{t("adminEditClinicApp.labelCity")}</Label>
              <Select
                value={formData.city}
                onValueChange={(v) => setFormData({ ...formData, city: v, district: "" })}
              >
                <SelectTrigger id="city">
                  <SelectValue placeholder={t("auth.selectRegion")} />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((r) => (
                    <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">{t("adminEditClinicApp.labelDistrict")}</Label>
              <Select
                value={formData.district || ""}
                onValueChange={(v) => setFormData({ ...formData, district: v })}
                disabled={!formData.city || districts.length === 0}
              >
                <SelectTrigger id="district">
                  <SelectValue placeholder={districts.length === 0 ? t("auth.noDistricts") : t("auth.selectDistrict")} />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((d) => (
                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">{t("adminEditClinicApp.labelAddress")}</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("adminEditClinicApp.labelEmail")}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("adminEditClinicApp.labelPhone")}</Label>
              <Input
                id="phone"
                value={formData.phone}
                readOnly
                disabled
                className="cursor-not-allowed opacity-70"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="license_number">{t("adminEditClinicApp.labelLicense")}</Label>
              <Input
                id="license_number"
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">{t("adminEditClinicApp.labelWebsite")}</Label>
              <Input
                id="website"
                value={formData.website || ""}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("adminEditClinicApp.labelDescription")}</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("admin.cancel")}
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
