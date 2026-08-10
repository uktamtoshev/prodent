import assert from "node:assert/strict";
import test from "node:test";
import {
  BUILD_BUDGETS,
  auditBuildManifest,
} from "./check-build-budgets.mjs";

const kb = (value) => value * 1024;

function manifestFixture() {
  return {
    "index.html": {
      file: "assets/main.js",
      isEntry: true,
      imports: ["_shared.js"],
    },
    "_shared.js": {
      file: "assets/shared.js",
    },
    "src/pages/Landing.tsx": {
      file: "assets/landing.js",
      isDynamicEntry: true,
      imports: ["_shared.js", "_public-dependency.js"],
    },
    "_public-dependency.js": {
      file: "assets/public-dependency.js",
    },
    "src/pages/crm/Dashboard.tsx": {
      file: "assets/dashboard.js",
      isDynamicEntry: true,
      imports: ["_shared.js", "_cabinet-dependency.js"],
    },
    "_cabinet-dependency.js": {
      file: "assets/cabinet-dependency.js",
    },
    "node_modules/jspdf/dist/jspdf.es.min.js": {
      file: "assets/jspdf.js",
      src: "node_modules/jspdf/dist/jspdf.es.min.js",
      name: "jspdf",
      isDynamicEntry: true,
    },
  };
}

function passingSizes() {
  return new Map([
    ["assets/main.js", kb(90)],
    ["assets/shared.js", kb(90)],
    ["assets/landing.js", kb(40)],
    ["assets/public-dependency.js", kb(50)],
    ["assets/dashboard.js", kb(55)],
    ["assets/cabinet-dependency.js", kb(55)],
    ["assets/jspdf.js", kb(200)],
  ]);
}

test("uses the production budgets from PRODENT-MASTER-PLAN", () => {
  assert.deepEqual(BUILD_BUDGETS, {
    initial: kb(200),
    publicRoute: kb(100),
    cabinetRoute: kb(120),
    heavySpecialChunk: kb(250),
  });
});

test("accepts initial, public, cabinet and on-demand special chunks within budget", () => {
  const result = auditBuildManifest({
    manifest: manifestFixture(),
    gzipSizeByFile: passingSizes(),
  });

  assert.deepEqual(result.violations, []);
  assert.equal(result.initial.gzipBytes, kb(180));
  assert.equal(result.publicRoutes[0].gzipBytes, kb(40));
  assert.equal(result.cabinetRoutes[0].gzipBytes, kb(55));
  assert.equal(result.heavySpecialChunks[0].gzipBytes, kb(200));
});

test("reports an initial graph over 200 KB gzip", () => {
  const sizes = passingSizes();
  sizes.set("assets/main.js", kb(111));

  const result = auditBuildManifest({
    manifest: manifestFixture(),
    gzipSizeByFile: sizes,
  });

  assert.match(result.violations.join("\n"), /initial.*201\.0 KB.*200 KB/i);
});

test("applies route budgets to route chunks without double-counting shared imports", () => {
  const sizes = passingSizes();
  sizes.set("assets/landing.js", kb(101));
  sizes.set("assets/dashboard.js", kb(121));

  const result = auditBuildManifest({
    manifest: manifestFixture(),
    gzipSizeByFile: sizes,
  });
  const report = result.violations.join("\n");

  assert.match(report, /public route.*Landing.*101\.0 KB.*100 KB/i);
  assert.match(report, /cabinet route.*Dashboard.*121\.0 KB.*120 KB/i);
});

test("reports oversized or eagerly loaded heavy special chunks", () => {
  const fixture = manifestFixture();
  fixture["index.html"].imports.push(
    "node_modules/jspdf/dist/jspdf.es.min.js",
  );
  const sizes = passingSizes();
  sizes.set("assets/jspdf.js", kb(251));

  const result = auditBuildManifest({
    manifest: fixture,
    gzipSizeByFile: sizes,
  });
  const report = result.violations.join("\n");

  assert.match(report, /special chunk.*jspdf.*251\.0 KB.*250 KB/i);
  assert.match(report, /special chunk.*jspdf.*initial graph/i);
});
