import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar,
  Save,
  Loader2,
  Bell,
  Shield,
  CreditCard,
  Lock,
  Eye,
  EyeOff,
  Smartphone,
  Globe,
  Moon,
  Sun,
  Palette,
  LogOut,
  Trash2,
  AlertTriangle,
  Building2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { JoinClinicDialog } from '@/components/doctor/JoinClinicDialog';
import { ClinicInvitationsManager } from '@/components/doctor/ClinicInvitationsManager';

export function DoctorSettings() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [joinClinicOpen, setJoinClinicOpen] = useState(false);
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [appointmentReminders, setAppointmentReminders] = useState(true);
  const [newPatientAlerts, setNewPatientAlerts] = useState(true);
  const [paymentAlerts, setPaymentAlerts] = useState(true);

  const [profileVisible, setProfileVisible] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  // Get doctor ID for current user
  const { data: doctorData } = useQuery({
    queryKey: ['doctor-for-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('doctors')
        .select('id, clinic_id, clinic:clinics(name)')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setFullName(data.full_name || '');
        setPhone(data.phone || '');
        setBirthDate(data.birth_date || '');
        setGender(data.gender || '');
        setAddress(data.address || '');
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone,
          birth_date: birthDate || null,
          gender: gender || null,
          address: address || null,
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: 'Сохранено',
        description: 'Настройки успешно обновлены',
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const calculateAge = (birthDateStr: string) => {
    if (!birthDateStr) return null;
    const today = new Date();
    const birth = new Date(birthDateStr);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const age = calculateAge(birthDate);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Профиль</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Уведомления</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Приватность</span>
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <Lock className="w-4 h-4" />
            <span className="hidden sm:inline">Аккаунт</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  Личные данные
                </CardTitle>
                <CardDescription>Основная информация о вас</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Полное имя</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Введите имя"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Дата рождения</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {age !== null && (
                    <Badge variant="secondary" className="text-xs">{age} лет</Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Пол</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите пол" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Мужской</SelectItem>
                      <SelectItem value="female">Женский</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Phone className="w-4 h-4 text-blue-500" />
                  </div>
                  Контактные данные
                </CardTitle>
                <CardDescription>Как с вами связаться</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={user?.email || ''} disabled className="pl-10 bg-muted/50" />
                  </div>
                  <p className="text-xs text-muted-foreground">Email изменяется в настройках аккаунта</p>
                </div>
                <div className="space-y-2">
                  <Label>Телефон</Label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+998 90 123 45 67"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Адрес</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Город, улица, дом"
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="lg">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Сохранить изменения
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Bell className="w-4 h-4 text-orange-500" />
                </div>
                Каналы уведомлений
              </CardTitle>
              <CardDescription>Выберите как получать уведомления</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Email уведомления</p>
                    <p className="text-sm text-muted-foreground">Получать на {user?.email}</p>
                  </div>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">SMS уведомления</p>
                    <p className="text-sm text-muted-foreground">{phone || 'Номер не указан'}</p>
                  </div>
                </div>
                <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Push уведомления</p>
                    <p className="text-sm text-muted-foreground">В браузере и приложении</p>
                  </div>
                </div>
                <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Типы уведомлений</CardTitle>
              <CardDescription>О чём вы хотите получать уведомления</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Напоминания о записях</p>
                  <p className="text-sm text-muted-foreground">За 24 часа и 1 час до приёма</p>
                </div>
                <Switch checked={appointmentReminders} onCheckedChange={setAppointmentReminders} />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Новые пациенты</p>
                  <p className="text-sm text-muted-foreground">При новой записи на приём</p>
                </div>
                <Switch checked={newPatientAlerts} onCheckedChange={setNewPatientAlerts} />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Платежи</p>
                  <p className="text-sm text-muted-foreground">Новые оплаты и счета</p>
                </div>
                <Switch checked={paymentAlerts} onCheckedChange={setPaymentAlerts} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Globe className="w-4 h-4 text-purple-500" />
                </div>
                Видимость профиля
              </CardTitle>
              <CardDescription>Управление публичной информацией</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Публичный профиль</p>
                  <p className="text-sm text-muted-foreground">Отображение в поиске врачей</p>
                </div>
                <Switch checked={profileVisible} onCheckedChange={setProfileVisible} />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Показывать телефон</p>
                  <p className="text-sm text-muted-foreground">Виден посетителям профиля</p>
                </div>
                <Switch checked={showPhone} onCheckedChange={setShowPhone} />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Показывать email</p>
                  <p className="text-sm text-muted-foreground">Виден посетителям профиля</p>
                </div>
                <Switch checked={showEmail} onCheckedChange={setShowEmail} />
              </div>
            </CardContent>
          </Card>

          {/* Clinic invitations and affiliations */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                Клиники и приглашения
              </CardTitle>
              <CardDescription>Управление приглашениями и привязками к клиникам</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Show invitations manager if doctor exists */}
              {doctorData?.id && (
                <ClinicInvitationsManager doctorId={doctorData.id} />
              )}
              
              {/* Button to find and join clinics */}
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Найти клинику</p>
                  <p className="text-sm text-muted-foreground">Отправить запрос на присоединение</p>
                </div>
                <Button variant="outline" onClick={() => setJoinClinicOpen(true)}>
                  <Building2 className="w-4 h-4 mr-2" />
                  Найти клинику
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 rounded-lg bg-indigo-500/10">
                  <Palette className="w-4 h-4 text-indigo-500" />
                </div>
                Внешний вид
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  <div>
                    <p className="font-medium">Тема оформления</p>
                    <p className="text-sm text-muted-foreground">
                      {theme === 'dark' ? 'Тёмная тема' : theme === 'light' ? 'Светлая тема' : 'Системная'}
                    </p>
                  </div>
                </div>
                <Select value={theme} onValueChange={(value: 'light' | 'dark' | 'system') => setTheme(value)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Светлая</SelectItem>
                    <SelectItem value="dark">Тёмная</SelectItem>
                    <SelectItem value="system">Системная</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Lock className="w-4 h-4 text-blue-500" />
                </div>
                Безопасность
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Текущий пароль</Label>
                <PasswordInput
                  placeholder="••••••••"
                  className="pl-10"
                />
              </div>
              <div className="space-y-2">
                <Label>Новый пароль</Label>
                <PasswordInput
                  placeholder="••••••••"
                  className="pl-10"
                />
              </div>
              <Button variant="outline">Изменить пароль</Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                </div>
                Опасная зона
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Выйти из аккаунта</p>
                  <p className="text-sm text-muted-foreground">Завершить текущую сессию</p>
                </div>
                <Button variant="outline" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Выйти
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-destructive">Удалить аккаунт</p>
                  <p className="text-sm text-muted-foreground">Безвозвратное удаление всех данных</p>
                </div>
                <Button variant="destructive" disabled>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Удалить
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Join Clinic Dialog */}
      {doctorData?.id && (
        <JoinClinicDialog
          open={joinClinicOpen}
          onOpenChange={setJoinClinicOpen}
          doctorId={doctorData.id}
        />
      )}
    </div>
  );
}
