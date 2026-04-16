import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus, X, Shield } from 'lucide-react';
import { z } from 'zod';

type AppRole = 'super_admin' | 'admin' | 'moderator' | 'doctor' | 'patient' | 'clinic_admin' | 'assistant' | 'accountant' | 'clinic_manager';

interface UserRole {
  id: string;
  role: AppRole;
  created_at: string | null;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  email?: string;
  created_at: string | null;
  roles: UserRole[];
}

const roleSchema = z.enum(['super_admin', 'admin', 'moderator', 'doctor', 'patient', 'clinic_admin', 'assistant', 'accountant', 'clinic_manager']);

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Супер Админ',
  admin: 'Администратор',
  moderator: 'Модератор',
  doctor: 'Доктор',
  patient: 'Пациент',
  clinic_admin: 'Админ клиники',
  assistant: 'Ассистент',
  accountant: 'Бухгалтер',
  clinic_manager: 'Руководство',
};

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: 'bg-red-500/10 text-red-500 border-red-500/20',
  admin: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  moderator: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  doctor: 'bg-green-500/10 text-green-500 border-green-500/20',
  patient: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  clinic_admin: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  assistant: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  accountant: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  clinic_manager: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
};

export default function Users() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedRole, setSelectedRole] = useState<Record<string, AppRole>>({});
  const [processingUsers, setProcessingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);

      // Get all users from auth.users via profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get emails from auth.users (need to use admin API or service role)
      // For now, we'll fetch user_roles for each user
      const { data: allRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Map roles to users
      const usersWithRoles: UserProfile[] = (profiles || []).map((profile) => ({
        ...profile,
        roles: (allRoles || []).filter((role) => role.user_id === profile.id),
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error('[Users] Error loading users:', error);
      toast({
        title: 'Ошибка загрузки',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addRole = async (userId: string) => {
    const role = selectedRole[userId];
    
    if (!role) {
      toast({
        title: 'Выберите роль',
        description: 'Необходимо выбрать роль перед добавлением',
        variant: 'destructive',
      });
      return;
    }

    // Validate role
    const validation = roleSchema.safeParse(role);
    if (!validation.success) {
      toast({
        title: 'Недопустимая роль',
        description: 'Выбранная роль не соответствует допустимым значениям',
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
          title: 'Роль уже назначена',
          description: `Пользователь уже имеет роль ${ROLE_LABELS[role]}`,
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
        title: 'Роль добавлена',
        description: `Роль ${ROLE_LABELS[role]} успешно назначена`,
      });

      // Reload users
      await loadUsers();
      
      // Clear selection
      setSelectedRole(prev => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });
    } catch (error: any) {
      console.error('[Users] Error adding role:', error);
      toast({
        title: 'Ошибка добавления роли',
        description: error.message,
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
    // Prevent removing last super_admin
    const user = users.find(u => u.id === userId);
    if (roleName === 'super_admin' && user?.roles.length === 1) {
      const allSuperAdmins = users.filter(u => 
        u.roles.some(r => r.role === 'super_admin')
      );
      
      if (allSuperAdmins.length === 1) {
        toast({
          title: 'Невозможно удалить роль',
          description: 'Нельзя удалить последнего супер-администратора',
          variant: 'destructive',
        });
        return;
      }
    }

    setProcessingUsers(prev => new Set(prev).add(userId));

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      toast({
        title: 'Роль удалена',
        description: `Роль ${ROLE_LABELS[roleName]} успешно удалена`,
      });

      // Reload users
      await loadUsers();
    } catch (error: any) {
      console.error('[Users] Error removing role:', error);
      toast({
        title: 'Ошибка удаления роли',
        description: error.message,
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

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-[#00C6BB]" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Управление пользователями</h1>
          <p className="text-gray-400">Назначайте и удаляйте роли пользователей системы</p>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Пользователи и роли
            </CardTitle>
            <CardDescription>
              Всего пользователей: {users.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="border border-slate-800 rounded-lg p-4 bg-slate-950/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium mb-1 truncate">
                        {user.full_name || 'Без имени'}
                      </h3>
                      <p className="text-xs text-gray-500 font-mono mb-3 truncate">
                        ID: {user.id}
                      </p>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        {user.roles.length === 0 ? (
                          <Badge variant="outline" className="text-gray-500">
                            Нет ролей
                          </Badge>
                        ) : (
                          user.roles.map((role) => (
                            <Badge
                              key={role.id}
                              variant="outline"
                              className={ROLE_COLORS[role.role]}
                            >
                              {ROLE_LABELS[role.role]}
                              <button
                                onClick={() => removeRole(user.id, role.id, role.role)}
                                disabled={processingUsers.has(user.id)}
                                className="ml-2 hover:text-red-400 transition-colors"
                                aria-label="Удалить роль"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Select
                          value={selectedRole[user.id] || ''}
                          onValueChange={(value) =>
                            setSelectedRole((prev) => ({ ...prev, [user.id]: value as AppRole }))
                          }
                          disabled={processingUsers.has(user.id)}
                        >
                          <SelectTrigger className="flex-1 bg-slate-900 border-slate-700 text-white">
                            <SelectValue placeholder="Выберите роль..." />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {Object.entries(ROLE_LABELS).map(([value, label]) => (
                              <SelectItem
                                key={value}
                                value={value}
                                className="text-white hover:bg-slate-800"
                              >
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Button
                          onClick={() => addRole(user.id)}
                          disabled={!selectedRole[user.id] || processingUsers.has(user.id)}
                          className="bg-[#00C6BB] hover:bg-[#00B8AD] text-white"
                        >
                          {processingUsers.has(user.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserPlus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {users.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  Пользователи не найдены
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
