import { useState, useEffect } from 'react';
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
  | 'patient';

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

export function useUserRole(): UseUserRoleResult {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [affiliations, setAffiliations] = useState<DoctorAffiliation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserRole();
    } else {
      setRole(null);
      setDoctorId(null);
      setAffiliations([]);
      setLoading(false);
    }
  }, [user]);

  const fetchUserRole = async () => {
    setLoading(true);
    
    // Check user_roles table first (super_admin, doctor, etc.)
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user!.id);

    if (userRoles && userRoles.length > 0) {
      // Normalize: DB stores UPPER_CASE (Java enum), frontend uses lower_case
      const roles = userRoles.map(r => (r.role || '').toLowerCase());
      // Priority: super_admin > admin > moderator > doctor > other roles
      const hasSuperAdmin = roles.includes('super_admin');
      const hasAdmin = roles.includes('admin');
      const hasModerator = roles.includes('moderator');
      const hasDoctor = roles.includes('doctor');
      
      if (hasSuperAdmin) {
        setRole('super_admin');
        await fetchDoctorAffiliations();
        setLoading(false);
        return;
      }
      
      if (hasAdmin) {
        setRole('admin');
        await fetchDoctorAffiliations();
        setLoading(false);
        return;
      }
      
      if (hasModerator) {
        setRole('moderator');
        await fetchDoctorAffiliations();
        setLoading(false);
        return;
      }
      
      if (hasDoctor) {
        setRole('doctor');
        await fetchDoctorAffiliations();
        setLoading(false);
        return;
      }
      
      // Use first available role (normalized to lowercase)
      setRole(roles[0] as AppRole);
      await fetchDoctorAffiliations();
      setLoading(false);
      return;
    }

    // Check clinic membership
    const { data: membership } = await supabase
      .from('clinic_members')
      .select('role')
      .eq('user_id', user!.id)
      .limit(1)
      .single();

    if (membership?.role) {
      setRole(membership.role as AppRole);
    } else {
      // Default to patient if no role found
      setRole('patient');
    }
    
    await fetchDoctorAffiliations();
    setLoading(false);
  };

  const fetchDoctorAffiliations = async () => {
    // Get doctor record for current user if exists
    const { data: doctor } = await supabase
      .from('doctors')
      .select('id')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (doctor) {
      setDoctorId(doctor.id);
      
      // Fetch affiliations from new table
      const { data: affiliationData } = await supabase
        .from('doctor_clinic_affiliations')
        .select('clinic_id, cooperation_type, salary_percent, is_primary')
        .eq('doctor_id', doctor.id)
        .eq('is_active', true);
      
      if (affiliationData && affiliationData.length > 0) {
        setAffiliations(affiliationData.map(a => ({
          clinic_id: a.clinic_id,
          cooperation_type: a.cooperation_type as CooperationType,
          salary_percent: a.salary_percent || 30,
          is_primary: a.is_primary || false,
        })));
      } else {
        // Fallback to legacy doctors table
        const { data: legacyDoctor } = await supabase
          .from('doctors')
          .select('clinic_id, cooperation_type, salary_percent')
          .eq('id', doctor.id)
          .single();
        
        if (legacyDoctor?.clinic_id) {
          setAffiliations([{
            clinic_id: legacyDoctor.clinic_id,
            cooperation_type: legacyDoctor.cooperation_type as CooperationType,
            salary_percent: legacyDoctor.salary_percent || 30,
            is_primary: true,
          }]);
        } else {
          setAffiliations([]);
        }
      }
    } else {
      setDoctorId(null);
      setAffiliations([]);
    }
  };

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

  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin';
  const isModerator = role === 'moderator';
  const isClinicAdmin = role === 'clinic_admin';
  const isClinicManager = role === 'clinic_manager';
  const isDoctor = role === 'doctor';
  const isAssistant = role === 'assistant';
  const isAccountant = role === 'accountant';
  const isPatient = role === 'patient';
  
  // Cooperation type flags (based on primary/current clinic)
  const isStaffDoctor = isDoctor && cooperationType === 'staff_doctor';
  const isChairRental = isDoctor && cooperationType === 'chair_rental';

  // Permission matrix
  const canAccessAdminPanel = isSuperAdmin || isAdmin || isModerator;
  
  // Finance access - clinic admins and accountants see full finance
  // Doctors (staff or rental) can see their own finance only
  const canAccessClinicFinance = isSuperAdmin || isClinicAdmin || isAccountant;
  const canAccessOwnFinance = isDoctor; // Both staff and rental doctors see their own income
  const canAccessFinance = canAccessClinicFinance || canAccessOwnFinance;
  
  // Clinic reports - only admin roles, NOT doctors
  const canAccessClinicReports = isSuperAdmin || isClinicAdmin || isAccountant || isClinicManager;
  
  // Cash register - only admin roles, NOT doctors
  const canAccessCashRegister = isSuperAdmin || isClinicAdmin || isAccountant;
  
  const canAccessInventory = isSuperAdmin || isClinicAdmin || isClinicManager || isAssistant;
  const canAccessMedicalRecords = isSuperAdmin || isClinicAdmin || isDoctor;
  const canAccessSchedule = isSuperAdmin || isClinicAdmin || isClinicManager || isDoctor || isAssistant;
  
  // Patient access
  // Admins see all patients
  // Staff doctors see clinic patients
  // Chair rental doctors see only their own patients
  const canAccessAllPatients = isSuperAdmin || isClinicAdmin || isClinicManager || isAssistant || isStaffDoctor;
  const canAccessOwnPatients = isChairRental;
  const canAccessPatients = canAccessAllPatients || canAccessOwnPatients;
  
  const canAccessAds = isSuperAdmin || isClinicAdmin || isClinicManager;
  const canAccessSettings = isSuperAdmin || isClinicAdmin;
  
  // Reports - full reports only for admin roles
  const canAccessReports = isSuperAdmin || isClinicAdmin || isAccountant || isClinicManager;
  
  // Salary settings - only admin roles
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
