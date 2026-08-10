import {
  LayoutGrid,
  Images,
  Star,
  Building2,
  Briefcase,
  Users,
  Settings,
  Film,
  Newspaper
} from 'lucide-react';
import type { KeyboardEvent } from 'react';

interface ClinicProfileTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOwner?: boolean;
}

const clinicProfilePanelId = (tabId: string) => `clinic-profile-panel-${tabId}`;

const clinicProfileTabId = (tabId: string) => `clinic-profile-tab-${tabId}`;

export function ClinicProfileTabs({ activeTab, onTabChange, isOwner = false }: ClinicProfileTabsProps) {
  const mainTabs = [
    { id: 'timeline', label: 'Публикации', icon: LayoutGrid },
    { id: 'reels', label: 'Рилсы', icon: Film },
    { id: 'articles', label: 'Статьи', icon: Newspaper },
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

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    const tabList = event.currentTarget.closest('[role="tablist"]');
    const tabs = tabList
      ? Array.from(tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      : [];
    const currentIndex = tabs.indexOf(event.currentTarget);
    if (currentIndex < 0 || tabs.length === 0) return;

    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
            tabs.length;
    tabs[nextIndex]?.focus();
  };

  return (
    <div className="max-w-full border-t border-border bg-card shadow-sm">
      <div className="mx-auto min-w-0 max-w-5xl px-4">
        <div
          role="tablist"
          aria-label="Разделы профиля клиники"
          className="-mb-px flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar"
        >
          {allTabs.map((tab) => (
            <button
              key={tab.id}
              id={clinicProfileTabId(tab.id)}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={clinicProfilePanelId(tab.id)}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={handleTabKeyDown}
              className={`
                relative -mb-px flex min-h-11 items-center gap-2 whitespace-nowrap border-b-[3px]
                px-4 py-3 text-[15px] font-semibold transition-colors focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring
                ${activeTab === tab.id 
                  ? 'text-primary border-primary' 
                  : 'text-muted-foreground border-transparent hover:bg-muted/50 rounded-t-lg'
                }
              `}
            >
              <tab.icon aria-hidden="true" className="h-5 w-5 sm:hidden" />
              <span>{tab.label}</span>
            </button>
          ))}
          
        </div>
      </div>
    </div>
  );
}
