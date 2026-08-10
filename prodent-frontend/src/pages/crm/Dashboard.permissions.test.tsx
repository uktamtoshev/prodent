import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  canView: vi.fn(),
  clinicRole: "doctor",
  getReportSummary: vi.fn(),
  permissions: [] as Array<{ module: string; can_view: boolean }>,
  permissionsLoading: false,
  statsError: false,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: (options: {
    queryKey: unknown[];
    queryFn: () => unknown;
    enabled?: boolean;
  }) => {
    if (options.queryKey[0] === "onboarding-status") {
      return { data: true, isLoading: false, isError: false };
    }
    // Запрос запускаем, но его отказ гасим здесь. Настоящий React Query ловит
    // отказ сам и отдаёт его через isError; этот упрощённый мок такого не
    // умеет, и незакрытый промис всплывал бы как unhandled rejection всего
    // прогона. Появилось это ровно тогда, когда запрос записей перестал
    // молча возвращать пустой список и начал честно падать.
    if (options.enabled) {
      // Вызов остаётся СИНХРОННЫМ: тесты проверяют факт обращения сразу после
      // отрисовки. Гасим только отказ уже возвращённого промиса.
      try {
        const started = options.queryFn() as unknown;
        if (started && typeof (started as Promise<unknown>).catch === "function") {
          void (started as Promise<unknown>).catch(() => undefined);
        }
      } catch {
        // Синхронный бросок для этого мока тоже не новость.
      }
    }
    return { data: null, isLoading: false, isError: mocks.statsError };
  },
}));

vi.mock("@/contexts/ClinicContext", () => ({
  useClinic: () => ({
    currentClinic: { id: "clinic-1", name: "Test clinic", role: mocks.clinicRole },
    loading: false,
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "ru", t: () => "" }),
}));

vi.mock("@/hooks/useModulePermissions", () => ({
  useModulePermissions: () => ({
    canView: mocks.canView,
    isLoading: mocks.permissionsLoading,
    permissions: mocks.permissions,
  }),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ isAdmin: false, isSuperAdmin: false }),
}));

vi.mock("@/lib/clinic-settings", () => ({
  fetchClinicSetting: vi.fn(),
}));

vi.mock("@/lib/crm-operations-api", () => ({
  getReportSummary: mocks.getReportSummary,
}));

vi.mock("@/components/crm/CRMLayout", () => ({
  CRMLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/crm/dashboard/DashboardStatCard", () => ({
  DashboardStatCard: ({ title }: { title: string }) => (
    <div data-testid="dashboard-stat-card">{title}</div>
  ),
}));

vi.mock("@/components/crm/dashboard/TimelineSchedule", () => ({
  TimelineSchedule: () => <div>timeline</div>,
}));

vi.mock("@/components/crm/dashboard/EnhancedLiveQueue", () => ({
  EnhancedLiveQueue: () => <div>queue</div>,
}));

vi.mock("@/components/crm/tasks/DashboardTasksWidget", () => ({
  DashboardTasksWidget: () => <div>tasks</div>,
}));

vi.mock("@/components/crm/onboarding/OnboardingWizard", () => ({
  OnboardingWizard: () => <div>onboarding</div>,
}));

import CRMDashboard from "./Dashboard";


/**
 * Страница ведёт ссылками на срезы дня (расписание, долги), поэтому её
 * нельзя рендерить без роутера — <Link> без него падает. Оболочка здесь
 * подменена заглушкой, роутер она не приносит, значит его даёт тест.
 */
const renderDashboard = () =>
  render(
    <MemoryRouter>
      <CRMDashboard />
    </MemoryRouter>,
  );

describe("CRM dashboard report permissions", () => {
  beforeEach(() => {
    mocks.canView.mockReset();
    mocks.getReportSummary.mockReset().mockResolvedValue({});
    mocks.clinicRole = "doctor";
    mocks.permissions = [];
    mocks.permissionsLoading = false;
    mocks.statsError = false;
  });

  it("does not request or show clinic report KPIs for a doctor", () => {
    // Even an accidental explicit grant must not bypass the backend role wall.
    mocks.canView.mockReturnValue(true);

    renderDashboard();

    expect(mocks.getReportSummary).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("dashboard-stat-card")).toHaveLength(0);
    expect(screen.getByText("timeline")).toBeInTheDocument();
    expect(screen.getByText("queue")).toBeInTheDocument();
    expect(screen.getByText("tasks")).toBeInTheDocument();
  });

  it("waits for permissions before loading clinic report KPIs", () => {
    mocks.clinicRole = "clinic_admin";
    mocks.permissionsLoading = true;
    mocks.canView.mockReturnValue(true);

    renderDashboard();

    expect(mocks.getReportSummary).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("dashboard-stat-card")).toHaveLength(0);
  });

  it("loads and shows clinic report KPIs for an allowed role", () => {
    mocks.clinicRole = "clinic_admin";
    mocks.canView.mockReturnValue(true);

    renderDashboard();

    expect(mocks.getReportSummary).toHaveBeenCalledWith(
      "clinic-1",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(screen.getAllByTestId("dashboard-stat-card")).toHaveLength(4);
  });

  it("honors an explicit reports denial for an otherwise allowed role", () => {
    mocks.clinicRole = "clinic_admin";
    mocks.canView.mockReturnValue(true);
    mocks.permissions = [{ module: "reports", can_view: false }];

    renderDashboard();

    expect(mocks.getReportSummary).not.toHaveBeenCalled();
    expect(screen.queryAllByTestId("dashboard-stat-card")).toHaveLength(0);
  });

  it("shows a warning when an allowed report request fails", () => {
    mocks.clinicRole = "clinic_manager";
    mocks.canView.mockReturnValue(true);
    mocks.statsError = true;

    renderDashboard();

    expect(mocks.getReportSummary).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
