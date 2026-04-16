import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AddOnService {
  id: string;
  name: string;
  name_uz: string | null;
  name_en: string | null;
  description: string | null;
  description_uz: string | null;
  description_en: string | null;
  service_type: 'badge' | 'search_promotion' | 'profile_frame';
  target_type: 'doctor' | 'clinic';
  icon: string;
  color: string;
  bg_color: string;
  is_active: boolean;
}

export interface AddOnPricing {
  id: string;
  add_on_id: string;
  duration_days: number;
  price: number;
  is_active: boolean;
}

export interface AddOnPurchase {
  id: string;
  add_on_id: string;
  doctor_id: string | null;
  clinic_id: string | null;
  start_date: string;
  end_date: string;
  price_paid: number;
  duration_days: number;
  is_active: boolean;
  add_on_services?: AddOnService;
}

export interface ActiveAddOn {
  add_on_id: string;
  service_type: string;
  name: string;
  icon: string;
  color: string;
  bg_color: string;
  end_date: string;
}

export interface EntityBadge {
  badge_name: string;
  badge_icon: string;
  badge_color: string;
  badge_bg_color: string;
}

// Fetch all available add-on services by target type
export const useAddOnServices = (targetType: 'doctor' | 'clinic') => {
  return useQuery({
    queryKey: ['add-on-services', targetType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('add_on_services')
        .select('*')
        .eq('target_type', targetType)
        .eq('is_active', true);
      
      if (error) throw error;
      return data as AddOnService[];
    },
  });
};

// Fetch pricing for an add-on
export const useAddOnPricing = (addOnId: string | null) => {
  return useQuery({
    queryKey: ['add-on-pricing', addOnId],
    queryFn: async () => {
      if (!addOnId) return [];
      const { data, error } = await supabase
        .from('add_on_pricing')
        .select('*')
        .eq('add_on_id', addOnId)
        .eq('is_active', true)
        .order('duration_days', { ascending: true });
      
      if (error) throw error;
      return data as AddOnPricing[];
    },
    enabled: !!addOnId,
  });
};

// Fetch active add-on purchases for an entity
export const useActiveAddOns = (entityType: 'doctor' | 'clinic', entityId: string | undefined) => {
  return useQuery({
    queryKey: ['active-add-ons', entityType, entityId],
    queryFn: async () => {
      if (!entityId) return [];
      
      // First expire old purchases
      await supabase.rpc('expire_add_on_purchases');
      
      const { data, error } = await supabase
        .rpc('get_active_add_ons', {
          p_entity_type: entityType,
          p_entity_id: entityId,
        });
      
      if (error) throw error;
      return (data || []) as ActiveAddOn[];
    },
    enabled: !!entityId,
    staleTime: 0,
    refetchOnMount: true,
  });
};

// Check if entity has active add-on of specific type
export const useHasActiveAddOn = (
  entityType: 'doctor' | 'clinic', 
  entityId: string | undefined, 
  serviceType: 'badge' | 'search_promotion' | 'profile_frame'
) => {
  const { data: activeAddOns } = useActiveAddOns(entityType, entityId);
  
  if (!activeAddOns) return false;
  return activeAddOns.some(addon => addon.service_type === serviceType);
};

// Get remaining days for an active add-on
export const useAddOnRemainingDays = (
  entityType: 'doctor' | 'clinic',
  entityId: string | undefined,
  serviceType: 'badge' | 'search_promotion' | 'profile_frame'
) => {
  return useQuery({
    queryKey: ['add-on-remaining-days', entityType, entityId, serviceType],
    queryFn: async () => {
      if (!entityId) return null;
      
      const { data, error } = await supabase
        .rpc('get_add_on_remaining_days', {
          p_entity_type: entityType,
          p_entity_id: entityId,
          p_service_type: serviceType,
        });
      
      if (error) throw error;
      return data as number | null;
    },
    enabled: !!entityId,
  });
};

