import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BalanceOperations } from "./BalanceOperations";

/**
 * Содержимое вкладки «Операции» и три её состояния.
 *
 * Ошибка №1: вкладка меняла только цвет кнопки, список под ней не появлялся.
 * Ошибка №2: упавший запрос выглядел как спокойное «Операций пока нет» —
 * то есть экран уверенно врал про деньги. Разница между «операций не было» и
 * «мы не смогли их загрузить» здесь принципиальная: в первом случае человек
 * спокоен, во втором должен нажать «Повторить».
 */
const LABELS = {
  date: "Дата",
  operation: "Операция",
  amount: "Сумма",
  balance: "Остаток",
  status: "Статус",
  empty: "Операций пока нет",
  error: "Не удалось загрузить операции",
  retry: "Повторить",
  loading: "Загружаем операции",
};

const ROWS = [
  {
    id: "t1",
    transaction_type: "topup",
    amount: 500000,
    balance_after: 1500000,
    payment_status: "completed",
    description: "Пополнение через Payme",
    created_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "t2",
    transaction_type: "payment",
    amount: 200000,
    balance_after: 1300000,
    payment_status: "pending",
    description: null,
    created_at: "2026-08-02T10:00:00Z",
  },
];

describe("BalanceOperations · содержимое", () => {
  it("показывает строки операций", () => {
    render(
      <BalanceOperations transactions={ROWS} language="ru" isLoaded labels={LABELS} />,
    );

    expect(screen.getByText("Пополнение через Payme")).toBeInTheDocument();
    // У второй операции описания нет — подставляется тип операции.
    expect(screen.getByText("payment")).toBeInTheDocument();
    expect(screen.getByText("2026-08-01")).toBeInTheDocument();
  });

  it("различает приход и расход знаком, а не только цветом", () => {
    render(
      <BalanceOperations transactions={ROWS} language="ru" isLoaded labels={LABELS} />,
    );

    // Знак обязателен: цвет сам по себе не читается людьми с нарушением
    // цветовосприятия (WCAG 1.4.1).
    expect(screen.getByText(/^\+/)).toBeInTheDocument();
    expect(screen.getByText(/^−/)).toBeInTheDocument();
  });
});

describe("BalanceOperations · ошибка загрузки", () => {
  it("сообщает об ошибке вместо пустого списка", () => {
    render(
      <BalanceOperations
        transactions={[]}
        language="ru"
        isError
        labels={LABELS}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Не удалось загрузить операции");
    // Самое важное: НЕ говорим, что операций нет.
    expect(screen.queryByText("Операций пока нет")).not.toBeInTheDocument();
  });

  it("даёт кнопку «Повторить» и вызывает перезагрузку", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(
      <BalanceOperations
        transactions={[]}
        language="ru"
        isError
        onRetry={onRetry}
        labels={LABELS}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Повторить" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("ошибка важнее данных: старые строки не выдаются за свежие", () => {
    render(
      <BalanceOperations
        transactions={ROWS}
        language="ru"
        isError
        labels={LABELS}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Пополнение через Payme")).not.toBeInTheDocument();
  });
});

describe("BalanceOperations · пустой список", () => {
  it("говорит «операций нет» ТОЛЬКО после успешного ответа", () => {
    render(
      <BalanceOperations transactions={[]} language="ru" isLoaded labels={LABELS} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Операций пока нет");
  });

  it("молчит, пока про успех ничего не известно", () => {
    const { container } = render(
      <BalanceOperations
        transactions={[]}
        language="ru"
        isLoaded={false}
        labels={LABELS}
      />,
    );

    // Ни «пусто», ни ошибки: утверждать нечего.
    expect(container).toBeEmptyDOMElement();
  });

  it("показывает состояние загрузки", () => {
    render(
      <BalanceOperations
        transactions={[]}
        language="ru"
        isLoading
        labels={LABELS}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Загружаем операции");
  });
});
