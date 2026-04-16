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
          birth_date: formData.birth_date || null,
          gender: formData.gender || null,
          address: formData.address || null,
          notes: formData.notes || null,
        })
        .eq("id", patient.id);

      if (error) throw error;

      toast.success("Данные обновлены");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["patient-detail", patient.id] });
    } catch (error) {
      console.error("Error updating patient:", error);
      toast.error("Ошибка обновления данных");
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
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Edit2 className="w-5 h-5" />
              Редактирование профиля
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={loading}>
                <X className="w-4 h-4 mr-1" />
                Отмена
              </Button>
              <Button size="sm" onClick={handleSave} disabled={loading}>
                <Save className="w-4 h-4 mr-1" />
                Сохранить
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ФИО</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="bg-muted/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-muted/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-muted/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Дата рождения</Label>
              <Input
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                className="bg-muted/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Пол</Label>
              <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue placeholder="Выберите пол" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Мужской</SelectItem>
                  <SelectItem value="female">Женский</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Адрес</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="bg-muted/50 border-border"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Заметки</Label>
            <Textarea
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
          <CardTitle className="flex items-center gap-2 text-foreground">
            <User className="w-5 h-5" />
            Профиль пациента
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit2 className="w-4 h-4 mr-1" />
            Редактировать
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
                <p className="text-sm text-muted-foreground">ФИО</p>
                <p className="font-medium text-foreground">{patient.full_name || "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Телефон</p>
                <p className="font-medium text-foreground">{patient.phone || "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
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
                <p className="text-sm text-muted-foreground">Дата рождения</p>
                <p className="font-medium text-foreground">
                  {patient.birth_date 
                    ? `${format(new Date(patient.birth_date), "d MMMM yyyy", { locale: ru })}${age !== null ? ` (${age} лет)` : ""}`
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
                <p className="text-sm text-muted-foreground">Пол</p>
                <p className="font-medium text-foreground">
                  {patient.gender === "male" ? "Мужской" : patient.gender === "female" ? "Женский" : "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Адрес</p>
                <p className="font-medium text-foreground">{patient.address || "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {patient.notes && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Заметки</p>
            <p className="text-foreground">{patient.notes}</p>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-border/50 text-sm text-muted-foreground">
          Пациент с {format(new Date(patient.created_at), "d MMMM yyyy", { locale: ru })}
        </div>
      </CardContent>
    </Card>
  );
}
