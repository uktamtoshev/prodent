import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClinic } from '@/contexts/ClinicContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Save, MessageSquare, Mail, CreditCard, Send, CheckCircle, XCircle } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface Integration {
  enabled: boolean;
  api_key?: string;
  api_secret?: string;
  sender_id?: string;
  from_email?: string;
  merchant_id?: string;
  [key: string]: string | boolean | undefined;
}

interface Integrations {
  sms: Integration;
  email: Integration;
  telegram: Integration;
  click: Integration;
  payme: Integration;
}

const DEFAULT_INTEGRATIONS: Integrations = {
  sms: { enabled: false },
  email: { enabled: false },
  telegram: { enabled: false },
  click: { enabled: false },
  payme: { enabled: false },
};

export function IntegrationsManager() {
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [integrations, setIntegrations] = useState<Integrations>(DEFAULT_INTEGRATIONS);

  const { data: settings } = useQuery({
    queryKey: ['clinic-settings', currentClinic?.id, 'integrations'],
    queryFn: async () => {
      if (!currentClinic?.id) return null;
      
      const { data, error } = await supabase
        .from('clinic_settings')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .eq('key', 'integrations')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!currentClinic?.id,
  });

  useEffect(() => {
    if (settings?.value) {
      setIntegrations({ ...DEFAULT_INTEGRATIONS, ...(settings.value as unknown as Partial<Integrations>) });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentClinic?.id) throw new Error('No clinic selected');

      const { error } = await supabase
        .from('clinic_settings')
        .upsert([{
          clinic_id: currentClinic.id,
          key: 'integrations',
          value: integrations as unknown as Json,
          description: 'Настройки интеграций',
        }], {
          onConflict: 'clinic_id,key',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      toast.success('Настройки сохранены');
    },
    onError: () => {
      toast.error('Ошибка при сохранении');
    },
  });

  const updateIntegration = (key: keyof Integrations, field: string, value: string | boolean) => {
    setIntegrations(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const IntegrationCard = ({ 
    integrationKey, 
    title, 
    description, 
    icon: Icon,
    fields 
  }: { 
    integrationKey: keyof Integrations;
    title: string;
    description: string;
    icon: typeof MessageSquare;
    fields: { key: string; label: string; type?: string }[];
  }) => {
    const integration = integrations[integrationKey];
    
    return (
      <Card className={`border-border/50 ${integration.enabled ? 'ring-1 ring-primary/30' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${integration.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                <Icon className={`w-5 h-5 ${integration.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="text-xs">{description}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {integration.enabled ? (
                <Badge className="bg-emerald-500/10 text-emerald-500">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Активно
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="w-3 h-3 mr-1" />
                  Отключено
                </Badge>
              )}
              <Switch
                checked={integration.enabled}
                onCheckedChange={(checked) => updateIntegration(integrationKey, 'enabled', checked)}
              />
            </div>
          </div>
        </CardHeader>
        {integration.enabled && (
          <CardContent className="pt-0">
            <div className="grid gap-3">
              {fields.map(field => (
                <div key={field.key}>
                  <label className="text-xs text-muted-foreground">{field.label}</label>
                  {field.type === 'password' ? (
                    <PasswordInput
                      value={(integration[field.key] as string) || ''}
                      onChange={(e) => updateIntegration(integrationKey, field.key, e.target.value)}
                      placeholder={`Введите ${field.label.toLowerCase()}`}
                      className="mt-1"
                    />
                  ) : (
                    <Input
                      type={field.type || 'text'}
                      value={(integration[field.key] as string) || ''}
                      onChange={(e) => updateIntegration(integrationKey, field.key, e.target.value)}
                      placeholder={`Введите ${field.label.toLowerCase()}`}
                      className="mt-1"
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Интеграции</h2>
          <p className="text-sm text-muted-foreground">Настройка внешних сервисов</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          Сохранить все
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-sm text-muted-foreground">Уведомления</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <IntegrationCard
            integrationKey="sms"
            title="SMS уведомления"
            description="PlayMobile, Eskiz и др."
            icon={MessageSquare}
            fields={[
              { key: 'api_key', label: 'API ключ' },
              { key: 'sender_id', label: 'Sender ID' },
            ]}
          />
          <IntegrationCard
            integrationKey="email"
            title="Email уведомления"
            description="SMTP сервер"
            icon={Mail}
            fields={[
              { key: 'api_key', label: 'SMTP хост' },
              { key: 'api_secret', label: 'SMTP пароль', type: 'password' },
              { key: 'from_email', label: 'Email отправителя' },
            ]}
          />
          <IntegrationCard
            integrationKey="telegram"
            title="Telegram бот"
            description="Уведомления в Telegram"
            icon={Send}
            fields={[
              { key: 'api_key', label: 'Bot Token' },
            ]}
          />
        </div>

        <h3 className="font-medium text-sm text-muted-foreground pt-4">Платежные системы</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <IntegrationCard
            integrationKey="click"
            title="Click"
            description="Прием платежей через Click"
            icon={CreditCard}
            fields={[
              { key: 'merchant_id', label: 'Merchant ID' },
              { key: 'api_key', label: 'Service ID' },
              { key: 'api_secret', label: 'Secret Key', type: 'password' },
            ]}
          />
          <IntegrationCard
            integrationKey="payme"
            title="Payme"
            description="Прием платежей через Payme"
            icon={CreditCard}
            fields={[
              { key: 'merchant_id', label: 'Merchant ID' },
              { key: 'api_key', label: 'Кошелек ID' },
              { key: 'api_secret', label: 'Secret Key', type: 'password' },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
