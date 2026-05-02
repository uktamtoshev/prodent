import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, Check, Clock, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import * as LucideIcons from 'lucide-react';

interface BadgeType {
  id: string;
  name: string;
  name_uz: string | null;
  name_en: string | null;
  description: string | null;
  icon: string;
  color: string;
  bg_color: string;
  target_type: string;
}

interface BadgePackagesListProps {
  targetType: 'doctor' | 'clinic';
  entityId: string;
  balance: number;
  onPurchase: (badgeId: string, price: number, duration: number) => void;
  isLoading?: boolean;
}

const BADGE_PRICES = [
  { days: 3, price: 49000, label: '3 дня' },
  { days: 7, price: 99000, label: '7 дней' },
  { days: 10, price: 129000, label: '10 дней' },
];

export function BadgePackagesList({
  targetType,
  entityId,
  balance,
  onPurchase,
  isLoading,
}: BadgePackagesListProps) {
  const { language } = useLanguage();
  const [selectedBadge, setSelectedBadge] = useState<BadgeType | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(3);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Fetch available badges
  const { data: badges, isLoading: badgesLoading } = useQuery({
    queryKey: ['available-badges', targetType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .eq('target_type', targetType)
        .eq('is_active', true);
      if (error) throw error;
      return data as BadgeType[];
    },
  });

  // Fetch active badge assignments for this entity
  const { data: activeAssignments } = useQuery({
    queryKey: ['active-badge-assignments', targetType, entityId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const query = supabase
        .from('badge_assignments')
        .select('*, badges(*)')
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now);

      if (targetType === 'doctor') {
        query.eq('doctor_id', entityId);
      } else {
        query.eq('clinic_id', entityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!entityId,
  });

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU').format(amount);
  };

  const getBadgeName = (badge: BadgeType) => {
    if (language === 'uz' && badge.name_uz) return badge.name_uz;
    if (language === 'en' && badge.name_en) return badge.name_en;
    return badge.name;
  };

  const getSelectedPrice = () => {
    return BADGE_PRICES.find(p => p.days === selectedDuration)?.price || 0;
  };

  const handleSelectBadge = (badge: BadgeType) => {
    const isActive = activeAssignments?.some(a => a.badge_id === badge.id);
    if (isActive) return;

    setSelectedBadge(badge);
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedBadge) return;
    const price = getSelectedPrice();
    if (balance < price) return;
    onPurchase(selectedBadge.id, price, selectedDuration);
    setIsConfirmOpen(false);
    setSelectedBadge(null);
  };

  const renderIcon = (iconName: string, color: string) => {
    const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.Award;
    return <IconComponent className="w-6 h-6" style={{ color }} />;
  };

  if (badgesLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-[180px] rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Badges */}
      {activeAssignments && activeAssignments.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Активные бейджи
          </h3>
          <div className="flex flex-wrap gap-2">
            {activeAssignments.map((assignment) => {
              const badge = assignment.badges as BadgeType;
              return (
                <Badge
                  key={assignment.id}
                  className="px-3 py-1.5 text-sm font-medium gap-2"
                  style={{
                    backgroundColor: badge.bg_color,
                    color: badge.color,
                    borderColor: badge.color,
                  }}
                >
                  {renderIcon(badge.icon, badge.color)}
                  {getBadgeName(badge)}
                  <span className="text-xs opacity-75">
                    до {format(new Date(assignment.end_date), 'd MMM', { locale: ru })}
                  </span>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Badges */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {badges?.map((badge) => {
          const isActive = activeAssignments?.some(a => a.badge_id === badge.id);
          
          return (
            <Card
              key={badge.id}
              className={`relative cursor-pointer transition-all hover:shadow-md ${
                isActive ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => handleSelectBadge(badge)}
            >
              {isActive && (
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="gap-1">
                    <Check className="w-3 h-3" />
                    Активен
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-2"
                  style={{ backgroundColor: badge.bg_color }}
                >
                  {renderIcon(badge.icon, badge.color)}
                </div>
                <CardTitle className="text-lg" style={{ color: badge.color }}>
                  {getBadgeName(badge)}
                </CardTitle>
                {badge.description && (
                  <CardDescription className="text-sm">
                    {badge.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">от</span>
                  <span className="font-bold text-primary">
                    {formatAmount(BADGE_PRICES[0].price)} UZS
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedBadge && (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: selectedBadge.bg_color }}
                >
                  {renderIcon(selectedBadge.icon, selectedBadge.color)}
                </div>
              )}
              Купить бейдж "{selectedBadge && getBadgeName(selectedBadge)}"
            </DialogTitle>
            <DialogDescription>
              Выберите длительность отображения бейджа
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Select
              value={selectedDuration.toString()}
              onValueChange={(v) => setSelectedDuration(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BADGE_PRICES.map((option) => (
                  <SelectItem key={option.days} value={option.days.toString()}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{option.label}</span>
                      <span className="text-muted-foreground">
                        {formatAmount(option.price)} UZS
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="p-4 rounded-lg bg-muted space-y-2">
              <div className="flex justify-between text-sm">
                <span>Период</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(), 'd MMM', { locale: ru })} -{' '}
                  {format(addDays(new Date(), selectedDuration), 'd MMM yyyy', { locale: ru })}
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Стоимость</span>
                <span className="text-primary">{formatAmount(getSelectedPrice())} UZS</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Ваш баланс</span>
                <span>{formatAmount(balance)} UZS</span>
              </div>
            </div>

            {balance < getSelectedPrice() && (
              <p className="text-sm text-destructive">
                Недостаточно средств. Пополните баланс.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading || balance < getSelectedPrice()}
            >
              {isLoading ? 'Покупка...' : 'Купить бейдж'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
