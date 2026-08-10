import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoleCabinetShell } from "./RoleCabinetShell";

describe("RoleCabinetShell", () => {
  it("shows an accessible loading state without mounting cabinet content", () => {
    render(
      <RoleCabinetShell sidebar={<nav>Меню</nav>} isLoading>
        Содержимое
      </RoleCabinetShell>,
    );

    expect(screen.getByRole("status", { name: "Загрузка кабинета" })).toBeInTheDocument();
    expect(screen.queryByText("Содержимое")).not.toBeInTheDocument();
  });

  it("renders role navigation and the page in a common frame", () => {
    render(
      <RoleCabinetShell
        sidebar={<nav aria-label="Кабинет">Меню</nav>}
        mainClassName="transition-all duration-200"
      >
        <h1>Расписание</h1>
      </RoleCabinetShell>,
    );

    expect(screen.getByRole("navigation", { name: "Кабинет" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Расписание");
    expect(screen.getByRole("main")).toHaveClass(
      "min-w-0",
      "max-w-full",
      "pt-16",
      "lg:pt-0",
      "lg:pl-64",
      "transition-all",
      "duration-200",
    );
    expect(screen.getByRole("main").parentElement).toHaveClass(
      "w-full",
      "max-w-full",
      "overflow-x-clip",
    );
  });
});
