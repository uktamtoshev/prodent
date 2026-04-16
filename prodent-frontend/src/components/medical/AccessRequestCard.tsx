import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Shield, 
  Clock, 
  Check, 
  X, 
  AlertCircle,
  User,
  Building2,
  Loader2,
  ChevronDown,
  Plus,
  Timer
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { useRespondToAccess, useRevokeAccess, useExtendAccess, getReasonLabel } from "@/hooks/useMedicalAccess";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AccessRequestCardProps {
  request: {
    id: string;
    source: string;
    reason: string;
    valid_from: string;
    valid_to: string;
    status: string;
    created_at: string;
    doctors?: {
      id: string;
      specialty: string;
      profiles: {
        full_name: string;
        avatar_url: string | null;
      };
    } | null;
    clinics?: {
      id: string;
      name: string;
      images: string[] | null;
    } | null;
  };
  showActions?: boolean;
}

const DURATION_OPTIONS = [
  { label: "1 час", hours: 1 },
  { label: "6 часов", hours: 6 },
  { label: "24 часа", hours: 24 },
  { label: "3 дня", hours: 72 },
  { label: "7 дней", hours: 168 },
];

export function AccessRequestCard({ request, showActions = true }: AccessRequestCardProps) {
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [extendDuration, setExtendDuration] = useState(24);
  const respondToAccess = useRespondToAccess();
  const revokeAccess = useRevokeAccess();
  const extendAccess = useExtendAccess();
  
  // Calculate remaining hours
  const requestedDuration = Math.max(1, Math.round(
    (new Date(request.valid_to).getTime() - Date.now()) / (1000 * 60 * 60)
  ));
  
  const [selectedDuration, setSelectedDuration] = useState<number>(
    requestedDuration > 0 ? requestedDuration : 24
  );

  const isActive = request.status === 'active';
  const isPending = request.status === 'pending';
  const isExpired = request.status === 'expired';
  const isRevoked = request.status === 'revoked';
  
  // Check if expiring soon (less than 2 hours remaining)
  const hoursRemaining = (new Date(request.valid_to).getTime() - Date.now()) / (1000 * 60 * 60);
  const isExpiringSoon = isActive && hoursRemaining > 0 && hoursRemaining < 2;

  const requesterName = request.doctors?.profiles?.full_name || request.clinics?.name || 'Неизвестно';
  const requesterAvatar = request.doctors?.profiles?.avatar_url || 
    (request.clinics?.images?.[0] ? request.clinics.images[0] : null);
  const isClinic = !!request.clinics;

  const getStatusBadge = () => {
    if (isActive) {
      const expiresIn = formatDistanceToNow(new Date(request.valid_to), { 
        locale: ru, 
        addSuffix: true 
      });
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
          <Clock className="w-3 h-3 mr-1" />
          Истекает {expiresIn}
        </Badge>
      );
    }
    if (isPending) {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          <AlertCircle className="w-3 h-3 mr-1" />
          Ожидает решения
        </Badge>
      );
    }
    if (isExpired) {
      return (
        <Badge variant="secondary">
          Истёк
        </Badge>
      );
    }
    if (isRevoked) {
      return (
        <Badge variant="destructive">
          Отозван
        </Badge>
      );
    }
    return null;
  };

  const getSelectedLabel = () => {
    const option = DURATION_OPTIONS.find(o => o.hours === selectedDuration);
    return option?.label || `${selectedDuration} ч.`;
  };

  const handleApprove = () => {
    respondToAccess.mutate({ 
      requestId: request.id, 
      approve: true,
      customDurationHours: selectedDuration
    });
    setShowApproveDialog(false);
  };

  const handleReject = () => {
    respondToAccess.mutate({ requestId: request.id, approve: false });
  };

  const handleRevoke = () => {
    revokeAccess.mutate(request.id);
    setShowRevokeDialog(false);
  };

  const handleExtend = () => {
    extendAccess.mutate({ requestId: request.id, additionalHours: extendDuration });
    setShowExtendDialog(false);
  };

  const getExtendLabel = () => {
    const option = DURATION_OPTIONS.find(o => o.hours === extendDuration);
    return option?.label || `${extendDuration} ч.`;
  };

  return (
    <>
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={requesterAvatar || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {isClinic ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold truncate">{requesterName}</h4>
                {request.doctors?.specialty && (
                  <span className="text-sm text-muted-foreground">
                    • {request.doctors.specialty}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {getStatusBadge()}
                <span className="text-xs text-muted-foreground">
                  {getReasonLabel(request.reason)}
                </span>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                Запрос от {format(new Date(request.created_at), "d MMMM, HH:mm", { locale: ru })}
              </p>

              {isActive && (
                <p className="text-xs text-muted-foreground">
                  Доступ до {format(new Date(request.valid_to), "d MMMM, HH:mm", { locale: ru })}
                </p>
              )}
            </div>

            {showActions && (
              <div className="flex items-center gap-2">
                {isPending && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleReject}
                      disabled={respondToAccess.isPending}
                    >
                      {respondToAccess.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowApproveDialog(true)}
                      disabled={respondToAccess.isPending}
                    >
                      {respondToAccess.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Одобрить
                        </>
                      )}
                    </Button>
                  </>
                )}
                {isActive && (
                  <div className="flex items-center gap-2">
                    {/* Show extend button if expiring soon or always allow extension */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowExtendDialog(true)}
                      disabled={extendAccess.isPending}
                      className={isExpiringSoon ? "border-amber-500 text-amber-600 hover:bg-amber-50" : ""}
                    >
                      {extendAccess.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          Продлить
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setShowRevokeDialog(true)}
                    >
                      Отозвать
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Approve Dialog with Duration Selection */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Предоставить доступ?</AlertDialogTitle>
            <AlertDialogDescription>
              {requesterName} получит доступ к вашей медицинской карте на выбранный срок.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Срок доступа</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    {getSelectedLabel()}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px]">
                {DURATION_OPTIONS.map(option => (
                  <DropdownMenuItem 
                    key={option.hours}
                    onClick={() => setSelectedDuration(option.hours)}
                    className={selectedDuration === option.hours ? "bg-accent" : ""}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove}>
              <Check className="h-4 w-4 mr-1" />
              Одобрить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Dialog */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отозвать доступ?</AlertDialogTitle>
            <AlertDialogDescription>
              {requesterName} потеряет доступ к вашей медицинской карте. 
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-destructive text-destructive-foreground">
              Отозвать доступ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Extend Dialog */}
      <AlertDialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary" />
              Продлить доступ
            </AlertDialogTitle>
            <AlertDialogDescription>
              Выберите на сколько продлить доступ для {requesterName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Добавить время</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <Plus className="h-4 w-4 mr-2" />
                    + {getExtendLabel()}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px]">
                {DURATION_OPTIONS.map(option => (
                  <DropdownMenuItem 
                    key={option.hours}
                    onClick={() => setExtendDuration(option.hours)}
                    className={extendDuration === option.hours ? "bg-accent" : ""}
                  >
                    + {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleExtend}>
              <Plus className="h-4 w-4 mr-1" />
              Продлить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
