import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Bell, Check, CheckCheck, Inbox } from 'lucide-react';

import { ClinicAdminLayout } from '@/components/clinic-admin/ClinicAdminLayout';
import { supabase } from '@/integrations/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface NotificationRow {
  id: string;
  user_id: string;
  type?: string | null;
  title?: string | null;
  message?: string | null;
  body?: string | null;
  link?: string | null;
  is_read?: boolean | null;
  read?: boolean | null;
  created_at: string;
}

function isUnread(n: NotificationRow): boolean {
  if (typeof n.is_read === 'boolean') return !n.is_read;
  if (typeof n.read === 'boolean') return !n.read;
  return true;
}

export default function ClinicAdminNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['clinic-admin-notifications', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as NotificationRow[];
    },
    enabled: !!userId,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-admin-notifications', userId] });
    },
    onError: (e: any) => {
      toast({
        title: 'Ошибка',
        description: e?.message || 'Не удалось отметить как прочитанное',
        variant: 'destructive',
      });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const ids = (notifications || []).filter(isUnread).map((n) => n.id);
      if (ids.length === 0) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', ids);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast({ title: 'Готово', description: 'Все уведомления отмечены как прочитанные' });
      queryClient.invalidateQueries({ queryKey: ['clinic-admin-notifications', userId] });
    },
    onError: (e: any) => {
      toast({
        title: 'Ошибка',
        description: e?.message || 'Не удалось обновить',
        variant: 'destructive',
      });
    },
  });

  const unread = useMemo(() => (notifications || []).filter(isUnread), [notifications]);
  const all = notifications || [];

  const renderList = (items: NotificationRow[]) => {
    if (isLoading) {
      return (
        <div className="space-y-2 p-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div className="py-16 flex flex-col items-center text-center px-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 text-muted-foreground/60" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">Пусто</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Здесь будут появляться уведомления для администратора клиники.
          </p>
        </div>
      );
    }
    return (
      <div className="divide-y divide-border/50">
        {items.map((n) => {
          const unreadFlag = isUnread(n);
          const text = n.message || n.body || '';
          return (
            <div
              key={n.id}
              className={cn(
                'p-4 flex items-start gap-3 transition-colors',
                unreadFlag && 'bg-primary/5',
              )}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                  unreadFlag ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                <Bell className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {n.type && (
                        <Badge variant="outline" className="text-xs px-2 py-0 h-5">
                          {n.type}
                        </Badge>
                      )}
                      {unreadFlag && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <h4 className={cn('text-sm text-foreground', unreadFlag && 'font-semibold')}>
                      {n.title || 'Уведомление'}
                    </h4>
                    {text && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{text}</p>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-2">
                      {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true, locale: ru })}
                    </p>
                  </div>

                  {unreadFlag && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => markAsReadMutation.mutate(n.id)}
                      disabled={markAsReadMutation.isPending}
                      title="Отметить как прочитанное"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <ClinicAdminLayout>
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" />
              Уведомления
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {unread.length > 0 ? `${unread.length} непрочитанных` : 'Все уведомления прочитаны'}
            </p>
          </div>

          {unread.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="w-4 h-4" /> Прочитать все
            </Button>
          )}
        </div>

        <Tabs defaultValue="unread">
          <TabsList>
            <TabsTrigger value="unread" className="gap-2">
              Непрочитанные
              {unread.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {unread.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              Все
              {all.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {all.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unread" className="mt-4">
            <Card className="border-border/50">
              <CardContent className="p-0">{renderList(unread)}</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <Card className="border-border/50">
              <CardContent className="p-0">{renderList(all)}</CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ClinicAdminLayout>
  );
}
