import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Settings as SettingsIcon, Building2 } from 'lucide-react';

import { ClinicAdminLayout } from '@/components/clinic-admin/ClinicAdminLayout';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

interface ClinicRecord {
  id: string;
  name?: string | null;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  working_hours?: any;
  logo_url?: string | null;
}

interface FormState {
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  working_hours: string;
  logo_url: string;
}

const emptyForm: FormState = {
  name: '',
  description: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  working_hours: '',
  logo_url: '',
};

function formatJson(value: any): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

export default function ClinicAdminSettings() {
  const { currentClinic, refreshClinics } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = currentClinic?.id;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [hoursError, setHoursError] = useState<string | null>(null);

  const { data: clinic, isLoading } = useQuery({
    queryKey: ['clinic-admin-settings', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', clinicId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data || null) as ClinicRecord | null;
    },
    enabled: !!clinicId,
  });

  useEffect(() => {
    if (clinic) {
      setForm({
        name: clinic.name || '',
        description: clinic.description || '',
        address: clinic.address || '',
        phone: clinic.phone || '',
        email: clinic.email || '',
        website: clinic.website || '',
        working_hours: formatJson(clinic.working_hours),
        logo_url: clinic.logo_url || '',
      });
    }
  }, [clinic]);

  const updateMutation = useMutation({
    mutationFn: async (data: FormState) => {
      if (!clinicId) throw new Error('Не выбрана клиника');
      if (!data.name.trim()) throw new Error('Введите название клиники');

      let workingHours: any = null;
      if (data.working_hours.trim()) {
        try {
          workingHours = JSON.parse(data.working_hours);
        } catch {
          throw new Error('Часы работы должны быть валидным JSON');
        }
      }

      const payload: Record<string, any> = {
        name: data.name.trim(),
        description: data.description.trim() || null,
        address: data.address.trim() || null,
        phone: data.phone.trim() || null,
        email: data.email.trim() || null,
        website: data.website.trim() || null,
        working_hours: workingHours,
        logo_url: data.logo_url.trim() || null,
      };

      const { error } = await supabase
        .from('clinics')
        .update(payload)
        .eq('id', clinicId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast({ title: 'Настройки сохранены', description: 'Данные клиники обновлены' });
      queryClient.invalidateQueries({ queryKey: ['clinic-admin-settings', clinicId] });
      refreshClinics?.();
    },
    onError: (e: any) => {
      toast({
        title: 'Ошибка',
        description: e?.message || 'Не удалось сохранить',
        variant: 'destructive',
      });
    },
  });

  const handleHoursChange = (value: string) => {
    setForm((f) => ({ ...f, working_hours: value }));
    if (!value.trim()) {
      setHoursError(null);
      return;
    }
    try {
      JSON.parse(value);
      setHoursError(null);
    } catch {
      setHoursError('Невалидный JSON');
    }
  };

  const isDirty = useMemo(() => {
    if (!clinic) return false;
    return (
      form.name !== (clinic.name || '') ||
      form.description !== (clinic.description || '') ||
      form.address !== (clinic.address || '') ||
      form.phone !== (clinic.phone || '') ||
      form.email !== (clinic.email || '') ||
      form.website !== (clinic.website || '') ||
      form.working_hours !== formatJson(clinic.working_hours) ||
      form.logo_url !== (clinic.logo_url || '')
    );
  }, [form, clinic]);

  return (
    <ClinicAdminLayout>
      <div className="p-4 lg:p-8 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-primary" />
            Настройки клиники
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {currentClinic ? currentClinic.name : 'Выберите клинику'}
          </p>
        </div>

        {isLoading ? (
          <Card><CardContent className="p-6 space-y-3">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent></Card>
        ) : !clinic ? (
          <Card className="border-dashed">
            <CardContent className="py-16 flex flex-col items-center text-center">
              <Building2 className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Клиника не найдена</p>
            </CardContent>
          </Card>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (hoursError) {
                toast({
                  title: 'Ошибка валидации',
                  description: hoursError,
                  variant: 'destructive',
                });
                return;
              }
              updateMutation.mutate(form);
            }}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Основная информация</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cs-name">Название</Label>
                  <Input
                    id="cs-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cs-description">Описание</Label>
                  <Textarea
                    id="cs-description"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cs-logo">Логотип (URL)</Label>
                  <Input
                    id="cs-logo"
                    type="url"
                    placeholder="https://..."
                    value={form.logo_url}
                    onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Контакты</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cs-address">Адрес</Label>
                  <Input
                    id="cs-address"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cs-phone">Телефон</Label>
                    <Input
                      id="cs-phone"
                      type="tel"
                      placeholder="+998 ..."
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cs-email">Email</Label>
                    <Input
                      id="cs-email"
                      type="email"
                      placeholder="info@clinic.com"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cs-website">Сайт</Label>
                  <Input
                    id="cs-website"
                    type="url"
                    placeholder="https://clinic.com"
                    value={form.website}
                    onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Часы работы (JSON)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  id="cs-hours"
                  rows={8}
                  className="font-mono text-xs"
                  placeholder='{ "mon": "09:00-18:00", "tue": "09:00-18:00" }'
                  value={form.working_hours}
                  onChange={(e) => handleHoursChange(e.target.value)}
                />
                {hoursError && <p className="text-xs text-red-500">{hoursError}</p>}
                <p className="text-xs text-muted-foreground">
                  Введите расписание в формате JSON. Оставьте пустым, если не используется.
                </p>
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="submit"
                className="gap-2"
                disabled={updateMutation.isPending || !isDirty || !!hoursError}
              >
                <Save className="w-4 h-4" />
                {updateMutation.isPending ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </ClinicAdminLayout>
  );
}
