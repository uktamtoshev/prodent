import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, FolderOpen } from "lucide-react";

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
}

export function CategoriesManager() {
  const { currentClinic } = useClinic();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", color: "#6366f1" });

  useEffect(() => {
    if (currentClinic?.id) {
      loadCategories();
    }
  }, [currentClinic]);

  const loadCategories = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inventory_categories")
      .select("*")
      .eq("clinic_id", currentClinic!.id)
      .eq("is_active", true)
      .order("name");
    if (data) setCategories(data);
    setLoading(false);
  };

  const openDialog = (item?: Category) => {
    if (item) {
      setEditItem(item);
      setFormData({ name: item.name, description: item.description || "", color: item.color || "#6366f1" });
    } else {
      setEditItem(null);
      setFormData({ name: "", description: "", color: "#6366f1" });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Введите название");
      return;
    }

    try {
      if (editItem) {
        await supabase.from("inventory_categories").update({
          name: formData.name,
          description: formData.description || null,
          color: formData.color
        }).eq("id", editItem.id);
        toast.success("Категория обновлена");
      } else {
        await supabase.from("inventory_categories").insert({
          clinic_id: currentClinic!.id,
          name: formData.name,
          description: formData.description || null,
          color: formData.color
        });
        toast.success("Категория добавлена");
      }
      setDialogOpen(false);
      loadCategories();
    } catch (error) {
      toast.error("Ошибка сохранения");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить категорию?")) return;
    await supabase.from("inventory_categories").update({ is_active: false }).eq("id", id);
    toast.success("Категория удалена");
    loadCategories();
  };

  return (
    <>
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Категории
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
          ) : categories.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Цвет</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell>
                      <div 
                        className="w-6 h-6 rounded-full" 
                        style={{ backgroundColor: cat.color || "#6366f1" }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-muted-foreground">{cat.description || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDialog(cat)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)}>
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
              <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Нет категорий</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editItem ? "Редактировать" : "Новая категория"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Название *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Описание</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Цвет</Label>
              <Input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-10 w-20"
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
