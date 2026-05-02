// PRODENT data-access client.
//
// REST proxy for the Spring Boot API (`/api/v1/*`) that mimics a small subset
// of the Supabase JS SDK shape so the existing query code stays declarative
// (`api.from('appointments').select('*').eq('clinic_id', x)`).
//
// There is NO runtime dependency on `@supabase/supabase-js`. Do not add one —
// it is enforced by an ESLint rule (see `eslint.config.js`).
//
// Canonical export is `api`. The `supabase` symbol is kept as a backward-
// compatible alias for legacy call-sites; new code should import `api`.
import type { Database } from './types';

// ─── Auth-related type shims ───────────────────────────────────────────────
// Replicate the shape of @supabase/supabase-js User/Session without depending
// on it. The fields are intentionally permissive — JWT payload from Spring
// is decoded into `User` via `userFromToken`.

export interface User {
  id: string;
  email?: string;
  phone?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
  aud?: string;
  created_at?: string;
  [key: string]: any;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  user: User;
  [key: string]: any;
}

// ────────────────────────────────────────────────────────────────────────────

const API_BASE = '/api/v1';
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

const TOKEN_KEY = 'prodent_access_token';
const REFRESH_TOKEN_KEY = 'prodent_refresh_token';

// ─── Helpers ────────────────────────────────────────────────────────────────

type AuthCallback = (event: string, session: any) => void;
const authCallbacks: Set<AuthCallback> = new Set();

