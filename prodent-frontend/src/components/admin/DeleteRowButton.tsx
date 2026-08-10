import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Trash2, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface DeleteRowButtonProps {
  /** Backend data table to delete from (e.g. 'clinics', 'doctors', 'profiles'). */
  table: string;
  /** Row id to delete. */
  id: string;
  /** Optional human label (clinic/doctor/patient name) shown in the confirm dialog. */
  label?: string;
  /** react-query key prefix to invalidate after a successful delete. */
  invalidateKey: string;
  /** Soft-delete mode: set is_active=false instead of hard-deleting (reversible). */
  deactivate?: boolean;
}

/**
 * Trash button + confirmation dialog for SUPER_ADMIN row deletion in the admin
 * panel. Deletion is ALSO enforced server-side — DataController gates DELETE on
 * clinics/doctors/profiles to SUPER_ADMIN — so this is purely the UI affordance;
 * a non-super-admin who somehow triggers it gets a 403 surfaced as a toast.
 */
export function DeleteRowButton({ table, id, label, invalidateKey, deactivate = false }: DeleteRowButtonProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      // deactivate = soft delete (set is_active=false, reversible); else hard delete.
      const { error } = deactivate
        ? await supabase.from(table).update({ is_active: false }).eq('id', id)
        : await supabase.from(table).delete().eq('id', id);
      if (error) throw new Error(error.message || t('admin.deleteError'));
    },
    onSuccess: () => {
      toast.success(deactivate ? t('admin.deactivateSuccess') : t('admin.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: [invalidateKey] });
      setOpen(false);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t('admin.deleteError'));
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={(v) => !isPending && setOpen(v)}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          aria-label={deactivate ? t('admin.deactivate') : t('admin.delete')}
        >
          {deactivate ? <UserX className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {deactivate ? t('admin.deactivateConfirmTitle') : t('admin.deleteConfirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {label ? (
              <>
                <span className="font-medium text-foreground">{label}</span>
                {' — '}
              </>
            ) : null}
            {deactivate ? t('admin.deactivateConfirmBody') : t('admin.deleteConfirmBody')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t('admin.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              // Keep the dialog open until the mutation resolves.
              e.preventDefault();
              mutate();
            }}
            className={deactivate ? '' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
          >
            {isPending
              ? (deactivate ? t('admin.deactivating') : t('admin.deleting'))
              : (deactivate ? t('admin.deactivate') : t('admin.delete'))}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
