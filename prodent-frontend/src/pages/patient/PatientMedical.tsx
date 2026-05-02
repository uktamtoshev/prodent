import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/api/client";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ClipboardList, 
  Stethoscope, 
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  HeartPulse
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { UltraRealisticDentalChart } from "@/components/patient/dental/UltraRealisticDentalChart";
import { formatPrice } from "@/lib/utils";

const PatientMedical = () => {
  const { user } = useAuth();
  const [treatmentPlans, setTreatmentPlans] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [birthDate, setBirthDate] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchMedicalData();
      fetchProfile();
    }
  }, [user?.id]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('birth_date')
      .eq('id', user?.id)
      .single();
    if (data?.birth_date) setBirthDate(data.birth_date);
  };

  const fetchMedicalData = async () => {
    setLoading(true);
    try {
      const { data: plans } = await supabase
        .from('treatment_plans')
        .select('*')
        .eq('patient_id', user?.id)
        .order('created_at', { ascending: false }) as any;
      if (plans) setTreatmentPlans(plans);

      const { data: recs } = await supabase
        .from('patient_recommendations')
        .select('*')
        .eq('patient_id', user?.id)
        .order('created_at', { ascending: false }) as any;
      if (recs) setRecommendations(recs);

      const { data: patientFiles } = await supabase
        .from('patient_files')
        .select('*')
        .eq('patient_id', user?.id)
        .order('created_at', { ascending: false }) as any;
      if (patientFiles) setFiles(patientFiles);
    } catch (error) {
      console.error('Error fetching medical data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Завершён</Badge>;
      case 'in_progress':
        return <Badge className="bg-sky-500/10 text-sky-600 border-sky-500/20"><Clock className="w-3 h-3 mr-1" />В процессе</Badge>;
      default:
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20"><AlertCircle className="w-3 h-3 mr-1" />Ожидает</Badge>;
    }
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
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-tashkent-sky shadow-medium">
            <HeartPulse className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-foreground">Медицинская карта</h1>
            <p className="text-muted-foreground mt-1">Ваша медицинская история и зубная формула</p>
          </div>
        </div>

        {/* Realistic Dental Chart */}
        <UltraRealisticDentalChart birthDate={birthDate} />

        <Tabs defaultValue="plans" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="plans"><ClipboardList className="w-4 h-4 mr-2" />Планы лечения</TabsTrigger>
            <TabsTrigger value="recommendations"><Stethoscope className="w-4 h-4 mr-2" />Рекомендации</TabsTrigger>
            <TabsTrigger value="files"><ImageIcon className="w-4 h-4 mr-2" />Снимки</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="space-y-4">
            {treatmentPlans.length > 0 ? treatmentPlans.map(plan => (
              <Card key={plan.id} className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      {getStatusBadge(plan.status)}
                      <h3 className="font-semibold mt-2">{plan.service_name || 'План лечения'}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(plan.created_at), 'd MMMM yyyy', { locale: ru })}
                      </p>
                    </div>
                    <p className="text-lg font-bold">{formatPrice(plan.price || 0)}</p>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <Card className="border-border/50">
                <CardContent className="text-center py-12">
                  <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Нет планов лечения</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            {recommendations.length > 0 ? recommendations.map(rec => (
              <Card key={rec.id} className="border-border/50">
                <CardContent className="p-5">
                  <h3 className="font-semibold">{rec.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                </CardContent>
              </Card>
            )) : (
              <Card className="border-border/50">
                <CardContent className="text-center py-12">
                  <Stethoscope className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Нет рекомендаций</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="files">
            {files.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {files.map(file => (
                  <Card key={file.id} className="border-border/50 overflow-hidden">
                    <div className="aspect-square bg-muted flex items-center justify-center">
                      {file.file_url ? (
                        <img src={file.file_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-4xl">📄</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-border/50">
                <CardContent className="text-center py-12">
                  <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Нет снимков</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PatientLayout>
  );
};

export default PatientMedical;
