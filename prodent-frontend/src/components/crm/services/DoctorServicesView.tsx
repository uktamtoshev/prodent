import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatPrice } from '@/lib/utils';
import { User, ChevronDown, ChevronUp, Search, Clock, Stethoscope } from 'lucide-react';

interface DoctorServicesViewProps {
  clinicId?: string;
  doctors?: any[];
  allServices: any[];
}

export function DoctorServicesView({ clinicId, doctors, allServices }: DoctorServicesViewProps) {
  const [search, setSearch] = useState('');
  const [expandedDoctors, setExpandedDoctors] = useState<Set<string>>(new Set());

  // Fetch all doctor-service assignments for this clinic
  const { data: doctorServices, isLoading } = useQuery({
    queryKey: ['doctor-clinic-services', clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      
      const { data, error } = await supabase
        .from('clinic_doctor_services')
        .select(`
          *,
          services:service_id (
            id,
            name,
            description,
            category,
            price,
            duration_minutes,
            currency
          )
        `)
        .eq('clinic_id', clinicId)
        .eq('is_active', true);

      if (error) throw error;
      return data;
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
  const servicesByDoctor = doctorServices?.reduce((acc, ds) => {
    if (!acc[ds.doctor_id]) {
      acc[ds.doctor_id] = [];
    }
    acc[ds.doctor_id].push(ds);
    return acc;
  }, {} as Record<string, typeof doctorServices>);

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
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Загрузка...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск врачей..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {!filteredDoctors?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Stethoscope className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">Нет врачей в клинике</p>
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
              <Card key={doctorId} className="border-border/50">
                <Collapsible open={isExpanded} onOpenChange={() => toggleDoctor(doctorId)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={profile?.avatar_url} />
                          <AvatarFallback>
                            <User className="w-6 h-6" />
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1">
                          <CardTitle className="text-base font-medium">
                            {profile?.full_name || 'Врач'}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {doctor?.specialty}
                          </p>
                        </div>

                        <Badge variant={services.length > 0 ? "default" : "secondary"}>
                          {services.length} услуг
                        </Badge>

                        <Button variant="ghost" size="icon">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {services.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          Услуги не назначены
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {services.map((ds: any) => {
                            const service = ds.services;
                            const effectivePrice = ds.custom_price || service?.price;
                            const hasCustomPrice = ds.custom_price && ds.custom_price !== service?.price;

                            return (
                              <div key={ds.id} className="py-3 flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-medium">{service?.name}</div>
                                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                    <Badge variant="outline" className="text-xs">
                                      {service?.category}
                                    </Badge>
                                    {service?.duration_minutes && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {service.duration_minutes} мин
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-primary">
                                    {formatPrice(effectivePrice, service?.currency === 'USD' ? '$' : 'сум')}
                                  </div>
                                  {hasCustomPrice && (
                                    <div className="text-xs text-muted-foreground line-through">
                                      {formatPrice(service?.price, service?.currency === 'USD' ? '$' : 'сум')}
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