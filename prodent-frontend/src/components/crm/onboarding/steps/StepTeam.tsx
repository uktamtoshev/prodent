import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

interface TeamMember {
  full_name: string;
  phone: string;
  role: string;
}

interface StepTeamProps {
  onNext: () => void;
  /** Omitted when this is the first step of the wizard — then no Back button. */
  onBack?: () => void;
  onSkip: () => void;
}

export function StepTeam({ onNext, onBack, onSkip }: StepTeamProps) {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([
    { full_name: "", phone: "", role: "doctor" },
  ]);

  const addMember = () => {
    setMembers([...members, { full_name: "", phone: "", role: "doctor" }]);
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: keyof TeamMember, value: string) => {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    setMembers(updated);
  };

  const handleSave = async () => {
    const validMembers = members.filter((m) => m.full_name.trim());
    if (validMembers.length === 0) {
      onSkip();
      return;
    }

    setLoading(true);
    try {
      // Note: In a real flow, we'd invite members via email/phone
      // For now, we just show a success message and move on
      toast({
        title: t('crmStepTeam.memberAdded'),
        description: t('crmStepTeam.teamDesc'),
      });
      onNext();
    } catch {
      toast({ title: t('crmStepTeam.addError'), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const roleLabels = useMemo<Record<string, string>>(() => ({
    doctor: t('crmStepTeam.doctor'),
    assistant: t('crmStepTeam.assistant'),
    clinic_manager: t('crmStepTeam.manager'),
    accountant: t('crmStepTeam.manager'),
  }), [t]);

  return (
    <Card className="border-border">
      <CardHeader className="text-center pb-2">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Users className="w-7 h-7 text-primary" />
        </div>
        <CardTitle className="text-xl">{t('crmStepTeam.addTeam')}</CardTitle>
        <CardDescription>{t('crmStepTeam.teamDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {members.map((member, index) => (
          <div key={index} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs" htmlFor="step-team-field-1">{t('crmStepTeam.fullName')}</Label>
              <Input id="step-team-field-1"
                value={member.full_name}
                onChange={(e) => updateMember(index, "full_name", e.target.value)}
                placeholder={t('crmStepTeam.fullNamePlaceholder')}
              />
            </div>
            <div className="w-[130px] space-y-1">
              <Label className="text-xs">{t('crmStepTeam.role')}</Label>
              <Select value={member.role} onValueChange={(v) => updateMember(index, "role", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {members.length > 1 && (
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeMember(index)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}

        <Button variant="outline" className="w-full gap-2" onClick={addMember}>
          <Plus className="w-4 h-4" /> {t('crmStepTeam.addMember')}
        </Button>

        <div className="flex gap-2 pt-2">
          {onBack && (
            <Button variant="outline" onClick={onBack} className="flex-1">{t('crmStepTeam.back')}</Button>
          )}
          <Button variant="ghost" onClick={onSkip} className="flex-1">{t('crmStepTeam.skip')}</Button>
          <Button onClick={handleSave} className="flex-1" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('crmStepTeam.next')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
