import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageMeta } from "./PageMeta";

afterEach(() => {
  cleanup();
});

describe("PageMeta", () => {
  it("restores every changed head value after the route unmounts", () => {
    document.title = "Default title";
    document.head.innerHTML += `
      <meta name="description" content="Default description" />
      <meta property="og:title" content="Default OG title" />
      <link rel="canonical" href="https://prodent.uz/" />
    `;

    const view = render(
      <PageMeta
        title="Search title"
        description="Search description"
        canonical="https://prodent.uz/search"
        robots="noindex,follow"
      />,
    );

    expect(document.title).toBe("Search title");
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      "Search description",
    );
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(
      "Search title",
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://prodent.uz/search",
    );
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe(
      "https://prodent.uz/search",
    );
    expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute("content")).toBe(
      "Search title",
    );
    expect(document.querySelector('meta[name="twitter:description"]')?.getAttribute("content")).toBe(
      "Search description",
    );
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(
      "noindex,follow",
    );

    view.unmount();

    expect(document.title).toBe("Default title");
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      "Default description",
    );
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(
      "Default OG title",
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://prodent.uz/",
    );
    expect(document.querySelectorAll('meta[property="og:description"]')).toHaveLength(0);
    expect(document.querySelectorAll('meta[property="og:type"]')).toHaveLength(0);
    expect(document.querySelectorAll('meta[property="og:url"]')).toHaveLength(0);
    expect(document.querySelectorAll('meta[name="twitter:title"]')).toHaveLength(0);
    expect(document.querySelectorAll('meta[name="twitter:description"]')).toHaveLength(0);
    expect(document.querySelectorAll('meta[name="robots"]')).toHaveLength(0);
  });
});