function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function storeTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function decodeJwtPayload(token: string): any {
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function userFromToken(token: string | null): any {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return {
    id: payload.sub ?? payload.id ?? payload.user_id,
    email: payload.email,
    role: payload.role ?? payload.roles?.[0] ?? 'authenticated',
    user_metadata: payload.user_metadata ?? {},
    app_metadata: payload.app_metadata ?? {},
    aud: payload.aud ?? 'authenticated',
    created_at: payload.created_at ?? '',
  };
}

function buildSession() {
  const access = getAccessToken();
  const refresh = getRefreshToken();
  if (!access) return null;
  return {
    access_token: access,
    refresh_token: refresh,
    token_type: 'bearer',
    user: userFromToken(access),
  };
}

function notifyAuthCallbacks(event: string) {
  const session = buildSession();
  authCallbacks.forEach((cb) => {
    try {
      cb(event, session);
    } catch (e) {
      console.error('[supabase-proxy] auth callback error:', e);
    }
  });
}

// ─── Fetch wrapper with auto-refresh ────────────────────────────────────────

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refresh = getRefreshToken();
      if (!refresh) return false;
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return false;
      const body = await res.json();
      const newAccess = body.access_token ?? body.token ?? body.data?.access_token;
      const newRefresh = body.refresh_token ?? refresh ?? body.data?.refresh_token;
      if (newAccess) {
        storeTokens(newAccess, newRefresh);
        notifyAuthCallbacks('TOKEN_REFRESHED');
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function apiFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401 && token) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getAccessToken()}`;
      res = await fetch(url, { ...options, headers });
    } else {
      clearTokens();
      notifyAuthCallbacks('SIGNED_OUT');
    }
  }

  return res;
}

async function safeJson(res: Response): Promise<any> {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function makeResult(data: any, error: any, status = 200, statusText = 'OK', count: number | null = null) {
  return { data, error, count, status, statusText };
}

// ─── Auth ────────────────────────────────────────────────────────────────────

const auth = {
  async getSession() {
    const session = buildSession();
    return { data: { session }, error: null };
  },

  async getUser() {
    const token = getAccessToken();
    if (!token) {
      return { data: { user: null }, error: { message: 'Not authenticated' } };
    }
    try {
      const res = await apiFetch(`${API_BASE}/users/me`);
      if (!res.ok) {
        return { data: { user: null }, error: { message: 'Failed to get user', status: res.status } };
      }
      const body = await safeJson(res);
      const user = body?.data ?? body?.user ?? body;
      return { data: { user }, error: null };
    } catch (e: any) {
      return { data: { user: null }, error: { message: e.message } };
    }
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        return {
          data: { user: null, session: null },
          error: { message: body?.message ?? body?.error ?? 'Login failed', status: res.status },
        };
      }
      const access = body.access_token ?? body.token ?? body.data?.access_token;
      const refresh = body.refresh_token ?? body.data?.refresh_token ?? '';
      if (access) {
        storeTokens(access, refresh);
        const session = buildSession();
        notifyAuthCallbacks('SIGNED_IN');
        return { data: { user: session?.user, session }, error: null };
      }
      return { data: { user: null, session: null }, error: { message: 'No token in response' } };
    } catch (e: any) {
      return { data: { user: null, session: null }, error: { message: e.message } };
    }
  },

  async signUp({ email, password, options }: { email: string; password: string; options?: any }) {
    try {
      const payload: any = { email, password };
      if (options?.data) {
        payload.metadata = options.data;
        // Spread common fields
        if (options.data.full_name) payload.full_name = options.data.full_name;
      }
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        return {
          data: { user: null, session: null },
          error: { message: body?.message ?? body?.error ?? 'Registration failed', status: res.status },
        };
      }
      const access = body.access_token ?? body.token ?? body.data?.access_token;
      const refresh = body.refresh_token ?? body.data?.refresh_token ?? '';
      if (access) {
        storeTokens(access, refresh);
        const session = buildSession();
        notifyAuthCallbacks('SIGNED_IN');
        return { data: { user: session?.user, session }, error: null };
      }
      // Some flows don't return a token (email confirmation required)
      const user = body.user ?? body.data?.user ?? null;
      return { data: { user, session: null }, error: null };
    } catch (e: any) {
      return { data: { user: null, session: null }, error: { message: e.message } };
    }
  },

  async signOut() {
    try {
      await apiFetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    } catch {
      // Ignore errors — clear local state regardless
    }
    clearTokens();
    notifyAuthCallbacks('SIGNED_OUT');
    return { error: null };
  },

  async setSession({ access_token, refresh_token }: { access_token: string; refresh_token: string }) {
    storeTokens(access_token, refresh_token);
    const session = buildSession();
    notifyAuthCallbacks('SIGNED_IN');
    return { data: { session }, error: null };
  },

  onAuthStateChange(callback: AuthCallback) {
    authCallbacks.add(callback);
    // Fire initial state
    const session = buildSession();
    if (session) {
      setTimeout(() => callback('INITIAL_SESSION', session), 0);
    }
    return {
      data: {
        subscription: {
          id: Math.random().toString(36).slice(2),
          unsubscribe() {
            authCallbacks.delete(callback);
          },
        },
      },
    };
  },

  async signInWithOAuth({ provider, options }: { provider: string; options?: any }) {
    const redirectTo = options?.redirectTo ?? window.location.origin;
    window.location.href = `${API_BASE}/auth/oauth/${provider}?redirect_to=${encodeURIComponent(redirectTo)}`;
    return { data: { provider, url: `${API_BASE}/auth/oauth/${provider}` }, error: null };
  },

  async resetPasswordForEmail(email: string, options?: any) {
    try {
      const res = await fetch(`${API_BASE}/auth/send-reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        return { data: null, error: { message: body?.message ?? 'Failed' } };
      }
      return { data: body, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  },

  async updateUser(attributes: any) {
    try {
      const res = await apiFetch(`${API_BASE}/users/me`, {
        method: 'PATCH',
        body: JSON.stringify(attributes),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        return { data: { user: null }, error: { message: body?.message ?? 'Update failed' } };
      }
      return { data: { user: body?.data ?? body?.user ?? body }, error: null };
    } catch (e: any) {
      return { data: { user: null }, error: { message: e.message } };
    }
  },
};

// ─── Query Builder ──────────────────────────────────────────────────────────

