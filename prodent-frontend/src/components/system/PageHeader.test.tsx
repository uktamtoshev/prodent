import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders its content and actions with a single page heading", () => {
    render(
      <PageHeader
        eyebrow="Клиника"
        title="Пациенты"
        description="Список пациентов клиники"
        actions={<Button>Добавить</Button>}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Пациенты" })).toBeInTheDocument();
    expect(screen.getByText("Клиника")).toBeInTheDocument();
    expect(screen.getByText("Список пациентов клиники")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Добавить" })).toBeInTheDocument();
  });
});
