import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Bell, 
  Calendar, 
  CreditCard, 
  Shield,
  UserPlus,
  MessageSquare,
  Check, 
  CheckCheck, 
  Trash2, 
  MoreHorizontal,
  Archive,
  Clock,
  ExternalLink,
  Inbox,
  X,
  FlaskConical,
  Package,
  type LucideIcon
} from 'lucide-react';
import { ErrorState } from "@/components/system/StatePanel";
import { ConfirmDialog } from "@/components/system/ConfirmDialog";
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDistanceToNow, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { a11yLabel } from "@/lib/a11y-labels";

type FilterType = 'all' | 'unread' | 'appointments' | 'finance' | 'system';

const appointmentTypes = [
  'appointment_new',
  'appointment_rescheduled',
  'appointment_cancelled',
  'appointment_reminder',
  'appointment_confirmed',
];

const financeTypes = [
  'invoice_ready',
  'payment_received',
];

const systemTypes = [
  'medical_access_request',
  'medical_access_approved',
  'medical_access_denied',
  'clinic_invitation',
  'doctor_request',
  'low_stock',
  'lab_order_ready',
  'LAB_ORDER',
];

const typeIcons: Record<string, LucideIcon> = {
  appointment_new: Calendar,
  appointment_rescheduled: Calendar,
  appointment_cancelled: X,
  appointment_confirmed: Check,
  appointment_reminder: Clock,
  invoice_ready: CreditCard,
  payment_received: CreditCard,
  medical_access_request: Shield,
  medical_access_approved: Shield,
  medical_access_denied: Shield,
  clinic_invitation: UserPlus,
  doctor_request: UserPlus,
  message_new: MessageSquare,
  low_stock: Package,
  lab_order_ready: FlaskConical,
  LAB_ORDER: FlaskConical,
  general: Bell,
};

