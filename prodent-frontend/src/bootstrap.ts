export interface BootstrapDependencies<TApplication> {
  root: HTMLElement;
  prepareApplication: () => Promise<unknown>;
  loadApplication: () => Promise<TApplication>;
  mountApplication: (root: HTMLElement, application: TApplication) => void;
  reload: () => void;
  reportError?: (message: string, error: unknown) => void;
}

export function renderBootstrapError(root: HTMLElement, reload: () => void): void {
  const document = root.ownerDocument;
  const main = document.createElement("main");
  const title = document.createElement("h1");
  const message = document.createElement("p");
  const retry = document.createElement("button");

  main.setAttribute("role", "alert");
  main.setAttribute("aria-live", "assertive");
  main.tabIndex = -1;
  main.style.cssText =
    "min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a";

  title.textContent = "Не удалось загрузить PRODENT";
  title.style.cssText = "margin:0;font-size:clamp(24px,4vw,36px);line-height:1.2";

  message.textContent =
    "Проверьте интернет и попробуйте ещё раз. Internetni tekshiring va qayta urinib ko‘ring.";
  message.style.cssText = "max-width:560px;margin:0;color:#475569;font-size:16px;line-height:1.5";

  retry.type = "button";
  retry.textContent = "Повторить / Qayta urinish";
  retry.style.cssText =
    "min-height:44px;padding:10px 20px;border:0;border-radius:10px;background:#0f766e;color:#fff;font:inherit;font-weight:600;cursor:pointer";
  retry.addEventListener("click", reload);

  main.append(title, message, retry);
  root.replaceChildren(main);
  main.focus();
}

export async function bootstrapApplication<TApplication>({
  root,
  prepareApplication,
  loadApplication,
  mountApplication,
  reload,
  reportError = console.error,
}: BootstrapDependencies<TApplication>): Promise<void> {
  try {
    const [, application] = await Promise.all([prepareApplication(), loadApplication()]);
    mountApplication(root, application);
  } catch (error) {
    reportError("Could not start the application", error);
    renderBootstrapError(root, reload);
  }
}
