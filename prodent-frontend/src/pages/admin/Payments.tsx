import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Payments() {
  const { t } = useLanguage();

  // NOTE (pilot): the `invoices`/`payments` tables are intentionally NOT exposed
  // through the generic /api/v1/data proxy (financial data is managed via
  // PaymentService). Previously this page queried .from('invoices'), which the
  // shim returned as an empty list after a 403 — making a forbidden module look
  // like "no payments yet". Until a dedicated admin finance endpoint exists we
  // render an honest "module unavailable in pilot" state instead of a
  // permanently-empty table.
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('adminPayments.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('adminPayments.subtitle')}</p>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center text-center py-16 gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Wallet className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">
                Модуль платежей недоступен в пилоте
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Финансовые данные (счета и платежи) обрабатываются отдельным защищённым
                сервисом и пока не выведены в админ-панель. Раздел появится после
                подключения выделенного эндпоинта.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
