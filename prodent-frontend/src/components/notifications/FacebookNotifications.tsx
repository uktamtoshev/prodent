import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, Clock, Calendar, CreditCard, FlaskConical, Package, X, MessageCircle, UserPlus, Star, Heart, MoreHorizontal, Settings, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const typeIcons: Record<string, LucideIcon> = {
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

interface FacebookNotificationsProps {
  notificationsPath?: string;
}

export function FacebookNotifications({ notificationsPath = "/crm/notifications" }: FacebookNotificationsProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Navigate based on notification metadata
    if (notification.metadata?.link) {
      navigate(notification.metadata.link);
      setOpen(false);
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate(notificationsPath);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-full bg-muted/50 hover:bg-muted"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0 shadow-2xl" align="end" sideOffset={8}>
        {/* Facebook-style header */}
        <div className="flex items-center justify-between px-4 py-3">
          <h4 className="text-xl font-bold text-foreground">{t('notifsCenter.title')}</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-sm h-8 text-primary hover:bg-primary/10"
              >
                <CheckCheck className="w-4 h-4 mr-1" />
                {t('notifsCenter.readAll')}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleViewAll}>
                  <Settings className="w-4 h-4 mr-2" />
                  {t('notifsCenter.allNotifsBtn')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex px-4 gap-2 pb-2">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full h-8 px-4 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20"
          >
            {t('notifsCenter.filterAll')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-8 px-4 text-sm font-medium"
          >
            {t('notifsCenter.unreadFilter')}
          </Button>
        </div>

        <ScrollArea className="h-[420px]">
          {notifications.length > 0 ? (
            <div className="py-2">
              {/* Earlier / New sections could be added here */}
              <div className="px-4 py-2">
                <span className="text-sm font-semibold text-foreground">{t('notifsCenter.newSection')}</span>
              </div>
              {notifications.map((notification) => {
                const Icon = typeIcons[notification.type] || Bell;
                const colors = typeColors[notification.type] || typeColors.general;

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50",
                      !notification.read && "bg-primary/5"
                    )}
                  >
                    {/* Avatar with icon overlay - Facebook style */}
                    <div className="relative shrink-0">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={notification.metadata?.avatar} />
                        <AvatarFallback className="bg-muted text-lg">
                          {notification.title.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {/* Icon overlay in bottom-right corner */}
                      <div className={cn(
                        "absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center ring-2 ring-background",
                        colors.bg
                      )}>
                        <Icon className={cn("w-3.5 h-3.5", colors.icon)} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm text-foreground leading-snug",
                        !notification.read && "font-medium"
                      )}>
                        <span className="font-semibold">{notification.title}</span>
                        {" "}
                        <span className="text-muted-foreground">{notification.message}</span>
                      </p>
                      <p className={cn(
                        "text-xs mt-1",
                        !notification.read ? "text-primary font-medium" : "text-muted-foreground"
                      )}>
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: ru
                        })}
                      </p>
                    </div>

                    {/* Unread indicator */}
                    {!notification.read && (
                      <div className="flex items-center shrink-0">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <Bell className="w-10 h-10 opacity-50" />
              </div>
              <p className="text-base font-medium text-foreground">{t('notifsCenter.noNotifs')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('notifsCenter.newEventsHere')}</p>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              className="w-full text-primary hover:bg-primary/10 font-medium"
              onClick={handleViewAll}
            >
              {t('notifsCenter.viewAll')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