type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'contains' | 'cs' | 'cd' | 'not' | 'fts' | 'or';

interface QueryFilter {
  column: string;
  operator: FilterOperator;
  value: any;
  negate?: boolean;
}

function createQueryBuilder(table: string) {
  let method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'GET';
  let selectColumns: string | null = null;
  let filters: QueryFilter[] = [];
  let orderClauses: { column: string; ascending: boolean; nullsFirst?: boolean }[] = [];
  let limitValue: number | null = null;
  let rangeFrom: number | null = null;
  let rangeTo: number | null = null;
  let bodyData: any = null;
  let isSingle = false;
  let isMaybeSingle = false;
  let isCount = false;
  let headOnly = false;
  let orConditions: string | null = null;

  function buildUrl(): string {
    const params = new URLSearchParams();

    if (selectColumns) {
      params.set('select', selectColumns);
    }

    for (const f of filters) {
      if (f.operator === 'or') {
        params.set('or', f.value);
      } else if (f.operator === 'in') {
        const vals = Array.isArray(f.value) ? f.value.map((v: any) => JSON.stringify(v)).join(',') : f.value;
        params.set(f.column, `${f.negate ? 'not.' : ''}in.(${vals})`);
      } else if (f.operator === 'is') {
        params.set(f.column, `${f.negate ? 'not.' : ''}is.${f.value}`);
      } else if (f.operator === 'contains' || f.operator === 'cs') {
        const val = typeof f.value === 'object' ? JSON.stringify(f.value) : f.value;
        params.set(f.column, `${f.negate ? 'not.' : ''}cs.${val}`);
      } else if (f.operator === 'cd') {
        const val = typeof f.value === 'object' ? JSON.stringify(f.value) : f.value;
        params.set(f.column, `${f.negate ? 'not.' : ''}cd.${val}`);
      } else if (f.operator === 'fts') {
        params.set(f.column, `${f.negate ? 'not.' : ''}fts.${f.value}`);
      } else if (f.operator === 'not') {
        // .not(column, operator, value) already decomposed
        params.set(f.column, `not.${f.value}`);
      } else {
        params.set(f.column, `${f.negate ? 'not.' : ''}${f.operator}.${f.value}`);
      }
    }

    if (orConditions) {
      params.set('or', orConditions);
    }

    for (const o of orderClauses) {
      const dir = o.ascending ? 'asc' : 'desc';
      const nulls = o.nullsFirst !== undefined ? (o.nullsFirst ? '.nullsfirst' : '.nullslast') : '';
      params.append('order', `${o.column}.${dir}${nulls}`);
    }

    if (limitValue !== null) {
      params.set('limit', String(limitValue));
    }

    if (rangeFrom !== null && rangeTo !== null) {
      params.set('offset', String(rangeFrom));
      params.set('limit', String(rangeTo - rangeFrom + 1));
    }

    if (isCount || headOnly) {
      params.set('count', 'exact');
    }

    const qs = params.toString();
    return `${API_BASE}/data/${table}${qs ? '?' + qs : ''}`;
  }

  async function execute(): Promise<{ data: any; error: any; count: number | null; status: number; statusText: string }> {
    try {
      const url = buildUrl();
      const fetchOptions: RequestInit = { method };
      if (bodyData !== null && method !== 'GET' && method !== 'DELETE') {
        fetchOptions.body = JSON.stringify(bodyData);
      }
      // For DELETE with filters, still use the URL params
      if (method === 'DELETE' && bodyData !== null) {
        fetchOptions.body = JSON.stringify(bodyData);
      }

      const res = await apiFetch(url, fetchOptions);
      const body = await safeJson(res);

      if (!res.ok) {
        return makeResult(
          null,
          { message: body?.message ?? body?.error ?? res.statusText, details: body?.details, code: body?.code },
          res.status,
          res.statusText,
        );
      }

      // Extract data — backend may wrap in { data, count } or return array directly
      let data = body;
      let count: number | null = null;

      if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
        data = body.data;
        count = body.count ?? body.total ?? null;
      }

      // Handle count from header
      const contentRange = res.headers.get('content-range');
      if (contentRange) {
        const match = contentRange.match(/\/(\d+|\*)/);
        if (match && match[1] !== '*') {
          count = parseInt(match[1], 10);
        }
      }

      if (isSingle) {
        if (Array.isArray(data)) {
          if (data.length === 0) {
            return makeResult(null, { message: 'Row not found', code: 'PGRST116' }, 406, 'Not Acceptable');
          }
          data = data[0];
        }
      }

      if (isMaybeSingle) {
        if (Array.isArray(data)) {
          data = data.length > 0 ? data[0] : null;
        }
      }

      return makeResult(data, null, res.status, res.statusText, count);
    } catch (e: any) {
      return makeResult(null, { message: e.message }, 0, 'Network Error');
    }
  }

  const builder: any = {
    select(columns?: string) {
      method = 'GET';
      selectColumns = columns ?? '*';
      return builder;
    },
    insert(data: any) {
      method = 'POST';
      bodyData = data;
      return builder;
    },
    update(data: any) {
      method = 'PATCH';
      bodyData = data;
      return builder;
    },
    upsert(data: any) {
      method = 'PUT';
      bodyData = data;
      return builder;
    },
    delete() {
      method = 'DELETE';
      return builder;
    },

    // Filters
    eq(column: string, value: any) {
      filters.push({ column, operator: 'eq', value });
      return builder;
    },
    neq(column: string, value: any) {
      filters.push({ column, operator: 'neq', value });
      return builder;
    },
    gt(column: string, value: any) {
      filters.push({ column, operator: 'gt', value });
      return builder;
    },
    gte(column: string, value: any) {
      filters.push({ column, operator: 'gte', value });
      return builder;
    },
    lt(column: string, value: any) {
      filters.push({ column, operator: 'lt', value });
      return builder;
    },
    lte(column: string, value: any) {
      filters.push({ column, operator: 'lte', value });
      return builder;
    },
    like(column: string, pattern: string) {
      filters.push({ column, operator: 'like', value: pattern });
      return builder;
    },
    ilike(column: string, pattern: string) {
      filters.push({ column, operator: 'ilike', value: pattern });
      return builder;
    },
    in(column: string, values: any[]) {
      filters.push({ column, operator: 'in', value: values });
      return builder;
    },
    is(column: string, value: any) {
      filters.push({ column, operator: 'is', value });
      return builder;
    },
    contains(column: string, value: any) {
      filters.push({ column, operator: 'contains', value });
      return builder;
    },
    containedBy(column: string, value: any) {
      filters.push({ column, operator: 'cd', value });
      return builder;
    },
    not(column: string, operator: string, value: any) {
      if (operator === 'in') {
        const vals = Array.isArray(value) ? value.map((v: any) => JSON.stringify(v)).join(',') : value;
        filters.push({ column, operator: 'not', value: `in.(${vals})` });
      } else if (operator === 'is') {
        filters.push({ column, operator: 'not', value: `is.${value}` });
      } else {
        filters.push({ column, operator: 'not', value: `${operator}.${value}` });
      }
      return builder;
    },
    or(conditions: string, { foreignTable }: { foreignTable?: string } = {}) {
      if (foreignTable) {
        filters.push({ column: `${foreignTable}.or`, operator: 'or', value: `(${conditions})` });
      } else {
        orConditions = `(${conditions})`;
      }
      return builder;
    },
    filter(column: string, operator: string, value: any) {
      filters.push({ column, operator: operator as FilterOperator, value });
      return builder;
    },
    textSearch(column: string, query: string, { type, config }: { type?: string; config?: string } = {}) {
      const searchType = type === 'plain' ? 'plfts' : type === 'phrase' ? 'phfts' : type === 'websearch' ? 'wfts' : 'fts';
      const configPart = config ? `(${config})` : '';
      filters.push({ column, operator: 'fts', value: `${configPart}${query}` });
      return builder;
    },
    match(query: Record<string, any>) {
      for (const [col, val] of Object.entries(query)) {
        filters.push({ column: col, operator: 'eq', value: val });
      }
      return builder;
    },

    // Modifiers
    order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean } | { ascending?: boolean }) {
      const ascending = options?.ascending ?? true;
      const nullsFirst = (options as any)?.nullsFirst;
      orderClauses.push({ column, ascending, nullsFirst });
      return builder;
    },
    limit(n: number) {
      limitValue = n;
      return builder;
    },
    range(from: number, to: number) {
      rangeFrom = from;
      rangeTo = to;
      return builder;
    },
    single() {
      isSingle = true;
      return builder;
    },
    maybeSingle() {
      isMaybeSingle = true;
      return builder;
    },

    // Head / count
    head() {
      headOnly = true;
      return builder;
    },

    // Abort signal support (no-op, just for API compat)
    abortSignal(_signal: AbortSignal) {
      return builder;
    },

    // CSV (no-op stub)
    csv() {
      return builder;
    },

    // Returns / select after mutation
    returns() {
      return builder;
    },

    // Thenable: allows `await supabase.from('x').select()`
    then(resolve: (value: any) => any, reject?: (reason: any) => any) {
      return execute().then(resolve, reject);
    },

    // Allow explicit execution
    async throwOnError() {
      const result = await execute();
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result;
    },
  };

  return builder;
}

