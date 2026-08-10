import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tGlobal } from '@/contexts/LanguageContext';

/**
 * REST hooks for the ad-flow backend (POST /api/v1/ads/...).
 *
 * The Java backend serializes timestamps as `starts_at`/`ends_at` and statuses
 * in UPPERCASE (Java enum). This module normalizes responses into the existing
 * camelCase-light frontend shape so older components keep working:
 *   - starts_at  -> start_date
 *   - ends_at    -> end_date
 *   - STATUS     -> status (lowercased)
 *
 * Embedded resources (campaign.package / campaign.doctor / campaign.clinic)
 * are NOT returned by the backend. Callers that need joined data should fetch
 * via separate hooks. Where consumers do `campaign.package?.package_type`, the
 * value is left undefined and components should fall back to plain IDs.
 */

const API_BASE = '/api/v1/ads';
const TOKEN_KEY = 'prodent_access_token';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function apiErrorMessage(value: unknown, fallback: string): string {
  if (!isRecord(value)) return fallback;
  return typeof value.message === 'string'
    ? value.message
    : typeof value.error === 'string'
      ? value.error
      : fallback;
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : '';
}

const fmt = (key: string, vars: Record<string, string | number> = {}) =>
  Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    tGlobal(key),
  );

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function adFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body: unknown = await res.json();
      msg = apiErrorMessage(body, msg);
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as unknown as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
}

// ─── Types exposed to consumers ─────────────────────────────────────────────

export interface AdPackage {
  id: string;
  name: string;
  name_uz?: string;
  name_en?: string;
  description?: string;
  duration_days: number;
  price: number;
  currency: string;
  package_type: 'top_day' | 'top_week' | 'top_month' | 'banner';
  target_type: 'doctor' | 'clinic';
  is_active: boolean;
  max_slots: number;
}

export interface AdCampaign {
  id: string;
  package_id: string;
  owner_id?: string;
  doctor_id?: string;
  clinic_id?: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'active' | 'paused' | 'completed' | 'cancelled' | 'draft';
  priority: number;
  amount_paid: number;
  currency: string;
  title?: string;
  description?: string;
  image_url?: string;
  target_url?: string;
  payment_date?: string;
  payment_method?: string;
  payment_notes?: string;
  created_by?: string;
  created_at: string;
  // Joined data — NOT populated by the new REST API. Kept optional so
  // existing consumers compile; they should defensively fall back to IDs.
  package?: AdPackage;
  doctor?: {
    id: string;
    user_id: string;
    specialty: string;
    rating?: number;
    experience_years?: number;
    price_from?: number;
    profiles?: { full_name: string; avatar_url?: string };
  };
  clinic?: { id: string; name: string; city?: string; address?: string };
}

export interface AdAnalytics {
  id: string;
  campaign_id: string;
  event_type:
    | 'impression'
    | 'profile_view'
    | 'banner_click'
    | 'appointment_started'
    | 'appointment_completed';
  user_id?: string;
  session_id?: string;
  page_url?: string;
  created_at: string;
}

export interface AdAnalyticsRow {
  id: string;
  campaign_id: string;
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number | string;
}

export interface CampaignStatsSummary {
  impressions: number;
  profile_views: number;
  banner_clicks: number;
  appointments_started: number;
  appointments_completed: number;
}

interface AdCampaignWire extends UnknownRecord {
  id: string;
  package_id?: string;
  packageId?: string;
  owner_id?: string;
  ownerId?: string;
  doctor_id?: string;
  doctorId?: string;
  clinic_id?: string;
  clinicId?: string;
  starts_at?: string;
  startsAt?: string;
  start_date?: string;
  ends_at?: string;
  endsAt?: string;
  end_date?: string;
  status?: string;
  priority?: number;
  amount_paid?: number | string;
  currency?: string;
  created_at?: string;
  createdAt?: string;
  image_url?: string;
  imageUrl?: string;
  target_url?: string;
  targetUrl?: string;
  payment_method?: string;
  paymentMethod?: string;
  payment_date?: string;
  paymentDate?: string;
  payment_notes?: string;
  paymentNotes?: string;
  created_by?: string;
  createdBy?: string;
}

