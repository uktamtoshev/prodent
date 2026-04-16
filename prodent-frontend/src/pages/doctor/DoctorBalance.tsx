import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { VirtualAccountCard } from '@/components/finance/VirtualAccountCard';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, TrendingUp, Wallet, History } from 'lucide-react';

export default function DoctorBalance() {
  const { user } = useAuth();

  // Get doctor ID for current user
  const { data: doctor, isLoading } = useQuery({
    queryKey: ['doctor-by-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('doctors')
        .select('id, specialty')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Get profile name
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  return (
    <DoctorLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold font-heading">Лицевой счёт</h1>
          <p className="text-muted-foreground">Управление балансом и пополнение счёта</p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-[500px]" />
            <Skeleton className="h-[500px]" />
          </div>
        ) : doctor ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Virtual Account Card */}
            <VirtualAccountCard
              type="doctor"
              entityId={doctor.id}
              entityName={profile?.full_name || 'Врач'}
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
                    <Wallet className="w-4 h-4 mt-0.5 text-primary" />
                    <p>Оплата рекламных кампаний для продвижения профиля</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <History className="w-4 h-4 mt-0.5 text-primary" />
                    <p>Продление подписки и премиум-функций</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CreditCard className="w-4 h-4 mt-0.5 text-primary" />
                    <p>Покупка значков и бейджей для профиля</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Профиль врача не найден</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DoctorLayout>
  );
}