// Get entity badges for display
export const useEntityBadges = (entityType: 'doctor' | 'clinic', entityId: string | undefined) => {
  return useQuery({
    queryKey: ['entity-badges', entityType, entityId],
    queryFn: async () => {
      if (!entityId) return [];
      
      const { data, error } = await supabase
        .rpc('get_entity_badges', {
          p_entity_type: entityType,
          p_entity_id: entityId,
        });
      
      if (error) throw error;
      return (data || []) as EntityBadge[];
    },
    enabled: !!entityId,
  });
};

// Check if can purchase add-on (prevents duplicate badges of different types)
interface CanPurchaseResponse {
  can_purchase: boolean; 
  reason: string | null; 
  existing_end_date: string | null;
  service_type: string;
}

export const useCanPurchaseAddOn = (
  addOnId: string | null,
  entityType: 'doctor' | 'clinic',
  entityId: string | undefined
) => {
  return useQuery({
    queryKey: ['can-purchase-add-on', addOnId, entityType, entityId],
    queryFn: async (): Promise<CanPurchaseResponse> => {
      if (!addOnId || !entityId) return { can_purchase: true, reason: null, existing_end_date: null, service_type: '' };
      
      const { data, error } = await supabase
        .rpc('can_purchase_add_on', {
          p_add_on_id: addOnId,
          p_entity_type: entityType,
          p_entity_id: entityId,
        });
      
      if (error) throw error;
      return data as unknown as CanPurchaseResponse;
    },
    enabled: !!addOnId && !!entityId,
  });
};

// Purchase an add-on (with extension support)
export const usePurchaseAddOn = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      addOnId,
      entityType,
      entityId,
      durationDays,
      price,
      virtualAccountId,
    }: {
      addOnId: string;
      entityType: 'doctor' | 'clinic';
      entityId: string;
      durationDays: number;
      price: number;
      virtualAccountId: string;
    }) => {
      // 1. Check if can purchase
      interface CanPurchaseResult {
        can_purchase: boolean;
        reason: string | null;
        existing_end_date: string | null;
        service_type: string;
      }
      
      const { data: canPurchaseData, error: checkError } = await supabase
        .rpc('can_purchase_add_on', {
          p_add_on_id: addOnId,
          p_entity_type: entityType,
          p_entity_id: entityId,
        });
      
      if (checkError) throw checkError;
      
      const canPurchase: CanPurchaseResult = canPurchaseData as unknown as CanPurchaseResult;
      
      if (!canPurchase.can_purchase) {
        throw new Error(canPurchase.reason || 'Нельзя приобрести эту услугу');
      }

      // 2. Check balance
      const { data: account, error: accountError } = await supabase
        .from('virtual_accounts')
        .select('balance')
        .eq('id', virtualAccountId)
        .single();
      
      if (accountError) throw accountError;
      if ((account?.balance || 0) < price) {
        throw new Error('Недостаточно средств на балансе');
      }

      // 3. Get add-on name for transaction description
      const { data: addOn, error: addOnError } = await supabase
        .from('add_on_services')
        .select('name')
        .eq('id', addOnId)
        .single();
      
      if (addOnError) throw addOnError;

      const balanceBefore = account.balance || 0;
      const balanceAfter = balanceBefore - price;
      const isExtension = canPurchase.reason === 'extend';

      // 4. Deduct balance
      const { error: balanceError } = await supabase
        .from('virtual_accounts')
        .update({ balance: balanceAfter })
        .eq('id', virtualAccountId);
      
      if (balanceError) throw balanceError;

      // 5. Create transaction record
      const { data: transaction, error: transactionError } = await supabase
        .from('virtual_account_transactions')
        .insert({
          account_id: virtualAccountId,
          transaction_type: isExtension ? 'addon_extend' : 'addon_purchase',
          amount: -price,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          description: `${isExtension ? 'Продление' : 'Покупка'}: ${addOn.name} на ${durationDays} дней`,
        })
        .select()
        .single();
      
      if (transactionError) throw transactionError;

      // 6. Create or extend purchase using database function
      const { data: resultData, error: purchaseError } = await supabase
        .rpc('extend_add_on_purchase', {
          p_add_on_id: addOnId,
          p_entity_type: entityType,
          p_entity_id: entityId,
          p_additional_days: durationDays,
          p_price: price,
          p_transaction_id: transaction.id,
        });
      
      if (purchaseError) throw purchaseError;
      
      interface PurchaseResult { success: boolean; purchase_id: string; new_end_date: string }
      const result: PurchaseResult = resultData as unknown as PurchaseResult;

      return { success: true, isExtension, newEndDate: result.new_end_date };
    },
    onSuccess: (data) => {
      toast.success(data.isExtension ? 'Услуга успешно продлена!' : 'Услуга успешно активирована!');
      queryClient.invalidateQueries({ queryKey: ['active-add-ons'] });
      queryClient.invalidateQueries({ queryKey: ['virtual-account'] });
      queryClient.invalidateQueries({ queryKey: ['entity-badges'] });
      queryClient.invalidateQueries({ queryKey: ['can-purchase-add-on'] });
      queryClient.invalidateQueries({ queryKey: ['add-on-remaining-days'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка при покупке услуги');
    },
  });
};

