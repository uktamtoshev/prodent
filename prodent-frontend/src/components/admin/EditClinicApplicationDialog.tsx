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

interface ClinicApplication {
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
  const [formData, setFormData] = useState<ClinicApplication | null>(null);

  // Initialize form data when application changes or dialog opens
  useEffect(() => {
    if (open && application) {
      setFormData({ ...application });
    }
  }, [open, application]);

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
      toast.success("Заявка обновлена");
      queryClient.invalidateQueries({ queryKey: ["clinic-applications"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Ошибка обновления", { description: error.message });
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
          <DialogTitle>Редактировать заявку клиники</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название клиники</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="director_name">Директор</Label>
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
              <Label htmlFor="city">Город</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">Район</Label>
              <Input
                id="district"
                value={formData.district || ""}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Адрес</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="license_number">Номер лицензии</Label>
              <Input
                id="license_number"
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Веб-сайт</Label>
              <Input
                id="website"
                value={formData.website || ""}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
