import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
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
import { Button } from "@/components/ui/button";
import { usePrivatePatientFileUrl } from "@/components/crm/files/usePrivatePatientFileUrl";
import { listPatientFiles } from "@/lib/patient-files-api";

type TreatmentPlan = Database["public"]["Tables"]["treatment_plans"]["Row"];
type PatientRecommendation = Database["public"]["Tables"]["patient_recommendations"]["Row"];
type PatientFile = Database["public"]["Tables"]["patient_files"]["Row"];

function PrivateMedicalImage({ file }: { file: PatientFile }) {
  const { url, loading } = usePrivatePatientFileUrl(file.file_url);
  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  return url ? (
    <img src={url} alt={file.title || ""} className="h-full w-full object-cover" />
  ) : (
    <span className="text-4xl">📄</span>
  );
}

const PatientMedical = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [treatmentPlans, setTreatmentPlans] = useState<TreatmentPlan[]>([]);
  const [recommendations, setRecommendations] = useState<PatientRecommendation[]>([]);
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const medicalRequestRef = useRef(0);
  const profileRequestRef = useRef(0);

  const fetchProfile = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;
    const requestId = ++profileRequestRef.current;
    const { data } = await supabase
      .from('profiles')
      .select('date_of_birth')
      .eq('id', userId)
      .single();
    if (requestId === profileRequestRef.current) {
      setBirthDate(data?.date_of_birth || null);
    }
  }, [user?.id]);

  const fetchMedicalData = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;
    const requestId = ++medicalRequestRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const { data: plans, error: plansError } = await supabase
        .from('treatment_plans')
        .select('*')
        .eq('patient_id', userId)
        .order('created_at', { ascending: false });
      if (plansError) throw plansError;
      if (requestId !== medicalRequestRef.current) return;
      setTreatmentPlans(plans || []);

      const { data: recs, error: recsError } = await supabase
        .from('patient_recommendations')
        .select('*')
        .eq('patient_id', userId)
        .order('created_at', { ascending: false });
      if (recsError) throw recsError;
      if (requestId !== medicalRequestRef.current) return;
      setRecommendations(recs || []);

      const { data: patientFiles, error: filesError } = await listPatientFiles(userId);
      if (filesError) throw filesError;
      if (requestId !== medicalRequestRef.current) return;
      setFiles(patientFiles || []);
    } catch (error) {
      if (requestId !== medicalRequestRef.current) return;
      console.error('Error fetching medical data:', error);
      setLoadError(
        error instanceof Error ? error.message : t("common.error"),
      );
    } finally {
      if (requestId === medicalRequestRef.current) setLoading(false);
    }
  }, [t, user?.id]);

  useEffect(() => {
    if (user?.id) {
      void fetchMedicalData();
      void fetchProfile();
    } else {
      medicalRequestRef.current += 1;
      profileRequestRef.current += 1;
      setTreatmentPlans([]);
      setRecommendations([]);
      setFiles([]);
      setBirthDate(null);
      setLoading(false);
    }
    return () => {
      medicalRequestRef.current += 1;
      profileRequestRef.current += 1;
    };
  }, [user?.id, fetchMedicalData, fetchProfile]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />{t("patientCabinet.statusCompletedShort")}</Badge>;
      case 'in_progress':
        return <Badge className="bg-sky-500/10 text-sky-600 border-sky-500/20"><Clock className="w-3 h-3 mr-1" />{t("patientCabinet.statusInProgress")}</Badge>;
      default:
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20"><AlertCircle className="w-3 h-3 mr-1" />{t("patientCabinet.statusPendingShort")}</Badge>;
    }
  };

  

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center min-h-[400px]" role="status" aria-live="polite">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="sr-only">{t("common.loading")}</span>
        </div>
      </PatientLayout>
    );
  }

  if (loadError) {
    return (
      <PatientLayout>
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 p-4 text-center" role="alert">
          <p className="text-sm font-medium text-destructive">{t("common.error")}</p>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void fetchMedicalData()}>
            Повторить
          </Button>
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="min-w-0 space-y-6 p-3 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-tashkent-sky shadow-medium">
            <HeartPulse className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-foreground">{t("patientCabinet.medicalCard")}</h1>
            <p className="text-muted-foreground mt-1">{t("patientCabinet.medicalCardDesc")}</p>
          </div>
        </div>

        {/* Realistic Dental Chart */}
        <UltraRealisticDentalChart birthDate={birthDate} />

        <Tabs defaultValue="plans" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="plans"><ClipboardList className="w-4 h-4 mr-2" />{t("patientCabinet.treatmentPlans")}</TabsTrigger>
            <TabsTrigger value="recommendations"><Stethoscope className="w-4 h-4 mr-2" />{t("patientCabinet.recommendations")}</TabsTrigger>
            <TabsTrigger value="files"><ImageIcon className="w-4 h-4 mr-2" />{t("patientCabinet.photos")}</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="space-y-4">
            {treatmentPlans.length > 0 ? treatmentPlans.map(plan => (
              <Card key={plan.id} className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      {getStatusBadge(plan.status)}
                      <h3 className="font-semibold mt-2">{plan.title || t("patientCabinet.treatmentPlansLabel")}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(plan.created_at), 'd MMMM yyyy', { locale: ru })}
                      </p>
                    </div>
                    <p className="text-lg font-bold">{formatPrice(plan.total_cost || 0)}</p>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <Card className="border-border/50">
                <CardContent className="text-center py-12">
                  <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">{t("patientCabinet.noTreatmentPlans")}</p>
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
                  <p className="text-muted-foreground">{t("patientCabinet.noRecsShort")}</p>
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
                      <PrivateMedicalImage file={file} />
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-border/50">
                <CardContent className="text-center py-12">
                  <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">{t("patientCabinet.noPhotosShort")}</p>
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
