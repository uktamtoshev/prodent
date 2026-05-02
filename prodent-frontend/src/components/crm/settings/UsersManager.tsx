import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { UserPlus, Search, Trash2 } from 'lucide-react';
import type { Database } from '@/integrations/api/types';

type AppRole = Database['public']['Enums']['app_role'];

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Супер-админ',
  clinic_admin: 'Админ клиники',
  clinic_manager: 'Менеджер',
  doctor: 'Врач',
  assistant: 'Ассистент',
  accountant: 'Бухгалтер',
  patient: 'Пациент',
  admin: 'Админ',
  moderator: 'Модератор',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-500/10 text-red-500',
  clinic_admin: 'bg-purple-500/10 text-purple-500',
  clinic_manager: 'bg-blue-500/10 text-blue-500',
  doctor: 'bg-emerald-500/10 text-emerald-500',
  assistant: 'bg-amber-500/10 text-amber-500',
  accountant: 'bg-cyan-500/10 text-cyan-500',
  patient: 'bg-slate-500/10 text-slate-500',
  admin: 'bg-orange-500/10 text-orange-500',
  moderator: 'bg-pink-500/10 text-pink-500',
};

interface MemberWithProfile {
  id: string;
  user_id: string;
  clinic_id: string;
  role: AppRole;
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

export function UsersManager() {
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('assistant');

  const { data: members, isLoading } = useQuery({
    queryKey: ['clinic-members', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      
      const { data: membersData, error } = await supabase
        .from('clinic_members')
        .select('id, user_id, clinic_id, role')
        .eq('clinic_id', currentClinic.id);

      if (error) throw error;
      if (!membersData) return [];

      // Fetch profiles separately
      const userIds = membersData.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .in('id', userIds);

      return membersData.map(member => ({
        ...member,
        profile: profiles?.find(p => p.id === member.user_id) || null,
      })) as MemberWithProfile[];
    },
    enabled: !!currentClinic?.id,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('clinic_members')
        .update({ role })
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
      toast.success('Роль обновлена');
    },
    onError: () => {
      toast.error('Ошибка при обновлении роли');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('clinic_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
      toast.success('Пользователь удален из клиники');
    },
    onError: () => {
      toast.error('Ошибка при удалении пользователя');
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (profileError || !profile) {
        throw new Error('Пользователь с таким email не найден');
      }

      const { error } = await supabase
        .from('clinic_members')
        .insert({
          user_id: profile.id,
          clinic_id: currentClinic!.id,
          role,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
      toast.success('Пользователь добавлен');
      setIsAddDialogOpen(false);
      setNewUserEmail('');
      setNewUserRole('assistant');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка при добавлении пользователя');
    },
  });

  const filteredMembers = members?.filter(m => 
    m.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.profile?.email?.toLowerCase().includes(search.toLowerCase())
  );

  const ASSIGNABLE_ROLES: AppRole[] = ['clinic_admin', 'clinic_manager', 'doctor', 'assistant', 'accountant', 'patient'];

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Пользователи клиники</CardTitle>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить пользователя</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm text-muted-foreground">Email пользователя</label>
                <Input
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Роль</label>
                <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.filter(r => r !== 'patient').map(role => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full" 
                onClick={() => addMemberMutation.mutate({ email: newUserEmail, role: newUserRole })}
                disabled={!newUserEmail || addMemberMutation.isPending}
              >
                Добавить
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени или email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Пользователь</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers?.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.profile?.full_name || 'Без имени'}
                  </TableCell>
                  <TableCell>{member.profile?.email || '-'}</TableCell>
                  <TableCell>{member.profile?.phone || '-'}</TableCell>
                  <TableCell>
                    <Select 
                      value={member.role} 
                      onValueChange={(v) => updateRoleMutation.mutate({ memberId: member.id, role: v as AppRole })}
                    >
                      <SelectTrigger className="w-[160px]">
                        <Badge className={ROLE_COLORS[member.role] || 'bg-muted'}>
                          {ROLE_LABELS[member.role] || member.role}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.map(role => (
                          <SelectItem key={role} value={role}>
                            <Badge className={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm('Удалить пользователя из клиники?')) {
                          removeMemberMutation.mutate(member.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
