import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationBell } from "./NotificationBell";

const mocks = vi.hoisted(() => ({
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
  notifications: [
    {
      id: "notification-1",
      user_id: "user-1",
      type: "general",
      title: "Новый документ",
      message: "Документ готов к просмотру",
      read: false,
      metadata: null,
      link: null,
      created_at: "2026-07-28T06:00:00.000Z",
    },
  ],
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: mocks.notifications,
    unreadCount: mocks.notifications.filter((item) => !item.read).length,
    loading: false,
    markAsRead: mocks.markAsRead,
    markAllAsRead: mocks.markAllAsRead,
    deleteNotification: mocks.deleteNotification,
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "ru",
    t: (key: string) =>
      ({
        "notifsCenter.title": "Уведомления",
        "notifsCenter.readAll": "Прочитать все",
        "notifsCenter.markRead": "Отметить как прочитанное",
        "notifsCenter.delete": "Удалить",
        "notifsCenter.allNotifsBtn": "Все уведомления",
        "common.loading": "Загрузка",
      })[key] ?? key,
  }),
}));

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notifications[0] = {
      ...mocks.notifications[0],
      read: false,
      link: null,
    };
  });

  it("exposes labeled 44px notification actions", () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: "Уведомления" });
    expect(trigger).toHaveClass("h-11", "w-11");
    fireEvent.click(trigger);

    const markRead = screen.getByRole("button", {
      name: "Отметить как прочитанное",
    });
    const remove = screen.getByRole("button", { name: "Удалить" });

    expect(markRead).toHaveClass("h-11", "w-11");
    expect(remove).toHaveClass("h-11", "w-11");

    fireEvent.click(markRead);
    fireEvent.click(remove);

    expect(mocks.markAsRead).toHaveBeenCalledWith("notification-1");
    expect(mocks.deleteNotification).toHaveBeenCalledWith("notification-1");
  });

  it("marks the notification as read from its keyboard-accessible main action", () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Уведомления" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /Новый документ Документ готов к просмотру/i,
      }),
    );

    expect(mocks.markAsRead).toHaveBeenCalledWith("notification-1");
  });

  it("does not expose a no-op main button for a read notification without a link", () => {
    mocks.notifications[0] = {
      ...mocks.notifications[0],
      read: true,
      link: null,
    };

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Уведомления" }));

    expect(
      screen.queryByRole("button", {
        name: /Новый документ Документ готов к просмотру/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Новый документ")).toBeVisible();
  });
});
