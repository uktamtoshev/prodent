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
  Package
} from 'lucide-react';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type FilterType = 'all' | 'unread' | 'appointments' | 'finance' | 'system';

const filterConfig: { id: FilterType; label: string; icon: any }[] = [
  { id: 'all', label: 'Все', icon: Inbox },
  { id: 'unread', label: 'Непрочитанные', icon: Bell },
  { id: 'appointments', label: 'Записи', icon: Calendar },
  { id: 'finance', label: 'Финансы', icon: CreditCard },
  { id: 'system', label: 'Системные', icon: Shield },
];

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
];

const typeIcons: Record<string, any> = {
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
  general: Bell,
};

const typeLabels: Record<string, string> = {
  appointment_new: 'Новая запись',
  appointment_rescheduled: 'Перенос',
  appointment_cancelled: 'Отмена',
  appointment_confirmed: 'Подтверждение',
  appointment_reminder: 'Напоминание',
  invoice_ready: 'Счёт',
  payment_received: 'Оплата',
  medical_access_request: 'Запрос доступа',
  medical_access_approved: 'Доступ одобрен',
  medical_access_denied: 'Доступ отклонён',
  clinic_invitation: 'Приглашение',
  doctor_request: 'Запрос врача',
  message_new: 'Сообщение',
  low_stock: 'Склад',
  lab_order_ready: 'Лаборатория',
  general: 'Уведомление',
};

export default function Notifications() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

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
        key = 'Сегодня';
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = 'Вчера';
      } else {
        key = format(date, 'd MMMM', { locale: ru });
      }
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(notification);
    });
    
    return groups;
  }, [filteredNotifications]);

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
    toast.success('Отмечено как прочитанное');
  };

  const deleteSelected = async () => {
    for (const id of selectedIds) {
      await deleteNotification(id);
    }
    setSelectedIds(new Set());
    toast.success('Уведомления удалены');
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
        title: 'Нет уведомлений', 
        description: 'Здесь будут появляться уведомления о записях, платежах и других событиях' 
      },
      unread: { 
        title: 'Всё прочитано!', 
        description: 'У вас нет непрочитанных уведомлений' 
      },
      appointments: { 
        title: 'Нет уведомлений о записях', 
        description: 'Уведомления о новых, перенесённых или отменённых записях появятся здесь' 
      },
      finance: { 
        title: 'Нет финансовых уведомлений', 
        description: 'Уведомления о счетах и платежах появятся здесь' 
      },
      system: { 
        title: 'Нет системных уведомлений', 
        description: 'Уведомления о запросах доступа, приглашениях и других событиях появятся здесь' 
      },
    };

    const { title, description } = messages[filter];
    const FilterIcon = filterConfig.find(f => f.id === filter)?.icon || Bell;

    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <FilterIcon className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      </div>
    );
  };

  return (
    <CRMLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-foreground text-2xl">Центр уведомлений</h1>
            <p className="text-muted-foreground mt-1">
              {unreadCount > 0 ? `${unreadCount} непрочитанных` : 'Все уведомления прочитаны'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-2">
                <CheckCheck className="w-4 h-4" />
                Прочитать все
              </Button>
            )}
            {notifications.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={markAllAsRead}>
                    <CheckCheck className="w-4 h-4 mr-2" />
                    Прочитать все
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={clearAll}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Очистить все
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {filterConfig.map((filter) => {
            const count = getFilterCount(filter.id);
            const Icon = filter.icon;
            const isActive = activeFilter === filter.id;
            
            return (
              <Button
                key={filter.id}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(filter.id)}
                className={cn(
                  "gap-2 transition-all",
                  isActive && "shadow-md"
                )}
              >
                <Icon className="w-4 h-4" />
                {filter.label}
                {count > 0 && (
                  <Badge 
                    variant={isActive ? "secondary" : "outline"} 
                    className={cn(
                      "ml-1 h-5 px-1.5 text-xs",
                      isActive && "bg-primary-foreground/20 text-primary-foreground"
                    )}
                  >
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>

        {/* Mass Actions Bar */}
        {selectedIds.size > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox 
                  checked={selectedIds.size === filteredNotifications.length}
                  onCheckedChange={selectAll}
                />
                <span className="text-sm font-medium">
                  Выбрано: {selectedIds.size}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={markSelectedAsRead}
                  className="gap-2"
                >
                  <Check className="w-4 h-4" />
                  Прочитать
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={deleteSelected}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notifications List */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <EmptyState filter={activeFilter} />
            ) : (
              <div>
                {Object.entries(groupedNotifications).map(([date, items]) => (
                  <div key={date}>
                    {/* Date Header */}
                    <div className="px-4 py-2 bg-muted/30 border-b border-border/50 sticky top-0 z-10">
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
                            "px-4 py-4 flex items-start gap-4 cursor-pointer transition-colors group",
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
                              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                              !notification.read 
                                ? "bg-primary/10 text-primary" 
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <Icon className="w-5 h-5" />
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
                                  "text-sm text-foreground line-clamp-1",
                                  !notification.read && "font-semibold"
                                )}>
                                  {notification.title}
                                </h4>
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                                  {notification.message}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Clock className="w-3 h-3 text-muted-foreground/60" />
                                  <span className="text-xs text-muted-foreground/60">
                                    {formatDistanceToNow(new Date(notification.created_at), { 
                                      addSuffix: true, 
                                      locale: ru 
                                    })}
                                  </span>
                                  {notification.link && (
                                    <>
                                      <span className="text-muted-foreground/30">•</span>
                                      <ExternalLink className="w-3 h-3 text-muted-foreground/60" />
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              {/* Actions */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
      </div>
    </CRMLayout>
  );
}
