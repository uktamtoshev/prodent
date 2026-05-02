import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/api/client";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Truck, Phone, Mail, Globe } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  inn: string | null;
  notes: string | null;
}

export function SuppliersManager() {
  const { currentClinic } = useClinic();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: "", contact_person: "", phone: "", email: "", address: "", website: "", inn: "", notes: ""
  });

  useEffect(() => {
    if (currentClinic?.id) {
      loadSuppliers();
    }
  }, [currentClinic]);

  const loadSuppliers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inventory_suppliers")
      .select("*")
      .eq("clinic_id", currentClinic!.id)
      .eq("is_active", true)
      .order("name");
    if (data) setSuppliers(data);
    setLoading(false);
  };

  const openDialog = (item?: Supplier) => {
    if (item) {
      setEditItem(item);
      setFormData({
        name: item.name,
        contact_person: item.contact_person || "",
        phone: item.phone || "",
        email: item.email || "",
        address: item.address || "",
        website: item.website || "",
        inn: item.inn || "",
        notes: item.notes || ""
      });
    } else {
      setEditItem(null);
      setFormData({ name: "", contact_person: "", phone: "", email: "", address: "", website: "", inn: "", notes: "" });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Введите название");
      return;
    }

    const payload = {
      name: formData.name,
      contact_person: formData.contact_person || null,
      phone: formData.phone || null,
      email: formData.email || null,
      address: formData.address || null,
      website: formData.website || null,
      inn: formData.inn || null,
      notes: formData.notes || null
    };

    try {
      if (editItem) {
        await supabase.from("inventory_suppliers").update(payload).eq("id", editItem.id);
        toast.success("Поставщик обновлен");
      } else {
        await supabase.from("inventory_suppliers").insert({ ...payload, clinic_id: currentClinic!.id });
        toast.success("Поставщик добавлен");
      }
      setDialogOpen(false);
      loadSuppliers();
    } catch (error) {
      toast.error("Ошибка сохранения");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить поставщика?")) return;
    await supabase.from("inventory_suppliers").update({ is_active: false }).eq("id", id);
    toast.success("Поставщик удален");
    loadSuppliers();
  };

  return (
    <>
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Поставщики
            </CardTitle>
            <Button size="sm" onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : suppliers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Контакт</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((sup) => (
                  <TableRow key={sup.id}>
                    <TableCell className="font-medium">{sup.name}</TableCell>
                    <TableCell className="text-muted-foreground">{sup.contact_person || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {sup.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {sup.phone}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sup.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {sup.email}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDialog(sup)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(sup.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Нет поставщиков</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editItem ? "Редактировать" : "Новый поставщик"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label>Название *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Контактное лицо</Label>
                <Input
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>ИНН</Label>
                <Input
                  value={formData.inn}
                  onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Телефон</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Адрес</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Веб-сайт</Label>
              <Input
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://"
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleSave}>{editItem ? "Сохранить" : "Добавить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
