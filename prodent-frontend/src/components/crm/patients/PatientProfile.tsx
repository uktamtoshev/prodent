import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { User, Phone, Mail, Calendar, MapPin, Edit2, Save, X } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";

interface PatientProfileProps {
  patient: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    birth_date: string | null;
    gender: string | null;
    address: string | null;
    notes: string | null;
    created_at: string;
  };
}

export function PatientProfile({ patient }: PatientProfileProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: patient.full_name || "",
    phone: patient.phone || "",
    email: patient.email || "",
    birth_date: patient.birth_date || "",
    gender: patient.gender || "",
    address: patient.address || "",
    notes: patient.notes || "",
  });

  const handleSave = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          email: formData.email,
          date_of_birth: formData.birth_date || null,
          gender: formData.gender || null,
          address: formData.address || null,
          notes: formData.notes || null,
        })
        .eq("id", patient.id);

      if (error) throw error;

      toast.success(t('crmPatientProfile.dataUpdated'));
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["patient-detail", patient.id] });
    } catch (error) {
      console.error("Error updating patient:", error);
      toast.error(t('crmPatientProfile.dataUpdateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: patient.full_name || "",
      phone: patient.phone || "",
      email: patient.email || "",
      birth_date: patient.birth_date || "",
      gender: patient.gender || "",
      address: patient.address || "",
      notes: patient.notes || "",
    });
    setIsEditing(false);
  };

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(patient.birth_date);

  if (isEditing) {
    return (
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Edit2 className="w-5 h-5" />
              {t('crmPatientProfile.editProfileTitle')}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={loading}>
                <X className="w-4 h-4 mr-1" />
                {t('crmPatientProfile.cancel')}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={loading}>
                <Save className="w-4 h-4 mr-1" />
                {t('crmPatientProfile.save')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="patient-profile-field-1">{t('crmPatientProfile.fioLabel')}</Label>
              <Input id="patient-profile-field-1"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="bg-muted/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-profile-field-2">{t('crmPatientProfile.phoneLabel')}</Label>
              <Input id="patient-profile-field-2"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-muted/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-profile-field-3">{t('crmPatientProfile.emailLabel')}</Label>
              <Input id="patient-profile-field-3"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-muted/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-profile-field-4">{t('crmPatientProfile.birthDateLabel')}</Label>
              <Input id="patient-profile-field-4"
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                className="bg-muted/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('crmPatientProfile.genderLabel')}</Label>
              <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue placeholder={t('crmPatientProfile.genderPh')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t('crmPatientProfile.male')}</SelectItem>
                  <SelectItem value="female">{t('crmPatientProfile.female')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-profile-field-5">{t('crmPatientProfile.addressLabel')}</Label>
              <Input id="patient-profile-field-5"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="bg-muted/50 border-border"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="patient-profile-field-6">{t('crmPatientProfile.notesLabel')}</Label>
            <Textarea id="patient-profile-field-6"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="bg-muted/50 border-border"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <User className="w-5 h-5" />
            {t('crmPatientProfile.profileTitle')}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit2 className="w-4 h-4 mr-1" />
            {t('crmPatientProfile.edit')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('crmPatientProfile.fioLabel')}</p>
                <p className="font-medium text-foreground">{patient.full_name || "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('crmPatientProfile.phoneLabel')}</p>
                <p className="font-medium text-foreground">{patient.phone || "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('crmPatientProfile.emailLabel')}</p>
                <p className="font-medium text-foreground">{patient.email || "—"}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('crmPatientProfile.birthDateLabel')}</p>
                <p className="font-medium text-foreground">
                  {patient.birth_date
                    ? `${format(new Date(patient.birth_date), "d MMMM yyyy", { locale: ru })}${age !== null ? ` (${age} ${t('crmPatientProfile.yearsSuffix')})` : ""}`
                    : "—"
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('crmPatientProfile.genderLabel')}</p>
                <p className="font-medium text-foreground">
                  {patient.gender === "male" ? t('crmPatientProfile.male') : patient.gender === "female" ? t('crmPatientProfile.female') : "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('crmPatientProfile.addressLabel')}</p>
                <p className="font-medium text-foreground">{patient.address || "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {patient.notes && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">{t('crmPatientProfile.notesLabel')}</p>
            <p className="text-foreground">{patient.notes}</p>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-border/50 text-sm text-muted-foreground">
          {t('crmPatientProfile.patientSince')} {format(new Date(patient.created_at), "d MMMM yyyy", { locale: ru })}
        </div>
      </CardContent>
    </Card>
  );
}
