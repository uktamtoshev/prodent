import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteRole: vi.fn(),
  deleteRoleById: vi.fn(),
  from: vi.fn(),
  refetch: vi.fn(),
  toast: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/contexts/AdminContext", () => ({
  useAdmin: () => ({ isSuperAdmin: true }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      "admin.noName": "Без имени",
      "adminUsers.addRoleError": "Ошибка добавления роли",
      "adminUsers.cardTitle": "Пользователи и роли",
      "adminUsers.cannotRemoveLastSuper": "Нельзя удалить последнего супер-администратора",
      "adminUsers.cannotRemoveRole": "Невозможно удалить роль",
      "adminUsers.noRoles": "Нет ролей",
      "adminUsers.removeRole": "Удалить роль",
      "adminUsers.roleAdmin": "Администратор",
      "adminUsers.roleSuperAdmin": "Супер Админ",
      "adminUsers.searchPlaceholder": "Поиск пользователей",
      "adminUsers.selectRole": "Выберите роль",
      "adminUsers.subtitle": "Назначение ролей",
      "adminUsers.title": "Управление пользователями",
      "adminUsers.totalUsers": "Всего пользователей: ",
      "common.add": "Добавить",
      "common.loading": "Загрузка",
    }[key] ?? key),
  }),
}));

vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/admin/UserDetailDialog", () => ({
  UserDetailDialog: () => null,
}));

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const adminSources = {
  users: readSource("src/pages/admin/Users.tsx"),
  verification: readSource("src/pages/admin/Verification.tsx"),
};

describe("Sprint 1 admin UI contracts", () => {
  it("keeps visible text readable and uses theme-aware colors", () => {
    const legacyPalette =
      /\b(?:bg|text|border|ring)-(?:gray|slate|zinc|neutral|red|rose|green|emerald|blue|cyan|teal|amber|yellow|orange)-\d{2,3}\b/;

    for (const source of Object.values(adminSources)) {
      expect(source).not.toMatch(/text-\[(?:8|9|10|11)(?:\.\d+)?px\]/);
      expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(source).not.toMatch(legacyPalette);
    }
  });

  it("keeps filters and icon actions at least 44px with accessible names and state", () => {
    expect(adminSources.verification).toContain("inline-flex min-h-11 items-center");
    expect(adminSources.verification).toContain("aria-pressed={active}");
    expect(adminSources.verification).toContain('aria-label="Поиск заявок врачей"');
    expect(adminSources.verification).toContain('aria-label="Поиск заявок поставщиков"');

    expect(adminSources.users).toContain("inline-flex h-11 w-11 items-center");
    expect(adminSources.users).toContain("min-h-11 min-w-11");
    expect(adminSources.users).toContain("aria-label={t('common.back')}");
    expect(adminSources.users).toContain("aria-label={t('common.next')}");
    expect(adminSources.users).toContain("aria-busy={processingUsers.has(user.id)}");
  });

  it("provides responsive card content and explicit loading, error, and empty states", () => {
    expect(adminSources.verification).toContain(
      "grid h-auto min-h-12 w-full grid-cols-1 sm:grid-cols-3",
    );
    expect(adminSources.verification).toContain(
      "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
    );
    expect(adminSources.verification).toContain('role="status" aria-label="Загрузка заявок врачей"');
    expect(adminSources.verification).toContain('<Card role="alert">');
    expect(adminSources.verification.match(/<Card role="status">/g)).toHaveLength(4);

    expect(adminSources.users).toContain(
      "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
    );
    expect(adminSources.users).toContain('role="alert"');
    expect(adminSources.users).toContain('role="status"');
    expect(adminSources.users).toContain("isLoading");
    expect(adminSources.users).toContain("isError");
  });

  it("debounces the user search before sending a counted server query", () => {
    expect(adminSources.users).toContain("const SEARCH_DEBOUNCE_MS = 350");
    expect(adminSources.users).toContain(
      "queryKey: ['admin-users', page, debouncedSearch]",
    );
    expect(adminSources.users).toContain(
      "const normalizedSearch = safeSearchTerm(debouncedSearch)",
    );
  });
});

describe("admin user role safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.deleteRoleById.mockResolvedValue({ error: null });
    mocks.deleteRole.mockReturnValue({ eq: mocks.deleteRoleById });
    mocks.from.mockReturnValue({
      delete: mocks.deleteRole,
    });
    mocks.useQuery.mockReturnValue({
      data: {
        users: [{
          id: "admin-1",
          full_name: "Главный администратор",
          email: "admin@example.test",
          phone: null,
          created_at: null,
          roles: [{
            id: "role-1",
            role: "super_admin",
            created_at: null,
          }],
        }],
        total: 1,
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    });
  });

  it("fully disables super-admin removal on this screen", async () => {
    const { default: Users } = await import("./Users");

    render(createElement(Users));
    const removeSuperAdmin = screen.getByRole("button", {
      name: "Удалить роль: Супер Админ",
    });

    expect(removeSuperAdmin).toBeDisabled();
    expect(removeSuperAdmin).toHaveAttribute(
      "title",
      "Нельзя удалить последнего супер-администратора",
    );
    expect(screen.getByText(/Невозможно удалить роль: Супер Админ/)).toBeVisible();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocks.deleteRole).not.toHaveBeenCalled();
  });

  it("keeps confirmation and deletion for an ordinary role", async () => {
    const user = userEvent.setup();
    mocks.useQuery.mockReturnValue({
      data: {
        users: [{
          id: "admin-1",
          full_name: "Главный администратор",
          email: "admin@example.test",
          phone: null,
          created_at: null,
          roles: [{
            id: "role-1",
            role: "admin",
            created_at: null,
          }],
        }],
        total: 1,
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    });
    const { default: Users } = await import("./Users");

    render(createElement(Users));
    await user.click(screen.getByRole("button", {
      name: "Удалить роль: Администратор",
    }));
    const dialog = screen.getByRole("alertdialog");
    expect(mocks.deleteRole).not.toHaveBeenCalled();
    await user.click(
      within(dialog).getByRole("button", { name: "Удалить роль" }),
    );

    await waitFor(() => {
      expect(mocks.deleteRole).toHaveBeenCalledOnce();
      expect(mocks.deleteRoleById).toHaveBeenCalledWith("id", "role-1");
      expect(mocks.refetch).toHaveBeenCalledOnce();
    });
  });
});
