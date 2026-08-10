import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Search, Building2, MapPin, Loader2, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  cancelDoctorClinicRequest,
  createDoctorClinicRequest,
  hasPendingDoctorClinicRequest,
  normalizeDoctorClinicRequestStatus,
} from '@/lib/doctor-clinic-requests-api';

interface JoinClinicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
}

export function JoinClinicDialog({ open, onOpenChange, doctorId }: JoinClinicDialogProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [selectedClinic, setSelectedClinic] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();

  // Fetch clinics for search
  const { data: clinics, isLoading: clinicsLoading } = useQuery({
    queryKey: ['clinics-search', search],
    queryFn: async () => {
      let query = supabase
        .from('clinics')
        .select('id, name, address, city, phone')
        .eq('verified', true)
        .order('name');

      if (search) {
        query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%`);
      }

      const { data, error } = await query.limit(10);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch existing requests
  const { data: existingRequests } = useQuery({
    queryKey: ['doctor-clinic-requests', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctor_clinic_requests')
        .select(`
          *,
          clinic:clinics(name, city)
        `)
        .eq('doctor_id', doctorId);

      if (error) throw error;
      return data;
    },
    enabled: open && !!doctorId,
  });

  const sendRequestMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClinic) throw new Error(t('doctorJoinClinic.pickClinic'));

      await createDoctorClinicRequest({
        doctorId,
        clinicId: selectedClinic,
        requestType: 'doctor_to_clinic',
        message: message || null,
      });
    },
    onSuccess: () => {
      toast.success(t('doctorJoinClinic.requestSentToast'));
      queryClient.invalidateQueries({ queryKey: ['doctor-clinic-requests'] });
      setSelectedClinic(null);
      setMessage('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: cancelDoctorClinicRequest,
    onSuccess: () => {
      toast.success(t('doctorJoinClinic.requestCancelled'));
      queryClient.invalidateQueries({ queryKey: ['doctor-clinic-requests'] });
    },
    onError: () => {
      toast.error(t('doctorJoinClinic.cancelError'));
    },
  });

  const getStatusBadge = (status: string) => {
    switch (normalizeDoctorClinicRequestStatus(status)) {
      case 'pending':
        return <Badge variant="outline" className="text-status-warning border-status-warning"><Clock className="w-3 h-3 mr-1" />{t('doctorJoinClinic.pending')}</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-status-success border-status-success"><CheckCircle className="w-3 h-3 mr-1" />{t('doctorJoinClinic.approvedStatus')}</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-destructive border-destructive"><XCircle className="w-3 h-3 mr-1" />{t('doctorJoinClinic.rejectedStatus')}</Badge>;
      default:
        return null;
    }
  };

  const hasRequestForClinic = (clinicId: string) => {
    return hasPendingDoctorClinicRequest(existingRequests, clinicId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('doctorJoinClinic.joinClinic')}</DialogTitle>
          <DialogDescription>
            {t('doctorJoinClinic.joinDesc')}
          </DialogDescription>
        </DialogHeader>

        {/* Existing requests */}
        {existingRequests && existingRequests.length > 0 && (
          <div className="space-y-2 mb-4">
            <h4 className="font-medium text-sm text-muted-foreground">{t('doctorJoinClinic.yourRequests')}</h4>
            <div className="space-y-2">
              {existingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{request.clinic?.name}</p>
                    <p className="text-sm text-muted-foreground">{request.clinic?.city}</p>
                    {request.rejection_reason && (
                      <p className="text-sm text-destructive mt-1">{t('doctorJoinClinic.reasonLabel')}: {request.rejection_reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(request.status)}
                    {normalizeDoctorClinicRequestStatus(request.status) === 'pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cancelRequestMutation.mutate(request.id)}
                        disabled={cancelRequestMutation.isPending}
                      >
                        {t('doctorJoinClinic.cancel')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search clinics */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('doctorJoinClinic.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {clinicsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {clinics?.map((clinic) => {
                const hasRequest = hasRequestForClinic(clinic.id);
                return (
                  <div
                    key={clinic.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedClinic === clinic.id
                        ? 'border-primary bg-primary/5'
                        : hasRequest
                        ? 'border-muted bg-muted/30 cursor-not-allowed opacity-60'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => !hasRequest && setSelectedClinic(clinic.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium">{clinic.name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {clinic.city}, {clinic.address}
                        </p>
                      </div>
                      {hasRequest && (
                        <Badge variant="secondary" className="text-xs">{t('doctorJoinClinic.requestSent')}</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
              {clinics?.length === 0 && (
                <p className="text-center text-muted-foreground py-4">{t('doctorJoinClinic.noClinicsFound')}</p>
              )}
            </div>
          )}

          {selectedClinic && (
            <div className="space-y-3 pt-2 border-t">
              <Textarea
                placeholder={t('doctorJoinClinic.messagePlaceholder')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
              <Button
                onClick={() => sendRequestMutation.mutate()}
                disabled={sendRequestMutation.isPending}
                className="w-full"
              >
                {sendRequestMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {t('doctorJoinClinic.sendRequest')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
