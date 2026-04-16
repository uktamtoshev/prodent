import { Calendar, Home, Package, Users, LogOut, Menu, X } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import prodentLogo from "@/assets/prodent-logo.png";

const menuItems = [
  { title: 'Расписание', path: '/assistant/schedule', icon: Calendar },
  { title: 'Подготовка кабинетов', path: '/assistant/rooms', icon: Home },
  { title: 'Материалы', path: '/assistant/materials', icon: Package },
  { title: 'Сопровождение приёмов', path: '/assistant/appointments', icon: Users },
];

export const AssistantSidebar = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const SidebarContent = useMemo(() => {
    return (
      <>
        <div className="p-6 border-b border-border flex items-center gap-3">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <img src={prodentLogo} alt="PRODENT" className="h-10 object-contain" />
          </Link>
          <span className="text-sm text-muted-foreground">Ассистент</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  activeClassName="bg-primary/10 text-primary font-medium"
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.title}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-border">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-5 h-5" />
            <span>Выход</span>
          </Button>
        </div>
      </>
    );
  }, [location.pathname]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden fixed top-4 left-4 z-50"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`
          lg:fixed lg:left-0 lg:top-0 lg:h-screen
          fixed top-0 left-0 h-screen
          w-72 bg-card border-r border-border
          flex flex-col z-40
          transition-transform duration-200 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {SidebarContent}
      </aside>
    </>
  );
};
