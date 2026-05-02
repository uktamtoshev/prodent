import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Megaphone, Plus, Calendar, Percent, Tag } from 'lucide-react';

import { ClinicAdminLayout } from '@/components/clinic-admin/ClinicAdminLayout';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface AdCampaign {
  id: string;
  clinic_id: string;
  title: string;
  description?: string | null;
  discount?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  active?: boolean | null;
  created_at?: string | null;
}

interface CampaignForm {
  title: string;
  description: string;
  discount: string;
  valid_from: string;
  valid_to: string;
}

const initialForm: CampaignForm = {
  title: '',
  description: '',
  discount: '',
  valid_from: '',
  valid_to: '',
};

function isCampaignActive(c: AdCampaign): boolean {
  const now = Date.now();
  const start = c.valid_from ? parseISO(c.valid_from).getTime() : -Infinity;
  const end = c.valid_to ? parseISO(c.valid_to).getTime() : Infinity;
  if (c.active === false) return false;
  return now >= start && now <= end;
}

export default function ClinicAdminPromotions() {
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = currentClinic?.id;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CampaignForm>(initialForm);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['clinic-admin-ad-campaigns', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_campaigns')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as AdCampaign[];
    },
    enabled: !!clinicId,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CampaignForm) => {
      if (!clinicId) throw new Error('Не выбрана клиника');
      if (!payload.title.trim()) throw new Error('Введите название акции');

      const insert: Record<string, any> = {
        clinic_id: clinicId,
        title: payload.title.trim(),
        description: payload.description.trim() || null,
        discount: payload.discount ? Number(payload.discount) : null,
        valid_from: payload.valid_from ? new Date(payload.valid_from).toISOString() : null,
        valid_to: payload.valid_to ? new Date(payload.valid_to).toISOString() : null,
        active: true,
      };
      const { error } = await supabase.from('ad_campaigns').insert(insert);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast({ title: 'Акция создана', description: 'Новая акция добавлена' });
      setForm(initialForm);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['clinic-admin-ad-campaigns', clinicId] });
    },
    onError: (e: any) => {
      toast({
        title: 'Ошибка',
        description: e?.message || 'Не удалось создать акцию',
        variant: 'destructive',
      });
    },
  });

  const sorted = useMemo(() => {
    if (!campaigns) return [];
    return [...campaigns].sort((a, b) => {
      const aActive = isCampaignActive(a) ? 0 : 1;
      const bActive = isCampaignActive(b) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  }, [campaigns]);

  return (
    <ClinicAdminLayout>
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-primary" />
              Акции
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {currentClinic ? currentClinic.name : 'Выберите клинику'} • {sorted.length} акций
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={!clinicId}>
                <Plus className="w-4 h-4" /> Новая акция
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Создать акцию</DialogTitle>
                <DialogDescription>
                  Заполните параметры акции для клиники.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="campaign-title">Название</Label>
                  <Input
                    id="campaign-title"
                    placeholder="Скидка 20% на чистку"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="campaign-desc">Описание</Label>
                  <Textarea
                    id="campaign-desc"
                    placeholder="Краткое описание акции"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="campaign-discount">Скидка, %</Label>
                  <Input
                    id="campaign-discount"
                    type="number"
                    min={0}
                    max={100}
                    placeholder="20"
                    value={form.discount}
                    onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="campaign-from">Начало</Label>
                    <Input
                      id="campaign-from"
                      type="date"
                      value={form.valid_from}
                      onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="campaign-to">Окончание</Label>
                    <Input
                      id="campaign-to"
                      type="date"
                      value={form.valid_to}
                      onChange={(e) => setForm((f) => ({ ...f, valid_to: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending}>
                  Отмена
                </Button>
                <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Сохранение…' : 'Создать'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Megaphone className="w-8 h-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">Нет акций</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Создайте первую акцию, чтобы привлечь больше пациентов.
              </p>
              <Button className="mt-4 gap-2" onClick={() => setOpen(true)} disabled={!clinicId}>
                <Plus className="w-4 h-4" /> Создать акцию
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((c) => {
              const active = isCampaignActive(c);
              return (
                <Card key={c.id} className="border-border/50 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Tag className="w-4 h-4 text-primary" />
                        {c.title}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={
                          active
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-neutral-500/15 text-neutral-600 dark:text-neutral-400 border-neutral-500/30'
                        }
                      >
                        {active ? 'активна' : 'завершена'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {c.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3">{c.description}</p>
                    )}
                    <div className="space-y-1.5 text-sm">
                      {c.discount != null && (
                        <div className="flex items-center gap-2 text-foreground">
                          <Percent className="w-4 h-4 text-amber-500" />
                          <span className="font-medium">{c.discount}%</span>
                          <span className="text-muted-foreground text-xs">скидка</span>
                        </div>
                      )}
                      {(c.valid_from || c.valid_to) && (
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                          <Calendar className="w-3.5 h-3.5" />
                          {c.valid_from ? format(parseISO(c.valid_from), 'd MMM yyyy', { locale: ru }) : '—'}
                          {' — '}
                          {c.valid_to ? format(parseISO(c.valid_to), 'd MMM yyyy', { locale: ru }) : '∞'}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ClinicAdminLayout>
  );
}
