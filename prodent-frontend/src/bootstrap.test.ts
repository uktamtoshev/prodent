import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { bootstrapApplication } from "./bootstrap";

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("application bootstrap", () => {
  it("starts loading the app and locale together and mounts only after both finish", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const root = document.getElementById("root")!;
    const preparation = deferred<void>();
    const application = deferred<{ name: string }>();
    const prepareApplication = vi.fn(() => preparation.promise);
    const loadApplication = vi.fn(() => application.promise);
    const mountApplication = vi.fn();

    const bootstrap = bootstrapApplication({
      root,
      prepareApplication,
      loadApplication,
      mountApplication,
      reload: vi.fn(),
    });

    expect(prepareApplication).toHaveBeenCalledOnce();
    expect(loadApplication).toHaveBeenCalledOnce();
    application.resolve({ name: "PRODENT" });
    await Promise.resolve();
    expect(mountApplication).not.toHaveBeenCalled();

    preparation.resolve();
    await bootstrap;
    expect(mountApplication).toHaveBeenCalledWith(root, { name: "PRODENT" });
  });

  it("renders an accessible retry screen when startup fails", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const root = document.getElementById("root")!;
    const reload = vi.fn();
    const reportError = vi.fn();

    await bootstrapApplication({
      root,
      prepareApplication: () => Promise.reject(new Error("locale chunk unavailable")),
      loadApplication: () => Promise.resolve({ name: "PRODENT" }),
      mountApplication: vi.fn(),
      reload,
      reportError,
    });

    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Не удалось загрузить PRODENT" })).toBeVisible();
    const retry = screen.getByRole("button", { name: "Повторить / Qayta urinish" });
    expect(retry).toBeVisible();
    expect(reportError).toHaveBeenCalledWith(
      "Could not start the application",
      expect.any(Error),
    );

    await userEvent.click(retry);
    expect(reload).toHaveBeenCalledOnce();
  });
});
