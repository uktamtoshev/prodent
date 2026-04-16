import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
  const { currentClinic } = useClinic();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Get clinic members for assignment
  const { data: members } = useQuery({
    queryKey: ["clinic-members-for-tasks", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data } = await supabase
        .from("clinic_members")
        .select("user_id, role, profiles:user_id(full_name)")
        .eq("clinic_id", currentClinic.id)
        .neq("role", "patient");
      return data || [];
    },
    enabled: open && !!currentClinic?.id,
  });

  const createTask = useMutation({
    mutationFn: async () => {
      if (!currentClinic?.id || !user?.id) throw new Error("No clinic");
      const { error } = await supabase.from("clinic_tasks").insert({
        clinic_id: currentClinic.id,
        created_by: user.id,
        assigned_to: assignedTo || user.id,
        title,
        description: description || null,
        priority: priority as any,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] });
      toast({ title: "Задача создана" });
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Ошибка при создании задачи", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setAssignedTo("");
    setDueDate("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новая задача</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) createTask.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label>Название *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Что нужно сделать?" />
          </div>
          <div>
            <Label>Описание</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Подробности..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Приоритет</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Низкий</SelectItem>
                  <SelectItem value="medium">Средний</SelectItem>
                  <SelectItem value="high">Высокий</SelectItem>
                  <SelectItem value="urgent">Срочный</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Дедлайн</Label>
              <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Исполнитель</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Назначить себе" /></SelectTrigger>
              <SelectContent>
                {members?.map((m: any) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {(m.profiles as any)?.full_name || "Без имени"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button type="submit" disabled={!title.trim() || createTask.isPending}>
              {createTask.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Создать
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
