import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const KB = 1024;

export const BUILD_BUDGETS = Object.freeze({
  initial: 200 * KB,
  publicRoute: 100 * KB,
  cabinetRoute: 120 * KB,
  heavySpecialChunk: 250 * KB,
});

const PUBLIC_PAGE_SOURCES = new Set(
  [
    "Landing",
    "Search",
    "Clinics",
    "ClinicProfile",
    "Promotions",
    "Articles",
    "ArticleDetail",
    "About",
    "Auth",
    "AuthCallback",
    "PublicBooking",
    "TreatmentPlanPublic",
    "StaffInvitationDecision",
    "Pricing",
    "Terms",
    "Privacy",
    "Contacts",
    "NotFound",
  ].map((page) => `src/pages/${page}.tsx`),
);
PUBLIC_PAGE_SOURCES.add("src/pages/doctor/DoctorPublicProfile.tsx");

const HEAVY_SPECIAL_PATTERN =
  /node_modules\/(?:three|@react-three|leaflet|mapbox-gl|jspdf|html2canvas|recharts|react-image-crop)|(?:3D|STLViewer|OrbitControls|Leaflet|MapPicker|MapDialog|Chart|Cropper|PDF)/i;

function formatKb(bytes) {
  return `${(bytes / KB).toFixed(1)} KB`;
}

function budgetLabel(bytes) {
  return `${bytes / KB} KB`;
}

function collectStaticGraph(manifest, entryKey) {
  const graph = new Set();
  const pending = [entryKey];

  while (pending.length > 0) {
    const key = pending.pop();
    if (!key || graph.has(key)) continue;
    graph.add(key);

    for (const importedKey of manifest[key]?.imports ?? []) {
      pending.push(importedKey);
    }
  }

  return graph;
}

function gzipBytesForGraph(manifest, graph, gzipSizeByFile) {
  const files = new Set();
  let gzipBytes = 0;

  for (const key of graph) {
    const file = manifest[key]?.file;
    if (!file?.endsWith(".js") || files.has(file)) continue;

    const size = gzipSizeByFile.get(file);
    if (!Number.isFinite(size)) {
      throw new Error(`Missing gzip size for JavaScript asset ${file}`);
    }

    files.add(file);
    gzipBytes += size;
  }

  return { gzipBytes, files: [...files].sort() };
}

function routeMetric(manifest, source, gzipSizeByFile) {
  const file = manifest[source]?.file;
  const gzipBytes = file ? gzipSizeByFile.get(file) : undefined;
  if (!file?.endsWith(".js") || !Number.isFinite(gzipBytes)) {
    throw new Error(`Missing gzip size for route JavaScript asset ${file ?? source}`);
  }
  return { source, gzipBytes, files: [file] };
}

function isHeavySpecialChunk(key, chunk) {
  return HEAVY_SPECIAL_PATTERN.test(
    [key, chunk.src, chunk.name, chunk.file].filter(Boolean).join(" "),
  );
}

