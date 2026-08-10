import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useClinic } from '@/contexts/ClinicContext';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  invalidateClinicServiceQueries,
  setClinicServicesActive,
} from '@/lib/clinic-service-management-api';

interface ServicesMassActionsProps {
  selectedCount: number;
  selectedIds: string[];
  onClearSelection: () => void;
  onDeleteConfirm: () => void;
  canManage?: boolean;
}

export function ServicesMassActions({
  selectedCount,
  selectedIds,
  onClearSelection,
  onDeleteConfirm,
  canManage = true,
}: ServicesMassActionsProps) {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const { canEdit } = useModulePermissions();
  const queryClient = useQueryClient();

  const activateMutation = useMutation({
    mutationFn: async (is_active: boolean) => {
      if (!canEdit('services')) throw new Error(t('crm.accessDenied'));
      if (!currentClinic?.id) throw new Error(t('crmServiceDialogs.noClinicSelected'));
      await setClinicServicesActive(currentClinic.id, selectedIds, is_active);
    },
    onSuccess: (_, is_active) => {
      void invalidateClinicServiceQueries(queryClient);
      toast.success(is_active ? t('managerRole.massServicesActivated') : t('managerRole.massServicesDeactivated'));
      onClearSelection();
    },
    onError: () => {
      toast.error(t('managerRole.massUpdateError'));
    },
  });

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
      <span className="text-sm font-medium">
        {t('managerRole.massSelected')}: <span className="text-primary">{selectedCount}</span>
      </span>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {t('managerRole.massActions')}
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => activateMutation.mutate(true)}
            disabled={activateMutation.isPending}
            className="gap-2"
          >
            <ToggleRight className="w-4 h-4" />
            {t('managerRole.massActivateAll')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => activateMutation.mutate(false)}
            disabled={activateMutation.isPending}
            className="gap-2"
          >
            <ToggleLeft className="w-4 h-4" />
            {t('managerRole.massDeactivateAll')}
          </DropdownMenuItem>
          {canManage && <DropdownMenuSeparator />}
          {canManage && <DropdownMenuItem
            onClick={onDeleteConfirm}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
            {t('managerRole.massDeleteSelected')}
          </DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        className="gap-1"
      >
        <X className="w-4 h-4" />
        {t('managerRole.massClearSelection')}
      </Button>
    </div>
  );
}
