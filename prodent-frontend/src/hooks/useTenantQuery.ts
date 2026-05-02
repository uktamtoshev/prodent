import { useClinic } from '@/contexts/ClinicContext';
import { supabase } from '@/integrations/api/client';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';

/**
 * Hook for tenant-aware data fetching
 * Automatically includes clinic_id filter in queries
 */
export function useTenantQuery<T>(
  queryKey: string[],
  queryFn: (clinicId: string) => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>
) {
  const { currentClinic, loading: clinicLoading } = useClinic();

  return useQuery<T, Error>({
    queryKey: [...queryKey, currentClinic?.id],
    queryFn: () => {
      if (!currentClinic?.id) {
        throw new Error('No clinic selected');
      }
      return queryFn(currentClinic.id);
    },
    enabled: !clinicLoading && !!currentClinic?.id && (options?.enabled !== false),
    ...options,
  });
}

/**
 * Get current clinic ID for use in mutations and other operations
 */
export function useCurrentClinicId() {
  const { currentClinic } = useClinic();
  return currentClinic?.id || null;
}

/**
 * Helper to build clinic-filtered Supabase queries
 */
export function withClinicFilter<T extends { clinic_id: string }>(
  query: any,
  clinicId: string | null
) {
  if (!clinicId) {
    throw new Error('No clinic selected');
  }
  return query.eq('clinic_id', clinicId);
}
