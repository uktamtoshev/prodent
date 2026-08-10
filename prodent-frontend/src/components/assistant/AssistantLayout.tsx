import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';
import { AssistantSidebar } from './AssistantSidebar';
import { RoleCabinetShell } from '@/components/shared/RoleCabinetShell';

interface AssistantLayoutProps {
  children: ReactNode;
}

export const AssistantLayout = ({ children }: AssistantLayoutProps) => {
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
      // Check user_roles table
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const hasRoleAccess = roles?.some(r => r.role === 'assistant' || r.role === 'super_admin');

      if (hasRoleAccess) {
        setHasAccess(true);
        setIsChecking(false);
        return;
      }

      // Check clinic_members table
      let membershipQuery = supabase
        .from('clinic_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (currentClinic?.id) {
        membershipQuery = membershipQuery.eq('clinic_id', currentClinic.id);
      }
      const { data: membership } = await membershipQuery;

      const hasMemberAccess = membership?.some(m => m.role === 'assistant');

      if (!hasMemberAccess) {
        toast({
          title: 'Доступ запрещён',
          description: 'Только для ассистентов',
          variant: 'destructive',
        });
      }

      setHasAccess(!!hasMemberAccess);
    } catch (error) {
      console.error('Error checking access:', error);
    } finally {
      setIsChecking(false);
    }
  }, [currentClinic?.id, toast, user]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  if (isChecking) {
    return <RoleCabinetShell sidebar={<AssistantSidebar />} isLoading />;
  }

  if (!user || !hasAccess) {
    return <Navigate to="/" replace />;
  }

  return <RoleCabinetShell sidebar={<AssistantSidebar />}>{children}</RoleCabinetShell>;
};
