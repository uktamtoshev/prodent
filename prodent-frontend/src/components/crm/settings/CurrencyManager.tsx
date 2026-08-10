import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClinic } from '@/contexts/ClinicContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save, DollarSign, RefreshCw } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchClinicSetting, saveClinicSetting } from '@/lib/clinic-settings';

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
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [rates, setRates] = useState<CurrencyRates>(DEFAULT_RATES);

  const { data: settings } = useQuery({
    queryKey: ['clinic-settings', currentClinic?.id, 'currency_rates'],
    queryFn: async () => {
      if (!currentClinic?.id) return null;

      return fetchClinicSetting(currentClinic.id, 'currency_rates');
    },
    enabled: !!currentClinic?.id,
  });

  useEffect(() => {
    if (settings) {
      const value = settings as unknown as CurrencyRates;
      if (value.USD && value.EUR && value.RUB) {
        setRates(value);
      }
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentClinic?.id) throw new Error('No clinic selected');

      await saveClinicSetting(
        currentClinic.id,
        'currency_rates',
        { ...rates, updated_at: new Date().toISOString() } as Json,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      toast.success(t('crmCurrencyMgr.ratesSaved'));
    },
    onError: () => {
      toast.error(t('crmCurrencyMgr.saveError'));
    },
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ru-RU').format(num);
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-card-x py-card-y">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <DollarSign className="w-5 h-5" />
          {t('crmCurrencyMgr.currencyRates')}
        </CardTitle>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {t('crmCurrencyMgr.saveBtn')}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-border/50">
            <CardContent className="p-card-x">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-status-neutral-bg flex items-center justify-center">
                  <span className="text-status-neutral font-bold">$</span>
                </div>
                <div>
                  <div className="font-medium">{t('crmCurrencyMgr.dollarUsa')}</div>
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
                <span className="text-muted-foreground">{t('crmCurrencyMgr.sumLabel')}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-card-x">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-status-info-bg flex items-center justify-center">
                  <span className="text-status-info font-bold">€</span>
                </div>
                <div>
                  <div className="font-medium">{t('crmCurrencyMgr.euro')}</div>
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
                <span className="text-muted-foreground">{t('crmCurrencyMgr.sumLabel')}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-card-x">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center">
                  <span className="text-brand-700 font-bold">₽</span>
                </div>
                <div>
                  <div className="font-medium">{t('crmCurrencyMgr.ruble')}</div>
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
                <span className="text-muted-foreground">{t('crmCurrencyMgr.sumLabel')}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border/50">
          <div className="text-sm text-muted-foreground mb-2">{t('crmCurrencyMgr.calculator')}</div>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="text-sm">
              <span className="font-medium">$100</span> = {formatNumber(100 * rates.USD)} {t('crmCurrencyMgr.sumLabel')}
            </div>
            <div className="text-sm">
              <span className="font-medium">€100</span> = {formatNumber(100 * rates.EUR)} {t('crmCurrencyMgr.sumLabel')}
            </div>
            <div className="text-sm">
              <span className="font-medium">₽1000</span> = {formatNumber(1000 * rates.RUB)} {t('crmCurrencyMgr.sumLabel')}
            </div>
          </div>
        </div>

        {rates.updated_at && (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="w-3 h-3" />
            {t('crmCurrencyMgr.updated')}: {new Date(rates.updated_at).toLocaleString('ru-RU')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
