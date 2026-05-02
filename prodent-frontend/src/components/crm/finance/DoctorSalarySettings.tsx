import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Percent, User, Settings, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function DoctorSalarySettings() {
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [salaryPercent, setSalaryPercent] = useState(30);

  // Get staff doctors
  const { data: staffDoctors, isLoading } = useQuery({
    queryKey: ["staff-doctors-settings", currentClinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select(`
          id,
          salary_percent,
          cooperation_type,
          specialty,
          profiles:user_id(full_name, avatar_url)
        `)
        .eq("clinic_id", currentClinic?.id)
        .eq("cooperation_type", "staff_doctor");
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  const updatePercentMutation = useMutation({
    mutationFn: async ({ doctorId, percent }: { doctorId: string; percent: number }) => {
      const { error } = await supabase
        .from("doctors")
        .update({ salary_percent: percent })
        .eq("id", doctorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-doctors-settings"] });
      queryClient.invalidateQueries({ queryKey: ["staff-doctor-report"] });
      queryClient.invalidateQueries({ queryKey: ["clinic-staff-doctors"] });
      toast.success("Процент обновлён");
      setEditDialogOpen(false);
      setSelectedDoctor(null);
    },
    onError: () => {
      toast.error("Ошибка обновления");
    },
  });

  const openEditDialog = (doctor: any) => {
    setSelectedDoctor(doctor);
    setSalaryPercent(doctor.salary_percent || 30);
    setEditDialogOpen(true);
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full bg-muted" />;
  }

  return (
    <div className="space-y-4">
      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Percent className="w-5 h-5" />
            Настройка процентов штатных врачей
          </CardTitle>
        </CardHeader>
        <CardContent>
          {staffDoctors && staffDoctors.length > 0 ? (
            <div className="space-y-3">
              {staffDoctors.map((doctor) => (
                <div
                  key={doctor.id}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={(doctor.profiles as any)?.avatar_url || ""} />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">
                        {(doctor.profiles as any)?.full_name || "Врач"}
                      </p>
                      <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Badge
                      variant="outline"
                      className="text-lg font-bold bg-primary/10 text-primary border-primary/30 px-4 py-2"
                    >
                      {doctor.salary_percent || 30}%
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(doctor)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Штатных врачей нет</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Настройка процента врача</DialogTitle>
          </DialogHeader>

          {selectedDoctor && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={(selectedDoctor.profiles as any)?.avatar_url || ""} />
                  <AvatarFallback>
                    <User className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">
                    {(selectedDoctor.profiles as any)?.full_name || "Врач"}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedDoctor.specialty}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Процент от услуг</Label>
                  <span className="text-2xl font-bold text-primary">{salaryPercent}%</span>
                </div>
                
                <Slider
                  value={[salaryPercent]}
                  onValueChange={(v) => setSalaryPercent(v[0])}
                  min={10}
                  max={70}
                  step={5}
                  className="w-full"
                />

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>10%</span>
                  <span>30%</span>
                  <span>50%</span>
                  <span>70%</span>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-4">
                  {[20, 30, 40, 50].map((preset) => (
                    <Button
                      key={preset}
                      variant={salaryPercent === preset ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSalaryPercent(preset)}
                    >
                      {preset}%
                    </Button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Пример расчёта:</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Услуга: 500 000 UZS</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-400">
                      Врач: {(500000 * salaryPercent / 100).toLocaleString()} UZS
                    </p>
                    <p className="text-emerald-400">
                      Клиника: {(500000 * (100 - salaryPercent) / 100).toLocaleString()} UZS
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() =>
                updatePercentMutation.mutate({
                  doctorId: selectedDoctor?.id,
                  percent: salaryPercent,
                })
              }
              disabled={updatePercentMutation.isPending}
            >
              {updatePercentMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}