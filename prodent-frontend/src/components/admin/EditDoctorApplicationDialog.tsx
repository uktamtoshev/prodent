import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export interface DoctorApplication {
  id: string;
  full_name: string;
  specialty: string;
  experience_years: number;
  education: string;
  certifications: string[];
  bio: string | null;
  email: string;
  phone: string;
  license_number: string;
}

interface EditDoctorApplicationDialogProps {
  application: DoctorApplication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditDoctorApplicationDialog({
  application,
  open,
  onOpenChange
}: EditDoctorApplicationDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [formData, setFormData] = useState<DoctorApplication | null>(null);

  // Initialize form data when application changes or dialog opens
  useEffect(() => {
    if (open && application) {
      setFormData({ ...application });
    }
  }, [open, application]);

  const updateMutation = useMutation({
    mutationFn: async (data: DoctorApplication) => {
      const { error } = await supabase
        .from("doctor_applications")
        .update({
          full_name: data.full_name,
          specialty: data.specialty,
          experience_years: data.experience_years,
          education: data.education,
          certifications: data.certifications,
          bio: data.bio,
          email: data.email,
          phone: data.phone,
          license_number: data.license_number,
        })
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("adminEditDoctorApp.updated"));
      queryClient.invalidateQueries({ queryKey: ["doctor-applications"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(t("adminEditDoctorApp.updateError"), { description: error instanceof Error ? error.message : t("adminEditDoctorApp.updateError") });
    },
  });

  if (!formData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleCertificationsChange = (value: string) => {
    setFormData({
      ...formData,
      certifications: value.split("\n").filter(c => c.trim()),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("adminEditDoctorApp.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">{t("adminEditDoctorApp.labelFullName")}</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialty">{t("adminEditDoctorApp.labelSpecialty")}</Label>
              <Input
                id="specialty"
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="experience_years">{t("adminEditDoctorApp.labelExperience")}</Label>
              <Input
                id="experience_years"
                type="number"
                min="0"
                value={formData.experience_years}
                onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="license_number">{t("adminEditDoctorApp.labelLicense")}</Label>
              <Input
                id="license_number"
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("adminEditDoctorApp.labelEmail")}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("adminEditDoctorApp.labelPhone")}</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="education">{t("adminEditDoctorApp.labelEducation")}</Label>
            <Input
              id="education"
              value={formData.education}
              onChange={(e) => setFormData({ ...formData, education: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">{t("adminEditDoctorApp.labelBio")}</Label>
            <Textarea
              id="bio"
              value={formData.bio || ""}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="certifications">{t("adminEditDoctorApp.labelCerts")}</Label>
            <Textarea
              id="certifications"
              value={formData.certifications.join("\n")}
              onChange={(e) => handleCertificationsChange(e.target.value)}
              rows={3}
              placeholder={t("adminEditDoctorApp.placeholderCerts")}
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
