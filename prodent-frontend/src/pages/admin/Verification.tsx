import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle, XCircle, FileText, ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EditDoctorApplicationDialog } from "@/components/admin/EditDoctorApplicationDialog";
import { EditClinicApplicationDialog } from "@/components/admin/EditClinicApplicationDialog";

export default function Verification() {
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState<{ [key: string]: string }>({});
  const [editingDoctor, setEditingDoctor] = useState<any | null>(null);
  const [editingClinic, setEditingClinic] = useState<any | null>(null);

  const { data: doctorApplications, isLoading: doctorsLoading } = useQuery({
    queryKey: ["doctor-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_applications")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: clinicApplications, isLoading: clinicsLoading } = useQuery({
    queryKey: ["clinic-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_applications")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const approveDoctorMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const app = doctorApplications?.find((a) => a.id === applicationId);
      if (!app) throw new Error("Application not found");

      // Find existing doctor profile and update verified status
      const { data: existingDoctor } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", app.user_id)
        .maybeSingle();

      if (existingDoctor) {
        // Update existing doctor to verified
        const { error: updateDoctorError } = await supabase
          .from("doctors")
          .update({ verified: true })
          .eq("id", existingDoctor.id);

        if (updateDoctorError) throw updateDoctorError;

        // Ensure doctor role exists in user_roles
        await supabase
          .from("user_roles")
          .upsert({
            user_id: app.user_id,
            role: "doctor" as any,
          }, { onConflict: 'user_id,role' });
      } else {
        // Fallback: Create doctor profile if it doesn't exist (for legacy applications)
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", app.user_id)
          .single();

        const { error: doctorError } = await supabase
          .from("doctors")
          .insert({
            user_id: app.user_id,
            specialty: app.specialty,
            experience_years: app.experience_years,
            education: app.education,
            certifications: app.certifications,
            bio: app.bio,
            price_from: 100000,
            verified: true,
            images: profile?.avatar_url ? [profile.avatar_url] : null,
          });

        if (doctorError) throw doctorError;

        // Add doctor role to user_roles
        await supabase
          .from("user_roles")
          .insert({
            user_id: app.user_id,
            role: "doctor" as any,
          });
      }

      // Update application status
      const { error: updateError } = await supabase
        .from("doctor_applications")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", applicationId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Заявка врача одобрена");
      queryClient.invalidateQueries({ queryKey: ["doctor-applications"] });
    },
    onError: (error: any) => {
      toast.error("Ошибка одобрения заявки", { description: error.message });
    },
  });

  const rejectDoctorMutation = useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason: string }) => {
      const { error } = await supabase
        .from("doctor_applications")
        .update({
          status: "rejected",
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", applicationId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Заявка отклонена");
      queryClient.invalidateQueries({ queryKey: ["doctor-applications"] });
      setRejectionReason({});
    },
    onError: (error: any) => {
      toast.error("Ошибка отклонения заявки", { description: error.message });
    },
  });

  const approveClinicMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const app = clinicApplications?.find((a) => a.id === applicationId);
      if (!app) throw new Error("Application not found");

      // Create clinic with logo from application
      const { data: clinic, error: clinicError } = await supabase
        .from("clinics")
        .insert({
          name: app.name,
          description: app.description,
          address: app.address,
          city: app.city,
          district: app.district,
          phone: app.phone,
          email: app.email,
          website: app.website,
          verified: true,
          images: app.logo_url ? [app.logo_url] : null,
        })
        .select()
        .single();

      if (clinicError) throw clinicError;

      // Add user to clinic_members as clinic_admin
      const { error: memberError } = await supabase
        .from("clinic_members")
        .insert({
          clinic_id: clinic.id,
          user_id: app.user_id,
          role: "clinic_admin" as any,
        });

      if (memberError) {
        console.error("Error adding clinic member:", memberError);
      }

      // Add clinic_admin role to user_roles
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: app.user_id,
          role: "clinic_admin" as any,
        });

      if (roleError && !roleError.message.includes("duplicate")) {
        console.error("Error adding clinic_admin role:", roleError);
      }

      // Update application status
      const { error: updateError } = await supabase
        .from("clinic_applications")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", applicationId);

      if (updateError) throw updateError;

      return clinic;
    },
    onSuccess: () => {
      toast.success("Заявка клиники одобрена");
      queryClient.invalidateQueries({ queryKey: ["clinic-applications"] });
    },
    onError: (error: any) => {
      toast.error("Ошибка одобрения заявки", { description: error.message });
    },
  });

  const rejectClinicMutation = useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason: string }) => {
      const { error } = await supabase
        .from("clinic_applications")
        .update({
          status: "rejected",
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", applicationId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Заявка отклонена");
      queryClient.invalidateQueries({ queryKey: ["clinic-applications"] });
      setRejectionReason({});
    },
    onError: (error: any) => {
      toast.error("Ошибка отклонения заявки", { description: error.message });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Ожидает</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Одобрено</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Отклонено</Badge>;
      default:
        return null;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Валидация заявок</h1>
          <p className="text-muted-foreground mt-2">
            Проверка и одобрение заявок врачей и клиник
          </p>
        </div>

        <Tabs defaultValue="doctors" className="space-y-4">
          <TabsList>
            <TabsTrigger value="doctors">
              Врачи ({doctorApplications?.filter((a) => a.status === "pending").length || 0})
            </TabsTrigger>
            <TabsTrigger value="clinics">
              Клиники ({clinicApplications?.filter((a) => a.status === "pending").length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="doctors" className="space-y-4">
            {doctorsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : doctorApplications && doctorApplications.length > 0 ? (
              doctorApplications.map((app) => (
                <Card key={app.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">{app.full_name}</CardTitle>
                        <CardDescription>{app.specialty} • {app.experience_years} лет опыта</CardDescription>
                      </div>
                      {getStatusBadge(app.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Email</p>
                        <p className="font-medium">{app.email}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Телефон</p>
                        <p className="font-medium">{app.phone}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Номер лицензии</p>
                        <p className="font-medium">{app.license_number}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Образование</p>
                        <p className="font-medium">{app.education}</p>
                      </div>
                    </div>

                    {app.bio && (
                      <div>
                        <p className="text-muted-foreground text-sm">О себе</p>
                        <p className="text-sm mt-1">{app.bio}</p>
                      </div>
                    )}

                    {app.certifications && app.certifications.length > 0 && (
                      <div>
                        <p className="text-muted-foreground text-sm">Сертификаты</p>
                        <ul className="list-disc list-inside text-sm mt-1">
                          {app.certifications.map((cert, idx) => (
                            <li key={idx}>{cert}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={app.license_document_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="mr-2 h-4 w-4" />
                          Лицензия
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href={app.diploma_document_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="mr-2 h-4 w-4" />
                          Диплом
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </a>
                      </Button>
                    </div>

                    {app.status === "pending" && (
                      <div className="space-y-3 pt-4 border-t">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setEditingDoctor(app)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Редактировать
                          </Button>
                          <Button
                            onClick={() => approveDoctorMutation.mutate(app.id)}
                            disabled={approveDoctorMutation.isPending}
                            className="flex-1"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Одобрить
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`reason-${app.id}`}>Причина отклонения</Label>
                          <Textarea
                            id={`reason-${app.id}`}
                            placeholder="Укажите причину отклонения заявки"
                            value={rejectionReason[app.id] || ""}
                            onChange={(e) => setRejectionReason({ ...rejectionReason, [app.id]: e.target.value })}
                          />
                          <Button
                            variant="destructive"
                            onClick={() => rejectDoctorMutation.mutate({ applicationId: app.id, reason: rejectionReason[app.id] || "" })}
                            disabled={rejectDoctorMutation.isPending || !rejectionReason[app.id]}
                            className="w-full"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Отклонить
                          </Button>
                        </div>
                      </div>
                    )}

                    {app.status === "rejected" && app.rejection_reason && (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-sm text-red-500 font-medium">Причина отклонения:</p>
                        <p className="text-sm mt-1">{app.rejection_reason}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Нет заявок от врачей</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="clinics" className="space-y-4">
            {clinicsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : clinicApplications && clinicApplications.length > 0 ? (
              clinicApplications.map((app) => (
                <Card key={app.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">{app.name}</CardTitle>
                        <CardDescription>{app.city}, {app.district}</CardDescription>
                      </div>
                      {getStatusBadge(app.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Email</p>
                        <p className="font-medium">{app.email}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Телефон</p>
                        <p className="font-medium">{app.phone}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Директор</p>
                        <p className="font-medium">{app.director_name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Номер лицензии</p>
                        <p className="font-medium">{app.license_number}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Адрес</p>
                        <p className="font-medium">{app.address}</p>
                      </div>
                    </div>

                    {app.description && (
                      <div>
                        <p className="text-muted-foreground text-sm">Описание</p>
                        <p className="text-sm mt-1">{app.description}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={app.license_document_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="mr-2 h-4 w-4" />
                          Лицензия
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href={app.registration_document_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="mr-2 h-4 w-4" />
                          Регистрация
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </a>
                      </Button>
                    </div>

                    {app.status === "pending" && (
                      <div className="space-y-3 pt-4 border-t">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setEditingClinic(app)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Редактировать
                          </Button>
                          <Button
                            onClick={() => approveClinicMutation.mutate(app.id)}
                            disabled={approveClinicMutation.isPending}
                            className="flex-1"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Одобрить
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`reason-${app.id}`}>Причина отклонения</Label>
                          <Textarea
                            id={`reason-${app.id}`}
                            placeholder="Укажите причину отклонения заявки"
                            value={rejectionReason[app.id] || ""}
                            onChange={(e) => setRejectionReason({ ...rejectionReason, [app.id]: e.target.value })}
                          />
                          <Button
                            variant="destructive"
                            onClick={() => rejectClinicMutation.mutate({ applicationId: app.id, reason: rejectionReason[app.id] || "" })}
                            disabled={rejectClinicMutation.isPending || !rejectionReason[app.id]}
                            className="w-full"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Отклонить
                          </Button>
                        </div>
                      </div>
                    )}

                    {app.status === "rejected" && app.rejection_reason && (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-sm text-red-500 font-medium">Причина отклонения:</p>
                        <p className="text-sm mt-1">{app.rejection_reason}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Нет заявок от клиник</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <EditDoctorApplicationDialog
        application={editingDoctor}
        open={!!editingDoctor}
        onOpenChange={(open) => !open && setEditingDoctor(null)}
      />

      <EditClinicApplicationDialog
        application={editingClinic}
        open={!!editingClinic}
        onOpenChange={(open) => !open && setEditingClinic(null)}
      />
    </AdminLayout>
  );
}
