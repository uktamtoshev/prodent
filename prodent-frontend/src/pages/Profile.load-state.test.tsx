import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profileSingle: vi.fn(),
  navigate: vi.fn(),
  toast: vi.fn(),
  user: { id: "patient-1", email: "patient@example.test" },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mocks.user,
    loading: false,
  }),
}));

vi.mock("@/contexts/AdminContext", () => ({
  useAdmin: () => ({ isSuperAdmin: false }),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({
    isDoctor: false,
    isClinicAdmin: false,
    role: "patient",
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/components/patient/PatientLayout", () => ({
  PatientLayout: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "profiles") {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          single: mocks.profileSingle,
        };
        return query;
      }

      if (table === "appointments") {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          or: vi.fn(() => query),
          gte: vi.fn(() => query),
          then: (
            resolve: (value: { count: number; error: null }) => unknown,
          ) => Promise.resolve({ count: 0, error: null }).then(resolve),
        };
        return query;
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

import Profile from "./Profile";

describe("patient profile loading safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks editing after a rejected load and recovers through retry", async () => {
    mocks.profileSingle.mockResolvedValue({
      data: null,
      error: new Error("temporary profile failure"),
    });

    render(<Profile />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не удалось загрузить профиль",
    );
    expect(
      screen.queryByRole("button", { name: "Редактировать" }),
    ).not.toBeInTheDocument();

    mocks.profileSingle.mockResolvedValue({
        data: {
          full_name: "Иван Пациент",
          account_number: "P-1",
          phone: "+998901234567",
          avatar_url: "",
          birth_date: null,
          gender: null,
          address: null,
        },
        error: null,
      });

    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));

    expect(
      await screen.findByRole("heading", { name: "Иван Пациент" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Редактировать" }),
    ).toBeEnabled();
    expect(mocks.profileSingle.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
