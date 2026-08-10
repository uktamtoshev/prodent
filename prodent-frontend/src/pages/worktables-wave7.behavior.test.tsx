import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { user: { id: "user-1" } as { id: string } | null },
  toast: vi.fn(),
  listMaterials: vi.fn(),
  createMaterial: vi.fn(),
  adjustMaterial: vi.fn(),
  listOrders: vi.fn(),
  searchCustomers: vi.fn(),
  createOrder: vi.fn(),
  getMySupplier: vi.fn(),
  listMyProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  sellerToastError: vi.fn(),
  sellerToastSuccess: vi.fn(),
  buyerOrders: [] as Array<Record<string, unknown>>,
  marketRefetch: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.auth.user }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  // Заглушка отдаёт и переводчик: страницы этого набора берут из контекста не
  // только язык. Без `t` компонент падал с «t is not a function», хотя ошибка
  // была в заглушке, а не в странице. Возвращаем ключ — тесты здесь проверяют
  // поведение, а не тексты.
  useLanguage: () => ({ language: "ru", t: (key: string) => key }),
}));

vi.mock("@/components/technician/TechnicianLayout", () => ({
  TechnicianLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/seller/SellerLayout", () => ({
  SellerLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.sellerToastError,
    success: mocks.sellerToastSuccess,
  },
}));

vi.mock("@/lib/lab", () => ({
  lab: {
    listMaterials: mocks.listMaterials,
    createMaterial: mocks.createMaterial,
    adjustMaterial: mocks.adjustMaterial,
    listOrders: mocks.listOrders,
    searchCustomers: mocks.searchCustomers,
    createOrder: mocks.createOrder,
  },
}));

vi.mock("@/lib/marketplace", () => ({
  marketplace: {
    getMySupplier: mocks.getMySupplier,
    listMyProducts: mocks.listMyProducts,
    createProduct: mocks.createProduct,
    updateProduct: mocks.updateProduct,
    deleteProduct: mocks.deleteProduct,
    listOrders: vi.fn(),
    updateOrderStatus: vi.fn(),
    startTestPayment: vi.fn(),
    openDispute: vi.fn(),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: mocks.buyerOrders,
    isLoading: false,
    error: null,
    refetch: mocks.marketRefetch,
  }),
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    variables: undefined,
  }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
      }),
    },
  },
}));

import SellerProducts from "./seller/SellerProducts";
import SellerOrders from "./seller/SellerOrders";
import SellerWarehouse from "./seller/SellerWarehouse";
import MarketOrders from "./market/MarketOrders";
import TechnicianMaterials from "./technician/TechnicianMaterials";
import TechnicianOrders from "./technician/TechnicianOrders";

describe("wave 7 worktable behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = { id: "user-1" };
    mocks.listMaterials.mockResolvedValue([]);
    mocks.listOrders.mockResolvedValue([]);
    mocks.searchCustomers.mockResolvedValue([]);
    mocks.getMySupplier.mockResolvedValue({ id: "supplier-1" });
    mocks.listMyProducts.mockResolvedValue([]);
    mocks.buyerOrders = [];
  });

  it("blocks material creation after a failed load and restores it after retry", async () => {
    const user = userEvent.setup();
    mocks.listMaterials
      .mockRejectedValueOnce(new Error("Склад недоступен"))
      .mockResolvedValueOnce([]);

    render(<TechnicianMaterials />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить материалы");
    const addMaterial = screen.getByRole("button", { name: "Добавить материал" });
    expect(addMaterial).toBeDisabled();
    expect(mocks.createMaterial).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => expect(addMaterial).toBeEnabled());

    await user.click(addMaterial);
    const name = screen.getByRole("textbox", { name: /Название/ });
    await user.click(name);
    await user.tab();

    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Добавить" })).toBeDisabled();
    expect(mocks.createMaterial).not.toHaveBeenCalled();
  });

  it.each([
    ["заказы", SellerOrders],
    ["склад", SellerWarehouse],
  ])("does not leave seller %s in an endless loading state without a user", async (_name, Page) => {
    mocks.auth.user = null;

    render(<Page />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось определить пользователя");
    expect(screen.queryByRole("status", { name: /загрузка/i })).not.toBeInTheDocument();
    expect(mocks.getMySupplier).not.toHaveBeenCalled();
  });

  it("keeps technician order creation disabled until load succeeds and work type is valid", async () => {
    const user = userEvent.setup();
    mocks.listOrders
      .mockRejectedValueOnce(new Error("Заказы недоступны"))
      .mockResolvedValueOnce([]);

    render(<TechnicianOrders />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить заказы");
    const newOrder = screen.getByRole("button", { name: "Новый заказ" });
    expect(newOrder).toBeDisabled();
    expect(mocks.createOrder).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => expect(newOrder).toBeEnabled());
    await user.click(newOrder);

    const workType = screen.getByRole("textbox", { name: /Тип работы/ });
    await user.click(workType);
    await user.tab();

    expect(workType).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Создать заказ" })).toBeDisabled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("does not expose seller product creation on GET error and validates the required name after retry", async () => {
    const user = userEvent.setup();
    mocks.getMySupplier
      .mockRejectedValueOnce(new Error("Витрина недоступна"))
      .mockResolvedValueOnce({ id: "supplier-1" });

    render(<SellerProducts />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить витрину");
    expect(screen.queryByRole("button", { name: "Добавить" })).not.toBeInTheDocument();
    expect(mocks.createProduct).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Повторить" }));
    const addProduct = await screen.findByRole("button", { name: "Добавить" });
    await user.click(addProduct);

    const name = screen.getByRole("textbox", { name: /Название/ });
    await user.click(name);
    await user.tab();

    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
    expect(mocks.createProduct).not.toHaveBeenCalled();
  });

  it("shows a useful empty state when the selected market order status disappears", async () => {
    const user = userEvent.setup();
    const baseOrder = {
      supplier_name: "ДентСнаб",
      total_amount: 1000,
      currency: "UZS",
      delivery_address: null,
      payment_status: null,
      created_at: "2026-07-28T08:00:00Z",
      items: [],
      events: [],
    };
    mocks.buyerOrders = [
      { ...baseOrder, id: "order-1", order_number: 1, status: "new" },
      { ...baseOrder, id: "order-2", order_number: 2, status: "completed" },
    ];

    const view = render(
      <MemoryRouter>
        <MarketOrders />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Выполнен" }));

    mocks.buyerOrders = [
      { ...baseOrder, id: "order-1", order_number: 1, status: "new" },
    ];
    view.rerender(
      <MemoryRouter>
        <MarketOrders />
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("В этом статусе заказов нет");
    await user.click(screen.getByRole("button", { name: "Показать все" }));
    expect(screen.getByText("№ 1")).toBeVisible();
  });
});
