import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageComposer } from "./MessageComposer";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) =>
      key === "crmMessageComposer.sendBtn" ? "Отправить" : "Написать сообщение",
  }),
}));

vi.mock("./MessageAttachment", () => ({
  MessageAttachment: () => <button type="button">Прикрепить</button>,
  MessageFilePreview: () => null,
}));

describe("MessageComposer", () => {
  it("blocks an empty message and sends a typed message", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<MessageComposer onSend={onSend} />);

    const input = screen.getByRole("textbox", { name: "Написать сообщение" });
    const send = screen.getByRole("button", { name: "Отправить" });
    expect(send).toBeDisabled();

    fireEvent.change(input, { target: { value: "  Привет  " } });
    expect(send).toBeEnabled();
    fireEvent.click(send);

    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith({
        content: "Привет",
        fileUrl: undefined,
        fileType: undefined,
      })
    );
    await waitFor(() => expect(input).toHaveValue(""));
    expect(send).toBeDisabled();
  });

  it("keeps the draft when sending fails and respects loading", async () => {
    const onSend = vi.fn().mockRejectedValue(new Error("offline"));
    const { rerender } = render(<MessageComposer onSend={onSend} />);
    const input = screen.getByRole("textbox", { name: "Написать сообщение" });

    fireEvent.change(input, { target: { value: "Не потерять" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(input).toHaveValue("Не потерять"));

    rerender(<MessageComposer onSend={onSend} disabled />);
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "Отправить" })).toBeDisabled();
  });
});