interface AdPackageWire extends UnknownRecord {
  id: string;
  name: string;
  name_uz?: string;
  nameUz?: string;
  name_en?: string;
  nameEn?: string;
  description?: string;
  duration_days?: number;
  durationDays?: number;
  price: number | string;
  currency?: string;
  package_type?: AdPackage['package_type'];
  packageType?: AdPackage['package_type'];
  target_type?: AdPackage['target_type'];
  targetType?: AdPackage['target_type'];
  is_active?: boolean;
  isActive?: boolean;
  max_slots?: number;
  maxSlots?: number;
}

const emptyStats = (): CampaignStatsSummary => ({
  impressions: 0,
  profile_views: 0,
  banner_clicks: 0,
  appointments_started: 0,
  appointments_completed: 0,
});

// ─── Response normalization ─────────────────────────────────────────────────

function normalizeCampaign(raw: AdCampaignWire): AdCampaign {
  const startsAt = raw.starts_at ?? raw.startsAt ?? raw.start_date ?? null;
  const endsAt = raw.ends_at ?? raw.endsAt ?? raw.end_date ?? null;
  const statusRaw = raw.status ?? '';
  return {
    ...raw,
    package_id: raw.package_id ?? raw.packageId ?? '',
    owner_id: raw.owner_id ?? raw.ownerId,
    doctor_id: raw.doctor_id ?? raw.doctorId,
    clinic_id: raw.clinic_id ?? raw.clinicId,
    start_date: startsAt ?? '',
    end_date: endsAt ?? '',
    status: typeof statusRaw === 'string' ? (statusRaw.toLowerCase() as AdCampaign['status']) : statusRaw,
    amount_paid:
      typeof raw.amount_paid === 'string' ? Number(raw.amount_paid) : raw.amount_paid ?? 0,
    currency: raw.currency ?? 'UZS',
    priority: raw.priority ?? 0,
    created_at: raw.created_at ?? raw.createdAt ?? '',
    image_url: raw.image_url ?? raw.imageUrl,
    target_url: raw.target_url ?? raw.targetUrl,
    payment_method: raw.payment_method ?? raw.paymentMethod,
    payment_date: raw.payment_date ?? raw.paymentDate,
    payment_notes: raw.payment_notes ?? raw.paymentNotes,
    created_by: raw.created_by ?? raw.createdBy,
  };
}

function normalizePackage(raw: AdPackageWire): AdPackage {
  return {
    ...raw,
    duration_days: raw.duration_days ?? raw.durationDays ?? 0,
    package_type: raw.package_type ?? raw.packageType ?? 'top_day',
    target_type: raw.target_type ?? raw.targetType ?? 'doctor',
    max_slots: raw.max_slots ?? raw.maxSlots ?? 1,
    is_active: raw.is_active ?? raw.isActive ?? true,
    currency: raw.currency ?? 'UZS',
    price: typeof raw.price === 'string' ? Number(raw.price) : raw.price,
    name_uz: raw.name_uz ?? raw.nameUz,
    name_en: raw.name_en ?? raw.nameEn,
  };
}

function aggregateAnalytics(rows: AdAnalyticsRow[] | undefined | null): CampaignStatsSummary {
  const acc = emptyStats();
  if (!rows) return acc;
  for (const r of rows) {
    acc.impressions += Number(r.impressions ?? 0);
    acc.banner_clicks += Number(r.clicks ?? 0);
    // profile_views / appointments_* aren't tracked by the new backend.
  }
  return acc;
}

// ─── Hooks: packages ────────────────────────────────────────────────────────

export const useAdPackages = (targetType?: 'doctor' | 'clinic') => {
  return useQuery({
    queryKey: ['ad-packages', targetType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('active', 'true');
      if (targetType) params.set('target', targetType);
      const list = await adFetch<AdPackageWire[]>(`/packages?${params.toString()}`);
      return (Array.isArray(list) ? list : []).map(normalizePackage);
    },
  });
};

// ─── Hooks: campaigns ───────────────────────────────────────────────────────

// Admin: list everything. Status filter applied client-side because the
// backend endpoint doesn't take a status query param.
export const useAdCampaigns = (status?: string) => {
  return useQuery({
    queryKey: ['ad-campaigns', status],
    queryFn: async () => {
      const list = await adFetch<AdCampaignWire[]>('/campaigns');
      const normalized = (Array.isArray(list) ? list : []).map(normalizeCampaign);
      if (status) return normalized.filter((c) => c.status === status);
      return normalized;
    },
  });
};

