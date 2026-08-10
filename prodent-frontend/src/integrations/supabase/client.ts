// Custom Supabase-compatible REST API proxy for Java backend
import type { Database } from './types';

// ─── Supabase-compatible type definitions ──────────────────────────────────
// These replace @supabase/supabase-js User and Session types

export interface User {
  id: string;
  email?: string;
  phone?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  full_name?: string;
  user_metadata?: UserMetadata;
  app_metadata?: Record<string, unknown>;
  aud?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface UserMetadata {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  full_name?: string;
  name?: string;
  avatar_url?: string;
  phone?: string;
  account_number?: string;
  role?: string;
  roles?: string[];
  referral_code?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  [key: string]: unknown;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: User | null;
  [key: string]: unknown;
}

// ────────────────────────────────────────────────────────────────────────────

const API_BASE = '/api/v1';
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

const TOKEN_KEY = 'prodent_access_token';
const REFRESH_TOKEN_KEY = 'prodent_refresh_token';
const USER_PROFILE_KEY = 'prodent_user_profile';

// ─── Helpers ────────────────────────────────────────────────────────────────

type UnknownRecord = Record<string, unknown>;

interface ApiError {
  message: string;
  status?: number;
  details?: unknown;
  code?: string;
}

interface ApiResult<T> {
  data: T;
  error: ApiError | null;
  count: number | null;
  status: number;
  statusText: string;
}

interface StoredUserProfile extends UnknownRecord {
  id?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  fullName?: string;
  full_name?: string;
  avatarUrl?: string;
  avatar_url?: string;
  accountNumber?: string;
  account_number?: string;
  createdAt?: string;
  roles?: string[];
}

interface JwtPayload extends UnknownRecord {
  sub?: string;
  id?: string;
  user_id?: string;
  email?: string;
  role?: string;
  roles?: string[];
  user_metadata?: UserMetadata;
  app_metadata?: Record<string, unknown>;
  aud?: string;
  created_at?: string;
}

interface SignUpOptions extends UnknownRecord {
  data?: UserMetadata;
}

interface OAuthOptions extends UnknownRecord {
  redirectTo?: string;
}

interface PasswordResetOptions extends UnknownRecord {
  redirectTo?: string;
}

interface StorageUploadOptions extends UnknownRecord {
  cacheControl?: string;
  contentType?: string;
  upsert?: boolean;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined;
}

function nestedRecord(record: UnknownRecord | null, key: string): UnknownRecord | null {
  return asRecord(record?.[key]);
}

function apiMessage(payload: unknown, fallback: string): string {
  const record = asRecord(payload);
  return asString(record?.message) ?? asString(record?.error) ?? fallback;
}

function errorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return apiMessage(error, fallback);
}

function responseData(payload: unknown): unknown {
  const record = asRecord(payload);
  return record && 'data' in record ? record.data : payload;
}

function toUser(value: unknown): User | null {
  const record = asRecord(value);
  const id = asString(record?.id);
  if (!record || !id) return null;
  return { ...record, id } as User;
}

type AuthCallback = (event: string, session: Session | null) => void;
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

function storeUserProfile(profile: unknown) {
  if (profile && typeof profile === 'object') {
    try {
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    } catch {
      /* quota / serialisation issues — non-fatal */
    }
  }
}

function getStoredUserProfile(): StoredUserProfile | null {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed as StoredUserProfile : null;
  } catch {
    return null;
  }
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_PROFILE_KEY);
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed: unknown = JSON.parse(json);
    if (!isRecord(parsed)) return null;
    return {
      ...parsed,
      sub: asString(parsed.sub),
      id: asString(parsed.id),
      user_id: asString(parsed.user_id),
      email: asString(parsed.email),
      role: asString(parsed.role),
      roles: asStringArray(parsed.roles),
      user_metadata: isRecord(parsed.user_metadata) ? parsed.user_metadata : undefined,
      app_metadata: isRecord(parsed.app_metadata) ? parsed.app_metadata : undefined,
      aud: asString(parsed.aud),
      created_at: asString(parsed.created_at),
    };
  } catch {
    return null;
  }
}

function userFromToken(token: string | null): User | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const id = payload.sub ?? payload.id ?? payload.user_id;
  const cached = getStoredUserProfile();
  const profile = cached && cached.id === id ? cached : null;

  // Build a Supabase-compatible user_metadata block from the cached profile
  // so legacy components reading user.user_metadata.full_name keep working.
  const firstName = profile?.firstName ?? profile?.first_name ?? '';
  const lastName = profile?.lastName ?? profile?.last_name ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
    || profile?.fullName
    || profile?.full_name
    || '';

  const user_metadata: UserMetadata = {
    ...(payload.user_metadata ?? {}),
    ...(profile ? {
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      full_name: fullName || undefined,
      name: fullName || undefined,
      avatar_url: profile.avatarUrl ?? profile.avatar_url ?? undefined,
      phone: profile.phone ?? undefined,
      account_number: profile.accountNumber ?? profile.account_number ?? undefined,
      roles: profile.roles ?? undefined,
    } : {}),
  };

  // Roles drive the post-login home redirect (see lib/roleHome). Fall back to
  // the JWT `roles` claim when the cached profile has none yet, so a seller (or
  // any role) lands in the right cabinet on the first navigation after login —
  // before /users/me has populated the cached profile.
  if (!user_metadata.roles && Array.isArray(payload.roles) && payload.roles.length) {
    user_metadata.roles = payload.roles;
  }

  return {
    id,
    email: payload.email ?? profile?.email,
    phone: profile?.phone,
    role: payload.role ?? payload.roles?.[0] ?? profile?.roles?.[0] ?? 'authenticated',
    user_metadata,
    app_metadata: payload.app_metadata ?? {},
    aud: payload.aud ?? 'authenticated',
    created_at: payload.created_at ?? profile?.createdAt ?? '',
    // Convenience fields for components that read directly:
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    full_name: fullName || undefined,
  };
}

