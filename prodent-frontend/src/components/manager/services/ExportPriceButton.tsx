import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Download, FileText, Table } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';

interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  duration_minutes: number | null;
  is_active: boolean | null;
  currency?: string;
}

interface ExportPriceButtonProps {
  services: Service[];
  clinicName: string;
}

export function ExportPriceButton({ services, clinicName }: ExportPriceButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = () => {
    setIsExporting(true);
    
    try {
      const activeServices = services.filter(s => s.is_active !== false);
      
      // Group by category
      const grouped = activeServices.reduce((acc, s) => {
        if (!acc[s.category]) acc[s.category] = [];
        acc[s.category].push(s);
        return acc;
      }, {} as Record<string, Service[]>);

      // Build CSV content
      let csv = 'Категория,Услуга,Цена,Длительность (мин)\n';
      
      Object.entries(grouped).forEach(([category, categoryServices]) => {
        categoryServices.forEach(s => {
          csv += `"${category}","${s.name}","${formatPrice(s.price)}","${s.duration_minutes || 30}"\n`;
        });
      });

      // Download
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Прайс-лист_${clinicName}_${new Date().toLocaleDateString('ru-RU')}.csv`;
      link.click();
      
      toast.success('Прайс-лист экспортирован');
    } catch (error) {
      toast.error('Ошибка при экспорте');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToText = () => {
    setIsExporting(true);
    
    try {
      const activeServices = services.filter(s => s.is_active !== false);
      
      // Group by category
      const grouped = activeServices.reduce((acc, s) => {
        if (!acc[s.category]) acc[s.category] = [];
        acc[s.category].push(s);
        return acc;
      }, {} as Record<string, Service[]>);

      // Build text content
      let text = `ПРАЙС-ЛИСТ\n${clinicName}\n`;
      text += `Дата: ${new Date().toLocaleDateString('ru-RU')}\n`;
      text += '═'.repeat(50) + '\n\n';

      Object.entries(grouped).forEach(([category, categoryServices]) => {
        text += `▸ ${category.toUpperCase()}\n`;
        text += '─'.repeat(40) + '\n';
        
        categoryServices.forEach(s => {
          const price = formatPrice(s.price).padEnd(15);
          const duration = `${s.duration_minutes || 30} мин`;
          text += `  ${s.name}\n`;
          text += `  ${price}  │  ${duration}\n\n`;
        });
        
        text += '\n';
      });

      // Download
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Прайс-лист_${clinicName}_${new Date().toLocaleDateString('ru-RU')}.txt`;
      link.click();
      
      toast.success('Прайс-лист экспортирован');
    } catch (error) {
      toast.error('Ошибка при экспорте');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={isExporting}>
          <Download className="w-4 h-4" />
          Экспорт
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToCSV} className="gap-2">
          <Table className="w-4 h-4" />
          Скачать как CSV (Excel)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToText} className="gap-2">
          <FileText className="w-4 h-4" />
          Скачать как текст
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
