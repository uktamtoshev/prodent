import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, differenceInDays, isPast } from 'date-fns';
import { ru } from 'date-fns/locale';
import { MoreVertical, Play, Pause, XCircle, Eye, BarChart3, Building2, User } from 'lucide-react';
import { useAdCampaigns, useUpdateCampaignStatus, useAllCampaignsAnalytics } from '@/hooks/useAdCampaigns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CampaignAnalyticsDialog } from './CampaignAnalyticsDialog';

const statusLabels: Record<string, string> = {
  pending: 'Ожидает',
  active: 'Активна',
  paused: 'Приостановлена',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500',
  active: 'bg-green-500/10 text-green-500',
  paused: 'bg-orange-500/10 text-orange-500',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-500/10 text-red-500',
};

const packageTypeLabels: Record<string, string> = {
  top_day: 'Топ дня',
  top_week: 'Топ недели',
  top_month: 'Топ месяца',
  banner: 'Баннер',
};

export function CampaignsList() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const { data: campaigns, isLoading } = useAdCampaigns(statusFilter === 'all' ? undefined : statusFilter);
  const { data: analytics } = useAllCampaignsAnalytics();
  const updateStatus = useUpdateCampaignStatus();

  const selectedCampaign = campaigns?.find(c => c.id === selectedCampaignId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Активные кампании</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Рекламные кампании</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Все статусы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="active">Активные</SelectItem>
              <SelectItem value="pending">Ожидающие</SelectItem>
              <SelectItem value="paused">Приостановленные</SelectItem>
              <SelectItem value="completed">Завершённые</SelectItem>
              <SelectItem value="cancelled">Отменённые</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {!campaigns?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Нет рекламных кампаний
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Объект</TableHead>
                  <TableHead>Пакет</TableHead>
                  <TableHead>Период</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Аналитика</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => {
                  const daysLeft = differenceInDays(new Date(campaign.end_date), new Date());
                  const isExpired = isPast(new Date(campaign.end_date));
                  const stats = analytics?.[campaign.id];

                  return (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {campaign.doctor ? (
                            <>
                              <Avatar className="h-9 w-9">
                                <AvatarImage src={campaign.doctor.profiles?.avatar_url} />
                                <AvatarFallback>
                                  <User className="w-4 h-4" />
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{campaign.doctor.profiles?.full_name}</p>
                                <p className="text-xs text-muted-foreground">{campaign.doctor.specialty}</p>
                              </div>
                            </>
                          ) : campaign.clinic ? (
                            <>
                              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                                <Building2 className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-medium">{campaign.clinic.name}</p>
                                <p className="text-xs text-muted-foreground">Клиника</p>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {campaign.package ? packageTypeLabels[campaign.package.package_type] : '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{format(new Date(campaign.start_date), 'd MMM', { locale: ru })} — {format(new Date(campaign.end_date), 'd MMM yyyy', { locale: ru })}</p>
                          <p className={cn(
                            "text-xs",
                            isExpired ? "text-red-500" : daysLeft <= 3 ? "text-yellow-500" : "text-muted-foreground"
                          )}>
                            {isExpired ? 'Истёк' : `${daysLeft} дн. осталось`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("font-normal", statusColors[campaign.status])}>
                          {statusLabels[campaign.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-2"
                          onClick={() => setSelectedCampaignId(campaign.id)}
                        >
                          {stats ? (
                            <>
                              <span className="flex items-center gap-1" title="Показы">
                                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                {stats.impressions}
                              </span>
                              <span className="flex items-center gap-1" title="Просмотры профиля">
                                <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                                {stats.profile_views}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">Подробнее</span>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {campaign.amount_paid.toLocaleString()} {campaign.currency}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedCampaignId(campaign.id)}>
                              <BarChart3 className="w-4 h-4 mr-2" />
                              Аналитика
                            </DropdownMenuItem>
                            {campaign.status === 'active' && (
                              <DropdownMenuItem onClick={() => updateStatus.mutate({ id: campaign.id, status: 'paused' })}>
                                <Pause className="w-4 h-4 mr-2" />
                                Приостановить
                              </DropdownMenuItem>
                            )}
                            {campaign.status === 'paused' && (
                              <DropdownMenuItem onClick={() => updateStatus.mutate({ id: campaign.id, status: 'active' })}>
                                <Play className="w-4 h-4 mr-2" />
                                Возобновить
                              </DropdownMenuItem>
                            )}
                            {campaign.status === 'pending' && (
                              <DropdownMenuItem onClick={() => updateStatus.mutate({ id: campaign.id, status: 'active' })}>
                                <Play className="w-4 h-4 mr-2" />
                                Активировать
                              </DropdownMenuItem>
                            )}
                            {!['completed', 'cancelled'].includes(campaign.status) && (
                              <DropdownMenuItem 
                                className="text-red-500"
                                onClick={() => updateStatus.mutate({ id: campaign.id, status: 'cancelled' })}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Отменить
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedCampaign && (
        <CampaignAnalyticsDialog
          campaignId={selectedCampaignId!}
          isOpen={!!selectedCampaignId}
          onClose={() => setSelectedCampaignId(null)}
          campaign={selectedCampaign}
        />
      )}
    </>
  );
}
