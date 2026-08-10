import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Check, X, Clock, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { setAppointmentStatus } from "@/lib/appointment-api";
import { a11yLabel } from "@/lib/a11y-labels";

interface StatusDropdownProps {
  appointmentId: string;
  currentStatus: string;
  onUpdate: () => void;
}

export const StatusDropdown = ({ appointmentId, currentStatus, onUpdate }: StatusDropdownProps) => {
  const { t } = useLanguage();
  const updateStatus = async (newStatus: string) => {
    try {
      await setAppointmentStatus({ appointmentId, status: newStatus });

      toast.success(t('crmStatusDropdown.statusChanged'));
      onUpdate();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(t('crmStatusDropdown.statusError'));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={a11yLabel("more")}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {currentStatus !== "pending" && (
          <DropdownMenuItem onClick={() => updateStatus("pending")}>
            <Clock className="h-4 w-4 mr-2" />
            {t('crmSalaries.pending')}
          </DropdownMenuItem>
        )}
        {currentStatus !== "confirmed" && (
          <DropdownMenuItem onClick={() => updateStatus("confirmed")}>
            <Check className="h-4 w-4 mr-2" />
            {t('crmStatusDropdown.confirmed')}
          </DropdownMenuItem>
        )}
        {currentStatus !== "completed" && (
          <DropdownMenuItem onClick={() => updateStatus("completed")}>
            <CheckCircle className="h-4 w-4 mr-2" />
            {t('crmStatusDropdown.completed')}
          </DropdownMenuItem>
        )}
        {currentStatus !== "cancelled" && (
          <DropdownMenuItem onClick={() => updateStatus("cancelled")}>
            <X className="h-4 w-4 mr-2" />
            {t('crmStatusDropdown.cancelled')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
