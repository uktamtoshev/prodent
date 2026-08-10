import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchClinicSetting, saveClinicSetting } from '@/lib/clinic-settings';

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
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [integrations, setIntegrations] = useState<Integrations>(DEFAULT_INTEGRATIONS);

  const { data: settings } = useQuery({
    queryKey: ['clinic-settings', currentClinic?.id, 'integrations'],
    queryFn: async () => {
      if (!currentClinic?.id) return null;

      return fetchClinicSetting(currentClinic.id, 'integrations');
    },
    enabled: !!currentClinic?.id,
  });

  useEffect(() => {
    if (settings) {
      setIntegrations({ ...DEFAULT_INTEGRATIONS, ...(settings as unknown as Partial<Integrations>) });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentClinic?.id) throw new Error('No clinic selected');

      await saveClinicSetting(
        currentClinic.id,
        'integrations',
        integrations as unknown as Json,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      toast.success(t('crmIntegrations.settingsSaved'));
    },
    onError: () => {
      toast.error(t('crmIntegrations.saveError'));
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
        <CardHeader className="border-b border-border/50 px-card-x py-card-y">
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
                <Badge className="bg-status-success/10 text-status-success">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {t('crmIntegrations.active')}
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="w-3 h-3 mr-1" />
                  {t('crmIntegrations.disabled')}
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
                      placeholder={`${t('crmIntegrations.enterPlaceholder')} ${field.label.toLowerCase()}`}
                      className="mt-1"
                    />
                  ) : (
                    <Input
                      type={field.type || 'text'}
                      value={(integration[field.key] as string) || ''}
                      onChange={(e) => updateIntegration(integrationKey, field.key, e.target.value)}
                      placeholder={`${t('crmIntegrations.enterPlaceholder')} ${field.label.toLowerCase()}`}
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
          <h2 className="text-base font-bold">{t('crmIntegrations.integrations')}</h2>
          <p className="text-sm text-muted-foreground">{t('crmIntegrations.configureExternal')}</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {t('crmIntegrations.saveAll')}
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-sm text-muted-foreground">{t('crmIntegrations.notifications')}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <IntegrationCard
            integrationKey="sms"
            title={t('crmIntegrations.smsTitle')}
            description={t('crmIntegrations.smsDesc')}
            icon={MessageSquare}
            fields={[
              { key: 'api_key', label: t('crmIntegrations.apiKey') },
              { key: 'sender_id', label: t('crmIntegrations.senderId') },
            ]}
          />
          <IntegrationCard
            integrationKey="email"
            title={t('crmIntegrations.emailTitle')}
            description={t('crmIntegrations.emailDesc')}
            icon={Mail}
            fields={[
              { key: 'api_key', label: t('crmIntegrations.smtpHost') },
              { key: 'api_secret', label: t('crmIntegrations.smtpPassword'), type: 'password' },
              { key: 'from_email', label: t('crmIntegrations.senderEmail') },
            ]}
          />
          <IntegrationCard
            integrationKey="telegram"
            title={t('crmIntegrations.telegramTitle')}
            description={t('crmIntegrations.telegramDesc')}
            icon={Send}
            fields={[
              { key: 'api_key', label: t('crmIntegrations.botToken') },
            ]}
          />
        </div>

        <h3 className="font-medium text-sm text-muted-foreground pt-4">{t('crmIntegrations.paymentSystems')}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <IntegrationCard
            integrationKey="click"
            title="Click"
            description={t('crmIntegrations.clickDesc')}
            icon={CreditCard}
            fields={[
              { key: 'merchant_id', label: t('crmIntegrations.merchantId') },
              { key: 'api_key', label: t('crmIntegrations.serviceId') },
              { key: 'api_secret', label: t('crmIntegrations.secretKey'), type: 'password' },
            ]}
          />
          <IntegrationCard
            integrationKey="payme"
            title="Payme"
            description={t('crmIntegrations.paymeDesc')}
            icon={CreditCard}
            fields={[
              { key: 'merchant_id', label: t('crmIntegrations.merchantId') },
              { key: 'api_key', label: t('crmIntegrations.walletId') },
              { key: 'api_secret', label: t('crmIntegrations.secretKey'), type: 'password' },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
