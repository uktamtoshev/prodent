import { useState, useEffect } from "react";
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

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin } = useAdmin();
  const { isDoctor, isClinicAdmin, role } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");

  // Redirect doctors to their public profile
  useEffect(() => {
    const checkDoctorAndRedirect = async () => {
      if (!authLoading && !user) {
        navigate("/auth");
        return;
      }
      
      if (user && isDoctor) {
        const { data: doctor } = await supabase
          .from('doctors')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (doctor) {
          navigate(`/doctor/${doctor.id}`);
          return;
        }
      }
    };
    
    checkDoctorAndRedirect();
  }, [user, authLoading, isDoctor, navigate]);

  useEffect(() => {
    if (user && !isDoctor) {
      loadProfile();
    }
  }, [user, isDoctor]);

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
        .eq('status', 'completed');
      setCompletedVisits(completed || 0);

      // Upcoming visits - use or filter instead of in
      const { count: upcoming } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', user.id)
        .or('status.eq.pending,status.eq.confirmed')
        .gte('appointment_date', new Date().toISOString());
      setUpcomingVisits(upcoming || 0);

      // Total spent - use RPC or skip for now
      // Payments query causes TypeScript issues due to complex types
    };

    fetchStats();
  }, [user?.id]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setAvatarUrl(data.avatar_url || "");
        setBirthDate(data.birth_date || "");
        setGender(data.gender || "");
        setAddress(data.address || "");
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
    }
  };

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
    } catch (error: any) {
      toast({
        title: "Ошибка загрузки",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
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
    } catch (error: any) {
      toast({
        title: "Ошибка сохранения",
        description: error.message,
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

  return (
    <PatientLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Мой профиль</h1>
            <p className="text-muted-foreground mt-1">Управление личными данными</p>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Отмена
                </Button>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Сохранить
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                <Edit3 className="w-4 h-4 mr-2" />
                Редактировать
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{completedVisits || 0}</p>
                  <p className="text-sm text-muted-foreground">Завершено визитов</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/20">
                  <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{upcomingVisits || 0}</p>
                  <p className="text-sm text-muted-foreground">Предстоящих</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border-violet-500/20 sm:col-span-2 lg:col-span-2">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-500/20">
                  <CreditCard className="w-5 h-5 text-violet-600 dark:text-violet-400" />
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
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {uploading ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6 text-white" />
                    )}
                    <Input
                      id="avatar"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={uploading}
                    />
                  </Label>
                </div>

                <h2 className="text-xl font-bold text-foreground mb-1">
                  {fullName || "Имя не указано"}
                </h2>
                <p className="text-sm text-muted-foreground mb-3">{user?.email}</p>

                <div className="flex flex-wrap gap-2 justify-center">
                  {isClinicAdmin ? (
                    <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                      <Building2 className="w-3 h-3 mr-1" />
                      Администратор
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      <User className="w-3 h-3 mr-1" />
                      Пациент
                    </Badge>
                  )}
                  {isSuperAdmin && (
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
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
                      <Label>Полное имя</Label>
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Введите имя"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Дата рождения</Label>
                      <Input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                      />
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
                      <Label>Email</Label>
                      <Input value={user?.email || ""} disabled className="bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      <Label>Телефон</Label>
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+998 90 123 45 67"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Адрес</Label>
                      <Input
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
