import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { tGlobal } from "@/contexts/LanguageContext";
import { notificationDeepLink } from "./notification-deep-link";

// Tiny formatter for {key} placeholders in i18n strings.
function fmt(key: string, vars: Record<string, string | number> = {}): string {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
    tGlobal(key),
  );
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  link: string | null;
  created_at: string;
}

export type NotificationType =
  | "appointment_new"
  | "appointment_rescheduled"
  | "appointment_cancelled"
  | "appointment_reminder"
  | "appointment_confirmed"
  | "invoice_ready"
  | "payment_received"
  | "lab_order_ready"
  | "low_stock"
  | "medical_access_request"
  | "medical_access_approved"
  | "medical_access_denied"
  | "clinic_invitation"
  | "doctor_request"
  | "message_new"
  | "job_application"
  | "JOB_APPLICATION"
  | "general";

const NOTIFICATIONS_KEY = (userId: string | undefined) => ["notifications", userId];

interface NotificationWire {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read?: boolean;
  is_read?: boolean;
  metadata?: Record<string, unknown> | null;
  link?: string | null;
  created_at: string;
}

// The real `notifications` table uses `is_read` (not `read`) and has no `link`
// column — routing info lives in `metadata.link` (that's how backend-created
// notifications, e.g. lab-order events, carry their destination). Normalise both
// so every consumer can rely on `n.read` / `n.link` regardless of the source.
function normalizeNotification(row: NotificationWire): Notification {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    read: row.read ?? row.is_read ?? false,
    metadata: row.metadata ?? null,
    link: notificationDeepLink(row.type, row.metadata, row.link),
    created_at: row.created_at,
  };
}

