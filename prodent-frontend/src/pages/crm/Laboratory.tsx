import { CRMLayout } from "@/components/crm/CRMLayout";
import { PermissionGate } from "@/components/crm/PermissionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlaskConical, Plus, Search, Clock, CheckCircle, AlertCircle, Truck, Package } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CreateLabOrderDialog } from "@/components/crm/laboratory/CreateLabOrderDialog";
import { LabOrderDetail } from "@/components/crm/laboratory/LabOrderDetail";

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  new: { label: "Новый", icon: Clock, className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  in_progress: { label: "В работе", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  ready: { label: "Готов", icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  delivered: { label: "Доставлен", icon: Truck, className: "bg-green-500/10 text-green-600 border-green-500/20" },
  cancelled: { label: "Отменён", icon: AlertCircle, className: "bg-red-500/10 text-red-600 border-red-500/20" },
};

export default function Laboratory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const { currentClinic, loading: clinicLoading } = useClinic();

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["laboratory-orders", currentClinic?.id, searchQuery, statusFilter],
    queryFn: async () => {
      if (!currentClinic?.id) return [];

      let query = supabase
        .from("laboratory_orders")
        .select(`
          *,
          profiles:patient_id (full_name),
          doctors:doctor_id (
            id,
            profiles:user_id (full_name)
          )
        `)
        .eq("clinic_id", currentClinic.id)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`description.ilike.%${searchQuery}%,order_number.ilike.%${searchQuery}%`);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !clinicLoading && !!currentClinic?.id,
  });

  const stats = {
    total: orders?.length || 0,
    new: orders?.filter(o => o.status === "new").length || 0,
    inProgress: orders?.filter(o => o.status === "in_progress").length || 0,
    ready: orders?.filter(o => o.status === "ready").length || 0,
  };

  return (
    <CRMLayout>
      <PermissionGate module="laboratory">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-foreground flex items-center gap-3">
              <FlaskConical className="w-8 h-8" />
              Лаборатория
            </h1>
            <p className="text-muted-foreground mt-1">
              {currentClinic ? `${currentClinic.name} • Заказы в лабораторию` : 'Выберите клинику'}
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} disabled={!currentClinic}>
            <Plus className="w-4 h-4 mr-2" />
            Новый заказ
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Всего</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.new}</p>
                  <p className="text-xs text-muted-foreground">Новых</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.inProgress}</p>
                  <p className="text-xs text-muted-foreground">В работе</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.ready}</p>
                  <p className="text-xs text-muted-foreground">Готовы</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Поиск по номеру или описанию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted/50 border-border"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="new">Новые</SelectItem>
                  <SelectItem value="in_progress">В работе</SelectItem>
                  <SelectItem value="ready">Готовы</SelectItem>
                  <SelectItem value="delivered">Доставлены</SelectItem>
                  <SelectItem value="cancelled">Отменены</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              Заказы в лабораторию
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || clinicLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : orders && orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map((order) => {
                  const status = statusConfig[order.status || 'new'];
                  const StatusIcon = status.icon;
                  const patient = order.profiles as any;
                  const doctor = order.doctors as any;
                  const isOverdue = order.deadline && new Date(order.deadline) < new Date() && order.status !== "delivered";
                  
                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={cn(
                        "p-4 rounded-lg border transition-all duration-200 cursor-pointer",
                        "bg-muted/30 border-border/50 hover:bg-muted/50 hover:border-primary/20",
                        isOverdue && "border-red-500/30 bg-red-500/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="font-semibold text-foreground">
                              {order.order_number || `#${order.id.slice(0, 8)}`}
                            </span>
                            <Badge variant="outline" className={cn("text-xs", status.className)}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {status.label}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {order.type}
                            </Badge>
                            {isOverdue && (
                              <Badge variant="destructive" className="text-xs">
                                Просрочен
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {order.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span>Пациент: {patient?.full_name || 'Не указан'}</span>
                            <span>Врач: {doctor?.profiles?.full_name || 'Не указан'}</span>
                            {order.deadline && (
                              <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                                Срок: {format(new Date(order.deadline), 'dd MMM yyyy', { locale: ru })}
                              </span>
                            )}
                            {order.files && order.files.length > 0 && (
                              <span className="text-primary">{order.files.length} файл(ов)</span>
                            )}
                          </div>
                        </div>
                        {order.price && (
                          <div className="text-right shrink-0">
                            <span className="font-semibold text-foreground">
                              {order.price.toLocaleString()} UZS
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p>{currentClinic ? 'Заказов в лабораторию нет' : 'Выберите клинику'}</p>
                {currentClinic && (
                  <Button variant="outline" className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Создать первый заказ
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateLabOrderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => refetch()}
      />

      <LabOrderDetail
        open={!!selectedOrder}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
        order={selectedOrder}
        onUpdate={() => refetch()}
      />
      </PermissionGate>
    </CRMLayout>
  );
}
