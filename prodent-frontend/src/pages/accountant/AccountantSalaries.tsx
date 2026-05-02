import { useState, useMemo } from 'react';
import { AccountantLayout } from '@/components/accountant/AccountantLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Wallet,
  Users,
  PlusCircle,
  CheckCircle2,
  HandCoins,
  XCircle,
  Settings,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ClinicMemberRow {
  user_id?: string;
  role?: string;
  user?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    email?: string;
  } | null;
}

interface SalaryRow {
  id: string;
  clinic_id?: string;
  user_id?: string;
  role?: string;
  scheme?: string;
  base_amount?: number | null;
  percent?: number | null;
  config?: any;
  valid_from?: string | null;
  valid_to?: string | null;
  is_active?: boolean;
  created_at?: string | null;
  user?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    email?: string;
  } | null;
}

interface PayoutRow {
  id: string;
  salary_id?: string;
  clinic_id?: string;
  user_id?: string;
  period_start?: string;
  period_end?: string;
  base_amount?: number | null;
  bonus_amount?: number | null;
  deduction?: number | null;
  total_amount?: number | null;
  currency?: string | null;
  status?: string | null;
  paid_at?: string | null;
  paid_by?: string | null;
  notes?: string | null;
  created_at?: string | null;
  user?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
  } | null;
}

const userName = (u?: { first_name?: string; last_name?: string; full_name?: string } | null) => {
  if (!u) return 'Не указан';
  if (u.full_name) return u.full_name;
  return [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Не указан';
};

const schemeLabel = (s?: string | null) => {
  switch ((s || '').toUpperCase()) {
    case 'FIXED':
      return 'Фикс. ставка';
    case 'PERCENT_REVENUE':
      return '% от выручки';
    case 'HYBRID':
      return 'Гибрид';
    case 'PER_SERVICE':
      return 'За услугу';
    default:
      return s || '—';
  }
};

const roleLabel = (r?: string | null) => {
  switch ((r || '').toLowerCase()) {
    case 'doctor':
      return 'Врач';
    case 'assistant':
      return 'Ассистент';
    case 'accountant':
      return 'Бухгалтер';
    case 'manager':
      return 'Менеджер';
    case 'admin':
      return 'Администратор';
    default:
      return r || '—';
  }
};

const payoutStatusBadge = (status?: string | null) => {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'PENDING':
      return <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/40">Ожидание</Badge>;
    case 'APPROVED':
      return <Badge className="bg-cyan-500/15 text-cyan-400 border border-cyan-500/40">Одобрено</Badge>;
    case 'PAID':
      return <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">Выплачено</Badge>;
    case 'CANCELLED':
      return <Badge className="bg-slate-500/15 text-slate-300 border border-slate-500/40">Отменено</Badge>;
    default:
      return <Badge variant="outline">{status || '—'}</Badge>;
  }
};

interface SalaryForm {
  user_id: string;
  role: string;
  scheme: string;
  base_amount: string;
  percent: string;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
}

const emptyForm = (): SalaryForm => ({
  user_id: '',
  role: 'doctor',
  scheme: 'FIXED',
  base_amount: '',
  percent: '',
  valid_from: format(new Date(), 'yyyy-MM-dd'),
  valid_to: '',
  is_active: true,
});