// Authenticated user's own campaigns (clinic/doctor self-serve view).
// Returned shape mirrors useAdCampaigns so existing consumers can re-use
// the same rendering paths.
export const useMyAdCampaigns = (status?: string) => {
  return useQuery({
    queryKey: ['ad-campaigns-mine', status],
    queryFn: async () => {
      const list = await adFetch<AdCampaignWire[]>('/campaigns/mine');
      const normalized = (Array.isArray(list) ? list : []).map(normalizeCampaign);
      if (status) return normalized.filter((c) => c.status === status);
      return normalized;
    },
  });
};

// Boost lookup for a batch of doctors / clinics. Used by listing pages
// to render avatar badges without N+1. Returns a Map<id, BoostInfo>.
export interface BoostInfo {
  campaign_id: string;
  package_type: 'top_day' | 'top_week' | 'top_month' | 'banner';
  ends_at: string;
  priority: number;
}

export const useDoctorBoosts = (doctorIds: string[]) => {
  const ids = [...new Set(doctorIds.filter(Boolean))].sort().join(',');
  return useQuery({
    queryKey: ['doctor-boosts', ids],
    queryFn: async (): Promise<Record<string, BoostInfo>> => {
      if (!ids) return {};
      return adFetch<Record<string, BoostInfo>>(`/boosts/doctors?ids=${encodeURIComponent(ids)}`);
    },
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
};

export const useClinicBoosts = (clinicIds: string[]) => {
  const ids = [...new Set(clinicIds.filter(Boolean))].sort().join(',');
  return useQuery({
    queryKey: ['clinic-boosts', ids],
    queryFn: async (): Promise<Record<string, BoostInfo>> => {
      if (!ids) return {};
      return adFetch<Record<string, BoostInfo>>(`/boosts/clinics?ids=${encodeURIComponent(ids)}`);
    },
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
};

// Public banner rotation. The new endpoint returns ONLY active banner-type
// campaigns; the `targetType` arg becomes informational and we filter by
// doctor_id/clinic_id presence as the legacy hook did.
export const useActiveBannerCampaigns = (targetType: 'doctor' | 'clinic') => {
  return useQuery({
    queryKey: ['active-banner-campaigns', targetType],
    queryFn: async () => {
      const list = await adFetch<AdCampaignWire[]>('/banners');
      const normalized = (Array.isArray(list) ? list : []).map(normalizeCampaign);
      const filtered = normalized.filter((c) =>
        targetType === 'doctor' ? !!c.doctor_id : !!c.clinic_id,
      );
      // Shuffle for random rotation (matches legacy behavior)
      return [...filtered].sort(() => Math.random() - 0.5);
    },
    staleTime: 60_000,
  });
};

// Self-serve / admin create. Body uses snake_case keys matching
// CreateCampaignRequest. Backend derives `end_date` from package duration.
export type CreateCampaignInput = {
  package_id: string;
  owner_id?: string;
  clinic_id?: string;
  doctor_id?: string;
  title?: string;
  description?: string;
  image_url?: string;
  target_url?: string;
  starts_at?: string;
  // Legacy aliases accepted for back-compat with the old hook signature:
  start_date?: string;
  end_date?: string;
  status?: string;
  priority?: number;
  amount_paid?: number;
  currency?: string;
  payment_date?: string;
  payment_method?: string;
  payment_notes?: string;
  target_cities?: string[];
  created_by?: string;
};

export const useCreateCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      // Map legacy keys to the new contract.
      const body: UnknownRecord = {
        package_id: input.package_id,
        owner_id: input.owner_id,
        clinic_id: input.clinic_id,
        doctor_id: input.doctor_id,
        title: input.title,
        description: input.description,
        image_url: input.image_url,
        target_url: input.target_url,
        starts_at: input.starts_at ?? input.start_date,
        target_cities: input.target_cities,
        payment_method: input.payment_method,
        amount_paid: input.amount_paid,
        payment_notes: input.payment_notes,
        // Pass the initial status through: the backend honors it for admins (a self-serve
        // buyer is forced to PENDING server-side regardless). Without this, an admin who
        // picks ACTIVE in the dialog silently gets a PENDING campaign. Enum is UPPERCASE.
        status: input.status ? input.status.toUpperCase() : undefined,
      };
      // Strip undefined to keep the request lean.
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
      const created = await adFetch<AdCampaignWire>('/campaigns', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return normalizeCampaign(created);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['active-banner-campaigns'] });
      toast.success(tGlobal('apiMessages.adCampaignCreated'));
    },
    onError: (error: unknown) => {
      toast.error(fmt('apiMessages.adCampaignCreateError', { msg: errorMessage(error) }));
    },
  });
};

