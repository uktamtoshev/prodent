import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const frontendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = path.resolve(frontendRoot, "..");
const evidenceDir = path.join(workspaceRoot, "ops", "sprint-14", "evidence");
const attestationPath = path.join(
  workspaceRoot,
  "ops",
  "sprint-14",
  "route-dod-evidence.json",
);

const outputPaths = {
  json: path.join(evidenceDir, "current-route-registry.json"),
  csv: path.join(evidenceDir, "current-route-registry.csv"),
  markdown: path.join(evidenceDir, "route-dod-summary.md"),
};

const DOD_CRITERIA = [
  "functions.visible_actions_work",
  "functions.no_stubs_or_fake_results",
  "functions.server_and_database_state_correct",
  "functions.repeat_action_is_idempotent",
  "functions.all_affected_roles_checked",
  "functions.important_changes_audited",
  "ux.shared_components_and_tokens",
  "ux.loading_empty_error_forbidden_success_states",
  "ux.primary_action_is_clear",
  "ux.filters_and_navigation_keep_context",
  "ux.dangerous_actions_require_confirmation",
  "ux.text_is_clear",
  "accessibility.viewports_360_768_1024_1440",
  "accessibility.mouse_keyboard_touch",
  "accessibility.wcag_2_2_aa",
  "accessibility.lighthouse_at_least_95",
  "accessibility.long_translations_fit",
  "performance.javascript_budget",
  "performance.lcp_inp_cls",
  "performance.large_data_paginated_or_virtualized",
  "performance.images_optimized",
  "performance.heavy_libraries_lazy",
  "quality.component_or_integration_tests",
  "quality.main_flow_has_e2e",
  "quality.errors_visible_in_monitoring",
  "quality.analytics_documented",
  "quality.rollback_available",
  "quality.documentation_updated",
];

const routeSources = [
  path.join(frontendRoot, "src", "App.tsx"),
  ...fs
    .readdirSync(path.join(frontendRoot, "src", "routes"))
    .filter((name) => name.endsWith("-routes.tsx"))
    .sort()
    .map((name) => path.join(frontendRoot, "src", "routes", name)),
];

const routeHelperFiles = [
  "market-routes.ts",
  "jobs-routes.ts",
  "sklad-routes.ts",
  "lab-routes.ts",
].map((name) => path.join(frontendRoot, "src", "lib", name));

const parse = (file) =>
  ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

const relativeSource = (file) =>
  path.relative(workspaceRoot, file).replaceAll("\\", "/");

const lineOf = (sourceFile, node) =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

const literalText = (node) => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return undefined;
};

const unwrapExpression = (node) => {
  let current = node;
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current))
  ) {
    current = current.expression;
  }
  return current;
};

function buildHelperResolvers() {
  const resolvers = new Map();

  for (const file of routeHelperFiles) {
    const sourceFile = parse(file);
    const stringConstants = new Map();

    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        const value = literalText(declaration.initializer);
        if (value !== undefined) stringConstants.set(declaration.name.text, value);
      }
    }

    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (
          !ts.isIdentifier(declaration.name) ||
          !declaration.name.text.endsWith("_ROUTES") ||
          !declaration.initializer ||
          !ts.isObjectLiteralExpression(declaration.initializer)
        ) {
          continue;
        }

        const namespace = declaration.name.text;
        const baseName = namespace.replace(/_ROUTES$/, "_BASE");
        const base = stringConstants.get(baseName);
        if (base === undefined) {
          throw new Error(`${relativeSource(file)}: missing ${baseName}`);
        }

        for (const property of declaration.initializer.properties) {
          if (
            !ts.isPropertyAssignment(property) ||
            !ts.isIdentifier(property.name) ||
            !ts.isArrowFunction(property.initializer)
          ) {
            continue;
          }
          const method = property.name.text;
          const arrow = property.initializer;
          const parameterNames = arrow.parameters.map((parameter) =>
            ts.isIdentifier(parameter.name) ? parameter.name.text : "",
          );
          if (!ts.isCallExpression(arrow.body)) {
            throw new Error(
              `${relativeSource(file)}:${lineOf(sourceFile, arrow)} unsupported route helper`,
            );
          }
          const suffixNode = arrow.body.arguments[0];

          resolvers.set(`${namespace}.${method}`, (callArguments) => {
            if (!suffixNode) return base || "/";
            const values = new Map(
              parameterNames.map((name, index) => [
                name,
                literalText(callArguments[index]) ?? `:${name}`,
              ]),
            );

            let suffix;
            if (ts.isStringLiteral(suffixNode)) {
              suffix = suffixNode.text;
            } else if (ts.isTemplateExpression(suffixNode)) {
              suffix = suffixNode.head.text;
              for (const span of suffixNode.templateSpans) {
                if (!ts.isIdentifier(span.expression)) {
                  throw new Error(`${namespace}.${method}: unsupported template expression`);
                }
                suffix += values.get(span.expression.text) ?? `:${span.expression.text}`;
                suffix += span.literal.text;
              }
            } else {
              throw new Error(`${namespace}.${method}: unsupported route suffix`);
            }

            const clean = suffix.replace(/^\/+/, "");
            return clean ? `${base}/${clean}` : base || "/";
          });
        }
      }
    }
  }

  return resolvers;
}

