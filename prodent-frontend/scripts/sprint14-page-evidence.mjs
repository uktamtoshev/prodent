import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { auditBuildManifest } from "./check-build-budgets.mjs";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(frontendRoot, "..");
const evidenceRoot = path.join(workspaceRoot, "ops", "sprint-14", "evidence");
const registryPath = path.join(evidenceRoot, "current-route-registry.json");
const outputs = {
  json: path.join(evidenceRoot, "page-dod-evidence-matrix.json"),
  csv: path.join(evidenceRoot, "page-dod-evidence-matrix.csv"),
  markdown: path.join(evidenceRoot, "page-dod-evidence-summary.md"),
};
const sources = {
  acceptance: path.join(evidenceRoot, "playwright-acceptance.json"),
  closureUi: path.join(evidenceRoot, "closure-ui.stdout.log"),
  accessibility: path.join(evidenceRoot, "playwright-accessibility.json"),
  performance: path.join(evidenceRoot, "playwright-performance.json"),
  fullDay: path.join(frontendRoot, "test-results", "sprint14-full-day", "results.json"),
  localeAndImage: path.join(evidenceRoot, "vitest-language-image.json"),
  rollback: path.join(evidenceRoot, "release-gate-20260727-202759.json"),
};
const sourceTests = {
  acceptance: path.join(frontendRoot, "tests", "sprint14-acceptance", "role-module-contracts.spec.ts"),
  localization: path.join(frontendRoot, "tests", "product-e2e", "sprint12-localization-visual.spec.ts"),
  accessibility: [
    path.join(frontendRoot, "tests", "product-e2e", "sprint11-accessibility-gate.spec.ts"),
    path.join(frontendRoot, "tests", "product-e2e", "public-accessibility.spec.ts"),
  ],
  performance: path.join(frontendRoot, "tests", "performance", "sprint13-web-vitals.spec.ts"),
};

const relative = (file) => path.relative(workspaceRoot, file).replaceAll("\\", "/");
const sha256 = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const readJson = (file) =>
  fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""))
    : null;

function extractConstRoutes(file, constant) {
  const text = fs.readFileSync(file, "utf8");
  const match = text.match(new RegExp(`const\\s+${constant}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`));
  if (!match) throw new Error(`${relative(file)}: ${constant} not found`);
  return [...match[1].matchAll(/["'](\/[^"']*)["']/g)].map((item) => item[1]);
}

function extractScenarioRoutes(file) {
  return [...fs.readFileSync(file, "utf8").matchAll(/\broute:\s*"([^"]+)"/g)].map((item) => item[1]);
}

function flattenPlaywright(report) {
  const tests = [];
  const walk = (suites, inheritedFile = null) => {
    for (const suite of suites ?? []) {
      const file = suite.file ?? inheritedFile ?? suite.title;
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          const results = test.results ?? [];
          tests.push({
            file: String(file).replaceAll("\\", "/"),
            title: spec.title,
            project: test.projectName,
            passed: results.length > 0 && results.every((result) => result.status === "passed"),
            skipped: results.length > 0 && results.every((result) => result.status === "skipped"),
          });
        }
      }
      walk(suite.suites, file);
    }
  };
  walk(report?.suites);
  return tests;
}

function playwrightGate(file, expectedProjects, expectedMinimum) {
  const report = readJson(file);
  if (!report) return { passed: false, reason: "artifact_missing", projects: [], testCount: 0 };
  const tests = flattenPlaywright(report);
  const passedTests = tests.filter((test) => test.passed);
  const projects = [...new Set(passedTests.map((test) => test.project))].sort();
  const missingProjects = expectedProjects.filter((project) => !projects.includes(project));
  const failed = tests.filter((test) => !test.passed && !test.skipped);
  const passed =
    passedTests.length >= expectedMinimum &&
    missingProjects.length === 0 &&
    failed.length === 0 &&
    report.stats?.unexpected === 0 &&
    report.stats?.flaky === 0;
  return {
    passed,
    reason: failed.length || report.stats?.unexpected ? "failed_tests"
      : passedTests.length < expectedMinimum ? "too_few_tests"
        : missingProjects.length ? "missing_projects"
          : report.stats?.flaky ? "flaky_tests" : "passed",
    projects,
    missingProjects,
    testCount: passedTests.length,
    skipped: tests.filter((test) => test.skipped).length,
    failed: failed.length,
    failedTests: failed.slice(0, 20).map((test) => ({
      project: test.project,
      file: test.file,
      title: test.title,
    })),
    flaky: report.stats?.flaky ?? null,
    sha256: sha256(file),
  };
}

