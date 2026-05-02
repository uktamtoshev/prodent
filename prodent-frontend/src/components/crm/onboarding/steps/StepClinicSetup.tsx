import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2 } from "lucide-react";

interface StepClinicSetupProps {
  onNext: () => void;
}

export function StepClinicSetup({ onNext }: StepClinicSetupProps) {
  const { currentClinic, refreshClinics } = useClinic();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: currentClinic?.name || "",
    phone: "",
    address: "",
    city: "",
    description: "",
  });

  // If clinic already exists, just allow updating and moving on
  const hasClinic = !!currentClinic?.id;

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Укажите название клиники", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (hasClinic) {
        // Update existing clinic
        const { error } = await supabase
          .from("clinics")
          .update({
            name: form.name,
            phone: form.phone || currentClinic?.name || "",
            address: form.address || "",
            city: form.city || "",
            description: form.description || null,
          })
          .eq("id", currentClinic!.id);
        if (error) throw error;
      }
      await refreshClinics();
      toast({ title: "Клиника настроена ✓" });
      onNext();
    } catch (error) {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="text-center pb-2">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Building2 className="w-7 h-7 text-primary" />
        </div>
        <CardTitle className="text-xl">Настройте клинику</CardTitle>
        <CardDescription>
          {hasClinic ? "Проверьте и обновите данные вашей клиники" : "Введите основную информацию о клинике"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Название клиники *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Стоматология ProDent" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Телефон</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998 90 123 45 67" />
          </div>
          <div>
            <Label>Город</Label>
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ташкент" />
          </div>
        </div>
        <div>
          <Label>Адрес</Label>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="ул. Навои, 100" />
        </div>
        <div>
          <Label>Описание</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Краткое описание клиники" rows={3} />
        </div>
        <Button onClick={handleSave} className="w-full" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {hasClinic ? "Обновить и продолжить" : "Сохранить и продолжить"}
        </Button>
      </CardContent>
    </Card>
  );
}