// Get all active add-ons for display in search (used by search pages)
export const useAllActiveSearchPromotions = (entityType: 'doctor' | 'clinic') => {
  return useQuery({
    queryKey: ['all-active-search-promotions', entityType],
    queryFn: async () => {
      // Expire old purchases first
      await supabase.rpc('expire_add_on_purchases');
      
      const now = new Date().toISOString();
      
      const query = supabase
        .from('add_on_purchases')
        .select(`
          *,
          add_on_services!inner(service_type)
        `)
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .eq('add_on_services.service_type', 'search_promotion');
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Return set of entity IDs that have active search promotion
      const entityIds = new Set<string>();
      data?.forEach(purchase => {
        if (entityType === 'doctor' && purchase.doctor_id) {
          entityIds.add(purchase.doctor_id);
        } else if (entityType === 'clinic' && purchase.clinic_id) {
          entityIds.add(purchase.clinic_id);
        }
      });
      
      return entityIds;
    },
    staleTime: 60000, // Cache for 1 minute
  });
};

// Get all entities with profile frames (for search display)
export const useAllActiveProfileFrames = (entityType: 'doctor' | 'clinic') => {
  return useQuery({
    queryKey: ['all-active-profile-frames', entityType],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      const query = supabase
        .from('add_on_purchases')
        .select(`
          *,
          add_on_services!inner(service_type)
        `)
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .eq('add_on_services.service_type', 'profile_frame');
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const entityIds = new Set<string>();
      data?.forEach(purchase => {
        if (entityType === 'doctor' && purchase.doctor_id) {
          entityIds.add(purchase.doctor_id);
        } else if (entityType === 'clinic' && purchase.clinic_id) {
          entityIds.add(purchase.clinic_id);
        }
      });
      
      return entityIds;
    },
    staleTime: 60000,
  });
};

// Batch get all entity badges for search results
export const useAllActiveBadges = (entityType: 'doctor' | 'clinic') => {
  return useQuery({
    queryKey: ['all-active-badges', entityType],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      const query = supabase
        .from('add_on_purchases')
        .select(`
          doctor_id,
          clinic_id,
          add_on_services!inner(name, icon, color, bg_color, service_type)
        `)
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .eq('add_on_services.service_type', 'badge');
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Return map of entity ID to badges array
      const badgesMap = new Map<string, EntityBadge[]>();
      data?.forEach(purchase => {
        const entityId = entityType === 'doctor' ? purchase.doctor_id : purchase.clinic_id;
        if (entityId && purchase.add_on_services) {
          const addOnService = purchase.add_on_services as unknown as AddOnService;
          const badge: EntityBadge = {
            badge_name: addOnService.name,
            badge_icon: addOnService.icon,
            badge_color: addOnService.color,
            badge_bg_color: addOnService.bg_color,
          };
          
          if (!badgesMap.has(entityId)) {
            badgesMap.set(entityId, []);
          }
          badgesMap.get(entityId)!.push(badge);
        }
      });
      
      return badgesMap;
    },
    staleTime: 60000,
  });
};
