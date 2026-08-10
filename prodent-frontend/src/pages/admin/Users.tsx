import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Loader2, UserPlus, X, Shield, Search, IdCard } from 'lucide-react';
import { z } from 'zod';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatAccountId } from '@/lib/accountId';
import { UserDetailDialog } from '@/components/admin/UserDetailDialog';
import { useAdmin } from '@/contexts/AdminContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

type AppRole = 'super_admin' | 'admin' | 'moderator' | 'doctor' | 'patient' | 'clinic_admin' | 'assistant' | 'accountant' | 'clinic_manager' | 'seller' | 'technician';

interface UserRole {
  id: string;
  role: AppRole;
  /**
   * Когда роль выдали. В таблице колонка называется granted_at — запрос
   * `created_at` валил весь список пользователей ошибкой 500.
   */
  granted_at: string | null;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  email?: string | null;
  phone?: string | null;
  /** Eight-digit id from `profiles.account_number` (V131); uuid is the fallback. */
  account_number?: string | null;
  created_at: string | null;
  roles: UserRole[];
}

type RawUserProfile = Omit<UserProfile, 'roles'>;
type UserRoleRow = UserRole & { user_id: string };

const messageOf = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const safeSearchTerm = (value: string) => value.trim().replace(/[,%_()\\]/g, ' ');

const roleSchema = z.enum(['super_admin', 'admin', 'moderator', 'doctor', 'patient', 'clinic_admin', 'assistant', 'accountant', 'clinic_manager', 'seller', 'technician']);

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: 'border-destructive/30 bg-destructive/10 text-destructive',
  admin: 'border-primary/30 bg-primary/10 text-primary',
  moderator: 'border-primary/30 bg-primary/10 text-primary',
  doctor: 'border-[hsl(var(--success-green)/0.3)] bg-[hsl(var(--success-green)/0.1)] text-[hsl(var(--success-green))]',
  patient: 'border-border bg-muted text-muted-foreground',
  clinic_admin: 'border-primary/30 bg-primary/10 text-primary',
  assistant: 'border-primary/30 bg-primary/10 text-primary',
  accountant: 'border-warning-amber/30 bg-warning-amber/10 text-warning-amber',
  clinic_manager: 'border-primary/30 bg-primary/10 text-primary',
  seller: 'border-warning-amber/30 bg-warning-amber/10 text-warning-amber',
  technician: 'border-primary/30 bg-primary/10 text-primary',
};

