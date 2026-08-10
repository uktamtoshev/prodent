import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageSwitcher } from "./LanguageSwitcher";
import type { Language } from "@/contexts/LanguageContext";

const { prefetchLocaleMock, setLanguageMock } = vi.hoisted(() => ({
  prefetchLocaleMock: vi.fn(),
  setLanguageMock: vi.fn(),
}));

vi.mock("@/i18n/locale-loader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/locale-loader")>();

  return {
    ...actual,
    prefetchLocale: (language: Language) => prefetchLocaleMock(language),
  };
});

vi.mock("@/contexts/LanguageContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/contexts/LanguageContext")>();

  return {
    ...actual,
    useLanguage: () => ({
      language: "ru" as Language,
      setLanguage: setLanguageMock,
      t: (key: string) => key,
    }),
  };
});

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    prefetchLocaleMock.mockClear();
    setLanguageMock.mockClear();
  });

  it("does not prefetch every locale when the menu opens", async () => {
    render(<LanguageSwitcher />);

    await userEvent.click(screen.getByRole("button"));

    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(prefetchLocaleMock).not.toHaveBeenCalled();
  });

  it("prefetches only the focused or hovered locale", async () => {
    render(<LanguageSwitcher />);

    await userEvent.click(screen.getByRole("button"));
    const uzbekLanguage = await screen.findByText("Oʻzbekcha");

    await userEvent.hover(uzbekLanguage);

    expect(prefetchLocaleMock).toHaveBeenCalledWith("uz");
    expect(new Set(prefetchLocaleMock.mock.calls.map(([lang]) => lang))).toEqual(
      new Set(["uz"]),
    );
  });
});
