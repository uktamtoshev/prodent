import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  DollarSign,
  Package,
  FlaskConical,
  BarChart3,
  Bell,
  Settings,
  Stethoscope,
  ClipboardList,
  User,
  MessageCircle,
  UserPlus,
  CheckSquare,
  Camera,
  ShoppingBag,
  Briefcase,
  Wallet,
  Shield,
  MailOpen,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useModulePermissions, ModuleName } from "@/hooks/useModulePermissions";
import { useNotifications } from "@/hooks/useNotifications";
import { useClinicInvitationsCount } from "@/hooks/useClinicInvitationsCount";
import { computeNavBadges, sectionTypesForPath } from "@/lib/navBadges";
import { CABINET_SECTIONS, type CabinetSectionKey } from "@/lib/cabinet-routes";
import { useCabinetShell } from "@/components/shared/CabinetShellContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import {
  RoleSidebar,
  RoleSidebarNavItem,
  RoleSidebarNavGroup,
} from "@/components/shared/RoleSidebar";
import { ClinicSwitcher } from "./ClinicSwitcher";

type Permission =
  | "all"
  | "schedule"
  | "patients"
  | "medical"
  | "finance"
  | "inventory"
  | "laboratory"
  | "reports"
  | "settings"
  | "services"
  | "doctor_only"
  | "jobs";

type CrmMenuItem = RoleSidebarNavItem & { permission: Permission; group: GroupKey };

/**
 * Build a menu item from the route catalog, so a menu entry can never drift
 * from the paths it is supposed to represent. `path` and `matchPaths` come from
 * `lib/cabinet-routes.ts`; only the label, icon and permission live here.
 */
function item(
  section: CabinetSectionKey,
  fields: {
    title: string;
    icon: CrmMenuItem["icon"];
    permission: Permission;
    group: GroupKey;
    badge?: number;
  },
): CrmMenuItem {
  const def = CABINET_SECTIONS[section];
  return {
    ...fields,
    path: def.path,
    matchPaths: def.matchPaths,
    end: def.exact,
  };
}

type GroupKey = "main" | "clinical" | "operations" | "finance" | "system";

// Per-language labels for sidebar section headers. The big LanguageContext
// already has thousands of keys; rather than thread 4 more keys × 6 languages
// through it, the labels live here next to the menu definition. `t()` falls
// back to Russian for missing keys, so kz/kg/tj reuse the Russian text below
// only if the user actively switches to those languages.
const GROUP_LABELS: Record<Language, Record<Exclude<GroupKey, "main">, string>> = {
  ru:      { clinical: "Пациенты",   operations: "Клиника",   finance: "Финансы",  system: "Система" },
  uz:      { clinical: "Bemorlar",   operations: "Klinika",   finance: "Moliya",   system: "Tizim"   },
  uz_cyrl: { clinical: "Беморлар",   operations: "Клиника",   finance: "Молия",    system: "Тизим"   },
  kz:      { clinical: "Пациенттер", operations: "Клиника",   finance: "Қаржы",    system: "Жүйе"    },
  kg:      { clinical: "Бейтаптар", operations: "Клиника",   finance: "Каржы",    system: "Тутум"   },
  tj:      { clinical: "Беморон",   operations: "Клиника",   finance: "Молия",    system: "Система" },
};