// ─── Functions (Edge Function proxy) ─────────────────────────────────────────

const EDGE_FUNCTION_MAP: Record<string, string> = {
  'send-otp': '/auth/send-otp',
  'verify-code': '/auth/verify-code',
  'set-password': '/auth/set-password',
  'send-reset-code': '/auth/send-reset-code',
  'reset-password': '/auth/reset-password',
  'resend-code': '/auth/resend-code',
  'payment-topup': '/payments/topup',
  'payme-subscribe': '/payments/payme-subscribe',
  'send-notification': '/notifications/send',
};

const functions = {
  async invoke(name: string, options?: { body?: any; headers?: Record<string, string> }) {
    const path = EDGE_FUNCTION_MAP[name] ?? `/functions/${name}`;
    try {
      const res = await apiFetch(`${API_BASE}${path}`, {
        method: 'POST',
        body: options?.body ? JSON.stringify(options.body) : undefined,
        headers: options?.headers,
      });
      const body = await safeJson(res);
      if (!res.ok) {
        return { data: null, error: { message: body?.message ?? body?.error ?? res.statusText, status: res.status } };
      }
      const data = body?.data ?? body;
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  },
};

// ─── RPC ─────────────────────────────────────────────────────────────────────

async function rpc(functionName: string, params?: any) {
  try {
    const res = await apiFetch(`${API_BASE}/rpc/${functionName}`, {
      method: 'POST',
      body: params ? JSON.stringify(params) : '{}',
    });
    const body = await safeJson(res);
    if (!res.ok) {
      return makeResult(null, { message: body?.message ?? body?.error ?? res.statusText }, res.status, res.statusText);
    }
    const data = body?.data ?? body;
    return makeResult(data, null, res.status, res.statusText);
  } catch (e: any) {
    return makeResult(null, { message: e.message }, 0, 'Network Error');
  }
}

// ─── Realtime (WebSocket with STOMP + polling fallback) ──────────────────────

interface ChannelSubscription {
  event: string;
  schema: string;
  table: string;
  filter?: string;
  callback: (payload: any) => void;
}

interface RealtimeChannel {
  topic: string;
  subscriptions: ChannelSubscription[];
  ws: WebSocket | null;
  pollingInterval: ReturnType<typeof setInterval> | null;
  isSubscribed: boolean;
  on(
    event: string,
    opts: { event: string; schema: string; table: string; filter?: string },
    callback: (payload: any) => void,
  ): RealtimeChannel;
  subscribe(callback?: (status: string, err?: Error) => void): RealtimeChannel;
  unsubscribe(): void;
}

const activeChannels = new Map<string, RealtimeChannel>();

function createChannel(name: string): RealtimeChannel {
  const channel: RealtimeChannel = {
    topic: name,
    subscriptions: [],
    ws: null,
    pollingInterval: null,
    isSubscribed: false,

    on(
      _type: string,
      opts: { event: string; schema: string; table: string; filter?: string },
      callback: (payload: any) => void,
    ) {
      channel.subscriptions.push({
        event: opts.event,
        schema: opts.schema ?? 'public',
        table: opts.table,
        filter: opts.filter,
        callback,
      });
      return channel;
    },

    subscribe(callback?: (status: string, err?: Error) => void) {
      channel.isSubscribed = true;
      activeChannels.set(name, channel);

      // Try WebSocket
      try {
        const token = getAccessToken();
        const wsUrl = token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL;
        const ws = new WebSocket(wsUrl);
        channel.ws = ws;

        ws.onopen = () => {
          // Send STOMP-like CONNECT frame
          const connectFrame = 'CONNECT\naccept-version:1.2\n\n\0';
          ws.send(connectFrame);

          // Subscribe to each table topic
          for (const sub of channel.subscriptions) {
            const destination = `/topic/table/${sub.table}`;
            const subFrame = `SUBSCRIBE\nid:sub-${name}-${sub.table}\ndestination:${destination}\n\n\0`;
            ws.send(subFrame);
          }

          callback?.('SUBSCRIBED');
        };

        ws.onmessage = (evt) => {
          try {
            // Try parsing as JSON first (non-STOMP)
            let payload: any;
            const raw = evt.data;

            if (typeof raw === 'string' && raw.startsWith('MESSAGE')) {
              // STOMP frame — extract body after double newline
              const bodyStart = raw.indexOf('\n\n');
              if (bodyStart >= 0) {
                const body = raw.substring(bodyStart + 2).replace(/\0$/, '');
                payload = JSON.parse(body);
              }
            } else {
              payload = JSON.parse(raw);
            }

            if (payload) {
              for (const sub of channel.subscriptions) {
                const table = payload.table ?? payload.topic?.split('/')?.pop();
                if (!table || table === sub.table) {
                  const eventType = payload.type ?? payload.event ?? payload.eventType;
                  if (!sub.event || sub.event === '*' || sub.event === eventType) {
                    sub.callback({
                      eventType: eventType ?? sub.event,
                      new: payload.new ?? payload.record ?? payload.data,
                      old: payload.old ?? payload.old_record ?? null,
                      schema: sub.schema,
                      table: sub.table,
                      commit_timestamp: payload.commit_timestamp ?? new Date().toISOString(),
                    });
                  }
                }
              }
            }
          } catch {
            // Ignore unparseable messages (STOMP CONNECTED, heartbeats, etc.)
          }
        };

        ws.onerror = () => {
          // Fall back to polling
          startPolling(channel);
          callback?.('CHANNEL_ERROR');
        };

        ws.onclose = () => {
          if (channel.isSubscribed) {
            // Reconnect or fallback
            startPolling(channel);
          }
        };
      } catch {
        // WebSocket not available, fall back to polling
        startPolling(channel);
        callback?.('SUBSCRIBED');
      }

      return channel;
    },

    unsubscribe() {
      channel.isSubscribed = false;
      if (channel.ws) {
        try {
          channel.ws.close();
        } catch {
          // ignore
        }
        channel.ws = null;
      }
      if (channel.pollingInterval) {
        clearInterval(channel.pollingInterval);
        channel.pollingInterval = null;
      }
      activeChannels.delete(name);
    },
  };

  return channel;
}

function startPolling(channel: RealtimeChannel) {
  if (channel.pollingInterval) return;
  if (!channel.isSubscribed) return;

  // Track last poll time per table
  const lastPoll: Record<string, string> = {};

  channel.pollingInterval = setInterval(async () => {
    if (!channel.isSubscribed) {
      if (channel.pollingInterval) clearInterval(channel.pollingInterval);
      return;
    }

    for (const sub of channel.subscriptions) {
      try {
        const params = new URLSearchParams();
        params.set('select', '*');
        params.set('order', 'created_at.desc');
        params.set('limit', '10');
        if (lastPoll[sub.table]) {
          params.set('created_at', `gt.${lastPoll[sub.table]}`);
        }
        if (sub.filter) {
          // Parse filter like "user_id=eq.abc123"
          const eqIndex = sub.filter.indexOf('=');
          if (eqIndex > -1) {
            const col = sub.filter.substring(0, eqIndex);
            const rest = sub.filter.substring(eqIndex + 1);
            params.set(col, rest);
          }
        }
        const res = await apiFetch(`${API_BASE}/data/${sub.table}?${params.toString()}`);
        if (res.ok) {
          const body = await safeJson(res);
          const rows = Array.isArray(body) ? body : body?.data ?? [];
          for (const row of rows) {
            sub.callback({
              eventType: sub.event === '*' ? 'INSERT' : sub.event,
              new: row,
              old: null,
              schema: sub.schema,
              table: sub.table,
              commit_timestamp: row.created_at ?? new Date().toISOString(),
            });
          }
          if (rows.length > 0 && rows[0].created_at) {
            lastPoll[sub.table] = rows[0].created_at;
          } else {
            lastPoll[sub.table] = new Date().toISOString();
          }
        }
      } catch {
        // Silently continue polling
      }
    }
  }, 10000);
}

// ─── Storage (stub) ──────────────────────────────────────────────────────────

const storage = {
  from(_bucket: string) {
    return {
      upload: async (_path: string, _file: any, _options?: any) =>
        ({ data: null, error: { message: 'Storage not implemented — use backend file upload API' } }),
      download: async (_path: string) =>
        ({ data: null, error: { message: 'Storage not implemented' } }),
      getPublicUrl: (path: string) =>
        ({ data: { publicUrl: `${API_BASE}/storage/${_bucket}/${path}` } }),
      remove: async (_paths: string[]) =>
        ({ data: null, error: { message: 'Storage not implemented' } }),
      list: async (_path?: string) =>
        ({ data: [], error: null }),
      createSignedUrl: async (path: string, _expiresIn: number) =>
        ({ data: { signedUrl: `${API_BASE}/storage/${_bucket}/${path}?token=${getAccessToken()}` }, error: null }),
      createSignedUrls: async (paths: string[], _expiresIn: number) =>
        ({ data: paths.map((p) => ({ signedUrl: `${API_BASE}/storage/${_bucket}/${p}?token=${getAccessToken()}`, path: p })), error: null }),
    };
  },
};

// ─── Main export ─────────────────────────────────────────────────────────────

/** PRODENT data-access client (canonical name). */
export const api = {
  auth,
  functions,
  storage,
  rpc,

  from(table: string) {
    return createQueryBuilder(table);
  },

  channel(name: string) {
    return createChannel(name);
  },

  removeChannel(channel: RealtimeChannel) {
    channel.unsubscribe();
    return Promise.resolve('ok');
  },

  removeAllChannels() {
    for (const ch of activeChannels.values()) {
      ch.unsubscribe();
    }
    activeChannels.clear();
    return Promise.resolve('ok');
  },

  getChannels() {
    return Array.from(activeChannels.values());
  },
};

/**
 * Backward-compatible alias for legacy call-sites that still import
 * `{ supabase }` from this module. New code should import `{ api }`.
 *
 * @deprecated Use `api` instead.
 */
export const supabase = api;
