import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { NotificationService } from "./useNotifications";
import { tGlobal } from "@/contexts/LanguageContext";
import {
  medicalAccessApi,
  type MedicalAccessApiRecord,
} from "@/lib/medical-access-api";

const fmt = (key: string, vars: Record<string, string | number> = {}) =>
  Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
    tGlobal(key),
  );

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
  updated_at?: string;
  profiles?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
  } | null;
  doctors?: {
    id: string;
    specialty: string;
    profiles: {
      full_name: string;
      avatar_url: string | null;
    } | null;
  } | null;
  clinics?: {
    id: string;
    name: string;
    images: string[] | null;
  } | null;
}

const toMedicalAccessRequest = (row: MedicalAccessApiRecord): MedicalAccessRequest => ({
  id: row.id,
  patient_id: row.patientId,
  doctor_id: row.doctorId,
  clinic_id: row.clinicId,
  source: row.source,
  reason: row.reason,
  valid_from: row.validFrom,
  valid_to: row.validTo,
  status: row.status,
  granted_by: row.grantedBy,
  patient_consent: row.patientConsent,
  patient_consent_at: row.patientConsentAt,
  created_at: row.createdAt,
});

async function enrichPatientRequests(rows: MedicalAccessRequest[]) {
  const doctorIds = [...new Set(rows.map((row) => row.doctor_id).filter(Boolean))] as string[];
  const clinicIds = [...new Set(rows.map((row) => row.clinic_id).filter(Boolean))] as string[];
  const doctorMap = new Map<string, MedicalAccessRequest["doctors"]>();
  const clinicMap = new Map<string, MedicalAccessRequest["clinics"]>();

  if (doctorIds.length > 0) {
    const { data: doctors } = await supabase
      .from("doctors")
      .select("id, specialty, user_id")
      .in("id", doctorIds);
    const userIds = [...new Set((doctors || []).map((doctor) => doctor.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
    (doctors || []).forEach((doctor) => {
      const profile = profileMap.get(doctor.user_id);
      doctorMap.set(doctor.id, {
        id: doctor.id,
        specialty: doctor.specialty,
        profiles: profile
          ? { full_name: profile.full_name || "", avatar_url: profile.avatar_url }
          : null,
      });
    });
  }

  if (clinicIds.length > 0) {
    const { data: clinics } = await supabase
      .from("clinics")
      .select("id, name, images")
      .in("id", clinicIds);
    (clinics || []).forEach((clinic) => clinicMap.set(clinic.id, clinic));
  }

  return rows.map((row) => ({
    ...row,
    doctors: row.doctor_id ? doctorMap.get(row.doctor_id) || null : null,
    clinics: row.clinic_id ? clinicMap.get(row.clinic_id) || null : null,
  }));
}

async function enrichDoctorRequests(rows: MedicalAccessRequest[]) {
  const patientIds = [...new Set(rows.map((row) => row.patient_id))];
  const { data: profiles } = patientIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, phone")
        .in("id", patientIds)
    : { data: [] };
  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return rows.map((row) => ({ ...row, profiles: profileMap.get(row.patient_id) || null }));
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

// Hook to check the medical-access state for a doctor/clinic ↔ patient pair.
// Returns the most recent request regardless of status so the UI can show
// "pending" / "active" / "revoked" / "expired" / "none" plus the request
// timestamp. `hasAccess` stays a convenient boolean derived from the latest
// row's status and validity window.
export function useMedicalAccess(patientId: string | undefined, doctorId?: string, clinicId?: string) {
  return useQuery({
    queryKey: ['medical-access', patientId, doctorId, clinicId],
    queryFn: async () => {
      if (!patientId) return null;

      const response = await medicalAccessApi.effective(patientId);
      return {
        hasAccess: response.hasAccess,
        status: response.status,
        request: response.request ? toMedicalAccessRequest(response.request) : null,
        requestedAt: response.requestedAt ? new Date(response.requestedAt) : null,
        expiresAt: response.expiresAt ? new Date(response.expiresAt) : null,
      };
    },
    enabled: !!patientId && (!!doctorId || !!clinicId),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

// Hook to get the patient's complete access history
export function usePatientAccessRequests() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['patient-access-requests', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const rows = (await medicalAccessApi.patientRequests()).map(toMedicalAccessRequest);
      return enrichPatientRequests(rows);
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

      const rows = (await medicalAccessApi.doctorRequests()).map(toMedicalAccessRequest);
      return enrichDoctorRequests(rows);
    },
    enabled: !!doctorId
  });
}

// Hook to request medical access
export function useRequestMedicalAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ patientId, doctorId, clinicId, source, reason, durationHours }: RequestAccessParams) => {
      const data = toMedicalAccessRequest(await medicalAccessApi.createRequest({
        patientId,
        source,
        reason,
        durationHours,
      }));

      // Get doctor and clinic names for notification
      let doctorName = tGlobal('apiMessages.defaultDoctor');
      let clinicName = tGlobal('apiMessages.defaultClinic');

      if (doctorId) {
        const { data: doctorData } = await supabase
          .from('doctors')
          .select('profiles:user_id (full_name)')
          .eq('id', doctorId)
          .single();

        if (doctorData?.profiles) {
          const profile = doctorData.profiles as { full_name: string | null };
          doctorName = profile.full_name || tGlobal('apiMessages.defaultDoctor');
        }
      }

      if (clinicId) {
        const { data: clinicData } = await supabase
          .from('clinics')
          .select('name')
          .eq('id', clinicId)
          .single();

        clinicName = clinicData?.name || tGlobal('apiMessages.defaultClinic');
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
        const smsMessage = fmt('apiMessages.smsMrAccessRequest', { doctor: doctorName });

        await NotificationService.sendExternal('sms', patientProfile.phone, smsMessage);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical-access'] });
      queryClient.invalidateQueries({ queryKey: ['patient-access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-access-requests'] });
      toast.success(tGlobal('apiMessages.mrRequestSent'));
    },
    onError: (error) => {
      console.error('Error requesting access:', error);
      toast.error(tGlobal('apiMessages.mrRequestSendError'));
    }
  });
}

