import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  Camera, 
  Loader2, 
  Phone, 
  User, 
  Calendar, 
  MapPin, 
  Shield, 
  Edit3,
  Save,
  X,
  CheckCircle2,
  CreditCard,
  Clock,
  Building2
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatAccountId } from "@/lib/accountId";

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin } = useAdmin();
  const { isDoctor, isClinicAdmin, role } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [profileLoadState, setProfileLoadState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  // `profiles.account_number` is the eight-digit id (V131); the uuid stays as a
  // fallback. Same helper as the sidebar so the two never print a different id
  // for the same person.
  const [accountNumber, setAccountNumber] = useState<string | null>(null);
  const displayAccountId = accountNumber ?? formatAccountId(user?.id);
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    setProfileLoadState("loading");

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setFullName(data.full_name || "");
        setAccountNumber(data.account_number ?? null);
        setPhone(data.phone || "");
        setAvatarUrl(data.avatar_url || "");
        setBirthDate(data.birth_date || "");
        setGender(data.gender || "");
        setAddress(data.address || "");
      }
      setProfileLoadState("ready");
    } catch (error: unknown) {
      console.error("Error loading profile:", error);
      setProfileLoadState("error");
    }
  }, [user?.id]);

  // Redirect doctors to their CRM profile (the editable one) — /profile is for
  // patients. The public doctor card is reachable separately via /doctor/:id.
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user && isDoctor) {
      navigate("/crm/profile", { replace: true });
    }
  }, [user, authLoading, isDoctor, navigate]);

  useEffect(() => {
    if (user && !isDoctor) {
      loadProfile();
    }
  }, [user, isDoctor, loadProfile]);

  // Patient stats state
  const [completedVisits, setCompletedVisits] = useState(0);
  const [upcomingVisits, setUpcomingVisits] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

  // Fetch patient stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.id) return;

      // Completed visits
      const { count: completed } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', user.id)
        .eq('status', 'COMPLETED');
      setCompletedVisits(completed || 0);

      // Upcoming visits - use or filter instead of in
      const { count: upcoming } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', user.id)
        .or('status.eq.PENDING,status.eq.CONFIRMED')
        .gte('appointment_date', new Date().toISOString());
      setUpcomingVisits(upcoming || 0);

      // Total spent - use RPC or skip for now
      // Payments query causes TypeScript issues due to complex types
    };

    fetchStats();
  }, [user?.id]);

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Операция не удалась";

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!e.target.files || e.target.files.length === 0) {
        return;
      }

      const file = e.target.files[0];
      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id}/${Math.random()}.${fileExt}`;

      if (avatarUrl) {
        const oldPath = avatarUrl.split("/").slice(-2).join("/");
        await supabase.storage.from("avatars").remove([oldPath]);
      }

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      setAvatarUrl(publicUrl);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user?.id);

      if (updateError) throw updateError;

      toast({
        title: "Аватар обновлен",
        description: "Ваш аватар успешно загружен",
      });
    } catch (error: unknown) {
      toast({
        title: "Ошибка загрузки",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (profileLoadState !== "ready") return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: phone,
          birth_date: birthDate || null,
          gender: gender || null,
          address: address || null,
        })
        .eq("id", user?.id);

      if (error) throw error;

      toast({
        title: "Профиль обновлен",
        description: "Ваши данные успешно сохранены",
      });
      setIsEditing(false);
    } catch (error: unknown) {
      toast({
        title: "Ошибка сохранения",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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

  const age = calculateAge(birthDate);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU').format(amount) + ' сум';
  };

  if (!isDoctor && profileLoadState === "loading") {
    return (
      <PatientLayout>
        <div
          className="flex min-h-[50vh] items-center justify-center gap-3 p-4 text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <span>Загрузка профиля…</span>
        </div>
      </PatientLayout>
    );
  }

  if (!isDoctor && profileLoadState === "error") {
    return (
      <PatientLayout>
        <div className="flex min-h-[50vh] items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="space-y-4 p-6 text-center">
              <div role="alert">
                <h1 className="text-xl font-bold text-foreground">Не удалось загрузить профиль</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ваши сохранённые данные не изменены. Проверьте соединение и повторите попытку.
                </p>
              </div>
              <Button className="min-h-11 w-full" onClick={() => void loadProfile()}>
                Повторить
              </Button>
            </CardContent>
          </Card>
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Мой профиль</h1>
            <p className="text-muted-foreground mt-1">Управление личными данными</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <Button className="min-h-11" variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Отмена
                </Button>
                <Button className="min-h-11" onClick={handleSave} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Сохранить
                </Button>
              </>
            ) : (
              <Button className="min-h-11" onClick={() => setIsEditing(true)}>
                <Edit3 className="w-4 h-4 mr-2" />
                Редактировать
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-[hsl(var(--success-green)/0.2)] bg-[hsl(var(--success-green)/0.08)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[hsl(var(--success-green)/0.15)] p-2.5">
                  <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success-green))]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{completedVisits || 0}</p>
                  <p className="text-sm text-muted-foreground">Завершено визитов</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/15 p-2.5">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{upcomingVisits || 0}</p>
                  <p className="text-sm text-muted-foreground">Предстоящих</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-accent bg-accent/40 sm:col-span-2 lg:col-span-2">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-accent p-2.5">
                  <CreditCard className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(totalSpent || 0)}</p>
                  <p className="text-sm text-muted-foreground">Всего оплачено</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card className="lg:col-span-1">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                {/* Avatar */}
                <div className="relative group mb-4">
                  <Avatar className="w-28 h-28 border-4 border-background shadow-xl">
                    <AvatarImage src={avatarUrl} alt={fullName} className="object-cover" />
                    <AvatarFallback className="text-3xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                      {fullName.charAt(0) || user?.email?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  
                  <Label 
                    htmlFor="avatar" 
                    className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                  >
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-background" />
                    ) : (
                      <Camera className="h-6 w-6 text-background" />
                    )}
                    <span className="sr-only">Изменить фото профиля</span>
                    <Input
                      id="avatar"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleAvatarUpload}
                      disabled={uploading}
                    />
                  </Label>
                </div>

                <h2 className="text-xl font-bold text-foreground mb-1">
                  {fullName || "Имя не указано"}
                </h2>
                {displayAccountId && (
                  <p
                    className="text-xs font-mono text-muted-foreground tracking-wider mb-1 select-all"
                    title={user?.id ?? undefined}
                  >
                    ID&nbsp;{displayAccountId}
                  </p>
                )}
                <p className="text-sm text-muted-foreground mb-3">{user?.email}</p>

                <div className="flex flex-wrap gap-2 justify-center">
                  {isClinicAdmin ? (
                    <Badge className="border-primary/20 bg-primary/10 text-primary">
                      <Building2 className="w-3 h-3 mr-1" />
                      Администратор
                    </Badge>
                  ) : (
                    <Badge className="border-[hsl(var(--success-green)/0.2)] bg-[hsl(var(--success-green)/0.1)] text-[hsl(var(--success-green))]">
                      <User className="w-3 h-3 mr-1" />
                      Пациент
                    </Badge>
                  )}
                  {isSuperAdmin && (
                    <Badge className="border-warning-amber/20 bg-warning-amber/10 text-warning-amber">
                      <Shield className="w-3 h-3 mr-1" />
                      Супер-админ
                    </Badge>
                  )}
                </div>
              </div>

              {/* Quick Info */}
              <div className="mt-6 pt-6 border-t border-border/50 space-y-3">
                {phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{phone}</span>
                  </div>
                )}
                {birthDate && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">
                      {new Date(birthDate).toLocaleDateString('ru-RU')}
                      {age && <span className="text-muted-foreground ml-1">({age} лет)</span>}
                    </span>
                  </div>
                )}
                {address && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{address}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Details Cards */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Info */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5 text-primary" />
                  Личные данные
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="profile-full-name">Полное имя</Label>
                      <Input
                        id="profile-full-name"
                        className="min-h-11"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Введите имя"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-birth-date">Дата рождения</Label>
                      <Input
                        id="profile-birth-date"
                        className="min-h-11"
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-gender">Пол</Label>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger id="profile-gender" className="min-h-11">
                          <SelectValue placeholder="Выберите пол" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Мужской</SelectItem>
                          <SelectItem value="female">Женский</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-muted/30">
                      <p className="text-sm text-muted-foreground mb-1">Полное имя</p>
                      <p className="font-medium text-foreground">{fullName || "—"}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30">
                      <p className="text-sm text-muted-foreground mb-1">Дата рождения</p>
                      <p className="font-medium text-foreground">
                        {birthDate ? `${new Date(birthDate).toLocaleDateString('ru-RU')}${age ? ` (${age} лет)` : ''}` : "—"}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30">
                      <p className="text-sm text-muted-foreground mb-1">Пол</p>
                      <p className="font-medium text-foreground">
                        {gender === 'male' ? 'Мужской' : gender === 'female' ? 'Женский' : '—'}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Phone className="w-5 h-5 text-primary" />
                  Контактные данные
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="profile-email">Email</Label>
                      <Input id="profile-email" value={user?.email || ""} disabled className="min-h-11 bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-phone">Телефон</Label>
                      <Input
                        id="profile-phone"
                        className="min-h-11"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+998 90 123 45 67"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="profile-address">Адрес</Label>
                      <Input
                        id="profile-address"
                        className="min-h-11"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Город, улица, дом"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-muted/30">
                      <p className="text-sm text-muted-foreground mb-1">Email</p>
                      <p className="font-medium text-foreground">{user?.email || "—"}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30">
                      <p className="text-sm text-muted-foreground mb-1">Телефон</p>
                      <p className="font-medium text-foreground">{phone || "—"}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30 sm:col-span-2">
                      <p className="text-sm text-muted-foreground mb-1">Адрес</p>
                      <p className="font-medium text-foreground">{address || "—"}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PatientLayout>
  );
};

export default Profile;
