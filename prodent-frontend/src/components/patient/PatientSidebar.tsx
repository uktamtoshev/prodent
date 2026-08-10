import { useMemo } from "react";
import {
  Bell,
  CalendarDays,
  CreditCard,
  FileHeart,
  FolderOpen,
  Heart,
  MessageCircle,
  Plus,
  Shield,
  LayoutDashboard,
  Users,
  UserRound,
} from "lucide-react";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import { useNotifications } from "@/hooks/useNotifications";
import { usePatientAccessRequests } from "@/hooks/useMedicalAccess";
import {
  RoleSidebar,
  RoleSidebarNavGroup,
} from "@/components/shared/RoleSidebar";

const GROUP_LABELS: Record<Language, { health: string; comm: string; personal: string }> = {
  ru:      { health: "Здоровье",  comm: "Общение",    personal: "Личное" },
  uz:      { health: "Sog‘liq",   comm: "Aloqalar",   personal: "Shaxsiy" },
  uz_cyrl: { health: "Соғлиқ",    comm: "Алоқалар",   personal: "Шахсий" },
  kz:      { health: "Денсаулық", comm: "Хабарласу",  personal: "Жеке" },
  kg:      { health: "Ден соолук", comm: "Байланыш",  personal: "Жеке" },
  tj:      { health: "Саломатӣ",  comm: "Алоқа",      personal: "Шахсӣ" },
};

export function PatientSidebar() {
  const { t, language } = useLanguage();
  const { unreadCount } = useNotifications();
  const { data: accessRequests } = usePatientAccessRequests();

  const pendingAccess =
    accessRequests?.filter((r) => r.status === "pending").length || 0;
  const L = GROUP_LABELS[language];

  const groups: RoleSidebarNavGroup[] = useMemo(
    () => [
      // Overview — landing + the primary CTA "book appointment".
      {
        items: [
          { title: t("patient.dashboard"),       path: "/patient/dashboard",    icon: LayoutDashboard, end: true },
          { title: t("patient.bookAppointment"), path: "/patient/book",         icon: Plus },
        ],
      },
      // Здоровье — everything medical-records / clinical.
      {
        label: L.health,
        items: [
          { title: t("patient.appointments"), path: "/patient/appointments", icon: CalendarDays },
          { title: t("patient.medical"),      path: "/patient/medical",      icon: FileHeart },
          { title: t("patient.access"),       path: "/patient/access",       icon: Shield, badge: pendingAccess },
          { title: t("patient.doctors"),      path: "/patient/my-doctors",   icon: Users },
        ],
      },
      // Общение — chats and pings.
      {
        label: L.comm,
        items: [
          { title: t("patient.messages"),      path: "/patient/messages",      icon: MessageCircle },
          { title: t("patient.notifications"), path: "/patient/notifications", icon: Bell, badge: unreadCount },
        ],
      },
      // Личное — money / files / family.
      {
        label: L.personal,
        items: [
          { title: t("patient.payments"), path: "/patient/billing", icon: CreditCard },
          { title: t("patient.files"),    path: "/patient/files",   icon: FolderOpen },
          { title: t("patient.family"),   path: "/patient/family",  icon: Heart },
          { title: t("patient.profile"),  path: "/profile",         icon: UserRound },
        ],
      },
    ],
    [t, L, unreadCount, pendingAccess]
  );

  return (
    <RoleSidebar
      roleLabel={t("patient.patientLabel")}
      items={groups}
    />
  );
}