export default function Users() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { isSuperAdmin } = useAdmin();
  const [selectedRole, setSelectedRole] = useState<Record<string, AppRole>>({});
  const [processingUsers, setProcessingUsers] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [detailUser, setDetailUser] = useState<UserProfile | null>(null);
  const [pendingRoleRemoval, setPendingRoleRemoval] = useState<{
    userId: string;
    roleId: string;
    roleName: AppRole;
  } | null>(null);

  const ROLE_LABELS: Record<AppRole, string> = useMemo(() => ({
    super_admin: t('adminUsers.roleSuperAdmin'),
    admin: t('adminUsers.roleAdmin'),
    moderator: t('adminUsers.roleModerator'),
    doctor: t('adminUsers.roleDoctor'),
    patient: t('adminUsers.rolePatient'),
    clinic_admin: t('adminUsers.roleClinicAdmin'),
    assistant: t('adminUsers.roleAssistant'),
    accountant: t('adminUsers.roleAccountant'),
    clinic_manager: t('adminUsers.roleClinicManager'),
    seller: t('adminUsers.roleSeller'),
    technician: t('adminUsers.roleTechnician'),
  }), [t]);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedSearch(search),
      SEARCH_DEBOUNCE_MS,
    );

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const { data: userPage, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users', page, debouncedSearch],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const normalizedSearch = safeSearchTerm(debouncedSearch);

      let primaryQuery = supabase
        .from('profiles')
        .select('id, full_name, email, phone, account_number, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
      if (normalizedSearch) {
        primaryQuery = primaryQuery.or(
          `full_name.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%,phone.ilike.%${normalizedSearch}%,account_number.ilike.%${normalizedSearch}%`,
        );
      }
      const primary = await primaryQuery;
      let profiles = primary.data as RawUserProfile[] | null;
      let total = primary.count ?? 0;

      if (primary.error) {
        let fallbackQuery = supabase
          .from('profiles')
          .select('id, full_name, created_at', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);
        if (normalizedSearch) {
          fallbackQuery = fallbackQuery.or(`full_name.ilike.%${normalizedSearch}%`);
        }
        const fallback = await fallbackQuery;
        if (fallback.error) throw fallback.error;
        profiles = fallback.data as RawUserProfile[] | null;
        total = fallback.count ?? 0;
      }

      const profileRows = profiles || [];
      const profileIds = profileRows.map((profile) => profile.id);
      const roleResult = profileIds.length
        ? await supabase
            .from('user_roles')
            .select('id, role, granted_at, user_id')
            .in('user_id', profileIds)
        : { data: [] as UserRoleRow[], error: null };

      if (roleResult.error) throw roleResult.error;

      const roleRows = (roleResult.data || []) as UserRoleRow[];
      const users: UserProfile[] = profileRows.map((profile) => ({
        ...profile,
        roles: roleRows.filter((role) => role.user_id === profile.id),
      }));
      return { users, total };
    },
  });

  const users = userPage?.users ?? [];
  const totalUsers = userPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));

  const addRole = async (userId: string) => {
    const role = selectedRole[userId];

    if (!role) {
      toast({
        title: t('adminUsers.selectRoleTitle'),
        description: t('adminUsers.selectRoleDesc'),
        variant: 'destructive',
      });
      return;
    }

    // Validate role
    const validation = roleSchema.safeParse(role);
    if (!validation.success) {
      toast({
        title: t('adminUsers.invalidRole'),
        description: t('adminUsers.invalidRoleDesc'),
        variant: 'destructive',
      });
      return;
    }

    setProcessingUsers(prev => new Set(prev).add(userId));

    try {
      // Check if role already exists
      const user = users.find(u => u.id === userId);
      if (user?.roles.some(r => r.role === role)) {
        toast({
          title: t('adminUsers.roleAlreadyAssigned'),
          description: `${t('adminUsers.roleAlreadyAssignedDesc')}${ROLE_LABELS[role]}`,
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: role,
        });

      if (error) throw error;

      toast({
        title: t('adminUsers.roleAdded'),
        description: `${t('adminUsers.roleAddedDesc')}${ROLE_LABELS[role]}${t('adminUsers.roleAddedDescSuffix')}`,
      });

      await refetch();

      // Clear selection
      setSelectedRole(prev => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });
    } catch (error: unknown) {
      console.error('[Users] Error adding role:', error);
      toast({
        title: t('adminUsers.addRoleError'),
        description: messageOf(error, t('adminUsers.addRoleError')),
        variant: 'destructive',
      });
    } finally {
      setProcessingUsers(prev => {
        const updated = new Set(prev);
        updated.delete(userId);
        return updated;
      });
    }
  };

  const removeRole = async (userId: string, roleId: string, roleName: AppRole) => {
    // Ownership changes need an atomic backend operation. This screen must never
    // attempt to remove a super-admin role using a client-side count check.
    if (roleName === 'super_admin') return;

    setProcessingUsers(prev => new Set(prev).add(userId));

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      toast({
        title: t('adminUsers.roleRemoved'),
        description: `${t('adminUsers.roleRemovedDesc')}${ROLE_LABELS[roleName]}${t('adminUsers.roleRemovedDescSuffix')}`,
      });

      await refetch();
    } catch (error: unknown) {
      console.error('[Users] Error removing role:', error);
      toast({
        title: t('adminUsers.removeRoleError'),
        description: messageOf(error, t('adminUsers.removeRoleError')),
        variant: 'destructive',
      });
    } finally {
      setProcessingUsers(prev => {
        const updated = new Set(prev);
        updated.delete(userId);
        return updated;
      });
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div
          className="flex min-h-[400px] items-center justify-center"
          role="status"
          aria-live="polite"
          aria-label={`${t('common.loading')} ${t('adminUsers.cardTitle')}`}
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('adminUsers.title')}</h1>
          <p className="text-muted-foreground">{t('adminUsers.subtitle')}</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5" aria-hidden="true" />
              {t('adminUsers.cardTitle')}
            </CardTitle>
            <CardDescription>
              {t('adminUsers.totalUsers')}{totalUsers}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder={t('adminUsers.searchPlaceholder')}
                aria-label={t('adminUsers.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-h-11 max-w-full border-border bg-card pl-10 text-foreground"
              />
            </div>
            <div className="space-y-4">
              {isError && (
                <div className="py-8 text-center text-destructive" role="alert">
                  <p>{t('adminUsers.loadError')}</p>
                  <Button variant="outline" className="mt-3 min-h-11" onClick={() => void refetch()}>
                    {t('common.retry')}
                  </Button>
                </div>
              )}
              {users.map((user) => (
                <div
                  key={user.id}
                  className="border border-border rounded-lg p-4 bg-muted/50"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-foreground font-medium mb-1 truncate">
                        {user.full_name || t('admin.noName')}
                      </h3>
                      <div className="mb-3 space-y-0.5">
                        {(user.email || user.phone) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {[user.email, user.phone].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {/* The eight-digit id is what support and the user both
                            quote; the uuid stays one hover away for debugging. */}
                        <p className="text-xs text-muted-foreground font-mono truncate" title={user.id}>
                          ID: {user.account_number || formatAccountId(user.id)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {user.roles.length === 0 ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            {t('adminUsers.noRoles')}
                          </Badge>
                        ) : (
                          user.roles.map((role) => (
                            <div key={role.id} className="inline-flex items-center gap-1">
                              <Badge
                                variant="outline"
                                className={ROLE_COLORS[role.role]}
                              >
                                {ROLE_LABELS[role.role]}
                              </Badge>
                              {isSuperAdmin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (role.role === 'super_admin') return;
                                    setPendingRoleRemoval({
                                      userId: user.id,
                                      roleId: role.id,
                                      roleName: role.role,
                                    });
                                  }}
                                  disabled={
                                    role.role === 'super_admin' ||
                                    processingUsers.has(user.id)
                                  }
                                  className="inline-flex h-11 w-11 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                                  aria-label={`${t('adminUsers.removeRole')}: ${ROLE_LABELS[role.role]}`}
                                  aria-describedby={
                                    role.role === 'super_admin'
                                      ? `protected-super-admin-${user.id}`
                                      : undefined
                                  }
                                  title={
                                    role.role === 'super_admin'
                                      ? t('adminUsers.cannotRemoveLastSuper')
                                      : undefined
                                  }
                                >
                                  <X className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                      {isSuperAdmin && user.roles.some((role) => role.role === 'super_admin') && (
                        <p
                          id={`protected-super-admin-${user.id}`}
                          className="mb-3 text-xs text-muted-foreground"
                        >
                          {t('adminUsers.cannotRemoveRole')}: {ROLE_LABELS.super_admin}.{' '}
                          {t('adminUsers.cannotRemoveLastSuper')}
                        </p>
                      )}

                      {isSuperAdmin && (
                        <div className="flex gap-2">
                          <Select
                            value={selectedRole[user.id] || ''}
                            onValueChange={(value) =>
                              setSelectedRole((prev) => ({ ...prev, [user.id]: value as AppRole }))
                            }
                            disabled={processingUsers.has(user.id)}
                          >
                            <SelectTrigger
                              className="min-h-11 flex-1 bg-card border-border text-foreground"
                              aria-label={t('adminUsers.selectRole')}
                            >
                              <SelectValue placeholder={t('adminUsers.selectRole')} />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                                <SelectItem
                                  key={value}
                                  value={value}
                                  className="min-h-11 text-foreground hover:bg-accent"
                                >
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button
                            onClick={() => addRole(user.id)}
                            disabled={!selectedRole[user.id] || processingUsers.has(user.id)}
                            className="min-h-11 min-w-11"
                            aria-label={`${t('common.add')}: ${selectedRole[user.id] ? ROLE_LABELS[selectedRole[user.id]] : t('adminUsers.selectRoleTitle')}`}
                            aria-busy={processingUsers.has(user.id)}
                          >
                            {processingUsers.has(user.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <UserPlus className="h-4 w-4" aria-hidden="true" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 w-full shrink-0 gap-1 sm:w-auto"
                      onClick={() => setDetailUser(user)}
                    >
                      <IdCard className="h-4 w-4" aria-hidden="true" />
                      {t('adminUserCard.open')}
                    </Button>
                  </div>
                </div>
              ))}

              {!isError && users.length === 0 && (
                <div className="text-center py-12 text-muted-foreground" role="status">
                  {search ? t('adminUsers.nothingFound') : t('adminUsers.noUsers')}
                </div>
              )}

              {!isError && totalPages > 1 && (
                <nav className="flex items-center justify-center gap-3 pt-2" aria-label={t('adminUsers.cardTitle')}>
                  <Button
                    variant="outline"
                    size="icon"
                    className="min-h-11 min-w-11"
                    disabled={page === 0}
                    onClick={() => setPage((value) => value - 1)}
                    aria-label={t('common.back')}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <span className="text-sm text-muted-foreground" aria-live="polite">
                    {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="min-h-11 min-w-11"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((value) => value + 1)}
                    aria-label={t('common.next')}
                  >
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </nav>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <UserDetailDialog
        user={detailUser}
        open={!!detailUser}
        onOpenChange={(o) => { if (!o) setDetailUser(null); }}
      />

      <AlertDialog
        open={!!pendingRoleRemoval}
        onOpenChange={(open) => {
          if (!open) setPendingRoleRemoval(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('adminUsers.removeRole')}
              {pendingRoleRemoval ? `: ${ROLE_LABELS[pendingRoleRemoval.roleName]}` : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('adminUsers.subtitle')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={
                !!pendingRoleRemoval &&
                processingUsers.has(pendingRoleRemoval.userId)
              }
              onClick={() => {
                if (!pendingRoleRemoval) return;
                const request = pendingRoleRemoval;
                setPendingRoleRemoval(null);
                void removeRole(request.userId, request.roleId, request.roleName);
              }}
            >
              {t('adminUsers.removeRole')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
