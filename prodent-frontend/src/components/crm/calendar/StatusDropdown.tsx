import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Check, X, Clock, CheckCircle } from "lucide-react";

interface StatusDropdownProps {
  appointmentId: string;
  currentStatus: string;
  onUpdate: () => void;
}

export const StatusDropdown = ({ appointmentId, currentStatus, onUpdate }: StatusDropdownProps) => {
  const updateStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus as any })
        .eq("id", appointmentId);

      if (error) throw error;

      // Create notification
      const { data: appointmentData } = await supabase
        .from("appointments")
        .select("patient_id")
        .eq("id", appointmentId)
        .single();

      if (appointmentData) {
        const statusLabels: Record<string, string> = {
          pending: "Ожидание",
          confirmed: "Подтверждено",
          completed: "Завершено",
          cancelled: "Отменено",
        };

        await supabase.from("notifications").insert({
          user_id: appointmentData.patient_id,
          type: "internal",
          title: "Изменение статуса записи",
          message: `Статус вашей записи изменён на: ${statusLabels[newStatus]}`,
          metadata: { appointment_id: appointmentId },
        });
      }

      toast.success("Статус обновлён");
      onUpdate();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Ошибка обновления статуса");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {currentStatus !== "pending" && (
          <DropdownMenuItem onClick={() => updateStatus("pending")}>
            <Clock className="h-4 w-4 mr-2" />
            Ожидание
          </DropdownMenuItem>
        )}
        {currentStatus !== "confirmed" && (
          <DropdownMenuItem onClick={() => updateStatus("confirmed")}>
            <Check className="h-4 w-4 mr-2" />
            Подтвердить
          </DropdownMenuItem>
        )}
        {currentStatus !== "completed" && (
          <DropdownMenuItem onClick={() => updateStatus("completed")}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Завершить
          </DropdownMenuItem>
        )}
        {currentStatus !== "cancelled" && (
          <DropdownMenuItem onClick={() => updateStatus("cancelled")}>
            <X className="h-4 w-4 mr-2" />
            Отменить
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
