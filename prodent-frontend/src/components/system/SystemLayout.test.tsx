import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "./AppShell";
import { FilterBar } from "./FilterBar";
import { MobileActionBar } from "./MobileActionBar";
import { SkeletonComposition } from "./SkeletonComposition";
import { StatCard } from "./StatCard";

describe("FilterBar", () => {
  it("changes search and clears filters", async () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(<FilterBar search={{ value: "", onChange }} onClear={onClear} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Поиск" }), "Иван");
    await userEvent.click(screen.getByRole("button", { name: "Очистить" }));
    expect(onChange).toHaveBeenLastCalledWith("н");
    expect(onClear).toHaveBeenCalledOnce();
  });
});

describe("StatCard", () => {
  it("exposes the label and value as text", () => {
    render(<StatCard label="Пациенты" value="42" trend={{ label: "+2", tone: "positive" }} />);
    expect(screen.getByText("Пациенты")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});

describe("AppShell", () => {
  it("provides landmarks and a skip link without access rules", () => {
    render(<AppShell header="Шапка" sidebar="Меню">Содержимое</AppShell>);
    const main = screen.getByRole("main");
    expect(main).toHaveTextContent("Содержимое");
    expect(screen.getByRole("link", { name: "Перейти к содержимому" })).toHaveAttribute("href", `#${main.id}`);
    expect(screen.getByRole("complementary")).toHaveTextContent("Меню");
  });

  it("generates unique ids for multiple shells and filters", () => {
    render(
      <>
        <AppShell>Первый</AppShell>
        <AppShell>Второй</AppShell>
        <FilterBar search={{ value: "", onChange: vi.fn() }} />
        <FilterBar search={{ value: "", onChange: vi.fn() }} />
      </>,
    );
    const ids = [
      ...screen.getAllByRole("main").map((element) => element.id),
      ...screen.getAllByRole("searchbox").map((element) => element.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("MobileActionBar", () => {
  it("is an accessible toolbar", () => {
    const { container } = render(<MobileActionBar><button>Сохранить</button></MobileActionBar>);
    expect(screen.getByRole("toolbar", { name: "Действия" })).toContainElement(screen.getByRole("button"));
    expect(container.querySelector("[data-mobile-action-spacer]")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("SkeletonComposition", () => {
  it("announces loading and renders requested composition", () => {
    const { container } = render(<SkeletonComposition rows={2} cards={1} label="Пациенты загружаются" />);
    expect(screen.getByRole("status", { name: "Пациенты загружаются" })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-testid='skeleton']")).toHaveLength(0);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(5);
  });
});
