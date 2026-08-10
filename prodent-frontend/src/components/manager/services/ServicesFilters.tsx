import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Filter, LayoutList, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface ServicesFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  categories: string[];
  totalCount: number;
  activeCount: number;
  onReset: () => void;
  viewMode: 'grouped' | 'flat';
  onViewModeChange: (mode: 'grouped' | 'flat') => void;
}

const categoryKeyMap: Record<string, string> = {
  'Консультация': 'catConsultation',
  'Диагностика': 'catDiagnostics',
  'Терапия': 'catTherapy',
  'Профилактика': 'catPrevention',
  'Хирургия': 'catSurgery',
  'Имплантация': 'catImplantation',
  'Ортопедия': 'catProsthetics',
  'Ортодонтия': 'catOrthodontics',
  'Эстетика': 'catAesthetics',
  'Детская стоматология': 'catPediatric',
};

export function ServicesFilters({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  categories,
  totalCount,
  activeCount,
  onReset,
  viewMode,
  onViewModeChange,
}: ServicesFiltersProps) {
  const { t } = useLanguage();
  const hasFilters = search || categoryFilter !== 'all' || statusFilter !== 'all';

  const localizedCategory = (cat: string) => {
    const key = categoryKeyMap[cat];
    return key ? t(`crmServiceDialogs.${key}`) : cat;
  };

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="bg-card">
          {t('managerRole.filterTotal')}: {totalCount}
        </Badge>
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
          {t('managerRole.filterActive')}: {activeCount}
        </Badge>
        <Badge variant="outline" className="bg-muted text-muted-foreground">
          {t('managerRole.filterInactive')}: {totalCount - activeCount}
        </Badge>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('managerRole.filterSearchPlaceholder')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-card/50"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Filter */}
        <Select value={categoryFilter} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full sm:w-48 bg-card/50">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder={t('managerRole.filterCategoryPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('managerRole.filterAllCategories')}</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{localizedCategory(cat)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-full sm:w-40 bg-card/50">
            <SelectValue placeholder={t('managerRole.filterStatusPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('managerRole.filterAllStatuses')}</SelectItem>
            <SelectItem value="active">{t('managerRole.filterStatusActive')}</SelectItem>
            <SelectItem value="inactive">{t('managerRole.filterStatusInactive')}</SelectItem>
          </SelectContent>
        </Select>

        {/* View Toggle */}
        <div className="flex border rounded-lg overflow-hidden bg-card/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewModeChange('grouped')}
            className={cn(
              "rounded-none px-3",
              viewMode === 'grouped' && "bg-muted"
            )}
          >
            <LayoutList className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewModeChange('flat')}
            className={cn(
              "rounded-none px-3",
              viewMode === 'flat' && "bg-muted"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>

        {/* Reset */}
        {hasFilters && (
          <Button variant="ghost" onClick={onReset} className="gap-2">
            <X className="w-4 h-4" />
            {t('managerRole.filterReset')}
          </Button>
        )}
      </div>
    </div>
  );
}
