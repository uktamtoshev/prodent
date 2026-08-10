import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';
import { ClinicAdminSidebar } from './ClinicAdminSidebar';
import { RoleCabinetShell } from '@/components/shared/RoleCabinetShell';

interface ClinicAdminLayoutProps {
  children: ReactNode;
}

export const ClinicAdminLayout = ({ children }: ClinicAdminLayoutProps) => {
  const { user } = useAuth();
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  const checkAccess = useCallback(async () => {
    if (!user) {
      setIsChecking(false);
      return;
    }

    try {
      // Check user_roles table first
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const hasRoleAccess = roles?.some(r => 
        r.role === 'clinic_admin' || r.role === 'super_admin' || r.role === 'admin'
      );

      if (hasRoleAccess) {
        setHasAccess(true);
        setIsChecking(false);
        return;
      }

      // Also check clinic_members table for clinic_admin role
      let membershipQuery = supabase
        .from('clinic_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (currentClinic?.id) {
        membershipQuery = membershipQuery.eq('clinic_id', currentClinic.id);
      }
      const { data: membership } = await membershipQuery;

      const hasMemberAccess = membership?.some(m => m.role === 'clinic_admin');

      if (hasMemberAccess) {
        setHasAccess(true);
        setIsChecking(false);
        return;
      }

      toast({
        title: 'Доступ запрещён',
        description: 'Только для администраторов клиники',
        variant: 'destructive',
      });
      setHasAccess(false);
    } catch (error) {
      console.error('Error checking access:', error);
      setHasAccess(false);
    } finally {
      setIsChecking(false);
    }
  }, [currentClinic?.id, toast, user]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  if (isChecking) {
    return <RoleCabinetShell sidebar={<ClinicAdminSidebar />} isLoading />;
  }

  if (!user || !hasAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <RoleCabinetShell sidebar={<ClinicAdminSidebar />}>
      {children}
    </RoleCabinetShell>
  );
};
