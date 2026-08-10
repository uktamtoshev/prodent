import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Calendar } from "./calendar";

describe("Calendar touch and keyboard behavior", () => {
  it("keeps every date and month navigation control at least 44px", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <Calendar
        mode="single"
        month={new Date(2026, 6, 1)}
        onSelect={onSelect}
      />,
    );

    const navigationButtons = screen.getAllByRole("button");
    expect(navigationButtons).toHaveLength(2);
    for (const button of navigationButtons) {
      expect(button).toHaveClass("!h-11", "!w-11");
    }

    const days = screen.getAllByRole("gridcell");
    expect(days.length).toBeGreaterThan(20);
    for (const day of days) {
      expect(day).toHaveClass("!h-11", "!w-11");
    }

    const julyFifteenth = screen.getByRole("gridcell", { name: "15" });
    await user.click(julyFifteenth);
    expect(onSelect).toHaveBeenCalledWith(
      new Date(2026, 6, 15),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });
});
