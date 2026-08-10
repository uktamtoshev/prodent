import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface Clinic {
  id: string;
  name: string;
  role: string;
}

interface ClinicContextType {
  currentClinic: Clinic | null;
  clinics: Clinic[];
  setCurrentClinic: (clinic: Clinic | null) => void;
  switchClinic: (clinicId: string) => void;
  loading: boolean;
  isSuperAdmin: boolean;
  refreshClinics: () => Promise<void>;
}

interface ClinicRelation {
  id: string;
  name: string;
}

interface ClinicMembershipRow {
  role: string;
  clinics: ClinicRelation | ClinicRelation[] | null;
}

interface DoctorClinicAffiliationRow {
  clinics: ClinicRelation | ClinicRelation[] | null;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

const STORAGE_KEY = 'prodent_current_clinic';

const firstClinic = (clinic: ClinicRelation | ClinicRelation[] | null): ClinicRelation | null => {
  if (Array.isArray(clinic)) {
    return clinic[0] ?? null;
  }
  return clinic;
};

export const ClinicProvider = ({ children }: { children: ReactNode }) => {
  const [currentClinic, setCurrentClinicState] = useState<Clinic | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const { user } = useAuth();

  const loadUserClinics = useCallback(async () => {
    if (!user) {
      setCurrentClinicState(null);
      setClinics([]);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    try {
      // Check if super_admin
      const { data: superAdminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();

      if (superAdminRole) {
        setIsSuperAdmin(true);
        // Super admin can see all clinics
        const { data: allClinics } = await supabase
          .from('clinics')
          .select('id, name')
          .order('name');

        const clinicsList = allClinics?.map(c => ({
          id: c.id,
          name: c.name,
          role: 'super_admin'
        })) || [];

        setClinics(clinicsList);

        // Restore last selected clinic or use first
        const savedClinicId = localStorage.getItem(STORAGE_KEY);
        const savedClinic = clinicsList.find(c => c.id === savedClinicId);
        
        if (savedClinic) {
          setCurrentClinicState(savedClinic);
        } else if (clinicsList.length > 0) {
          setCurrentClinicState(clinicsList[0]);
          localStorage.setItem(STORAGE_KEY, clinicsList[0].id);
        }
      } else {
        // Regular user - get memberships
        const { data: memberships } = await supabase
          .from('clinic_members')
          .select(`
            clinic_id,
            role,
            clinics (
              id,
              name
            )
          `)
          .eq('user_id', user.id)
          .eq('is_active', true);

        const clinicsList = ((memberships || []) as ClinicMembershipRow[])
          .map(m => {
            const clinic = firstClinic(m.clinics);
            return clinic
              ? {
                  id: clinic.id,
                  name: clinic.name,
                  role: m.role
                }
              : null;
          })
          .filter((clinic): clinic is Clinic => clinic !== null);

        // Also check doctor_clinic_affiliations for independent doctors
        const { data: doctor } = await supabase
          .from('doctors')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (doctor) {
          const { data: affiliations } = await supabase
            .from('doctor_clinic_affiliations')
            .select(`
              clinic_id,
              clinics:clinic_id (
                id,
                name
              )
            `)
            .eq('doctor_id', doctor.id)
            .eq('is_active', true);

          ((affiliations || []) as DoctorClinicAffiliationRow[]).forEach(aff => {
            const clinic = firstClinic(aff.clinics);
            if (clinic && !clinicsList.some(c => c.id === clinic.id)) {
              clinicsList.push({
                id: clinic.id,
                name: clinic.name,
                role: 'doctor'
              });
            }
          });
        }

        setClinics(clinicsList);

        // Restore last selected clinic or use first
        const savedClinicId = localStorage.getItem(STORAGE_KEY);
        const savedClinic = clinicsList.find(c => c.id === savedClinicId);
        
        if (savedClinic) {
          setCurrentClinicState(savedClinic);
        } else if (clinicsList.length > 0) {
          setCurrentClinicState(clinicsList[0]);
          localStorage.setItem(STORAGE_KEY, clinicsList[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading clinics:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserClinics();
  }, [loadUserClinics]);

  const setCurrentClinic = useCallback((clinic: Clinic | null) => {
    setCurrentClinicState(clinic);
    if (clinic) {
      localStorage.setItem(STORAGE_KEY, clinic.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const switchClinic = useCallback((clinicId: string) => {
    const clinic = clinics.find(c => c.id === clinicId);
    if (clinic) {
      setCurrentClinic(clinic);
    }
  }, [clinics, setCurrentClinic]);

  const refreshClinics = useCallback(async () => {
    await loadUserClinics();
  }, [loadUserClinics]);

  return (
    <ClinicContext.Provider value={{ 
      currentClinic, 
      clinics,
      setCurrentClinic, 
      switchClinic,
      loading,
      isSuperAdmin,
      refreshClinics
    }}>
      {children}
    </ClinicContext.Provider>
  );
};

export const useClinic = () => {
  const context = useContext(ClinicContext);
  if (!context) {
    throw new Error('useClinic must be used within ClinicProvider');
  }
  return context;
};
