import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FlaskConical, Plus, Package, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';

const STATUS_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  NEW: { label: 'Новый', variant: 'outline', icon: Clock },
  IN_LAB: { label: 'В лаборатории', variant: 'secondary', icon: FlaskConical },
  READY: { label: 'Готов', variant: 'default', icon: Package },
  DELIVERED: { label: 'Передан пациенту', variant: 'default', icon: CheckCircle },
  REJECTED: { label: 'Отклонён', variant: 'destructive', icon: XCircle },
};

const WORK_TYPES = [
  'Коронка',
  'Мостовидный протез',
  'Бюгельный протез',
  'Полный съёмный протез',
  'Вкладка',
  'Накладка',
  'Виниры',
  'Имплантат',
  '3D-скан',
  'Прочее',
];

interface FormState {
  patient_id: string;
  appointment_id: string;
  lab_name: string;
  work_type: string;
  description: string;
  price: string;
  expected_at: string;
}

const EMPTY_FORM: FormState = {
  patient_id: '',
  appointment_id: '',
  lab_name: '',
  work_type: '',
  description: '',
  price: '',
  expected_at: '',
};

export default function DoctorLaboratory() {
  const { user } = useAuth();
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: doctor } = useQuery({
    queryKey: ['doctor-by-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ['doctor-lab-orders', doctor?.id, statusFilter],
    queryFn: async () => {
      if (!doctor?.id) return [] as any[];
      let q = supabase
        .from('laboratory_orders')
        .select('*, patient:users!laboratory_orders_patient_id_fkey(first_name, last_name, phone)')
        .eq('doctor_id', doctor.id)
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!doctor?.id,
  });

  const { data: recentPatients } = useQuery({
    queryKey: ['doctor-recent-patients', doctor?.id],
    queryFn: async () => {
      if (!doctor?.id) return [] as any[];
      const { data } = await supabase
        .from('appointments')
        .select('patient_id, id, appointment_date, patient:users!appointments_patient_id_fkey(id, first_name, last_name)')
        .eq('doctor_id', doctor.id)
        .order('appointment_date', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!doctor?.id,
  });

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await supabase
        .from('laboratory_orders')
        .insert({
          clinic_id: currentClinic?.id,
          doctor_id: doctor?.id,
          patient_id: payload.patient_id,
          appointment_id: payload.appointment_id || null,
          lab_name: payload.lab_name,
          work_type: payload.work_type,
          description: payload.description || null,
          status: 'NEW',
          price: payload.price ? Number(payload.price) : null,
          expected_at: payload.expected_at || null,
          sent_at: new Date().toISOString(),
        });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-lab-orders'] });
      toast({ title: 'Заказ создан', description: 'Лаборатория получит уведомление.' });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: any) => {
      toast({ title: 'Не удалось создать заказ', description: err.message, variant: 'destructive' });
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === 'READY') patch.received_at = new Date().toISOString();
      const { error } = await supabase.from('laboratory_orders').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-lab-orders'] });
      toast({ title: 'Статус обновлён' });
    },
    onError: (err: any) =>
      toast({ title: 'Ошибка обновления', description: err.message, variant: 'destructive' }),
  });

  const stats = {
    new: orders?.filter((o: any) => o.status === 'NEW').length ?? 0,
    inLab: orders?.filter((o: any) => o.status === 'IN_LAB').length ?? 0,
    ready: orders?.filter((o: any) => o.status === 'READY').length ?? 0,
  };

  const uniquePatients = (recentPatients || []).reduce<any[]>((acc, r: any) => {
    if (r.patient && !acc.find((p) => p.id === r.patient.id)) acc.push(r.patient);
    return acc;
  }, []);

  return (
    <DoctorLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-primary" />
              Лаборатория
            </h1>
            <p className="text-muted-foreground">Заказы зуботехнических работ</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Новый заказ
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новый лабораторный заказ</DialogTitle>
                <DialogDescription>Заполните параметры заказа.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Пациент *</Label>
                  <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите пациента" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniquePatients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Лаборатория *</Label>
                  <Input
                    value={form.lab_name}
                    onChange={(e) => setForm({ ...form, lab_name: e.target.value })}
                    placeholder="Название лаборатории"
                  />
                </div>
                <div>
                  <Label>Тип работы *</Label>
                  <Select value={form.work_type} onValueChange={(v) => setForm({ ...form, work_type: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите тип" />
                    </SelectTrigger>
                    <SelectContent>
                      {WORK_TYPES.map((w) => (
                        <SelectItem key={w} value={w}>{w}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Описание</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Цвет, форма, особые пожелания…"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Цена (UZS)</Label>
                    <Input
                      type="number"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Ожидаемая дата</Label>
                    <Input
                      type="date"
                      value={form.expected_at}
                      onChange={(e) => setForm({ ...form, expected_at: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
                <Button
                  disabled={!form.patient_id || !form.lab_name || !form.work_type || createMut.isPending}
                  onClick={() => createMut.mutate(form)}
                >
                  {createMut.isPending ? 'Создание…' : 'Создать заказ'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Новые</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.new}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">В лаборатории</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-500">{stats.inLab}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Готовы</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{stats.ready}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Все заказы</CardTitle>
                <CardDescription>Список лабораторных работ</CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : !orders || orders.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Заказов пока нет.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Пациент</TableHead>
                    <TableHead>Лаборатория</TableHead>
                    <TableHead>Тип работы</TableHead>
                    <TableHead>Цена</TableHead>
                    <TableHead>Срок</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o: any) => {
                    const st = STATUS_META[o.status] || STATUS_META.NEW;
                    const StIcon = st.icon;
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {new Date(o.created_at).toLocaleDateString('ru-RU')}
                        </TableCell>
                        <TableCell>
                          {o.patient?.first_name} {o.patient?.last_name}
                        </TableCell>
                        <TableCell>{o.lab_name}</TableCell>
                        <TableCell>{o.work_type}</TableCell>
                        <TableCell>
                          {o.price ? `${Number(o.price).toLocaleString('ru-RU')} ${o.currency || 'UZS'}` : '—'}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {o.expected_at ? new Date(o.expected_at).toLocaleDateString('ru-RU') : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant} className="gap-1">
                            <StIcon className="w-3 h-3" />
                            {st.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={o.status}
                            onValueChange={(v) => updateStatusMut.mutate({ id: o.id, status: v })}
                          >
                            <SelectTrigger className="w-36 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_META).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DoctorLayout>
  );
}
