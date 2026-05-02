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

import { supabase } from '@/integrations/api/client';

export interface DoctorDepartureResult {
  success: boolean;
  patientsAffected: number;
  cooperationType: 'staff_doctor' | 'chair_rental';
  message: string;
}

/**
 * Handle patient ownership when a doctor leaves a clinic
 */
export async function handleDoctorDeparture(
  doctorId: string,
  clinicId: string
): Promise<DoctorDepartureResult> {
  // Get the doctor's cooperation type for this clinic
  const { data: affiliation } = await supabase
    .from('doctor_clinic_affiliations')
    .select('cooperation_type')
    .eq('doctor_id', doctorId)
    .eq('clinic_id', clinicId)
    .maybeSingle();

  // Fallback to doctors table if no affiliation record
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

  // Get count of patients assigned to this doctor in this clinic
  const { data: assignedPatients, error: countError } = await supabase
    .from('clinic_members')
    .select('id, user_id')
    .eq('clinic_id', clinicId)
    .eq('role', 'patient')
    .eq('assigned_doctor_id', doctorId);

  if (countError) {
    throw new Error(`Ошибка получения пациентов: ${countError.message}`);
  }

  const patientsAffected = assignedPatients?.length || 0;

  if (cooperationType === 'staff_doctor') {
    // Staff doctor: patients stay with clinic
    // Clear assigned_doctor_id so patients become clinic patients
    if (patientsAffected > 0) {
      const { error } = await supabase
        .from('clinic_members')
        .update({ assigned_doctor_id: null })
        .eq('clinic_id', clinicId)
        .eq('role', 'patient')
        .eq('assigned_doctor_id', doctorId);

      if (error) {
        throw new Error(`Ошибка переноса пациентов: ${error.message}`);
      }
    }

    return {
      success: true,
      patientsAffected,
      cooperationType,
      message: patientsAffected > 0 
        ? `${patientsAffected} пациентов переданы клинике`
        : 'Нет пациентов для передачи',
    };
  } else {
    // Chair rental: patients go with the doctor
    // Remove patients from clinic_members entirely
    if (patientsAffected > 0) {
      const patientIds = assignedPatients!.map(p => p.user_id);
      
      const { error } = await supabase
        .from('clinic_members')
        .delete()
        .eq('clinic_id', clinicId)
        .eq('role', 'patient')
        .in('user_id', patientIds);

      if (error) {
        throw new Error(`Ошибка удаления пациентов: ${error.message}`);
      }
    }

    return {
      success: true,
      patientsAffected,
      cooperationType,
      message: patientsAffected > 0 
        ? `${patientsAffected} пациентов уходят с врачом`
        : 'Нет личных пациентов',
    };
  }
}

/**
 * Deactivate doctor affiliation (instead of deleting)
 */
export async function deactivateDoctorAffiliation(
  doctorId: string,
  clinicId: string
): Promise<void> {
  const { error } = await supabase
    .from('doctor_clinic_affiliations')
    .update({
      is_active: false,
      end_date: new Date().toISOString().split('T')[0],
    })
    .eq('doctor_id', doctorId)
    .eq('clinic_id', clinicId);

  if (error) {
    // If no affiliation record exists, that's OK
    console.warn('Could not deactivate affiliation:', error.message);
  }
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