function playwrightLineReport(file, fileFragment) {
  if (!fs.existsSync(file)) return [];
  const clean = fs.readFileSync(file, "utf8").replace(/\u001b\[[0-9;]*m/g, "");
  const tests = [];
  for (const line of clean.split(/\r?\n/)) {
    const match = line.match(/^\s*(ok|x|-)\s+\d+\s+\[([^\]]+)]\s+›\s+(.+)$/);
    if (!match || !match[3].includes(fileFragment)) continue;
    const status = match[1] === "ok" ? "passed" : match[1] === "x" ? "failed" : "skipped";
    tests.push({
      status,
      project: match[2],
      title: match[3].replace(/\s+\([0-9.]+[a-z]+\)\s*$/, ""),
    });
  }
  return tests;
}

function playwrightLineGate(file, fileFragment, expectedProjects, expectedPassed) {
  if (!fs.existsSync(file)) return { passed: false, reason: "artifact_missing", projects: [], testCount: 0 };
  const tests = playwrightLineReport(file, fileFragment);
  const passedTests = tests.filter((test) => test.status === "passed");
  const failedTests = tests.filter((test) => test.status === "failed");
  const projects = [...new Set(passedTests.map((test) => test.project))].sort();
  const missingProjects = expectedProjects.filter((project) => !projects.includes(project));
  const passed =
    passedTests.length >= expectedPassed &&
    failedTests.length === 0 &&
    missingProjects.length === 0;
  return {
    passed,
    reason: failedTests.length ? "failed_tests"
      : passedTests.length < expectedPassed ? "too_few_tests"
        : missingProjects.length ? "missing_projects" : "passed",
    projects,
    missingProjects,
    testCount: passedTests.length,
    skipped: tests.filter((test) => test.status === "skipped").length,
    failed: failedTests.length,
    failedTests: failedTests.map((test) => ({ project: test.project, title: test.title })),
    sha256: sha256(file),
  };
}

function vitestGate(file) {
  const report = readJson(file);
  if (!report) return { passed: false, reason: "artifact_missing" };
  const passed = report.success === true && report.numFailedTests === 0 && report.numFailedTestSuites === 0;
  return { passed, reason: passed ? "passed" : "failed_tests", tests: report.numTotalTests, sha256: sha256(file) };
}

function buildGate() {
  const manifestPath = path.join(frontendRoot, "dist", ".vite", "manifest.json");
  const manifest = readJson(manifestPath);
  if (!manifest) return { passed: false, reason: "manifest_missing", covered: new Set() };
  const gzipSizeByFile = new Map();
  for (const chunk of Object.values(manifest)) {
    if (!chunk.file?.endsWith(".js") || gzipSizeByFile.has(chunk.file)) continue;
    const asset = path.join(frontendRoot, "dist", chunk.file);
    if (!fs.existsSync(asset)) return { passed: false, reason: `asset_missing:${chunk.file}`, covered: new Set() };
    gzipSizeByFile.set(chunk.file, gzipSync(fs.readFileSync(asset)).byteLength);
  }
  const audit = auditBuildManifest({ manifest, gzipSizeByFile });
  return {
    passed: audit.violations.length === 0,
    reason: audit.violations.length ? "budget_violations" : "passed",
    violations: audit.violations,
    covered: new Set([...audit.publicRoutes.map((item) => item.source), ...audit.cabinetRoutes.map((item) => item.source)]),
    initialGzipBytes: audit.initial.gzipBytes,
    publicChunks: audit.publicRoutes.length,
    cabinetChunks: audit.cabinetRoutes.length,
    specialChunks: audit.heavySpecialChunks.length,
    manifestSha256: sha256(manifestPath),
  };
}

