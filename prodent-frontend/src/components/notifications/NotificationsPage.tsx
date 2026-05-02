import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, Clock, Calendar, CreditCard, FlaskConical, Package, X, MessageCircle, UserPlus, Star, Heart, MoreHorizontal, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow, format, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";

const typeIcons: Record<string, any> = {
  appointment_new: Calendar,
  appointment_rescheduled: Calendar,
  appointment_cancelled: X,
  appointment_reminder: Clock,
  appointment_confirmed: Check,
  invoice_ready: CreditCard,
  payment_received: CreditCard,
  lab_order_ready: FlaskConical,
  low_stock: Package,
  message_new: MessageCircle,
  patient_request: UserPlus,
  review_new: Star,
  medical_access_request: Heart,
  general: Bell,
};

const typeColors: Record<string, { bg: string; icon: string }> = {
  appointment_new: { bg: "bg-emerald-500", icon: "text-white" },
  appointment_rescheduled: { bg: "bg-amber-500", icon: "text-white" },
  appointment_cancelled: { bg: "bg-red-500", icon: "text-white" },
  appointment_reminder: { bg: "bg-blue-500", icon: "text-white" },
  appointment_confirmed: { bg: "bg-emerald-500", icon: "text-white" },
  invoice_ready: { bg: "bg-primary", icon: "text-primary-foreground" },
  payment_received: { bg: "bg-emerald-500", icon: "text-white" },
  lab_order_ready: { bg: "bg-purple-500", icon: "text-white" },
  low_stock: { bg: "bg-amber-500", icon: "text-white" },
  message_new: { bg: "bg-blue-500", icon: "text-white" },
  patient_request: { bg: "bg-primary", icon: "text-primary-foreground" },
  review_new: { bg: "bg-yellow-500", icon: "text-white" },
  medical_access_request: { bg: "bg-pink-500", icon: "text-white" },
  general: { bg: "bg-muted", icon: "text-muted-foreground" },
};

const typeLabels: Record<string, string> = {
  appointment_new: "Новая запись",
  appointment_rescheduled: "Перенос записи",
  appointment_cancelled: "Отмена записи",
  appointment_reminder: "Напоминание",
  appointment_confirmed: "Подтверждение",
  invoice_ready: "Счёт",
  payment_received: "Оплата",
  lab_order_ready: "Лаборатория",
  low_stock: "Склад",
  message_new: "Сообщение",
  patient_request: "Запрос пациента",
  review_new: "Отзыв",
  medical_access_request: "Доступ к медкарте",
  general: "Общее",
};

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

