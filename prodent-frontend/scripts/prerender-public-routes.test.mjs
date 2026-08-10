import assert from "node:assert/strict";
import test from "node:test";
import { renderPublicRouteHtml } from "./prerender-public-routes.mjs";

const template = `<!doctype html><html><head>
<title>Default</title>
<meta name="description" content="Default description" />
<meta property="og:title" content="Default OG" />
<meta property="og:description" content="Default OG description" />
<meta property="og:url" content="https://prodent.uz/" />
<meta name="twitter:title" content="Default Twitter" />
<meta name="twitter:description" content="Default Twitter description" />
<link rel="alternate" hreflang="ru" href="https://prodent.uz/" />
<link rel="alternate" hreflang="uz" href="https://prodent.uz/" />
<link rel="alternate" hreflang="x-default" href="https://prodent.uz/" />
</head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>`;

test("creates a route-specific SEO shell without changing application assets", () => {
  const html = renderPublicRouteHtml(template, {
    title: 'Врачи "PRODENT"',
    description: "Поиск врачей & клиник",
    canonical: "https://prodent.uz/search",
  });

  assert.match(html, /<title>Врачи &quot;PRODENT&quot;<\/title>/);
  assert.match(html, /content="Поиск врачей &amp; клиник"/);
  assert.match(html, /property="og:url" content="https:\/\/prodent\.uz\/search"/);
  assert.match(html, /rel="canonical" href="https:\/\/prodent\.uz\/search"/);
  assert.equal(
    (html.match(/rel="alternate" hreflang="(?:ru|uz|x-default)" href="https:\/\/prodent\.uz\/search"/g) || []).length,
    3,
  );
  assert.match(html, /<script src="\/assets\/app\.js"><\/script>/);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
});
