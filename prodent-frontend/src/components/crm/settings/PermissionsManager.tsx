import { useState, useMemo } from "react";
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
import { useLanguage } from "@/contexts/LanguageContext";
import {
  type ClinicMemberPermission,
  listClinicMemberPermissions,
  isPermissionManagedMemberRole,
  setClinicMemberPermission,
} from "@/lib/clinic-member-permissions-api";

const MODULE_KEYS = [
  "finance",
  "schedule",
  "patients",
  "medical_records",
  "treatment_plans",
  "tasks",
  "reports",
  "inventory",
  "laboratory",
  "services",
  "settings",
  "team",
] as const;

const MODULE_ICONS: Record<string, string> = {
  finance: "💰",
  schedule: "📅",
  patients: "👥",
  medical_records: "📋",
  treatment_plans: "📝",
  tasks: "✅",
  reports: "📊",
  inventory: "📦",
  laboratory: "🔬",
  services: "🦷",
  settings: "⚙️",
  team: "👤",
};

interface ClinicMemberRow {
  user_id: string;
  role: string;
  profiles: {
    full_name?: string | null;
    avatar_url?: string | null;
    phone?: string | null;
  } | null;
}

export function PermissionsManager() {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const MODULES = useMemo(() => MODULE_KEYS.map((k) => ({
    key: k,
    label: t(`crmPermissionsManager.module_${k}`),
    icon: MODULE_ICONS[k],
  })), [t]);

  const ROLE_LABELS: Record<string, string> = useMemo(() => ({
    clinic_admin: t('crmPermissionsManager.roleAdmin'),
    clinic_manager: t('crmPermissionsManager.roleManager'),
    doctor: t('crmPermissionsManager.roleDoctor'),
    assistant: t('crmPermissionsManager.roleAssistant'),
    accountant: t('crmPermissionsManager.roleAccountant'),
    patient: t('crmPermissionsManager.rolePatient'),
  }), [t]);

  // Fetch clinic members (non-admin, non-patient)
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["clinic-members-perms", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data } = await supabase
        .from("clinic_members")
        .select("user_id, role, profiles:user_id(full_name, avatar_url, phone)")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .not("role", "in", ["patient", "PATIENT"]);
      const rows = (data || []) as unknown as ClinicMemberRow[];
      return rows.filter((member) =>
        isPermissionManagedMemberRole(member.role),
      );
    },
    enabled: !!currentClinic?.id,
  });

  // Fetch permissions for selected member
  const { data: permissions, isLoading: permsLoading } = useQuery({
    queryKey: ["member-permissions", selectedMember, currentClinic?.id],
    queryFn: async () => {
      if (!selectedMember || !currentClinic?.id) return [];
      return (await listClinicMemberPermissions(
        currentClinic.id,
        selectedMember,
      )) as ClinicMemberPermission[];
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

      const existing = permissions?.find((p) => p.module === module);
      const next = {
        can_view: existing?.can_view ?? false,
        can_edit: existing?.can_edit ?? false,
        can_manage: existing?.can_manage ?? false,
        [field]: value,
      };
      if (field === "can_view" && !value) {
        next.can_edit = false;
        next.can_manage = false;
      }
      if (field === "can_edit" && value) next.can_view = true;
      if (field === "can_manage" && value) {
        next.can_view = true;
        next.can_edit = true;
      }
      if (field === "can_edit" && !value) next.can_manage = false;

      await setClinicMemberPermission({
        clinicId: currentClinic.id,
        userId,
        module,
        canView: next.can_view,
        canEdit: next.can_edit,
        canManage: next.can_manage,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-permissions", selectedMember] });
      queryClient.invalidateQueries({ queryKey: ["module-permissions"] });
      toast.success(t('crmPermissionsManager.permissionsUpdated'));
    },
    onError: () => toast.error(t('crmPermissionsManager.permissionsUpdateError')),
  });

  // Initialize permissions for member if they don't have any
  const initPermissions = useMutation({
    mutationFn: async (userId: string) => {
      if (!currentClinic?.id) throw new Error("No clinic");
      const member = members?.find((candidate) => candidate.user_id === userId);
      if (!member) return;

      const role = member.role.toLowerCase();
      const modules = MODULE_KEYS;

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

        await setClinicMemberPermission({
          clinicId: currentClinic.id,
          userId,
          module: mod,
          canView: v,
          canEdit: e,
          canManage: mg,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-permissions", selectedMember] });
      toast.success(t('crmPermissionsManager.permissionsInitialized'));
    },
  });

  const filteredMembers = members?.filter((member) => {
    const name = member.profiles?.full_name || "";
    return name.toLowerCase().includes(search.toLowerCase());
  }) || [];

  const selectedMemberData = members?.find((member) => member.user_id === selectedMember);
  const isAdmin = selectedMemberData?.role.toLowerCase() === "clinic_admin";

  const getPermForModule = (mod: string) => permissions?.find((p) => p.module === mod);

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Shield className="w-5 h-5 text-primary" />
            {t('crmPermissionsManager.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {t('crmPermissionsManager.description')}
          </p>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('crmPermissionsManager.searchEmployee')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedMember || ""} onValueChange={(v) => setSelectedMember(v)}>
              <SelectTrigger className="w-full md:w-[280px]">
                <SelectValue placeholder={t('crmPermissionsManager.selectEmployee')} />
              </SelectTrigger>
              <SelectContent>
                {filteredMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    <div className="flex items-center gap-2">
                      <span>{member.profiles?.full_name || t('crmPermissionsManager.noName')}</span>
                      <Badge variant="outline" className="text-xs">
                        {ROLE_LABELS[member.role.toLowerCase()] || member.role}
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
                      {selectedMemberData?.profiles?.full_name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">
                      {selectedMemberData?.profiles?.full_name || t('crmPermissionsManager.noName')}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {ROLE_LABELS[selectedMemberData?.role.toLowerCase() || ""] || ""}
                    </Badge>
                  </div>
                </div>
                {!isAdmin && permissions?.length === 0 && (
                  <button
                    onClick={() => initPermissions.mutate(selectedMember)}
                    className="text-sm text-primary hover:underline"
                  >
                    {t('crmPermissionsManager.initializeByRole')}
                  </button>
                )}
              </div>

              {isAdmin ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="w-10 h-10 mx-auto mb-3 text-primary opacity-50" />
                  <p>{t('crmPermissionsManager.adminFullAccess')}</p>
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
                    <span>{t('crmPermissionsManager.module')}</span>
                    <span className="text-center">{t('crmPermissionsManager.view')}</span>
                    <span className="text-center">{t('crmPermissionsManager.edit')}</span>
                    <span className="text-center">{t('crmPermissionsManager.manage')}</span>
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
              <p>{t('crmPermissionsManager.selectEmployeeForPermissions')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
