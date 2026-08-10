import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const PUBLIC_ROUTE_META = [
  {
    file: "home.html",
    title: "PRODENT — поиск стоматологов и клиник",
    description:
      "Проверенные стоматологи и клиники Узбекистана: профили, услуги, отзывы и онлайн-запись.",
    canonical: "https://prodent.uz/",
  },
  {
    file: "search.html",
    title: "Найти стоматолога — PRODENT",
    description:
      "Поиск проверенных стоматологов по специальности, городу, рейтингу и стоимости приёма.",
    canonical: "https://prodent.uz/search",
  },
  {
    file: "clinics.html",
    title: "Стоматологические клиники — PRODENT",
    description:
      "Каталог проверенных стоматологических клиник: врачи, услуги, отзывы и график работы.",
    canonical: "https://prodent.uz/clinics",
  },
  {
    file: "promotions.html",
    title: "Акции стоматологий — PRODENT",
    description:
      "Актуальные предложения стоматологов и клиник с переходом к подходящему врачу и записи.",
    canonical: "https://prodent.uz/promotions",
  },
];

function escapeAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function replaceMeta(html, selector, content) {
  const escaped = escapeAttribute(content);
  const expression = new RegExp(
    `(<meta\\s+${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+content=")[^"]*(".*?>)`,
    "i",
  );
  return html.replace(expression, `$1${escaped}$2`);
}

export function renderPublicRouteHtml(template, meta) {
  const title = escapeAttribute(meta.title);
  const canonical = escapeAttribute(meta.canonical);
  let html = template.replace(/<title>.*?<\/title>/is, `<title>${title}</title>`);
  html = replaceMeta(html, 'name="description"', meta.description);
  html = replaceMeta(html, 'property="og:title"', meta.title);
  html = replaceMeta(html, 'property="og:description"', meta.description);
  html = replaceMeta(html, 'property="og:url"', meta.canonical);
  html = replaceMeta(html, 'name="twitter:title"', meta.title);
  html = replaceMeta(html, 'name="twitter:description"', meta.description);
  html = html.replace(
    /(<link\s+rel="alternate"\s+hreflang="(?:ru|uz|x-default)"\s+href=")[^"]*("\s*\/>)/gi,
    `$1${canonical}$2`,
  );
  html = html.replace(
    "</head>",
    `    <link rel="canonical" href="${canonical}" />\n  </head>`,
  );
  return html;
}

export async function writePublicRouteHtml(distDir) {
  const template = await readFile(path.join(distDir, "index.html"), "utf8");
  const outputDir = path.join(distDir, "prerender");
  await mkdir(outputDir, { recursive: true });
  await Promise.all(
    PUBLIC_ROUTE_META.map((meta) =>
      writeFile(
        path.join(outputDir, meta.file),
        renderPublicRouteHtml(template, meta),
        "utf8",
      ),
    ),
  );
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  await writePublicRouteHtml(path.join(projectRoot, "dist"));
}
