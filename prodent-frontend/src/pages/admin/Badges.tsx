import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Award,
  Crown,
  ThumbsUp,
  Gem,
  Sparkles,
  Heart,
  Zap,
  BadgePercent,
  Building2,
  TrendingUp,
  Plus,
  Trash2,
  Loader2,
  Calendar,
  User,
  Search,
  Pencil,
  Star,
} from "lucide-react";

// Icon map for dynamic rendering
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Award,
  Crown,
  ThumbsUp,
  Gem,
  Sparkles,
  Heart,
  Zap,
  BadgePercent,
  Building2,
  TrendingUp,
  Star,
};

const availableIcons = Object.keys(iconMap);

interface BadgeType {
  id: string;
  name: string;
  name_uz: string | null;
  name_en: string | null;
  description: string | null;
  icon: string;
  color: string;
  bg_color: string;
  is_active: boolean;
  target_type: "doctor" | "clinic";
}

interface BadgeAssignment {
  id: string;
  badge_id: string;
  doctor_id: string | null;
  clinic_id: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  notes: string | null;
  badges: BadgeType;
  doctors?: { id: string; specialty: string; profiles: { full_name: string } | null } | null;
  clinics?: { id: string; name: string } | null;
}

export default function AdminBadges() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"doctor" | "clinic">("doctor");
  
  // Dialog states
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editBadgeDialogOpen, setEditBadgeDialogOpen] = useState(false);
  const [createBadgeDialogOpen, setCreateBadgeDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<BadgeType | null>(null);
  
  // Assignment form
  const [selectedBadge, setSelectedBadge] = useState<string>("");
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Badge form (for create/edit)
  const [editName, setEditName] = useState("");
  const [editNameUz, setEditNameUz] = useState("");
  const [editNameEn, setEditNameEn] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIcon, setEditIcon] = useState("Award");
  const [editColor, setEditColor] = useState("#3B82F6");
  const [editBgColor, setEditBgColor] = useState("#EFF6FF");
  const [editIsActive, setEditIsActive] = useState(true);

  // Fetch badges by type
  const { data: doctorBadges, isLoading: doctorBadgesLoading } = useQuery({
    queryKey: ["admin-badges", "doctor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badges")
        .select("*")
        .eq("target_type", "doctor")
        .order("name");
      if (error) throw error;
      return data as BadgeType[];
    },
  });

  const { data: clinicBadges, isLoading: clinicBadgesLoading } = useQuery({
    queryKey: ["admin-badges", "clinic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badges")
        .select("*")
        .eq("target_type", "clinic")
        .order("name");
      if (error) throw error;
      return data as BadgeType[];
    },
  });

  // Fetch assignments by type
  const { data: doctorAssignments, isLoading: doctorAssignmentsLoading } = useQuery({
    queryKey: ["admin-badge-assignments", "doctor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badge_assignments")
        .select(`
          *,
          badges!inner(*),
          doctors(id, specialty, profiles:user_id(full_name))
        `)
        .not("doctor_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BadgeAssignment[];
    },
  });

  const { data: clinicAssignments, isLoading: clinicAssignmentsLoading } = useQuery({
    queryKey: ["admin-badge-assignments", "clinic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badge_assignments")
        .select(`
          *,
          badges!inner(*),
          clinics(id, name)
        `)
        .not("clinic_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BadgeAssignment[];
    },
  });

  // Fetch doctors/clinics for selection
  const { data: doctors } = useQuery({
    queryKey: ["admin-doctors-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id, specialty, profiles:user_id(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clinics } = useQuery({
    queryKey: ["admin-clinics-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinics")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const assignBadge = useMutation({
    mutationFn: async () => {
      const startISO = `${startDate}T00:00:00.000Z`;
      const endISO = `${endDate}T23:59:59.999Z`;

      const { error } = await supabase.from("badge_assignments").insert({
        badge_id: selectedBadge,
        doctor_id: activeTab === "doctor" ? selectedTarget : null,
        clinic_id: activeTab === "clinic" ? selectedTarget : null,
        start_date: startISO,
        end_date: endISO,
        notes: notes || null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Бейдж успешно назначен");
      queryClient.invalidateQueries({ queryKey: ["admin-badge-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["active-badges"] });
      setAssignDialogOpen(false);
      resetAssignForm();
    },
    onError: (error: any) => {
      toast.error("Ошибка назначения бейджа", { description: error.message });
    },
  });

  const updateBadge = useMutation({
    mutationFn: async () => {
      if (!editingBadge) return;
      const { error } = await supabase
        .from("badges")
        .update({
          name: editName,
          name_uz: editNameUz || null,
          name_en: editNameEn || null,
          description: editDescription || null,
          icon: editIcon,
          color: editColor,
          bg_color: editBgColor,
          is_active: editIsActive,
        })
        .eq("id", editingBadge.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Бейдж обновлён");
      queryClient.invalidateQueries({ queryKey: ["admin-badges"] });
      setEditBadgeDialogOpen(false);
      setEditingBadge(null);
    },
    onError: (error: any) => {
      toast.error("Ошибка обновления", { description: error.message });
    },
  });

  const createBadge = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("badges").insert({
        name: editName,
        name_uz: editNameUz || null,
        name_en: editNameEn || null,
        description: editDescription || null,
        icon: editIcon,
        color: editColor,
        bg_color: editBgColor,
        is_active: editIsActive,
        target_type: activeTab,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Бейдж создан");
      queryClient.invalidateQueries({ queryKey: ["admin-badges"] });
      setCreateBadgeDialogOpen(false);
      resetBadgeForm();
    },
    onError: (error: any) => {
      toast.error("Ошибка создания", { description: error.message });
    },
  });

  const deleteBadge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("badges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Бейдж удалён");
      queryClient.invalidateQueries({ queryKey: ["admin-badges"] });
      setEditBadgeDialogOpen(false);
      setEditingBadge(null);
    },
    onError: (error: any) => {
      toast.error("Ошибка удаления", { description: error.message });
    },
  });

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("badge_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Назначение удалено");
      queryClient.invalidateQueries({ queryKey: ["admin-badge-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["active-badges"] });
    },
    onError: (error: any) => {
      toast.error("Ошибка удаления", { description: error.message });
    },
  });

  const resetAssignForm = () => {
    setSelectedBadge("");
    setSelectedTarget("");
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setEndDate("");
    setNotes("");
    setSearchQuery("");
  };

  const resetBadgeForm = () => {
    setEditName("");
    setEditNameUz("");
    setEditNameEn("");
    setEditDescription("");
    setEditIcon("Award");
    setEditColor("#3B82F6");
    setEditBgColor("#EFF6FF");
    setEditIsActive(true);
  };

  const openCreateBadge = () => {
    resetBadgeForm();
    setCreateBadgeDialogOpen(true);
  };

  const openEditBadge = (badge: BadgeType) => {
    setEditingBadge(badge);
    setEditName(badge.name);
    setEditNameUz(badge.name_uz || "");
    setEditNameEn(badge.name_en || "");
    setEditDescription(badge.description || "");
    setEditIcon(badge.icon);
    setEditColor(badge.color);
    setEditBgColor(badge.bg_color);
    setEditIsActive(badge.is_active);
    setEditBadgeDialogOpen(true);
  };

  const filteredDoctors = doctors?.filter((d) =>
    (d.profiles?.full_name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredClinics = clinics?.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAssignmentActive = (assignment: BadgeAssignment) => {
    const now = new Date();
    const start = new Date(assignment.start_date);
    const end = new Date(assignment.end_date);
    return assignment.is_active && now >= start && now <= end;
  };

  const renderIcon = (iconName: string, color: string) => {
    const IconComponent = iconMap[iconName] || Award;
    return <IconComponent className="w-5 h-5" style={{ color }} />;
  };

  const currentBadges = activeTab === "doctor" ? doctorBadges : clinicBadges;
  const currentAssignments = activeTab === "doctor" ? doctorAssignments : clinicAssignments;
  const badgesLoading = activeTab === "doctor" ? doctorBadgesLoading : clinicBadgesLoading;
  const assignmentsLoading = activeTab === "doctor" ? doctorAssignmentsLoading : clinicAssignmentsLoading;

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Управление бейджами</h1>
            <p className="text-slate-400 mt-1">
              Создавайте и назначайте рекламные бейджи врачам и клиникам
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openCreateBadge} className="gap-2">
              <Plus className="w-4 h-4" />
              Создать бейдж
            </Button>
            <Button onClick={() => setAssignDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Назначить бейдж
            </Button>
          </div>
        </div>

        {/* Main tabs: Doctors / Clinics */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "doctor" | "clinic")} className="space-y-6">
          <TabsList className="bg-slate-800/50">
            <TabsTrigger value="doctor" className="gap-2">
              <User className="w-4 h-4" />
              Бейджи врачей
            </TabsTrigger>
            <TabsTrigger value="clinic" className="gap-2">
              <Building2 className="w-4 h-4" />
              Бейджи клиник
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <div className="space-y-6">
              {/* Available Badges */}
              <Card className="border-slate-700/50 bg-slate-800/30">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Доступные бейджи {activeTab === "doctor" ? "врачей" : "клиник"} ({currentBadges?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {badgesLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                      {currentBadges?.map((badge) => (
                        <div
                          key={badge.id}
                          className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/50 hover:bg-slate-700/50 transition-colors relative group"
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                            onClick={() => openEditBadge(badge)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <div className="flex items-center gap-3 mb-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: badge.bg_color }}
                            >
                              {renderIcon(badge.icon, badge.color)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-white text-sm">{badge.name}</h3>
                              {!badge.is_active && (
                                <Badge variant="secondary" className="text-xs">Неактивен</Badge>
                              )}
                            </div>
                          </div>
                          {badge.description && (
                            <p className="text-xs text-slate-400 line-clamp-2">{badge.description}</p>
                          )}
                          <div className="mt-3">
                            <Badge
                              style={{
                                backgroundColor: badge.bg_color,
                                color: badge.color,
                                borderColor: badge.color,
                              }}
                              className="gap-1 text-xs"
                            >
                              {renderIcon(badge.icon, badge.color)}
                              {badge.name}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Assignments */}
              <Card className="border-slate-700/50 bg-slate-800/30">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Назначения ({currentAssignments?.filter(isAssignmentActive).length || 0} активных)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {assignmentsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : currentAssignments?.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      Нет назначенных бейджей
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700/50">
                            <TableHead className="text-slate-300">Бейдж</TableHead>
                            <TableHead className="text-slate-300">Получатель</TableHead>
                            <TableHead className="text-slate-300">Период</TableHead>
                            <TableHead className="text-slate-300">Статус</TableHead>
                            <TableHead className="text-slate-300">Заметки</TableHead>
                            <TableHead className="text-slate-300 text-right">Действия</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentAssignments?.map((assignment) => (
                            <TableRow key={assignment.id} className="border-slate-700/50">
                              <TableCell>
                                <Badge
                                  style={{
                                    backgroundColor: assignment.badges.bg_color,
                                    color: assignment.badges.color,
                                  }}
                                  className="gap-1"
                                >
                                  {renderIcon(assignment.badges.icon, assignment.badges.color)}
                                  {assignment.badges.name}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {activeTab === "doctor" ? (
                                    <>
                                      <User className="w-4 h-4 text-blue-400" />
                                      <span className="text-slate-300">
                                        {assignment.doctors?.profiles?.full_name || "Врач"}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Building2 className="w-4 h-4 text-purple-400" />
                                      <span className="text-slate-300">
                                        {assignment.clinics?.name || "Клиника"}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-slate-400 text-sm">
                                {format(new Date(assignment.start_date), "dd.MM.yyyy", { locale: ru })}
                                {" — "}
                                {format(new Date(assignment.end_date), "dd.MM.yyyy", { locale: ru })}
                              </TableCell>
                              <TableCell>
                                {isAssignmentActive(assignment) ? (
                                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                    Активен
                                  </Badge>
                                ) : new Date(assignment.end_date) < new Date() ? (
                                  <Badge variant="secondary" className="bg-slate-700 text-slate-400">
                                    Истёк
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                                    Запланирован
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-slate-400 text-sm max-w-[200px] truncate">
                                {assignment.notes || "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeAssignment.mutate(assignment.id)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Assign Badge Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Назначить бейдж {activeTab === "doctor" ? "врачу" : "клинике"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Выберите бейдж</Label>
                <Select value={selectedBadge} onValueChange={setSelectedBadge}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите бейдж..." />
                  </SelectTrigger>
                  <SelectContent>
                    {currentBadges?.filter(b => b.is_active).map((badge) => (
                      <SelectItem key={badge.id} value={badge.id}>
                        <div className="flex items-center gap-2">
                          {renderIcon(badge.icon, badge.color)}
                          {badge.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {activeTab === "doctor" ? "Выберите врача" : "Выберите клинику"}
                </Label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={activeTab === "doctor" ? "Выберите врача..." : "Выберите клинику..."}
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {activeTab === "doctor"
                      ? filteredDoctors?.map((doctor) => (
                          <SelectItem key={doctor.id} value={doctor.id}>
                            {doctor.profiles?.full_name || "Врач"} — {doctor.specialty}
                          </SelectItem>
                        ))
                      : filteredClinics?.map((clinic) => (
                          <SelectItem key={clinic.id} value={clinic.id}>
                            {clinic.name}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Дата начала</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Дата окончания</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Заметки (необязательно)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Заметки о назначении..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Отмена
              </Button>
              <Button
                onClick={() => assignBadge.mutate()}
                disabled={!selectedBadge || !selectedTarget || !endDate || assignBadge.isPending}
              >
                {assignBadge.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Назначить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Badge Dialog */}
        <Dialog open={editBadgeDialogOpen} onOpenChange={setEditBadgeDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Редактировать бейдж</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Название (RU)</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Название (UZ)</Label>
                  <Input value={editNameUz} onChange={(e) => setEditNameUz(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Название (EN)</Label>
                  <Input value={editNameEn} onChange={(e) => setEditNameEn(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Иконка</Label>
                <Select value={editIcon} onValueChange={setEditIcon}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableIcons.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        <div className="flex items-center gap-2">
                          {renderIcon(icon, editColor || "#3B82F6")}
                          {icon}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Цвет иконки</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Цвет фона</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={editBgColor}
                      onChange={(e) => setEditBgColor(e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={editBgColor}
                      onChange={(e) => setEditBgColor(e.target.value)}
                      placeholder="#EFF6FF"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="isActive">Активен</Label>
              </div>

              {/* Preview */}
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <Label className="text-slate-400 text-xs mb-2 block">Предпросмотр</Label>
                <Badge
                  style={{
                    backgroundColor: editBgColor,
                    color: editColor,
                    borderColor: editColor,
                  }}
                  className="gap-1"
                >
                  {renderIcon(editIcon, editColor)}
                  {editName || "Название бейджа"}
                </Badge>
              </div>
            </div>

            <DialogFooter className="flex justify-between sm:justify-between">
              <Button 
                variant="destructive" 
                onClick={() => editingBadge && deleteBadge.mutate(editingBadge.id)}
                disabled={deleteBadge.isPending}
              >
                {deleteBadge.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                <Trash2 className="w-4 h-4 mr-2" />
                Удалить
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditBadgeDialogOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={() => updateBadge.mutate()} disabled={!editName || updateBadge.isPending}>
                  {updateBadge.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Сохранить
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Badge Dialog */}
        <Dialog open={createBadgeDialogOpen} onOpenChange={setCreateBadgeDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Создать бейдж для {activeTab === "doctor" ? "врачей" : "клиник"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Название (RU) *</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Например: Лучший врач" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Название (UZ)</Label>
                  <Input value={editNameUz} onChange={(e) => setEditNameUz(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Название (EN)</Label>
                  <Input value={editNameEn} onChange={(e) => setEditNameEn(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  placeholder="Краткое описание бейджа..."
                />
              </div>

              <div className="space-y-2">
                <Label>Иконка</Label>
                <Select value={editIcon} onValueChange={setEditIcon}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableIcons.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        <div className="flex items-center gap-2">
                          {renderIcon(icon, editColor || "#3B82F6")}
                          {icon}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Цвет иконки</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Цвет фона</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={editBgColor}
                      onChange={(e) => setEditBgColor(e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={editBgColor}
                      onChange={(e) => setEditBgColor(e.target.value)}
                      placeholder="#EFF6FF"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="createIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="createIsActive">Активен</Label>
              </div>

              {/* Preview */}
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <Label className="text-slate-400 text-xs mb-2 block">Предпросмотр</Label>
                <Badge
                  style={{
                    backgroundColor: editBgColor,
                    color: editColor,
                    borderColor: editColor,
                  }}
                  className="gap-1"
                >
                  {renderIcon(editIcon, editColor)}
                  {editName || "Название бейджа"}
                </Badge>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateBadgeDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={() => createBadge.mutate()} disabled={!editName || createBadge.isPending}>
                {createBadge.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
