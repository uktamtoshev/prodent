import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ClinicFinanceOperations } from "./ClinicFinanceOperations";
import {
  isFinanceScopeActive,
  setFinanceScopeDuringRender,
} from "./finance-scope";

const api = vi.hoisted(() => ({
  clearPersistentClientRequestId: vi.fn(),
  createClinicInvoice: vi.fn(),
  createClinicPayment: vi.fn(),
  getPersistentClientRequestId: vi.fn(() => "request-1"),
  listClinicDebts: vi.fn(),
  listClinicInvoices: vi.fn(),
  listReportOperations: vi.fn(),
  refundClinicPayment: vi.fn(),
  searchClinicPatients: vi.fn(),
}));
const context = vi.hoisted(() => ({
  actorId: "user-1",
  clinicId: "clinic-1",
}));
const notifications = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: context.actorId } }),
}));
vi.mock("@/contexts/ClinicContext", () => ({
  useClinic: () => ({ currentClinic: { id: context.clinicId } }),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "ru" }),
}));
vi.mock("sonner", () => ({
  toast: notifications,
}));
vi.mock("@/lib/crm-operations-api", () => api);

const invoice = {
  id: "invoice-1",
  invoice_number: "INV-1",
  balance_due: 1_000,
  currency: "UZS",
  patient_name: "Пациент",
  status: "ISSUED",
};
const payment = {
  event_type: "PAYMENT",
  payment_id: "payment-1",
  invoice_number: "INV-1",
  amount: 500,
  currency: "UZS",
};

function renderFinance() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const finance = () => (
    <MemoryRouter initialEntries={["/crm/finance?tab=payments"]}>
      <QueryClientProvider client={client}>
        <ClinicFinanceOperations focus="payments" />
      </QueryClientProvider>
    </MemoryRouter>
  );
  const view = render(finance());
  return {
    ...view,
    rerenderFinance: () => view.rerender(finance()),
  };
}

beforeAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  context.actorId = "user-1";
  context.clinicId = "clinic-1";
  api.getPersistentClientRequestId.mockReturnValue("request-1");
  api.listClinicDebts.mockResolvedValue([]);
  api.listClinicInvoices.mockResolvedValue([invoice]);
  api.listReportOperations.mockResolvedValue([payment]);
  api.createClinicPayment.mockResolvedValue({});
  api.refundClinicPayment.mockResolvedValue({});
});

describe("ClinicFinanceOperations reconciliation", () => {
  it("changes active actor and clinic synchronously without waiting for effects", () => {
    const ref = {
      current: { actor: "user-1", clinicId: "clinic-1" as string | undefined },
    };

    setFinanceScopeDuringRender(ref, { actor: "user-2", clinicId: "clinic-2" });

    expect(
      isFinanceScopeActive(ref.current, { actor: "user-1", clinicId: "clinic-1" }),
    ).toBe(false);
    expect(
      isFinanceScopeActive(ref.current, { actor: "user-2", clinicId: "clinic-2" }),
    ).toBe(true);
  });

  it("keeps the request key and blocks a second payment when POST succeeds but refresh fails", async () => {
    const user = userEvent.setup();
    api.listClinicInvoices
      .mockResolvedValueOnce([invoice])
      .mockRejectedValueOnce(new Error("refresh failed"))
      .mockResolvedValue([invoice]);
    renderFinance();

    await user.click(await screen.findByRole("combobox", { name: "Счёт" }));
    await user.click(screen.getByRole("option", { name: /INV-1/ }));
    await user.type(screen.getAllByLabelText("Сумма (UZS)")[0], "500");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Операция сохранена");
    expect(api.createClinicPayment).toHaveBeenCalledTimes(1);
    expect(api.clearPersistentClientRequestId).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Обновить данные" }));

    await waitFor(() => expect(api.clearPersistentClientRequestId).toHaveBeenCalledTimes(1));
    expect(api.createClinicPayment).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not send a refund before explicit confirmation", async () => {
    const user = userEvent.setup();
    renderFinance();

    await user.click(await screen.findByRole("combobox", { name: "Платёж" }));
    await user.click(screen.getByRole("option", { name: /INV-1/ }));
    await user.type(screen.getAllByLabelText("Сумма (UZS)")[1], "100");
    await user.type(screen.getByLabelText("Причина"), "Ошибка кассира");
    await user.click(screen.getByRole("button", { name: "Оформить возврат" }));

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(api.refundClinicPayment).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Подтвердить возврат" }));

    await waitFor(() => expect(api.refundClinicPayment).toHaveBeenCalledTimes(1));
  });

  it("clears clinic A form, dialog and sync lock when clinic B becomes active", async () => {
    const user = userEvent.setup();
    api.listClinicInvoices.mockImplementation(async (clinicId: string) => [
      { ...invoice, id: `${clinicId}-invoice`, invoice_number: clinicId },
    ]);
    api.listReportOperations.mockImplementation(async (clinicId: string) => [
      { ...payment, payment_id: `${clinicId}-payment`, invoice_number: clinicId },
    ]);
    const view = renderFinance();

    await user.click(await screen.findByRole("combobox", { name: "Платёж" }));
    await user.click(screen.getByRole("option", { name: /clinic-1/ }));
    await user.type(screen.getAllByLabelText("Сумма (UZS)")[1], "100");
    await user.type(screen.getByLabelText("Причина"), "Ошибка кассира");
    await user.click(screen.getByRole("button", { name: "Оформить возврат" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();

    context.clinicId = "clinic-2";
    view.rerenderFinance();

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Причина")).toHaveValue("");
    expect(screen.getAllByLabelText("Сумма (UZS)")[1]).toHaveValue(null);
    expect(screen.getByRole("combobox", { name: "Платёж" })).toHaveTextContent("Выберите платёж");
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ignores a finished payment when another actor becomes active", async () => {
    const user = userEvent.setup();
    let resolvePayment: ((value: object) => void) | undefined;
    api.createClinicPayment.mockImplementationOnce(
      () =>
        new Promise<object>((resolve) => {
          resolvePayment = resolve;
        }),
    );
    const view = renderFinance();

    await user.click(await screen.findByRole("combobox", { name: "Счёт" }));
    await user.click(screen.getByRole("option", { name: /INV-1/ }));
    await user.type(screen.getAllByLabelText("Сумма (UZS)")[0], "500");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(api.createClinicPayment).toHaveBeenCalledTimes(1));

    context.actorId = "user-2";
    view.rerenderFinance();
    resolvePayment?.({});

    await waitFor(() => expect(api.listClinicInvoices).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled(),
    );
    expect(notifications.success).not.toHaveBeenCalled();
    expect(api.clearPersistentClientRequestId).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
