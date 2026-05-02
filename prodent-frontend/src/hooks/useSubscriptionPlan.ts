import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { toast } from 'sonner';

export type PlanId = 'basic' | 'standard' | 'gold';
export type EntityType = 'doctor' | 'clinic';

export interface SubscriptionPlan {
  id: string;
  entity_type: EntityType;
  name: string;
  name_ru: string;
  price: number;
  appointment_limit: number | null;
  features: string[];
  has_laboratory: boolean;
  has_finance: boolean;
  has_warehouse: boolean;
  has_analytics: boolean;
  has_badge: boolean;
  has_priority_search: boolean;
  has_special_frame: boolean;
}

export interface AppointmentLimitInfo {
  plan: string;
  count: number;
  limit: number | null;
  can_create: boolean;
  remaining: number | null;
  reset_at: string;
}

export interface PlanFeatures {
  plan_id: string;
  plan_name: string;
  plan_name_ru: string;
  has_laboratory: boolean;
  has_finance: boolean;
  has_warehouse: boolean;
  has_analytics: boolean;
  has_badge: boolean;
  has_priority_search: boolean;
  has_special_frame: boolean;
  expires_at: string | null;
  is_expired: boolean;
}

// Get all subscription plans for an entity type
export function useSubscriptionPlans(entityType: EntityType) {
  return useQuery({
    queryKey: ['subscription-plans', entityType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('entity_type', entityType)
        .order('price', { ascending: true });
      
      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });
}

// Check appointment limit for an entity
export function useAppointmentLimit(entityType: EntityType, entityId: string | undefined) {
  return useQuery({
    queryKey: ['appointment-limit', entityType, entityId],
    queryFn: async () => {
      if (!entityId) return null;
      
      const { data, error } = await supabase.rpc('check_appointment_limit', {
        p_entity_type: entityType,
        p_entity_id: entityId,
      });
      
      if (error) throw error;
      return data as unknown as AppointmentLimitInfo;
    },
    enabled: !!entityId,
    refetchInterval: 60000, // Refresh every minute
  });
}

// Get plan features for an entity
export function usePlanFeatures(entityType: EntityType, entityId: string | undefined) {
  return useQuery({
    queryKey: ['plan-features', entityType, entityId],
    queryFn: async () => {
      if (!entityId) return null;
      
      const { data, error } = await supabase.rpc('get_plan_features', {
        p_entity_type: entityType,
        p_entity_id: entityId,
      });
      
      if (error) throw error;
      return data as unknown as PlanFeatures;
    },
    enabled: !!entityId,
  });
}

// Subscribe to a plan
export function useSubscribeToPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
      planId,
      price,
      virtualAccountId,
      currentBalance,
    }: {
      entityType: EntityType;
      entityId: string;
      planId: string;
      price: number;
      virtualAccountId: string;
      currentBalance: number;
    }) => {
      if (price > currentBalance) {
        throw new Error('Недостаточно средств на балансе');
      }

      // Deduct from balance
      const newBalance = currentBalance - price;
      const { error: balanceError } = await supabase
        .from('virtual_accounts')
        .update({ balance: newBalance })
        .eq('id', virtualAccountId);
      
      if (balanceError) throw balanceError;

      // Create transaction
      const { error: txError } = await supabase
        .from('virtual_account_transactions')
        .insert({
          account_id: virtualAccountId,
          transaction_type: 'payment',
          amount: price,
          balance_before: currentBalance,
          balance_after: newBalance,
          payment_status: 'completed',
          description: `Подписка на план: ${planId}`,
        });

      if (txError) throw txError;

      // Calculate expiration (1 month from now)
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      // Map plan ID to DB enum value
      const dbPlanValue = planId === 'basic' ? 'free' : planId === 'standard' ? 'premium' : 'top';

      // Update entity subscription
      if (entityType === 'doctor') {
        const { error: updateError } = await supabase
          .from('doctors')
          .update({
            subscription_plan: dbPlanValue,
            subscription_expires_at: expiresAt.toISOString(),
          })
          .eq('id', entityId);
        
        if (updateError) throw updateError;
      } else {
        const { error: updateError } = await supabase
          .from('clinics')
          .update({
            subscription_plan: dbPlanValue,
            subscription_expires_at: expiresAt.toISOString(),
          })
          .eq('id', entityId);
        
        if (updateError) throw updateError;
      }

      return { planId, expiresAt };
    },
    onSuccess: (_, variables) => {
      toast.success('Подписка успешно оформлена!');
      queryClient.invalidateQueries({ queryKey: ['virtual-account'] });
      queryClient.invalidateQueries({ queryKey: ['plan-features', variables.entityType, variables.entityId] });
      queryClient.invalidateQueries({ queryKey: ['appointment-limit', variables.entityType, variables.entityId] });
      queryClient.invalidateQueries({ queryKey: ['doctor-by-user'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-subscription'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Check if a feature is available for the current plan
export function hasFeature(features: PlanFeatures | null | undefined, feature: keyof PlanFeatures): boolean {
  if (!features) return false;
  return !!features[feature];
}
