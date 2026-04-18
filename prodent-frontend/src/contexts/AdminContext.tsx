import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface AdminContextType {
  isSuperAdmin: boolean;
  loading: boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        console.log('[AdminContext] No user, setting isSuperAdmin=false');
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      console.log('[AdminContext] Checking admin status for user:', user.id);
      setLoading(true);

      try {
        // Check for super_admin role (DB stores UPPER_CASE from Java enum)
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .or('role.eq.SUPER_ADMIN,role.eq.super_admin')
          .maybeSingle();

        if (error) {
          console.error('[AdminContext] Error checking admin status:', error);
          throw error;
        }

        if (data) {
          console.log('[AdminContext] Super admin role found for user:', user.id);
          setIsSuperAdmin(true);
        } else {
          console.log('[AdminContext] No super_admin role found for user:', user.id);
          setIsSuperAdmin(false);
        }
      } catch (error) {
        console.error('[AdminContext] Failed to verify admin rights:', error);
        setIsSuperAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  return (
    <AdminContext.Provider value={{ isSuperAdmin, loading }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};