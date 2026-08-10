import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { InitialsAvatar as Avatar } from "@/components/shared/InitialsAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit2, Loader2, Plus, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/edge-function-error";
import {
  clearPatientDraft,
  loadPatientDraft,
  savePatientDraft,
} from "@/lib/patient-cabinet";

interface FamilyMember {
  id: string;
  full_name: string;
  relationship: string;
  birth_date: string | null;
  gender: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
}

const EMPTY_FAMILY_FORM = {
  full_name: "",
  relationship: "",
  birth_date: "",
  gender: "",
  phone: "",
  notes: "",
};

const calculateAge = (birthDate: string | null) => {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const PatientFamily = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const relationshipLabel = (rel: string) => {
    switch (rel) {
      case "child":
        return t("patientCabinet.relChildLabel");
      case "parent":
        return t("patientCabinet.relParentLabel");
      case "spouse":
        return t("patientCabinet.relSpouseLabel");
      case "sibling":
        return t("patientCabinet.relSiblingLabel");
      default:
        return rel;
    }
  };

  const yearsWord = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return t("patientCabinet.yearsOne");
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return t("patientCabinet.yearsFew");
    return t("patientCabinet.yearsMany");
  };

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);

  const [formData, setFormData] = useState(() =>
    loadPatientDraft("family", user?.id, EMPTY_FAMILY_FORM),
  );
  const draftUserRef = useRef<string | null>(user?.id ?? null);

  useEffect(() => {
    if (!user?.id) return;
    if (draftUserRef.current !== user.id) {
      draftUserRef.current = user.id;
      setFormData(loadPatientDraft("family", user.id, EMPTY_FAMILY_FORM));
      return;
    }
    savePatientDraft("family", user?.id, formData);
  }, [formData, user?.id]);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("patient_family_members")
        .select("*")
        .eq("main_patient_id", user?.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (data) setMembers(data);
    } catch (error) {
      console.error("Error fetching family members:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) void fetchMembers();
  }, [user?.id, fetchMembers]);

  const resetForm = () => {
    setFormData(EMPTY_FAMILY_FORM);
    setEditingMember(null);
  };

  const openEditDialog = (member: FamilyMember) => {
    setEditingMember(member);
    setFormData({
      full_name: member.full_name,
      relationship: member.relationship,
      birth_date: member.birth_date || "",
      gender: member.gender || "",
      phone: member.phone || "",
      notes: member.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.full_name || !formData.relationship) {
      toast({
        title: t("common.error"),
        description: t("patientCabinet.requiredFieldsError"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        full_name: formData.full_name,
        relationship: formData.relationship,
        birth_date: formData.birth_date || null,
        gender: formData.gender || null,
        phone: formData.phone || null,
        notes: formData.notes || null,
      };
      if (editingMember) {
        const { error } = await supabase
          .from("patient_family_members")
          .update(payload)
          .eq("id", editingMember.id);
        if (error) throw error;
        toast({ title: t("patientCabinet.profileUpdated") });
      } else {
        const { error } = await supabase
          .from("patient_family_members")
          .insert({ main_patient_id: user?.id, ...payload });
        if (error) throw error;
        toast({ title: t("patientCabinet.profileAdded") });
      }
      setDialogOpen(false);
      clearPatientDraft("family", user?.id);
      resetForm();
      fetchMembers();
    } catch (error: unknown) {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t("common.error")),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("patient_family_members")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
      toast({ title: t("patientCabinet.profileDeleted") });
      fetchMembers();
    } catch (error: unknown) {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t("common.error")),
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--brand))]" />
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="mx-auto max-w-[900px] p-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-[12.5px] text-slate-500">{t("patientCabinet.familyAccount")}</div>
            <h2 className="font-heading text-[24px] font-bold tracking-tight text-slate-900">
              {t("patientCabinet.family")}
            </h2>
          </div>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-[10px] bg-[hsl(var(--brand))] px-4 py-2 text-[13px] font-medium text-white hover:bg-[hsl(var(--brand-700))]">
                <Plus className="h-4 w-4" />
                {t("patientCabinet.addFamilyMember")}
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingMember ? t("patientCabinet.editProfile") : t("patientCabinet.addFamilyMember")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t("patientCabinet.fullNameLabel")} *</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    placeholder={t("patientCabinet.enterFullName")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("patientCabinet.relationshipLabel")} *</Label>
                  <Select
                    value={formData.relationship}
                    onValueChange={(value) =>
                      setFormData({ ...formData, relationship: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("patientCabinet.selectOption")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="child">{t("patientCabinet.relChild")}</SelectItem>
                      <SelectItem value="parent">{t("patientCabinet.relParent")}</SelectItem>
                      <SelectItem value="spouse">{t("patientCabinet.relSpouse")}</SelectItem>
                      <SelectItem value="sibling">{t("patientCabinet.relSibling")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("patientCabinet.birthDateLabel")}</Label>
                    <Input
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) =>
                        setFormData({ ...formData, birth_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("patientCabinet.genderLabel")}</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) =>
                        setFormData({ ...formData, gender: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("patientCabinet.selectOption")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">{t("patientCabinet.genderMale")}</SelectItem>
                        <SelectItem value="female">{t("patientCabinet.genderFemale")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("patientCabinet.phoneLabel")}</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="+998 90 123 45 67"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("patientCabinet.notesLabel")}</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder={t("patientCabinet.additionalInfo")}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingMember ? t("common.save") : t("common.add")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {members.length > 0 ? (
          <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            {members.map((member) => {
              const age = calculateAge(member.birth_date);
              const roleText = relationshipLabel(member.relationship);
              const roleLine =
                age !== null ? `${roleText} · ${age} ${yearsWord(age)}` : roleText;
              return (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 hover:bg-slate-50/60"
                >
                  <Avatar name={member.full_name} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-heading text-[14px] font-semibold text-slate-900">
                      {member.full_name}
                    </div>
                    <div className="text-[12px] text-slate-500">
                      {roleLine}
                      {member.phone ? ` · ${member.phone}` : ""}
                    </div>
                  </div>
                  {member.notes && (
                    <div className="hidden max-w-[220px] truncate text-[12.5px] text-slate-600 md:block">
                      {member.notes}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditDialog(member)}
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      {t("patientCabinet.editAction")}
                    </button>
                    <button
                      onClick={() => handleDelete(member.id)}
                      className="grid h-8 w-8 place-items-center rounded-[10px] border border-border bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title={t("common.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[14px] border border-border bg-card px-6 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <div className="font-heading text-[16px] font-semibold text-slate-900">
              {t("patientCabinet.noProfiles")}
            </div>
            <div className="mt-1 text-[13px] text-slate-500">
              {t("patientCabinet.noProfilesDesc")}
            </div>
            <button
              onClick={() => setDialogOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] bg-[hsl(var(--brand))] px-4 py-2 text-[13px] font-medium text-white hover:bg-[hsl(var(--brand-700))]"
            >
              <Plus className="h-4 w-4" />
              {t("patientCabinet.addFamilyMember")}
            </button>
          </div>
        )}
      </div>
    </PatientLayout>
  );
};

export default PatientFamily;
