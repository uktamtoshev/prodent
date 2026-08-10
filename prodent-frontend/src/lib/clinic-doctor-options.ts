import {
  ClinicServiceApiError,
  serviceApiRequest,
} from './clinic-service-management-api';

export interface ClinicDoctorOption {
  doctor_id: string;
  doctors: {
    id: string;
    specialty: string | null;
    profiles: {
      full_name: string;
      avatar_url: string | null;
    };
  };
}

function invalid(reason: string): never {
  throw new ClinicServiceApiError(`Invalid service doctor candidate response: ${reason}`, 502);
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') return invalid(`${field} must be a string or null`);
  return value;
}

function normalizeOption(value: unknown): ClinicDoctorOption {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalid('candidate must be an object');
  }
  const row = value as Record<string, unknown>;
  if (typeof row.doctorId !== 'string' || !row.doctorId.trim()) {
    return invalid('doctorId is required');
  }
  if (typeof row.fullName !== 'string') return invalid('fullName must be a string');

  return {
    doctor_id: row.doctorId,
    doctors: {
      id: row.doctorId,
      specialty: nullableString(row.specialty, 'specialty'),
      profiles: {
        full_name: row.fullName,
        avatar_url: nullableString(row.avatarUrl, 'avatarUrl'),
      },
    },
  };
}

/** Returns exactly the doctors accepted by the assignment write endpoint. */
export async function listClinicDoctorOptions(clinicId: string): Promise<ClinicDoctorOption[]> {
  const body = await serviceApiRequest(
    `/api/v1/clinics/${encodeURIComponent(clinicId)}/service-doctor-candidates`,
    'GET',
  );
  if (!Array.isArray(body)) return invalid('expected an array');
  return body.map(normalizeOption);
}
