import { type ReactNode, useEffect, useRef, useState } from "react";

interface LazyRenderProps {
  children: ReactNode;
  fallback: ReactNode;
  minHeight?: number;
  rootMargin?: string;
}

export function LazyRender({
  children,
  fallback,
  minHeight,
  rootMargin = "240px",
}: LazyRenderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (shouldRender) return;

    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, shouldRender]);

  return (
    <div ref={containerRef} style={minHeight ? { minHeight } : undefined}>
      {shouldRender ? children : fallback}
    </div>
  );
}
