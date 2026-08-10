import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DateInput } from "./DateInput";
import { MoneyInput } from "./MoneyInput";
import { PhoneInput } from "./PhoneInput";
import { TimeInput } from "./TimeInput";

describe("PhoneInput", () => {
  it("uses telephone semantics", () => {
    render(<PhoneInput aria-label="Телефон" />);
    expect(screen.getByRole("textbox", { name: "Телефон" })).toHaveAttribute("type", "tel");
    expect(screen.getByRole("textbox", { name: "Телефон" })).toHaveAttribute("autocomplete", "tel");
  });
});

describe("MoneyInput", () => {
  it("uses decimal keyboard and a decorative currency suffix", () => {
    render(<MoneyInput aria-label="Стоимость" currency="сум" />);
    expect(screen.getByRole("textbox", { name: "Стоимость" })).toHaveAttribute("inputmode", "decimal");
    expect(screen.getByText("сум")).toHaveAttribute("aria-hidden", "true");
  });

  it("removes non-numeric characters and bounds decimal precision", async () => {
    const onChange = vi.fn();
    render(<MoneyInput aria-label="Стоимость" onChange={onChange} decimalScale={2} maxIntegralDigits={3} />);
    const input = screen.getByRole("textbox", { name: "Стоимость" });
    await userEvent.type(input, "1234abc,567");
    expect(input).toHaveValue("123.56");
    expect(onChange).toHaveBeenCalled();
  });
});

describe("DateInput", () => {
  it("uses the native date contract", () => {
    render(<DateInput aria-label="Дата" />);
    expect(screen.getByLabelText("Дата")).toHaveAttribute("type", "date");
  });
});

describe("TimeInput", () => {
  it("uses the native time contract", () => {
    render(<TimeInput aria-label="Время" />);
    expect(screen.getByLabelText("Время")).toHaveAttribute("type", "time");
  });
});
