import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AssistantLayout } from '@/components/assistant/AssistantLayout';
import { supabase } from '@/integrations/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Home,
  Wrench,
  Sparkles,
  CircleSlash,
  Loader2,
  Building,
  StickyNote,
} from 'lucide-react';

interface Room {
  id: string;
  clinic_id: string;
  name: string;
  floor: number | null;
  room_number: string | null;
  equipment: any;
  status: string;
  is_active: boolean;
  notes: string | null;
}

const STATUS_META: Record<
  string,
  { label: string; className: string; dotClass: string }
> = {
  FREE: {
    label: 'Свободен',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  BUSY: {
    label: 'Занят',
    className: 'bg-red-100 text-red-700 border-red-200',
    dotClass: 'bg-red-500',
  },
  CLEANING: {
    label: 'Уборка',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  OUT_OF_SERVICE: {
    label: 'Не работает',
    className: 'bg-neutral-200 text-neutral-700 border-neutral-300',
    dotClass: 'bg-neutral-500',
  },
};

const STATUS_KEYS = ['FREE', 'BUSY', 'CLEANING', 'OUT_OF_SERVICE'] as const;

function parseEquipment(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function AssistantRooms() {
  const { user } = useAuth();
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('all');

  const {
    data: rooms,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['assistant-rooms', currentClinic?.id, user?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [] as Room[];
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) {
        toast({
          title: 'Не удалось загрузить кабинеты',
          description: error.message,
          variant: 'destructive',
        });
        throw error;
      }
      return (data ?? []) as Room[];
    },
    enabled: !!currentClinic?.id && !!user,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('rooms')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: ({ status }) => {
      toast({
        title: 'Статус кабинета обновлён',
        description: `Новый статус: ${STATUS_META[status]?.label ?? status}`,
      });
      queryClient.invalidateQueries({ queryKey: ['assistant-rooms'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Не удалось обновить статус',
        description: err?.message ?? 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    },
  });

  const filteredRooms = useMemo(() => {
    if (!rooms) return [];
    if (statusFilter === 'all') return rooms;
    return rooms.filter((r) => r.status === statusFilter);
  }, [rooms, statusFilter]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {
      all: rooms?.length ?? 0,
      FREE: 0,
      BUSY: 0,
      CLEANING: 0,
      OUT_OF_SERVICE: 0,
    };
    (rooms ?? []).forEach((r) => {
      if (map[r.status] !== undefined) map[r.status] += 1;
    });
    return map;
  }, [rooms]);

  // Assistant can only toggle FREE <-> CLEANING per spec
  const canSet = (current: string, target: string) => {
    if (target === current) return false;
    return (
      (current === 'FREE' && target === 'CLEANING') ||
      (current === 'CLEANING' && target === 'FREE')
    );
  };

  return (
    <AssistantLayout>
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Home className="w-6 h-6 text-primary" />
              Подготовка кабинетов
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {currentClinic
                ? `${currentClinic.name} • ${filteredRooms.length} кабинетов`
                : 'Выберите клинику'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все ({counts.all})</SelectItem>
                {STATUS_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {STATUS_META[key].label} ({counts[key]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusFilter !== 'all' && (
              <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')}>
                Сбросить
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Не удалось загрузить кабинеты.
            </CardContent>
          </Card>
        ) : filteredRooms.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Building className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                Кабинеты не найдены
              </h3>
              <p className="text-sm text-muted-foreground">
                {statusFilter === 'all'
                  ? 'В клинике пока нет активных кабинетов.'
                  : 'Нет кабинетов с выбранным статусом.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRooms.map((room) => {
              const meta = STATUS_META[room.status] ?? {
                label: room.status,
                className: 'bg-neutral-100 text-neutral-700 border-neutral-200',
                dotClass: 'bg-neutral-500',
              };
              const equipment = parseEquipment(room.equipment);
              const isPending =
                updateStatusMutation.isPending &&
                updateStatusMutation.variables?.id === room.id;

              return (
                <Card key={room.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <span
                            className={`inline-block w-2.5 h-2.5 rounded-full ${meta.dotClass}`}
                          />
                          {room.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {room.room_number
                            ? `Кабинет №${room.room_number}`
                            : 'Без номера'}
                          {room.floor !== null && room.floor !== undefined
                            ? ` • Этаж ${room.floor}`
                            : ''}
                        </p>
                      </div>
                      <Badge variant="outline" className={meta.className}>
                        {meta.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {equipment.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Wrench className="w-3.5 h-3.5" />
                          Оборудование
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {equipment.slice(0, 6).map((item, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-xs font-normal"
                            >
                              {item}
                            </Badge>
                          ))}
                          {equipment.length > 6 && (
                            <Badge variant="secondary" className="text-xs font-normal">
                              +{equipment.length - 6}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Оборудование не указано
                      </p>
                    )}

                    {room.notes && (
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <StickyNote className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{room.notes}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canSet(room.status, 'CLEANING') || isPending}
                        onClick={() =>
                          updateStatusMutation.mutate({
                            id: room.id,
                            status: 'CLEANING',
                          })
                        }
                      >
                        {isPending ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 mr-1" />
                        )}
                        На уборку
                      </Button>
                      <Button
                        size="sm"
                        disabled={!canSet(room.status, 'FREE') || isPending}
                        onClick={() =>
                          updateStatusMutation.mutate({
                            id: room.id,
                            status: 'FREE',
                          })
                        }
                      >
                        {isPending ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <CircleSlash className="w-3.5 h-3.5 mr-1" />
                        )}
                        Готов
                      </Button>
                    </div>

                    {(room.status === 'BUSY' ||
                      room.status === 'OUT_OF_SERVICE') && (
                      <p className="text-[11px] text-muted-foreground">
                        Изменение этого статуса доступно администратору клиники.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AssistantLayout>
  );
}