function NotificationItem({ notification, onMarkRead, onDelete }: NotificationItemProps) {
  const navigate = useNavigate();
  const Icon = typeIcons[notification.type] || Bell;
  const colors = typeColors[notification.type] || typeColors.general;

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
    if (notification.metadata?.link) {
      navigate(notification.metadata.link);
    }
  };

  return (
    <div
      className={cn(
        "flex gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 group",
        !notification.read 
          ? "bg-primary/5 hover:bg-primary/10" 
          : "hover:bg-muted/50"
      )}
      onClick={handleClick}
    >
      {/* Avatar with icon overlay */}
      <div className="relative shrink-0">
        <Avatar className="h-16 w-16">
          <AvatarImage src={notification.metadata?.avatar} />
          <AvatarFallback className="bg-muted text-xl font-medium">
            {notification.title.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className={cn(
          "absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center ring-2 ring-background",
          colors.bg
        )}>
          <Icon className={cn("w-4 h-4", colors.icon)} />
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-[15px] leading-relaxed",
          !notification.read && "font-medium"
        )}>
          <span className="font-semibold text-foreground">{notification.title}</span>
          {" "}
          <span className="text-muted-foreground">{notification.message}</span>
        </p>
        
        <div className="flex items-center gap-3 mt-2">
          <p className={cn(
            "text-[15px]",
            !notification.read ? "text-primary font-medium" : "text-muted-foreground"
          )}>
            {formatDistanceToNow(new Date(notification.created_at), { 
              addSuffix: true, 
              locale: ru 
            })}
          </p>
          <Badge variant="outline" className="text-[13px]">
            {typeLabels[notification.type] || notification.type}
          </Badge>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-start gap-2 shrink-0">
        {!notification.read && (
          <div className="w-3 h-3 rounded-full bg-primary mt-2" />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!notification.read && (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                onMarkRead(notification.id);
              }}>
                <Check className="w-4 h-4 mr-2" />
                Отметить как прочитанное
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(notification.id);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// Group notifications by time period
function groupNotificationsByTime(notifications: Notification[]) {
  const groups: { title: string; notifications: Notification[] }[] = [];
  
  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const thisWeek: Notification[] = [];
  const thisMonth: Notification[] = [];
  const earlier: Notification[] = [];

  notifications.forEach(n => {
    const date = new Date(n.created_at);
    if (isToday(date)) {
      today.push(n);
    } else if (isYesterday(date)) {
      yesterday.push(n);
    } else if (isThisWeek(date)) {
      thisWeek.push(n);
    } else if (isThisMonth(date)) {
      thisMonth.push(n);
    } else {
      earlier.push(n);
    }
  });

  if (today.length > 0) groups.push({ title: "Сегодня", notifications: today });
  if (yesterday.length > 0) groups.push({ title: "Вчера", notifications: yesterday });
  if (thisWeek.length > 0) groups.push({ title: "На этой неделе", notifications: thisWeek });
  if (thisMonth.length > 0) groups.push({ title: "В этом месяце", notifications: thisMonth });
  if (earlier.length > 0) groups.push({ title: "Ранее", notifications: earlier });

  return groups;
}

interface NotificationsPageContentProps {
  title?: string;
  subtitle?: string;
}

export function NotificationsPageContent({ 
  title = "Уведомления", 
  subtitle = "Управление уведомлениями" 
}: NotificationsPageContentProps) {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh } = useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { toast } = useToast();

  const filteredNotifications = filter === "unread" 
    ? notifications.filter(n => !n.read)
    : notifications;

  const groupedNotifications = groupNotificationsByTime(filteredNotifications);

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить уведомление",
        variant: "destructive"
      });
    } else {
      refresh();
      toast({
        title: "Удалено",
        description: "Уведомление удалено"
      });
    }
  };

  const appointmentNotifications = notifications.filter(n => n.type.startsWith("appointment_"));
  const financeNotifications = notifications.filter(n => ["invoice_ready", "payment_received"].includes(n.type));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            {title}
          </h1>
          <p className="text-[15px] text-muted-foreground mt-1">{subtitle}</p>
        </div>
        
        {unreadCount > 0 && (
          <Button 
            variant="outline" 
            onClick={markAllAsRead}
            className="gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            Прочитать все ({unreadCount})
          </Button>
        )}
      </div>

      {/* Stats Cards - Facebook style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer border-border/50 bg-card/50 backdrop-blur-sm" onClick={() => setFilter("all")}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Bell className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-heading text-foreground">{notifications.length}</p>
              <p className="text-[15px] text-muted-foreground">Всего</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer border-border/50 bg-card/50 backdrop-blur-sm" onClick={() => setFilter("unread")}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold font-heading text-foreground">{unreadCount}</p>
              <p className="text-[15px] text-muted-foreground">Непрочитано</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 hover:shadow-md transition-shadow border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold font-heading text-foreground">{appointmentNotifications.length}</p>
              <p className="text-[15px] text-muted-foreground">Записи</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 hover:shadow-md transition-shadow border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold font-heading text-foreground">{financeNotifications.length}</p>
              <p className="text-[15px] text-muted-foreground">Финансы</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        <Button 
          variant={filter === "all" ? "default" : "outline"}
          size="sm" 
          className="rounded-full text-[15px]"
          onClick={() => setFilter("all")}
        >
          Все уведомления
        </Button>
        <Button 
          variant={filter === "unread" ? "default" : "outline"}
          size="sm" 
          className="rounded-full text-[15px]"
          onClick={() => setFilter("unread")}
        >
          Непрочитанные
          {unreadCount > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5 text-[13px]">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Notifications List */}
      <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
        {loading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="divide-y divide-border">
            {groupedNotifications.map((group) => (
              <div key={group.title}>
                <div className="px-4 py-3 bg-muted/30">
                  <span className="text-[15px] font-semibold text-foreground">{group.title}</span>
                </div>
                {group.notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={markAsRead}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
              <Bell className="w-12 h-12 text-muted-foreground opacity-50" />
            </div>
            <p className="text-lg font-heading font-medium text-foreground">
              {filter === "unread" ? "Нет непрочитанных уведомлений" : "Нет уведомлений"}
            </p>
            <p className="text-[15px] text-muted-foreground mt-1 text-center">
              {filter === "unread" 
                ? "Все уведомления прочитаны" 
                : "Когда появятся новые события, вы увидите их здесь"}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
