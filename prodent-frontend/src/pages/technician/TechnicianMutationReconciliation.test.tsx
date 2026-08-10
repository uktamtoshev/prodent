import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  getRequestId: vi.fn(() => "request-1"),
  clearRequestId: vi.fn(),
  getOrder: vi.fn(),
  listSettlements: vi.fn(),
  createSettlement: vi.fn(),
  cancelOrder: vi.fn(),
  advanceOrder: vi.fn(),
  listOrderMaterials: vi.fn(),
  listMaterials: vi.fn(),
  adjustMaterial: vi.fn(),
  createMaterial: vi.fn(),
  listMessages: vi.fn(),
  listClarifications: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "technician-1" } }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "ru" }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/components/technician/TechnicianLayout", () => ({
  TechnicianLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/technician/LabOrderFilesPanel", () => ({
  LabOrderFilesPanel: () => null,
}));

vi.mock("@/lib/crm-operations-api", () => ({
  getPersistentClientRequestId: mocks.getRequestId,
  clearPersistentClientRequestId: mocks.clearRequestId,
}));

vi.mock("@/lib/lab", () => ({
  lab: {
    getOrder: mocks.getOrder,
    listSettlements: mocks.listSettlements,
    createSettlement: mocks.createSettlement,
    cancelOrder: mocks.cancelOrder,
    advanceOrder: mocks.advanceOrder,
    listOrderMaterials: mocks.listOrderMaterials,
    listMaterials: mocks.listMaterials,
    adjustMaterial: mocks.adjustMaterial,
    createMaterial: mocks.createMaterial,
    listMessages: mocks.listMessages,
    listClarifications: mocks.listClarifications,
    listOrderFiles: vi.fn().mockResolvedValue([]),
    consumeMaterial: vi.fn(),
    undoConsumeMaterial: vi.fn(),
    sendMessage: vi.fn(),
    createClarification: vi.fn(),
    acceptOrder: vi.fn(),
    declineOrder: vi.fn(),
  },
}));

import TechnicianMaterials from "./TechnicianMaterials";
import TechnicianOrder from "./TechnicianOrder";

const order = {
  id: "order-1",
  order_number: 101,
  status: "queued",
  work_type: "Коронка",
  patient_name: "Пациент",
  price: 1000,
  currency: "UZS",
  clinic_id: "clinic-1",
  created_at: "2026-07-28T08:00:00Z",
  updated_at: "2026-07-28T08:00:00Z",
  events: [],
};

const material = {
  id: "material-1",
  name: "Цирконий",
  category: "Диски",
  unit: "шт",
  stock_qty: 1,
  min_qty: 0,
  unit_cost: 100,
  supplier: null,
  notes: null,
  created_at: "2026-07-28T08:00:00Z",
  updated_at: "2026-07-28T08:00:00Z",
};

function renderOrder() {
  return render(
    <MemoryRouter initialEntries={["/technician/order?id=order-1"]}>
      <TechnicianOrder />
    </MemoryRouter>,
  );
}

describe("technician mutation reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestId.mockReturnValue("request-1");
    mocks.getOrder.mockResolvedValue(order);
    mocks.listSettlements.mockResolvedValue([]);
    mocks.createSettlement.mockResolvedValue({
      id: "settlement-1",
      order_id: "order-1",
      entry_type: "PAYMENT",
      amount: 1000,
      currency: "UZS",
      method: "CASH",
      note: "Payment recorded",
      created_at: "2026-07-28T09:00:00Z",
    });
    mocks.cancelOrder.mockResolvedValue(order);
    mocks.advanceOrder.mockResolvedValue(order);
    mocks.listOrderMaterials.mockResolvedValue([]);
    mocks.listMaterials.mockResolvedValue([]);
    mocks.adjustMaterial.mockResolvedValue({ ...material, stock_qty: 2 });
    mocks.createMaterial.mockResolvedValue(material);
    mocks.listMessages.mockResolvedValue([]);
    mocks.listClarifications.mockResolvedValue([]);
  });

  it("keeps the payment request id and blocks a duplicate when POST succeeds but refresh fails", async () => {
    const user = userEvent.setup();
    mocks.getOrder
      .mockResolvedValueOnce(order)
      .mockRejectedValueOnce(new Error("refresh failed"))
      .mockResolvedValueOnce(order);
    mocks.listSettlements
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "settlement-1",
          order_id: "order-1",
          entry_type: "PAYMENT",
          amount: 1000,
          currency: "UZS",
          method: "CASH",
          note: "Payment recorded",
          created_at: "2026-07-28T09:00:00Z",
        },
      ]);

    renderOrder();

    await user.click(await screen.findByRole("button", { name: "Записать платёж" }));

    await waitFor(() => expect(mocks.createSettlement).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent("refresh failed");
    expect(screen.queryByRole("button", { name: "Записать платёж" })).not.toBeInTheDocument();
    expect(mocks.clearRequestId).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Повторить" }));

    await waitFor(() => expect(mocks.clearRequestId).toHaveBeenCalledTimes(1));
    expect(mocks.createSettlement).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Оплачен")).toBeVisible();
  });

  it("does not adjust stock twice when POST succeeds but the following GET fails", async () => {
    const user = userEvent.setup();
    mocks.listMaterials
      .mockResolvedValueOnce([material])
      .mockRejectedValueOnce(new Error("refresh failed"))
      .mockResolvedValueOnce([{ ...material, stock_qty: 2 }]);

    render(<TechnicianMaterials />);

    await user.click(await screen.findByRole("button", { name: "Увеличить остаток" }));

    await waitFor(() => expect(mocks.adjustMaterial).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent("refresh failed");
    expect(screen.queryByRole("button", { name: "Увеличить остаток" })).not.toBeInTheDocument();
    expect(mocks.clearRequestId).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Повторить" }));

    await waitFor(() => expect(mocks.clearRequestId).toHaveBeenCalledTimes(1));
    expect(mocks.adjustMaterial).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("2 шт")).toBeVisible();
  });

  it("requires an AlertDialog confirmation before cancelling an order", async () => {
    const user = userEvent.setup();
    renderOrder();

    await user.click(await screen.findByRole("button", { name: "Отменить заказ" }));

    expect(screen.getByRole("alertdialog")).toHaveTextContent("Отменить заказ?");
    expect(mocks.cancelOrder).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Подтвердить отмену" }));

    await waitFor(() => expect(mocks.cancelOrder).toHaveBeenCalledTimes(1));
  });
});
