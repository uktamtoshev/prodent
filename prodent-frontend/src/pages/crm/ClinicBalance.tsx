import { CRMLayout } from '@/components/crm/CRMLayout';
import { VirtualAccountCard } from '@/components/finance/VirtualAccountCard';
import { useClinic } from '@/contexts/ClinicContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, TrendingUp, Wallet, History, Building2 } from 'lucide-react';

export default function ClinicBalance() {
  const { currentClinic } = useClinic();

  return (
    <CRMLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold font-heading">Лицевой счёт клиники</h1>
          <p className="text-muted-foreground">Управление балансом и пополнение счёта</p>
        </div>

        {currentClinic ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Virtual Account Card */}
            <VirtualAccountCard
              type="clinic"
              entityId={currentClinic.id}
              entityName={currentClinic.name}
            />

            {/* Info Cards */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Способы пополнения
                  </CardTitle>
                  <CardDescription>
                    Доступные платёжные системы
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-[#00CCCC]/10">
                    <div className="w-12 h-12 rounded-lg bg-[#00CCCC] flex items-center justify-center text-white font-bold">
                      P
                    </div>
                    <div>
                      <p className="font-medium">Payme</p>
                      <p className="text-sm text-muted-foreground">Оплата картой или через приложение</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-[#009FE3]/10">
                    <div className="w-12 h-12 rounded-lg bg-[#009FE3] flex items-center justify-center text-white font-bold">
                      C
                    </div>
                    <div>
                      <p className="font-medium">Click</p>
                      <p className="text-sm text-muted-foreground">Быстрая оплата через Click</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-[#7B2D8E]/10">
                    <div className="w-12 h-12 rounded-lg bg-[#7B2D8E] flex items-center justify-center text-white font-bold">
                      U
                    </div>
                    <div>
                      <p className="font-medium">Uzum Bank</p>
                      <p className="text-sm text-muted-foreground">Оплата через Uzum Bank</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Для чего нужен баланс?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 mt-0.5 text-primary" />
                    <p>Оплата рекламных кампаний для продвижения клиники</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <History className="w-4 h-4 mt-0.5 text-primary" />
                    <p>Продление подписки и премиум-функций CRM</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Wallet className="w-4 h-4 mt-0.5 text-primary" />
                    <p>Покупка значков и бейджей для профиля клиники</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CreditCard className="w-4 h-4 mt-0.5 text-primary" />
                    <p>Оплата дополнительных модулей и интеграций</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Выберите клинику для просмотра баланса</p>
            </CardContent>
          </Card>
        )}
      </div>
    </CRMLayout>
  );
}
