import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole =
  | 'super_admin'
  | 'admin'
  | 'moderator'
  | 'clinic_admin'
  | 'clinic_manager'
  | 'doctor'
  | 'assistant'
  | 'accountant'
  | 'seller'
  | 'patient'
  | 'technician';

export type CooperationType = 'staff_doctor' | 'chair_rental' | null;

interface DoctorAffiliation {
  clinic_id: string;
  cooperation_type: CooperationType;
  salary_percent: number;
  is_primary: boolean;
}

interface UseUserRoleResult {
  role: AppRole | null;
  loading: boolean;
  doctorId: string | null;
  // Current clinic context (from ClinicContext)
  currentClinicCooperationType: CooperationType;
  currentClinicSalaryPercent: number;
  // All affiliations for multi-clinic doctors
  affiliations: DoctorAffiliation[];
  // Legacy compatibility
  cooperationType: CooperationType;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  isClinicAdmin: boolean;
  isClinicManager: boolean;
  isDoctor: boolean;
  isAssistant: boolean;
  isAccountant: boolean;
  isPatient: boolean;
  isSeller: boolean;
  isTechnician: boolean;
  isStaffDoctor: boolean;
  isChairRental: boolean;
  canAccessAdminPanel: boolean;
  canAccessFinance: boolean;
  canAccessClinicFinance: boolean;
  canAccessOwnFinance: boolean;
  canAccessClinicReports: boolean;
  canAccessCashRegister: boolean;
  canAccessInventory: boolean;
  canAccessMedicalRecords: boolean;
  canAccessSchedule: boolean;
  canAccessPatients: boolean;
  canAccessAllPatients: boolean;
  canAccessOwnPatients: boolean;
  canAccessAds: boolean;
  canAccessSettings: boolean;
  canAccessReports: boolean;
  canAccessSalarySettings: boolean;
  // Helper to get cooperation type for specific clinic
  getCooperationTypeForClinic: (clinicId: string) => CooperationType;
  getSalaryPercentForClinic: (clinicId: string) => number;
}

interface UserRoleData {
  role: AppRole | null;
  doctorId: string | null;
  affiliations: DoctorAffiliation[];
}

