import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface StockOperationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  type: "income" | "expense";
  preselectedItem?: InventoryItem | null;
}

export function StockOperationDialog({ open, onOpenChange, onSuccess, type, preselectedItem }: StockOperationDialogProps) {
  const { currentClinic } = useClinic();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  
  const [formData, setFormData] = useState({
    inventory_id: "",
    quantity: 1,
    reason: ""
  });

  useEffect(() => {
    if (open && currentClinic?.id) {
      loadItems();
      if (preselectedItem) {
        setFormData(prev => ({ ...prev, inventory_id: preselectedItem.id }));
      } else {
        setFormData({ inventory_id: "", quantity: 1, reason: "" });
      }
    }
  }, [open, currentClinic, preselectedItem]);

  const loadItems = async () => {
    const { data } = await supabase
      .from("inventory")
      .select("id, name, quantity, unit")
      .eq("clinic_id", currentClinic!.id)
      .eq("is_active", true)
      .order("name");
    if (data) setItems(data);
  };

  const selectedItem = items.find(i => i.id === formData.inventory_id);

  const handleSubmit = async () => {
    if (!formData.inventory_id) {
      toast.error("Выберите материал");
      return;
    }
    if (formData.quantity <= 0) {
      toast.error("Укажите количество");
      return;
    }
    if (type === "expense" && selectedItem && formData.quantity > selectedItem.quantity) {
      toast.error(`Недостаточно на складе. Доступно: ${selectedItem.quantity}`);
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // Create transaction
      const { error: txError } = await supabase
        .from("inventory_transactions")
        .insert({
          clinic_id: currentClinic!.id,
          inventory_id: formData.inventory_id,
          quantity: formData.quantity,
          type: type,
          reason: formData.reason || (type === "income" ? "Приход" : "Списание"),
          user_id: userData.user?.id
        });

      if (txError) throw txError;

      // Update inventory quantity
      const newQuantity = type === "income" 
        ? (selectedItem?.quantity || 0) + formData.quantity
        : (selectedItem?.quantity || 0) - formData.quantity;

      const { error: invError } = await supabase
        .from("inventory")
        .update({ quantity: newQuantity })
        .eq("id", formData.inventory_id);

      if (invError) throw invError;

      toast.success(type === "income" ? "Приход оформлен" : "Списание выполнено");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error("Ошибка операции");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{type === "income" ? "Оформить приход" : "Оформить списание"}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Материал *</Label>
            <Select
              value={formData.inventory_id}
              onValueChange={(value) => setFormData({ ...formData, inventory_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите материал" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} ({item.quantity} {item.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Количество *</Label>
            <Input
              type="number"
              min={1}
              max={type === "expense" && selectedItem ? selectedItem.quantity : undefined}
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
            />
            {selectedItem && (
              <p className="text-xs text-muted-foreground">
                На складе: {selectedItem.quantity} {selectedItem.unit}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Причина / комментарий</Label>
            <Textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder={type === "income" ? "Закупка, возврат..." : "Использовано при лечении, брак..."}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
            variant={type === "expense" ? "destructive" : "default"}
          >
            {loading ? "Сохранение..." : type === "income" ? "Оформить приход" : "Списать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
