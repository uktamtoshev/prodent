import { CRMLayout } from "@/components/crm/CRMLayout";
import { PermissionGate } from "@/components/crm/PermissionGate";
import { Card, CardContent } from "@/components/ui/card";
import { Package, AlertTriangle, TrendingDown, Plus, ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/api/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialsList } from "@/components/crm/inventory/MaterialsList";
import { InventoryTransactionsLog } from "@/components/crm/inventory/InventoryTransactionsLog";
import { CategoriesManager } from "@/components/crm/inventory/CategoriesManager";
import { SuppliersManager } from "@/components/crm/inventory/SuppliersManager";
import { AddMaterialDialog } from "@/components/crm/inventory/AddMaterialDialog";
import { StockOperationDialog } from "@/components/crm/inventory/StockOperationDialog";

interface InventoryStats {
  totalItems: number;
  lowStockCount: number;
  totalValue: number;
}

export default function Inventory() {
  const { currentClinic } = useClinic();
  const [stats, setStats] = useState<InventoryStats>({ totalItems: 0, lowStockCount: 0, totalValue: 0 });
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (currentClinic?.id) {
      loadStats();
    }
  }, [currentClinic, refreshKey]);

  const loadStats = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inventory")
      .select("quantity, min_quantity, price_per_unit")
      .eq("clinic_id", currentClinic!.id)
      .eq("is_active", true);

    if (data) {
      setStats({
        totalItems: data.length,
        lowStockCount: data.filter(item => item.quantity <= item.min_quantity).length,
        totalValue: data.reduce((sum, item) => sum + (item.quantity * (item.price_per_unit || 0)), 0)
      });
    }
    setLoading(false);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <CRMLayout>
      <PermissionGate module="inventory">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-foreground flex items-center gap-3">
              <Package className="w-8 h-8" />
              Склад
            </h1>
            <p className="text-muted-foreground mt-1">Управление материалами и расходниками</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setIncomeDialogOpen(true)}>
              <ArrowDown className="w-4 h-4 text-emerald-500" />
              Приход
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setExpenseDialogOpen(true)}>
              <ArrowUp className="w-4 h-4 text-rose-500" />
              Списание
            </Button>
            <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Добавить материал
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {loading ? <Skeleton className="h-8 w-16" /> : stats.totalItems}
                  </p>
                  <p className="text-sm text-muted-foreground">Всего позиций</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {loading ? <Skeleton className="h-8 w-16" /> : stats.lowStockCount}
                  </p>
                  <p className="text-sm text-muted-foreground">Заканчивается</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {loading ? <Skeleton className="h-8 w-24" /> : `${stats.totalValue.toLocaleString()} сум`}
                  </p>
                  <p className="text-sm text-muted-foreground">Общая стоимость</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alert */}
        {stats.lowStockCount > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span className="font-medium text-foreground">
                  Внимание: {stats.lowStockCount} позиций требуют пополнения
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="materials" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="materials">Материалы</TabsTrigger>
            <TabsTrigger value="log">Журнал операций</TabsTrigger>
            <TabsTrigger value="categories">Категории</TabsTrigger>
            <TabsTrigger value="suppliers">Поставщики</TabsTrigger>
          </TabsList>

          <TabsContent value="materials">
            <MaterialsList key={refreshKey} onRefresh={handleRefresh} />
          </TabsContent>

          <TabsContent value="log">
            <InventoryTransactionsLog key={refreshKey} />
          </TabsContent>

          <TabsContent value="categories">
            <CategoriesManager />
          </TabsContent>

          <TabsContent value="suppliers">
            <SuppliersManager />
          </TabsContent>
        </Tabs>
      </div>

      <AddMaterialDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={handleRefresh}
      />

      <StockOperationDialog
        open={incomeDialogOpen}
        onOpenChange={setIncomeDialogOpen}
        onSuccess={handleRefresh}
        type="income"
      />

      <StockOperationDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        onSuccess={handleRefresh}
        type="expense"
      />
      </PermissionGate>
    </CRMLayout>
  );
}
