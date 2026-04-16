import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { NotificationService } from "./useNotifications";

export type AccessSource = 'search' | 'chat' | 'appointment';
export type AccessStatus = 'pending' | 'active' | 'expired' | 'revoked';
export type AccessReason = 'consultation' | 'diagnosis' | 'second_opinion' | 'treatment';
export type AccessDuration = '24h' | '72h' | '7d' | 'custom';

export interface MedicalAccessRequest {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  clinic_id: string | null;
  source: AccessSource;
  reason: string;
  valid_from: string;
  valid_to: string;
  status: AccessStatus;
  granted_by: 'patient' | 'system' | null;
  patient_consent: boolean;
  patient_consent_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RequestAccessParams {
  patientId: string;
  doctorId?: string;
  clinicId?: string;
  source: AccessSource;
  reason: string;
  durationHours: number;
}

interface RespondToAccessParams {
  requestId: string;
  approve: boolean;
  customDurationHours?: number; // Patient can modify duration
}

// Hook to check if doctor/clinic has active access to patient's medical records
export function useMedicalAccess(patientId: string | undefined, doctorId?: string, clinicId?: string) {
  return useQuery({
    queryKey: ['medical-access', patientId, doctorId, clinicId],
    queryFn: async () => {
      if (!patientId) return null;
      
      // Build OR conditions for doctor_id and clinic_id
      const orConditions: string[] = [];
      if (doctorId) {
        orConditions.push(`doctor_id.eq.${doctorId}`);
      }
      if (clinicId) {
        orConditions.push(`clinic_id.eq.${clinicId}`);
      }

      if (orConditions.length === 0) return null;

      const { data, error } = await supabase
        .from('medical_record_access')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .lte('valid_from', new Date().toISOString())
        .gte('valid_to', new Date().toISOString())
        .or(orConditions.join(','));
      
      if (error) {
        console.error('Error checking medical access:', error);
        return null;
      }

      // Return the first matching access record
      const activeAccess = data && data.length > 0 ? data[0] : null;

      return {
        hasAccess: !!activeAccess,
        request: activeAccess as MedicalAccessRequest | null,
        expiresAt: activeAccess?.valid_to ? new Date(activeAccess.valid_to) : null
      };
    },
    enabled: !!patientId && (!!doctorId || !!clinicId),
    refetchInterval: 30000 // Check every 30 seconds
  });
}

// Hook to get pending access requests for a patient
export function usePatientAccessRequests() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['patient-access-requests', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('medical_record_access')
        .select(`
          *,
          doctors:doctor_id (
            id,
            specialty,
            profiles:user_id (
              full_name,
              avatar_url
            )
          ),
          clinics:clinic_id (
            id,
            name,
            images
          )
        `)
        .eq('patient_id', user.id)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching access requests:', error);
        return [];
      }

      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 10000
  });
}

// Hook for doctors to get their access requests
export function useDoctorAccessRequests(doctorId: string | undefined) {
  return useQuery({
    queryKey: ['doctor-access-requests', doctorId],
    queryFn: async () => {
      if (!doctorId) return [];

      const { data, error } = await supabase
        .from('medical_record_access')
        .select(`
          *,
          profiles:patient_id (
            id,
            full_name,
            avatar_url,
            phone
          )
        `)
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching doctor access requests:', error);
        return [];
      }

      return data;
    },
    enabled: !!doctorId
  });
}

