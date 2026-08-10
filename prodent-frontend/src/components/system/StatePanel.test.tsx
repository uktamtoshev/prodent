import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState, ErrorState } from "./StatePanel";

describe("StatePanel presets", () => {
  it("announces errors and lets the user retry", () => {
    const onRetry = vi.fn();

    render(
      <ErrorState
        title="Не удалось загрузить данные"
        description="Попробуйте ещё раз"
        actionLabel="Повторить"
        onAction={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Не удалось загрузить данные");
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("uses a polite status for an empty result", () => {
    render(<EmptyState title="Ничего не найдено" headingLevel={3} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Ничего не найдено");
  });
});