function rollbackGate() {
  const report = readJson(sources.rollback);
  const passed =
    report?.status === "PASS" &&
    report?.stage === "complete" &&
    report?.dataIntegrityPassed === true &&
    report?.injectedFailure?.status >= 500 &&
    report?.postRollback?.errors === 0;
  return { passed, reason: passed ? "passed" : report ? "failed_conditions" : "artifact_missing", sha256: report ? sha256(sources.rollback) : null };
}

const registry = readJson(registryPath);
if (!registry) throw new Error("run npm run sprint14:routes first");
const activeRoutes = registry.routes.filter((route) => route.activePage);
const acceptanceRoutes = new Set(extractScenarioRoutes(sourceTests.acceptance));
const localizationRoutes = new Set(extractConstRoutes(sourceTests.localization, "PUBLIC_ROUTES"));
const accessibilityRoutes = new Set(extractConstRoutes(sourceTests.accessibility[0], "REPRESENTATIVE_ROUTES"));
const fourViewportRoutes = new Set(extractConstRoutes(sourceTests.accessibility[0], "REPRESENTATIVE_ROUTES"));
const webVitalRoutes = new Set(
  [...fs.readFileSync(sourceTests.performance, "utf8").matchAll(/\bpath:\s*"([^"]+)"/g)].map((item) => item[1]),
);
const hasCurrentAccessibilityJson =
  fs.existsSync(sources.accessibility) &&
  fs.statSync(sources.accessibility).size > 0;
const gates = {
  acceptance: playwrightGate(sources.acceptance, ["android-chromium", "desktop-chromium", "iphone-webkit"], acceptanceRoutes.size * 3),
  localization: playwrightLineGate(sources.closureUi, "sprint12-localization-visual.spec.ts", ["desktop-chromium", "mobile-chromium"], 34),
  accessibility: hasCurrentAccessibilityJson
    ? playwrightGate(sources.accessibility, ["desktop-chromium"], 26)
    : playwrightLineGate(sources.closureUi, "sprint11-accessibility-gate.spec.ts", ["desktop-chromium"], 26),
  performance: playwrightGate(sources.performance, ["desktop-chromium", "mobile-chromium"], 4),
  fullDay: playwrightGate(sources.fullDay, [], 30),
  localeAndImage: vitestGate(sources.localeAndImage),
  build: buildGate(),
  rollback: rollbackGate(),
};
const evidenceRef = (key) => relative(sources[key]);
const criterion = (status, evidence = [], note = null) => ({ status, evidence, ...(note ? { note } : {}) });
const accessibilityTests = hasCurrentAccessibilityJson
  ? flattenPlaywright(readJson(sources.accessibility)).map((test) => ({
      ...test,
      status: test.passed ? "passed" : test.skipped ? "skipped" : "failed",
    }))
  : playwrightLineReport(sources.closureUi, "sprint11-accessibility-gate.spec.ts");
const accessibilityEvidence = hasCurrentAccessibilityJson ? evidenceRef("accessibility") : evidenceRef("closureUi");
const titleMatchesRoute = (title, route) =>
  title.startsWith(`${route} `) || title.includes(`› ${route} `);
const routeAccessibilityPassed = (route) => {
  const related = accessibilityTests.filter((test) => titleMatchesRoute(test.title, route));
  return related.length > 0 &&
    related.some((test) => test.status === "passed") &&
    related.every((test) => test.status !== "failed");
};
const routeFourViewportsPassed = (route) =>
  [360, 768, 1024, 1440].every((width) =>
    accessibilityTests.some((test) =>
      test.status === "passed" &&
      titleMatchesRoute(test.title, route) &&
      test.title.includes(`at ${width}px `),
    ),
  );

