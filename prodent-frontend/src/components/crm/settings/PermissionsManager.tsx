import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Shield, Users, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MODULES = [
  { key: "finance", label: "Финансы", icon: "💰" },
  { key: "schedule", label: "Расписание", icon: "📅" },
  { key: "patients", label: "Пациенты", icon: "👥" },
  { key: "medical_records", label: "Медкарты", icon: "📋" },
  { key: "treatment_plans", label: "Планы лечения", icon: "📝" },
  { key: "tasks", label: "Задачи", icon: "✅" },
  { key: "reports", label: "Отчёты", icon: "📊" },
  { key: "inventory", label: "Склад", icon: "📦" },
  { key: "laboratory", label: "Лаборатория", icon: "🔬" },
  { key: "services", label: "Услуги", icon: "🦷" },
  { key: "settings", label: "Настройки", icon: "⚙️" },
  { key: "team", label: "Команда", icon: "👤" },
] as const;

const ROLE_LABELS: Record<string, string> = {
  clinic_admin: "Администратор",
  clinic_manager: "Менеджер",
  doctor: "Врач",
  assistant: "Ассистент",
  accountant: "Бухгалтер",
  patient: "Пациент",
};

interface MemberPermission {
  id: string;
  module: string;
  can_view: boolean;
  can_edit: boolean;
  can_manage: boolean;
  user_id: string;
  clinic_id: string;
}

