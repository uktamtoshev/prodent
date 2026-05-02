import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface VirtualAccount {
  id: string;
  owner_type: 'doctor' | 'clinic';
  doctor_id: string | null;
  clinic_id: string | null;
  balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: string;
  account_id: string;
  transaction_type: 'topup' | 'payment' | 'refund' | 'adjustment';
  amount: number;
  balance_before: number;
  balance_after: number;
  currency: string;
  payment_provider: string | null;
  payment_id: string | null;
  payment_status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  description: string | null;
  created_at: string;
}

interface TopupParams {
  account_id: string;
  amount: number;
  provider: 'payme' | 'click' | 'uzumbank';
}

export function useVirtualAccount(type: 'doctor' | 'clinic', entityId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch or create virtual account
  const { data: account, isLoading: accountLoading, error: accountError } = useQuery({
    queryKey: ['virtual-account', type, entityId],
    queryFn: async () => {
      if (!entityId) return null;

      const query = supabase
        .from('virtual_accounts')
        .select('*');

      if (type === 'doctor') {
        query.eq('doctor_id', entityId);
      } else {
        query.eq('clinic_id', entityId);
      }

      const { data, error } = await query.single();

      if (error) {
        // Account might not exist yet - create it
        if (error.code === 'PGRST116') {
          const insertData = {
            owner_type: type,
            balance: 0,
            currency: 'UZS',
            is_active: true,
            doctor_id: type === 'doctor' ? entityId : null,
            clinic_id: type === 'clinic' ? entityId : null,
          };

          const { data: newAccount, error: createError } = await supabase
            .from('virtual_accounts')
            .insert(insertData)
            .select()
            .single();

          if (createError) {
            console.error('Failed to create virtual account:', createError);
            return null;
          }

          return newAccount as VirtualAccount;
        }
        throw error;
      }

      return data as VirtualAccount;
    },
    enabled: !!entityId && !!user,
  });

  // Fetch transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['virtual-account-transactions', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      const { data, error } = await supabase
        .from('virtual_account_transactions')
        .select('*')
        .eq('account_id', account.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!account?.id,
  });

  // Initiate topup
  const topupMutation = useMutation({
    mutationFn: async (params: TopupParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('payment-topup', {
        body: {
          ...params,
          return_url: window.location.href,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Payment initiation failed');
      }

      return response.data;
    },
    onSuccess: (data) => {
      // Open payment URL in new window
      if (data.payment_url) {
        window.open(data.payment_url, '_blank');
        toast.success('Перенаправление на страницу оплаты...');
      }
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  // Refresh data
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['virtual-account', type, entityId] });
    queryClient.invalidateQueries({ queryKey: ['virtual-account-transactions', account?.id] });
  };

  return {
    account,
    transactions,
    isLoading: accountLoading || transactionsLoading,
    error: accountError,
    topup: topupMutation.mutate,
    isTopupLoading: topupMutation.isPending,
    refresh,
  };
}
