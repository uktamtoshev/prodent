import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Loader2, Save } from 'lucide-react';
import type { ClinicProfileData } from './types';

interface ClinicSettingsProps {
  clinic: ClinicProfileData;
}

/**
 * Clinic profile editor (owner-only "Настройки" tab). Previously the tab existed
 * in the tab bar but had no render branch — selecting it showed a blank panel, and
 * there was no clinic profile editor anywhere on the platform. Cover/logo are edited
 * from the header; this edits the textual fields. Saves via the data shim.
 */
export function ClinicSettings({ clinic }: ClinicSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: clinic.name || '',
    description: clinic.description || '',
    phone: clinic.phone || '',
    email: clinic.email || '',
    website: clinic.website || '',
    address: clinic.address || '',
    city: clinic.city || '',
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Укажите название клиники', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('clinics')
        .update({
          name: form.name.trim(),
          description: form.description.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          website: form.website.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
        })
        .eq('id', clinic.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['clinic', clinic.id] });
      toast({ title: 'Сохранено', description: 'Профиль клиники обновлён' });
    } catch (error: unknown) {
      toast({ title: 'Не удалось сохранить', description: error instanceof Error ? error.message : 'Неизвестная ошибка', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const field = (
    k: keyof typeof form,
    label: string,
    opts?: { type?: string; area?: boolean; placeholder?: string },
  ) => {
    const inputId = `clinic-settings-${k}`;

    return (
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={inputId}>{label}</Label>
        {opts?.area ? (
          <Textarea
            id={inputId}
            value={form[k]}
            onChange={(e) => set(k, e.target.value)}
            rows={4}
            placeholder={opts?.placeholder}
            className="min-h-24 max-w-full"
          />
        ) : (
          <Input
            id={inputId}
            type={opts?.type || 'text'}
            value={form[k]}
            onChange={(e) => set(k, e.target.value)}
            placeholder={opts?.placeholder}
            required={k === 'name'}
            className="min-h-11 max-w-full"
          />
        )}
      </div>
    );
  };

  return (
    <Card
      role="region"
      aria-labelledby="clinic-settings-heading"
      className="w-full min-w-0 max-w-2xl p-4 sm:p-6"
    >
      <h2 id="clinic-settings-heading" className="mb-1 text-lg font-semibold">Настройки профиля</h2>
      <p className="text-sm text-muted-foreground mb-5">Обложку и логотип можно изменить в шапке профиля.</p>
      <div className="grid gap-4">
        {field('name', 'Название клиники *')}
        {field('description', 'Описание', { area: true, placeholder: 'О клинике, специализация, оснащение…' })}
        <div className="grid sm:grid-cols-2 gap-4">
          {field('phone', 'Телефон', { type: 'tel', placeholder: '+998…' })}
          {field('email', 'Email', { type: 'email' })}
        </div>
        {field('website', 'Веб-сайт', { type: 'url', placeholder: 'https://…' })}
        <div className="grid sm:grid-cols-2 gap-4">
          {field('city', 'Город')}
          {field('address', 'Адрес')}
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={save} disabled={saving} className="min-h-11 w-full gap-2 sm:w-auto">
          {saving ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="h-4 w-4" />
          )}
          Сохранить
        </Button>
      </div>
    </Card>
  );
}
