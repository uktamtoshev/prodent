import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoleRouteBoundary } from "./RoleRouteBoundary";
import type { RoleRouteGroup } from "./role-route-policy";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  eq: vi.fn(),
  useAuth: vi.fn(),
  useUserRole: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: mocks.useUserRole,
}));

function CurrentLocation() {
  const location = useLocation();
  const returnTo =
    location.state &&
    typeof location.state === "object" &&
    "returnTo" in location.state
      ? String(location.state.returnTo)
      : "";
  return (
    <div data-testid="location" data-return-to={returnTo}>
      {location.pathname}
    </div>
  );
}

function setRoles(globalRoles: string[], membershipRoles: string[]) {
  mocks.from.mockImplementation((table: string) => {
    const result = {
      data: (table === "user_roles" ? globalRoles : membershipRoles).map(
        (role) => ({ role }),
      ),
      error: null,
    };
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        mocks.eq(table, column, value);
        return builder;
      },
      then: (
        resolve: (value: typeof result) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
}

function renderBoundary(
  child: React.ReactNode = <div>protected page</div>,
  group: RoleRouteGroup = "assistant",
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/assistant/schedule"]}>
        <Routes>
          <Route
            path="/assistant/schedule"
            element={
              <RoleRouteBoundary group={group}>
                {child}
              </RoleRouteBoundary>
            }
          />
          <Route path="/" element={<CurrentLocation />} />
          <Route path="/auth" element={<CurrentLocation />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RoleRouteBoundary", () => {
  beforeEach(() => {
    mocks.eq.mockClear();
    localStorage.removeItem("prodent_current_clinic");
    mocks.useAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
    });
    mocks.useUserRole.mockReturnValue({
      role: "patient",
      loading: false,
    });
    setRoles([], []);
  });

  it("renders an allowed child", async () => {
    setRoles(["assistant"], []);

    renderBoundary();

    expect(await screen.findByText("protected page")).toBeInTheDocument();
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("redirects denied access without mounting the child", async () => {
    const ProtectedPage = vi.fn(() => <div>must stay hidden</div>);

    renderBoundary(<ProtectedPage />);

    expect(await screen.findByTestId("location")).toHaveTextContent("/");
    expect(ProtectedPage).not.toHaveBeenCalled();
    expect(screen.queryByText("must stay hidden")).not.toBeInTheDocument();
  });

  it("does not start a denied lazy page import", async () => {
    const loadPage = vi.fn(async () => ({
      default: () => <div>lazy protected page</div>,
    }));
    const LazyProtectedPage = lazy(loadPage);

    renderBoundary(
      <Suspense fallback={<div>loading lazy page</div>}>
        <LazyProtectedPage />
      </Suspense>,
    );

    expect(await screen.findByTestId("location")).toHaveTextContent("/");
    expect(loadPage).not.toHaveBeenCalled();
  });

  it("keeps the child unmounted while authentication is loading", () => {
    mocks.useAuth.mockReturnValue({
      user: null,
      loading: true,
    });
    const ProtectedPage = vi.fn(() => <div>must stay hidden</div>);

    renderBoundary(<ProtectedPage />);

    expect(ProtectedPage).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Проверяем доступ",
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not import a doctor chunk for a signed-in wrong role", async () => {
    const loadPage = vi.fn(async () => ({
      default: () => <div>doctor page</div>,
    }));
    const LazyDoctorPage = lazy(loadPage);

    renderBoundary(<LazyDoctorPage />, "doctor");

    expect(await screen.findByTestId("location")).toHaveTextContent("/");
    expect(loadPage).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each(["assistant", "accountant"])(
    "does not mount medical content for %s",
    async (role) => {
      mocks.useUserRole.mockReturnValue({ role, loading: false });
      const ProtectedPage = vi.fn(() => <div>medical content</div>);

      renderBoundary(<ProtectedPage />, "medical");

      expect(await screen.findByTestId("location")).toHaveTextContent("/");
      expect(ProtectedPage).not.toHaveBeenCalled();
    },
  );

  it("filters membership access by active selected clinic", async () => {
    localStorage.setItem("prodent_current_clinic", "clinic-1");
    setRoles([], ["assistant"]);

    renderBoundary();

    expect(await screen.findByText("protected page")).toBeInTheDocument();
    expect(mocks.eq).toHaveBeenCalledWith(
      "clinic_members",
      "is_active",
      true,
    );
    expect(mocks.eq).toHaveBeenCalledWith(
      "clinic_members",
      "clinic_id",
      "clinic-1",
    );
    localStorage.removeItem("prodent_current_clinic");
  });

  it("does not import a clinic-admin chunk for a signed-in wrong role", async () => {
    setRoles(["doctor"], []);
    const loadPage = vi.fn(async () => ({
      default: () => <div>clinic admin page</div>,
    }));
    const LazyClinicAdminPage = lazy(loadPage);

    renderBoundary(<LazyClinicAdminPage />, "clinic-admin");

    expect(await screen.findByTestId("location")).toHaveTextContent("/");
    expect(loadPage).not.toHaveBeenCalled();
  });

  it("sends a guest to auth without importing a CRM-protected chunk", async () => {
    mocks.useAuth.mockReturnValue({
      user: null,
      loading: false,
    });
    const loadPage = vi.fn(async () => ({
      default: () => <div>doctor page</div>,
    }));
    const LazyDoctorPage = lazy(loadPage);

    renderBoundary(<LazyDoctorPage />, "crm");

    expect(await screen.findByTestId("location")).toHaveTextContent("/auth");
    expect(screen.getByTestId("location")).toHaveAttribute(
      "data-return-to",
      "/assistant/schedule",
    );
    expect(loadPage).not.toHaveBeenCalled();
  });
});