const helperResolvers = buildHelperResolvers();

function inferArea(routePath) {
  if (routePath === "*") return "catch-all";
  if (routePath === "/") return "public";
  return routePath.split("/")[1] || "public";
}

function inferRole(routePath) {
  const area = inferArea(routePath);
  const roleByArea = {
    admin: "admin",
    accountant: "accountant",
    assistant: "assistant",
    "clinic-admin": "clinic_admin",
    crm: "clinic_staff",
    doctor: "doctor",
    manager: "clinic_manager",
    patient: "patient",
    seller: "seller",
    technician: "technician",
    sklad: "clinic_staff_or_doctor",
    lab: "clinic_staff_or_doctor",
    jobs: "doctor_or_clinic",
    market: "public_or_buyer",
  };
  if (roleByArea[area]) return roleByArea[area];
  if (["profile", "appointments"].includes(area)) return "authenticated";
  if (area === "catch-all") return "any";
  return "public";
}

function collectRoutes() {
  const collected = [];

  for (const file of routeSources) {
    const sourceFile = parse(file);
    const componentSources = new Map();

    const resolveModule = (specifier) => {
      if (!specifier.startsWith(".")) return null;
      const candidate = path.resolve(path.dirname(file), specifier);
      for (const suffix of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
        const resolved = `${candidate}${suffix}`;
        if (fs.existsSync(resolved)) return relativeSource(resolved);
      }
      return null;
    };

    for (const statement of sourceFile.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.importClause
      ) {
        const resolved = resolveModule(statement.moduleSpecifier.text);
        if (!resolved) continue;
        if (statement.importClause.name) {
          componentSources.set(statement.importClause.name.text, resolved);
        }
        const bindings = statement.importClause.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            componentSources.set(element.name.text, resolved);
          }
        }
      }
    }

    const findDynamicImport = (node) => {
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        return node.arguments[0].text;
      }
      let found;
      ts.forEachChild(node, (child) => {
        found ??= findDynamicImport(child);
      });
      return found;
    };

    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        const specifier = findDynamicImport(declaration.initializer);
        const resolved = specifier ? resolveModule(specifier) : null;
        if (resolved) componentSources.set(declaration.name.text, resolved);
      }
    }

    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        const isContract = node.name.text.endsWith("RouteContract");
        const initializer = node.initializer ? unwrapExpression(node.initializer) : undefined;
        if (isContract && initializer && ts.isArrayLiteralExpression(initializer)) {
          for (const element of initializer.elements) {
            if (!ts.isObjectLiteralExpression(element)) continue;
            const pathProperty = element.properties.find(
              (property) =>
                ts.isPropertyAssignment(property) &&
                ts.isIdentifier(property.name) &&
                property.name.text === "path",
            );
            if (!pathProperty || !ts.isPropertyAssignment(pathProperty)) continue;
            const routePath = literalText(pathProperty.initializer);
            if (!routePath) {
              throw new Error(
                `${relativeSource(file)}:${lineOf(sourceFile, pathProperty)} unresolved contract path`,
              );
            }
            const redirect = element.properties.some(
              (property) =>
                ts.isPropertyAssignment(property) &&
                ts.isIdentifier(property.name) &&
                property.name.text === "redirect",
            );
            const pageProperty = element.properties.find(
              (property) =>
                ts.isPropertyAssignment(property) &&
                ts.isIdentifier(property.name) &&
                property.name.text === "page",
            );
            collected.push({
              path: routePath,
              source: relativeSource(file),
              line: lineOf(sourceFile, element),
              declaration: "contract",
              kind: redirect ? "redirect" : "page",
              component:
                pageProperty && ts.isPropertyAssignment(pageProperty)
                  ? literalText(pageProperty.initializer) ?? null
                  : null,
              componentSource:
                pageProperty &&
                ts.isPropertyAssignment(pageProperty) &&
                literalText(pageProperty.initializer)
                  ? componentSources.get(literalText(pageProperty.initializer)) ?? null
                  : null,
            });
          }
          return;
        }
      }

      if (
        ts.isJsxSelfClosingElement(node) &&
        ts.isIdentifier(node.tagName) &&
        node.tagName.text === "Route"
      ) {
        const pathAttribute = node.attributes.properties.find(
          (property) =>
            ts.isJsxAttribute(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === "path",
        );
        if (!pathAttribute || !ts.isJsxAttribute(pathAttribute)) {
          ts.forEachChild(node, visit);
          return;
        }

        let routePath;
        if (pathAttribute.initializer && ts.isStringLiteral(pathAttribute.initializer)) {
          routePath = pathAttribute.initializer.text;
        } else if (
          pathAttribute.initializer &&
          ts.isJsxExpression(pathAttribute.initializer) &&
          pathAttribute.initializer.expression
        ) {
          const expression = pathAttribute.initializer.expression;
          if (
            ts.isPropertyAccessExpression(expression) &&
            ts.isIdentifier(expression.expression) &&
            expression.expression.text === "route" &&
            expression.name.text === "path"
          ) {
            return;
          }
          if (
            ts.isCallExpression(expression) &&
            ts.isPropertyAccessExpression(expression.expression) &&
            ts.isIdentifier(expression.expression.expression)
          ) {
            const resolverName = `${expression.expression.expression.text}.${expression.expression.name.text}`;
            const resolver = helperResolvers.get(resolverName);
            if (resolver) routePath = resolver(expression.arguments);
          }
        }

        if (!routePath) {
          throw new Error(
            `${relativeSource(file)}:${lineOf(sourceFile, pathAttribute)} unresolved JSX route path`,
          );
        }
        const elementAttribute = node.attributes.properties.find(
          (property) =>
            ts.isJsxAttribute(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === "element",
        );
        const elementText = elementAttribute?.getText(sourceFile) ?? "";
        const isRedirect =
          elementText.includes("<Navigate") || /Redirect\b/.test(elementText);
        const componentMatch = elementText.match(/<([A-Z][A-Za-z0-9_]*)\b/);
        collected.push({
          path: routePath,
          source: relativeSource(file),
          line: lineOf(sourceFile, node),
          declaration: "jsx",
          kind: routePath === "*" ? "catch-all" : isRedirect ? "redirect" : "page",
          component: componentMatch?.[1] ?? null,
          componentSource: componentMatch
            ? componentSources.get(componentMatch[1]) ?? null
            : null,
        });
        return;
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  const duplicates = collected.filter(
    (route, index) => collected.findIndex((candidate) => candidate.path === route.path) !== index,
  );
  if (duplicates.length) {
    throw new Error(`duplicate route paths: ${[...new Set(duplicates.map((r) => r.path))].join(", ")}`);
  }

  return collected
    .map((route) => ({
      ...route,
      area: inferArea(route.path),
      expectedRole: inferRole(route.path),
      activePage: route.kind === "page",
    }))
    .sort((a, b) => a.path.localeCompare(b.path, "en"));
}

function loadAttestations() {
  const parsed = JSON.parse(fs.readFileSync(attestationPath, "utf8"));
  if (parsed.schemaVersion !== 1 || typeof parsed.routes !== "object" || !parsed.routes) {
    throw new Error(`${relativeSource(attestationPath)} has an invalid schema`);
  }
  return parsed.routes;
}

function applyDod(routes, attestations) {
  const routePaths = new Set(routes.map((route) => route.path));
  const stale = Object.keys(attestations).filter((routePath) => !routePaths.has(routePath));
  if (stale.length) {
    throw new Error(`DoD evidence refers to missing routes: ${stale.join(", ")}`);
  }

  return routes.map((route) => {
    if (!route.activePage) {
      return {
        ...route,
        dod: { status: "not_applicable", passed: 0, required: 0, missing: [] },
      };
    }

    const evidence = attestations[route.path] ?? {};
    const passed = DOD_CRITERIA.filter((criterion) => {
      const item = evidence[criterion];
      return item?.status === "pass" && Array.isArray(item.evidence) && item.evidence.length > 0;
    });
    const missing = DOD_CRITERIA.filter((criterion) => !passed.includes(criterion));
    return {
      ...route,
      dod: {
        status: missing.length === 0 ? "proven" : "not_proven",
        passed: passed.length,
        required: DOD_CRITERIA.length,
        missing,
      },
    };
  });
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function buildArtifacts(routes) {
  const active = routes.filter((route) => route.activePage);
  const proven = active.filter((route) => route.dod.status === "proven");
  const byArea = Object.entries(
    active.reduce((groups, route) => {
      groups[route.area] ??= { routes: 0, proven: 0 };
      groups[route.area].routes += 1;
      if (route.dod.status === "proven") groups[route.area].proven += 1;
      return groups;
    }, {}),
  ).sort(([left], [right]) => left.localeCompare(right, "en"));

  const registry = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sources: routeSources.map(relativeSource),
    definitionOfDoneSource: "ops/PRODENT-MASTER-PLAN.md#17-definition-of-done-для-каждой-страницы",
    summary: {
      declaredRoutes: routes.length,
      activePages: active.length,
      redirectRoutes: routes.filter((route) => route.kind === "redirect").length,
      catchAllRoutes: routes.filter((route) => route.kind === "catch-all").length,
      dodProven: proven.length,
      dodNotProven: active.length - proven.length,
      dodCoveragePercent: active.length
        ? Number(((proven.length / active.length) * 100).toFixed(2))
        : 0,
      releaseGate: proven.length === active.length ? "GO" : "NO-GO",
    },
    criteria: DOD_CRITERIA,
    routes,
  };

  const csvHeader = [
    "path",
    "area",
    "expected_role_inferred",
    "kind",
    "component",
    "component_source",
    "active_page",
    "source",
    "line",
    "declaration",
    "dod_status",
    "dod_passed",
    "dod_required",
  ];
  const csvRows = routes.map((route) =>
    [
      route.path,
      route.area,
      route.expectedRole,
      route.kind,
      route.component,
      route.componentSource,
      route.activePage,
      route.source,
      route.line,
      route.declaration,
      route.dod.status,
      route.dod.passed,
      route.dod.required,
    ]
      .map(csvEscape)
      .join(","),
  );

  const areaRows = byArea
    .map(
      ([area, counts]) =>
        `| \`${area}\` | ${counts.routes} | ${counts.proven} | ${counts.routes - counts.proven} |`,
    )
    .join("\n");
  const markdown = `# Sprint 14 — автоматический реестр маршрутов и DoD

Этот файл создан автоматически. Роль в реестре выведена из префикса маршрута и не является доказательством прав.

## Итог

- Объявлено маршрутов: **${registry.summary.declaredRoutes}**.
- Активных страниц: **${registry.summary.activePages}**.
- DoD доказан: **${registry.summary.dodProven}/${registry.summary.activePages}**.
- Release gate: **${registry.summary.releaseGate}**.

Страница получает статус \`proven\` только когда все ${DOD_CRITERIA.length} пунктов DoD имеют статус \`pass\` и хотя бы одну ссылку на доказательство в \`ops/sprint-14/route-dod-evidence.json\`.

| Область | Активных страниц | DoD доказан | Не доказан |
|---|---:|---:|---:|
${areaRows}

## Проверка

- \`npm run sprint14:routes\` — обновить реестр.
- \`npm run sprint14:routes:check\` — убедиться, что реестр не устарел.
- \`npm run sprint14:dod:gate\` — строгий выпускной барьер; сейчас обязан завершаться ошибкой, пока хотя бы одна активная страница не доказана полностью.
`;

  return {
    json: `${JSON.stringify(registry, null, 2)}\n`,
    csv: `${csvHeader.map(csvEscape).join(",")}\n${csvRows.join("\n")}\n`,
    markdown,
    releaseGate: registry.summary.releaseGate,
    summary: registry.summary,
  };
}

function normalizeGeneratedAt(json) {
  const parsed = JSON.parse(json);
  parsed.generatedAt = "<ignored-in-check>";
  return JSON.stringify(parsed, null, 2);
}

const mode = process.argv.includes("--check")
  ? "check"
  : process.argv.includes("--release-gate")
    ? "release-gate"
    : "write";
const routes = applyDod(collectRoutes(), loadAttestations());
const artifacts = buildArtifacts(routes);

if (mode === "write") {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(outputPaths.json, artifacts.json);
  fs.writeFileSync(outputPaths.csv, artifacts.csv);
  fs.writeFileSync(outputPaths.markdown, artifacts.markdown);
} else {
  for (const [kind, outputPath] of Object.entries(outputPaths)) {
    if (!fs.existsSync(outputPath)) {
      throw new Error(`missing generated artifact: ${relativeSource(outputPath)}`);
    }
    const actual = fs.readFileSync(outputPath, "utf8");
    const expected = artifacts[kind];
    const equal =
      kind === "json"
        ? normalizeGeneratedAt(actual) === normalizeGeneratedAt(expected)
        : actual === expected;
    if (!equal) {
      throw new Error(
        `route registry is stale: run npm run sprint14:routes (${relativeSource(outputPath)})`,
      );
    }
  }
}

console.log(
  `Sprint 14 routes: ${artifacts.summary.activePages} active, ` +
    `${artifacts.summary.dodProven} DoD proven, gate ${artifacts.releaseGate}`,
);

if (mode === "release-gate" && artifacts.releaseGate !== "GO") {
  process.exitCode = 1;
}
