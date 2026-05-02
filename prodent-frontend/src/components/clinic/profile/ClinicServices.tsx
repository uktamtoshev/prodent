import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Briefcase, ListChecks } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice } from '@/lib/utils';

interface ClinicServicesProps {
  clinicId: string;
}

export function ClinicServices({ clinicId }: ClinicServicesProps) {
  const { data: services, isLoading } = useQuery({
    queryKey: ['clinic-services', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-7 w-48" />
            <div className="grid md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((j) => (
                <Skeleton key={j} className="h-28" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <Briefcase className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Нет услуг</h3>
        <p className="text-muted-foreground">
          Список услуг пока не добавлен
        </p>
      </div>
    );
  }

  const groupedServices = services.reduce((acc: Record<string, any[]>, service) => {
    const category = service.category || 'Другое';
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <ListChecks className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Услуги и цены</h2>
      </div>
      
      {Object.entries(groupedServices).map(([category, categoryServices]) => (
        <div key={category} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h3 className="text-lg font-semibold text-foreground">{category}</h3>
            <Badge variant="outline" className="text-xs">
              {categoryServices.length}
            </Badge>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {categoryServices.map((service: any) => (
              <Card key={service.id} className="group border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {service.name}
                      </h4>
                      {service.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {service.description}
                        </p>
                      )}
                      {service.duration_minutes && (
                        <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md bg-muted text-xs text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{service.duration_minutes} мин</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-primary">
                        {formatPrice(service.price)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}