// Hook for patient to respond to access request
export function useRespondToAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, approve, customDurationHours }: RespondToAccessParams) => {
      const data = toMedicalAccessRequest(
        await medicalAccessApi.decide(requestId, approve, customDurationHours),
      );

      // Get patient name for notification
      const { data: currentUser } = await supabase.auth.getUser();
      let patientName = tGlobal('apiMessages.defaultPatient');

      if (currentUser?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', currentUser.user.id)
          .single();

        patientName = profile?.full_name || tGlobal('apiMessages.defaultPatient');
      }

      const { data: doctorRow } = data.doctor_id
        ? await supabase.from("doctors").select("user_id").eq("id", data.doctor_id).maybeSingle()
        : { data: null };

      // Send notification to doctor
      if (doctorRow?.user_id) {
        if (approve) {
          await NotificationService.notifyMedicalAccessApproved(
            doctorRow.user_id,
            patientName
          );
        } else {
          // Notify about rejection
          await NotificationService.create(
            doctorRow.user_id,
            'medical_access_denied',
            tGlobal('apiMessages.mrAccessDenied'),
            fmt('apiMessages.mrAccessDeniedBody', { patient: patientName }),
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
      toast.success(variables.approve ? tGlobal('apiMessages.mrAccessGranted') : tGlobal('apiMessages.mrRequestDeclined'));
    },
    onError: (error) => {
      console.error('Error responding to access:', error);
      toast.error(tGlobal('apiMessages.mrProcessError'));
    }
  });
}

// Hook to revoke active access
export function useRevokeAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) =>
      toMedicalAccessRequest(await medicalAccessApi.revoke(requestId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical-access'] });
      queryClient.invalidateQueries({ queryKey: ['patient-access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-access-requests'] });
      toast.success(tGlobal('apiMessages.mrAccessRevoked'));
    },
    onError: (error) => {
      console.error('Error revoking access:', error);
      toast.error(tGlobal('apiMessages.mrRevokeError'));
    }
  });
}

// Hook to extend active access
export function useExtendAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, additionalHours }: { requestId: string; additionalHours: number }) =>
      toMedicalAccessRequest(await medicalAccessApi.extend(requestId, additionalHours)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical-access'] });
      queryClient.invalidateQueries({ queryKey: ['patient-access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-access-requests'] });
      // The backend creates a new pending extension request; access is not extended yet.
      toast.success(tGlobal('apiMessages.mrRequestSent'));
    },
    onError: (error) => {
      console.error('Error extending access:', error);
      toast.error(tGlobal('apiMessages.mrExtendError'));
    }
  });
}

// Utility function to get duration label
export function getDurationLabel(hours: number): string {
  if (hours === 24) return tGlobal('apiMessages.duration24h');
  if (hours === 72) return tGlobal('apiMessages.duration3d');
  if (hours === 168) return tGlobal('apiMessages.duration7d');
  return fmt('apiMessages.durationHoursFmt', { hours });
}

// Utility function to get reason label
export function getReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    consultation: tGlobal('apiMessages.reasonConsultation'),
    diagnosis: tGlobal('apiMessages.reasonDiagnosis'),
    second_opinion: tGlobal('apiMessages.reasonSecondOpinion'),
    treatment: tGlobal('apiMessages.reasonTreatment'),
    // Backwards-compatible: legacy stored Russian-canonical strings
    'Консультация': tGlobal('apiMessages.reasonConsultation'),
    'Запись на приём': tGlobal('apiMessages.reasonAppointmentBooking'),
  };
  return labels[reason] || reason;
}
