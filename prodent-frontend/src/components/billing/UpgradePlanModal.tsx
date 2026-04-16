import { Crown, Zap, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface UpgradePlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'doctor' | 'clinic';
  currentCount: number;
  limit: number;
}

export function UpgradePlanModal({
  open,
  onOpenChange,
  entityType,
  currentCount,
  limit,
}: UpgradePlanModalProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate(entityType === 'doctor' ? '/doctor/billing' : '/crm/billing');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
            <Crown className="w-6 h-6 text-amber-500" />
          </div>
          <DialogTitle className="text-center">Лимит записей исчерпан</DialogTitle>
          <DialogDescription className="text-center">
            Вы использовали все {limit} бесплатных записей в этом месяце ({currentCount}/{limit})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-amber-500/10 border">
            <h4 className="font-medium flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-blue-500" />
              Преимущества платного плана:
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                <span>Безлимитные записи</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                <span>Модуль финансов и аналитики</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                <span>Модуль лаборатории</span>
              </li>
              {entityType === 'clinic' && (
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                  <span>Склад и инвентарь</span>
                </li>
              )}
            </ul>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Лимит записей обновляется каждый календарный месяц
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Позже
            </Button>
            <Button className="flex-1" onClick={handleUpgrade}>
              <Crown className="w-4 h-4 mr-2" />
              Улучшить план
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