const rows = activeRoutes.map((route) => {
  const componentManifestKey = route.componentSource?.replace(/^prodent-frontend\//, "");
  const inBuildBudget = gates.build.passed && gates.build.covered.has(componentManifestKey);
  const acceptanceCovered = gates.acceptance.passed && acceptanceRoutes.has(route.path);
  const languageLayoutCovered = gates.localization.passed && localizationRoutes.has(route.path);
  const accessibilityCovered = accessibilityRoutes.has(route.path) && routeAccessibilityPassed(route.path);
  const fourViewportsCovered = fourViewportRoutes.has(route.path) && routeFourViewportsPassed(route.path);
  const webVitalsCovered = gates.performance.passed && webVitalRoutes.has(route.path);
  const criteria = Object.fromEntries(
    registry.criteria.map((name) => [name, criterion("not_proven", [], "No current route-specific evidence")]),
  );
  if (acceptanceCovered) {
    criteria["quality.component_or_integration_tests"] = criterion(
      "pass", [evidenceRef("acceptance")],
      "Deterministic browser integration smoke on desktop Chromium, Android emulation and iPhone WebKit",
    );
  }
  if (fourViewportsCovered) criteria["accessibility.viewports_360_768_1024_1440"] = criterion("pass", [accessibilityEvidence]);
  if (accessibilityCovered) {
    criteria["accessibility.wcag_2_2_aa"] = criterion(
      "pass", [accessibilityEvidence],
      "Automated axe coverage; manual assistive-technology review is separate",
    );
  }
  if (languageLayoutCovered) {
    criteria["accessibility.long_translations_fit"] = criterion(
      "pass", [evidenceRef("closureUi")],
      "All six locales checked for clipping, overflow and raw keys",
    );
  }
  if (inBuildBudget) criteria["performance.javascript_budget"] = criterion("pass", ["prodent-frontend/dist/.vite/manifest.json"]);
  if (gates.build.passed) {
    criteria["performance.heavy_libraries_lazy"] = criterion(
      "pass", ["prodent-frontend/dist/.vite/manifest.json"],
      "Heavy special chunks are absent from the initial graph",
    );
  }
  if (webVitalsCovered) {
    criteria["performance.lcp_inp_cls"] = criterion(
      "pass", [evidenceRef("performance")],
      "Chromium lab measurement, not real-user field data",
    );
  }
  if (route.path === "/" && gates.localeAndImage.passed) {
    criteria["performance.images_optimized"] = criterion(
      "pass", [evidenceRef("localeAndImage")],
      "Landing LCP image AVIF/WebP and size budget",
    );
  }
  if (gates.rollback.passed) {
    criteria["quality.rollback_available"] = criterion(
      "pass", [evidenceRef("rollback")],
      "Isolated localhost canary/rollback drill with database fingerprints",
    );
  }
  const passCount = Object.values(criteria).filter((item) => item.status === "pass").length;
  return {
    path: route.path,
    area: route.area,
    expectedRoleInferred: route.expectedRole,
    component: route.component,
    componentSource: route.componentSource,
    signals: {
      routeRegistered: true,
      sixLanguageKeyParity: gates.localeAndImage.passed,
      browserIntegration: acceptanceCovered,
      desktopChromium: acceptanceCovered,
      androidEmulation: acceptanceCovered,
      iphoneWebkitEmulation: acceptanceCovered,
      sixLanguageLayout: languageLayoutCovered,
      automatedWcag: accessibilityCovered,
      fourViewports: fourViewportsCovered,
      javascriptBudget: inBuildBudget,
      webVitalsChromium: webVitalsCovered,
      localhostRollback: gates.rollback.passed,
    },
    dod: { status: passCount === registry.criteria.length ? "proven" : "not_proven", passed: passCount, required: registry.criteria.length },
    criteria,
  };
});

const byCriterion = Object.fromEntries(
  registry.criteria.map((name) => [name, { passed: rows.filter((route) => route.criteria[name].status === "pass").length, required: rows.length }]),
);
const bySignal = Object.fromEntries(
  Object.keys(rows[0]?.signals ?? {}).map((name) => [name, rows.filter((route) => route.signals[name]).length]),
);
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: rows.every((row) => row.dod.status === "proven") ? "GO" : "NO-GO",
  routes: rows.length,
  dodProven: rows.filter((row) => row.dod.status === "proven").length,
  gates: Object.fromEntries(Object.entries(gates).map(([name, gate]) => {
    const { covered, ...serializable } = gate;
    return [name, serializable];
  })),
  bySignal,
  byCriterion,
  rows,
};