export default function AccountantSalaries() {
  const { currentClinic } = useClinic();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'schemes' | 'payouts'>('schemes');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<SalaryForm>(emptyForm());

  const [payoutUserFilter, setPayoutUserFilter] = useState<string>('ALL');
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<string>('ALL');
  const [periodFrom, setPeriodFrom] = useState<string>('');
  const [periodTo, setPeriodTo] = useState<string>('');

  // ─── Salaries query ────────────────────────────────────────────────
  const { data: salaries, isLoading: salariesLoading } = useQuery<SalaryRow[]>({
    queryKey: ['accountant-salaries', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from('salaries')
        .select(`
          id, clinic_id, user_id, role, scheme, base_amount, percent, config,
          valid_from, valid_to, is_active, created_at,
          user:users!salaries_user_id_fkey(id, first_name, last_name, full_name, email)
        `)
        .eq('clinic_id', currentClinic.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as SalaryRow[]) || [];
    },
    enabled: !!currentClinic?.id,
  });

  // ─── Payouts query ─────────────────────────────────────────────────
  const { data: payouts, isLoading: payoutsLoading } = useQuery<PayoutRow[]>({
    queryKey: [
      'accountant-salary-payouts',
      currentClinic?.id,
      payoutUserFilter,
      payoutStatusFilter,
      periodFrom,
      periodTo,
    ],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      let query = supabase
        .from('salary_payouts')
        .select(`
          id, salary_id, clinic_id, user_id, period_start, period_end,
          base_amount, bonus_amount, deduction, total_amount, currency, status,
          paid_at, paid_by, notes, created_at,
          user:users!salary_payouts_user_id_fkey(id, first_name, last_name, full_name)
        `)
        .eq('clinic_id', currentClinic.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (payoutUserFilter !== 'ALL') query = query.eq('user_id', payoutUserFilter);
      if (payoutStatusFilter !== 'ALL') query = query.eq('status', payoutStatusFilter);
      if (periodFrom) query = query.gte('period_start', periodFrom);
      if (periodTo) query = query.lte('period_end', periodTo);

      const { data, error } = await query;
      if (error) throw error;
      return (data as PayoutRow[]) || [];
    },
    enabled: !!currentClinic?.id,
  });

  // ─── Clinic members (for create-form user select) ──────────────────
  const { data: members } = useQuery<ClinicMemberRow[]>({
    queryKey: ['accountant-clinic-members', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from('clinic_members')
        .select(`
          user_id, role,
          user:users!clinic_members_user_id_fkey(id, first_name, last_name, full_name, email)
        `)
        .eq('clinic_id', currentClinic.id);
      if (error) return [];
      return (data as ClinicMemberRow[]) || [];
    },
    enabled: !!currentClinic?.id,
  });

  // ─── Mutations ─────────────────────────────────────────────────────
  const createSalary = useMutation({
    mutationFn: async () => {
      if (!currentClinic?.id) throw new Error('Не выбрана клиника');
      if (!form.user_id) throw new Error('Выберите сотрудника');
      const payload: any = {
        clinic_id: currentClinic.id,
        user_id: form.user_id,
        role: form.role,
        scheme: form.scheme,
        base_amount: form.base_amount ? Number(form.base_amount) : 0,
        percent: form.percent ? Number(form.percent) : null,
        valid_from: form.valid_from,
        valid_to: form.valid_to || null,
        is_active: form.is_active,
      };
      const { error } = await supabase.from('salaries').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Готово', description: 'Схема зарплаты создана' });
      setCreateOpen(false);
      setForm(emptyForm());
      queryClient.invalidateQueries({ queryKey: ['accountant-salaries'] });
    },
    onError: (e: any) => {
      toast({
        title: 'Ошибка',
        description: e?.message ?? 'Не удалось создать',
        variant: 'destructive',
      });
    },
  });

  const approvePayout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('salary_payouts')
        .update({ status: 'APPROVED' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Готово', description: 'Выплата одобрена' });
      queryClient.invalidateQueries({ queryKey: ['accountant-salary-payouts'] });
    },
    onError: (e: any) =>
      toast({
        title: 'Ошибка',
        description: e?.message ?? 'Не удалось одобрить',
        variant: 'destructive',
      }),
  });

  const payPayout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('salary_payouts')
        .update({
          status: 'PAID',
          paid_at: new Date().toISOString(),
          paid_by: user?.id ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Готово', description: 'Выплата проведена' });
      queryClient.invalidateQueries({ queryKey: ['accountant-salary-payouts'] });
    },
    onError: (e: any) =>
      toast({
        title: 'Ошибка',
        description: e?.message ?? 'Не удалось выплатить',
        variant: 'destructive',
      }),
  });

  const memberOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];
    (members || []).forEach((m) => {
      if (!m.user_id || seen.has(m.user_id)) return;
      seen.add(m.user_id);
      list.push({ id: m.user_id, name: userName(m.user) });
    });
    (salaries || []).forEach((s) => {
      if (!s.user_id || seen.has(s.user_id)) return;
      seen.add(s.user_id);
      list.push({ id: s.user_id, name: userName(s.user) });
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [members, salaries]);

  return (
    <AccountantLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="font-heading text-foreground text-2xl lg:text-3xl">Зарплаты врачей</h1>
          <p className="text-muted-foreground">Схемы и выплаты сотрудникам клиники</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="schemes" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <Settings className="w-4 h-4" /> Схемы зарплат
            </TabsTrigger>
            <TabsTrigger value="payouts" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <HandCoins className="w-4 h-4" /> Выплаты
            </TabsTrigger>
          </TabsList>

          {/* ─── Schemes tab ───────────────────────────────────────── */}
          <TabsContent value="schemes" className="mt-6 space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5" /> Схемы зарплат
                  {salaries && (
                    <span className="text-sm text-slate-400 font-normal">
                      ({salaries.length})
                    </span>
                  )}
                </CardTitle>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-primary hover:bg-primary/90">
                      <PlusCircle className="w-4 h-4 mr-2" /> Добавить схему
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Новая схема зарплаты</DialogTitle>
                      <DialogDescription className="text-slate-400">
                        Заполните параметры и сохраните.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Сотрудник</label>
                        <Select
                          value={form.user_id}
                          onValueChange={(v) => setForm((f) => ({ ...f, user_id: v }))}
                        >
                          <SelectTrigger className="bg-slate-800 border-slate-700">
                            <SelectValue placeholder="Выберите сотрудника" />
                          </SelectTrigger>
                          <SelectContent>
                            {memberOptions.length === 0 ? (
                              <SelectItem value="__none" disabled>
                                Нет сотрудников
                              </SelectItem>
                            ) : (
                              memberOptions.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Роль</label>
                          <Select
                            value={form.role}
                            onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
                          >
                            <SelectTrigger className="bg-slate-800 border-slate-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="doctor">Врач</SelectItem>
                              <SelectItem value="assistant">Ассистент</SelectItem>
                              <SelectItem value="accountant">Бухгалтер</SelectItem>
                              <SelectItem value="manager">Менеджер</SelectItem>
                              <SelectItem value="admin">Администратор</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Схема</label>
                          <Select
                            value={form.scheme}
                            onValueChange={(v) => setForm((f) => ({ ...f, scheme: v }))}
                          >
                            <SelectTrigger className="bg-slate-800 border-slate-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FIXED">Фикс. ставка</SelectItem>
                              <SelectItem value="PERCENT_REVENUE">% от выручки</SelectItem>
                              <SelectItem value="HYBRID">Гибрид</SelectItem>
                              <SelectItem value="PER_SERVICE">За услугу</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">База (UZS)</label>
                          <Input
                            type="number"
                            min={0}
                            value={form.base_amount}
                            onChange={(e) => setForm((f) => ({ ...f, base_amount: e.target.value }))}
                            className="bg-slate-800 border-slate-700 text-white"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Процент (%)</label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={form.percent}
                            onChange={(e) => setForm((f) => ({ ...f, percent: e.target.value }))}
                            className="bg-slate-800 border-slate-700 text-white"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Действует с</label>
                          <Input
                            type="date"
                            value={form.valid_from}
                            onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                            className="bg-slate-800 border-slate-700 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Действует до</label>
                          <Input
                            type="date"
                            value={form.valid_to}
                            onChange={(e) => setForm((f) => ({ ...f, valid_to: e.target.value }))}
                            className="bg-slate-800 border-slate-700 text-white"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={form.is_active}
                          onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                          className="rounded border-slate-600 bg-slate-800"
                        />
                        Активна
                      </label>
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        className="border-slate-600 text-slate-200"
                        onClick={() => setCreateOpen(false)}
                      >
                        Отмена
                      </Button>
                      <Button
                        onClick={() => createSalary.mutate()}
                        disabled={createSalary.isPending}
                        className="bg-primary hover:bg-primary/90"
                      >
                        {createSalary.isPending && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        Сохранить
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {salariesLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full bg-slate-700" />
                    <Skeleton className="h-10 w-full bg-slate-700" />
                    <Skeleton className="h-10 w-full bg-slate-700" />
                  </div>
                ) : !salaries || salaries.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">Схем не найдено</p>
                    <p className="text-sm mt-1">Добавьте первую схему зарплаты</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-transparent">
                        <TableHead className="text-slate-400">Сотрудник</TableHead>
                        <TableHead className="text-slate-400">Роль</TableHead>
                        <TableHead className="text-slate-400">Схема</TableHead>
                        <TableHead className="text-slate-400 text-right">База</TableHead>
                        <TableHead className="text-slate-400 text-right">%</TableHead>
                        <TableHead className="text-slate-400">Период</TableHead>
                        <TableHead className="text-slate-400">Активна</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salaries.map((s) => (
                        <TableRow key={s.id} className="border-slate-700 hover:bg-slate-700/30">
                          <TableCell className="text-white font-medium">
                            {userName(s.user)}
                          </TableCell>
                          <TableCell className="text-slate-200">{roleLabel(s.role)}</TableCell>
                          <TableCell className="text-slate-200">{schemeLabel(s.scheme)}</TableCell>
                          <TableCell className="text-right text-white">
                            {Number(s.base_amount ?? 0).toLocaleString('ru-RU')}
                          </TableCell>
                          <TableCell className="text-right text-slate-200">
                            {s.percent != null ? `${s.percent}%` : '—'}
                          </TableCell>
                          <TableCell className="text-slate-300 whitespace-nowrap">
                            {s.valid_from
                              ? format(new Date(s.valid_from), 'dd.MM.yyyy', { locale: ru })
                              : '—'}
                            {' — '}
                            {s.valid_to
                              ? format(new Date(s.valid_to), 'dd.MM.yyyy', { locale: ru })
                              : '∞'}
                          </TableCell>
                          <TableCell>
                            {s.is_active ? (
                              <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">
                                Да
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-500/15 text-slate-300 border border-slate-500/40">
                                Нет
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Payouts tab ──────────────────────────────────────── */}
          <TabsContent value="payouts" className="mt-6 space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 grid gap-3 md:grid-cols-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Сотрудник</label>
                  <Select value={payoutUserFilter} onValueChange={setPayoutUserFilter}>
                    <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Все</SelectItem>
                      {memberOptions.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Статус</label>
                  <Select value={payoutStatusFilter} onValueChange={setPayoutStatusFilter}>
                    <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Все</SelectItem>
                      <SelectItem value="PENDING">Ожидание</SelectItem>
                      <SelectItem value="APPROVED">Одобрено</SelectItem>
                      <SelectItem value="PAID">Выплачено</SelectItem>
                      <SelectItem value="CANCELLED">Отменено</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">С даты</label>
                  <Input
                    type="date"
                    value={periodFrom}
                    onChange={(e) => setPeriodFrom(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">По дату</label>
                  <Input
                    type="date"
                    value={periodTo}
                    onChange={(e) => setPeriodTo(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <HandCoins className="w-5 h-5" /> Выплаты
                  {payouts && (
                    <span className="text-sm text-slate-400 font-normal">
                      ({payouts.length})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {payoutsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full bg-slate-700" />
                    <Skeleton className="h-10 w-full bg-slate-700" />
                    <Skeleton className="h-10 w-full bg-slate-700" />
                  </div>
                ) : !payouts || payouts.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <XCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">Выплат не найдено</p>
                    <p className="text-sm mt-1">Создайте схему зарплаты, и выплаты появятся здесь</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-transparent">
                        <TableHead className="text-slate-400">Сотрудник</TableHead>
                        <TableHead className="text-slate-400">Период</TableHead>
                        <TableHead className="text-slate-400 text-right">База</TableHead>
                        <TableHead className="text-slate-400 text-right">Бонус</TableHead>
                        <TableHead className="text-slate-400 text-right">Удержания</TableHead>
                        <TableHead className="text-slate-400 text-right">Итого</TableHead>
                        <TableHead className="text-slate-400">Статус</TableHead>
                        <TableHead className="text-slate-400 text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payouts.map((p) => {
                        const sUpper = (p.status || '').toUpperCase();
                        return (
                          <TableRow key={p.id} className="border-slate-700 hover:bg-slate-700/30">
                            <TableCell className="text-white font-medium">
                              {userName(p.user)}
                            </TableCell>
                            <TableCell className="text-slate-300 whitespace-nowrap">
                              {p.period_start
                                ? format(new Date(p.period_start), 'dd.MM.yyyy', { locale: ru })
                                : '—'}
                              {' — '}
                              {p.period_end
                                ? format(new Date(p.period_end), 'dd.MM.yyyy', { locale: ru })
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right text-slate-200">
                              {Number(p.base_amount ?? 0).toLocaleString('ru-RU')}
                            </TableCell>
                            <TableCell className="text-right text-emerald-400">
                              {Number(p.bonus_amount ?? 0).toLocaleString('ru-RU')}
                            </TableCell>
                            <TableCell className="text-right text-red-400">
                              {Number(p.deduction ?? 0).toLocaleString('ru-RU')}
                            </TableCell>
                            <TableCell className="text-right text-white font-semibold">
                              {Number(p.total_amount ?? 0).toLocaleString('ru-RU')} {p.currency || 'UZS'}
                            </TableCell>
                            <TableCell>{payoutStatusBadge(p.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {sUpper === 'PENDING' && (
                                  <Button
                                    size="sm"
                                    disabled={approvePayout.isPending}
                                    className="bg-cyan-600 hover:bg-cyan-500 text-white"
                                    onClick={() => approvePayout.mutate(p.id)}
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-1" /> одобрить
                                  </Button>
                                )}
                                {sUpper === 'APPROVED' && (
                                  <Button
                                    size="sm"
                                    disabled={payPayout.isPending}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                                    onClick={() => payPayout.mutate(p.id)}
                                  >
                                    <HandCoins className="w-4 h-4 mr-1" /> выплатить
                                  </Button>
                                )}
                              </div>
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
    </AccountantLayout>
  );
}
