import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClinic } from '@/contexts/ClinicContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save, DollarSign, RefreshCw } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface CurrencyRates {
  USD: number;
  EUR: number;
  RUB: number;
  updated_at: string;
}

const DEFAULT_RATES: CurrencyRates = {
  USD: 12500,
  EUR: 13500,
  RUB: 135,
  updated_at: new Date().toISOString(),
};

export function CurrencyManager() {
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [rates, setRates] = useState<CurrencyRates>(DEFAULT_RATES);

  const { data: settings } = useQuery({
    queryKey: ['clinic-settings', currentClinic?.id, 'currency_rates'],
    queryFn: async () => {
      if (!currentClinic?.id) return null;
      
      const { data, error } = await supabase
        .from('clinic_settings')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .eq('key', 'currency_rates')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!currentClinic?.id,
  });

  useEffect(() => {
    if (settings?.value) {
      const value = settings.value as unknown as CurrencyRates;
      if (value.USD && value.EUR && value.RUB) {
        setRates(value);
      }
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentClinic?.id) throw new Error('No clinic selected');

      const { error } = await supabase
        .from('clinic_settings')
        .upsert([{
          clinic_id: currentClinic.id,
          key: 'currency_rates',
          value: { ...rates, updated_at: new Date().toISOString() } as Json,
          description: 'Курсы валют',
        }], {
          onConflict: 'clinic_id,key',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      toast.success('Курсы валют сохранены');
    },
    onError: () => {
      toast.error('Ошибка при сохранении');
    },
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ru-RU').format(num);
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Курсы валют
        </CardTitle>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          Сохранить
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <span className="text-green-500 font-bold">$</span>
                </div>
                <div>
                  <div className="font-medium">Доллар США</div>
                  <div className="text-xs text-muted-foreground">USD</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={rates.USD}
                  onChange={(e) => setRates({ ...rates, USD: parseInt(e.target.value) || 0 })}
                  className="text-lg font-medium"
                />
                <span className="text-muted-foreground">сум</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <span className="text-blue-500 font-bold">€</span>
                </div>
                <div>
                  <div className="font-medium">Евро</div>
                  <div className="text-xs text-muted-foreground">EUR</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={rates.EUR}
                  onChange={(e) => setRates({ ...rates, EUR: parseInt(e.target.value) || 0 })}
                  className="text-lg font-medium"
                />
                <span className="text-muted-foreground">сум</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <span className="text-red-500 font-bold">₽</span>
                </div>
                <div>
                  <div className="font-medium">Российский рубль</div>
                  <div className="text-xs text-muted-foreground">RUB</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={rates.RUB}
                  onChange={(e) => setRates({ ...rates, RUB: parseInt(e.target.value) || 0 })}
                  className="text-lg font-medium"
                />
                <span className="text-muted-foreground">сум</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border/50">
          <div className="text-sm text-muted-foreground mb-2">Калькулятор</div>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="text-sm">
              <span className="font-medium">$100</span> = {formatNumber(100 * rates.USD)} сум
            </div>
            <div className="text-sm">
              <span className="font-medium">€100</span> = {formatNumber(100 * rates.EUR)} сум
            </div>
            <div className="text-sm">
              <span className="font-medium">₽1000</span> = {formatNumber(1000 * rates.RUB)} сум
            </div>
          </div>
        </div>

        {rates.updated_at && (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="w-3 h-3" />
            Обновлено: {new Date(rates.updated_at).toLocaleString('ru-RU')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