const csvHeader = ["path", "area", "expected_role_inferred", "component", "dod_passed", "dod_required", ...Object.keys(rows[0]?.signals ?? {}), ...registry.criteria];
const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const csvRows = rows.map((row) => [
  row.path, row.area, row.expectedRoleInferred, row.component, row.dod.passed, row.dod.required,
  ...Object.values(row.signals), ...registry.criteria.map((name) => row.criteria[name].status),
].map(csvEscape).join(","));
const signalRows = Object.entries(bySignal).map(([name, count]) => `| \`${name}\` | ${count}/${rows.length} |`).join("\n");
const criterionRows = Object.entries(byCriterion).map(([name, count]) => `| \`${name}\` | ${count.passed}/${count.required} |`).join("\n");
const gateRows = Object.entries(result.gates).map(([name, gate]) => `| \`${name}\` | ${gate.passed ? "PASS" : "NOT PROVEN"} | \`${gate.reason}\` |`).join("\n");
const markdown = `# Sprint 14 — доказательства DoD по активным страницам

## Итог

- Активных страниц: **${rows.length}**.
- Полный DoD: **${result.dodProven}/${rows.length}**.
- Статус: **${result.status}**.

Автоматизация не заменяет ручную проверку. Критерий отмечается \`pass\` только при наличии текущего машинного артефакта. Частичный smoke не считается главным бизнес-сценарием.

## Машинные gate

| Gate | Статус | Причина |
|---|---|---|
${gateRows}

## Покрытие сигналами

| Сигнал | Страницы |
|---|---:|
${signalRows}

## 28 критериев DoD

| Критерий | Доказано |
|---|---:|
${criterionRows}

Подробная постраничная матрица находится в \`page-dod-evidence-matrix.csv\` и \`page-dod-evidence-matrix.json\`.
`;
const normalizedJson = (value) => {
  const parsed = JSON.parse(value);
  parsed.generatedAt = "<ignored>";
  return JSON.stringify(parsed);
};
const mode = process.argv.includes("--check") ? "check" : "write";
const artifacts = {
  json: `${JSON.stringify(result, null, 2)}\n`,
  csv: `${csvHeader.map(csvEscape).join(",")}\n${csvRows.join("\n")}\n`,
  markdown,
};
if (mode === "write") {
  fs.mkdirSync(evidenceRoot, { recursive: true });
  for (const [kind, file] of Object.entries(outputs)) fs.writeFileSync(file, artifacts[kind]);
} else {
  for (const [kind, file] of Object.entries(outputs)) {
    if (!fs.existsSync(file)) throw new Error(`missing ${relative(file)}`);
    const actual = fs.readFileSync(file, "utf8");
    const equal = kind === "json" ? normalizedJson(actual) === normalizedJson(artifacts[kind]) : actual === artifacts[kind];
    if (!equal) throw new Error(`stale ${relative(file)}`);
  }
}
console.log(`Sprint 14 page evidence: ${result.dodProven}/${rows.length} full DoD, ${result.status}`);
