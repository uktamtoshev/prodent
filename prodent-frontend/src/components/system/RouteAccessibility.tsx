import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const MODAL_SELECTOR =
  'dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';

function hasOpenModal() {
  return Array.from(document.querySelectorAll<HTMLElement>(MODAL_SELECTOR)).some(
    (element) => {
      if (element.hidden || element.getAttribute("aria-hidden") === "true") {
        return false;
      }

      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    },
  );
}

function getRouteLabel(main: HTMLElement | null, pathname: string) {
  const heading = main?.querySelector("h1")?.textContent?.trim();
  if (heading) return heading;

  const title = document.title.trim();
  return title || pathname;
}

export function RouteAccessibility() {
  const location = useLocation();
  const previousPathname = useRef(location.pathname);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const pathnameChanged = previousPathname.current !== location.pathname;
    previousPathname.current = location.pathname;

    if (!pathnameChanged) return;

    setAnnouncement("");
    const frame = window.requestAnimationFrame(() => {
      const main = document.getElementById("main-content");
      setAnnouncement(getRouteLabel(main, location.pathname));

      if (!location.hash && !hasOpenModal()) {
        main?.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, location.pathname]);

  return (
    <div
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {announcement}
    </div>
  );
}
