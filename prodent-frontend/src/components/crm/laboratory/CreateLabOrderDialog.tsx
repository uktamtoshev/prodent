import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { fetchClinicDoctors } from "@/hooks/useClinicDoctors";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Patient {
  id: string;
  full_name: string | null;
}

interface Doctor {
  id: string;
  user_id: string | null;
  profiles: { full_name: string | null } | null;
}

interface OrderItem {
  item_type: string;
  description: string;
  tooth_number: number | null;
  material: string;
  color: string;
  quantity: number;
  unit_price: number;
}

interface CreateLabOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preselectedPatientId?: string;
}

const orderTypes = [
  "Коронка",
  "Мост",
  "Винир",
  "Вкладка",
  "Протез",
  "Каппа",
  "Ретейнер",
  "Другое"
];

export function CreateLabOrderDialog({ open, onOpenChange, onSuccess, preselectedPatientId }: CreateLabOrderDialogProps) {
  const { currentClinic } = useClinic();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  
  const [formData, setFormData] = useState({
    patient_id: "",
    doctor_id: "",
    type: "",
    description: "",
    deadline: null as Date | null,
    notes: ""
  });

  const [items, setItems] = useState<OrderItem[]>([
    { item_type: "", description: "", tooth_number: null, material: "", color: "", quantity: 1, unit_price: 0 }
  ]);

  useEffect(() => {
    if (open && currentClinic?.id) {
      loadData();
      if (preselectedPatientId) {
        setFormData(prev => ({ ...prev, patient_id: preselectedPatientId }));
      }
    }
  }, [open, currentClinic, preselectedPatientId]);

  const loadData = async () => {
    const [patientsRes, doctorsList] = await Promise.all([
      supabase
        .from("clinic_members")
        .select("user_id, profiles:user_id(id, full_name)")
        .eq("clinic_id", currentClinic!.id)
        .eq("role", "patient"),
      fetchClinicDoctors(currentClinic!.id)
    ]);

    if (patientsRes.data) {
      const patientsList = patientsRes.data
        .map((cm: any) => cm.profiles)
        .filter(Boolean) as Patient[];
      setPatients(patientsList);
    }
    setDoctors(doctorsList as Doctor[]);
  };

  const addItem = () => {
    setItems([...items, { item_type: "", description: "", tooth_number: null, material: "", color: "", quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const totalPrice = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const handleSubmit = async () => {
    if (!formData.patient_id || !formData.doctor_id || !formData.type) {
      toast.error("Заполните обязательные поля");
      return;
    }

    setLoading(true);
    try {
      // Generate order number
      const orderNumber = `LAB-${Date.now().toString(36).toUpperCase()}`;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("laboratory_orders")
        .insert({
          clinic_id: currentClinic!.id,
          patient_id: formData.patient_id,
          doctor_id: formData.doctor_id,
          type: formData.type,
          description: formData.description || items.map(i => i.description).join(", "),
          deadline: formData.deadline?.toISOString(),
          notes: formData.notes || null,
          order_number: orderNumber,
          price: totalPrice,
          status: "new"
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const itemsToInsert = items.filter(i => i.item_type || i.description).map(item => ({
        clinic_id: currentClinic!.id,
        order_id: order.id,
        item_type: item.item_type || formData.type,
        description: item.description,
        tooth_number: item.tooth_number,
        material: item.material || null,
        color: item.color || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price
      }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from("lab_order_items")
          .insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      toast.success("Заказ создан");
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setFormData({ patient_id: "", doctor_id: "", type: "", description: "", deadline: null, notes: "" });
      setItems([{ item_type: "", description: "", tooth_number: null, material: "", color: "", quantity: 1, unit_price: 0 }]);
    } catch (error) {
      toast.error("Ошибка создания заказа");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новый заказ в лабораторию</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Main info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Пациент *</Label>
              <Select
                value={formData.patient_id}
                onValueChange={(value) => setFormData({ ...formData, patient_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите пациента" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Врач *</Label>
              <Select
                value={formData.doctor_id}
                onValueChange={(value) => setFormData({ ...formData, doctor_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите врача" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.profiles?.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Тип работы *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  {orderTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Срок выполнения</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("justify-start text-left font-normal", !formData.deadline && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.deadline ? format(formData.deadline, "dd MMM yyyy", { locale: ru }) : "Выберите дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.deadline || undefined}
                    onSelect={(date) => setFormData({ ...formData, deadline: date || null })}
                    locale={ru}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Описание</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Общее описание заказа"
              rows={2}
            />
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Позиции заказа</Label>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 mr-1" />
                Добавить
              </Button>
            </div>
            
            {items.map((item, index) => (
              <div key={index} className="p-3 border border-border rounded-lg space-y-3 bg-muted/30">
                <div className="flex justify-between items-start">
                  <span className="text-sm font-medium text-muted-foreground">Позиция {index + 1}</span>
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1">
                    <Label className="text-xs">Тип</Label>
                    <Input
                      value={item.item_type}
                      onChange={(e) => updateItem(index, "item_type", e.target.value)}
                      placeholder="Коронка, винир..."
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Зуб</Label>
                    <Input
                      type="number"
                      value={item.tooth_number || ""}
                      onChange={(e) => updateItem(index, "tooth_number", e.target.value ? Number(e.target.value) : null)}
                      placeholder="11, 21..."
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Материал</Label>
                    <Input
                      value={item.material}
                      onChange={(e) => updateItem(index, "material", e.target.value)}
                      placeholder="Цирконий, E-max..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="grid gap-1">
                    <Label className="text-xs">Цвет</Label>
                    <Input
                      value={item.color}
                      onChange={(e) => updateItem(index, "color", e.target.value)}
                      placeholder="A2, B1..."
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Кол-во</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Цена за ед.</Label>
                    <Input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, "unit_price", Number(e.target.value))}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Сумма</Label>
                    <Input
                      value={(item.quantity * item.unit_price).toLocaleString()}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Описание</Label>
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Дополнительные указания"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            <Label>Примечания</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Дополнительные комментарии для лаборатории"
              rows={2}
            />
          </div>

          <div className="flex justify-end">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Итого:</p>
              <p className="text-2xl font-bold text-foreground">{totalPrice.toLocaleString()} UZS</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Создание..." : "Создать заказ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
