import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";
import { Stepper } from "./Stepper";
import { Timeline } from "./Timeline";

describe("ConfirmDialog", () => {
  it("labels the dialog and confirms the action", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Удалить запись?" description="Вернуть её не получится." onConfirm={onConfirm} />);
    expect(screen.getByRole("alertdialog", { name: "Удалить запись?" })).toHaveAccessibleDescription("Вернуть её не получится.");
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe("Timeline", () => {
  it("renders ordered events with an accessible name", () => {
    render(<Timeline label="История приёма" items={[{ id: "1", title: "Создано", meta: "10:00" }]} />);
    expect(screen.getByRole("list", { name: "История приёма" })).toHaveTextContent("Создано");
  });
});

describe("Stepper", () => {
  it("marks the current step and completed steps", () => {
    render(<Stepper currentStep={2} steps={[{ id: "a", label: "Данные" }, { id: "b", label: "Проверка" }]} />);
    expect(screen.getByText("Проверка").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByLabelText("Завершено")).toBeInTheDocument();
  });
});
