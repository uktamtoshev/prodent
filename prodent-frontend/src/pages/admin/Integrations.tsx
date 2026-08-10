import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, EyeOff, Save, Loader2, KeyRound, MessageSquare, Mail, CreditCard, ShieldAlert, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';

// ─── Provider catalogue ─────────────────────────────────────────────────────
// Edit this array to add a new integration: pick a `provider` key, list its
// fields, mark which ones are secrets. Backend doesn't care about the schema —
// it stores whatever JSON we send, so adding a provider is frontend-only.
type FieldType = 'text' | 'secret';
interface FieldDef { key: string; label: string; placeholder?: string; type: FieldType }
interface ProviderDef {
  key: string;
  title: string;
  description: string;
  icon: typeof KeyRound;
  fields: FieldDef[];
}

const PROVIDERS: ProviderDef[] = [
  {
    key: 'google',
    title: 'Google OAuth',
    description: 'adminIntegrations.descGoogle',
    icon: KeyRound,
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: '...apps.googleusercontent.com', type: 'text' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'GOCSPX-...', type: 'secret' },
      { key: 'redirect_uri', label: 'Redirect URI', placeholder: 'https://api.prodent.uz/api/v1/auth/oauth/google/callback', type: 'text' },
    ],
  },
  {
    key: 'sms',
    title: 'SMS (Playmobile)',
    description: 'adminIntegrations.descSms',
    icon: MessageSquare,
    fields: [
      { key: 'api_url', label: 'API URL', placeholder: 'https://send.smsxabar.uz/broker-api/send', type: 'text' },
      { key: 'login', label: 'Login', type: 'text' },
      { key: 'password', label: 'Password', type: 'secret' },
    ],
  },
  {
    key: 'smtp',
    title: 'SMTP (Email)',
    description: 'adminIntegrations.descSmtp',
    icon: Mail,
    fields: [
      { key: 'host', label: 'Host', placeholder: 'smtp.gmail.com', type: 'text' },
      { key: 'port', label: 'Port', placeholder: '587', type: 'text' },
      { key: 'username', label: 'Username', type: 'text' },
      { key: 'password', label: 'Password', type: 'secret' },
      { key: 'from_address', label: 'From address', placeholder: 'noreply@prodent.uz', type: 'text' },
    ],
  },
  {
    key: 'payme',
    title: 'Payme',
    description: 'adminIntegrations.descPayme',
    icon: CreditCard,
    fields: [
      { key: 'merchant_id', label: 'Merchant ID', type: 'text' },
      { key: 'secret_key', label: 'Secret Key', type: 'secret' },
      { key: 'endpoint', label: 'Endpoint', placeholder: 'https://checkout.paycom.uz', type: 'text' },
    ],
  },
  {
    key: 'click',
    title: 'Click',
    description: 'adminIntegrations.descClick',
    icon: CreditCard,
    fields: [
      { key: 'merchant_id', label: 'Merchant ID', type: 'text' },
      { key: 'service_id', label: 'Service ID', type: 'text' },
      { key: 'secret_key', label: 'Secret Key', type: 'secret' },
    ],
  },
  {
    key: 'uzum',
    title: 'Uzum',
    description: 'adminIntegrations.descUzum',
    icon: CreditCard,
    fields: [
      { key: 'merchant_id', label: 'Merchant ID', type: 'text' },
      { key: 'terminal_id', label: 'Terminal ID', type: 'text' },
      { key: 'secret_key', label: 'Secret Key', type: 'secret' },
    ],
  },
];

interface IntegrationRow {
  id?: string;
  provider: string;
  enabled: boolean;
  config: Record<string, string>;
}

const API_BASE = '/api/v1';

async function authFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem('prodent_access_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json();
}

export default function Integrations() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();

  // This page's backend (/admin/integrations) is SUPER_ADMIN-only. The shared
  // <AdminLayout> only guards generic admin-panel access, so admins/moderators
  // can reach this route and hit a 403 → blank/broken page. Gate in-page.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-integrations'],
    queryFn: () => authFetch('/admin/integrations') as Promise<IntegrationRow[]>,
    enabled: isSuperAdmin,
  });

  const byProvider = (provider: string): IntegrationRow =>
    data?.find((row) => row.provider === provider) ?? { provider, enabled: true, config: {} };

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">Интеграции</h1>
            <p className="text-muted-foreground">
              API-ключи и URL внешних сервисов. Изменения применяются мгновенно (кэш 60 сек).
            </p>
          </div>
        </div>

        {roleLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !isSuperAdmin ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 flex gap-3">
            <Lock className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">Доступ запрещён</p>
              <p className="text-muted-foreground">
                Эта страница доступна только для супер-администратора.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-medium mb-1">Внимание — секретные ключи в БД</p>
                <p>
                  Эта страница даёт удобство, но любой с доступом к БД (включая бэкапы) увидит секреты в открытом виде.
                  Для продакшена рекомендуется ротировать ключи периодически и ограничить доступ к этой странице ролью SUPER_ADMIN.
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 w-full rounded-lg" />
                ))}
              </div>
            ) : isError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 flex gap-3">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Не удалось загрузить интеграции</p>
                  <p className="text-muted-foreground">
                    Проверьте соединение и права доступа, затем обновите страницу.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {PROVIDERS.map((p) => (
                  <IntegrationCard
                    key={p.key}
                    provider={p}
                    initial={byProvider(p.key)}
                    onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin-integrations'] })}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

interface IntegrationCardProps {
  provider: ProviderDef;
  initial: IntegrationRow;
  onSaved: () => void;
}

function IntegrationCard({ provider, initial, onSaved }: IntegrationCardProps) {
  const { t } = useLanguage();
  const [config, setConfig] = useState<Record<string, string>>(initial.config ?? {});
  const [enabled, setEnabled] = useState<boolean>(initial.enabled ?? true);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const Icon = provider.icon;

  const save = useMutation({
    mutationFn: () =>
      authFetch(`/admin/integrations/${provider.key}`, {
        method: 'PUT',
        body: JSON.stringify({ config, enabled }),
      }),
    onSuccess: () => {
      toast.success(`${provider.title} — ${t('adminIntegrations.saved')}`);
      onSaved();
    },
    onError: (e: Error) => toast.error(`Ошибка сохранения: ${e.message}`),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {provider.title}
                {!enabled && <Badge variant="outline" className="text-xs">Выключено</Badge>}
              </CardTitle>
              <CardDescription className="mt-1">{t(provider.description)}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={`enabled-${provider.key}`} className="text-sm">Активно</Label>
            <Switch
              id={`enabled-${provider.key}`}
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {provider.fields.map((field) => {
            const isSecret = field.type === 'secret';
            const isRevealed = revealed[field.key] ?? false;
            return (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`${provider.key}-${field.key}`}>{field.label}</Label>
                <div className="relative">
                  <Input
                    id={`${provider.key}-${field.key}`}
                    type={isSecret && !isRevealed ? 'password' : 'text'}
                    value={config[field.key] ?? ''}
                    placeholder={field.placeholder}
                    onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className={isSecret ? 'pr-10' : ''}
                    autoComplete="off"
                  />
                  {isSecret && (
                    <button
                      type="button"
                      onClick={() => setRevealed((r) => ({ ...r, [field.key]: !r[field.key] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
