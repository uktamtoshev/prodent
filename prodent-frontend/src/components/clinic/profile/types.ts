export interface ClinicProfileData {
  id: string;
  name: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  landmark?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  images?: string[] | null;
  logo_url?: string | null;
  cover_url?: string | null;
  subscription_plan?: string | null;
  doctors?: unknown[] | null;
}

export interface ClinicDoctor {
  id: string;
  specialty?: string | null;
  experience_years?: number | null;
  price_from?: number | null;
  rating?: number | null;
  reviews_count?: number | null;
  is_verified?: boolean | null;
  images?: string[] | null;
  category?: string | null;
  user_id?: string | null;
  profiles?: { full_name?: string | null; avatar_url?: string | null } | null;
}
