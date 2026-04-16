import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { Search, MoreHorizontal, Edit2, Trash2, ArrowDown, ArrowUp, Package } from "lucide-react";
import { AddMaterialDialog } from "./AddMaterialDialog";
import { StockOperationDialog } from "./StockOperationDialog";

interface InventoryItem {
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
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface MaterialsListProps {
  onRefresh?: () => void;
}

export function MaterialsList({ onRefresh }: MaterialsListProps) {
  const { currentClinic } = useClinic();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [stockOpType, setStockOpType] = useState<"income" | "expense" | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    if (currentClinic?.id) {
      loadData();
    }
  }, [currentClinic]);

  const loadData = async () => {
    setLoading(true);
    const [itemsRes, catsRes] = await Promise.all([
      supabase.from("inventory").select("*").eq("clinic_id", currentClinic!.id).eq("is_active", true).order("name"),
      supabase.from("inventory_categories").select("id, name").eq("clinic_id", currentClinic!.id).eq("is_active", true)
    ]);
    if (itemsRes.data) setItems(itemsRes.data);
    if (catsRes.data) setCategories(catsRes.data);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить материал?")) return;
    await supabase.from("inventory").update({ is_active: false }).eq("id", id);
    toast.success("Материал удален");
    loadData();
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = !search || 
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.supplier?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category_id === categoryFilter || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const lowStockCount = items.filter(i => i.quantity <= i.min_quantity).length;

  return (
    <>
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Package className="w-5 h-5" />
              Материалы
              {lowStockCount > 0 && (
                <Badge variant="destructive" className="ml-2">{lowStockCount} заканчивается</Badge>
              )}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-[180px]"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Категория" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead className="text-right">Количество</TableHead>
                  <TableHead className="text-right">Мин.</TableHead>
                  <TableHead className="text-right">Цена</TableHead>
                  <TableHead>Поставщик</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const isLow = item.quantity <= item.min_quantity;
                  return (
                    <TableRow key={item.id} className={isLow ? "bg-amber-500/5" : ""}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={isLow ? "text-amber-500 font-bold" : ""}>
                          {item.quantity} {item.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {item.min_quantity} {item.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.price_per_unit ? `${item.price_per_unit.toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.supplier || "—"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedItem(item); setStockOpType("income"); }}>
                              <ArrowDown className="w-4 h-4 mr-2 text-emerald-500" />
                              Приход
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedItem(item); setStockOpType("expense"); }}>
                              <ArrowUp className="w-4 h-4 mr-2 text-rose-500" />
                              Списание
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditItem(item); setAddDialogOpen(true); }}>
                              <Edit2 className="w-4 h-4 mr-2" />
                              Редактировать
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Нет материалов</p>
              <p className="text-sm">Добавьте первый материал</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AddMaterialDialog
        open={addDialogOpen}
        onOpenChange={(open) => { setAddDialogOpen(open); if (!open) setEditItem(null); }}
        onSuccess={() => { loadData(); onRefresh?.(); }}
        editItem={editItem}
      />

      <StockOperationDialog
        open={stockOpType !== null}
        onOpenChange={(open) => { if (!open) { setStockOpType(null); setSelectedItem(null); } }}
        onSuccess={() => { loadData(); onRefresh?.(); }}
        type={stockOpType || "income"}
        preselectedItem={selectedItem}
      />
    </>
  );
}