export function CRMSidebarNew() {
  const { t, language } = useLanguage();
  const location = useLocation();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const pendingInvites = useClinicInvitationsCount();
  const { clinics } = useClinic();

  // Per-menu "+N" counters, derived from the same live notification feed that
  // drives the bell. `navBadges["/crm/messages"]` etc. → number of UNREAD
  // notifications rolled up onto that menu item.
  const navBadges = useMemo(() => computeNavBadges(notifications), [notifications]);

  // When the doctor actually opens a section, clear its badge by marking that
  // section's notifications read (Gmail-style "you've seen it"). Runs to a fixed
  // point: once the matching notifications are read, the next pass finds none.
  useEffect(() => {
    const types = sectionTypesForPath(location.pathname);
    if (!types?.length) return;
    const wanted = new Set(types);
    for (const n of notifications) {
      if (!n.read && wanted.has(n.type)) void markAsRead(n.id);
    }
    // markAsRead is a fresh closure each render; excluding it avoids needless
    // re-runs. Re-running on notifications change is what converges the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, notifications]);

  const {
    role,
    isSuperAdmin,
    isClinicAdmin,
    isClinicManager,
    isDoctor,
    isAssistant,
  } = useUserRole();
  const { canView } = useModulePermissions();

  const MODULE_MAP: Record<string, ModuleName> = {
    schedule: "schedule",
    patients: "patients",
    medical: "medical_records",
    finance: "finance",
    inventory: "inventory",
    laboratory: "laboratory",
    reports: "reports",
    settings: "settings",
    services: "services",
  };

  const checkPermission = (permission: Permission): boolean => {
    if (permission === "all") return true;
    if (permission === "doctor_only") return isDoctor || isSuperAdmin;
    if (permission === "jobs") return isDoctor || isClinicAdmin || isClinicManager || isSuperAdmin;
    const moduleName = MODULE_MAP[permission];
    if (moduleName) return canView(moduleName);
    return true;
  };

  // Paths and their aliases come from `lib/cabinet-routes.ts` — never write a
  // literal route here, or the menu drifts from the pages it points at.
  const allItems: CrmMenuItem[] = useMemo(
    () => [
      // Ежедневное — без заголовка группы, сразу под блоком пользователя.
      // Порядок утверждён на макете: то, чем врач пользуется каждый день,
      // стоит выше любых групп. «Расписание» и «Мои задачи» подняты сюда из
      // клинической группы, «Приглашения клиник» ушли вниз, в «Систему»:
      // ими пользуются несколько раз в год, а место они занимали третье.
      item("home",           { title: t("crm.home"),                 icon: LayoutDashboard, permission: "all",        group: "main" }),
      item("myDay",          { title: t("crm.myDay"),                icon: Stethoscope,     permission: "schedule",   group: "main" }),
      item("schedule",       { title: t("crm.schedule"),             icon: Calendar,        permission: "schedule",   group: "main", badge: navBadges.schedule }),
      // «Мои задачи», а не «Задачи»: в списке из четырёх ежедневных пунктов
      // важно, что это ЛИЧНАЯ очередь врача, а не задачи клиники. Ключ отдельный
      // от crm.tasks — тот же ключ служит названием раздела на самой странице.
      item("tasks",          { title: t("crm.myTasks"),              icon: CheckSquare,     permission: "schedule",   group: "main" }),

      // Clinical work — anything that touches a patient.
      item("patients",       { title: t("crm.patients"),             icon: Users,           permission: "patients",   group: "clinical", badge: navBadges.patients }),
      item("messages",       { title: t("crm.messages"),             icon: MessageCircle,   permission: "all",        group: "clinical", badge: navBadges.messages }),
      item("medicalRecords", { title: t("crm.medicalRecords"),       icon: FileText,        permission: "medical",    group: "clinical" }),
      item("medicalAccess",  { title: t("crm.medicalAccess"),        icon: Shield,          permission: "medical",    group: "clinical" }),
      item("treatmentPlans", { title: t("crm.treatmentPlans"),       icon: ClipboardList,   permission: "medical",    group: "clinical" }),
      item("media",          { title: t("crm.mediaLibrary"),         icon: Camera,          permission: "doctor_only", group: "clinical" }),

      // Operations — clinic-wide resources, services, supplies.
      item("services",       { title: t("crm.services"),             icon: Stethoscope,     permission: "services",   group: "operations" }),
      item("laboratory",     { title: t("crm.laboratory"),           icon: FlaskConical,    permission: "laboratory", group: "operations", badge: navBadges.laboratory }),
      item("inventory",      { title: t("crm.inventory"),            icon: Package,         permission: "inventory",  group: "operations", badge: navBadges.inventory }),
      item("market",         { title: t("crm.market"),               icon: ShoppingBag,     permission: "doctor_only", group: "operations" }),
      item("jobs",           { title: t("crm.jobs"),                 icon: Briefcase,       permission: "jobs",       group: "operations" }),

      // Finance — money in / money out.
      item("finance",        { title: t("crm.finance"),              icon: DollarSign,      permission: "finance",    group: "finance", badge: navBadges.finance }),
      item("balance",        { title: t("crm.balance"),              icon: Wallet,          permission: "doctor_only", group: "finance" }),
      item("billing",        { title: t("crm.subscriptions"),        icon: DollarSign,      permission: "finance",    group: "finance" }),
      item("reports",        { title: t("crm.reportsShort"),         icon: BarChart3,       permission: "reports",    group: "finance" }),

      // System / personal — admin tasks, alerts, settings.
      // «Приглашения клиник» открывают отсюда: редкое действие, но по смыслу
      // это административная задача, а не ежедневная работа врача.
      item("invitations",    { title: t("crmInvitations.title"),     icon: MailOpen,        permission: "doctor_only", group: "system", badge: pendingInvites || undefined }),
      item("doctorRequests", { title: t("crm.doctorRequestsShort"),  icon: UserPlus,        permission: "settings",   group: "system", badge: navBadges.doctorRequests }),
      item("notifications",  { title: t("crm.notifications"),        icon: Bell,            permission: "all",        group: "system", badge: unreadCount }),
      item("settings",       { title: t("crm.settings"),             icon: Settings,        permission: "settings",   group: "system" }),
      item("profile",        { title: t("crm.profile"),              icon: User,            permission: "all",        group: "system" }),
    ],
    [t, unreadCount, pendingInvites, navBadges]
  );

  // Build the grouped nav: filter by permission first, then bucket by `group`.
  // Empty groups are dropped so users with restricted access don't see lone
  // section headers.
  const labels = GROUP_LABELS[language];
  const groupedItems: RoleSidebarNavGroup[] = useMemo(() => {
    const buckets: Record<GroupKey, RoleSidebarNavItem[]> = {
      main: [], clinical: [], operations: [], finance: [], system: [],
    };
    for (const item of allItems) {
      if (!checkPermission(item.permission)) continue;
      const { permission, group, ...rest } = item;
      buckets[group].push(rest);
    }
    const groups: RoleSidebarNavGroup[] = [];
    if (buckets.main.length)       groups.push({                          items: buckets.main });
    if (buckets.clinical.length)   groups.push({ label: labels.clinical,   items: buckets.clinical });
    if (buckets.operations.length) groups.push({ label: labels.operations, items: buckets.operations });
    if (buckets.finance.length)    groups.push({ label: labels.finance,    items: buckets.finance });
    if (buckets.system.length)     groups.push({ label: labels.system,     items: buckets.system });
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, labels, canView, isDoctor, isSuperAdmin]);

  /**
   * Hand the resolved menu to the shell so the command palette offers exactly
   * the destinations this user may open — no second copy of the permission
   * rules to drift out of sync.
   */
  const shell = useCabinetShell();
  const publishNavEntries = shell?.publishNavEntries;
  useEffect(() => {
    if (!publishNavEntries) return;
    publishNavEntries(
      groupedItems.flatMap((group) =>
        group.items.map((item) => ({
          title: item.title,
          path: item.path,
          group: group.label,
        })),
      ),
    );
  }, [publishNavEntries, groupedItems]);

  const roleLabel = useMemo(() => {
    const roleLabels: Record<string, string> = {
      super_admin: t("crm.roleSuperAdmin"),
      clinic_admin: t("crm.roleAdmin"),
      clinic_manager: t("crm.roleManager"),
      doctor: t("crm.roleDoctor"),
      assistant: t("crm.roleAssistant"),
      accountant: t("crm.roleAccountant"),
      patient: t("crm.rolePatient"),
    };
    return (role && roleLabels[role]) || t("crm.roleDoctor");
  }, [role, t]);

  // Show the clinic switcher for users who actually belong to more than one
  // clinic (super admins always see it). For everyone else, hide to save
  // sidebar vertical space.
  const showSwitcher = clinics.length > 1 || isSuperAdmin;

  return (
    <RoleSidebar
      roleLabel={roleLabel}
      items={groupedItems}
      extra={showSwitcher ? <ClinicSwitcher /> : undefined}
    />
  );
}
