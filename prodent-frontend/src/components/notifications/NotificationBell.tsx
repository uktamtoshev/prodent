import { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import { localeFor } from '@/lib/localization';

const notificationIcons: Record<string, string> = {
  appointment_new: '📅',
  appointment_rescheduled: '🔄',
  appointment_cancelled: '❌',
  appointment_reminder: '⏰',
  appointment_confirmed: '✅',
  invoice_ready: '📄',
  payment_received: '💰',
  lab_order_ready: '🔬',
  low_stock: '⚠️',
  medical_access_request: '🔐',
  medical_access_approved: '✅',
  medical_access_denied: '🚫',
  clinic_invitation: '🏥',
  doctor_request: '👨‍⚕️',
  message_new: '💬',
  general: '📢',
  // Backend enum type (dental-lab order lifecycle + chat).
  LAB_ORDER: '🔬',
};

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (link: string) => void;
}

function formatRelativeTime(date: Date, language: Language) {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(seconds);
  let value = seconds;
  let unit: Intl.RelativeTimeFormatUnit = "second";

  if (absoluteSeconds >= 31_536_000) {
    value = Math.round(seconds / 31_536_000);
    unit = "year";
  } else if (absoluteSeconds >= 2_592_000) {
    value = Math.round(seconds / 2_592_000);
    unit = "month";
  } else if (absoluteSeconds >= 86_400) {
    value = Math.round(seconds / 86_400);
    unit = "day";
  } else if (absoluteSeconds >= 3_600) {
    value = Math.round(seconds / 3_600);
    unit = "hour";
  } else if (absoluteSeconds >= 60) {
    value = Math.round(seconds / 60);
    unit = "minute";
  }

  return new Intl.RelativeTimeFormat(localeFor(language), {
    numeric: "auto",
  }).format(value, unit);
}

function NotificationItem({ notification, onMarkAsRead, onDelete, onNavigate }: NotificationItemProps) {
  const { language, t } = useLanguage();
  const icon = notificationIcons[notification.type] || '📢';
  const timeAgo = formatRelativeTime(new Date(notification.created_at), language);
  const hasPrimaryAction = !notification.read || Boolean(notification.link);
  const primaryClassName =
    "flex min-h-11 min-w-0 flex-1 items-start gap-3 rounded-md text-left";
  const primaryContent = (
    <>
      <span className="flex-shrink-0 text-xl" aria-hidden="true">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn(
            "truncate text-sm font-medium",
            !notification.read && "text-foreground",
            notification.read && "text-muted-foreground"
          )}>
            {notification.title}
          </p>
          {!notification.read && (
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" aria-hidden="true" />
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {notification.message}
        </p>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-muted-foreground/70">{timeAgo}</span>
          {notification.link && (
            <ExternalLink className="h-4 w-4 text-muted-foreground/70" aria-hidden="true" />
          )}
        </div>
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "group p-3 transition-colors hover:bg-accent/50",
        !notification.read && "bg-primary/5"
      )}
    >
      <div className="flex items-start gap-3">
        {hasPrimaryAction ? (
          <button
            type="button"
            className={cn(
              primaryClassName,
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
            onClick={() => {
              if (!notification.read) {
                onMarkAsRead(notification.id);
              }
              if (notification.link) {
                onNavigate(notification.link);
              }
            }}
          >
            {primaryContent}
          </button>
        ) : (
          <div className={primaryClassName}>{primaryContent}</div>
        )}
        <div className="flex flex-col gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          {!notification.read && (
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              aria-label={t('notifsCenter.markRead')}
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead(notification.id);
              }}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-destructive hover:text-destructive"
            aria-label={t('notifsCenter.delete')}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification.id);
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface NotificationBellProps {
  /**
   * Where the "See all notifications" footer button navigates. Defaults to
   * `/notifications`; pass the cabinet-specific route (e.g. `/crm/notifications`)
   * so the user stays inside their shell.
   */
  seeAllPath?: string;
  /** Extra classes for the bell trigger button (to match a cabinet's topbar). */
  triggerClassName?: string;
}

export function NotificationBell({ seeAllPath = "/notifications", triggerClassName }: NotificationBellProps = {}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();

  const handleNavigate = (link: string) => {
    setOpen(false);
    navigate(link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative h-11 w-11", triggerClassName)}
          aria-label={t('notifsCenter.title')}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold">{t('notifsCenter.title')}</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 text-xs"
              onClick={markAllAsRead}
            >
              <CheckCheck className="mr-1 h-4 w-4" aria-hidden="true" />
              {t('notifsCenter.readAll')}
            </Button>
          )}
        </div>

        <ScrollArea className="h-[min(25rem,calc(100dvh-12rem))]">
          {loading ? (
            <div className="flex items-center justify-center py-8" role="status" aria-label={t('common.loading')}>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">{t('notifsCenter.noNotifsBell')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                  onNavigate={handleNavigate}
                />
              ))}
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
                className="min-h-11 w-full text-xs"
                onClick={() => handleNavigate(seeAllPath)}
              >
                {t('notifsCenter.allNotifsBtn')}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