export default function Notifications() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const filterConfig = useMemo<{ id: FilterType; label: string; icon: LucideIcon }[]>(() => [
    { id: 'all', label: t('crmNotifications.filterAll'), icon: Inbox },
    { id: 'unread', label: t('crmNotifications.filterUnread'), icon: Bell },
    { id: 'appointments', label: t('crmNotifications.filterAppointments'), icon: Calendar },
    { id: 'finance', label: t('crmNotifications.filterFinance'), icon: CreditCard },
    { id: 'system', label: t('crmNotifications.filterSystem'), icon: Shield },
  ], [t]);

  const typeLabels = useMemo<Record<string, string>>(() => ({
    appointment_new: t('crmNotifications.typeAppointmentNew'),
    appointment_rescheduled: t('crmNotifications.typeAppointmentRescheduled'),
    appointment_cancelled: t('crmNotifications.typeAppointmentCancelled'),
    appointment_confirmed: t('crmNotifications.typeAppointmentConfirmed'),
    appointment_reminder: t('crmNotifications.typeAppointmentReminder'),
    invoice_ready: t('crmNotifications.typeInvoiceReady'),
    payment_received: t('crmNotifications.typePaymentReceived'),
    medical_access_request: t('crmNotifications.typeMedicalAccessRequest'),
    medical_access_approved: t('crmNotifications.typeMedicalAccessApproved'),
    medical_access_denied: t('crmNotifications.typeMedicalAccessDenied'),
    clinic_invitation: t('crmNotifications.typeClinicInvitation'),
    doctor_request: t('crmNotifications.typeDoctorRequest'),
    message_new: t('crmNotifications.typeMessageNew'),
    low_stock: t('crmNotifications.typeLowStock'),
    lab_order_ready: t('crmNotifications.typeLabOrderReady'),
    LAB_ORDER: t('crmNotifications.typeLabOrderReady'),
    general: t('crmNotifications.typeGeneral'),
  }), [t]);
  const {
    notifications,
    unreadCount,
    loading,
    isError,
    retry,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  // Both of these destroy data with no undo, so they ask first. The clinic's
  // notification log holds doctor invitations, medical-record access requests,
  // low-stock warnings and lab-order alerts — one stray click used to wipe it
  // permanently, and ConfirmDialog was sitting unused in the design system.
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    switch (activeFilter) {
      case 'unread':
        return notifications.filter(n => !n.read);
      case 'appointments':
        return notifications.filter(n => appointmentTypes.includes(n.type));
      case 'finance':
        return notifications.filter(n => financeTypes.includes(n.type));
      case 'system':
        return notifications.filter(n => systemTypes.includes(n.type));
      default:
        return notifications;
    }
  }, [notifications, activeFilter]);

  // Group by date
  const groupedNotifications = useMemo(() => {
    const groups: { [key: string]: Notification[] } = {};
    
    filteredNotifications.forEach(notification => {
      const date = new Date(notification.created_at);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let key: string;
      if (date.toDateString() === today.toDateString()) {
        key = t('crmNotifications.today');
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = t('crmNotifications.yesterday');
      } else {
        key = format(date, 'd MMMM', { locale: ru });
      }
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(notification);
    });
    
    return groups;
  }, [filteredNotifications, t]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map(n => n.id)));
    }
  };

  const markSelectedAsRead = async () => {
    for (const id of selectedIds) {
      await markAsRead(id);
    }
    setSelectedIds(new Set());
    toast.success(t('crmNotifications.markedAsRead'));
  };

  const deleteSelected = async () => {
    for (const id of selectedIds) {
      await deleteNotification(id);
    }
    setSelectedIds(new Set());
    toast.success(t('crmNotifications.deleted'));
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const getFilterCount = (filter: FilterType): number => {
    switch (filter) {
      case 'unread':
        return unreadCount;
      case 'appointments':
        return notifications.filter(n => appointmentTypes.includes(n.type)).length;
      case 'finance':
        return notifications.filter(n => financeTypes.includes(n.type)).length;
      case 'system':
        return notifications.filter(n => systemTypes.includes(n.type)).length;
      default:
        return notifications.length;
    }
  };

  const EmptyState = ({ filter }: { filter: FilterType }) => {
    const messages: Record<FilterType, { title: string; description: string }> = {
      all: {
        title: t('crmNotifications.emptyAllTitle'),
        description: t('crmNotifications.emptyAllDesc')
      },
      unread: {
        title: t('crmNotifications.emptyUnreadTitle'),
        description: t('crmNotifications.emptyUnreadDesc')
      },
      appointments: {
        title: t('crmNotifications.emptyAppointmentsTitle'),
        description: t('crmNotifications.emptyAppointmentsDesc')
      },
      finance: {
        title: t('crmNotifications.emptyFinanceTitle'),
        description: t('crmNotifications.emptyFinanceDesc')
      },
      system: {
        title: t('crmNotifications.emptySystemTitle'),
        description: t('crmNotifications.emptySystemDesc')
      },
    };

    const { title, description } = messages[filter];
    const FilterIcon = filterConfig.find(f => f.id === filter)?.icon || Bell;

    return (
      <div className="m-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
          <FilterIcon className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      </div>
    );
  };

  return (
    <CRMLayout>
      <div className="space-y-6 p-4 pb-24 lg:p-6">
        {/* Header */}
        {/* Заголовок экрана лежит на холсте, без карточки-героя и без
            декоративной иконки — так в макете. Карточка занимала первый экран
            и повторяла название раздела, которое и так стоит в меню. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div>
                <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{t('crmNotifications.title')}</h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  {unreadCount > 0 ? t('crmNotifications.unreadCount').replace('{count}', String(unreadCount)) : t('crmNotifications.allRead')}
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllAsRead} className="w-full gap-2 sm:w-auto">
                  <CheckCheck className="h-4 w-4" />
                  {t('crmNotifications.readAll')}
                </Button>
              )}
              {notifications.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="w-full sm:w-9" aria-label={a11yLabel("more")}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={markAllAsRead}>
                      <CheckCheck className="mr-2 h-4 w-4" />
                      {t('crmNotifications.readAll')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setConfirmClearAll(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('crmNotifications.clearAll')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
        </div>

        {/* Срезы уведомлений — вкладками, как в макете. Раньше это была полоса
            кнопок-пилюль в собственной панели: она читалась как набор действий,
            хотя выбирает, что показать в списке ниже. Форма вкладки берётся из
            примитива, счётчик — круглой плашкой, как у остальных срезов. */}
        <div className="flex flex-wrap items-center gap-0.5">
          {filterConfig.map((filter) => {
            const count = getFilterCount(filter.id);
            const Icon = filter.icon;
            const isActive = activeFilter === filter.id;

            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                aria-pressed={isActive}
                className={cn(
                  "cabinet-control inline-flex items-center gap-1.5 rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border border-b-0 border-border bg-card font-semibold text-primary shadow-soft"
                    : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {filter.label}
                {count > 0 && (
                  <span className="rounded-full bg-status-neutral-bg px-1.5 text-xs font-bold tabular-nums text-status-neutral">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mass Actions Bar */}
        {selectedIds.size > 0 && (
          <Card className="overflow-hidden border-primary/50 bg-primary/5 shadow-soft">
            <CardContent className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Checkbox 
                  checked={selectedIds.size === filteredNotifications.length}
                  onCheckedChange={selectAll}
                />
                <span className="text-sm font-medium">
                  {t('crmNotifications.selected')}: {selectedIds.size}
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markSelectedAsRead}
                  className="w-full gap-2 sm:w-auto"
                >
                  <Check className="h-4 w-4" />
                  {t('crmNotifications.markRead')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDeleteSelected(true)}
                  className="w-full gap-2 text-destructive hover:text-destructive sm:w-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('crmNotifications.deleteAction')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notifications List */}
        <Card className="overflow-hidden border-border/50 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : isError ? (
              /* A third branch, ahead of the length check. Without it a failed
                 load fell through to "no notifications" and the user walked
                 away from pending access requests and lab alerts. */
              <div className="py-12">
                <ErrorState
                  title={t('common.error')}
                  description={t('crmNotifications.loadError')}
                  actionLabel={t('common.retry')}
                  onAction={() => void retry()}
                  className="mx-4 border-none bg-transparent"
                />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <EmptyState filter={activeFilter} />
            ) : (
              <div>
                {Object.entries(groupedNotifications).map(([date, items]) => (
                  <div key={date}>
                    {/* Date Header */}
                    <div className="sticky top-0 z-10 border-b border-border/50 bg-muted/40 px-4 py-2 backdrop-blur-sm">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {date}
                      </span>
                    </div>
                    
                    {/* Notifications */}
                    {items.map((notification, index) => {
                      const Icon = typeIcons[notification.type] || Bell;
                      const isSelected = selectedIds.has(notification.id);
                      
                      return (
                        <div
                          key={notification.id}
                          className={cn(
                            "group flex cursor-pointer flex-col gap-3 px-4 py-4 transition-colors sm:flex-row sm:items-start sm:gap-4",
                            "hover:bg-muted/30",
                            !notification.read && "bg-primary/5",
                            isSelected && "bg-primary/10",
                            index < items.length - 1 && "border-b border-border/30"
                          )}
                        >
                          {/* Checkbox */}
                          <div className="pt-0.5">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(notification.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          
                          {/* Icon */}
                          <div 
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                              !notification.read 
                                ? "bg-primary/10 text-primary" 
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          
                          {/* Content */}
                          <div 
                            className="flex-1 min-w-0"
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs px-2 py-0 h-5"
                                  >
                                    {typeLabels[notification.type] || notification.type}
                                  </Badge>
                                  {!notification.read && (
                                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                  )}
                                </div>
                                <h4 className={cn(
                                  "line-clamp-1 text-sm text-foreground",
                                  !notification.read && "font-semibold"
                                )}>
                                  {notification.title}
                                </h4>
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                                  {notification.message}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <Clock className="h-3 w-3 text-muted-foreground/60" />
                                  <span className="text-xs text-muted-foreground/60">
                                    {formatDistanceToNow(new Date(notification.created_at), { 
                                      addSuffix: true, 
                                      locale: ru 
                                    })}
                                  </span>
                                  {notification.link && (
                                    <>
                                      <span className="text-muted-foreground/30">•</span>
                                      <ExternalLink className="h-3 w-3 text-muted-foreground/60" />
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              {/* Actions */}
                              <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                {!notification.read && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsRead(notification.id);
                                    }}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(notification.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <ConfirmDialog
          open={confirmClearAll}
          onOpenChange={setConfirmClearAll}
          title={t('crmNotifications.clearAll')}
          description={t('crmNotifications.clearAllConfirm').replace('{count}', String(notifications.length))}
          destructive
          onConfirm={clearAll}
        />
        <ConfirmDialog
          open={confirmDeleteSelected}
          onOpenChange={setConfirmDeleteSelected}
          title={t('crmNotifications.deleteAction')}
          description={t('crmNotifications.deleteSelectedConfirm').replace('{count}', String(selectedIds.size))}
          destructive
          onConfirm={deleteSelected}
        />
      </div>
    </CRMLayout>
  );
}
