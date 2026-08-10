import { useRef, type KeyboardEvent } from 'react';
import { 
  LayoutGrid, 
  Images, 
  Star, 
  User, 
  Briefcase,
  Settings
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface DoctorProfileTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOwner?: boolean;
}

export function DoctorProfileTabs({ activeTab, onTabChange, isOwner = false }: DoctorProfileTabsProps) {
  const { t } = useLanguage();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const mainTabs = [
    { id: 'timeline', label: t('doctorProfileTabs.tabTimeline'), icon: LayoutGrid },
    { id: 'portfolio', label: t('doctorProfileTabs.tabPortfolio'), icon: Images },
    { id: 'reviews', label: t('doctorProfileTabs.tabReviews'), icon: Star },
    { id: 'about', label: t('doctorProfileTabs.tabAbout'), icon: User },
  ];

  const moreTabs = [
    { id: 'services', label: t('doctorProfileTabs.tabServices'), icon: Briefcase },
    ...(isOwner ? [{ id: 'settings', label: t('doctorProfileTabs.tabSettings'), icon: Settings }] : []),
  ];

  const allTabs = [...mainTabs, ...moreTabs];
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = (index + 1) % allTabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + allTabs.length) % allTabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = allTabs.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = allTabs[nextIndex];
    onTabChange(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="bg-card border-t border-border shadow-sm">
      <div className="max-w-5xl min-w-0 mx-auto px-2 sm:px-4">
        <nav
          className="flex min-w-0 items-center gap-1 overflow-x-auto no-scrollbar -mb-px"
          aria-label={`${t('crmDoctorMgmt.roleDoctor')}: ${t('doctorProfileTabs.tabAbout')}`}
        >
          <div role="tablist" className="flex min-w-max items-center gap-1">
          {allTabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`doctor-profile-tab-${tab.id}`}
              aria-controls={`doctor-profile-panel-${tab.id}`}
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`
                relative flex min-h-11 items-center gap-2 px-3 sm:px-4 py-2 text-base font-semibold whitespace-nowrap
                transition-colors border-b-[3px] -mb-[1px]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                ${activeTab === tab.id 
                  ? 'text-primary border-primary' 
                  : 'text-muted-foreground border-transparent hover:bg-muted/50 rounded-t-lg'
                }
              `}
            >
              <tab.icon className="w-5 h-5 sm:hidden" />
              <span>{tab.label}</span>
            </button>
          ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