async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    // Returning [] here made a backend outage or an expired token look exactly
    // like an empty inbox: the doctor read a cheerful "no notifications" and
    // walked away from pending medical-record access requests, clinic
    // invitations and lab-order alerts. "Nothing to show" and "we could not
    // load it" must never render the same.
    console.error("Error loading notifications:", error);
    throw error;
  }
  return (data || []).map(normalizeNotification);
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // React Query keeps the notification list cached across navigations, so the
  // sidebar badge doesn't flash and we don't re-hit the network on every menu
  // click. Realtime pushes are merged into the cache below.
  const {
    data: notifications = [],
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useQuery<Notification[]>({
    queryKey: NOTIFICATIONS_KEY(user?.id),
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── Realtime subscription ────────────────────────────────────────────────
  // Each consumer of this hook sets up its own subscription. That's fine —
  // the underlying WS client is shared, and the channel name is per-user, so
  // multiple subscribers just listen to the same stream. We update the cache
  // with `setQueryData` so all consumers re-render instantly.
  useEffect(() => {
    if (!user?.id) return;

    // Only TOAST notifications that are genuinely new (created after we
    // subscribed) and not already shown. The realtime shim replays the backlog
    // on (re)connect, so every login used to flood the user with stale toasts —
    // including old test rows and internal cancel reasons. Backlog rows are
    // still merged into the cache (so the bell/list are correct), just silent.
    const subscribedAt = Date.now();
    const toastedIds = new Set<string>();

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = normalizeNotification(payload.new);
          queryClient.setQueryData<Notification[]>(
            NOTIFICATIONS_KEY(user.id),
            (prev = []) =>
              prev.some((n) => n.id === newNotification.id)
                ? prev
                : [newNotification, ...prev]
          );

          const createdMs = newNotification.created_at
            ? new Date(newNotification.created_at).getTime()
            : Date.now();
          if (toastedIds.has(newNotification.id) || createdMs < subscribedAt - 5000) {
            return; // backlog replay or duplicate — update cache only, no toast
          }
          toastedIds.add(newNotification.id);

          toast(newNotification.title, {
            description: newNotification.message,
            action: newNotification.link
              ? {
                  label: tGlobal("apiMessages.open"),
                  onClick: () => {
                    window.location.href = newNotification.link!;
                  },
                }
              : undefined,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = normalizeNotification(payload.new);
          queryClient.setQueryData<Notification[]>(
            NOTIFICATIONS_KEY(user.id),
            (prev = []) => prev.map((n) => (n.id === updated.id ? updated : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const setList = (updater: (prev: Notification[]) => Notification[]) =>
    queryClient.setQueryData<Notification[]>(NOTIFICATIONS_KEY(user?.id), (prev = []) =>
      updater(prev)
    );

  const markAsRead = async (notificationId: string) => {
    // The real column is `is_read` (the `read` alias only exists on the client type).
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
    if (!error) {
      setList((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (!error) {
      setList((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const deleteNotification = async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);
    if (!error) {
      setList((prev) => prev.filter((n) => n.id !== notificationId));
    }
  };

  const clearAll = async () => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id);
    if (!error) {
      setList(() => []);
    }
  };

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY(user?.id) });

  return {
    notifications,
    unreadCount,
    loading,
    // Screens need to tell "empty" from "broken" — and offer a retry.
    isError,
    error,
    retry: refetch,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refresh,
  };
}

// Notification creation service - for use throughout the app
export const NotificationService = {
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    options?: { metadata?: Record<string, unknown>; link?: string }
  ): Promise<boolean> {
    try {
      const metadata = {
        ...(options?.metadata || {}),
        ...(options?.link ? { link: options.link } : {}),
      };
      const { error } = await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          type,
          title,
          message,
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
        });

      if (error) {
        console.error("Failed to create notification:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Failed to create notification:", error);
      return false;
    }
  },

  // Notify doctor about new appointment
  async notifyDoctorNewAppointment(
    doctorUserId: string,
    patientName: string,
    appointmentDate: string,
    service: string,
    appointmentId?: string
  ) {
    return this.create(
      doctorUserId,
      "appointment_new",
      tGlobal("apiMessages.newAppointment"),
      fmt("apiMessages.newAppointmentBody", { patient: patientName, date: appointmentDate, service }),
      {
        metadata: { appointmentId },
        link: appointmentId ? `/crm/appointments?id=${appointmentId}` : "/crm/appointments",
      }
    );
  },

  // Notify doctor about rescheduled appointment
  async notifyDoctorRescheduled(
    doctorUserId: string,
    patientName: string,
    oldDate: string,
    newDate: string,
    appointmentId?: string
  ) {
    return this.create(
      doctorUserId,
      "appointment_rescheduled",
      tGlobal("apiMessages.apptRescheduled"),
      fmt("apiMessages.apptRescheduledBody", { patient: patientName, oldDate, newDate }),
      {
        metadata: { appointmentId },
        link: appointmentId ? `/crm/appointments?id=${appointmentId}` : "/crm/appointments",
      }
    );
  },

  // Notify doctor about cancelled appointment
  async notifyDoctorCancelled(
    doctorUserId: string,
    patientName: string,
    appointmentDate: string
  ) {
    return this.create(
      doctorUserId,
      "appointment_cancelled",
      tGlobal("apiMessages.apptCancelled"),
      fmt("apiMessages.apptCancelledBody", { patient: patientName, date: appointmentDate }),
      { link: "/crm/appointments" }
    );
  },

  // Notify patient - appointment confirmed
  async notifyPatientConfirmed(
    patientId: string,
    doctorName: string,
    appointmentDate: string,
    clinicName: string,
    appointmentId?: string
  ) {
    return this.create(
      patientId,
      "appointment_confirmed",
      tGlobal("apiMessages.apptConfirmed"),
      fmt("apiMessages.apptConfirmedBody", { doctor: doctorName, date: appointmentDate, clinic: clinicName }),
      {
        metadata: { appointmentId },
        link: "/patient/appointments",
      }
    );
  },

  // Notify patient - 24h reminder
  async notifyPatientReminder(
    patientId: string,
    doctorName: string,
    appointmentDate: string,
    clinicAddress: string
  ) {
    return this.create(
      patientId,
      "appointment_reminder",
      tGlobal("apiMessages.apptReminder"),
      fmt("apiMessages.apptReminderBody", { date: appointmentDate, doctor: doctorName, address: clinicAddress }),
      { link: "/patient/appointments" }
    );
  },

  // Notify patient - invoice ready
  async notifyPatientInvoiceReady(
    patientId: string,
    invoiceNumber: string,
    amount: number,
    invoiceId?: string
  ) {
    return this.create(
      patientId,
      "invoice_ready",
      tGlobal("apiMessages.invoiceReady"),
      fmt("apiMessages.invoiceReadyBody", { number: invoiceNumber, amount: amount.toLocaleString() }),
      {
        metadata: { invoiceNumber, amount, invoiceId },
        link: "/patient/billing",
      }
    );
  },

  // Notify patient - payment received
  async notifyPatientPaymentReceived(
    patientId: string,
    amount: number,
    invoiceNumber?: string
  ) {
    return this.create(
      patientId,
      "payment_received",
      tGlobal("apiMessages.paymentReceived"),
      invoiceNumber
        ? fmt("apiMessages.paymentReceivedBodyWith", { amount: amount.toLocaleString(), number: invoiceNumber })
        : fmt("apiMessages.paymentReceivedBody", { amount: amount.toLocaleString() }),
      {
        metadata: { amount, invoiceNumber },
        link: "/patient/billing",
      }
    );
  },

  // Notify about lab order ready
  async notifyLabOrderReady(
    doctorUserId: string,
    orderNumber: string,
    patientName: string,
    orderId?: string
  ) {
    return this.create(
      doctorUserId,
      "lab_order_ready",
      tGlobal("apiMessages.labOrderReady"),
      fmt("apiMessages.labOrderReadyBody", { number: orderNumber, patient: patientName }),
      {
        metadata: { orderNumber, orderId },
        link: orderId ? `/lab?id=${orderId}` : "/lab",
      }
    );
  },

  // Notify about low stock
  async notifyLowStock(
    userId: string,
    itemName: string,
    currentQuantity: number,
    itemId?: string
  ) {
    return this.create(
      userId,
      "low_stock",
      tGlobal("apiMessages.lowStock"),
      fmt("apiMessages.lowStockBody", { item: itemName, qty: currentQuantity }),
      {
        metadata: { itemName, currentQuantity, itemId },
        link: "/sklad",
      }
    );
  },

  // Notify patient about medical access request
  async notifyMedicalAccessRequest(
    patientId: string,
    doctorName: string,
    clinicName: string,
    requestId: string
  ) {
    return this.create(
      patientId,
      "medical_access_request",
      tGlobal("apiMessages.mrAccessRequest"),
      fmt("apiMessages.mrAccessRequestBody", { doctor: doctorName, clinic: clinicName }),
      {
        metadata: { requestId },
        link: `/patient/messages`,
      }
    );
  },

  // Notify doctor about medical access approval
  async notifyMedicalAccessApproved(doctorUserId: string, patientName: string) {
    return this.create(
      doctorUserId,
      "medical_access_approved",
      tGlobal("apiMessages.mrAccessApproved"),
      fmt("apiMessages.mrAccessApprovedBody", { patient: patientName }),
      { link: "/doctor/patients" }
    );
  },

  // Notify doctor about clinic invitation
  async notifyDoctorClinicInvitation(
    doctorUserId: string,
    clinicName: string,
    requestId: string
  ) {
    return this.create(
      doctorUserId,
      "clinic_invitation",
      tGlobal("apiMessages.clinicInvitation"),
      fmt("apiMessages.clinicInvitationBody", { clinic: clinicName }),
      {
        metadata: { requestId },
        link: "/doctor/notifications",
      }
    );
  },

  // Notify clinic about doctor request
  async notifyClinicDoctorRequest(
    clinicAdminUserId: string,
    doctorName: string,
    requestId: string
  ) {
    return this.create(
      clinicAdminUserId,
      "doctor_request",
      tGlobal("apiMessages.doctorRequest"),
      fmt("apiMessages.doctorRequestBody", { doctor: doctorName }),
      {
        metadata: { requestId },
        link: "/crm/doctor-requests",
      }
    );
  },

  // Notify about new message
  async notifyNewMessage(
    userId: string,
    senderName: string,
    messagePreview: string,
    conversationType: "doctor" | "patient" | "clinic"
  ) {
    const linkMap = {
      doctor: "/doctor/messages",
      patient: "/patient/messages",
      clinic: "/crm/messages",
    };
    return this.create(
      userId,
      "message_new",
      tGlobal("apiMessages.newMessage"),
      `${senderName}: ${messagePreview.slice(0, 100)}${messagePreview.length > 100 ? "..." : ""}`,
      { link: linkMap[conversationType] }
    );
  },

  // Send external notification (SMS/Email/Telegram) via edge function
  async sendExternal(
    channel: "sms" | "email" | "telegram",
    recipient: string,
    message: string,
    subject?: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: { channel, recipient, message, subject },
      });
      if (error) {
        console.error("External notification error:", error);
        return false;
      }
      return data?.success || false;
    } catch (error) {
      console.error("External notification failed:", error);
      return false;
    }
  },
};
