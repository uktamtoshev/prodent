import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listOrders: vi.fn(),
  listMessages: vi.fn(),
  sendMessage: vi.fn(),
  toast: vi.fn(),
  clearDraft: vi.fn(),
}));

vi.mock("@/lib/lab", () => ({
  lab: {
    listOrders: mocks.listOrders,
    listMessages: mocks.listMessages,
    sendMessage: mocks.sendMessage,
  },
}));

vi.mock("@/components/technician/TechnicianLayout", () => ({
  TechnicianLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/design", () => ({
  DesignBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "tech-1" } }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "ru" }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/lab-drafts", () => ({
  clearLabDraft: mocks.clearDraft,
  loadLabDraft: () => "",
  saveLabDraft: vi.fn(),
}));

vi.mock("@/lib/lab-workflow", () => ({
  getLabStatusLabel: () => "Новый",
}));

import TechnicianMessages from "./TechnicianMessages";

const orders = [
  {
    id: "order-a",
    order_number: 1,
    status: "new",
    patient_name: "Пациент A",
    work_type: "Коронка",
  },
  {
    id: "order-b",
    order_number: 2,
    status: "new",
    patient_name: "Пациент B",
    work_type: "Мост",
  },
];

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("TechnicianMessages", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listOrders.mockResolvedValue(orders);
  });

  it("does not restore the draft or allow a duplicate when send succeeds but refresh fails", async () => {
    mocks.listMessages
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("refresh failed"));
    mocks.sendMessage.mockResolvedValue(undefined);
    render(<TechnicianMessages />);

    fireEvent.click(await screen.findByText("Пациент A"));
    const input = await screen.findByRole("textbox");
    fireEvent.change(input, { target: { value: "Готово" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    await screen.findByText(/Сообщение отправлено, но переписка не обновилась/);
    expect(input).toHaveValue("");
    expect(screen.getByText("Готово")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отправить" })).toBeDisabled();
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
    expect(mocks.clearDraft).toHaveBeenCalledWith("message:order-a", "tech-1");
  });

  it("ignores a late response from the previously selected order", async () => {
    const first = deferred<unknown[]>();
    const second = deferred<unknown[]>();
    mocks.listMessages
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render(<TechnicianMessages />);

    fireEvent.click(await screen.findByText("Пациент A"));
    fireEvent.click(screen.getByText("Пациент B"));

    await act(async () => {
      second.resolve([
        {
          id: "message-b",
          order_id: "order-b",
          sender_user_id: "clinic-1",
          sender_role: "clinic",
          body: "Ответ B",
          created_at: "2026-07-28T10:00:00Z",
        },
      ]);
    });
    expect(await screen.findByText("Ответ B")).toBeInTheDocument();

    await act(async () => {
      first.resolve([
        {
          id: "message-a",
          order_id: "order-a",
          sender_user_id: "clinic-1",
          sender_role: "clinic",
          body: "Запоздалый A",
          created_at: "2026-07-28T09:00:00Z",
        },
      ]);
    });
    await waitFor(() => expect(screen.queryByText("Запоздалый A")).not.toBeInTheDocument());
    expect(screen.getByText("Ответ B")).toBeInTheDocument();
  });
});
