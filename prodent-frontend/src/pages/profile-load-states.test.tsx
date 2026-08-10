import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { user: { id: "user-1" } as { id: string } | null },
  getMySupplier: vi.fn(),
  upsertSupplier: vi.fn(),
  getProfile: vi.fn(),
  listServices: vi.fn(),
  updateProfile: vi.fn(),
  createService: vi.fn(),
  updateService: vi.fn(),
  deleteService: vi.fn(),
  sellerToastError: vi.fn(),
  sellerToastSuccess: vi.fn(),
  technicianToast: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.auth.user }),
}));

vi.mock("@/components/seller/SellerLayout", () => ({
  SellerLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/technician/TechnicianLayout", () => ({
  TechnicianLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/marketplace", () => ({
  marketplace: {
    getMySupplier: mocks.getMySupplier,
    upsertSupplier: mocks.upsertSupplier,
  },
}));

vi.mock("@/lib/lab", () => ({
  lab: {
    getProfile: mocks.getProfile,
    listServices: mocks.listServices,
    updateProfile: mocks.updateProfile,
    createService: mocks.createService,
    updateService: mocks.updateService,
    deleteService: mocks.deleteService,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.sellerToastError,
    success: mocks.sellerToastSuccess,
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.technicianToast }),
}));

import SellerProfile from "./seller/SellerProfile";
import TechnicianProfile from "./technician/TechnicianProfile";

const supplier = {
  id: "supplier-1",
  user_id: "user-1",
  name: "ДентСнаб",
  description: null,
  logo_url: null,
  phone: null,
  email: null,
  website: null,
  address: null,
  city: null,
  inn: null,
  delivery_terms: null,
  payment_terms: null,
  warehouse_address: null,
  rating: 0,
  reviews_count: 0,
  is_verified: false,
  is_active: true,
  moderation_status: "approved" as const,
};

const labProfile = {
  user_id: "user-1",
  display_name: "Лаборатория",
  description: null,
  phone: null,
  city: null,
  address: null,
  avatar_url: null,
  is_public: true,
  verified_at: null,
  user_full_name: "Техник",
  email: null,
};

describe("profile load states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = { id: "user-1" };
    mocks.upsertSupplier.mockResolvedValue(supplier);
    mocks.getProfile.mockResolvedValue(labProfile);
    mocks.listServices.mockResolvedValue([]);
  });

  it("blocks the seller form and upsert when the profile GET fails", async () => {
    mocks.getMySupplier.mockRejectedValueOnce(new Error("Сеть недоступна"));

    render(<SellerProfile />);

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Не удалось загрузить витрину");
    expect(error).toHaveTextContent("Сеть недоступна");
    expect(screen.queryByLabelText("Название компании")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Создать витрину" })).not.toBeInTheDocument();
    expect(mocks.upsertSupplier).not.toHaveBeenCalled();
  });

  it("retries the seller GET and shows create mode only after a confirmed null response", async () => {
    const user = userEvent.setup();
    mocks.getMySupplier
      .mockRejectedValueOnce(new Error("Сеть недоступна"))
      .mockResolvedValueOnce(null);

    render(<SellerProfile />);

    await user.click(await screen.findByRole("button", { name: "Попробовать снова" }));

    expect(await screen.findByRole("textbox", { name: /Название компании/ })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Создать витрину" })).toBeVisible();
    expect(mocks.getMySupplier).toHaveBeenCalledTimes(2);
    expect(mocks.upsertSupplier).not.toHaveBeenCalled();
  });

  it("treats only an explicit 404 rejection as a missing seller", async () => {
    mocks.getMySupplier.mockRejectedValueOnce(
      Object.assign(new Error("HTTP 404"), { status: 404 }),
    );

    render(<SellerProfile />);

    expect(await screen.findByRole("textbox", { name: /Название компании/ })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Создать витрину" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.upsertSupplier).not.toHaveBeenCalled();
  });

  it("renders the existing seller only after a successful GET", async () => {
    mocks.getMySupplier.mockResolvedValueOnce(supplier);

    render(<SellerProfile />);

    expect(await screen.findByRole("textbox", { name: /Название компании/ })).toHaveValue("ДентСнаб");
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeVisible();
  });

  it("replaces the technician spinner with an error and retries both GET requests", async () => {
    const user = userEvent.setup();
    mocks.getProfile
      .mockRejectedValueOnce(new Error("Сервис недоступен"))
      .mockResolvedValueOnce(labProfile);

    render(<TechnicianProfile />);

    const retry = await screen.findByRole("button", { name: "Попробовать снова" });
    expect(screen.getByRole("alert")).toHaveTextContent("Не удалось загрузить профиль лаборатории");
    expect(screen.queryByText("Загрузка…")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Сохранить профиль" })).not.toBeInTheDocument();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
    expect(mocks.createService).not.toHaveBeenCalled();

    await user.click(retry);

    expect(await screen.findByLabelText("Название лаборатории")).toHaveValue("Лаборатория");
    await waitFor(() => expect(mocks.getProfile).toHaveBeenCalledTimes(2));
    expect(mocks.listServices).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Сохранить профиль" })).toBeVisible();
  });
});
