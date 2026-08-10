export interface DoctorProfileSummary {
  full_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
}

export interface DoctorClinicSummary {
  id?: string;
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DoctorPublicData {
  id: string;
  user_id?: string | null;
  clinic_id?: string | null;
  specialty?: string | null;
  category?: string | null;
  bio?: string | null;
  education?: string | null;
  certifications?: string[] | null;
  experience_years?: number | null;
  working_hours?: Record<string, { start: string; end: string }> | null;
  cooperation_type?: string | null;
  video_url?: string | null;
  cover_url?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | string | null;
  reviews_count?: number | null;
  profile?: DoctorProfileSummary | null;
  clinic?: DoctorClinicSummary | null;
}
