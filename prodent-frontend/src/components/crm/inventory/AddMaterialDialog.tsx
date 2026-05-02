import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/api/client";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface AddMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editItem?: {
    id: string;
    name: string;
    category: string;
    category_id: string | null;
    quantity: number;
    min_quantity: number;
    unit: string;
    price_per_unit: number | null;
    supplier: string | null;
    supplier_id: string | null;
    notes: string | null;
  } | null;
}

export function AddMaterialDialog({ open, onOpenChange, onSuccess, editItem }: AddMaterialDialogProps) {
  const { currentClinic } = useClinic();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    category: "",
    quantity: 0,
    min_quantity: 0,
    unit: "шт",
    price_per_unit: 0,
    supplier_id: "",
    supplier: "",
    notes: ""
  });

  useEffect(() => {
    if (open && currentClinic?.id) {
      loadCategoriesAndSuppliers();
      if (editItem) {
        setFormData({
          name: editItem.name,
          category_id: editItem.category_id || "",
          category: editItem.category,
          quantity: editItem.quantity,
          min_quantity: editItem.min_quantity,
          unit: editItem.unit,
          price_per_unit: editItem.price_per_unit || 0,
          supplier_id: editItem.supplier_id || "",
          supplier: editItem.supplier || "",
          notes: editItem.notes || ""
        });
      } else {
        setFormData({
          name: "",
          category_id: "",
          category: "",
          quantity: 0,
          min_quantity: 0,
          unit: "шт",
          price_per_unit: 0,
          supplier_id: "",
          supplier: "",
          notes: ""
        });
      }
    }
  }, [open, editItem, currentClinic]);

  const loadCategoriesAndSuppliers = async () => {
    const [catRes, supRes] = await Promise.all([
      supabase.from("inventory_categories").select("id, name").eq("clinic_id", currentClinic!.id).eq("is_active", true),
      supabase.from("inventory_suppliers").select("id, name").eq("clinic_id", currentClinic!.id).eq("is_active", true)
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (supRes.data) setSuppliers(supRes.data);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Введите название материала");
      return;
    }

    setLoading(true);
    try {
      const selectedCategory = categories.find(c => c.id === formData.category_id);
      const selectedSupplier = suppliers.find(s => s.id === formData.supplier_id);

      const payload = {
        clinic_id: currentClinic!.id,
        name: formData.name,
        category: selectedCategory?.name || formData.category || "Без категории",
        category_id: formData.category_id || null,
        quantity: formData.quantity,
        min_quantity: formData.min_quantity,
        unit: formData.unit,
        price_per_unit: formData.price_per_unit || null,
        supplier: selectedSupplier?.name || formData.supplier || null,
        supplier_id: formData.supplier_id || null,
        notes: formData.notes || null
      };

      if (editItem) {
        const { error } = await supabase
          .from("inventory")
          .update(payload)
          .eq("id", editItem.id);
        if (error) throw error;
        toast.success("Материал обновлен");
      } else {
        const { error } = await supabase
          .from("inventory")
          .insert(payload);
        if (error) throw error;
        toast.success("Материал добавлен");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error("Ошибка сохранения");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editItem ? "Редактировать материал" : "Добавить материал"}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Название *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Композит, анестетик и т.д."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Категория</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Поставщик</Label>
              <Select
                value={formData.supplier_id}
                onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id}>{sup.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Количество</Label>
              <Input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Мин. остаток</Label>
              <Input
                type="number"
                value={formData.min_quantity}
                onChange={(e) => setFormData({ ...formData, min_quantity: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Единица</Label>
              <Select
                value={formData.unit}
                onValueChange={(value) => setFormData({ ...formData, unit: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="шт">шт</SelectItem>
                  <SelectItem value="мл">мл</SelectItem>
                  <SelectItem value="г">г</SelectItem>
                  <SelectItem value="уп">уп</SelectItem>
                  <SelectItem value="л">л</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Цена за единицу (сум)</Label>
            <Input
              type="number"
              value={formData.price_per_unit}
              onChange={(e) => setFormData({ ...formData, price_per_unit: Number(e.target.value) })}
            />
          </div>

          <div className="grid gap-2">
            <Label>Примечания</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Сохранение..." : editItem ? "Сохранить" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
