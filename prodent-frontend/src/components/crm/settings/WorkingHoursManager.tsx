import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Save, Clock } from 'lucide-react';
import type { Json } from '@/integrations/api/types';

interface DaySchedule {
  enabled: boolean;
  open: string;
  close: string;
  break_start?: string;
  break_end?: string;
}

interface WorkingHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

const DAYS = [
  { key: 'monday', label: 'Понедельник' },
  { key: 'tuesday', label: 'Вторник' },
  { key: 'wednesday', label: 'Среда' },
  { key: 'thursday', label: 'Четверг' },
  { key: 'friday', label: 'Пятница' },
  { key: 'saturday', label: 'Суббота' },
  { key: 'sunday', label: 'Воскресенье' },
] as const;

const DEFAULT_SCHEDULE: WorkingHours = {
  monday: { enabled: true, open: '09:00', close: '18:00' },
  tuesday: { enabled: true, open: '09:00', close: '18:00' },
  wednesday: { enabled: true, open: '09:00', close: '18:00' },
  thursday: { enabled: true, open: '09:00', close: '18:00' },
  friday: { enabled: true, open: '09:00', close: '18:00' },
  saturday: { enabled: true, open: '09:00', close: '14:00' },
  sunday: { enabled: false, open: '09:00', close: '18:00' },
};

export function WorkingHoursManager() {
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [schedule, setSchedule] = useState<WorkingHours>(DEFAULT_SCHEDULE);

  const { data: settings } = useQuery({
    queryKey: ['clinic-settings', currentClinic?.id, 'working_hours'],
    queryFn: async () => {
      if (!currentClinic?.id) return null;
      
      const { data, error } = await supabase
        .from('clinic_settings')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .eq('key', 'working_hours')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!currentClinic?.id,
  });

  useEffect(() => {
    if (settings?.value) {
      setSchedule(settings.value as unknown as WorkingHours);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentClinic?.id) throw new Error('No clinic selected');

      const { error } = await supabase
        .from('clinic_settings')
        .upsert([{
          clinic_id: currentClinic.id,
          key: 'working_hours',
          value: schedule as unknown as Json,
          description: 'Расписание работы клиники',
        }], {
          onConflict: 'clinic_id,key',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      toast.success('Расписание сохранено');
    },
    onError: () => {
      toast.error('Ошибка при сохранении');
    },
  });

  const updateDay = (day: keyof WorkingHours, field: keyof DaySchedule, value: string | boolean) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Расписание работы
        </CardTitle>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          Сохранить
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {DAYS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-muted/30">
              <div className="w-32">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={schedule[key].enabled}
                    onCheckedChange={(checked) => updateDay(key, 'enabled', checked)}
                  />
                  <span className={schedule[key].enabled ? 'font-medium' : 'text-muted-foreground'}>
                    {label}
                  </span>
                </div>
              </div>
              
              {schedule[key].enabled && (
                <div className="flex items-center gap-4 flex-1 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Открытие:</label>
                    <Input
                      type="time"
                      value={schedule[key].open}
                      onChange={(e) => updateDay(key, 'open', e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Закрытие:</label>
                    <Input
                      type="time"
                      value={schedule[key].close}
                      onChange={(e) => updateDay(key, 'close', e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Перерыв:</label>
                    <Input
                      type="time"
                      value={schedule[key].break_start || ''}
                      onChange={(e) => updateDay(key, 'break_start', e.target.value)}
                      className="w-28"
                      placeholder="с"
                    />
                    <span>-</span>
                    <Input
                      type="time"
                      value={schedule[key].break_end || ''}
                      onChange={(e) => updateDay(key, 'break_end', e.target.value)}
                      className="w-28"
                      placeholder="до"
                    />
                  </div>
                </div>
              )}
              
              {!schedule[key].enabled && (
                <span className="text-muted-foreground">Выходной</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
