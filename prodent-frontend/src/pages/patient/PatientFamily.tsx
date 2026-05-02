import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/api/client";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2,
  Loader2,
  Baby,
  User,
  Heart
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface FamilyMember {
  id: string;
  full_name: string;
  relationship: string;
  birth_date: string | null;
  gender: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
}

const PatientFamily = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  
  const [formData, setFormData] = useState({
    full_name: '',
    relationship: '',
    birth_date: '',
    gender: '',
    phone: '',
    notes: ''
  });

  useEffect(() => {
    if (user?.id) {
      fetchMembers();
    }
  }, [user?.id]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('patient_family_members')
        .select('*')
        .eq('main_patient_id', user?.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (data) {
        setMembers(data);
      }
    } catch (error) {
      console.error('Error fetching family members:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      relationship: '',
      birth_date: '',
      gender: '',
      phone: '',
      notes: ''
    });
    setEditingMember(null);
  };

  const openEditDialog = (member: FamilyMember) => {
    setEditingMember(member);
    setFormData({
      full_name: member.full_name,
      relationship: member.relationship,
      birth_date: member.birth_date || '',
      gender: member.gender || '',
      phone: member.phone || '',
      notes: member.notes || ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.full_name || !formData.relationship) {
      toast({
        title: "Ошибка",
        description: "Заполните обязательные поля",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      if (editingMember) {
        const { error } = await supabase
          .from('patient_family_members')
          .update({
            full_name: formData.full_name,
            relationship: formData.relationship,
            birth_date: formData.birth_date || null,
            gender: formData.gender || null,
            phone: formData.phone || null,
            notes: formData.notes || null
          })
          .eq('id', editingMember.id);

        if (error) throw error;
        toast({ title: "Профиль обновлён" });
      } else {
        const { error } = await supabase
          .from('patient_family_members')
          .insert({
            main_patient_id: user?.id,
            full_name: formData.full_name,
            relationship: formData.relationship,
            birth_date: formData.birth_date || null,
            gender: formData.gender || null,
            phone: formData.phone || null,
            notes: formData.notes || null
          });

        if (error) throw error;
        toast({ title: "Профиль добавлен" });
      }

      setDialogOpen(false);
      resetForm();
      fetchMembers();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('patient_family_members')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: "Профиль удалён" });
      fetchMembers();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getRelationshipLabel = (rel: string) => {
    switch (rel) {
      case 'child': return 'Ребёнок';
      case 'parent': return 'Родитель';
      case 'spouse': return 'Супруг(а)';
      case 'sibling': return 'Брат/Сестра';
      default: return rel;
    }
  };

  const getRelationshipIcon = (rel: string) => {
    switch (rel) {
      case 'child': return <Baby className="w-5 h-5" />;
      case 'spouse': return <Heart className="w-5 h-5" />;
      default: return <User className="w-5 h-5" />;
    }
  };

  const getRelationshipColor = (rel: string) => {
    switch (rel) {
      case 'child': return 'bg-sky-500/10 text-sky-600 border-sky-500/20';
      case 'parent': return 'bg-violet-500/10 text-violet-600 border-violet-500/20';
      case 'spouse': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      case 'sibling': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      default: return '';
    }
  };

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-foreground">Семейные профили</h1>
            <p className="text-muted-foreground mt-1">Управление профилями членов семьи</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Добавить
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingMember ? 'Редактировать профиль' : 'Добавить члена семьи'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>ФИО *</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Введите полное имя"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Кем приходится *</Label>
                  <Select
                    value={formData.relationship}
                    onValueChange={(value) => setFormData({ ...formData, relationship: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="child">Ребёнок</SelectItem>
                      <SelectItem value="parent">Родитель</SelectItem>
                      <SelectItem value="spouse">Супруг(а)</SelectItem>
                      <SelectItem value="sibling">Брат/Сестра</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Дата рождения</Label>
                    <Input
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Пол</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => setFormData({ ...formData, gender: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Мужской</SelectItem>
                        <SelectItem value="female">Женский</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Телефон</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Примечания</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Дополнительная информация"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingMember ? 'Сохранить' : 'Добавить'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info Card */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Семейные профили</h3>
                <p className="text-sm text-muted-foreground">
                  Добавьте профили членов вашей семьи для удобной записи на приём. 
                  Вы сможете записывать детей и родственников прямо из своего кабинета.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Family Members */}
        {members.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map(member => {
              const age = calculateAge(member.birth_date);
              return (
                <Card key={member.id} className="border-border/50 hover:border-primary/20 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12 bg-muted">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {member.full_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-foreground">{member.full_name}</h3>
                          <Badge className={`text-xs ${getRelationshipColor(member.relationship)}`}>
                            {getRelationshipIcon(member.relationship)}
                            <span className="ml-1">{getRelationshipLabel(member.relationship)}</span>
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm mb-4">
                      {member.birth_date && (
                        <p className="text-muted-foreground">
                          {format(new Date(member.birth_date), 'd MMMM yyyy', { locale: ru })}
                          {age !== null && <span className="ml-1">({age} лет)</span>}
                        </p>
                      )}
                      {member.phone && (
                        <p className="text-muted-foreground">{member.phone}</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => openEditDialog(member)}
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Изменить
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(member.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-border/50">
            <CardContent className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-2">Нет профилей</h3>
              <p className="text-muted-foreground mb-4">
                Добавьте членов семьи для удобной записи
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Добавить члена семьи
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </PatientLayout>
  );
};

export default PatientFamily;
