import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { 
  Clock, 
  Edit, 
  Trash2, 
  UserPlus, 
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Users
} from 'lucide-react';
import { formatPrice, cn } from '@/lib/utils';

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  duration_minutes: number | null;
  is_active: boolean | null;
  currency?: string;
}

interface Doctor {
  doctor_id: string;
  doctors: {
    id: string;
    specialty: string | null;
    profiles: {
      full_name: string;
      avatar_url: string | null;
    };
  };
}

interface ServicesTableProps {
  services: Service[];
  doctors: Doctor[];
  selectedServices: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (selected: boolean) => void;
  onEdit: (service: Service) => void;
  onAssign: (service: Service) => void;
  onDelete: (id: string) => void;
  groupedByCategory?: boolean;
}

const categoryColors: Record<string, string> = {
  'Консультация': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Диагностика': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Терапия': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Профилактика': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  'Хирургия': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'Имплантация': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  'Ортопедия': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  'Ортодонтия': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  'Эстетика': 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  'Детская стоматология': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

export function ServicesTable({
  services,
  doctors,
  selectedServices,
  onToggleSelect,
  onSelectAll,
  onEdit,
  onAssign,
  onDelete,
  groupedByCategory = true,
}: ServicesTableProps) {
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(
    [...new Set(services.map(s => s.category || 'Другие'))]
  ));

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('services')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-services'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  // Group by category
  const groupedServices = services.reduce((acc, service) => {
    const category = service.category || 'Другие';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  const allSelected = services.length > 0 && selectedServices.size === services.length;
  const someSelected = selectedServices.size > 0 && selectedServices.size < services.length;

  const renderServiceRow = (service: Service, showCategory = false) => (
    <TableRow 
      key={service.id} 
      className={cn(
        "group hover:bg-muted/50 transition-colors",
        selectedServices.has(service.id) && "bg-muted/30"
      )}
    >
      <TableCell className="w-12">
        <Checkbox
          checked={selectedServices.has(service.id)}
          onCheckedChange={() => onToggleSelect(service.id)}
          aria-label={`Выбрать ${service.name}`}
        />
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="font-medium text-foreground group-hover:text-primary transition-colors">
            {service.name}
          </div>
          {service.description && (
            <div className="text-sm text-muted-foreground line-clamp-1">
              {service.description}
            </div>
          )}
        </div>
      </TableCell>
      {showCategory && (
        <TableCell>
          <Badge 
            variant="secondary" 
            className={cn(
              "font-normal",
              categoryColors[service.category] || 'bg-muted text-muted-foreground'
            )}
          >
            {service.category}
          </Badge>
        </TableCell>
      )}
      <TableCell>
        <div className="font-semibold text-foreground">
          {service.price > 0 ? formatPrice(service.price) : (
            <span className="text-muted-foreground font-normal">Не указана</span>
          )}
        </div>
        {service.currency === 'USD' && service.price > 0 && (
          <span className="text-xs text-muted-foreground">USD</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-sm">{service.duration_minutes || 30} мин</span>
        </div>
      </TableCell>
      <TableCell>
        <Switch
          checked={service.is_active ?? true}
          onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: service.id, is_active: checked })}
          disabled={toggleActiveMutation.isPending}
        />
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onEdit(service)} className="gap-2">
              <Edit className="w-4 h-4" />
              Редактировать
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAssign(service)} className="gap-2">
              <UserPlus className="w-4 h-4" />
              Назначить врачу
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(service.id)} 
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );

  if (!groupedByCategory) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-soft">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) (el as HTMLButtonElement).dataset.state = someSelected ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked');
                  }}
                  onCheckedChange={(checked) => onSelectAll(!!checked)}
                  aria-label="Выбрать все"
                />
              </TableHead>
              <TableHead>Название услуги</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead>Время</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => renderServiceRow(service, true))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedServices).map(([category, categoryServices]) => {
        const isExpanded = expandedCategories.has(category);
        const activeCount = categoryServices.filter(s => s.is_active !== false).length;
        
        return (
          <div 
            key={category} 
            className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-soft"
          >
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "font-medium px-3 py-1",
                    categoryColors[category] || 'bg-muted text-muted-foreground'
                  )}
                >
                  {category}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {categoryServices.length} услуг • {activeCount} активных
                </span>
              </div>
            </button>

            {/* Services Table */}
            {isExpanded && (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={categoryServices.every(s => selectedServices.has(s.id))}
                        onCheckedChange={(checked) => {
                          categoryServices.forEach(s => {
                            if (checked && !selectedServices.has(s.id)) {
                              onToggleSelect(s.id);
                            } else if (!checked && selectedServices.has(s.id)) {
                              onToggleSelect(s.id);
                            }
                          });
                        }}
                        aria-label={`Выбрать все в ${category}`}
                      />
                    </TableHead>
                    <TableHead>Название услуги</TableHead>
                    <TableHead>Цена</TableHead>
                    <TableHead>Время</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryServices.map((service) => renderServiceRow(service))}
                </TableBody>
              </Table>
            )}
          </div>
        );
      })}
    </div>
  );
}
