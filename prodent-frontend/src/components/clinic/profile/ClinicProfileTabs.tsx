import { 
  LayoutGrid, 
  Images, 
  Star, 
  Building2, 
  Briefcase,
  Users,
  Settings,
  ChevronDown
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ClinicProfileTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOwner?: boolean;
}

export function ClinicProfileTabs({ activeTab, onTabChange, isOwner = false }: ClinicProfileTabsProps) {
  const { t } = useLanguage();

  const mainTabs = [
    { id: 'timeline', label: 'Публикации', icon: LayoutGrid },
    { id: 'portfolio', label: 'Портфолио', icon: Images },
    { id: 'doctors', label: 'Врачи', icon: Users },
    { id: 'reviews', label: 'Отзывы', icon: Star },
  ];

  const moreTabs = [
    { id: 'about', label: 'О клинике', icon: Building2 },
    { id: 'services', label: 'Услуги', icon: Briefcase },
    ...(isOwner ? [{ id: 'settings', label: 'Настройки', icon: Settings }] : []),
  ];

  const allTabs = [...mainTabs, ...moreTabs];
  const activeTabData = allTabs.find(t => t.id === activeTab);
  const isMoreActive = moreTabs.some(t => t.id === activeTab);

  return (
    <div className="bg-card border-t border-border shadow-sm">
      <div className="max-w-5xl mx-auto px-4">
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar -mb-px">
          {mainTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                relative flex items-center gap-2 px-4 py-4 text-[15px] font-semibold whitespace-nowrap
                transition-colors border-b-[3px] -mb-[1px]
                ${activeTab === tab.id 
                  ? 'text-primary border-primary' 
                  : 'text-muted-foreground border-transparent hover:bg-muted/50 rounded-t-lg'
                }
              `}
            >
              <tab.icon className="w-5 h-5 sm:hidden" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.slice(0, 4)}</span>
            </button>
          ))}
          
          {moreTabs.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`
                    relative flex items-center gap-2 px-4 py-4 text-[15px] font-semibold whitespace-nowrap
                    transition-colors border-b-[3px] -mb-[1px]
                    ${isMoreActive 
                      ? 'text-primary border-primary' 
                      : 'text-muted-foreground border-transparent hover:bg-muted/50 rounded-t-lg'
                    }
                  `}
                >
                  {isMoreActive ? activeTabData?.label : 'Ещё'}
                  <ChevronDown className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {moreTabs.map((tab) => (
                  <DropdownMenuItem 
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={activeTab === tab.id ? 'bg-primary/10 text-primary' : ''}
                  >
                    <tab.icon className="w-4 h-4 mr-2" />
                    {tab.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>
      </div>
    </div>
  );
}
