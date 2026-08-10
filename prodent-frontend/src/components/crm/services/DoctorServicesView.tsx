import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatPrice } from '@/lib/utils';
import { User, ChevronDown, ChevronUp, Search, Clock, Stethoscope } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  listClinicServiceDoctorAssignments,
  type ClinicServiceDoctorAssignment,
} from '@/lib/clinic-service-assignments-api';
import type { LegacyClinicServiceView } from '@/lib/clinic-service-management-api';
import type { ClinicDoctorOption } from '@/lib/clinic-doctor-options';

interface DoctorServicesViewProps {
  clinicId?: string;
  doctors?: ClinicDoctorOption[];
  allServices: LegacyClinicServiceView[];
}

export function DoctorServicesView({ clinicId, doctors, allServices }: DoctorServicesViewProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [expandedDoctors, setExpandedDoctors] = useState<Set<string>>(new Set());

  // Fetch all doctor-service assignments for this clinic
  const { data: doctorServices, isLoading } = useQuery({
    queryKey: ['doctor-clinic-services', clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      
      return listClinicServiceDoctorAssignments(clinicId);
    },
    enabled: !!clinicId,
  });

  const toggleDoctor = (doctorId: string) => {
    setExpandedDoctors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(doctorId)) {
        newSet.delete(doctorId);
      } else {
        newSet.add(doctorId);
      }
      return newSet;
    });
  };

  // Group services by doctor
  const servicesByDoctor = doctorServices
    ?.filter((assignment) => assignment.isActive)
    .reduce((acc, assignment) => {
    if (!acc[assignment.doctorId]) {
      acc[assignment.doctorId] = [];
    }
    acc[assignment.doctorId].push(assignment);
    return acc;
  }, {} as Record<string, ClinicServiceDoctorAssignment[]>);
  const serviceById = new Map(allServices.map((service) => [service.id, service]));

  // Filter doctors by search
  const filteredDoctors = doctors?.filter(doc => {
    const profile = doc.doctors?.profiles;
    const name = profile?.full_name?.toLowerCase() || '';
    const specialty = doc.doctors?.specialty?.toLowerCase() || '';
    const searchLower = search.toLowerCase();
    return name.includes(searchLower) || specialty.includes(searchLower);
  });

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/80 shadow-soft">
        <CardContent className="py-8 text-center text-muted-foreground">
          {t('common.loading')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={`${t('common.search')} ${t('crmServiceDialogs.doctor').toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 border-border bg-background pl-10"
        />
      </div>

      {!filteredDoctors?.length ? (
        <Card className="border-dashed border-border bg-muted/20">
          <CardContent className="py-12 text-center">
            <Stethoscope className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t('crmServiceDialogs.noDoctorsInClinic')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDoctors.map((doc) => {
            const doctorId = doc.doctor_id;
            const profile = doc.doctors?.profiles;
            const doctor = doc.doctors;
            const services = servicesByDoctor?.[doctorId] || [];
            const isExpanded = expandedDoctors.has(doctorId);

            return (
              <Card key={doctorId} className="overflow-hidden border-border/50 bg-card/80 shadow-soft">
                <Collapsible open={isExpanded} onOpenChange={() => toggleDoctor(doctorId)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer py-4 transition-colors hover:bg-muted/50">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={profile?.avatar_url} />
                          <AvatarFallback>
                            <User className="h-6 w-6" />
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base font-medium">
                            {profile?.full_name || t('crmServiceDialogs.doctor')}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {doctor?.specialty}
                          </p>
                        </div>

                        <Badge variant={services.length > 0 ? "default" : "secondary"} className="w-fit rounded-full">
                          {services.length} {t('crmServiceDialogs.service5plus')}
                        </Badge>

                        <Button variant="ghost" size="icon" className="self-end sm:self-auto">
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {services.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-6 text-center text-muted-foreground">
                          {t('crmServiceDialogs.noServicesYet')}
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {services.map((assignment) => {
                            const service = serviceById.get(assignment.serviceId);
                            if (!service) return null;
                            const effectivePrice = assignment.customPrice ?? service.price;
                            const hasCustomPrice = assignment.customPrice !== null
                              && assignment.customPrice !== service.price;

                            return (
                              <div key={assignment.id} className="py-3 flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium">{service?.name}</div>
                                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                    <Badge variant="outline" className="rounded-full text-xs">
                                      {service?.category}
                                    </Badge>
                                    {service?.duration_minutes && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {service.duration_minutes} {t('crmServiceDialogs.minutesShort')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-primary">
                                    {formatPrice(effectivePrice, service?.currency === 'USD' ? '$' : t('crmServiceDialogs.currencySom'))}
                                  </div>
                                  {hasCustomPrice && (
                                    <div className="text-xs text-muted-foreground line-through">
                                      {formatPrice(service?.price, service?.currency === 'USD' ? '$' : t('crmServiceDialogs.currencySom'))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