// Admin: change campaign status. Status is forwarded uppercase per backend enum.
export const useUpdateCampaignStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updated = await adFetch<AdCampaignWire>(`/campaigns/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: (status || '').toUpperCase() }),
      });
      return normalizeCampaign(updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['active-banner-campaigns'] });
      toast.success(tGlobal('apiMessages.adStatusUpdated'));
    },
  });
};

// Renew (продлить) — duplicates an expired/completed campaign with fresh
// dates. Admin renewal activates immediately; owner renewal goes to PENDING.
export const useRenewCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const created = await adFetch<AdCampaignWire>(`/campaigns/${id}/renew`, { method: 'POST' });
      return normalizeCampaign(created);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['ad-campaigns-mine'] });
      queryClient.invalidateQueries({ queryKey: ['active-banner-campaigns'] });
      toast.success(tGlobal('apiMessages.adCampaignRenewed'));
    },
    onError: (error: unknown) => {
      toast.error(fmt('apiMessages.adCampaignRenewError', { msg: errorMessage(error) }));
    },
  });
};

// Track event. Translates legacy event_type into impression/click tracking.
// session_id / page_url are dropped — the new endpoint takes only the
// campaign id in the URL path.
export const useTrackAdEvent = () => {
  return useMutation({
    mutationFn: async (event: { campaign_id: string; event_type: AdAnalytics['event_type'] }) => {
      const path =
        event.event_type === 'banner_click'
          ? `/track/click/${event.campaign_id}`
          : // impression / profile_view / appointment_started / appointment_completed
            // all fall back to impression counter — backend doesn't track the rest.
            `/track/impression/${event.campaign_id}`;
      // Fire-and-forget; ignore errors so noise doesn't bubble into UI.
      try {
        await adFetch<void>(path, { method: 'POST' });
      } catch {
        // swallow
      }
    },
  });
};

// Per-campaign analytics summary, aggregated across daily rows.
export const useCampaignAnalytics = (campaignId: string) => {
  return useQuery({
    queryKey: ['campaign-analytics', campaignId],
    queryFn: async () => {
      const rows = await adFetch<AdAnalyticsRow[]>(`/campaigns/${campaignId}/analytics`);
      return aggregateAnalytics(rows);
    },
    enabled: !!campaignId,
  });
};

// Raw per-day analytics rows for a campaign. Used by detail views that need to
// chart the daily breakdown rather than just the aggregate summary.
export const useCampaignAnalyticsRows = (campaignId: string, enabled = true) => {
  return useQuery({
    queryKey: ['campaign-analytics-rows', campaignId],
    queryFn: async () => {
      const rows = await adFetch<AdAnalyticsRow[]>(`/campaigns/${campaignId}/analytics`);
      return Array.isArray(rows) ? rows : [];
    },
    enabled: enabled && !!campaignId,
  });
};

// Summary across every campaign, keyed by campaign id. Used by admin
// dashboards. Calls /campaigns to enumerate, then fetches each analytics
// resource in parallel.
export const useAllCampaignsAnalytics = () => {
  return useQuery({
    queryKey: ['all-campaigns-analytics'],
    queryFn: async () => {
      const list = await adFetch<AdCampaignWire[]>('/campaigns');
      const campaigns = Array.isArray(list) ? list : [];
      const results = await Promise.all(
        campaigns.map(async (c) => {
          try {
            const rows = await adFetch<AdAnalyticsRow[]>(`/campaigns/${c.id}/analytics`);
            return [c.id as string, aggregateAnalytics(rows)] as const;
          } catch {
            return [c.id as string, emptyStats()] as const;
          }
        }),
      );
      const byId: Record<string, CampaignStatsSummary> = {};
      for (const [id, stats] of results) byId[id] = stats;
      return byId;
    },
  });
};
