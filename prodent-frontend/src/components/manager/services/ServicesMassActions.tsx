import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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

interface ServicesMassActionsProps {
  selectedCount: number;
  selectedIds: string[];
  onClearSelection: () => void;
  onDeleteConfirm: () => void;
}

export function ServicesMassActions({
  selectedCount,
  selectedIds,
  onClearSelection,
  onDeleteConfirm,
}: ServicesMassActionsProps) {
  const queryClient = useQueryClient();

  const activateMutation = useMutation({
    mutationFn: async (is_active: boolean) => {
      const { error } = await supabase
        .from('services')
        .update({ is_active })
        .in('id', selectedIds);
      if (error) throw error;
    },
    onSuccess: (_, is_active) => {
      queryClient.invalidateQueries({ queryKey: ['clinic-services'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success(is_active ? 'Услуги активированы' : 'Услуги деактивированы');
      onClearSelection();
    },
    onError: () => {
      toast.error('Ошибка при обновлении');
    },
  });

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
      <span className="text-sm font-medium">
        Выбрано: <span className="text-primary">{selectedCount}</span>
      </span>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            Действия
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
            Активировать все
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => activateMutation.mutate(false)}
            disabled={activateMutation.isPending}
            className="gap-2"
          >
            <ToggleLeft className="w-4 h-4" />
            Деактивировать все
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={onDeleteConfirm}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
            Удалить выбранные
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onClearSelection}
        className="gap-1"
      >
        <X className="w-4 h-4" />
        Снять выделение
      </Button>
    </div>
  );
}
