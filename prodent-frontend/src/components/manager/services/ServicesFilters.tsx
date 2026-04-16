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
  const hasFilters = search || categoryFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="bg-card">
          Всего: {totalCount}
        </Badge>
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
          Активных: {activeCount}
        </Badge>
        <Badge variant="outline" className="bg-muted text-muted-foreground">
          Неактивных: {totalCount - activeCount}
        </Badge>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию..."
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
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-full sm:w-40 bg-card/50">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="inactive">Неактивные</SelectItem>
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
            Сбросить
          </Button>
        )}
      </div>
    </div>
  );
}
