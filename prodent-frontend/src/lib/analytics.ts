/**
 * Analytics + error tracking initialization.
 *
 * All services are opt-in: they only activate when the corresponding
 * VITE_* env variable is set. In dev mode everything is silent.
 *
 * Usage: call initAnalytics() once in main.tsx after React mounts.
 */

// ─── UTM persistence ────────────────────────────────────────

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
const UTM_STORAGE_KEY = 'prodent_utm';

/**
 * Capture UTM params from current URL and persist in sessionStorage.
 * Called once on app load. Values survive page navigations within the session.
 */
export function captureUtmParams(): Record<string, string> | null {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  let hasAny = false;

  for (const key of UTM_KEYS) {
    const val = params.get(key);
    if (val) {
      utm[key] = val;
      hasAny = true;
    }
  }

  if (hasAny) {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
    return utm;
  }

  // Return previously captured UTM if exists
  const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}

/**
 * Get stored UTM params (for sending with registration request).
 */
export function getStoredUtm(): Record<string, string> | null {
  const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}

// ─── GTM dataLayer ──────────────────────────────────────────

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    ym?: (...args: unknown[]) => void;
  }
}

/**
 * Push an event to GTM dataLayer (GA4 picks it up via GTM triggers).
 */
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...params });
}

// ─── Yandex.Metrika goals ───────────────────────────────────

const YM_ID = import.meta.env.VITE_YM_ID ? Number(import.meta.env.VITE_YM_ID) : null;

export function reachGoal(goalName: string, params?: Record<string, unknown>) {
  if (YM_ID && window.ym) {
    window.ym(YM_ID, 'reachGoal', goalName, params);
  }
}

// ─── Convenience: track key funnel events ───────────────────

export const analytics = {
  /** User landed on the site */
  pageView: (path: string) => trackEvent('page_view', { page_path: path }),

  /** User signed up */
  signUp: (method: string) => {
    trackEvent('sign_up', { method });
    reachGoal('registration');
  },

  /** User logged in */
  login: (method: string) => {
    trackEvent('login', { method });
    reachGoal('login');
  },

  /** User started booking flow */
  bookingStarted: (doctorId: string) => {
    trackEvent('booking_started', { doctor_id: doctorId });
    reachGoal('booking_started');
  },

  /** Appointment confirmed */
  bookingCompleted: (appointmentId: string) => {
    trackEvent('booking_completed', { appointment_id: appointmentId });
    reachGoal('booking_completed');
  },

  /** Payment initiated */
  paymentStarted: (provider: string, amount: number) => {
    trackEvent('payment_started', { provider, amount });
    reachGoal('payment_started');
  },

  /** Search performed */
  search: (query: string, filters: Record<string, string>) => {
    trackEvent('search', { search_term: query, ...filters });
  },
};

// ─── Referral code persistence ──────────────────────────────

const REF_STORAGE_KEY = 'prodent_ref';

/**
 * Capture ?ref= param from URL and persist in sessionStorage.
 */
export function captureReferralCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    sessionStorage.setItem(REF_STORAGE_KEY, ref);
    return ref;
  }
  return sessionStorage.getItem(REF_STORAGE_KEY);
}

/**
 * Get stored referral code (for sending with registration request).
 */
export function getStoredReferralCode(): string | null {
  return sessionStorage.getItem(REF_STORAGE_KEY);
}

// ─── Init ───────────────────────────────────────────────────

export function initAnalytics() {
  captureUtmParams();
  captureReferralCode();
}
