import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// The wallet is USER-scoped on the backend: one virtual_account per user
// (owner_type='USER'), served by /api/v1/payments/{subscription,transactions,topup}.
// A doctor and the clinic they own share this single wallet — top-ups credit it,
// subscriptions and add-ons debit it. The `type`/`entityId` props are kept for
// API-compat with the billing cards but no longer scope a separate account.

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

interface VirtualAccount {
  id: string | null;
  balance: number;
  currency: string;
}

interface Transaction {
  id: string;
  account_id: string;
  transaction_type: string;       // topup | payment | refund (lowercased for UI)
  amount: number;
  balance_after: number;
  payment_provider: string | null;
  payment_status: string;         // completed | pending | ... (lowercased for UI)
  description: string | null;
  created_at: string;
}

interface TopupParams {
  account_id?: string;            // ignored — wallet resolved from JWT
  amount: number;
  provider: 'payme' | 'click' | 'uzumbank' | string;
}

interface TransactionWire {
  id: string;
  account?: { id?: string } | null;
  accountId?: string;
  transactionType?: string;
  transaction_type?: string;
  amount?: number | string;
  balanceAfter?: number | string;
  balance_after?: number | string;
  paymentProvider?: string | null;
  payment_provider?: string | null;
  paymentStatus?: string;
  payment_status?: string;
  description?: string | null;
  createdAt?: string;
  created_at?: string;
}

interface TransactionPage {
  content?: TransactionWire[];
}

interface TopupResponse {
  paymentUrl?: string;
  payment_url?: string;
}

// Backend returns enum-y UPPERCASE values (TOPUP/PAYMENT, COMPLETED/PENDING);
// the wallet UI compares lowercase. Normalize on the way in.
function mapTx(raw: TransactionWire): Transaction {
  return {
    id: raw.id,
    account_id: raw.account?.id ?? raw.accountId ?? '',
    transaction_type: String(raw.transactionType ?? raw.transaction_type ?? '').toLowerCase(),
    amount: Number(raw.amount ?? 0),
    balance_after: Number(raw.balanceAfter ?? raw.balance_after ?? 0),
    payment_provider: raw.paymentProvider ?? raw.payment_provider ?? null,
    payment_status: String(raw.paymentStatus ?? raw.payment_status ?? '').toLowerCase(),
    description: raw.description ?? null,
    created_at: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
  };
}

export function useVirtualAccount(type: 'doctor' | 'clinic', entityId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: account, isLoading: accountLoading, error: accountError } = useQuery({
    queryKey: ['wallet', 'account'],
    queryFn: async (): Promise<VirtualAccount> => {
      const s = await payFetch<{ account_id: string | null; balance: number }>('/subscription');
      return { id: s.account_id, balance: Number(s.balance ?? 0), currency: 'UZS' };
    },
    enabled: !!user,
  });

  /**
   * Операции — ОТДЕЛЬНЫЙ запрос со своим состоянием ошибки.
   *
   * Раньше наружу отдавался только общий `error` от счёта, а отказ запроса
   * операций терялся: список приходил пустым, и экран показывал «Операций
   * пока нет». Это ложь про деньги — пользователь видит спокойное «пусто»
   * там, где на самом деле данные не загрузились. Поэтому ниже возвращаются
   * `transactionsError`, `transactionsLoading` и отдельная перезагрузка.
   */
  const {
    data: transactions,
    isLoading: transactionsLoading,
    isSuccess: transactionsLoaded,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useQuery({
    queryKey: ['wallet', 'transactions'],
    queryFn: async (): Promise<Transaction[]> => {
      const page = await payFetch<TransactionWire[] | TransactionPage>('/transactions?size=50&sort=createdAt,desc');
      const rows = Array.isArray(page) ? page : page.content ?? [];
      return rows.map(mapTx);
    },
    enabled: !!user,
  });

  const topupMutation = useMutation({
    mutationFn: async (params: TopupParams) => {
      const provider = params.provider === 'uzumbank' ? 'uzum' : params.provider;
      return payFetch<TopupResponse>('/topup', {
        method: 'POST',
        body: JSON.stringify({ amount: params.amount, provider }),
      });
    },
    onSuccess: (data) => {
      const url = data?.paymentUrl ?? data?.payment_url;
      if (url) {
        window.open(url, '_blank');
        toast.success('Перенаправление на страницу оплаты...');
      }
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['wallet'] });
    queryClient.invalidateQueries({ queryKey: ['subscription-status'] });
  };

  return {
    account,
    transactions,
    isLoading: accountLoading || transactionsLoading,
    error: accountError,
    /** Ошибка ИМЕННО операций: счёт мог загрузиться, а список — нет. */
    transactionsError,
    transactionsLoading,
    /** true только после успешного ответа: пустой список показываем лишь тогда. */
    transactionsLoaded,
    /** Повтор только операций, без перезапроса всего кошелька. */
    refetchTransactions,
    topup: topupMutation.mutate,
    isTopupLoading: topupMutation.isPending,
    refresh,
  };
}
