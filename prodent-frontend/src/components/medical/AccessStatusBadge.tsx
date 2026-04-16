import { Badge } from "@/components/ui/badge";
import { Clock, Lock, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface AccessStatusBadgeProps {
  status: 'active' | 'pending' | 'expired' | 'revoked' | 'none';
  expiresAt?: Date | null;
  size?: 'sm' | 'default';
}

export function AccessStatusBadge({ status, expiresAt, size = 'default' }: AccessStatusBadgeProps) {
  const iconClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const textClass = size === 'sm' ? 'text-xs' : '';

  switch (status) {
    case 'active':
      return (
        <Badge className={`bg-emerald-500/10 text-emerald-600 border-emerald-500/20 ${textClass}`}>
          <CheckCircle className={`${iconClass} mr-1`} />
          Доступ активен
          {expiresAt && (
            <span className="ml-1 opacity-75">
              ({formatDistanceToNow(expiresAt, { locale: ru, addSuffix: true })})
            </span>
          )}
        </Badge>
      );
    
    case 'pending':
      return (
        <Badge className={`bg-amber-500/10 text-amber-600 border-amber-500/20 ${textClass}`}>
          <Clock className={`${iconClass} mr-1`} />
          Ожидает одобрения
        </Badge>
      );
    
    case 'expired':
      return (
        <Badge variant="secondary" className={textClass}>
          <AlertCircle className={`${iconClass} mr-1`} />
          Доступ истёк
        </Badge>
      );
    
    case 'revoked':
      return (
        <Badge variant="destructive" className={textClass}>
          <XCircle className={`${iconClass} mr-1`} />
          Отозван
        </Badge>
      );
    
    case 'none':
    default:
      return (
        <Badge variant="outline" className={`text-muted-foreground ${textClass}`}>
          <Lock className={`${iconClass} mr-1`} />
          Нет доступа
        </Badge>
      );
  }
}