export function auditBuildManifest({ manifest, gzipSizeByFile }) {
  const entryKeys = Object.entries(manifest)
    .filter(([, chunk]) => chunk.isEntry === true)
    .map(([key]) => key);

  if (entryKeys.length !== 1) {
    throw new Error(
      `Expected exactly one production entry, found ${entryKeys.length}`,
    );
  }

  const initialGraph = collectStaticGraph(manifest, entryKeys[0]);
  const initial = {
    source: entryKeys[0],
    ...gzipBytesForGraph(manifest, initialGraph, gzipSizeByFile),
  };
  const publicRoutes = [];
  const cabinetRoutes = [];
  const heavySpecialChunks = [];
  const violations = [];

  for (const [source, chunk] of Object.entries(manifest)) {
    if (
      chunk.isDynamicEntry === true &&
      source.startsWith("src/pages/") &&
      /\.(?:ts|tsx)$/.test(source)
    ) {
      const metric = routeMetric(
        manifest,
        source,
        gzipSizeByFile,
      );
      const isPublic = PUBLIC_PAGE_SOURCES.has(source);
      const collection = isPublic ? publicRoutes : cabinetRoutes;
      const budget = isPublic
        ? BUILD_BUDGETS.publicRoute
        : BUILD_BUDGETS.cabinetRoute;
      const label = isPublic ? "Public route" : "Cabinet route";

      collection.push(metric);
      if (metric.gzipBytes > budget) {
        violations.push(
          `${label} ${source} is ${formatKb(metric.gzipBytes)} gzip; budget is ${budgetLabel(budget)}.`,
        );
      }
    }

    if (chunk.file?.endsWith(".js") && isHeavySpecialChunk(source, chunk)) {
      const metric = {
        source,
        file: chunk.file,
        gzipBytes: gzipSizeByFile.get(chunk.file),
        inInitialGraph: initialGraph.has(source),
      };

      if (!Number.isFinite(metric.gzipBytes)) {
        throw new Error(`Missing gzip size for JavaScript asset ${chunk.file}`);
      }
      heavySpecialChunks.push(metric);

      if (metric.gzipBytes > BUILD_BUDGETS.heavySpecialChunk) {
        violations.push(
          `Special chunk ${source} is ${formatKb(metric.gzipBytes)} gzip; budget is ${budgetLabel(BUILD_BUDGETS.heavySpecialChunk)}.`,
        );
      }
      if (metric.inInitialGraph) {
        violations.push(
          `Special chunk ${source} is present in the initial graph; it must load only on demand.`,
        );
      }
    }
  }

  if (initial.gzipBytes > BUILD_BUDGETS.initial) {
    violations.unshift(
      `Initial JavaScript is ${formatKb(initial.gzipBytes)} gzip; budget is ${budgetLabel(BUILD_BUDGETS.initial)}.`,
    );
  }

  publicRoutes.sort((a, b) => a.source.localeCompare(b.source));
  cabinetRoutes.sort((a, b) => a.source.localeCompare(b.source));
  heavySpecialChunks.sort((a, b) => a.source.localeCompare(b.source));

  return {
    initial,
    publicRoutes,
    cabinetRoutes,
    heavySpecialChunks,
    violations,
  };
}

async function loadGzipSizes(manifest, distRoot) {
  const files = new Set(
    Object.values(manifest)
      .map((chunk) => chunk.file)
      .filter((file) => file?.endsWith(".js")),
  );
  const sizes = new Map();

  await Promise.all(
    [...files].map(async (file) => {
      const content = await readFile(path.join(distRoot, file));
      sizes.set(file, gzipSync(content).byteLength);
    }),
  );

  return sizes;
}

async function main() {
  const projectRoot = process.cwd();
  const distRoot = path.join(projectRoot, "dist");
  const manifest = JSON.parse(
    await readFile(path.join(distRoot, ".vite", "manifest.json"), "utf8"),
  );
  const result = auditBuildManifest({
    manifest,
    gzipSizeByFile: await loadGzipSizes(manifest, distRoot),
  });

  if (result.violations.length > 0) {
    throw new Error(
      `Build budget check failed:\n- ${result.violations.join("\n- ")}`,
    );
  }

  process.stdout.write(
    [
      `Build budget check passed: initial ${formatKb(result.initial.gzipBytes)}`,
      `${result.publicRoutes.length} public routes <= ${budgetLabel(BUILD_BUDGETS.publicRoute)}`,
      `${result.cabinetRoutes.length} cabinet routes <= ${budgetLabel(BUILD_BUDGETS.cabinetRoute)}`,
      `${result.heavySpecialChunks.length} on-demand special chunks <= ${budgetLabel(BUILD_BUDGETS.heavySpecialChunk)}`,
    ].join("; ") + ".\n",
  );
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
