import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface PatientFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedTag: string;
  onTagChange: (value: string) => void;
  selectedGender: string;
  onGenderChange: (value: string) => void;
  ageFrom: string;
  ageTo: string;
  onAgeFromChange: (value: string) => void;
  onAgeToChange: (value: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  tags: { value: string; label: string; count: number }[];
  onClearFilters: () => void;
}

export function PatientFilters({
  searchQuery,
  onSearchChange,
  selectedTag,
  onTagChange,
  selectedGender,
  onGenderChange,
  ageFrom,
  ageTo,
  onAgeFromChange,
  onAgeToChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  tags,
  onClearFilters,
}: PatientFiltersProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const hasActiveFilters = selectedGender !== "all" || ageFrom || ageTo || dateFrom || dateTo;

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardContent className="pt-6">
        {/* Основной поиск */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Поиск по имени или телефону..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <Select value={selectedTag} onValueChange={onTagChange}>
            <SelectTrigger className="w-full md:w-48 bg-muted/50 border-border text-foreground">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Фильтр по тегам" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {tags.map((tag) => (
                <SelectItem key={tag.value} value={tag.value} className="text-popover-foreground">
                  {tag.label} ({tag.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Теги для быстрого фильтра */}
        <div className="flex flex-wrap gap-2 mt-4">
          {tags.map((tag) => (
            <Badge
              key={tag.value}
              variant="outline"
              className={cn(
                "cursor-pointer transition-all duration-200",
                selectedTag === tag.value
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              )}
              onClick={() => onTagChange(tag.value)}
            >
              {tag.label} ({tag.count})
            </Badge>
          ))}
        </div>

        {/* Расширенные фильтры */}
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="mt-4 w-full justify-between text-muted-foreground">
              <span className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Расширенные фильтры
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2">Активны</Badge>
                )}
              </span>
              {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Пол */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Пол</Label>
                <Select value={selectedGender} onValueChange={onGenderChange}>
                  <SelectTrigger className="bg-muted/50 border-border">
                    <SelectValue placeholder="Все" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="male">Мужской</SelectItem>
                    <SelectItem value="female">Женский</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Возраст */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Возраст</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="От"
                    value={ageFrom}
                    onChange={(e) => onAgeFromChange(e.target.value)}
                    className="bg-muted/50 border-border"
                    min="0"
                    max="120"
                  />
                  <Input
                    type="number"
                    placeholder="До"
                    value={ageTo}
                    onChange={(e) => onAgeToChange(e.target.value)}
                    className="bg-muted/50 border-border"
                    min="0"
                    max="120"
                  />
                </div>
              </div>

              {/* Дата регистрации */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Дата регистрации от</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange(e.target.value)}
                  className="bg-muted/50 border-border"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Дата регистрации до</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange(e.target.value)}
                  className="bg-muted/50 border-border"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={onClearFilters} className="gap-2">
                <X className="w-4 h-4" />
                Сбросить фильтры
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
