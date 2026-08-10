/**
 * Doctor Departure Logic:
 * 
 * When a doctor leaves a clinic:
 * - Staff Doctor (штатный): Patient database stays with the clinic
 *   - Patients with assigned_doctor_id = doctor.id should have it set to NULL
 *   - Appointments history remains linked to clinic
 * 
 * - Chair Rental (арендатор): Patient database goes with the doctor
 *   - Personal patients (assigned_doctor_id = doctor.id) are removed from clinic_members
 *   - Patients can be re-added to doctor's new clinic later
 */

import { supabase } from '@/integrations/supabase/client';
import { departDoctor, type DoctorDepartureResponse } from '@/lib/clinic-members-api';

/**
 * Handle patient ownership when a doctor leaves a clinic
 */
export async function handleDoctorDeparture(
  doctorId: string,
  clinicId: string
): Promise<DoctorDepartureResponse> {
  return departDoctor({ doctorId, clinicId });
}

/**
 * Get info about what will happen when doctor leaves
 */
export async function getDoctorDepartureInfo(
  doctorId: string,
  clinicId: string
): Promise<{
  cooperationType: 'staff_doctor' | 'chair_rental';
  patientsCount: number;
  willPatientsStay: boolean;
}> {
  // Get cooperation type
  const { data: affiliation } = await supabase
    .from('doctor_clinic_affiliations')
    .select('cooperation_type')
    .eq('doctor_id', doctorId)
    .eq('clinic_id', clinicId)
    .maybeSingle();

  let cooperationType: 'staff_doctor' | 'chair_rental' = 'staff_doctor';
  
  if (affiliation?.cooperation_type) {
    cooperationType = affiliation.cooperation_type as 'staff_doctor' | 'chair_rental';
  } else {
    const { data: doctor } = await supabase
      .from('doctors')
      .select('cooperation_type')
      .eq('id', doctorId)
      .single();
    
    if (doctor?.cooperation_type) {
      cooperationType = doctor.cooperation_type as 'staff_doctor' | 'chair_rental';
    }
  }

  // Count assigned patients
  const { count } = await supabase
    .from('clinic_members')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('role', 'patient')
    .eq('assigned_doctor_id', doctorId);

  return {
    cooperationType,
    patientsCount: count || 0,
    willPatientsStay: cooperationType === 'staff_doctor',
  };
}
