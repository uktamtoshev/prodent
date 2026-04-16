import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Clock, 
  Calendar, 
  CreditCard, 
  FlaskConical, 
  Package, 
  X, 
  MessageSquare,
  UserPlus,
  Shield,
  Trash2,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

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
  medical_access_request: Shield,
  medical_access_approved: Shield,
  medical_access_denied: Shield,
  clinic_invitation: UserPlus,
  doctor_request: UserPlus,
  message_new: MessageSquare,
  general: Bell,
};

const typeColors: Record<string, string> = {
  appointment_new: "text-emerald-500 bg-emerald-500/10",
  appointment_rescheduled: "text-amber-500 bg-amber-500/10",
  appointment_cancelled: "text-red-500 bg-red-500/10",
  appointment_reminder: "text-blue-500 bg-blue-500/10",
  appointment_confirmed: "text-emerald-500 bg-emerald-500/10",
  invoice_ready: "text-primary bg-primary/10",
  payment_received: "text-emerald-500 bg-emerald-500/10",
  lab_order_ready: "text-purple-500 bg-purple-500/10",
  low_stock: "text-amber-500 bg-amber-500/10",
  medical_access_request: "text-blue-500 bg-blue-500/10",
  medical_access_approved: "text-emerald-500 bg-emerald-500/10",
  medical_access_denied: "text-red-500 bg-red-500/10",
  clinic_invitation: "text-primary bg-primary/10",
  doctor_request: "text-primary bg-primary/10",
  message_new: "text-blue-500 bg-blue-500/10",
  general: "text-muted-foreground bg-muted",
};

export function NotificationsDropdown() {
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    loading,
    markAsRead, 
    markAllAsRead,
    deleteNotification 
  } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      setOpen(false);
      navigate(notification.link);
    }
  };

  const handleDelete = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    deleteNotification(notificationId);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              variant="destructive"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="font-semibold text-foreground">Уведомления</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-7">
              <CheckCheck className="w-4 h-4 mr-1" />
              Прочитать все
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : notifications.length > 0 ? (
            <div className="divide-y divide-border">
              {notifications.map((notification) => {
                const Icon = typeIcons[notification.type] || Bell;
                const colorClass = typeColors[notification.type] || typeColors.general;
                
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50 group",
                      !notification.read && "bg-primary/5"
                    )}
                  >
                    <div className="flex gap-3">
                      <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", colorClass)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "text-sm font-medium text-foreground line-clamp-1",
                            !notification.read && "font-semibold"
                          )}>
                            {notification.title}
                          </p>
                          <div className="flex items-center gap-1">
                            {!notification.read && (
                              <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                              onClick={(e) => handleDelete(e, notification.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { 
                              addSuffix: true, 
                              locale: ru 
                            })}
                          </p>
                          {notification.link && (
                            <ExternalLink className="h-3 w-3 text-muted-foreground/50" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-sm">Нет уведомлений</p>
            </div>
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  setOpen(false);
                  navigate('/crm/notifications');
                }}
              >
                Все уведомления
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}