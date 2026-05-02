import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserCheck, Building2, Search, ArrowLeft, Send } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useClinic } from "@/contexts/ClinicContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PatientResult {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

type Step = "search" | "select" | "confirm";

export function AddPatientDialog({ open, onOpenChange }: AddPatientDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentClinic } = useClinic();
  const { user } = useAuth();
  const { isDoctor } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PatientResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const [step, setStep] = useState<Step>("search");
  const [searching, setSearching] = useState(false);

  // Получаем информацию о текущем враче
  const { data: currentDoctor } = useQuery({
    queryKey: ["current-doctor-for-patient", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("doctors")
        .select("id, cooperation_type")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && isDoctor && open,
  });

  const isChairRental = currentDoctor?.cooperation_type === "chair_rental";

  // Сброс при закрытии
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedPatient(null);
      setStep("search");
    }
  }, [open]);

  // Поиск пациентов
  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      toast({
        title: "Введите запрос",
        description: "Минимум 2 символа для поиска",
        variant: "destructive",
      });
      return;
    }

    setSearching(true);
    try {
      const query = searchQuery.trim();
      
      // Поиск по ФИО или телефону
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, avatar_url")
        .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;

      setSearchResults(data || []);
      
      if (data && data.length > 0) {
        if (data.length === 1) {
          // Один результат - сразу выбираем
          setSelectedPatient(data[0]);
          setStep("confirm");
        } else {
          // Несколько результатов - показываем список
          setStep("select");
        }
      } else {
        toast({
          title: "Пациенты не найдены",
          description: "Попробуйте изменить запрос",
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Ошибка поиска",
        description: "Не удалось выполнить поиск",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  // Выбор пациента из списка
  const handleSelectPatient = (patient: PatientResult) => {
    setSelectedPatient(patient);
    setStep("confirm");
  };

  // Отправка запроса пациенту
  const handleSendRequest = async () => {
    if (!currentClinic?.id || !selectedPatient || !user?.id) {
      toast({
        title: "Ошибка",
        description: "Не все данные заполнены",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      // Проверяем, не добавлен ли уже пациент
      const { data: existingMember } = await supabase
        .from("clinic_members")
        .select("id")
        .eq("user_id", selectedPatient.id)
        .eq("clinic_id", currentClinic.id)
        .maybeSingle();

      if (existingMember) {
        toast({
          title: "Пациент уже добавлен",
          description: "Этот пациент уже есть в вашей клинике",
        });
        onOpenChange(false);
        return;
      }

      // Проверяем, нет ли уже активного запроса
      const { data: existingRequest } = await supabase
        .from("patient_add_requests")
        .select("id, status")
        .eq("patient_id", selectedPatient.id)
        .eq("clinic_id", currentClinic.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existingRequest) {
        toast({
          title: "Запрос уже отправлен",
          description: "Ожидайте ответа от пациента",
        });
        onOpenChange(false);
        return;
      }

      // Создаем запрос на добавление
      const requestData: any = {
        clinic_id: currentClinic.id,
        patient_id: selectedPatient.id,
        requested_by: user.id,
        message: isChairRental 
          ? `Врач приглашает вас стать его пациентом` 
          : `Клиника "${currentClinic.name}" приглашает вас стать пациентом`,
      };

      if (isChairRental && currentDoctor?.id) {
        requestData.doctor_id = currentDoctor.id;
      }

      const { error } = await supabase
        .from("patient_add_requests")
        .insert(requestData);

      if (error) throw error;

      toast({
        title: "Запрос отправлен",
        description: "Пациент получит уведомление и сможет принять или отклонить приглашение",
      });

      queryClient.invalidateQueries({ queryKey: ["patient-add-requests"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending request:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось отправить запрос",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            {isChairRental ? (
              <>
                <UserCheck className="w-5 h-5 text-amber-500" />
                Добавить личного пациента
              </>
            ) : (
              <>
                <Building2 className="w-5 h-5 text-primary" />
                Добавить пациента
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {step === "search" && "Введите ФИО или номер телефона для поиска"}
            {step === "select" && "Выберите пациента из списка"}
            {step === "confirm" && "Подтвердите отправку приглашения"}
          </DialogDescription>
        </DialogHeader>

        {/* Шаг 1: Поиск */}
        {step === "search" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search" className="text-slate-300">
                ФИО или телефон
              </Label>
              <div className="flex gap-2">
                <Input
                  id="search"
                  type="text"
                  placeholder="Иванов Иван или +998..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="bg-slate-800 border-slate-700 text-white flex-1"
                />
                <Button
                  onClick={handleSearch}
                  disabled={searching || searchQuery.length < 2}
                  className="bg-[#00C6BB] hover:bg-[#00B0A6]"
                >
                  {searching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Достаточно одного поля для поиска
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Отмена
              </Button>
            </div>
          </div>
        )}

        {/* Шаг 2: Выбор из списка */}
        {step === "select" && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("search")}
              className="text-slate-400 hover:text-white -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Назад к поиску
            </Button>

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {searchResults.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-left"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={patient.avatar_url || undefined} />
                      <AvatarFallback className="bg-slate-700 text-slate-300">
                        {getInitials(patient.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {patient.full_name || "Без имени"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Шаг 3: Подтверждение */}
        {step === "confirm" && selectedPatient && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => searchResults.length > 1 ? setStep("select") : setStep("search")}
              className="text-slate-400 hover:text-white -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Назад
            </Button>

            <div className="flex flex-col items-center gap-4 py-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={selectedPatient.avatar_url || undefined} />
                <AvatarFallback className="bg-slate-700 text-slate-300 text-2xl">
                  {getInitials(selectedPatient.full_name)}
                </AvatarFallback>
              </Avatar>

              <div className="text-center">
                <p className="text-white font-semibold text-lg">
                  {selectedPatient.full_name || "Без имени"}
                </p>
              </div>

              <div className="bg-slate-800 rounded-lg p-4 w-full text-center">
                <Send className="w-8 h-8 text-[#00C6BB] mx-auto mb-2" />
                <p className="text-slate-300 text-sm">
                  Пациенту будет отправлен запрос на добавление.
                  После подтверждения он появится в списке пациентов.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Отмена
              </Button>
              <Button
                onClick={handleSendRequest}
                disabled={loading}
                className="bg-[#00C6BB] hover:bg-[#00B0A6]"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Отправить запрос
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
