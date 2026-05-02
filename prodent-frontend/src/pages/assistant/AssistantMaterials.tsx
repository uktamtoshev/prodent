import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AssistantLayout } from '@/components/assistant/AssistantLayout';
import { supabase } from '@/integrations/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  AlertTriangle,
  Search,
  Save,
  Inbox,
  History,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Material {
  id: string;
  clinic_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  price: number | null;
  currency: string | null;
  is_active: boolean;
}

interface MaterialStock {
  id: string;
  material_id: string;
  clinic_id: string;
  quantity: number;
  min_quantity: number;
  last_restock_at: string | null;
}

interface MaterialUsage {
  id: string;
  material_id: string;
  clinic_id: string;
  appointment_id: string | null;
  used_by: string;
  quantity: number;
  note: string | null;
  used_at: string;
}

interface AppointmentLite {
  id: string;
  appointment_date: string;
  start_time: string | null;
  patient_id: string;
  service: string | null;
  status: string;
}

function todayIso() {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function AssistantMaterials() {
  const { user } = useAuth();
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'stock' | 'usage'>('stock');

  // Form state for write-off
  const [formMaterialId, setFormMaterialId] = useState<string>('');
  const [formAppointmentId, setFormAppointmentId] = useState<string>('');
  const [formQuantity, setFormQuantity] = useState<string>('');
  const [formNote, setFormNote] = useState<string>('');

  // Materials catalogue
  const { data: materials, isLoading: materialsLoading } = useQuery({
    queryKey: ['assistant-materials', currentClinic?.id, user?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [] as Material[];
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Material[];
    },
    enabled: !!currentClinic?.id && !!user,
  });

  // Stock entries
  const { data: stocks, isLoading: stocksLoading } = useQuery({
    queryKey: ['assistant-materials-stock', currentClinic?.id, user?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [] as MaterialStock[];
      const { data, error } = await supabase
        .from('materials_stock')
        .select('*')
        .eq('clinic_id', currentClinic.id);
      if (error) throw error;
      return (data ?? []) as MaterialStock[];
    },
    enabled: !!currentClinic?.id && !!user,
  });

  // Today + upcoming appointments for select
  const today = todayIso();
  const { data: appointments } = useQuery({
    queryKey: ['assistant-materials-appointments', currentClinic?.id, today],
    queryFn: async () => {
      if (!currentClinic?.id) return [] as AppointmentLite[];
      const { data, error } = await supabase
        .from('appointments')
        .select('id, appointment_date, start_time, patient_id, service, status')
        .eq('clinic_id', currentClinic.id)
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AppointmentLite[];
    },
    enabled: !!currentClinic?.id && !!user,
  });

  // Recent usage
  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['assistant-materials-usage', currentClinic?.id, user?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [] as MaterialUsage[];
      const { data, error } = await supabase
        .from('materials_usage')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .order('used_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as MaterialUsage[];
    },
    enabled: !!currentClinic?.id && !!user,
  });

  const materialById = useMemo(() => {
    const map = new Map<string, Material>();
    (materials ?? []).forEach((m) => map.set(m.id, m));
    return map;
  }, [materials]);

  const stockByMaterialId = useMemo(() => {
    const map = new Map<string, MaterialStock>();
    (stocks ?? []).forEach((s) => map.set(s.material_id, s));
    return map;
  }, [stocks]);

  // Joined stock rows for table
  const stockRows = useMemo(() => {
    if (!materials) return [];
    return materials
      .map((m) => ({ material: m, stock: stockByMaterialId.get(m.id) }))
      .filter((row) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          row.material.name.toLowerCase().includes(q) ||
          (row.material.sku ?? '').toLowerCase().includes(q) ||
          (row.material.category ?? '').toLowerCase().includes(q)
        );
      });
  }, [materials, stockByMaterialId, search]);

  const lowStockCount = useMemo(
    () =>
      stockRows.filter((row) => {
        const stock = row.stock;
        return stock && Number(stock.quantity) < Number(stock.min_quantity);
      }).length,
    [stockRows],
  );

  const writeOffMutation = useMutation({
    mutationFn: async (input: {
      material_id: string;
      appointment_id: string | null;
      quantity: number;
      note: string;
    }) => {
      if (!currentClinic?.id || !user?.id) throw new Error('Нет клиники или пользователя');
      const { error: insertError } = await supabase.from('materials_usage').insert({
        clinic_id: currentClinic.id,
        material_id: input.material_id,
        appointment_id: input.appointment_id,
        used_by: user.id,
        quantity: input.quantity,
        note: input.note || null,
      });
      if (insertError) throw insertError;

      const stock = stockByMaterialId.get(input.material_id);
      if (stock) {
        const newQty = Number(stock.quantity) - input.quantity;
        const { error: updateError } = await supabase
          .from('materials_stock')
          .update({ quantity: newQty })
          .eq('id', stock.id);
        if (updateError) throw updateError;
      }
      return true;
    },
    onSuccess: () => {
      toast({
        title: 'Списание сохранено',
        description: 'Остаток обновлён.',
      });
      setFormMaterialId('');
      setFormAppointmentId('');
      setFormQuantity('');
      setFormNote('');
      queryClient.invalidateQueries({ queryKey: ['assistant-materials-stock'] });
      queryClient.invalidateQueries({ queryKey: ['assistant-materials-usage'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Не удалось списать материал',
        description: err?.message ?? 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    },
  });

  const handleWriteOffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(formQuantity);
    if (!formMaterialId) {
      toast({ title: 'Выберите материал', variant: 'destructive' });
      return;
    }
    if (!qty || qty <= 0) {
      toast({ title: 'Укажите положительное количество', variant: 'destructive' });
      return;
    }
    writeOffMutation.mutate({
      material_id: formMaterialId,
      appointment_id: formAppointmentId || null,
      quantity: qty,
      note: formNote.trim(),
    });
  };

  return (
    <AssistantLayout>
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-6 h-6 text-primary" />
              Материалы
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {currentClinic
                ? `${currentClinic.name} • ${materials?.length ?? 0} позиций`
                : 'Выберите клинику'}
              {lowStockCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {lowStockCount} ниже нормы
                </span>
              )}
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'stock' | 'usage')}>
          <TabsList>
            <TabsTrigger value="stock" className="gap-2">
              <Inbox className="w-4 h-4" />
              Остатки
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-2">
              <History className="w-4 h-4" />
              Списание
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stock" className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск материалов..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {materialsLoading || stocksLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-md" />
                ))}
              </div>
            ) : stockRows.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium text-foreground mb-1">
                    Материалы не найдены
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Каталог материалов клиники пока пуст или ничего не подходит под поиск.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead>Категория</TableHead>
                      <TableHead>Артикул</TableHead>
                      <TableHead className="text-right">Остаток</TableHead>
                      <TableHead className="text-right">Минимум</TableHead>
                      <TableHead>Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockRows.map(({ material, stock }) => {
                      const qty = Number(stock?.quantity ?? 0);
                      const minQty = Number(stock?.min_quantity ?? 0);
                      const isLow = stock && qty < minQty;
                      return (
                        <TableRow key={material.id}>
                          <TableCell className="font-medium">{material.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {material.category ?? '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {material.sku ?? '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {stock ? `${qty} ${material.unit}` : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {stock ? `${minQty} ${material.unit}` : '—'}
                          </TableCell>
                          <TableCell>
                            {!stock ? (
                              <Badge variant="outline" className="bg-neutral-100 text-neutral-600">
                                Нет данных
                              </Badge>
                            ) : isLow ? (
                              <Badge
                                variant="outline"
                                className="bg-amber-100 text-amber-700 border-amber-200"
                              >
                                Низкий запас
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-emerald-100 text-emerald-700 border-emerald-200"
                              >
                                В норме
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Новое списание</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleWriteOffSubmit}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div className="space-y-2">
                    <Label>Материал</Label>
                    <Select
                      value={formMaterialId}
                      onValueChange={setFormMaterialId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите материал" />
                      </SelectTrigger>
                      <SelectContent>
                        {(materials ?? []).map((m) => {
                          const stock = stockByMaterialId.get(m.id);
                          return (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                              {stock ? ` (${Number(stock.quantity)} ${m.unit})` : ''}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Приём (опционально)</Label>
                    <Select
                      value={formAppointmentId || 'none'}
                      onValueChange={(v) =>
                        setFormAppointmentId(v === 'none' ? '' : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Без приёма" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Без приёма</SelectItem>
                        {(appointments ?? []).map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {format(parseISO(a.appointment_date), 'd MMM', {
                              locale: ru,
                            })}{' '}
                            {a.start_time?.slice(0, 5) ?? ''} —{' '}
                            {a.service ?? 'без услуги'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Количество</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Заметка</Label>
                    <Textarea
                      rows={2}
                      placeholder="Комментарий"
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-2 flex justify-end">
                    <Button type="submit" disabled={writeOffMutation.isPending}>
                      <Save className="w-4 h-4 mr-2" />
                      {writeOffMutation.isPending ? 'Сохранение...' : 'Списать'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Последние списания</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {usageLoading ? (
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 rounded-md" />
                    ))}
                  </div>
                ) : (usage ?? []).length === 0 ? (
                  <div className="p-12 text-center">
                    <History className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Списаний пока не было.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Материал</TableHead>
                        <TableHead className="text-right">Количество</TableHead>
                        <TableHead>Заметка</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(usage ?? []).map((u) => {
                        const m = materialById.get(u.material_id);
                        return (
                          <TableRow key={u.id}>
                            <TableCell className="text-sm">
                              {format(new Date(u.used_at), 'd MMM HH:mm', {
                                locale: ru,
                              })}
                            </TableCell>
                            <TableCell>{m?.name ?? '—'}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {Number(u.quantity)} {m?.unit ?? ''}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {u.note ?? '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AssistantLayout>
  );
}
