import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROLE_ROUTE_MODULES = [
  "assistant-routes.tsx",
  "accountant-routes.tsx",
  "manager-routes.tsx",
  "clinic-admin-routes.tsx",
  "crm-routes.tsx",
  "doctor-routes.tsx",
];

const projectRoot = process.cwd();
const manifestPath = path.join(projectRoot, "dist", ".vite", "manifest.json");

function fail(message) {
  throw new Error(`Role bundle check failed: ${message}`);
}

async function collectRolePageSources() {
  const pagesByRouteModule = new Map();
  const lazyPagePattern = /import\(["']\.\.\/pages\/([^"']+)["']\)/g;

  for (const routeModule of ROLE_ROUTE_MODULES) {
    const routeModulePath = path.join(
      projectRoot,
      "src",
      "routes",
      routeModule,
    );
    const source = await readFile(routeModulePath, "utf8");
    const pageSources = new Set();

    if (/from\s+["']\.\.\/pages\//.test(source)) {
      fail(`${routeModule} contains a static role page import`);
    }

    for (const match of source.matchAll(lazyPagePattern)) {
      const modulePath = match[1].replace(/\.(?:ts|tsx)$/, "");
      pageSources.add(`src/pages/${modulePath}.tsx`);
    }

    if (pageSources.size === 0) {
      fail(`${routeModule} does not declare any lazy role pages`);
    }

    pagesByRouteModule.set(routeModule, pageSources);
  }

  return pagesByRouteModule;
}

function collectStaticImports(manifest, entryKey) {
  const visited = new Set();
  const pending = [entryKey];

  while (pending.length > 0) {
    const key = pending.pop();
    if (!key || visited.has(key)) continue;
    visited.add(key);

    for (const importedKey of manifest[key]?.imports ?? []) {
      pending.push(importedKey);
    }
  }

  return visited;
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const mainEntry = Object.entries(manifest).find(
    ([, chunk]) => chunk.isEntry === true,
  );

  if (!mainEntry) {
    fail("production manifest has no main entry");
  }

  const [mainEntryKey, mainChunk] = mainEntry;
  const staticMainGraph = collectStaticImports(manifest, mainEntryKey);
  const pagesByRouteModule = await collectRolePageSources();
  const checkedPages = new Set();
  const pageByChunkFile = new Map();

  for (const [routeModule, pageSources] of pagesByRouteModule) {
    for (const pageSource of pageSources) {
      const chunk = manifest[pageSource];

      if (!chunk) {
        fail(`${pageSource} from ${routeModule} is missing from the manifest`);
      }
      if (chunk.isDynamicEntry !== true) {
        fail(`${pageSource} is not a dynamic entry`);
      }
      if (chunk.file === mainChunk.file || staticMainGraph.has(pageSource)) {
        fail(`${pageSource} was included in the main entry graph`);
      }
      const existingPage = pageByChunkFile.get(chunk.file);
      if (existingPage && existingPage !== pageSource) {
        fail(
          `${pageSource} and ${existingPage} share ${chunk.file} instead of separate lazy chunks`,
        );
      }

      checkedPages.add(pageSource);
      pageByChunkFile.set(chunk.file, pageSource);
    }
  }

  process.stdout.write(
    `Role bundle check passed: ${checkedPages.size} lazy pages across ${ROLE_ROUTE_MODULES.length} route groups; main chunk ${mainChunk.file} is clean.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