// Single async fetcher for the whole role bundle so React Query can cache it.
// Previously this was a useState/useEffect hook that re-fired on every mount —
// CRMLayout is mounted per page, so every menu click re-hit the network.
async function fetchUserRoleData(userId: string): Promise<UserRoleData> {
  // 1) user_roles (super_admin, admin, doctor, …)
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  let role: AppRole | null = null;

  if (userRoles && userRoles.length > 0) {
    // DB may store UPPER_CASE (Java enum); normalize to lowercase.
    // Pick the highest-privilege role: most users also carry PATIENT, so staff
    // roles (clinic_admin, doctor, …) MUST be checked before falling back to
    // roles[0] — otherwise a clinic_admin who is also a patient is treated as a
    // plain patient and never sees the clinic panel.
    const roles = userRoles.map(r => (r.role || '').toLowerCase());
    if (roles.includes('super_admin')) role = 'super_admin';
    else if (roles.includes('admin')) role = 'admin';
    else if (roles.includes('moderator')) role = 'moderator';
    else if (roles.includes('clinic_admin')) role = 'clinic_admin';
    else if (roles.includes('clinic_manager')) role = 'clinic_manager';
    else if (roles.includes('accountant')) role = 'accountant';
    else if (roles.includes('assistant')) role = 'assistant';
    else if (roles.includes('doctor')) role = 'doctor';
    else if (roles.includes('seller')) role = 'seller';
    else if (roles.includes('technician')) role = 'technician';
    else if (roles.includes('patient')) role = 'patient';
    else role = roles[0] as AppRole;
  } else {
    // Fallback: clinic membership.
    const { data: membership } = await supabase
      .from('clinic_members')
      .select('role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .single();
    role = (membership?.role as AppRole) || 'patient';
  }

  // 2) Doctor record + affiliations
  let doctorId: string | null = null;
  let affiliations: DoctorAffiliation[] = [];

  const { data: doctor } = await supabase
    .from('doctors')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (doctor) {
    doctorId = doctor.id;
    const { data: affiliationData } = await supabase
      .from('doctor_clinic_affiliations')
      .select('clinic_id, cooperation_type, salary_percent, is_primary')
      .eq('doctor_id', doctor.id)
      .eq('is_active', true);

    if (affiliationData && affiliationData.length > 0) {
      affiliations = affiliationData.map(a => ({
        clinic_id: a.clinic_id,
        cooperation_type: a.cooperation_type as CooperationType,
        salary_percent: a.salary_percent ?? 30,
        is_primary: a.is_primary ?? false,
      }));
    }
  }

  return { role, doctorId, affiliations };
}

export function useUserRole(): UseUserRoleResult {
  const { user } = useAuth();

  // Cached for the whole session — role doesn't change while logged in.
  // staleTime: Infinity prevents auto-refetch; gcTime keeps cache warm even
  // when the only consumer (sidebar) briefly unmounts during navigation.
  const { data, isLoading } = useQuery<UserRoleData>({
    queryKey: ['user-role', user?.id],
    queryFn: () => fetchUserRoleData(user!.id),
    enabled: !!user?.id,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const role = data?.role ?? null;
  const doctorId = data?.doctorId ?? null;
  const affiliations = data?.affiliations ?? [];
  // While there's no signed-in user, we shouldn't show a permanent loading
  // state — the layout-level guards take care of redirects.
  const loading = !!user && isLoading;

  // Get primary affiliation for legacy compatibility
  const primaryAffiliation = affiliations.find(a => a.is_primary) || affiliations[0];
  const cooperationType = primaryAffiliation?.cooperation_type || null;
  const currentClinicCooperationType = cooperationType;
  const currentClinicSalaryPercent = primaryAffiliation?.salary_percent || 30;

  // Helper functions for multi-clinic support
  const getCooperationTypeForClinic = (clinicId: string): CooperationType => {
    const affiliation = affiliations.find(a => a.clinic_id === clinicId);
    return affiliation?.cooperation_type || null;
  };

  const getSalaryPercentForClinic = (clinicId: string): number => {
    const affiliation = affiliations.find(a => a.clinic_id === clinicId);
    return affiliation?.salary_percent ?? 30;
  };

  const roleNorm = (role || '').toLowerCase();
  const isSuperAdmin = roleNorm === 'super_admin';
  const isAdmin = roleNorm === 'admin';
  const isModerator = roleNorm === 'moderator';
  const isClinicAdmin = roleNorm === 'clinic_admin';
  const isClinicManager = roleNorm === 'clinic_manager';
  const isDoctor = roleNorm === 'doctor';
  const isAssistant = roleNorm === 'assistant';
  const isAccountant = roleNorm === 'accountant';
  const isPatient = roleNorm === 'patient';
  const isSeller = roleNorm === 'seller';
  const isTechnician = roleNorm === 'technician';

  // Cooperation type flags (based on primary/current clinic)
  const isStaffDoctor = isDoctor && cooperationType === 'staff_doctor';
  const isChairRental = isDoctor && cooperationType === 'chair_rental';

  // Permission matrix
  const canAccessAdminPanel = isSuperAdmin || isAdmin || isModerator;

  // Finance access — clinic admins and accountants see full finance;
  // doctors (staff or rental) can see their own finance only.
  const canAccessClinicFinance = isSuperAdmin || isClinicAdmin || isAccountant;
  const canAccessOwnFinance = isDoctor;
  const canAccessFinance = canAccessClinicFinance || canAccessOwnFinance;

  // Clinic reports — only admin roles, NOT doctors.
  const canAccessClinicReports = isSuperAdmin || isClinicAdmin || isAccountant || isClinicManager;

  // Cash register — only admin roles, NOT doctors.
  const canAccessCashRegister = isSuperAdmin || isClinicAdmin || isAccountant;

  const canAccessInventory = isSuperAdmin || isClinicAdmin || isClinicManager || isAssistant;
  const canAccessMedicalRecords = isSuperAdmin || isClinicAdmin || isDoctor;
  const canAccessSchedule = isSuperAdmin || isClinicAdmin || isClinicManager || isDoctor || isAssistant;

  // Patient access:
  //   admins         → all patients
  //   staff doctors  → clinic patients
  //   chair rental   → only their own patients
  const canAccessAllPatients = isSuperAdmin || isClinicAdmin || isClinicManager || isAssistant || isStaffDoctor;
  const canAccessOwnPatients = isChairRental;
  const canAccessPatients = canAccessAllPatients || canAccessOwnPatients;

  const canAccessAds = isSuperAdmin || isClinicAdmin || isClinicManager;
  const canAccessSettings = isSuperAdmin || isClinicAdmin;
  const canAccessReports = isSuperAdmin || isClinicAdmin || isAccountant || isClinicManager;
  const canAccessSalarySettings = isSuperAdmin || isClinicAdmin;

  return {
    role,
    loading,
    doctorId,
    affiliations,
    cooperationType,
    currentClinicCooperationType,
    currentClinicSalaryPercent,
    getCooperationTypeForClinic,
    getSalaryPercentForClinic,
    isSuperAdmin,
    isAdmin,
    isModerator,
    isClinicAdmin,
    isClinicManager,
    isDoctor,
    isAssistant,
    isAccountant,
    isPatient,
    isSeller,
    isTechnician,
    isStaffDoctor,
    isChairRental,
    canAccessAdminPanel,
    canAccessFinance,
    canAccessClinicFinance,
    canAccessOwnFinance,
    canAccessClinicReports,
    canAccessCashRegister,
    canAccessInventory,
    canAccessMedicalRecords,
    canAccessSchedule,
    canAccessPatients,
    canAccessAllPatients,
    canAccessOwnPatients,
    canAccessAds,
    canAccessSettings,
    canAccessReports,
    canAccessSalarySettings,
  };
}