function buildSession(): Session | null {
  const access = getAccessToken();
  const refresh = getRefreshToken();
  if (!access) return null;
  return {
    access_token: access,
    refresh_token: refresh ?? '',
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
      const body = asRecord(await safeJson(res));
      const nested = nestedRecord(body, 'data');
      const newAccess = asString(body?.access_token) ?? asString(body?.token) ?? asString(nested?.access_token);
      const newRefresh = asString(body?.refresh_token) ?? refresh ?? asString(nested?.refresh_token) ?? '';
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

export async function apiFetch(
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

async function safeJson(res: Response): Promise<unknown> {
  try {
    const text = await res.text();
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return null;
  }
}

function makeResult<T>(data: T, error: ApiError | null, status = 200, statusText = 'OK', count: number | null = null): ApiResult<T> {
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
      const bodyRecord = asRecord(body);
      const user = toUser(bodyRecord?.data ?? bodyRecord?.user ?? body);
      if (!user) {
        return { data: { user: null }, error: { message: 'Invalid user response' } };
      }
      // Refresh cached profile so subsequent buildSession() calls see the
      // newest firstName/lastName/avatar values.
      storeUserProfile(user);
      return { data: { user }, error: null };
    } catch (error: unknown) {
      return { data: { user: null }, error: { message: errorMessage(error) } };
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
      const bodyRecord = asRecord(body);
      const nested = nestedRecord(bodyRecord, 'data');
      if (!res.ok) {
        return {
          data: { user: null, session: null },
          error: { message: apiMessage(body, 'Login failed'), status: res.status },
        };
      }
      const access = asString(bodyRecord?.access_token) ?? asString(bodyRecord?.token) ?? asString(nested?.access_token);
      const refresh = asString(bodyRecord?.refresh_token) ?? asString(nested?.refresh_token) ?? '';
      if (access) {
        storeTokens(access, refresh);
        storeUserProfile(bodyRecord?.user ?? nested?.user ?? null);
        const session = buildSession();
        notifyAuthCallbacks('SIGNED_IN');
        return { data: { user: session?.user, session }, error: null };
      }
      return { data: { user: null, session: null }, error: { message: 'No token in response' } };
    } catch (error: unknown) {
      return { data: { user: null, session: null }, error: { message: errorMessage(error) } };
    }
  },

  async signUp({ email, password, options }: { email: string; password: string; options?: SignUpOptions }) {
    try {
      const payload: UnknownRecord = { email, password };
      if (options?.data) {
        payload.metadata = options.data;
        // Spread fields the backend RegisterRequest reads at the top level
        // (otherwise they stay nested in metadata and are ignored — breaking
        // referral bonuses and UTM attribution).
        if (options.data.full_name) payload.full_name = options.data.full_name;
        if (options.data.phone) payload.phone = options.data.phone;
        if (options.data.referral_code) payload.referral_code = options.data.referral_code;
        if (options.data.utm_source) payload.utm_source = options.data.utm_source;
        if (options.data.utm_medium) payload.utm_medium = options.data.utm_medium;
        if (options.data.utm_campaign) payload.utm_campaign = options.data.utm_campaign;
      }
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await safeJson(res);
      const bodyRecord = asRecord(body);
      const nested = nestedRecord(bodyRecord, 'data');
      if (!res.ok) {
        return {
          data: { user: null, session: null },
          error: { message: apiMessage(body, 'Registration failed'), status: res.status },
        };
      }
      const access = asString(bodyRecord?.access_token) ?? asString(bodyRecord?.token) ?? asString(nested?.access_token);
      const refresh = asString(bodyRecord?.refresh_token) ?? asString(nested?.refresh_token) ?? '';
      if (access) {
        storeTokens(access, refresh);
        storeUserProfile(bodyRecord?.user ?? nested?.user ?? null);
        const session = buildSession();
        notifyAuthCallbacks('SIGNED_IN');
        return { data: { user: session?.user, session }, error: null };
      }
      // Some flows don't return a token (email confirmation required)
      const user = toUser(bodyRecord?.user ?? nested?.user ?? null);
      return { data: { user, session: null }, error: null };
    } catch (error: unknown) {
      return { data: { user: null, session: null }, error: { message: errorMessage(error) } };
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

  async signInWithOAuth({ provider, options }: { provider: string; options?: OAuthOptions }) {
    const redirectTo = options?.redirectTo ?? window.location.origin;
    window.location.href = `${API_BASE}/auth/oauth/${provider}?redirect_to=${encodeURIComponent(redirectTo)}`;
    return { data: { provider, url: `${API_BASE}/auth/oauth/${provider}` }, error: null };
  },

  async resetPasswordForEmail(email: string, _options?: PasswordResetOptions) {
    try {
      const res = await fetch(`${API_BASE}/auth/send-reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        return { data: null, error: { message: apiMessage(body, 'Failed') } };
      }
      return { data: body, error: null };
    } catch (error: unknown) {
      return { data: null, error: { message: errorMessage(error) } };
    }
  },

  async updateUser(attributes: UnknownRecord) {
    try {
      const res = await apiFetch(`${API_BASE}/users/me`, {
        method: 'PATCH',
        body: JSON.stringify(attributes),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        return { data: { user: null }, error: { message: apiMessage(body, 'Update failed') } };
      }
      const bodyRecord = asRecord(body);
      return { data: { user: toUser(bodyRecord?.data ?? bodyRecord?.user ?? body) }, error: null };
    } catch (error: unknown) {
      return { data: { user: null }, error: { message: errorMessage(error) } };
    }
  },
};

// ─── Query Builder ──────────────────────────────────────────────────────────

type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'contains' | 'cs' | 'cd' | 'not' | 'fts' | 'or';

interface QueryFilter {
  column: string;
  operator: FilterOperator;
  value: unknown;
  negate?: boolean;
}

type MutableRow = Record<string, unknown>;

// Tables where the `role` column is stored UPPERCASE in DB (Java enum) but
// frontend code compares lowercase. We transparently uppercase outgoing filter
// values and lowercase incoming row values so existing comparisons keep working.
// In the actual DB:
//   - user_roles.role  is UPPERCASE  (PATIENT, DOCTOR, CLINIC_ADMIN, SUPER_ADMIN)
//   - clinic_members.role is lowercase (patient, doctor, manager, ...)
// So only user_roles needs case normalization. Mapping both with the same
// convention (as we used to) caused queries on clinic_members.role to miss.
const ROLE_NORMALIZED_TABLES = new Set(['user_roles']);

function normalizeRoleOutgoing(table: string, column: string, value: unknown): unknown {
  if (!ROLE_NORMALIZED_TABLES.has(table)) return value;
  if (column !== 'role') return value;
  if (typeof value === 'string') return value.toUpperCase();
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'string' ? v.toUpperCase() : v));
  }
  return value;
}

// Backend serializes JSONB columns as { type: 'jsonb', value: '<stringified-json>', null: bool }
// instead of returning the parsed JSON directly. Recursively unwrap so callers see
// plain values everywhere (objects, arrays, primitives).
function unwrapJsonb(node: unknown): unknown {
  if (node == null || typeof node !== 'object') return node;

  // The wrapper itself
  if (
    Object.prototype.hasOwnProperty.call(node, 'type') &&
    Object.prototype.hasOwnProperty.call(node, 'value') &&
    isRecord(node) && node.type === 'jsonb'
  ) {
    if (node.null === true) return null;
    if (typeof node.value === 'string') {
      try {
        return unwrapJsonb(JSON.parse(node.value));
      } catch {
        return node.value;
      }
    }
    return unwrapJsonb(node.value);
  }

  if (Array.isArray(node)) return node.map(unwrapJsonb);

  const out: UnknownRecord = {};
  for (const [k, v] of Object.entries(node)) out[k] = unwrapJsonb(v);
  return out;
}

function normalizeRoleIncoming<T>(table: string, row: T): T {
  if (!ROLE_NORMALIZED_TABLES.has(table)) return row;
  if (!row || typeof row !== 'object') return row;
  if (Array.isArray(row)) return row.map((item) => normalizeRoleIncoming(table, item)) as T;
  if (isRecord(row) && typeof row.role === 'string') {
    return { ...row, role: row.role.toLowerCase() } as T;
  }
  return row;
}

// Parse Supabase-style embedded resource syntax inside select:
//   "alias:targetTable!fkConstraint(col1, col2)"   or
//   "alias:targetTable(col1, col2)"                or
//   "targetTable(col1, col2)"
// Returns the cleaned base select (relations stripped) plus a list of relations
// to fetch separately and merge onto each row.
interface EmbeddedRel {
  alias: string;          // the property name on the row (e.g. "profile" or "profiles")
  target: string;         // related table name
  fkColumn: string | null; // FK column on the parent row, e.g. "user_id" or "clinic_id"
  cols: string;            // comma-separated columns to fetch (or "*")
  multi: boolean;          // foreign-side: list of children referencing parent.id
}

function parseEmbeddedSelect(table: string, raw: string | null) {
  if (!raw || !raw.includes('(')) return { base: raw, rels: [] as EmbeddedRel[] };
  const out: EmbeddedRel[] = [];
  const s = raw.replace(/\s+/g, ' ').trim();
  // Find groups like X(Y) at top level (no nested support beyond depth-1)
  const matches: { start: number; end: number; head: string; body: string }[] = [];
  let depth = 0;
  let i = 0;
  let groupStart = -1;
  let headStart = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '(') {
      if (depth === 0) {
        // determine head — go back to last comma or start
        let j = i - 1;
        while (j >= 0 && s[j] !== ',' && s[j] !== '\n') j--;
        headStart = j + 1;
        groupStart = i;
      }
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0 && groupStart !== -1) {
        const head = s.substring(headStart, groupStart).trim();
        const body = s.substring(groupStart + 1, i).trim();
        matches.push({ start: headStart, end: i + 1, head, body });
        groupStart = -1;
      }
    }
    i++;
  }
  if (matches.length === 0) return { base: raw, rels: [] as EmbeddedRel[] };

  // Build relations + cleaned select
  const baseParts: string[] = [];
  let cursor = 0;
  for (const m of matches) {
    const before = s.substring(cursor, m.start);
    if (before) baseParts.push(before);
    cursor = m.end;
    // also skip a trailing comma right after the relation if present
    // parse head: "alias:target!fk" or "alias:target" or "target"
    let alias: string;
    let target: string;
    let fkRaw: string | null = null;
    const aliasIdx = m.head.indexOf(':');
    if (aliasIdx >= 0) {
      alias = m.head.substring(0, aliasIdx).trim();
      const rest = m.head.substring(aliasIdx + 1).trim();
      const bangIdx = rest.indexOf('!');
      if (bangIdx >= 0) {
        target = rest.substring(0, bangIdx).trim();
        fkRaw = rest.substring(bangIdx + 1).trim();
      } else {
        target = rest;
      }
    } else {
      const bangIdx = m.head.indexOf('!');
      if (bangIdx >= 0) {
        target = m.head.substring(0, bangIdx).trim();
        fkRaw = m.head.substring(bangIdx + 1).trim();
        alias = target;
      } else {
        target = m.head;
        alias = target;
      }
    }
    // Infer fk column on parent row (many-to-one case):
    //   - If alias hints "user_id"/"clinic_id" via the alias name (e.g. "profiles:user_id (...)"),
    //     PostgREST treats the colon as alias:column, where "user_id" IS the FK column.
    //   - Otherwise infer from constraint name like "<parent>_<col>_fkey" → col.
    //   - Otherwise default by alias singular: profiles → user_id, clinics → clinic_id, etc.
    let fkColumn: string | null = null;
    let multi = false;
    if (fkRaw) {
      // pattern: <parentTable>_<col>_fkey  or just <col>
      const fkMatch = fkRaw.match(/^(.+?)_(.+?)_fkey$/);
      if (fkMatch) {
        // If parent matches our table, FK column is on us → many-to-one
        if (fkMatch[1] === table) {
          fkColumn = fkMatch[2];
        } else {
          // FK constraint references our table.id → one-to-many (children)
          multi = true;
          fkColumn = fkMatch[2];
        }
      } else {
        fkColumn = fkRaw;
      }
    } else {
      // No "!fk" hint — try the alias-as-column convention
      // "profiles:user_id" parses as alias=profiles, target=user_id (wrong!).
      // PostgREST actually means: alias=profiles, fk column = user_id, target table inferred (profiles).
      // Detect when "target" looks like a column (contains "_id" or matches our table cols)
      if (/_id$/.test(target)) {
        fkColumn = target;
        target = alias; // alias is actual table name
      } else {
        // default heuristics: strip trailing "s" first, then append "_id".
        //   clinics → clinic_id, doctors → doctor_id, services → service_id, etc.
        const guess = `${target.replace(/s$/, '')}_id`;
        fkColumn = target === 'profiles' ? 'user_id' : guess;
      }
    }
    out.push({ alias, target, fkColumn, cols: m.body || '*', multi });
  }
  const after = s.substring(cursor);
  if (after) baseParts.push(after);

  let base = baseParts.join('').replace(/,\s*,/g, ',').replace(/^\s*,|,\s*$/g, '').trim();
  // Ensure FK columns are present in select (so we can join on them)
  if (base && !base.includes('*')) {
    const have = new Set(base.split(',').map((x) => x.trim()).filter(Boolean));
    for (const rel of out) {
      if (rel.fkColumn && !rel.multi) have.add(rel.fkColumn);
    }
    base = Array.from(have).join(', ');
  }
  return { base: base || '*', rels: out };
}

// Exact column-presence check on a PostgREST select list. Must NOT be a substring
// match: `"full_name,video_url".includes('id')` is false but `"provider_id,name"
// .includes('id')` is true even though the `id` column itself is absent — which used
// to make the embed fetch omit `id`, so the row→child map keyed on `row.id` came back
// all-null (nested doctors→profiles rendered "N/A"). `*` selects everything.
function selectHasColumn(base: string, col: string): boolean {
  if (base.includes('*')) return true;
  return base.split(',').map((c) => c.trim()).includes(col);
}

// Fetch rows where `filterCol IN (values)`, CHUNKED. A single `in.(<all ids>)` URL
// overflows the server's header/URL limit past ~200 ids — the request then fails and
// the whole embed silently becomes null/N-A on large lists (appointments, patients).
// Split into batches and merge; a failed batch drops only its slice, not everything.
async function fetchEmbedInChunks(
  target: string,
  baseSel: string,
  filterCol: string,
  values: unknown[],
): Promise<MutableRow[]> {
  const CHUNK = 100;
  const all: MutableRow[] = [];
  for (let i = 0; i < values.length; i += CHUNK) {
    const slice = values.slice(i, i + CHUNK);
    const url = `${API_BASE}/data/${target}?select=${encodeURIComponent(
      baseSel,
    )}&${filterCol}=in.(${slice.map(String).join(',')})`;
    const resp = await apiFetch(url);
    if (!resp.ok) continue;
    const body = await safeJson(resp);
    const bodyRecord = asRecord(body);
    const candidate = Array.isArray(body) ? body : bodyRecord?.data;
    const list = Array.isArray(candidate) ? candidate.filter(isRecord) : [];
    all.push(...list);
  }
  return all;
}

// Recursively hydrate nested embedded relations for a set of rows. Supports
// depth-N nesting: alias:target(col, child:childTbl(c1, deeper:tbl(...)))
async function hydrateRelations(
  table: string,
  rels: EmbeddedRel[],
  rows: MutableRow[],
): Promise<void> {
  for (const rel of rels) {
    if (rows.length === 0) continue;
    const inner = parseEmbeddedSelect(rel.target, rel.cols);
    if (rel.multi) {
      const parentIds = Array.from(
        new Set(rows.map((r) => r?.id).filter(Boolean)),
      );
      if (parentIds.length === 0) continue;
      const baseSel = selectHasColumn(inner.base, rel.fkColumn as string)
        ? inner.base
        : `${rel.fkColumn},${inner.base}`;
      const children = await fetchEmbedInChunks(
        rel.target,
        baseSel,
        rel.fkColumn as string,
        parentIds,
      );
      // Recurse for inner relations
      if (inner.rels.length > 0 && children.length > 0) {
        await hydrateRelations(rel.target, inner.rels, children);
      }
      const grouped: Record<string, MutableRow[]> = {};
      children.forEach((c) => {
        const k = String(c[rel.fkColumn as string]);
        if (!grouped[k]) grouped[k] = [];
        grouped[k].push(c);
      });
      rows.forEach((r) => {
        r[rel.alias] = grouped[r.id] || [];
      });
    } else if (rel.fkColumn) {
      const fkValues = Array.from(
        new Set(
          rows.map((r) => r?.[rel.fkColumn as string]).filter((v) => v != null),
        ),
      );
      if (fkValues.length === 0) {
        rows.forEach((r) => {
          r[rel.alias] = null;
        });
        continue;
      }
      const baseSel = selectHasColumn(inner.base, 'id') ? inner.base : `id,${inner.base}`;
      const list = await fetchEmbedInChunks(rel.target, baseSel, 'id', fkValues);
      // Recurse for inner relations
      if (inner.rels.length > 0 && list.length > 0) {
        await hydrateRelations(rel.target, inner.rels, list);
      }
      const map: Record<string, MutableRow> = {};
      list.forEach((row) => {
        map[String(row.id)] = row;
      });
      rows.forEach((r) => {
        r[rel.alias] = map[String(r[rel.fkColumn as string])] || null;
      });
    }
  }
}

// The compatibility client accepts arbitrary PostgREST select strings, including
// nested aliases assembled at runtime. Keep that public result as JSON.parse's
// native dynamic JSON type, while all internal network values stay `unknown`
// until they are checked above.
type CompatibilityPayload = ReturnType<typeof JSON.parse>;
type QueryBuilderResult = ApiResult<CompatibilityPayload>;

interface QueryBuilder extends PromiseLike<QueryBuilderResult> {
  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): QueryBuilder;
  insert(data: unknown): QueryBuilder;
  update(data: unknown): QueryBuilder;
  upsert(data: unknown): QueryBuilder;
  delete(): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  neq(column: string, value: unknown): QueryBuilder;
  gt(column: string, value: unknown): QueryBuilder;
  gte(column: string, value: unknown): QueryBuilder;
  lt(column: string, value: unknown): QueryBuilder;
  lte(column: string, value: unknown): QueryBuilder;
  like(column: string, pattern: string): QueryBuilder;
  ilike(column: string, pattern: string): QueryBuilder;
  in(column: string, values: unknown[]): QueryBuilder;
  is(column: string, value: unknown): QueryBuilder;
  contains(column: string, value: unknown): QueryBuilder;
  containedBy(column: string, value: unknown): QueryBuilder;
  not(column: string, operator: string, value: unknown): QueryBuilder;
  or(conditions: string, options?: { foreignTable?: string }): QueryBuilder;
  filter(column: string, operator: string, value: unknown): QueryBuilder;
  textSearch(column: string, query: string, options?: { type?: string; config?: string }): QueryBuilder;
  match(query: UnknownRecord): QueryBuilder;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): QueryBuilder;
  limit(n: number): QueryBuilder;
  range(from: number, to: number): QueryBuilder;
  single(): QueryBuilder;
  maybeSingle(): QueryBuilder;
  head(): QueryBuilder;
  abortSignal(signal: AbortSignal): QueryBuilder;
  csv(): QueryBuilder;
  returns<T = CompatibilityPayload>(): QueryBuilder;
  throwOnError(): Promise<QueryBuilderResult>;
}

function createQueryBuilder<Table extends string>(table: Table): QueryBuilder {
  let method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'GET';
  let selectColumns: string | null = null;
  const filters: QueryFilter[] = [];
  const orderClauses: { column: string; ascending: boolean; nullsFirst?: boolean }[] = [];
  let limitValue: number | null = null;
  let rangeFrom: number | null = null;
  let rangeTo: number | null = null;
  let bodyData: unknown = null;
  let isSingle = false;
  let isMaybeSingle = false;
  let isCount = false;
  let headOnly = false;
  let orConditions: string | null = null;
  // Tracks whether select() was chained after a write (insert/update/upsert);
  // sends Prefer: return=representation so the server includes the touched row.
  let prefersReturn: 'representation' | null = null;

  // Pre-computed embedded-resource info (lazy on first buildUrl)
  let __embedRels: EmbeddedRel[] | null = null;

  function buildUrl(): string {
    const params = new URLSearchParams();

    if (selectColumns) {
      const parsed = parseEmbeddedSelect(table, selectColumns);
      __embedRels = parsed.rels;
      params.set('select', parsed.base || '*');
    } else {
      __embedRels = [];
    }

    for (const f of filters) {
      const fv = normalizeRoleOutgoing(table, f.column, f.value);
      if (f.operator === 'or') {
        params.set('or', fv);
      } else if (f.operator === 'in') {
        // PostgREST expects in.(v1,v2,...) with raw values for primitives —
        // UUIDs/numbers must be unquoted; only objects need JSON serialization.
        const serialize = (v: unknown) =>
          v && typeof v === 'object' ? JSON.stringify(v) : String(v);
        const vals = Array.isArray(fv) ? fv.map(serialize).join(',') : fv;
        params.set(f.column, `${f.negate ? 'not.' : ''}in.(${vals})`);
      } else if (f.operator === 'is') {
        params.set(f.column, `${f.negate ? 'not.' : ''}is.${fv}`);
      } else if (f.operator === 'contains' || f.operator === 'cs') {
        const val = typeof fv === 'object' ? JSON.stringify(fv) : fv;
        params.set(f.column, `${f.negate ? 'not.' : ''}cs.${val}`);
      } else if (f.operator === 'cd') {
        const val = typeof fv === 'object' ? JSON.stringify(fv) : fv;
        params.set(f.column, `${f.negate ? 'not.' : ''}cd.${val}`);
      } else if (f.operator === 'fts') {
        params.set(f.column, `${f.negate ? 'not.' : ''}fts.${fv}`);
      } else if (f.operator === 'not') {
        // .not(column, operator, value) already decomposed
        params.set(f.column, `not.${fv}`);
      } else {
        params.set(f.column, `${f.negate ? 'not.' : ''}${f.operator}.${fv}`);
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
    // head:true only needs the Content-Range total, not the rows — cap at 1 so a count
    // query doesn't drag the whole table back over the wire.
    if (headOnly && limitValue === null && rangeFrom === null) {
      params.set('limit', '1');
    }

    const qs = params.toString();
    return `${API_BASE}/data/${table}${qs ? '?' + qs : ''}`;
  }

  async function execute(): Promise<QueryBuilderResult> {
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
      if (prefersReturn) {
        fetchOptions.headers = {
          ...(fetchOptions.headers || {}),
          Prefer: `return=${prefersReturn}`,
        };
      }

      const res = await apiFetch(url, fetchOptions);
      const body = await safeJson(res);

      if (!res.ok) {
        const bodyRecord = asRecord(body);
        return makeResult(
          null,
          {
            message: apiMessage(body, res.statusText),
            details: bodyRecord?.details,
            code: asString(bodyRecord?.code),
          },
          res.status,
          res.statusText,
        );
      }

      // Extract data — backend may wrap in { data, count } or return array directly
      let data: unknown = body;
      let count: number | null = null;

      const bodyRecord = asRecord(body);
      if (bodyRecord && 'data' in bodyRecord) {
        data = bodyRecord.data;
        const rawCount = bodyRecord.count ?? bodyRecord.total;
        count = typeof rawCount === 'number' ? rawCount : null;
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

      // Backend wraps JSONB columns as { type: 'jsonb', value: '<stringified>', null: bool }
      // Recursively unwrap them so callers see plain JSON values.
      data = unwrapJsonb(data);

      // Normalize role casing on response (UPPERCASE in DB → lowercase to match frontend)
      data = normalizeRoleIncoming(table, data);

      // Hydrate embedded resources (Supabase-style nested selects), recursively
      // for any depth of nested groups: alias:target(col, child:childTbl(...)).
      if (__embedRels && __embedRels.length > 0 && data) {
        const candidates = Array.isArray(data) ? data : [data];
        const rows = candidates.filter(isRecord);
        if (rows.length > 0) {
          await hydrateRelations(table, __embedRels, rows);
        }
        if (!Array.isArray(data) && rows.length > 0) data = rows[0];
      }

      return makeResult(data as CompatibilityPayload, null, res.status, res.statusText, count);
    } catch (error: unknown) {
      return makeResult(null, { message: errorMessage(error) }, 0, 'Network Error');
    }
  }

  const builder: QueryBuilder = {
    select(columns?: string, options?: { count?: 'exact'; head?: boolean }) {
      // .select() chained after .insert/.update/.upsert/.delete should NOT
      // downgrade the method to GET — it just declares which columns the
      // server should return for the write. Treat it as method-changing only
      // when no other method has been set yet.
      if (method == null || method === 'GET') {
        method = 'GET';
        // Supabase passes count/head as the second select() argument. Keep these
        // read-only so insert/update/upsert/delete().select() preserves the
        // existing return=representation write chain.
        isCount = options?.count === 'exact';
        headOnly = options?.head === true;
      } else {
        // Ask backend to return the inserted/updated row (matches Supabase's
        // Prefer: return=representation behavior).
        prefersReturn = 'representation';
      }
      selectColumns = columns ?? '*';
      return builder;
    },
    insert(data: unknown) {
      method = 'POST';
      bodyData = data;
      return builder;
    },
    update(data: unknown) {
      method = 'PATCH';
      bodyData = data;
      return builder;
    },
    upsert(data: unknown) {
      method = 'PUT';
      bodyData = data;
      return builder;
    },
    delete() {
      method = 'DELETE';
      return builder;
    },

    // Filters
    eq(column: string, value: unknown) {
      filters.push({ column, operator: 'eq', value });
      return builder;
    },
    neq(column: string, value: unknown) {
      filters.push({ column, operator: 'neq', value });
      return builder;
    },
    gt(column: string, value: unknown) {
      filters.push({ column, operator: 'gt', value });
      return builder;
    },
    gte(column: string, value: unknown) {
      filters.push({ column, operator: 'gte', value });
      return builder;
    },
    lt(column: string, value: unknown) {
      filters.push({ column, operator: 'lt', value });
      return builder;
    },
    lte(column: string, value: unknown) {
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
    in(column: string, values: unknown[]) {
      filters.push({ column, operator: 'in', value: values });
      return builder;
    },
    is(column: string, value: unknown) {
      filters.push({ column, operator: 'is', value });
      return builder;
    },
    contains(column: string, value: unknown) {
      filters.push({ column, operator: 'contains', value });
      return builder;
    },
    containedBy(column: string, value: unknown) {
      filters.push({ column, operator: 'cd', value });
      return builder;
    },
    not(column: string, operator: string, value: unknown) {
      if (operator === 'in') {
        const serialize = (v: unknown) =>
          v && typeof v === 'object' ? JSON.stringify(v) : String(v);
        const vals = Array.isArray(value) ? value.map(serialize).join(',') : value;
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
    filter(column: string, operator: string, value: unknown) {
      filters.push({ column, operator: operator as FilterOperator, value });
      return builder;
    },
    textSearch(column: string, query: string, { type, config }: { type?: string; config?: string } = {}) {
      const searchType = type === 'plain' ? 'plfts' : type === 'phrase' ? 'phfts' : type === 'websearch' ? 'wfts' : 'fts';
      const configPart = config ? `(${config})` : '';
      filters.push({ column, operator: 'fts', value: `${configPart}${query}` });
      return builder;
    },
    match(query: UnknownRecord) {
      for (const [col, val] of Object.entries(query)) {
        filters.push({ column: col, operator: 'eq', value: val });
      }
      return builder;
    },

    // Modifiers
    order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
      const ascending = options?.ascending ?? true;
      const nullsFirst = options?.nullsFirst;
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
    returns<T = CompatibilityPayload>() {
      return builder;
    },

    // Thenable: allows `await supabase.from('x').select()`
    then<TResult1 = QueryBuilderResult, TResult2 = never>(
      onfulfilled?: ((value: QueryBuilderResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      return execute().then(onfulfilled, onrejected);
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
  'finish-visit': '/appointments/finish',
  'appointment-create': '/appointments/commands/create',
  'appointment-status': '/appointments/commands/status',
  'appointment-cancel': '/appointments/commands/cancel',
  'appointment-place': '/appointments/commands/place',
  'appointment-guest-update': '/appointments/commands/guest/update',
  'appointment-guest-invite': '/appointments/commands/guest/invitation/prepare',
  'clinic-settings-get': '/clinic-settings/commands/get',
  'clinic-settings-set': '/clinic-settings/commands/set',
  'clinic-permission-list': '/clinic-member-permissions/commands/list',
  'clinic-permission-set': '/clinic-member-permissions/commands/set',
  'create-medical-record': '/medical-records',
};

const functions = {
  async invoke<T = CompatibilityPayload>(name: string, options?: { body?: unknown; headers?: Record<string, string> }) {
    const path = EDGE_FUNCTION_MAP[name] ?? `/functions/${name}`;
    try {
      const res = await apiFetch(`${API_BASE}${path}`, {
        method: 'POST',
        body: options?.body ? JSON.stringify(options.body) : undefined,
        headers: options?.headers,
      });
      const body = await safeJson(res);
      if (!res.ok) {
        return { data: null, error: { message: apiMessage(body, res.statusText), status: res.status } };
      }
      const data = responseData(body) as T;
      return { data, error: null };
    } catch (error: unknown) {
      return { data: null, error: { message: errorMessage(error) } };
    }
  },
};

// ─── RPC ─────────────────────────────────────────────────────────────────────

async function rpc<T = CompatibilityPayload>(functionName: string, params?: unknown): Promise<ApiResult<T | null>> {
  try {
    const res = await apiFetch(`${API_BASE}/rpc/${functionName}`, {
      method: 'POST',
      body: params ? JSON.stringify(params) : '{}',
    });
    const body = await safeJson(res);
    if (!res.ok) {
      return makeResult(null, { message: apiMessage(body, res.statusText) }, res.status, res.statusText);
    }
    const data = responseData(body) as T;
    return makeResult(data, null, res.status, res.statusText);
  } catch (error: unknown) {
    return makeResult(null, { message: errorMessage(error) }, 0, 'Network Error');
  }
}

// ─── Realtime (WebSocket with STOMP + polling fallback) ──────────────────────

interface ChannelSubscription {
  event: string;
  schema: string;
  table: string;
  filter?: string;
  callback: (payload: RealtimePayload) => void;
}

interface RealtimePayload extends UnknownRecord {
  eventType?: string;
  new?: CompatibilityPayload;
  old?: CompatibilityPayload;
  schema?: string;
  table?: string;
  commit_timestamp?: string;
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
    callback: (payload: RealtimePayload) => void,
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
      callback: (payload: RealtimePayload) => void,
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
            let payload: unknown;
            const raw = evt.data;

            if (typeof raw === 'string' && raw.startsWith('MESSAGE')) {
              // STOMP frame — extract body after double newline
              const bodyStart = raw.indexOf('\n\n');
              if (bodyStart >= 0) {
                const body = raw.substring(bodyStart + 2).replace(/\0$/, '');
                payload = JSON.parse(body);
              }
            } else if (typeof raw === 'string') {
              payload = JSON.parse(raw);
            }

            const payloadRecord = asRecord(payload);
            if (payloadRecord) {
              for (const sub of channel.subscriptions) {
                const topic = asString(payloadRecord.topic);
                const table = asString(payloadRecord.table) ?? topic?.split('/')?.pop();
                if (!table || table === sub.table) {
                  const eventType = asString(payloadRecord.type)
                    ?? asString(payloadRecord.event)
                    ?? asString(payloadRecord.eventType);
                  if (!sub.event || sub.event === '*' || sub.event === eventType) {
                    sub.callback({
                      eventType: eventType ?? sub.event,
                      new: payloadRecord.new ?? payloadRecord.record ?? payloadRecord.data,
                      old: payloadRecord.old ?? payloadRecord.old_record ?? null,
                      schema: sub.schema,
                      table: sub.table,
                      commit_timestamp: asString(payloadRecord.commit_timestamp) ?? new Date().toISOString(),
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
          const bodyRecord = asRecord(body);
          const candidate = Array.isArray(body) ? body : bodyRecord?.data;
          const rows = Array.isArray(candidate) ? candidate.filter(isRecord) : [];
          for (const row of rows) {
            sub.callback({
              eventType: sub.event === '*' ? 'INSERT' : sub.event,
              new: row,
              old: null,
              schema: sub.schema,
              table: sub.table,
              commit_timestamp: asString(row.created_at) ?? new Date().toISOString(),
            });
          }
          const latestCreatedAt = asString(rows[0]?.created_at);
          if (latestCreatedAt) {
            lastPoll[sub.table] = latestCreatedAt;
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

// ─── Storage (real, backed by /api/v1/storage on Spring) ─────────────────────

function buildSignedUrl(bucket: string, path: string): string {
  const cleanPath = path.replace(/^\/+/, '');
  return `${API_BASE}/storage/${bucket}/${cleanPath}`;
}

const storage = {
  from(bucket: string) {
    return {
      async upload(
        path: string,
        file: File | Blob,
        _options?: StorageUploadOptions,
      ): Promise<{ data: { path: string } | null; error: { message: string } | null }> {
        try {
          const form = new FormData();
          // Some callers pass a Blob with no name — preserve original filename if present.
          const filename = 'name' in file && typeof file.name === 'string'
            ? file.name
            : path.split('/').pop() || 'upload.bin';
          form.append('file', file as Blob, filename);
          if (path) form.append('path', path);

          const token = getAccessToken();
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;
          // Note: do NOT set Content-Type — browser sets the multipart boundary.

          const res = await fetch(`${API_BASE}/storage/${bucket}/upload`, {
            method: 'POST',
            headers,
            body: form,
          });
          const body = await safeJson(res);
          if (!res.ok) {
            return {
              data: null,
              error: { message: apiMessage(body, `Upload failed (${res.status})`) },
            };
          }
          return { data: { path: asString(asRecord(body)?.path) ?? path }, error: null };
        } catch (error: unknown) {
          return { data: null, error: { message: errorMessage(error, 'Network error') } };
        }
      },

      async download(path: string) {
        try {
          const url = buildSignedUrl(bucket, path);
          const token = getAccessToken();
          const res = await fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok) {
            return { data: null, error: { message: `Download failed (${res.status})` } };
          }
          const blob = await res.blob();
          return { data: blob, error: null };
        } catch (error: unknown) {
          return { data: null, error: { message: errorMessage(error, 'Network error') } };
        }
      },

      // URLs never contain bearer tokens. Private objects must be downloaded
      // with storage.download() or another authenticated fetch and rendered
      // through a short-lived local Blob URL.
      getPublicUrl: (path: string) => ({
        data: { publicUrl: buildSignedUrl(bucket, path) },
      }),

      async remove(paths: string[]) {
        try {
          const token = getAccessToken();
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;
          const results = await Promise.all(
            paths.map((p) =>
              fetch(`${API_BASE}/storage/${bucket}/${p.replace(/^\/+/, '')}`, {
                method: 'DELETE',
                headers,
              }).then((r) => r.ok),
            ),
          );
          if (results.every(Boolean)) return { data: { count: results.length }, error: null };
          return { data: null, error: { message: 'Some files were not removed' } };
        } catch (error: unknown) {
          return { data: null, error: { message: errorMessage(error, 'Network error') } };
        }
      },

      async list(_path?: string) {
        // Listing isn't implemented server-side yet (not required by chat
        // attachments). Returning an empty list keeps callers happy.
        return { data: [], error: null };
      },

      async createSignedUrl(path: string, _expiresIn: number) {
        return {
          data: { signedUrl: buildSignedUrl(bucket, path) },
          error: null,
        };
      },

      async createSignedUrls(paths: string[], _expiresIn: number) {
        return {
          data: paths.map((p) => ({ signedUrl: buildSignedUrl(bucket, p), path: p })),
          error: null,
        };
      },
    };
  },
};

// ─── Main export ─────────────────────────────────────────────────────────────

function fromTable<Table extends keyof Database['public']['Tables']>(table: Table): QueryBuilder;
function fromTable(table: string): QueryBuilder;
function fromTable(table: string): QueryBuilder {
  return createQueryBuilder(table);
}

export const supabase = {
  auth,
  functions,
  storage,
  rpc,

  from: fromTable,

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
