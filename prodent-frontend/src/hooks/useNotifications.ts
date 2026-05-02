import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, any> | null;
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
  | "general";

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error loading notifications:", error);
        return;
      }

      if (data) {
        setNotifications(data as Notification[]);
        setUnreadCount(data.filter(n => !n.read).length);
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    loadNotifications();

    // Subscribe to realtime notifications
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Show toast for new notification
          toast(newNotification.title, {
            description: newNotification.message,
            action: newNotification.link ? {
              label: "Открыть",
              onClick: () => {
                window.location.href = newNotification.link!;
              }
            } : undefined
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updatedNotification = payload.new as Notification;
          setNotifications(prev =>
            prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
          );
          // Recalculate unread count
          setNotifications(prev => {
            setUnreadCount(prev.filter(n => !n.read).length);
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadNotifications]);

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => {
        const notification = notifications.find(n => n.id === notificationId);
        return notification && !notification.read ? prev - 1 : prev;
      });
    }
  };

  const clearAll = async () => {
    if (!user?.id) return;

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id);

    if (!error) {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refresh: loadNotifications
  };
}

// Notification creation service - for use throughout the app
export const NotificationService = {
  async create(
    userId: string, 
    type: NotificationType, 
    title: string, 
    message: string, 
    options?: { metadata?: Record<string, any>; link?: string }
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          type,
          title,
          message,
          metadata: options?.metadata || null,
          link: options?.link || null
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
      "Новая запись",
      `Пациент ${patientName} записан на ${appointmentDate}. Услуга: ${service}`,
      { 
        metadata: { appointmentId },
        link: appointmentId ? `/crm/appointments?id=${appointmentId}` : "/crm/appointments"
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
      "Запись перенесена",
      `Запись пациента ${patientName} перенесена с ${oldDate} на ${newDate}`,
      {
        metadata: { appointmentId },
        link: appointmentId ? `/crm/appointments?id=${appointmentId}` : "/crm/appointments"
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
      "Запись отменена",
      `Пациент ${patientName} отменил запись на ${appointmentDate}`,
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
      "Запись подтверждена",
      `Ваша запись к врачу ${doctorName} на ${appointmentDate} в клинике ${clinicName} подтверждена`,
      { 
        metadata: { appointmentId },
        link: "/patient/appointments"
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
      "Напоминание о приёме",
      `Напоминаем: завтра ${appointmentDate} у вас приём у врача ${doctorName}. Адрес: ${clinicAddress}`,
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
      "Счёт готов",
      `Счёт ${invoiceNumber} на сумму ${amount.toLocaleString()} UZS готов к оплате`,
      { 
        metadata: { invoiceNumber, amount, invoiceId },
        link: "/patient/payments"
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
      "Оплата получена",
      `Оплата на сумму ${amount.toLocaleString()} UZS успешно проведена${invoiceNumber ? `. Счёт ${invoiceNumber}` : ""}`,
      { 
        metadata: { amount, invoiceNumber },
        link: "/patient/payments"
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
      "Заказ из лаборатории готов",
      `Заказ ${orderNumber} для пациента ${patientName} готов`,
      { 
        metadata: { orderNumber, orderId },
        link: orderId ? `/crm/laboratory?id=${orderId}` : "/crm/laboratory"
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
      "Низкий остаток материала",
      `Материал "${itemName}" заканчивается. Текущий остаток: ${currentQuantity}`,
      { 
        metadata: { itemName, currentQuantity, itemId },
        link: "/crm/inventory"
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
      "Запрос на доступ к медкарте",
      `${doctorName} из клиники ${clinicName} запрашивает доступ к вашей медицинской карте`,
      { 
        metadata: { requestId },
        link: `/patient/messages`
      }
    );
  },

  // Notify doctor about medical access approval
  async notifyMedicalAccessApproved(
    doctorUserId: string,
    patientName: string
  ) {
    return this.create(
      doctorUserId,
      "medical_access_approved",
      "Доступ к медкарте одобрен",
      `Пациент ${patientName} одобрил доступ к своей медицинской карте`,
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
      "Приглашение в клинику",
      `Клиника "${clinicName}" приглашает вас присоединиться`,
      { 
        metadata: { requestId },
        link: "/doctor/notifications"
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
      "Запрос от врача",
      `Врач ${doctorName} хочет присоединиться к вашей клинике`,
      { 
        metadata: { requestId },
        link: "/crm/doctor-requests"
      }
    );
  },

  // Notify about new message
  async notifyNewMessage(
    userId: string,
    senderName: string,
    messagePreview: string,
    conversationType: 'doctor' | 'patient' | 'clinic'
  ) {
    const linkMap = {
      doctor: '/doctor/messages',
      patient: '/patient/messages',
      clinic: '/crm/messages'
    };
    
    return this.create(
      userId,
      "message_new",
      "Новое сообщение",
      `${senderName}: ${messagePreview.slice(0, 100)}${messagePreview.length > 100 ? '...' : ''}`,
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
        body: { channel, recipient, message, subject }
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
  }
};