// Hook to request medical access
export function useRequestMedicalAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ patientId, doctorId, clinicId, source, reason, durationHours }: RequestAccessParams) => {
      const validFrom = new Date();
      const validTo = new Date(validFrom.getTime() + durationHours * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('medical_record_access')
        .insert({
          patient_id: patientId,
          doctor_id: doctorId || null,
          clinic_id: clinicId || null,
          source,
          reason,
          valid_from: validFrom.toISOString(),
          valid_to: validTo.toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Get doctor and clinic names for notification
      let doctorName = 'Врач';
      let clinicName = 'Клиника';

      if (doctorId) {
        const { data: doctorData } = await supabase
          .from('doctors')
          .select('profiles:user_id (full_name)')
          .eq('id', doctorId)
          .single();
        
        if (doctorData?.profiles) {
          const profile = doctorData.profiles as { full_name: string | null };
          doctorName = profile.full_name || 'Врач';
        }
      }

      if (clinicId) {
        const { data: clinicData } = await supabase
          .from('clinics')
          .select('name')
          .eq('id', clinicId)
          .single();
        
        clinicName = clinicData?.name || 'Клиника';
      }

      // Send in-app notification to patient
      await NotificationService.notifyMedicalAccessRequest(
        patientId,
        doctorName,
        clinicName,
        data.id
      );

      // Get patient phone for SMS notification
      const { data: patientProfile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', patientId)
        .single();

      // Send SMS notification if patient has phone
      if (patientProfile?.phone) {
        const smsMessage = `ProDent: ${doctorName} so'rayapti sizning tibbiy kartangizga kirish / запрашивает доступ к медкарте. Ilova orqali tasdiqlang / Подтвердите в приложении`;
        
        await NotificationService.sendExternal('sms', patientProfile.phone, smsMessage);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical-access'] });
      queryClient.invalidateQueries({ queryKey: ['patient-access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-access-requests'] });
      toast.success('Запрос на доступ отправлен пациенту');
    },
    onError: (error) => {
      console.error('Error requesting access:', error);
      toast.error('Ошибка при отправке запроса');
    }
  });
}

// Hook for patient to respond to access request
export function useRespondToAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, approve, customDurationHours }: RespondToAccessParams) => {
      // If patient wants to change duration, calculate new valid_to
      let updateData: Record<string, any> = {
        status: approve ? 'active' : 'revoked',
        patient_consent: approve,
        patient_consent_at: new Date().toISOString(),
        granted_by: 'patient'
      };

      // If approving with custom duration, update valid_to
      if (approve && customDurationHours) {
        const validTo = new Date(Date.now() + customDurationHours * 60 * 60 * 1000);
        updateData.valid_to = validTo.toISOString();
      }

      const { data, error } = await supabase
        .from('medical_record_access')
        .update(updateData)
        .eq('id', requestId)
        .select('*, doctors:doctor_id (user_id, profiles:user_id (full_name))')
        .single();

      if (error) throw error;

      // Get patient name for notification
      const { data: currentUser } = await supabase.auth.getUser();
      let patientName = 'Пациент';
      
      if (currentUser?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', currentUser.user.id)
          .single();
        
        patientName = profile?.full_name || 'Пациент';
      }

      // Send notification to doctor
      if (data.doctors?.user_id) {
        if (approve) {
          await NotificationService.notifyMedicalAccessApproved(
            data.doctors.user_id,
            patientName
          );
        } else {
          // Notify about rejection
          await NotificationService.create(
            data.doctors.user_id,
            'medical_access_denied',
            'Запрос на доступ отклонён',
            `Пациент ${patientName} отклонил ваш запрос на доступ к медицинской карте`,
            { link: '/doctor/patients' }
          );
        }
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['medical-access'] });
      queryClient.invalidateQueries({ queryKey: ['patient-access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['patient-chat-access-requests'] });
      toast.success(variables.approve ? 'Доступ предоставлен' : 'Запрос отклонён');
    },
    onError: (error) => {
      console.error('Error responding to access:', error);
      toast.error('Ошибка при обработке запроса');
    }
  });
}

// Hook to revoke active access
export function useRevokeAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase
        .from('medical_record_access')
        .update({
          status: 'revoked'
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical-access'] });
      queryClient.invalidateQueries({ queryKey: ['patient-access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-access-requests'] });
      toast.success('Доступ отозван');
    },
    onError: (error) => {
      console.error('Error revoking access:', error);
      toast.error('Ошибка при отзыве доступа');
    }
  });
}

// Hook to extend active access
export function useExtendAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, additionalHours }: { requestId: string; additionalHours: number }) => {
      // First get current valid_to
      const { data: current, error: fetchError } = await supabase
        .from('medical_record_access')
        .select('valid_to')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      // Calculate new valid_to from current end time
      const currentEnd = new Date(current.valid_to);
      const now = new Date();
      const baseTime = currentEnd > now ? currentEnd : now;
      const newValidTo = new Date(baseTime.getTime() + additionalHours * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('medical_record_access')
        .update({
          valid_to: newValidTo.toISOString(),
          status: 'active' // Ensure it's active
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical-access'] });
      queryClient.invalidateQueries({ queryKey: ['patient-access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-access-requests'] });
      toast.success('Срок доступа продлён');
    },
    onError: (error) => {
      console.error('Error extending access:', error);
      toast.error('Ошибка при продлении доступа');
    }
  });
}

// Hook to create auto-access for appointments
export function useCreateAppointmentAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      patientId, 
      doctorId, 
      clinicId,
      appointmentStart, 
      appointmentEnd 
    }: {
      patientId: string;
      doctorId?: string;
      clinicId?: string;
      appointmentStart: Date;
      appointmentEnd: Date;
    }) => {
      // Access starts 30 minutes before appointment
      const validFrom = new Date(appointmentStart.getTime() - 30 * 60 * 1000);
      // Access ends 24 hours after appointment
      const validTo = new Date(appointmentEnd.getTime() + 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('medical_record_access')
        .insert({
          patient_id: patientId,
          doctor_id: doctorId || null,
          clinic_id: clinicId || null,
          source: 'appointment',
          reason: 'Запись на приём',
          valid_from: validFrom.toISOString(),
          valid_to: validTo.toISOString(),
          status: 'active',
          granted_by: 'system',
          patient_consent: true,
          patient_consent_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical-access'] });
    }
  });
}

// Utility function to get duration label
export function getDurationLabel(hours: number): string {
  if (hours === 24) return '24 часа';
  if (hours === 72) return '3 дня';
  if (hours === 168) return '7 дней';
  return `${hours} часов`;
}

// Utility function to get reason label
export function getReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    consultation: 'Консультация',
    diagnosis: 'Диагностика',
    second_opinion: 'Второе мнение',
    treatment: 'Лечение',
    'Консультация': 'Консультация',
    'Запись на приём': 'Запись на приём'
  };
  return labels[reason] || reason;
}