export function PermissionsManager() {
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  // Fetch clinic members (non-admin, non-patient)
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["clinic-members-perms", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data } = await supabase
        .from("clinic_members")
        .select("user_id, role, profiles:user_id(full_name, avatar_url, phone)")
        .eq("clinic_id", currentClinic.id)
        .neq("role", "patient");
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Fetch permissions for selected member
  const { data: permissions, isLoading: permsLoading } = useQuery({
    queryKey: ["member-permissions", selectedMember, currentClinic?.id],
    queryFn: async () => {
      if (!selectedMember || !currentClinic?.id) return [];
      const { data } = await supabase
        .from("clinic_member_permissions")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .eq("user_id", selectedMember);
      return (data as MemberPermission[]) || [];
    },
    enabled: !!selectedMember && !!currentClinic?.id,
  });

  const updatePermission = useMutation({
    mutationFn: async ({
      userId,
      module,
      field,
      value,
    }: {
      userId: string;
      module: string;
      field: "can_view" | "can_edit" | "can_manage";
      value: boolean;
    }) => {
      if (!currentClinic?.id) throw new Error("No clinic");

      // Upsert permission
      const existing = permissions?.find((p) => p.module === module);
      if (existing) {
        const updates: any = { [field]: value };
        // If disabling view, disable edit and manage too
        if (field === "can_view" && !value) {
          updates.can_edit = false;
          updates.can_manage = false;
        }
        // If enabling edit, enable view too
        if (field === "can_edit" && value) {
          updates.can_view = true;
        }
        // If enabling manage, enable view and edit too
        if (field === "can_manage" && value) {
          updates.can_view = true;
          updates.can_edit = true;
        }
        // If disabling edit, disable manage too
        if (field === "can_edit" && !value) {
          updates.can_manage = false;
        }

        const { error } = await supabase
          .from("clinic_member_permissions")
          .update(updates)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const row: any = {
          clinic_id: currentClinic.id,
          user_id: userId,
          module,
          can_view: false,
          can_edit: false,
          can_manage: false,
          [field]: value,
        };
        if (field === "can_manage" && value) {
          row.can_view = true;
          row.can_edit = true;
        }
        if (field === "can_edit" && value) {
          row.can_view = true;
        }

        const { error } = await supabase
          .from("clinic_member_permissions")
          .insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-permissions", selectedMember] });
      queryClient.invalidateQueries({ queryKey: ["module-permissions"] });
      toast.success("Права обновлены");
    },
    onError: () => toast.error("Ошибка обновления прав"),
  });

  // Initialize permissions for member if they don't have any
  const initPermissions = useMutation({
    mutationFn: async (userId: string) => {
      if (!currentClinic?.id) throw new Error("No clinic");
      const member = members?.find((m: any) => m.user_id === userId);
      if (!member) return;

      const role = (member as any).role;
      const modules = MODULES.map((m) => m.key);

      for (const mod of modules) {
        let v = false, e = false, mg = false;
        switch (role) {
          case "clinic_admin":
            v = true; e = true; mg = true; break;
          case "clinic_manager":
            v = true;
            e = ["schedule", "patients", "tasks", "services", "inventory"].includes(mod);
            mg = ["schedule", "tasks"].includes(mod);
            break;
          case "doctor":
            v = ["schedule", "patients", "medical_records", "treatment_plans", "tasks", "laboratory", "services"].includes(mod);
            e = ["schedule", "medical_records", "treatment_plans", "tasks"].includes(mod);
            break;
          case "assistant":
            v = ["schedule", "patients", "tasks", "inventory", "laboratory"].includes(mod);
            e = ["schedule", "tasks", "inventory"].includes(mod);
            break;
          case "accountant":
            v = ["finance", "reports", "patients"].includes(mod);
            e = mod === "finance";
            mg = mod === "finance";
            break;
        }

        await supabase
          .from("clinic_member_permissions")
          .upsert(
            { clinic_id: currentClinic.id, user_id: userId, module: mod, can_view: v, can_edit: e, can_manage: mg },
            { onConflict: "clinic_id,user_id,module" }
          );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-permissions", selectedMember] });
      toast.success("Права инициализированы по роли");
    },
  });

  const filteredMembers = members?.filter((m: any) => {
    const name = (m.profiles as any)?.full_name || "";
    return name.toLowerCase().includes(search.toLowerCase());
  }) || [];

  const selectedMemberData = members?.find((m: any) => m.user_id === selectedMember);
  const isAdmin = (selectedMemberData as any)?.role === "clinic_admin";

  const getPermForModule = (mod: string) => permissions?.find((p) => p.module === mod);

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Shield className="w-5 h-5 text-primary" />
            Управление правами доступа
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Настройте, какие модули CRM доступны каждому сотруднику. Администраторы клиники всегда имеют полный доступ.
          </p>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск сотрудника..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedMember || ""} onValueChange={(v) => setSelectedMember(v)}>
              <SelectTrigger className="w-full md:w-[280px]">
                <SelectValue placeholder="Выберите сотрудника" />
              </SelectTrigger>
              <SelectContent>
                {filteredMembers.map((m: any) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    <div className="flex items-center gap-2">
                      <span>{(m.profiles as any)?.full_name || "Без имени"}</span>
                      <Badge variant="outline" className="text-xs">
                        {ROLE_LABELS[m.role] || m.role}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {membersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full bg-muted" />
              ))}
            </div>
          ) : selectedMember ? (
            <div className="space-y-4">
              {/* Selected member info */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {((selectedMemberData as any)?.profiles as any)?.full_name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">
                      {((selectedMemberData as any)?.profiles as any)?.full_name || "Без имени"}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {ROLE_LABELS[(selectedMemberData as any)?.role] || ""}
                    </Badge>
                  </div>
                </div>
                {!isAdmin && permissions?.length === 0 && (
                  <button
                    onClick={() => initPermissions.mutate(selectedMember)}
                    className="text-sm text-primary hover:underline"
                  >
                    Инициализировать по роли
                  </button>
                )}
              </div>

              {isAdmin ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="w-10 h-10 mx-auto mb-3 text-primary opacity-50" />
                  <p>Администраторы клиники имеют полный доступ ко всем модулям</p>
                </div>
              ) : permsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-14 w-full bg-muted" />
                  ))}
                </div>
              ) : (
                <div className="border border-border/50 rounded-lg overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_80px_80px_100px] gap-2 p-3 bg-muted/30 text-xs font-medium text-muted-foreground border-b border-border/50">
                    <span>Модуль</span>
                    <span className="text-center">Просмотр</span>
                    <span className="text-center">Редакт.</span>
                    <span className="text-center">Управление</span>
                  </div>

                  {MODULES.map((mod) => {
                    const perm = getPermForModule(mod.key);
                    return (
                      <div
                        key={mod.key}
                        className="grid grid-cols-[1fr_80px_80px_100px] gap-2 p-3 items-center border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{mod.icon}</span>
                          <span className="text-sm font-medium text-foreground">{mod.label}</span>
                        </div>
                        <div className="flex justify-center">
                          <Switch
                            checked={perm?.can_view || false}
                            onCheckedChange={(v) =>
                              updatePermission.mutate({
                                userId: selectedMember,
                                module: mod.key,
                                field: "can_view",
                                value: v,
                              })
                            }
                          />
                        </div>
                        <div className="flex justify-center">
                          <Switch
                            checked={perm?.can_edit || false}
                            onCheckedChange={(v) =>
                              updatePermission.mutate({
                                userId: selectedMember,
                                module: mod.key,
                                field: "can_edit",
                                value: v,
                              })
                            }
                          />
                        </div>
                        <div className="flex justify-center">
                          <Switch
                            checked={perm?.can_manage || false}
                            onCheckedChange={(v) =>
                              updatePermission.mutate({
                                userId: selectedMember,
                                module: mod.key,
                                field: "can_manage",
                                value: v,
                              })
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Выберите сотрудника для настройки прав</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
