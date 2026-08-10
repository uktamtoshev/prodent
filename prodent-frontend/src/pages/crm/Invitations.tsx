import { useState } from "react";
import { ConfirmDialog } from "@/components/system/ConfirmDialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Ban, Copy, MailPlus, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { ClinicInvitationsManager } from "@/components/doctor/ClinicInvitationsManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  clearPersistentClientRequestId,
  cancelClinicStaffInvitation,
  getPersistentClientRequestId,
  inviteClinicStaff,
  listClinicStaffInvitations,
  resendClinicStaffInvitation,
  type ClinicStaffInvitation,
} from "@/lib/crm-operations-api";

export default function CRMInvitations() {
  const { language, t } = useLanguage();
  const { currentClinic } = useClinic();
  const { user } = useAuth();
  const { doctorId, isDoctor, isClinicAdmin, isClinicManager, isSuperAdmin } = useUserRole();
  const uz = language === "uz";
  const canInvite = isClinicAdmin || isClinicManager || isSuperAdmin;
  const [contact, setContact] = useState("");
  const [role, setRole] = useState("assistant");
  const [oneTimeLink, setOneTimeLink] = useState("");
  const invitations = useQuery({
    queryKey: ["s7-staff-invitations", currentClinic?.id],
    queryFn: () => listClinicStaffInvitations(currentClinic!.id, { status: "PENDING", size: 50 }),
    enabled: canInvite && !!currentClinic?.id,
  });
  const request = (action: string) =>
    getPersistentClientRequestId(user?.id ?? "anonymous", currentClinic!.id, action);
  const clearRequest = (action: string) =>
    clearPersistentClientRequestId(user?.id ?? "anonymous", currentClinic!.id, action);
  const showOneTimeLink = (result: { acceptPath?: unknown; token?: unknown }) => {
    const raw = typeof result.token === "string"
      ? `/staff-invitations/${result.token}`
      : typeof result.acceptPath === "string"
        ? result.acceptPath.replace(/^\/api\/v1\/staff-invitations\/([^/]+)\/accept$/, "/staff-invitations/$1")
        : "";
    if (!raw) return;
    setOneTimeLink(raw.startsWith("http") ? raw : `${window.location.origin}${raw}`);
  };
  const invite = useMutation({
    mutationFn: async () => {
      const normalized = contact.trim().toLowerCase();
      if (!normalized) throw new Error(uz ? "Telefon yoki email kiriting" : "Введите телефон или email");
      const action = `staff-invite:${normalized}:${role}`;
      const clientRequestId = request(action);
      const result = await inviteClinicStaff(currentClinic!.id, {
        clientRequestId,
        contact: normalized,
        role,
        expiresInHours: 72,
      });
      clearRequest(action);
      return result;
    },
    onSuccess: (result) => {
      toast.success(uz ? "Taklif yuborildi" : "Приглашение отправлено");
      setContact("");
      showOneTimeLink(result);
      void invitations.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const resend = useMutation({
    mutationFn: async (row: ClinicStaffInvitation) => {
      const action = `staff-invite-resend:${row.id}:${row.resend_count ?? 0}`;
      const result = await resendClinicStaffInvitation(currentClinic!.id, row.id, {
        clientRequestId: request(action),
        expiresInHours: 72,
      });
      clearRequest(action);
      return result;
    },
    onSuccess: (result) => {
      showOneTimeLink(result);
      toast.success(uz ? "Taklif qayta yuborildi" : "Приглашение отправлено повторно");
      void invitations.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const cancel = useMutation({
    mutationFn: async (row: ClinicStaffInvitation) => {
      const action = `staff-invite-cancel:${row.id}:${row.version ?? 0}`;
      const result = await cancelClinicStaffInvitation(currentClinic!.id, row.id, {
        clientRequestId: request(action),
      });
      clearRequest(action);
      return result;
    },
    onSuccess: () => {
      toast.success(uz ? "Taklif bekor qilindi" : "Приглашение отменено");
      void invitations.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <CRMLayout>
      <div className="mx-auto max-w-4xl space-y-section p-4 pb-24 md:p-6">
        {/* Заголовок и подпись берутся из словаря, а не из пары ru/uz: с
            тернарём на казахском, киргизском и таджикском показывался русский
            текст. Значения в словаре уже есть и совпадают с макетом. */}
        <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{t("crmInvitations.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("crmInvitations.subtitle")}</p>
        {canInvite && currentClinic ? (
          <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base font-bold"><MailPlus className="h-5 w-5" />{uz ? "Xodimni taklif qilish" : "Пригласить сотрудника"}</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
              <div className="space-y-2"><Label>{uz ? "Email yoki telefon" : "Email или телефон"}</Label><Input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="name@example.com" /></div>
              <div className="space-y-2"><Label>{uz ? "Rol" : "Роль"}</Label><Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="clinic_manager">{uz ? "Menejer" : "Менеджер"}</SelectItem><SelectItem value="doctor">{uz ? "Shifokor" : "Врач"}</SelectItem><SelectItem value="assistant">{uz ? "Assistent" : "Ассистент"}</SelectItem><SelectItem value="accountant">{uz ? "Buxgalter" : "Бухгалтер"}</SelectItem></SelectContent></Select></div>
              <Button disabled={invite.isPending} onClick={() => invite.mutate()}>{uz ? "Yuborish" : "Отправить"}</Button>
            </CardContent>
          </Card>
          {oneTimeLink && (
            <Card className="border-status-success/30 bg-status-success/5">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{uz ? "Bir martalik havola" : "Одноразовая ссылка"}</p>
                  <p className="truncate text-xs text-muted-foreground">{oneTimeLink}</p>
                </div>
                <Button variant="outline" onClick={() => {
                  void navigator.clipboard.writeText(oneTimeLink);
                  toast.success(uz ? "Nusxalandi" : "Ссылка скопирована");
                }}><Copy className="mr-2 h-4 w-4" />{uz ? "Nusxalash" : "Копировать"}</Button>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>{uz ? "Kutilayotgan takliflar" : "Ожидающие приглашения"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {invitations.isLoading ? (
                <div className="h-24 animate-pulse rounded-xl bg-muted" />
              ) : invitations.isError ? (
                <div className="py-8 text-center"><p className="text-sm text-destructive">{uz ? "Takliflar yuklanmadi" : "Приглашения не загрузились"}</p><Button className="mt-3" variant="outline" onClick={() => void invitations.refetch()}>{uz ? "Qayta urinish" : "Повторить"}</Button></div>
              ) : invitations.data?.length ? invitations.data.map((row) => (
                <div key={row.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.contact}</p>
                    <p className="text-xs text-muted-foreground">{row.role} · {uz ? "gacha" : "до"} {new Date(row.expires_at).toLocaleString(uz ? "uz-UZ" : "ru-RU")}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Button variant="outline" size="sm" disabled={resend.isPending || cancel.isPending} onClick={() => resend.mutate(row)}><RefreshCw className="mr-2 h-4 w-4" />{uz ? "Qayta" : "Повторить"}</Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="destructive" size="sm" disabled={resend.isPending || cancel.isPending}>
                          <Ban className="mr-2 h-4 w-4" />{uz ? "Bekor qilish" : "Отменить"}
                        </Button>
                      }
                      title={uz ? "Taklifni bekor qilish" : "Отменить приглашение"}
                      description={uz ? "Taklif bekor qilinsinmi? Amalni qaytarib boʻlmaydi." : "Отменить приглашение? Действие необратимо."}
                      destructive
                      onConfirm={() => cancel.mutate(row)}
                    />
                  </div>
                </div>
              )) : <p className="py-8 text-center text-sm text-muted-foreground">{uz ? "Kutilayotgan takliflar yo‘q" : "Ожидающих приглашений нет"}</p>}
            </CardContent>
          </Card>
          </>
        ) : isDoctor && doctorId ? (
          <ClinicInvitationsManager doctorId={doctorId} />
        ) : (
          <Card className="border-dashed"><CardContent className="py-14 text-center text-muted-foreground"><ShieldAlert className="mx-auto mb-3 h-10 w-10" />{uz ? "Takliflar uchun huquq yo‘q" : "Нет права управлять приглашениями"}</CardContent></Card>
        )}
      </div>
    </CRMLayout>
  );
}
