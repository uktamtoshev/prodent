import { describe, expect, it } from "vitest";
import patients from "./pages/crm/Patients.tsx?raw";
import dashboardTasks from "./components/crm/tasks/DashboardTasksWidget.tsx?raw";
import dashboard from "./pages/crm/Dashboard.tsx?raw";
import statCard from "./components/crm/dashboard/DashboardStatCard.tsx?raw";
import schedule from "./pages/crm/Schedule.tsx?raw";
import finance from "./pages/crm/Finance.tsx?raw";
import technicianOrder from "./pages/technician/TechnicianOrder.tsx?raw";
import technicianMaterials from "./pages/technician/TechnicianMaterials.tsx?raw";
import technicianFinance from "./pages/technician/TechnicianFinance.tsx?raw";
import technicianSettlements from "./pages/technician/TechnicianSettlements.tsx?raw";
import labFinance from "./pages/lab/LabFinance.tsx?raw";
import patientDetail from "./pages/crm/PatientDetail.tsx?raw";
import invitations from "./pages/crm/Invitations.tsx?raw";

describe("Sprint 7 P1 regressions", () => {
  it("does not request patient search with an empty q", () => {
    expect(patients).toContain("search.trim().length >= 2");
  });

  it("uses versioned dedicated task operations", () => {
    expect(dashboardTasks).toContain("listClinicTasks");
    expect(dashboardTasks).toContain("expectedVersion: task.version");
    expect(dashboardTasks).not.toContain('from("clinic_tasks")');
  });

  it("makes KPI cards drill into authoritative details", () => {
    expect(statCard).toContain("href?: string");
    expect(dashboard).toContain('href={`/crm/schedule?from=${todayKey}&to=${todayKey}`}');

    // Проверяем ПРАВИЛО, а не конкретный адрес: у каждой плитки есть ссылка на
    // экран, где её число считается источником истины. Раньше здесь стоял
    // адрес плитки долга. Плитка убрана: по утверждённому макету на «Главной»
    // четыре показателя ДНЯ (приёмы, завершено, доход, не подтвердили), а
    // общий долг — не показатель дня и живёт в «Финансах», куда ведёт пункт
    // меню. Если долг вернут на «Главную», ссылка обязана вернуться вместе с
    // ним — это и проверяет правило ниже.
    const cardBlocks = dashboard.split("<DashboardStatCard").slice(1);
    expect(cardBlocks.length, "на «Главной» нет плиток KPI").toBeGreaterThanOrEqual(4);
    for (const [index, block] of cardBlocks.entries()) {
      const card = block.slice(0, block.indexOf("/>"));
      expect(card, `плитка ${index + 1} никуда не ведёт`).toContain("href=");
    }
  });

  it("supports day/week, bulk status and reschedule", () => {
    // Периоды календаря вынесены в именованный тип: по макету к дню и неделе
    // добавлен месяц, и перечислять их прямо в useState стало нечитаемо.
    // Проверяем, что день и неделя по-прежнему поддержаны, а состояние вида
    // объявлено этим типом — тогда добавление периода не проходит мимо теста.
    expect(schedule).toMatch(/type CalendarView = [^;]*"day"/);
    expect(schedule).toMatch(/type CalendarView = [^;]*"week"/);
    expect(schedule).toContain("useState<CalendarView>");
    expect(schedule).toContain('action: "reschedule"');
    expect(schedule).toContain("expectedVersion: row.version");
  });

  it("does not mount legacy finance totals", () => {
    expect(finance).toContain("AuthoritativeFinanceSummary");
    expect(finance).not.toContain("FinanceDashboard");
    expect(finance).not.toContain("ComprehensiveReports");
  });

  it("scopes lab request keys by authenticated user", () => {
    for (const source of [technicianMaterials, technicianFinance, technicianSettlements]) {
      expect(source).toContain("user?.id");
      expect(source).not.toContain('getPersistentClientRequestId("technician"');
    }
  });

  it("calculates partial order balance from settlement ledger", () => {
    expect(technicianOrder).toContain("lab.listSettlements(id)");
    expect(technicianOrder).toContain("remainingAmount");
    expect(technicianOrder).toContain("amount > remainingAmount");
  });

  it("keeps lab finance ledger-authoritative and mobile scrollable", () => {
    expect(labFinance).toContain("lab.listSettlements(order.id)");
    for (const source of [technicianMaterials, technicianFinance, technicianSettlements, labFinance]) {
      expect(source).toContain("min-w-[");
    }
  });

  it("shows secured treatment plans, consent and debts in patient detail", () => {
    expect(patientDetail).toContain("getPatientTreatmentPlans");
    expect(patientDetail).toContain("patientConsentConfirmedAt");
    expect(patientDetail).toContain("listClinicDebts");
    expect(patientDetail).toContain("<PatientFiles");
  });

  it("lists, resends and cancels staff invitations and exposes the token decision link", () => {
    expect(invitations).toContain("listClinicStaffInvitations");
    expect(invitations).toContain("resendClinicStaffInvitation");
    expect(invitations).toContain("cancelClinicStaffInvitation");
    expect(invitations).toContain("/staff-invitations/${result.token}");
  });
});
