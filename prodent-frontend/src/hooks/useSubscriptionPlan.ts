import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tGlobal } from '@/contexts/LanguageContext';

// ─── Payments API client ─────────────────────────────────────────────────────
// Subscription + wallet are server-authoritative (Spring /api/v1/payments/*).
// The generic data proxy cannot write subscription_plan / subscription_expires_at
// (FORBIDDEN_WRITE_COLUMNS), so plan activation runs through POST /subscribe.

const API_BASE = '/api/v1/payments';
const TOKEN_KEY = 'prodent_access_token';

function apiErrorMessage(value: unknown, fallback: string): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fallback;
  const body = value as Record<string, unknown>;
  return typeof body.message === 'string'
    ? body.message
    : typeof body.error === 'string'
      ? body.error
      : fallback;
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function payFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
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
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as unknown as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
}

// ─── Types ─────────────────────────────────────────────────────────────────

// `entity_type` is no longer a column on subscription_plans — plans are generic
// and apply to whichever entity (doctor/clinic) the user owns. EntityType is kept
// for API-compat with existing component props.
export type EntityType = 'doctor' | 'clinic';

export interface PlanFeaturesMap {
  max_appointments?: number;
  max_patients?: number;
  analytics?: boolean;
  priority_support?: boolean;
  api_access?: boolean;
  [k: string]: unknown;
}

export interface SubscriptionPlan {
  slug: string;            // FREE | BASIC | PREMIUM | ENTERPRISE
  name: string;
  name_ru: string;
  name_uz: string;
  name_en: string;
  description: string | null;
  description_ru: string | null;
  price: number;
  currency: string;
  duration_days: number;
  features: PlanFeaturesMap;
  max_appointments_per_month: number | null;
  max_patients: number | null;
}

export interface SubscriptionStatus {
  account_id: string | null;
  entity_type: EntityType | null;
  entity_id: string | null;
  balance: number;
  plan: string | null;
  expires_at: string | null;
  is_expired: boolean;
  usage: number;
  limit: number | null;     // null = unlimited
  can_create: boolean;
}

// Legacy-compatible shapes still consumed by AppointmentLimitBanner / consumers.
export interface AppointmentLimitInfo {
  plan: string;
  count: number;
  limit: number | null;
  can_create: boolean;
  remaining: number | null;
  reset_at: string;
}

export interface PlanFeatures {
  plan: string;
  features: PlanFeaturesMap;
  expires_at: string | null;
  is_expired: boolean;
}

// ─── Resolve the per-plan monthly appointment limit ──────────────────────────
// -1 (or absent) means unlimited → returns null.
export function planAppointmentLimit(plan: SubscriptionPlan | null | undefined): number | null {
  if (!plan) return null;
  if (typeof plan.max_appointments_per_month === 'number' && plan.max_appointments_per_month >= 0) {
    return plan.max_appointments_per_month;
  }
  const f = plan.features ?? {};
  const max = typeof f.max_appointments === 'number' ? f.max_appointments : null;
  return max == null || max < 0 ? null : max;
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

/** All active plans (generic — the same catalogue for doctors and clinics). */
export function useSubscriptionPlans(_entityType?: EntityType) {
  return useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => payFetch<SubscriptionPlan[]>('/plans'),
  });
}

/** Current user's subscription status + monthly usage/limit. */
export function useSubscriptionStatus() {
  return useQuery({
    queryKey: ['subscription-status'],
    queryFn: () => payFetch<SubscriptionStatus>('/subscription'),
  });
}

/** Legacy adapter: appointment-limit info derived from subscription status. */
export function useAppointmentLimit(_entityType: EntityType, _entityId?: string | undefined) {
  return useQuery({
    queryKey: ['appointment-limit'],
    queryFn: async (): Promise<AppointmentLimitInfo> => {
      const s = await payFetch<SubscriptionStatus>('/subscription');
      const now = new Date();
      const reset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return {
        plan: s.plan ?? 'FREE',
        count: s.usage ?? 0,
        limit: s.limit,
        can_create: s.can_create,
        remaining: s.limit == null ? null : Math.max(s.limit - (s.usage ?? 0), 0),
        reset_at: reset.toISOString(),
      };
    },
    refetchInterval: 60000,
  });
}

/** Legacy adapter: plan features derived from subscription status. */
export function usePlanFeatures(_entityType: EntityType, _entityId?: string | undefined) {
  const { data: plans } = useSubscriptionPlans();
  return useQuery({
    queryKey: ['plan-features', plans?.length ?? 0],
    queryFn: async (): Promise<PlanFeatures> => {
      const s = await payFetch<SubscriptionStatus>('/subscription');
      const plan = plans?.find((p) => p.slug === s.plan);
      return {
        plan: s.plan ?? 'FREE',
        features: plan?.features ?? {},
        expires_at: s.expires_at,
        is_expired: s.is_expired,
      };
    },
    enabled: true,
  });
}

/**
 * Activate a plan. Server atomically debits the wallet (USER-scoped) and stamps
 * subscription_plan + subscription_expires_at on the owned doctor/clinic entity.
 */
export function useSubscribeToPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      planSlug,
      entityType,
    }: {
      planSlug: string;
      entityType?: EntityType;
    }) => {
      return payFetch('/subscribe', {
        method: 'POST',
        body: JSON.stringify({ plan_slug: planSlug, entity_type: entityType }),
      });
    },
    onSuccess: () => {
      toast.success(tGlobal('apiMessages.planSubscribed'));
      queryClient.invalidateQueries({ queryKey: ['subscription-status'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-limit'] });
      queryClient.invalidateQueries({ queryKey: ['plan-features'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['virtual-account'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-by-user'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-subscription'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function hasFeature(features: PlanFeatures | null | undefined, feature: string): boolean {
  if (!features) return false;
  return !!features.features?.[feature];
}
