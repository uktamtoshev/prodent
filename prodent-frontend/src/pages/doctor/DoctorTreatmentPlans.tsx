import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ClipboardList, Plus, FileText, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const STATUS_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PLANNED: { label: 'Планируется', variant: 'outline' },
  ACTIVE: { label: 'Выполняется', variant: 'default' },
  ON_HOLD: { label: 'На паузе', variant: 'secondary' },
  COMPLETED: { label: 'Завершён', variant: 'default' },
  CANCELLED: { label: 'Отменён', variant: 'destructive' },
};

export default function DoctorTreatmentPlans() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [form, setForm] = useState({
    patient_id: '',
    title: '',
    description: '',
  });

  const { data: doctor } = useQuery({
    queryKey: ['doctor-by-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('doctors')
        .select('id, clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: plans, isLoading } = useQuery({
    queryKey: ['doctor-treatment-plans', doctor?.id, statusFilter],
    queryFn: async () => {
      if (!doctor?.id) return [] as any[];
      let q = supabase
        .from('treatment_plans')
        .select('*, patient:users!treatment_plans_patient_id_fkey(id, first_name, last_name, phone)')
        .eq('doctor_id', doctor.id)
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!doctor?.id,
  });

  const { data: planItems } = useQuery({
    queryKey: ['treatment-plan-items', selectedPlan?.id],
    queryFn: async () => {
      if (!selectedPlan?.id) return [] as any[];
      const { data } = await supabase
        .from('treatment_plan_items')
        .select('*')
        .eq('treatment_plan_id', selectedPlan.id)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!selectedPlan?.id,
  });

  const { data: recentPatients } = useQuery({
    queryKey: ['doctor-patients-list', doctor?.id],
    queryFn: async () => {
      if (!doctor?.id) return [] as any[];
      const { data } = await supabase
        .from('appointments')
        .select('patient:users!appointments_patient_id_fkey(id, first_name, last_name)')
        .eq('doctor_id', doctor.id)
        .limit(50);
      return data || [];
    },
    enabled: !!doctor?.id,
  });

  const uniquePatients = (recentPatients || []).reduce<any[]>((acc, r: any) => {
    if (r.patient && !acc.find((p) => p.id === r.patient.id)) acc.push(r.patient);
    return acc;
  }, []);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!doctor?.id) throw new Error('No doctor profile');
      const { error } = await supabase.from('treatment_plans').insert({
        patient_id: form.patient_id,
        doctor_id: doctor.id,
        clinic_id: doctor.clinic_id,
        title: form.title,
        description: form.description || null,
        status: 'PLANNED',
        total_cost: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-treatment-plans'] });
      toast({ title: 'План лечения создан' });
      setCreateOpen(false);
      setForm({ patient_id: '', title: '', description: '' });
    },
    onError: (e: any) =>
      toast({ title: 'Ошибка', description: e.message, variant: 'destructive' }),
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === 'COMPLETED') patch.completed_at = new Date().toISOString();
      if (status === 'ACTIVE') patch.approved_at = new Date().toISOString();
      const { error } = await supabase.from('treatment_plans').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-treatment-plans'] });
      toast({ title: 'Статус обновлён' });
    },
  });

  const stats = {
    total: plans?.length ?? 0,
    active: plans?.filter((p: any) => p.status === 'ACTIVE').length ?? 0,
    completed: plans?.filter((p: any) => p.status === 'COMPLETED').length ?? 0,
  };

  return (
    <DoctorLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary" />
              Планы лечения
            </h1>
            <p className="text-muted-foreground">Долгосрочные планы лечения пациентов</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Новый план
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новый план лечения</DialogTitle>
                <DialogDescription>Создать план для пациента.</DialogDescription>
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
                  <Label>Название *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Например: Комплексная санация"
                  />
                </div>
                <div>
                  <Label>Описание</Label>
                  <Textarea
                    rows={4}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
                <Button
                  disabled={!form.patient_id || !form.title || createMut.isPending}
                  onClick={() => createMut.mutate()}
                >
                  {createMut.isPending ? 'Создание…' : 'Создать'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Всего планов</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{stats.total}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Активных</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold text-primary">{stats.active}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Завершённых</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{stats.completed}</p></CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Список планов</CardTitle>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-44">
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
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : !plans || plans.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Планов пока нет.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {plans.map((p: any) => {
                    const st = STATUS_META[p.status] || STATUS_META.PLANNED;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPlan(p)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-muted ${
                          selectedPlan?.id === p.id ? 'bg-muted border-primary' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{p.title}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {p.patient?.first_name} {p.patient?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(p.created_at).toLocaleDateString('ru-RU')}
                              {p.total_cost > 0 && (
                                <> · {Number(p.total_cost).toLocaleString('ru-RU')} {p.currency || 'UZS'}</>
                              )}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={st.variant}>{st.label}</Badge>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{selectedPlan ? selectedPlan.title : 'Детали плана'}</CardTitle>
              <CardDescription>
                {selectedPlan
                  ? `Пациент: ${selectedPlan.patient?.first_name} ${selectedPlan.patient?.last_name}`
                  : 'Выберите план слева'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedPlan ? (
                <div className="py-12 text-center text-muted-foreground">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>План не выбран.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedPlan.description && (
                    <div>
                      <p className="text-sm font-medium mb-1">Описание</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {selectedPlan.description}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium mb-2">Этапы лечения</p>
                    {!planItems || planItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Этапы не добавлены.</p>
                    ) : (
                      <div className="space-y-2">
                        {planItems.map((it: any) => (
                          <div key={it.id} className="p-2 rounded border text-sm flex items-center gap-2">
                            {it.status === 'COMPLETED' ? (
                              <CheckCircle className="w-4 h-4 text-primary" />
                            ) : (
                              <Clock className="w-4 h-4 text-muted-foreground" />
                            )}
                            <div className="flex-1">
                              <p className="font-medium">
                                {it.tooth_number ? `Зуб ${it.tooth_number} · ` : ''}{it.description}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {it.quantity} × {Number(it.unit_price).toLocaleString('ru-RU')} = {Number(it.total_price).toLocaleString('ru-RU')} UZS
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Действия</p>
                    <div className="flex gap-2 flex-wrap">
                      {selectedPlan.status === 'PLANNED' && (
                        <Button
                          size="sm"
                          onClick={() => updateStatusMut.mutate({ id: selectedPlan.id, status: 'ACTIVE' })}
                        >
                          Начать выполнение
                        </Button>
                      )}
                      {selectedPlan.status === 'ACTIVE' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMut.mutate({ id: selectedPlan.id, status: 'ON_HOLD' })}
                          >
                            Поставить на паузу
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updateStatusMut.mutate({ id: selectedPlan.id, status: 'COMPLETED' })}
                          >
                            Завершить
                          </Button>
                        </>
                      )}
                      {selectedPlan.status === 'ON_HOLD' && (
                        <Button
                          size="sm"
                          onClick={() => updateStatusMut.mutate({ id: selectedPlan.id, status: 'ACTIVE' })}
                        >
                          Возобновить
                        </Button>
                      )}
                      {selectedPlan.status !== 'CANCELLED' && selectedPlan.status !== 'COMPLETED' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateStatusMut.mutate({ id: selectedPlan.id, status: 'CANCELLED' })}
                        >
                          Отменить
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DoctorLayout>
  );
}
