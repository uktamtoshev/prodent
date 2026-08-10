import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Building2,
  Image
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  readWorkspaceBackground,
  writeWorkspaceBackground,
  type WorkspaceBackground,
} from '@/lib/workspace-background';
import { JoinClinicDialog } from '@/components/doctor/JoinClinicDialog';
import { ClinicInvitationsManager } from '@/components/doctor/ClinicInvitationsManager';
import { useLanguage } from '@/contexts/LanguageContext';

interface SettingsMap {
  [key: string]: boolean | undefined;
}

interface SettingsError {
  message?: string;
}

interface PasswordChangeResponse {
  error?: string;
  message?: string;
}

export function DoctorSettings() {
  const { t } = useLanguage();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  // Обои читаем после монтирования: на сервере и в тестах localStorage может
  // не быть, а расхождение первого рендера с разметкой даёт мигание.
  const [workspaceBackground, setWorkspaceBackground] = useState<WorkspaceBackground>('none');
  useEffect(() => {
    setWorkspaceBackground(readWorkspaceBackground());
  }, []);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [joinClinicOpen, setJoinClinicOpen] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  
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

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setPasswordError(t('doctorSettings.error'));
      toast({ title: t('doctorSettings.error'), description: 'Новый пароль должен быть не короче 8 символов', variant: 'destructive' });
      return;
    }
    setPasswordError(null);
    setChangingPassword(true);
    try {
      const token = localStorage.getItem('prodent_access_token');
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as PasswordChangeResponse;
      if (!res.ok) throw new Error(data.error || data.message || 'Ошибка');
      toast({ title: t('doctorSettings.saved'), description: 'Пароль изменён' });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordError(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error';
      setPasswordError(message);
      toast({ title: t('doctorSettings.error'), description: message, variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

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

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setSettingsError(null);
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

      const { data: settings } = await supabase
        .from('user_settings')
        .select('notifications, privacy')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (settings) {
        const n = (settings.notifications || {}) as SettingsMap;
        const p = (settings.privacy || {}) as SettingsMap;
        setEmailNotifications(n.email ?? true);
        setSmsNotifications(n.sms ?? true);
        setPushNotifications(n.push ?? true);
        setAppointmentReminders(n.appointmentReminders ?? true);
        setNewPatientAlerts(n.newPatients ?? true);
        setPaymentAlerts(n.payments ?? true);
        setProfileVisible(p.profileVisible ?? true);
        setShowPhone(p.showPhone ?? false);
        setShowEmail(p.showEmail ?? false);
      }
    } catch (error: SettingsError) {
      console.error('Error loading profile:', error);
      setSettingsError(error.message || t('doctorSettings.error'));
    } finally {
      setLoading(false);
    }
  }, [t, user?.id]);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user, loadProfile]);

  const handleSave = async () => {
    setSettingsError(null);
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

      // Persist notification + privacy preferences (previously React-state only).
      const { error: settingsError } = await supabase.from('user_settings').upsert(
        {
          user_id: user?.id,
          notifications: {
            email: emailNotifications,
            sms: smsNotifications,
            push: pushNotifications,
            appointmentReminders,
            newPatients: newPatientAlerts,
            payments: paymentAlerts,
          },
          privacy: { profileVisible, showPhone, showEmail },
        },
        { onConflict: 'user_id' }
      );
      if (settingsError) throw settingsError;

      toast({
        title: t('doctorSettings.saved'),
        description: t('doctorSettings.savedDesc'),
      });
      setSettingsError(null);
    } catch (error: SettingsError) {
      setSettingsError(error.message || t('doctorSettings.error'));
      toast({
        title: t('doctorSettings.error'),
        description: error.message || 'Error',
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
    <div className="min-w-0 space-y-6">
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="profile" className="min-h-11 min-w-11 gap-2 px-2" aria-label={t('doctorSettings.tabProfile')}>
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">{t('doctorSettings.tabProfile')}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="min-h-11 min-w-11 gap-2 px-2" aria-label={t('doctorSettings.tabNotifications')}>
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">{t('doctorSettings.tabNotifications')}</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="min-h-11 min-w-11 gap-2 px-2" aria-label={t('doctorSettings.tabPrivacy')}>
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">{t('doctorSettings.tabPrivacy')}</span>
          </TabsTrigger>
          <TabsTrigger value="account" className="min-h-11 min-w-11 gap-2 px-2" aria-label={t('doctorSettings.tabAccount')}>
            <Lock className="w-4 h-4" />
            <span className="hidden sm:inline">{t('doctorSettings.tabAccount')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="border-b border-border/50 px-card-x py-card-y">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  {t('doctorSettings.personalDataTitle')}
                </CardTitle>
                <CardDescription>{t('doctorSettings.personalDataDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="doctor-settings-full-name">{t('doctorSettings.fullNameLabel')}</Label>
                  <Input
                    id="doctor-settings-full-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('doctorSettings.fullNamePlaceholder')}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doctor-settings-birth-date">{t('doctorSettings.birthDateLabel')}</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="doctor-settings-birth-date"
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="h-11 pl-10"
                    />
                  </div>
                  {age !== null && (
                    <Badge variant="secondary" className="text-xs">{age} {t('doctorSettings.yearsOldUnit')}</Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doctor-settings-gender">{t('doctorSettings.genderLabel')}</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger id="doctor-settings-gender" className="min-h-11">
                      <SelectValue placeholder={t('doctorSettings.genderPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t('doctorSettings.male')}</SelectItem>
                      <SelectItem value="female">{t('doctorSettings.female')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-border/50 px-card-x py-card-y">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  {t('doctorSettings.contactDataTitle')}
                </CardTitle>
                <CardDescription>{t('doctorSettings.contactDataDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="doctor-settings-email">{t('doctorSettings.emailLabel')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="doctor-settings-email"
                      value={user?.email || ''}
                      disabled
                      className="h-11 pl-10 bg-muted/50"
                      aria-describedby="doctor-settings-email-hint"
                    />
                  </div>
                  <p id="doctor-settings-email-hint" className="text-xs text-muted-foreground">{t('doctorSettings.emailHint')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doctor-settings-phone">{t('doctorSettings.phoneLabel')}</Label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="doctor-settings-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={t('doctorSettings.phonePlaceholder')}
                      className="h-11 pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doctor-settings-address">{t('doctorSettings.addressLabel')}</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="doctor-settings-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder={t('doctorSettings.addressPlaceholder')}
                      className="h-11 pl-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {settingsError && (
            <p id="doctor-settings-error" role="alert" className="text-sm text-destructive">
              {settingsError}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              size="lg"
              className="min-h-11 w-full focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
              aria-describedby={settingsError ? "doctor-settings-error" : undefined}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {t('doctorSettings.saveChanges')}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="border-b border-border/50 px-card-x py-card-y">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                {t('doctorSettings.notifChannelsTitle')}
              </CardTitle>
              <CardDescription>{t('doctorSettings.notifChannelsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p id="doctor-settings-email-notifications-label" className="font-medium">{t('doctorSettings.emailNotifs')}</p>
                    <p id="doctor-settings-email-notifications-description" className="break-words text-sm text-muted-foreground">{t('doctorSettings.emailNotifsDesc')} {user?.email}</p>
                  </div>
                </div>
                <label htmlFor="doctor-settings-email-notifications" className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
                  <Switch
                    id="doctor-settings-email-notifications"
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                    aria-labelledby="doctor-settings-email-notifications-label"
                    aria-describedby="doctor-settings-email-notifications-description"
                  />
                </label>
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Smartphone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p id="doctor-settings-sms-notifications-label" className="font-medium">{t('doctorSettings.smsNotifs')}</p>
                    <p id="doctor-settings-sms-notifications-description" className="break-words text-sm text-muted-foreground">{phone || t('doctorSettings.phoneNotSet')}</p>
                  </div>
                </div>
                <label htmlFor="doctor-settings-sms-notifications" className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
                  <Switch
                    id="doctor-settings-sms-notifications"
                    checked={smsNotifications}
                    onCheckedChange={setSmsNotifications}
                    aria-labelledby="doctor-settings-sms-notifications-label"
                    aria-describedby="doctor-settings-sms-notifications-description"
                  />
                </label>
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p id="doctor-settings-push-notifications-label" className="font-medium">{t('doctorSettings.pushNotifs')}</p>
                    <p id="doctor-settings-push-notifications-description" className="text-sm text-muted-foreground">{t('doctorSettings.pushNotifsDesc')}</p>
                  </div>
                </div>
                <label htmlFor="doctor-settings-push-notifications" className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
                  <Switch
                    id="doctor-settings-push-notifications"
                    checked={pushNotifications}
                    onCheckedChange={setPushNotifications}
                    aria-labelledby="doctor-settings-push-notifications-label"
                    aria-describedby="doctor-settings-push-notifications-description"
                  />
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/50 px-card-x py-card-y">
              <CardTitle className="text-base font-bold">{t('doctorSettings.notifTypesTitle')}</CardTitle>
              <CardDescription>{t('doctorSettings.notifTypesDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p id="doctor-settings-appointment-reminders-label" className="font-medium">{t('doctorSettings.apptReminders')}</p>
                  <p id="doctor-settings-appointment-reminders-description" className="text-sm text-muted-foreground">{t('doctorSettings.apptRemindersDesc')}</p>
                </div>
                <label htmlFor="doctor-settings-appointment-reminders" className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
                  <Switch
                    id="doctor-settings-appointment-reminders"
                    checked={appointmentReminders}
                    onCheckedChange={setAppointmentReminders}
                    aria-labelledby="doctor-settings-appointment-reminders-label"
                    aria-describedby="doctor-settings-appointment-reminders-description"
                  />
                </label>
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p id="doctor-settings-new-patients-label" className="font-medium">{t('doctorSettings.newPatients')}</p>
                  <p id="doctor-settings-new-patients-description" className="text-sm text-muted-foreground">{t('doctorSettings.newPatientsDesc')}</p>
                </div>
                <label htmlFor="doctor-settings-new-patients" className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
                  <Switch
                    id="doctor-settings-new-patients"
                    checked={newPatientAlerts}
                    onCheckedChange={setNewPatientAlerts}
                    aria-labelledby="doctor-settings-new-patients-label"
                    aria-describedby="doctor-settings-new-patients-description"
                  />
                </label>
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p id="doctor-settings-payments-label" className="font-medium">{t('doctorSettings.payments')}</p>
                  <p id="doctor-settings-payments-description" className="text-sm text-muted-foreground">{t('doctorSettings.paymentsDesc')}</p>
                </div>
                <label htmlFor="doctor-settings-payments" className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
                  <Switch
                    id="doctor-settings-payments"
                    checked={paymentAlerts}
                    onCheckedChange={setPaymentAlerts}
                    aria-labelledby="doctor-settings-payments-label"
                    aria-describedby="doctor-settings-payments-description"
                  />
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="border-b border-border/50 px-card-x py-card-y">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <div className="p-2 rounded-lg bg-primary/10">
                  <Globe className="w-4 h-4 text-primary" />
                </div>
                {t('doctorSettings.profileVisibilityTitle')}
              </CardTitle>
              <CardDescription>{t('doctorSettings.profileVisibilityDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p id="doctor-settings-profile-visible-label" className="font-medium">{t('doctorSettings.publicProfile')}</p>
                  <p id="doctor-settings-profile-visible-description" className="text-sm text-muted-foreground">{t('doctorSettings.publicProfileDesc')}</p>
                </div>
                <label htmlFor="doctor-settings-profile-visible" className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
                  <Switch
                    id="doctor-settings-profile-visible"
                    checked={profileVisible}
                    onCheckedChange={setProfileVisible}
                    aria-labelledby="doctor-settings-profile-visible-label"
                    aria-describedby="doctor-settings-profile-visible-description"
                  />
                </label>
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p id="doctor-settings-show-phone-label" className="font-medium">{t('doctorSettings.showPhone')}</p>
                  <p id="doctor-settings-show-phone-description" className="text-sm text-muted-foreground">{t('doctorSettings.showPhoneDesc')}</p>
                </div>
                <label htmlFor="doctor-settings-show-phone" className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
                  <Switch
                    id="doctor-settings-show-phone"
                    checked={showPhone}
                    onCheckedChange={setShowPhone}
                    aria-labelledby="doctor-settings-show-phone-label"
                    aria-describedby="doctor-settings-show-phone-description"
                  />
                </label>
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p id="doctor-settings-show-email-label" className="font-medium">{t('doctorSettings.showEmail')}</p>
                  <p id="doctor-settings-show-email-description" className="text-sm text-muted-foreground">{t('doctorSettings.showEmailDesc')}</p>
                </div>
                <label htmlFor="doctor-settings-show-email" className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
                  <Switch
                    id="doctor-settings-show-email"
                    checked={showEmail}
                    onCheckedChange={setShowEmail}
                    aria-labelledby="doctor-settings-show-email-label"
                    aria-describedby="doctor-settings-show-email-description"
                  />
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Clinic invitations and affiliations */}
          <Card>
            <CardHeader className="border-b border-border/50 px-card-x py-card-y">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                {t('doctorSettings.clinicsAndInvitesTitle')}
              </CardTitle>
              <CardDescription>{t('doctorSettings.clinicsAndInvitesDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Show invitations manager if doctor exists */}
              {doctorData?.id && (
                <ClinicInvitationsManager doctorId={doctorData.id} />
              )}

              {/* Button to find and join clinics */}
              <Separator />
              <div className="flex flex-col items-stretch gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{t('doctorSettings.findClinicTitle')}</p>
                  <p className="text-sm text-muted-foreground">{t('doctorSettings.findClinicDesc')}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setJoinClinicOpen(true)}
                  className="min-h-11 w-full focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  {t('doctorSettings.findClinicBtn')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/50 px-card-x py-card-y">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Palette className="w-4 h-4 text-primary" />
                </div>
                {t('doctorSettings.appearanceTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-stretch gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  <div>
                    <Label htmlFor="doctor-settings-theme" className="font-medium">{t('doctorSettings.themeLabel')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {theme === 'dark' ? t('doctorSettings.themeDark') : theme === 'light' ? t('doctorSettings.themeLight') : t('doctorSettings.themeSystem')}
                    </p>
                  </div>
                </div>
                <Select value={theme} onValueChange={(value: 'light' | 'dark' | 'system') => setTheme(value)}>
                  <SelectTrigger id="doctor-settings-theme" className="min-h-11 w-full sm:w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">{t('doctorSettings.themeLightOpt')}</SelectItem>
                    <SelectItem value="dark">{t('doctorSettings.themeDarkOpt')}</SelectItem>
                    <SelectItem value="system">{t('doctorSettings.themeSystemOpt')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator className="my-2" />

              {/* Обои рабочего пространства. Отдельно от темы: тема меняет цвета
                  интерфейса, обои видны только вокруг карточек. По умолчанию
                  выключены, поэтому у тех, кто ничего не выбирал, вид прежний. */}
              <div className="flex flex-col items-stretch gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Image className="w-5 h-5 shrink-0" />
                  <div className="min-w-0">
                    <Label htmlFor="doctor-settings-workspace-bg" className="font-medium">
                      {t('doctorSettings.workspaceBackground')}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t('doctorSettings.workspaceBackgroundDesc')}
                    </p>
                  </div>
                </div>
                <Select
                  value={workspaceBackground}
                  onValueChange={(value: WorkspaceBackground) => {
                    setWorkspaceBackground(value);
                    writeWorkspaceBackground(value);
                  }}
                >
                  <SelectTrigger id="doctor-settings-workspace-bg" className="min-h-11 w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('doctorSettings.workspaceBackgroundNone')}</SelectItem>
                    <SelectItem value="aurora">{t('doctorSettings.workspaceBackgroundAurora')}</SelectItem>
                    <SelectItem value="sky">{t('doctorSettings.workspaceBackgroundSky')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="border-b border-border/50 px-card-x py-card-y">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Lock className="w-4 h-4 text-primary" />
                </div>
                {t('doctorSettings.securityTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="doctor-settings-current-password">{t('doctorSettings.currentPasswordLabel')}</Label>
                <div className="relative">
                  <Input
                    id="doctor-settings-current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="h-11 pr-12"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setPasswordError(null);
                    }}
                    aria-invalid={passwordError ? true : undefined}
                    aria-describedby={passwordError ? "doctor-settings-password-error" : undefined}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-11 w-11 focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={showCurrentPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    aria-controls="doctor-settings-current-password"
                    aria-pressed={showCurrentPassword}
                    onClick={() => setShowCurrentPassword((visible) => !visible)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="doctor-settings-new-password">{t('doctorSettings.newPasswordLabel')}</Label>
                <div className="relative">
                  <Input
                    id="doctor-settings-new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="h-11 pr-12"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordError(null);
                    }}
                    aria-invalid={passwordError ? true : undefined}
                    aria-describedby={passwordError ? "doctor-settings-password-error" : undefined}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-11 w-11 focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={showNewPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    aria-controls="doctor-settings-new-password"
                    aria-pressed={showNewPassword}
                    onClick={() => setShowNewPassword((visible) => !visible)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {passwordError && (
                <p id="doctor-settings-password-error" role="alert" className="text-sm text-destructive">
                  {passwordError}
                </p>
              )}
              <Button
                variant="outline"
                onClick={handleChangePassword}
                disabled={changingPassword || !currentPassword || !newPassword}
                className="min-h-11 w-full focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
                aria-describedby={passwordError ? "doctor-settings-password-error" : undefined}
              >
                {t('doctorSettings.changePasswordBtn')}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader className="border-b border-border/50 px-card-x py-card-y">
              <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                </div>
                {t('doctorSettings.dangerZoneTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-stretch gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{t('doctorSettings.logoutTitle')}</p>
                  <p className="text-sm text-muted-foreground">{t('doctorSettings.logoutDesc')}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="min-h-11 w-full focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {t('doctorSettings.logoutBtn')}
                </Button>
              </div>
              <Separator />
              <div className="flex flex-col items-stretch gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-destructive">{t('doctorSettings.deleteAcctTitle')}</p>
                  <p className="text-sm text-muted-foreground">{t('doctorSettings.deleteAcctDesc')}</p>
                </div>
                <Button variant="destructive" disabled className="min-h-11 w-full sm:w-auto">
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('doctorSettings.deleteBtn')}
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

